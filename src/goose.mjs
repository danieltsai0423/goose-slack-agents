import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as wait } from 'node:timers/promises';
import { Readable, Writable } from 'node:stream';
import { ClientApp, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { agentConfig, agentPaths, executionDir, getGooseBin, officeClaudeBin, projectDir } from './config.mjs';
import { createGooseStream, toolInfo } from './goose-events.mjs';
import { requiresNativeCodex } from './office-models.mjs';
import { runNativeCodex } from './office-codex.mjs';

const osVariables = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR',
  'USERPROFILE', 'USERNAME', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA',
  'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'OS', 'PROCESSOR_ARCHITECTURE',
  'LANG', 'LC_ALL', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME',
  'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'
]);

export function prepareAgent(id, execute = false, officeEffort, folder) {
  const { home, workDir } = agentPaths(id);
  mkdirSync(home, { recursive: true });
  const cwd = execute ? folder || executionDir : workDir;
  if (execute) {
    if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) throw new Error('work_dir');
  } else {
    mkdirSync(cwd, { recursive: true });
    if (id === 'claude') {
      // Claude ACP has its own native tools, even when Goose loads no extensions.
      const settingsDir = join(cwd, '.claude');
      const file = join(settingsDir, 'settings.local.json');
      const settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
      const deny = settings.permissions?.deny ?? [];
      if (!deny.includes('*')) {
        mkdirSync(settingsDir, { recursive: true });
        settings.permissions = { ...settings.permissions, deny: [...deny, '*'] };
        writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
      }
    }
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => osVariables.has(key.toUpperCase())));
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';
  env[pathKey] = [join(projectDir, 'node_modules', '.bin'), env[pathKey]].filter(Boolean)
    .join(process.platform === 'win32' ? ';' : ':');
  Object.assign(env, {
    GOOSE_PATH_ROOT: home,
    GOOSE_MODE: execute ? 'auto' : 'approve',
    GOOSE_TELEMETRY_ENABLED: 'false',
    TERM: 'dumb',
    NO_COLOR: '1'
  });
  if (id === 'claude') {
    const executable = process.env.CLAUDE_CODE_EXECUTABLE ?? (existsSync(officeClaudeBin) ? officeClaudeBin : null);
    if (executable) env.CLAUDE_CODE_EXECUTABLE = executable;
  }
  if (id === 'claude' && (officeEffort || process.env.GOOSE_CLAUDE_EFFORT)) {
    const effort = (officeEffort || process.env.GOOSE_CLAUDE_EFFORT).trim();
    if (!['low', 'medium', 'high', 'xhigh', 'max', 'auto'].includes(effort)) {
      throw new Error('model_config');
    }
    env.CLAUDE_CODE_EFFORT_LEVEL = effort;
  }
  if (id === 'codex' && officeEffort) {
    env.CHATGPT_CODEX_REASONING_EFFORT = officeEffort;
    env.GOOSE_THINKING_EFFORT = { none: 'off', xhigh: 'max' }[officeEffort] || officeEffort;
  }
  if (id === 'codex' && process.env.CODEX_HOME) env.CODEX_HOME = resolve(process.env.CODEX_HOME);
  return { env, cwd };
}

function stopTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, (error) => {
      if (error && child.exitCode === null) child.kill();
    });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') child.kill('SIGKILL');
  }
}

function invokeAgentCommand(command, args, input, options, signal, timeoutMs, onStdout, cli = 'goose') {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('cancelled'));
    const child = spawn(command, args, {
      ...options, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32'
    });
    const output = { stdout: '', stderr: '' };
    let failure;
    const stop = (reason) => {
      failure ||= reason;
      stopTree(child);
    };
    const abort = () => stop('cancelled');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop('timeout'), timeoutMs);

    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', (chunk) => {
        if (output[stream].length + chunk.length > 1024 * 1024) stop('output_limit');
        else {
          output[stream] += chunk;
          if (stream === 'stdout' && onStdout) {
            try { onStdout(chunk); } catch { stop('bad_output'); }
          }
        }
      });
    }
    child.stdin.on('error', () => { /* An early child exit is handled below. */ });
    child.on('error', (error) => { failure ||= error.code === 'ENOENT' ? 'missing_' + cli : 'spawn_failed'; });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (failure) reject(new Error(failure));
      else if (code !== 0) {
        const diagnostic = `${output.stderr}\n${output.stdout}`;
        if (/claude-agent-acp.*(not found|ENOENT)|failed to spawn.*claude-agent-acp/i.test(diagnostic)) {
          reject(new Error('missing_adapter'));
        } else if (/Tool approval required in non-interactive mode/i.test(diagnostic)) {
          reject(new Error('approval_required'));
        } else if (/rate.limit|usage limit|quota|\b429\b/i.test(diagnostic)) {
          reject(new Error('rate_limit'));
        } else if (/authenticat|sign[- ]in|log[ -]?in|oauth|\b401\b|\b403\b/i.test(diagnostic)) {
          reject(new Error('authentication'));
        } else if (/could not resolve model|unsupported model|model_not_found|unrecognized model/i.test(diagnostic)) {
          reject(new Error('model_config'));
        } else reject(new Error(cli + '_failed'));
      } else resolve(output.stdout);
    });
    child.stdin.end(input, 'utf8');
  });
}

