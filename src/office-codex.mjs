import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { projectDir } from './config.mjs';
import { toolInfo } from './goose-events.mjs';

const launcher = join(projectDir, '.tools', 'office-codex', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
const providerArgs = ['-c', 'model_provider="openai"', '-c', 'forced_login_method="chatgpt"'];
const imageExt = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function nativeCommand() {
  if (process.env.OFFICE_CODEX_BIN) return [resolve(projectDir, process.env.OFFICE_CODEX_BIN), []];
  if (existsSync(launcher)) return [process.execPath, [launcher]];
  return ['codex', []];
}

async function configuredWindowsSandbox() {
  const home = process.env.CODEX_HOME ? resolve(process.env.CODEX_HOME) : join(homedir(), '.codex');
  try {
    const config = await readFile(join(home, 'config.toml'), 'utf8');
    const section = /^\s*\[windows\][ \t]*(?:#[^\r\n]*)?\r?\n([\s\S]*?)(?=^\s*\[|(?![\s\S]))/m.exec(config)?.[1];
    return /^[ \t]*sandbox[ \t]*=[ \t]*["'](mxc|elevated|unelevated)["']/m.exec(section ?? '')?.[1];
  } catch {
    return undefined;
  }
}

export async function inspectNativeCodex({ cwd, env }) {
  const [command, prefix] = nativeCommand();
  const child = spawn(command, [...prefix, 'app-server', '--listen', 'stdio://', ...providerArgs], {
    cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'], signal: AbortSignal.timeout(9000)
  });
  child.on('error', () => {});
  child.stdin.on('error', () => {});
  const send = (id, method, params) => child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  try {
    send(1, 'initialize', { clientInfo: { name: 'goose-office', title: 'Goose Office', version: '0.1.0' } });
    for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
      const message = JSON.parse(line);
      if (message.id === 1 && message.result) {
        child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
        send(2, 'account/read', { refreshToken: false });
      } else if (message.id === 2) {
        if (message.result?.account?.type !== 'chatgpt') return {};
        send(3, 'model/list', { limit: 100, includeHidden: false });
      } else if (message.id === 3) {
        return Object.fromEntries((message.result?.data || [])
          .filter(model => typeof model.model === 'string' && Array.isArray(model.supportedReasoningEfforts))
          .map(model => [model.model, model.supportedReasoningEfforts.map(entry => entry.reasoningEffort)]));
      } else if (message.id === 1) {
        return {};
      }
    }
    return {};
  } finally {
    child.stdin.end();
  }
}

function readCodexEvents(onProgress) {
  let pending = '', answer = '';
  const tools = new Set();
  const toolKinds = { command_execution: 'command', file_change: 'file', mcp_tool_call: 'tool', web_search: 'web' };
  function line(raw) {
    let event;
    try { event = JSON.parse(raw); } catch { return; }
    const item = event?.item;
    if (!item) return;
    if (item.type === 'agent_message' && typeof item.text === 'string') {
      if (event.type === 'item.completed') answer = item.text;
      onProgress?.({ type: 'text', text: item.text.slice(0, 24000) });
    } else if (Object.hasOwn(toolKinds, item.type) && typeof item.id === 'string') {
      if (!tools.has(item.id) && tools.size < 150) {
        tools.add(item.id);
        const label = item.type === 'mcp_tool_call' ? [item.server, item.tool].filter(Boolean).join('/') : item.type;
        const detail = toolInfo({
          name: label, arguments: { command: item.command, path: item.changes?.[0]?.path, description: item.query }
        });
        onProgress?.({ type: 'tool', id: item.id, status: 'running', ...detail,
          kind: detail.kind === 'tool' ? toolKinds[item.type] : detail.kind });
      }
      if (event.type === 'item.completed' && tools.has(item.id)) {
        const failed = item.status === 'failed' || (Number.isInteger(item.exit_code) && item.exit_code !== 0);
        onProgress?.({ type: 'tool', id: item.id, status: failed ? 'failed' : 'done',
          detail: Number.isInteger(item.exit_code) ? `結束代碼 ${item.exit_code}` : '' });
      }
    }
  }
  return {
    feed(chunk) {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      for (const value of lines) line(value);
    },
    finish() { if (pending) line(pending); return answer.trim(); }
  };
}

export async function runNativeCodex({ model, effort, execute, artifactDir, images, input, onProgress, invoke }) {
  const [command, prefix] = nativeCommand();
  const args = [...prefix, 'exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config',
    '--sandbox', execute ? 'workspace-write' : 'read-only', '--model', model, ...providerArgs,
    '-c', `model_reasoning_effort="${effort}"`, '-c', 'approval_policy="never"', '-c', 'web_search="disabled"',
    '-c', 'features.apps=false', '-c', 'features.multi_agent=false', '-c', 'features.multi_agent_v2=false',
    '-c', 'features.skill_mcp_dependency_install=false'];
  if (!execute) args.push('-c', 'features.shell_tool=false', '-c', 'features.view_image=false', '-c', 'features.shell_snapshot=false');
  if (execute && artifactDir) args.push('--add-dir', artifactDir);
  if (execute && process.platform === 'win32') {
    const sandbox = await configuredWindowsSandbox();
    if (sandbox) args.push('-c', `windows.sandbox="${sandbox}"`);
  }
  let folder;
  try {
    if (images.length) {
      folder = await mkdtemp(join(tmpdir(), 'goose-office-codex-images-'));
      for (const [index, image] of images.entries()) {
        const filename = join(folder, `${index + 1}.${imageExt[image.mime] || 'png'}`);
        await writeFile(filename, image.data, { encoding: 'base64', mode: 0o600 });
        args.push('--image', filename);
      }
    }
    const stream = readCodexEvents(onProgress);
    await invoke(command, [...args, '--', '-'], input, stream.feed);
    return stream.finish();
  } finally {
    if (folder) await rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}
