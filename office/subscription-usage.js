const providers = ['claude', 'codex'];
const time = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const percent = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 });

export function mountSubscriptionUsage(el) {
  const trigger = document.getElementById('usage-trigger');
  const panel = document.getElementById('subscription-usage');
  const refresh = document.getElementById('usage-refresh');
  const snapshots = new Map();
  let timer, pending;

  function position() {
    if (!panel.matches(':popover-open')) return;
    const rect = trigger.getBoundingClientRect();
    const above = rect.top >= window.innerHeight - rect.bottom;
    panel.style.setProperty('--usage-end', `${Math.max(12, window.innerWidth - rect.right)}px`);
    panel.style.setProperty('--usage-offset', `${(above ? window.innerHeight - rect.top : rect.bottom) + 7}px`);
    panel.style.setProperty('--usage-space', `${Math.max(60, (above ? rect.top : window.innerHeight - rect.bottom) - 19)}px`);
    panel.dataset.side = above ? 'above' : 'below';
  }

  function render(provider, snapshot) {
    const group = document.getElementById('usage-' + provider);
    const plan = document.getElementById('usage-plan-' + provider);
    plan.textContent = snapshot.plan ? '· ' + snapshot.plan.replace(/(^|[ _-])\p{L}/gu, value => value.toUpperCase()) : '';
    if (snapshot.status === 'ready' && snapshot.windows.length) {
      const rows = snapshot.windows.map(({ label, used, resetsAt }) => {
        const row = el('div', 'usage-window');
        const amount = percent.format(used) + '%';
        const meta = el('div', 'usage-window-meta');
        const date = resetsAt == null ? null : new Date(resetsAt);
        if (date && Number.isFinite(+date)) meta.append(el('span', 'usage-reset', time.format(date) + ' 重置'));
        meta.append(el('strong', '', amount));
        const info = el('div', 'usage-window-label');
        info.append(el('span', '', label), meta);
        const bar = el('progress', 'usage-bar');
        bar.max = 100;
        bar.value = Math.min(100, used);
        bar.setAttribute('aria-label', label + '已使用');
        bar.setAttribute('aria-valuetext', amount);
        row.append(info, bar);
        return row;
      });
      group.replaceChildren(...rows);
    } else {
      const message = snapshot.status === 'login'
        ? (provider === 'codex' ? '請先在本機 Codex CLI 登入 ChatGPT。' : '請先在本機 Claude Code 登入。')
        : '暫時無法讀取用量。';
      group.replaceChildren(el('p', 'usage-status', message));
    }
    const values = [...snapshots.values()].flatMap(value => value.windows || []).map(({ used }) => used);
    const highest = values.length ? Math.max(...values) : null;
    trigger.style.setProperty('--usage-fill', `${Math.min(100, highest ?? 0)}%`);
    trigger.dataset.threshold = highest >= 90 ? 'near-limit' : '';
    trigger.title = highest == null ? '訂閱用量' : '訂閱用量 · 最高已使用 ' + percent.format(highest) + '%';
  }

  function load(force = false) {
    if (pending) return pending;
    refresh.disabled = true;
    pending = Promise.all(providers.map(async provider => {
      if (!snapshots.has(provider)) document.getElementById('usage-' + provider).textContent = '正在讀取用量…';
      const snapshot = await fetch('/api/usage/' + provider + (force ? '?refresh=1' : ''), { signal: AbortSignal.timeout(22000) })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .catch(() => ({ status: 'unavailable', windows: [] }));
      const previous = snapshots.get(provider);
      snapshots.set(provider, snapshot);
      if (!snapshot.checkedAt || snapshot.checkedAt !== previous?.checkedAt) render(provider, snapshot);
    })).finally(() => { pending = null; refresh.disabled = false; });
    return pending;
  }

  panel.addEventListener('beforetoggle', event => {
    if (event.newState === 'open') requestAnimationFrame(position);
  });
  panel.addEventListener('toggle', event => {
    clearInterval(timer);
    if (event.newState !== 'open') return;
    position();
    load();
    timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
  });
  refresh.addEventListener('click', () => load(true));
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { capture: true, passive: true });
  return { close() { if (panel.matches(':popover-open')) panel.hidePopover(); } };
}
