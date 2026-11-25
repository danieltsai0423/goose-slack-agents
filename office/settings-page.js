// Settings page: where Claude, Codex and Goose are found and how long they may run, saved locally through
// /api/settings. Values left empty fall back to .env, then to the built-in default.
const groups = [
  { id: 'claude', title: 'Claude', blurb: 'Claude Code 執行檔與 Slack 橋接器使用的預設模型。' },
  { id: 'codex', title: 'Codex', blurb: '原生 Codex CLI、它的設定資料夾，以及 Slack 橋接器使用的預設模型。' },
  { id: 'goose', title: 'Goose', blurb: 'Goose CLI、預設工作目錄與每回合的時間上限。' },
  { id: 'office', title: '辦公室', blurb: '辦公室經營與用量同步。' }
];
const labels = {
  CLAUDE_CODE_EXECUTABLE: ['Claude Code 執行檔', '留空時使用 Office 安裝的版本或 PATH 上的 claude。'],
  GOOSE_CLAUDE_MODEL: ['Slack 預設模型', '網頁交辦在交辦台選模型；這裡只影響 Slack 橋接器。'],
  GOOSE_CLAUDE_EFFORT: ['Slack 推理強度', '只影響 Slack 橋接器。'],
  OFFICE_CODEX_BIN: ['Codex CLI 執行檔', '留空時使用 PATH 上的 codex。'],
  CODEX_HOME: ['Codex 設定資料夾', '登入資料與設定所在的資料夾，預設為使用者目錄下的 .codex。'],
  GOOSE_CODEX_MODEL: ['Slack 預設模型', '網頁交辦在交辦台選模型；這裡只影響 Slack 橋接器。'],
  GOOSE_BIN: ['Goose CLI 執行檔', '留空時使用 Office 安裝的版本或 PATH 上的 goose。'],
  GOOSE_WORK_DIR: ['預設工作目錄', '交辦台選「不指定資料夾」時，代理在這裡工作。'],
  GOOSE_TURN_TIMEOUT_SECONDS: ['對話回合時間上限（秒）', '僅對話的回合，10 到 900 秒。'],
  OFFICE_HOST_TURN_TIMEOUT_SECONDS: ['工具回合時間上限（秒）', '使用工作區或完整存取權的回合，60 到 3600 秒。'],
  OFFICE_ECONOMY_SYNC_SECONDS: ['用量同步間隔（秒）', '辦公室開著時多久讀一次訂閱用量來入帳；0 表示只在用量面板開啟時入帳。']
};
const applies = { live: '立即生效', restart: '重啟 Office 後生效', slack: '重啟 Slack 橋接器後生效' };

