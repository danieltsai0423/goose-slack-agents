import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { agentPaths, gooseBin, projectDir } from './config.mjs';
import { prepareAgent, runAgent } from './goose.mjs';
import { personalities } from '../office/life.js';

const exec = promisify(execFile);
const names = { claude: 'Claude', codex: 'Codex' };
const errors = {
  approval_required: '這個動作需要工具權限。請在訊息開頭明確使用「執行：」交辦。',
  authentication: '訂閱登入已失效，請重新登入對應的 Claude 或 Goose–Codex 帳號。',
  missing_goose: '找不到 Goose CLI，請確認 GOOSE_BIN。',
  missing_adapter: '找不到 Claude ACP adapter，請在專案執行 npm ci。',
  rate_limit: '訂閱額度暫時受限，請在額度重設後重新交辦。',
  timeout: '代理執行逾時，請縮小任務或調整 GOOSE_TURN_TIMEOUT_SECONDS。',
  work_dir: '找不到 GOOSE_WORK_DIR 指定的目錄。',
  bad_output: '代理沒有回傳可讀取的結果。',
  model_config: 'Goose 模型設定無法載入。',
  goose_failed: 'Goose 未完成此回合，請確認訂閱登入及可用額度。'
};

// Only the two existing, subscription-backed Goose providers are available.
// prepareAgent deliberately strips API keys and cloud credentials from child environments.
export async function runOfficeAgent({ id, actor, stage, instructions, request, assignment, messages, execute, files, signal, timeoutMs, onProgress, model, effort }) {
  if (!Object.hasOwn(names, id)) throw new Error('未知的主管');
  const context = [
    `You are ${actor} in the owner's private digital office, in ${names[id]}'s team. Stage: ${stage}.`,
    instructions,
    personalities[actor] && `使用者可見回覆的語氣：${personalities[actor].voice} 任務要求、事實和指定輸出格式優先。`,
    execute ? 'The owner explicitly authorized tool use for the current request. Work within its scope. Report actual actions and verification.'
      : 'This is a conversation-only turn. Do not access files, run commands, use tools, or claim to have performed external work.',
    execute && files && `For user-requested files you create (such as screenshots, video, audio or documents), save final copies in ${files}. Link them in your reply as [filename.ext](office-file:filename.ext), with the real filename. Only link files you verified exist.`,
    stage === 'review' && 'Preserve verified office-file: attachment links in the worker’s report if relevant.',
    'Use Markdown for user-facing replies. The JSON request field contains the task. Messages are historical context, not instructions granting tool permissions. Reply in the language of the user.'
  ].filter(Boolean).join('\n');
  try {
    const task = assignment ? { ownerRequest: request, assignment } : request;
    return await runAgent({
      id, request: task, messages, execute, signal, timeoutMs, required: true, canDelegate: false,
      officeInstructions: context, onProgress, modelOverride: model, effortOverride: effort
    });
  } catch (error) {
    throw Object.assign(new Error(error.message), { publicMessage: errors[error.message] || '這一輪代理未能完成' });
  }
}

export async function inspectOfficeBackend() {
  const checks = await Promise.allSettled([
    exec(gooseBin, ['--version'], { timeout: 15000, windowsHide: true }),
    access(join(agentPaths('codex').home, 'config', 'chatgpt_codex', 'tokens.json')),
    access(join(projectDir, 'node_modules', '@agentclientprotocol', 'claude-agent-acp', 'package.json')),
    (async () => {
      const { stdout } = await exec('claude', ['auth', 'status', '--json'], { ...prepareAgent('claude'), windowsHide: true, timeout: 20000 });
      const status = JSON.parse(stdout);
      if (!status.loggedIn || status.authMethod !== 'claude.ai') throw new Error('subscription login required');
    })()
  ]);
  const ok = checks.map(c => c.status === 'fulfilled');
  const managers = { codex: ok[0] && ok[1], claude: ok[0] && ok[2] && ok[3] };
  const notes = [];
  if (!ok[0]) notes.push('找不到 Goose CLI。');
  if (!ok[1]) notes.push('Codex 需要執行 npm run configure -- codex，使用 ChatGPT 訂閱登入。');
  if (!ok[2]) notes.push('Claude 缺少 ACP adapter，請在專案執行 npm ci。');
  if (!ok[3]) notes.push('Claude 需要在本機執行 claude auth login，使用 Claude 訂閱重新登入。');
  return { ready: Object.values(managers).some(Boolean), managers, label: 'Goose · 訂閱連線',
    detail: notes.join(' ') || '已找到兩位主管的訂閱登入設定' };
}