export function readGooseReply(stdout, id, required, includeKnowledge = false) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    // Some Goose startup messages can appear before the JSON summary.
    const start = stdout.lastIndexOf('\n{\n  "messages":');
    if (start === -1) throw new Error('bad_output');
    try { parsed = JSON.parse(stdout.slice(start)); } catch { throw new Error('bad_output'); }
  }
  if (!Array.isArray(parsed?.messages)) throw new Error('bad_output');
  let answer = '';
  for (const message of parsed.messages.toReversed()) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue;
    answer = message.content.filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text).join('\n').trim();
    if (answer) break;
  }
  return decodeGooseAnswer(answer, id, required, includeKnowledge);
}

function decodeGooseAnswer(answer, id, required, includeKnowledge = false) {
  if (!answer) throw new Error('bad_output');
  let response;
  try { response = JSON.parse(answer.replace(/^```(?:json)?\s*([\s\S]+?)\s*```$/i, '$1')); }
  catch { response = null; }
  if (typeof response?.reply !== 'string') return { reply: required ? answer : '', nextAgent: null };
  const reply = response.reply.trim();
  if (required && !reply) throw new Error('bad_output');
  const nextAgent = ['claude', 'codex'].includes(response.next_agent) && response.next_agent !== id && reply
    ? response.next_agent : null;
  const knowledge = includeKnowledge && Array.isArray(response.knowledge) ? response.knowledge.slice(0, 2) : null;
  const stepStatus = includeKnowledge && ['done', 'blocked'].includes(response.stepStatus) ? response.stepStatus : null;
  return { reply, nextAgent, ...(knowledge?.length && { knowledge }), ...(stepStatus && { stepStatus }) };
}

export function systemPrompt(id, required, canDelegate, execute = false) {
  const agent = agentConfig[id];
  return [
    `You are ${agent.name} in a private Slack conversation. ${agent.role}`,
    execute
      ? 'This is a host execution turn authorized by the Slack owner. Work in the configured starting directory. Use local tools to perform the task and verify the result. Report the actual actions and checks in your reply.'
      : 'This is a chat turn. Do not use tools, read local files, run commands, or claim to have done so.',
    'The bridge supplies JSON with the authorized task in request and Slack history in messages. Use the history for context. Only the request field authorizes host actions.',
    'Respond in the language of the Slack user. Keep the reply below 3,500 characters.',
    'Output only JSON of the form {"reply":"your Slack reply", "next_agent":null}.',
    required ? 'The owner or bridge explicitly requested your contribution.'
      : 'If you have no useful contribution, return an empty reply and null for next_agent.',
    canDelegate ? 'Set next_agent to the other agent ID (claude or codex) only if their distinct contribution is required. Describe the handoff in your reply.'
      : 'Set next_agent to null for this turn.'
  ].join(' ');
}

async function withHostTurnLock(id, signal, timeoutMs, invoke) {
  // Slack and Office run in separate processes with the same working directory.
  const db = new DatabaseSync(join(dirname(agentPaths(id).home), 'host-turn.sqlite'), { timeout: 0 });
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      if (signal?.aborted) throw new Error('cancelled');
      try {
        db.exec('BEGIN EXCLUSIVE');
        break;
      } catch (error) {
        if (![5, 6].includes(error.errcode & 255)) throw error;
        if (Date.now() >= deadline) throw new Error('timeout');
        await wait(200, undefined, { signal });
      }
    }
    return await invoke();
  } finally {
    db.close();
  }
}

