import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { getGooseBin, officeClaudeBin } from './config.mjs';
import { prepareAgent } from './goose.mjs';
import { installOfficeClaude } from './office-install.mjs';

const exec = promisify(execFile);
const authTimeout = 6 * 60 * 1000;

export async function getOfficeClaudeBin() {
  if (process.env.CLAUDE_CODE_EXECUTABLE) return process.env.CLAUDE_CODE_EXECUTABLE;
  if (existsSync(officeClaudeBin)) return officeClaudeBin;
  // Use the same official native binary as the project's Claude ACP adapter.
  const manifest = import.meta.resolve('@agentclientprotocol/claude-agent-acp/package.json');
  const { claudeCliPath } = await import(new URL('./dist/claude-cli.js', manifest));
  return claudeCliPath();
}

async function ensureOfficeClaude(signal, onInstall) {
  try {
    return await getOfficeClaudeBin();
  } catch {
    signal.throwIfAborted();
    let sdk;
    try {
      const requireAdapter = createRequire(import.meta.resolve('@agentclientprotocol/claude-agent-acp/package.json'));
      const sdkEntry = requireAdapter.resolve('@anthropic-ai/claude-agent-sdk');
      sdk = JSON.parse(await readFile(join(dirname(sdkEntry), 'package.json'), 'utf8'));
    } catch {
      throw new Error('缺少 Claude ACP 元件。請在專案目錄執行 npm ci --include=optional 後再試。');
    }
    onInstall();
    await installOfficeClaude(sdk, signal);
    return officeClaudeBin;
  }
}

function openGooseAuth(signal, onAuthorize) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const { env, cwd } = prepareAgent('codex');
    const child = spawn(getGooseBin(), ['acp'], {
      cwd, env, signal, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore']
    });
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    let result, failure;
    let sawHandshake = false;
    const send = (id, method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    child.on('error', error => { failure ??= error; });
    child.stdin.on('error', error => { failure ??= error; });
    child.on('close', () => {
      lines.close();
      if (result) resolve();
      else if (signal.aborted) reject(signal.reason);
      else reject(failure ?? new Error('Goose CLI 已關閉，請重試或使用手動登入。'));
    });
    lines.on('line', line => {
      let response;
      try { response = JSON.parse(line); } catch { return; }
      if (response?.id === 1 && !sawHandshake && response.result?.protocolVersion === 1) {
        sawHandshake = true;
        onAuthorize();
        send(2, '_goose/unstable/providers/config/authenticate', { providerId: 'chatgpt_codex' });
      } else if (response?.id === 2 && sawHandshake) {
        result = Boolean(response.result);
        if (response.error) {
          const detail = JSON.stringify(response.error);
          if (response.error.code === -32601) failure = new Error('這個 Goose 版本需要手動登入。');
          else if (/address already in use|os error 10048|already bound/i.test(detail)) {
            failure = new Error('登入回呼連接埠 1455 已被使用。請結束其他 Codex 登入流程後再試。');
          } else failure = new Error('ChatGPT 授權未完成。請再試一次，或使用手動登入。');
        }
        child.stdin.end();
      } else if (response?.id === 1 && !sawHandshake) {
        failure = new Error('這個 Goose 版本需要手動登入。');
        child.stdin.end();
      }
    });
    send(1, 'initialize', { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'Goose Office', version: '0.1.0' } });
  });
}

export async function authenticateOfficeManager(manager, { signal, onAuthorize, onInstall }) {
  const binary = manager === 'claude' ? await ensureOfficeClaude(signal, onInstall) : null;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(authTimeout)]);
  if (manager === 'claude') {
    deadline.throwIfAborted();
    onAuthorize();
    try {
      await exec(binary, ['auth', 'login'], {
        ...prepareAgent('claude'), signal: deadline, windowsHide: true
      });
    } catch {
      if (deadline.aborted && !signal.aborted) throw new Error('Claude 授權等待逾時。');
      throw new Error('Claude 授權未完成。若瀏覽器沒有開啟，請使用手動登入。');
    }
    return;
  }
  try {
    await openGooseAuth(deadline, onAuthorize);
  } catch (error) {
    if (deadline.aborted && !signal.aborted) throw new Error('ChatGPT 授權等待逾時。');
    if (error.code) throw new Error('無法啟動 Goose 的授權流程。請重試或使用手動登入。');
    throw error;
  }
}
