// Project-folder menu in the compose footer. The server owns the choice so a
// reload, a second tab and the next submission all see the same folder.
export function mountFolderPicker({ root, iconMarkup, onError = () => {} }) {
  const trigger = root.querySelector('#folder-trigger');
  const label = root.querySelector('#folder-label');
  const menu = root.querySelector('#folder-menu');
  const recentList = root.querySelector('#folder-recent');
  const recentHeading = root.querySelector('#folder-recent-heading');
  const noneItem = root.querySelector('#folder-none');
  const browseItem = root.querySelector('#folder-browse');
  let state = null, busy = false;

  async function call(path, body) {
    const res = await fetch(path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Error(typeof data?.error === 'string' ? data.error : '服務回應 HTTP ' + res.status);
    return data;
  }

  function check(item, on) {
    item.setAttribute('aria-checked', String(on));
    item.querySelector('.folder-check').innerHTML = on ? iconMarkup('check') : '';
  }

  function item(text, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'folder-item';
    button.setAttribute('role', 'menuitemradio');
    button.innerHTML = '<span class="folder-name"></span><span class="folder-check" aria-hidden="true"></span>';
    button.querySelector('.folder-name').textContent = text;
    if (title) button.title = title;
    return button;
  }

  function render() {
    const current = state?.current ?? null;
    const entry = state?.recent.find(folder => folder.path === current);
    label.textContent = entry ? entry.name : '不指定資料夾';
    trigger.title = current ? '專案資料夾：' + current
      : '未指定專案資料夾，使用預設目錄' + (state?.defaultDir ? '：' + state.defaultDir : '');
    trigger.classList.toggle('is-set', Boolean(current));
    trigger.disabled = !state;
    check(noneItem, !current);
    recentList.replaceChildren(...(state?.recent ?? []).map(folder => {
      const button = item(folder.name, folder.path + (folder.exists ? '' : '（找不到這個資料夾）'));
      button.dataset.path = folder.path;
      button.disabled = !folder.exists;
      check(button, folder.path === current);
      button.onclick = () => choose(folder.path);
      return button;
    }));
    recentHeading.hidden = !state?.recent.length;
    browseItem.hidden = !state?.canBrowse;
  }

  function items() { return [...menu.querySelectorAll('button:not([disabled]):not([hidden])')]; }
  function open() {
    if (!state) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-checked="true"]:not([disabled])') || items()[0])?.focus();
  }
  function close(focus = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    try {
      const next = await action();
      if (next) state = next;
      render();
    } catch (error) { onError('專案資料夾未更新。' + error.message); }
    finally { busy = false; root.removeAttribute('aria-busy'); }
  }
  function choose(path) { close(true); return run(() => call('/api/folders', { path })); }

  noneItem.onclick = () => choose(null);
  browseItem.onclick = () => {
    close(true);
    label.textContent = '請在對話框選擇…';
    run(() => call('/api/folders/browse', {}));
  };
  trigger.onclick = () => menu.hidden ? open() : close();
  trigger.onkeydown = event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  };
  menu.onkeydown = event => {
    const list = items(), index = list.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      list[(index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      list[event.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  };
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });

  async function refresh() {
    try { state = await call('/api/folders'); } catch { state = null; }
    render();
  }
  refresh();
  window.addEventListener('focus', () => { if (!busy && menu.hidden) refresh(); });

  return {
    /** Path for the next submission: a string, null for the default, or undefined if unknown. */
    value: () => state ? state.current : undefined
  };
}