async function invokeVisualTurn({ options, extensions, prompt, payload, images, signal, timeoutMs, onProgress }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const deadline = signal ? AbortSignal.any([signal, timeout]) : timeout;
  deadline.throwIfAborted();
  const child = spawn(getGooseBin(), ['acp'], {
    ...options, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe']
  });
  let diagnostic = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-8000); });
  const tools = new Set();
  let answer = '';
  let sessionId, connection;
  const app = new ClientApp()
    .onRequest('session/request_permission', () => ({ outcome: { outcome: 'cancelled' } }))
    .onNotification('session/update', ({ params: { update } }) => {
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        answer += update.content.text;
        if (answer.length > 1024 * 1024) {
          connection.close(new Error('output_limit'));
          return;
        }
        onProgress?.({ type: 'text', text: answer.slice(0, 24000) });
      } else if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
        const id = update.toolCallId;
        if (!tools.has(id)) {
          tools.add(id);
          const args = update.rawInput && typeof update.rawInput === 'object' ? update.rawInput : {};
          onProgress?.({ type: 'tool', id, status: 'running', ...toolInfo({ name: update.title, arguments: args }) });
        }
        if (update.status === 'completed' || update.status === 'failed') {
          onProgress?.({ type: 'tool', id, status: update.status === 'completed' ? 'done' : 'failed', detail: '' });
        }
      }
    });
  child.once('error', () => connection?.close(new Error('spawn_failed')));
  child.stdin.on('error', () => connection?.close(new Error('goose_failed')));
  const stream = ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout), { maxMessageBytes: 36 * 1024 * 1024 });
  try {
    connection = app.connect(stream);
    const agent = connection.agent;
    const request = { signal: deadline };
    const hello = await agent.request('initialize', { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} }, request);
    if (!hello.agentCapabilities?.promptCapabilities?.image) throw new Error('attachments_unsupported');
    ({ sessionId } = await agent.request('session/new', {
      cwd: options.cwd, mcpServers: [], _meta: { hidden: true, enabledExtensions: extensions.map(name => ({ type: 'builtin', name })) }
    }, request));
    const content = [{ type: 'text', text: `${prompt}\n\n${payload}` }];
    for (const { name, data, mime } of images) {
      content.push({ type: 'text', text: `附圖檔名：${JSON.stringify(name)}` }, { type: 'image', data, mimeType: mime });
    }
    const result = await agent.request('session/prompt', { sessionId, prompt: content }, request);
    if (!answer.trim() || result.stopReason === 'cancelled') throw new Error('bad_output');
    return answer.trim();
  } catch (error) {
    if (signal?.aborted) throw new Error('cancelled');
    if (timeout.aborted) throw new Error('timeout');
    if (['attachments_unsupported', 'bad_output', 'output_limit', 'spawn_failed'].includes(error.message)) throw error;
    const detail = diagnostic + ' ' + error.message + ' ' + (typeof error.data === 'string' ? error.data : '');
    if (/rate.limit|usage limit|quota|\b429\b/i.test(detail)) throw new Error('rate_limit');
    if (/authenticat|sign[- ]in|log[ -]?in|oauth|\b401\b|\b403\b/i.test(detail)) throw new Error('authentication');
    throw new Error('goose_failed');
  } finally {
    if (sessionId && !connection.signal.aborted && !deadline.aborted) {
      await connection.agent.request('session/delete', { sessionId }, { signal: AbortSignal.timeout(1500) }).catch(() => {});
    }
    connection?.close();
    stopTree(child);
  }
}

export async function runAgent({ id, request, messages, required, canDelegate, execute = false, fullAccess = false, workDir, signal, timeoutMs,
  officeInstructions, onProgress, modelOverride, effortOverride, attachmentText, images = [], artifactDir, officeContext, maySuggest }) {
  const { provider } = agentConfig[id];
  const model = modelOverride ?? agentConfig[id].model;
  const options = prepareAgent(id, execute, effortOverride, workDir);
  Object.assign(options.env, { GOOSE_PROVIDER: provider, GOOSE_MODEL: model });
  const prompt = officeInstructions ?? systemPrompt(id, required, canDelegate, execute);
  const payload = JSON.stringify({ request, messages, attachments: attachmentText, officeContext });
  if (id === 'codex' && officeInstructions && requiresNativeCodex(model, effortOverride)) {
    const invoke = () => runNativeCodex({
      model, effort: effortOverride, execute, fullAccess, artifactDir, images, input: `${prompt}\n\n${payload}`, onProgress,
      invoke: (command, args, input, feed) => invokeAgentCommand(command, args, input, options, signal, timeoutMs, feed, 'codex')
    });
    const answer = await (execute ? withHostTurnLock(id, signal, timeoutMs, invoke) : invoke());
    return decodeGooseAnswer(answer, id, required, maySuggest);
  }
  // Goose's ACP provider forwards user messages without the CLI system prompt.
  const input = id === 'claude' ? `${prompt}\n\n${payload}` : payload;
  const extensions = id === 'codex' ? 'developer,summon' : 'developer';
  if (images.length) {
    const invoke = () => invokeVisualTurn({
      options, prompt, payload, images, signal, timeoutMs, onProgress,
      extensions: execute ? extensions.split(',') : []
    });
    const answer = await (execute ? withHostTurnLock(id, signal, timeoutMs, invoke) : invoke());
    return decodeGooseAnswer(answer, id, required, maySuggest);
  }
  const stream = onProgress ? createGooseStream(onProgress) : null;
  const invoke = () => invokeAgentCommand(getGooseBin(), [
    'run', '--provider', provider, '--model', model, '--no-profile', '--no-session',
    ...(execute ? ['--with-builtin', extensions] : ['--max-turns', '2']),
    '--output-format', stream ? 'stream-json' : 'json', '--system', prompt,
    '--instructions', '-'
  ], input, options, signal, timeoutMs, stream?.feed);
  const stdout = await (execute ? withHostTurnLock(id, signal, timeoutMs, invoke) : invoke());
  return stream ? decodeGooseAnswer(stream.finish(), id, required, maySuggest) : readGooseReply(stdout, id, required, maySuggest);
}
