import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectDir = fileURLToPath(new URL('../', import.meta.url));
export const executionDir = resolve(projectDir, process.env.GOOSE_WORK_DIR || '.');

const bundledGoose = resolve(projectDir, '.tools/goose/goose-package/goose.exe');
const stateDir = resolve(projectDir, process.env.STATE_DIR || '.data');

export const agentNames = ['claude', 'codex'];
export const agentConfig = {
  claude: {
    name: 'Claude', provider: 'claude-acp', model: process.env.GOOSE_CLAUDE_MODEL || 'current',
    role: 'Default to defining requirements and reviewing decisions, changes and evidence.'
  },
  codex: {
    name: 'Codex', provider: 'chatgpt_codex', model: process.env.GOOSE_CODEX_MODEL || 'gpt-5.6-sol',
    role: 'Default to implementation plans, concrete changes, and validation steps.'
  }
};

export const gooseVersion = '1.60.2';
export const officeToolsDir = resolve(stateDir, 'office-tools');
export const officeGooseBin = resolve(officeToolsDir, `goose-${gooseVersion}`, process.platform === 'win32' ? 'goose.exe' : 'goose');
export const officeClaudeBin = resolve(officeToolsDir, 'claude', process.platform === 'win32' ? 'claude.exe' : 'claude');

export function getGooseBin() {
  if (process.env.GOOSE_BIN) return resolve(projectDir, process.env.GOOSE_BIN);
  if (existsSync(bundledGoose)) return bundledGoose;
  return existsSync(officeGooseBin) ? officeGooseBin : 'goose';
}

export function agentPaths(id) {
  return { home: resolve(stateDir, `goose-${id}`), workDir: resolve(stateDir, `work-${id}`) };
}

export function loadConfig() {
  const required = (name, pattern) => {
    const value = process.env[name]?.trim();
    if (!value || value.includes('replace-me') || /^[CGUW]0+$/.test(value) || !pattern.test(value)) {
      throw new Error(`請在本機 .env 設定 ${name}。`);
    }
    return value;
  };
  const timeoutSeconds = Number(process.env.GOOSE_TURN_TIMEOUT_SECONDS || 180);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 900) {
    throw new Error('GOOSE_TURN_TIMEOUT_SECONDS 必須介於 10 到 900 秒。');
  }
  return {
    stateDir,
    timeoutMs: timeoutSeconds * 1000,
    ownerId: required('SLACK_OWNER_USER_ID', /^[UW][A-Z0-9]+$/),
    channel: required('SLACK_CHANNEL_ID', /^[CG][A-Z0-9]+$/),
    appToken: required('SLACK_CODEX_APP_TOKEN', /^xapp-/),
    tokens: {
      codex: required('SLACK_CODEX_BOT_TOKEN', /^xoxb-/),
      claude: required('SLACK_CLAUDE_BOT_TOKEN', /^xoxb-/)
    }
  };
}
