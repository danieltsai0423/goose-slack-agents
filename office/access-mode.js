// Permission-mode menu beside the project folder. The mode travels with each
// submission, so a queued task keeps the access it was sent with.
const modes = [
  { id: 'chat', icon: 'chat', label: '僅對話', detail: '不讀寫檔案，也不執行指令' },
  { id: 'workspace', icon: 'folder', label: '工作區', detail: '可在專案資料夾內讀寫檔案與執行指令' },
  { id: 'full', icon: 'shield', label: '完整存取權', detail: '可無限制存取網際網路和您電腦上的任何檔案' }
];
const storageKey = 'goose-office:access-mode';

export function mountAccessMode({ root, iconMarkup }) {
  const trigger = root.querySelector('#access-trigger');
  const label = root.querySelector('#access-label');
  const icon = root.querySelector('#access-icon');
  const menu = root.querySelector('#access-menu');
  let mode = 'chat';
  try { mode = modes.some(item => item.id === localStorage.getItem(storageKey)) ? localStorage.getItem(storageKey) : 'chat'; } catch {}

  const items = modes.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'access-item';
    button.dataset.mode = item.id;
    button.setAttribute('role', 'menuitemradio');
    button.innerHTML = '<span class="access-item-icon" aria-hidden="true">' + iconMarkup(item.icon) +
      '</span><span class="access-text"><b></b><small></small></span><span class="access-check" aria-hidden="true"></span>';
    button.querySelector('b').textContent = item.label;
    button.querySelector('small').textContent = item.detail;
    button.onclick = () => { set(item.id); close(true); };
    return button;
  });
  menu.replaceChildren(...items);

  function render() {
    const current = modes.find(item => item.id === mode);
    label.textContent = current.label;
    icon.innerHTML = iconMarkup(current.icon);
    root.dataset.mode = mode;
    trigger.title = '權限：' + current.label + '，' + current.detail;
    for (const item of items) {
      const on = item.dataset.mode === mode;
      item.setAttribute('aria-checked', String(on));
      item.querySelector('.access-check').innerHTML = on ? iconMarkup('check') : '';
    }
  }
  function set(next) {
    mode = next;
    try { localStorage.setItem(storageKey, mode); } catch {}
    render();
  }
  function open() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    items.find(item => item.dataset.mode === mode)?.focus();
  }
  function close(focus = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  }

  trigger.onclick = () => menu.hidden ? open() : close();
  trigger.onkeydown = event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  };
  menu.onkeydown = event => {
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  };
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });
  render();

  return { value: () => mode };
}
