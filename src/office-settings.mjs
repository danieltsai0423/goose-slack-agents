// Settings people can change from the Office page instead of editing .env. Saved values live in
// STATE_DIR/office-settings.json (local, never committed) and take priority over .env. Import this module before
// anything else in a process, so settings are in process.env before other modules read them.
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url));

// live: used on the next request. restart: read when the Office (or the Slack bridge, for scope 'slack') starts.
export const settingFields = [
  { key: 'CLAUDE_CODE_EXECUTABLE', group: 'claude', kind: 'file', apply: 'live' },
  { key: 'GOOSE_CLAUDE_MODEL', group: 'claude', kind: 'text', apply: 'restart', scope: 'slack', fallback: 'current' },
  { key: 'GOOSE_CLAUDE_EFFORT', group: 'claude', kind: 'choice', options: ['low', 'medium', 'high', 'xhigh', 'max'], apply: 'restart', scope: 'slack' },
  { key: 'OFFICE_CODEX_BIN', group: 'codex', kind: 'file', apply: 'live' },
  { key: 'CODEX_HOME', group: 'codex', kind: 'folder', apply: 'live', fallback: '~/.codex' },
  { key: 'GOOSE_CODEX_MODEL', group: 'codex', kind: 'text', apply: 'restart', scope: 'slack', fallback: 'gpt-5.6-sol' },
  { key: 'GOOSE_BIN', group: 'goose', kind: 'file', apply: 'live' },
  { key: 'GOOSE_WORK_DIR', group: 'goose', kind: 'folder', apply: 'restart', fallback: '.' },
  { key: 'GOOSE_TURN_TIMEOUT_SECONDS', group: 'goose', kind: 'seconds', min: 10, max: 900, apply: 'restart', fallback: '180' },
  { key: 'OFFICE_HOST_TURN_TIMEOUT_SECONDS', group: 'goose', kind: 'seconds', min: 60, max: 3600, apply: 'restart', fallback: '900' },
  { key: 'OFFICE_ECONOMY_SYNC_SECONDS', group: 'office', kind: 'seconds', min: 0, max: 86400, apply: 'restart', fallback: '300' }
];
const fieldByKey = Object.fromEntries(settingFields.map(field => [field.key, field]));
// What .env (or the shell) set before any saved setting was applied.
const fromEnv = Object.fromEntries(settingFields.map(({ key }) => [key, process.env[key]]));

function problem(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }

function clean(field, raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.length > 400 || /[\0\r\n]/.test(value)) throw problem(400, '設定值格式錯誤。');
  if (field.kind === 'seconds') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < field.min || n > field.max || field.key === 'OFFICE_ECONOMY_SYNC_SECONDS' && n > 0 && n < 60) {
      throw problem(400, field.key === 'OFFICE_ECONOMY_SYNC_SECONDS' ? '同步間隔必須是 0 或 60 到 86400 秒。' : `請輸入 ${field.min} 到 ${field.max} 秒。`);
    }
    return String(n);
  }
  if (field.kind === 'choice' && !field.options.includes(value)) throw problem(400, '請從清單選擇。');
  if (field.kind === 'text' && !/^[\w.:\-/[\]]+$/.test(value)) throw problem(400, '模型名稱只能包含英數字與 . : - / _。');
  if (field.kind === 'file' || field.kind === 'folder') {
    const path = resolve(projectDir, value);
    if (!isAbsolute(value) && !value.startsWith('.')) throw problem(400, '請輸入完整路徑。');
    let stats = null;
    try { stats = statSync(path); } catch { throw problem(400, '找不到這個路徑。'); }
    if (field.kind === 'folder' ? !stats.isDirectory() : !stats.isFile()) throw problem(400, field.kind === 'folder' ? '這不是資料夾。' : '這不是執行檔。');
  }
  return value;
}

export function openOfficeSettings({ file = resolve(projectDir, process.env.STATE_DIR || '.data', 'office-settings.json') } = {}) {
  let saved = {};
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(data?.values || {})) if (fieldByKey[key] && typeof value === 'string' && value) saved[key] = value;
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('office settings ignored:', error.name);
  }
  const apply = () => {
    for (const { key } of settingFields) {
      const value = saved[key] ?? fromEnv[key];
      if (value === undefined || value === '') delete process.env[key]; else process.env[key] = value;
    }
  };
  apply();
  return {
    snapshot() {
      return {
        fields: settingFields.map(field => ({
          ...field, saved: saved[field.key] ?? '', env: fromEnv[field.key] ?? '', effective: process.env[field.key] ?? '',
          exists: field.kind === 'file' || field.kind === 'folder' ? (process.env[field.key] ? existsSync(resolve(projectDir, process.env[field.key])) : null) : null
        }))
      };
    },
    // values: { KEY: 'value' | '' }. An empty value removes the saved setting and falls back to .env or the default.
    save(values = {}) {
      if (!values || typeof values !== 'object' || Array.isArray(values)) throw problem(400, '設定格式錯誤。');
      const next = { ...saved };
      for (const [key, raw] of Object.entries(values)) {
        const field = fieldByKey[key];
        if (!field) throw problem(400, '未知的設定項目。');
        const value = clean(field, raw);
        if (value) next[key] = value; else delete next[key];
      }
      mkdirSync(dirname(file), { recursive: true });
      const temp = file + '.tmp';
      writeFileSync(temp, JSON.stringify({ version: 1, values: next }, null, 2));
      renameSync(temp, file);
      const changed = settingFields.filter(({ key }) => (next[key] ?? '') !== (saved[key] ?? '')).map(({ key }) => key);
      saved = next;
      apply();
      return { ...this.snapshot(), changed, restart: changed.some(key => fieldByKey[key].apply === 'restart') };
    }
  };
}

// Applied once when a process imports this module.
export const officeSettings = openOfficeSettings();