function el(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountSettingsPage(root) {
  let fields = [], drafts = {}, status = { text: '', tone: '' }, loading = false, saving = false;

  async function load() {
    loading = true; render();
    try {
      const response = await fetch('/api/settings', { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法讀取設定。');
      fields = data.fields; drafts = Object.fromEntries(fields.map(field => [field.key, field.saved]));
      status = { text: '', tone: '' };
    } catch (error) {
      status = { text: error.message || '無法讀取設定。', tone: 'bad' };
    }
    loading = false; render();
  }

  async function save() {
    const values = Object.fromEntries(fields.filter(field => (drafts[field.key] ?? '') !== field.saved).map(field => [field.key, drafts[field.key] ?? '']));
    if (!Object.keys(values).length) { status = { text: '沒有需要儲存的變更。', tone: '' }; render(); return; }
    saving = true; render();
    try {
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法儲存設定。');
      fields = data.fields; drafts = Object.fromEntries(fields.map(field => [field.key, field.saved]));
      const slackOnly = data.changed.every(key => fields.find(field => field.key === key)?.scope === 'slack');
      status = { text: data.restart ? (slackOnly ? '已儲存。重啟 Slack 橋接器後生效。' : '已儲存。部分設定在重啟 Office 後生效。') : '已儲存，立即生效。', tone: 'ok' };
    } catch (error) {
      status = { text: error.message || '無法儲存設定。', tone: 'bad' };
    }
    saving = false; render();
  }

  function input(field) {
    const id = 'setting-' + field.key;
    const placeholder = field.env ? '.env：' + field.env : field.fallback ? '預設：' + field.fallback : '自動偵測';
    let control;
    if (field.kind === 'choice') {
      control = el('select');
      const auto = el('option', '', field.env ? '.env：' + field.env : '預設'); auto.value = ''; control.append(auto);
      for (const option of field.options) { const node = el('option', '', option); node.value = option; control.append(node); }
      control.value = drafts[field.key] ?? '';
    } else {
      control = el('input');
      control.type = field.kind === 'seconds' ? 'number' : 'text';
      if (field.kind === 'seconds') { control.min = field.min; control.max = field.max; control.step = 1; control.inputMode = 'numeric'; }
      control.placeholder = placeholder;
      control.value = drafts[field.key] ?? '';
      control.spellcheck = false; control.autocomplete = 'off';
    }
    control.id = id;
    control.addEventListener('input', () => { drafts[field.key] = control.value.trim(); renderDirty(); });
    control.addEventListener('change', () => { drafts[field.key] = control.value.trim(); renderDirty(); });
    return control;
  }

  function fieldRow(field) {
    const [title, help] = labels[field.key] || [field.key, ''];
    const row = el('div', 'setting-row');
    const head = el('div', 'setting-head');
    const label = el('label', 'setting-label', title); label.htmlFor = 'setting-' + field.key;
    const tag = el('span', 'setting-apply ' + (field.apply === 'live' ? 'live' : 'restart'), applies[field.scope === 'slack' ? 'slack' : field.apply]);
    head.append(label, tag);
    const line = el('div', 'setting-control');
    line.append(input(field));
    if (field.saved) {
      const reset = el('button', 'setting-reset', '還原'); reset.type = 'button';
      reset.title = '移除這個設定，改用 .env 或預設值';
      reset.onclick = () => { drafts[field.key] = ''; render(); };
      line.append(reset);
    }
    const meta = el('p', 'setting-help', help);
    const key = el('code', 'setting-key', field.key); key.dataset.i18nSkip = '';
    meta.append(' ', key);
    if (field.exists === false) meta.append(el('span', 'setting-warn', ' · 找不到目前的路徑'));
    row.append(head, line, meta);
    return row;
  }

  let saveButton, statusNode;
  function renderDirty() {
    if (!saveButton) return;
    const dirty = fields.some(field => (drafts[field.key] ?? '') !== field.saved);
    saveButton.disabled = saving || !dirty;
    saveButton.textContent = saving ? '儲存中…' : '儲存設定';
  }

  function render() {
    const head = el('div', 'settings-head');
    const title = el('div');
    title.append(el('h2', '', '設定'), el('p', '', '設定只存在這台電腦（STATE_DIR 的 office-settings.json），會優先於 .env。留空即沿用 .env 或預設值。'));
    const actions = el('div', 'settings-actions');
    statusNode = el('span', 'settings-status ' + status.tone, status.text);
    statusNode.setAttribute('role', 'status');
    saveButton = el('button', 'settings-save', '儲存設定'); saveButton.type = 'button';
    saveButton.onclick = save;
    actions.append(statusNode, saveButton);
    head.append(title, actions);
    const grid = el('div', 'settings-grid');
    if (loading && !fields.length) grid.append(el('p', 'settings-empty', '正在讀取設定…'));
    for (const group of groups) {
      const items = fields.filter(field => field.group === group.id);
      if (!items.length) continue;
      const card = el('section', 'panel settings-card');
      card.dataset.group = group.id;
      const cardHead = el('header', 'settings-card-head');
      cardHead.append(el('span', 'settings-dot'), el('h3', '', group.title));
      card.append(cardHead, el('p', 'settings-blurb', group.blurb), ...items.map(fieldRow));
      grid.append(card);
    }
    root.replaceChildren(head, grid);
    renderDirty();
  }

  return { open: load, render };
}
