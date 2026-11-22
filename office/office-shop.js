import {
  FUNDS_PER_PERCENT, emotions, favorites, floorById, floors, furniture, furnitureById, itemById, itemEffect, items, perks, slots
} from './economy.js';
import { painter } from './pixel-kit.js';
import { drawFurniture, drawItem, drawPerk, drawWallArt, drawWallArtLive } from './furniture.js';
import { paintFloorPreview } from './scene.js';

const money = value => '$' + Math.round(value || 0).toLocaleString('en-US');
const slotNames = { f1: '左前 · 1', f2: '左前 · 2', f3: '左前 · 3', f4: '右前 · 1', f5: '右前 · 2', f6: '右前 · 3', w1: '左牆', w2: '右牆' };
const signed = value => (value > 0 ? '+' : '') + value;
const effectText = entry => [
  entry.mood ? `心情 ${signed(entry.mood)}` : '', entry.energy ? `精力 ${signed(entry.energy)}` : ''
].filter(Boolean).join(' · ');

function sprite(width, height, scale, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.width = width * scale + 'px'; canvas.style.height = height * scale + 'px';
  canvas.className = 'shop-sprite';
  canvas.setAttribute('aria-hidden', 'true');
  draw(painter(canvas));
  return canvas;
}
export const itemIcon = (id, scale = 2) => sprite(12, 12, scale, p => drawItem(p, id, 0, 0));

// Pixel icons for the two stats: a heart for 心情 and a lightning bolt for 精力.
const statArt = {
  mood: { rows: ['.KK.KK.', 'KPPKPPK', 'KPWPPPK', 'KPPPPPK', '.KPPPK.', '..KPK..', '...K...'], colors: { K: '#8a2a44', P: '#ff6f91', W: '#ffd0dc' } },
  energy: { rows: ['...KKK', '..KYYK', '.KYYK.', 'KYYYYK', 'KKYYK.', '.KYK..', '.KK...'], colors: { K: '#7a5200', Y: '#ffd23f' } }
};
const statNames = { mood: '心情', energy: '精力' };
export function statIcon(kind, scale = 2) {
  const art = statArt[kind];
  const icon = sprite(art.rows[0].length, art.rows.length, scale, p => art.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (art.colors[c]) p.box(x, y, 1, 1, art.colors[c]);
  })));
  icon.classList.add('stat-icon', kind);
  icon.removeAttribute('aria-hidden');
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', statNames[kind]);
  icon.title = statNames[kind];
  return icon;
}
// Effect lines as nodes: [heart] +13 · [bolt] +10, with any extra text parts after them.
function statLine(el, entry, { unit = '', extra = [] } = {}) {
  const parts = [];
  for (const kind of ['mood', 'energy']) {
    if (!entry[kind]) continue;
    const part = el('span', 'stat-part ' + kind);
    part.append(statIcon(kind), el('span', '', signed(entry[kind]) + unit));
    parts.push(part);
  }
  for (const text of extra) if (text) parts.push(el('span', 'stat-part', text));
  return parts.flatMap((part, i) => i ? [document.createTextNode(' · '), part] : [part]);
}
const perkIcon = id => sprite(12, 12, 3, p => drawPerk(p, id, 0, 0));
function furnitureIcon(entry) {
  return entry.kind === 'wall'
    ? sprite(24, 30, 2, p => { drawWallArt(p, entry.id, 12, 2); drawWallArtLive(p, entry.id, 12, 2, 1); })
    : sprite(42, 26, 2, p => drawFurniture(p, entry.id, 21, 25));
}

export function mountOfficeShop({ el, getSelected, getStaff, onChange, onReact, onOpen }) {
  const page = document.getElementById('shop-view');
  const body = document.getElementById('shop-body');
  const note = document.getElementById('shop-note');
  const tabs = [...page.querySelectorAll('[data-shop-tab]')];
  const fundsLabel = document.getElementById('wallet-funds');
  const rateLabel = document.getElementById('wallet-rate');
  const toast = document.getElementById('funds-toast');
  const officePreview = document.getElementById('shop-office-preview');
  let economy = null, tab = 'items', target = '', busy = false, lastLedger = null, toastTimer, previewKey = '';
  let furnitureFilter = 'all';
  const previews = new Map();
  const visible = () => !page.hidden;

  function setNote(text, tone = '') { note.textContent = text || ''; note.dataset.tone = tone; note.hidden = !text; }
  const nameOf = id => getStaff().find(person => person.id === id)?.name || id;

  function showEarnings(entries) {
    const earned = entries.filter(entry => entry.kind === 'earn');
    if (!earned.length) return;
    const total = earned.reduce((sum, entry) => sum + entry.amount, 0);
    toast.textContent = `+${money(total)} · ${earned[0].note}`;
    toast.hidden = false;
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5200);
  }

  const holdings = value => value && JSON.stringify([value.funds, value.inventory, value.owned, value.perks, value.placed, value.floor, value.floorsOwned]);
  // Background polls refresh the summary, but only rebuild the cards when something you can act on changed
  // and nothing in the shop has focus, so a poll never swallows a click or closes an open menu.
  function apply(next, { quiet = false } = {}) {
    if (!next) return;
    const changed = holdings(next) !== holdings(economy);
    const first = lastLedger == null;
    const fresh = first ? [] : next.ledger.filter(entry => entry.at > lastLedger);
    lastLedger = next.ledger[0]?.at ?? lastLedger ?? 0;
    economy = next;
    fundsLabel.textContent = money(next.funds);
    rateLabel.textContent = '×' + next.income.toFixed(2);
    rateLabel.title = `每 1% 額度 ${money(FUNDS_PER_PERCENT * next.income)}（樓層、家具與福利 ×${next.rates.income} · 士氣 ×${next.morale}）`;
    document.getElementById('floor-label').textContent = next.floor + 'F';
    document.getElementById('floor-name').textContent = floorById[next.floor]?.name || '';
    if (!first) showEarnings(fresh);
    onChange(next);
    if (!visible()) return;
    if (!quiet || (changed && !page.contains(document.activeElement))) render();
    else renderSummary();
  }

  async function load(sync = false) {
    try {
      const response = await fetch('/api/economy' + (sync ? '?sync=1' : ''), { signal: AbortSignal.timeout(25000) });
      if (response.ok) apply(await response.json(), { quiet: !sync });
    } catch { /* The office keeps working without the economy. */ }
  }

  async function act(action, payload) {
    if (busy) return null;
    busy = true;
    try {
      const response = await fetch('/api/economy/' + action, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setNote(data.error || '操作失敗，請再試一次。', 'error'); return null; }
      apply(data);
      return data;
    } catch { setNote('無法連線到辦公室服務。', 'error'); return null; }
    finally { busy = false; if (visible()) render(); }
  }

  async function give(itemId, person) {
    const item = itemById[itemId];
    const data = await act('use', { item: itemId, target: person });
    if (!data?.event) return;
    const targets = data.event.targets;
    const lead = item.team ? targets[0] : person;
    const effect = data.event.effects[lead];
    const line = (effect?.favorite ? '這是我最喜歡的！' : '') + item.lines[Math.floor(Math.random() * item.lines.length)];
    setNote(item.team ? `${item.name}開始了！全員${effectText(item)}` :
      `${nameOf(person)} 收到${item.name}${effect?.favorite ? '（最愛，效果 ×1.6）' : ''}：${effectText(effect)}`, 'ok');
    onReact(targets, itemId, lead, line);
  }

  function passiveLine(entry, extra = []) {
    const line = el('p', 'shop-effect');
    line.append(...statLine(el, entry, { unit: '/時', extra: [
      entry.decay ? `心情衰退 −${Math.round(entry.decay * 100)}%` : '', entry.income ? `收入 +${Math.round(entry.income * 100)}%` : '', ...extra
    ] }));
    return line;
  }
  function card(className) { return el('article', 'shop-card ' + (className || '')); }
  function button(label, handler, { primary = false, disabled = false } = {}) {
    const node = el('button', 'login-trigger' + (primary ? ' login-primary' : ''), label);
    node.type = 'button'; node.disabled = disabled || busy;
    node.onclick = handler;
    return node;
  }
  function cardHead(icon, name, price) {
    const head = el('div', 'shop-card-head');
    const title = el('div');
    title.append(el('strong', '', name), el('span', 'shop-price', price));
    head.append(icon, title);
    return head;
  }
  function chips(options, value, onPick, label) {
    const group = el('div', 'shop-chips');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    for (const [key, text] of options) {
      const chip = el('button', 'shop-chip' + (key === value ? ' on' : ''), text);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(key === value));
      chip.onclick = () => onPick(key);
      group.append(chip);
    }
    return group;
  }

  // Picks who receives an item: one tile per person with their mood at a glance.
  function staffPicker() {
    const staff = getStaff();
    if (!staff.some(person => person.id === target)) target = getSelected() || staff[0]?.id || '';
    const grid = el('div', 'staff-picker');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '給予對象');
    for (const person of staff) {
      const status = economy.agents[person.id];
      const tile = el('button', 'staff-tile' + (person.id === target ? ' on' : '') + ' ' + person.manager);
      tile.type = 'button';
      tile.setAttribute('aria-pressed', String(person.id === target));
      const head = el('span', 'staff-tile-head');
      head.append(el('strong', '', person.name), el('span', 'meta', person.role));
      tile.append(head, moodMeters(person.id, true), el('span', 'staff-fav', '最愛：' + (itemById[favorites[person.id]]?.name || '—')));
      if (!status) tile.disabled = true;
      tile.onclick = () => { target = person.id; render(); };
      grid.append(tile);
    }
    return grid;
  }

  function renderItems() {
    const grid = el('div', 'shop-grid');
    const solo = items.filter(item => !item.team), team = items.filter(item => item.team);
    const itemCard = item => {
      const owned = economy.inventory[item.id] || 0;
      const node = card(owned ? 'owned' : '');
      const line = el('p', 'shop-effect' + (item.mood < 0 ? ' mixed' : ''));
      if (item.team) line.append(el('span', 'stat-part', '全員'), ' ');
      line.append(...statLine(el, item.team ? item : itemEffect(item, target), { extra: [favorites[target] === item.id && !item.team ? '最愛 ×1.6' : ''] }));
      node.append(cardHead(itemIcon(item.id, 3), item.name, money(item.price)), el('p', 'shop-desc', item.desc), line);
      const actions = el('div', 'shop-actions');
      actions.append(el('span', 'meta', owned ? `持有 ${owned}` : '未持有'));
      actions.append(button('購買', () => act('buy', { kind: 'item', id: item.id }).then(data => data && setNote(`買了${item.name}。`, 'ok')),
        { disabled: economy.funds < item.price }));
      if (owned) actions.append(button(item.team ? '舉辦' : `給 ${nameOf(target)}`, () => give(item.id, target), { primary: true }));
      node.append(actions);
      return node;
    };
    grid.append(...solo.map(itemCard));
    const teamGrid = el('div', 'shop-grid');
    teamGrid.append(...team.map(itemCard));
    return [el('h3', 'shop-section', '給予對象'), staffPicker(), el('h3', 'shop-section', '個人道具'), grid,
      el('h3', 'shop-section', '全員活動'), teamGrid];
  }

  function layoutSummary() {
    const wrap = el('div', 'slot-summary');
    for (const slot of slots) {
      const entry = furnitureById[economy.placed[slot.id]];
      const cell = el('span', 'slot-cell' + (entry ? ' filled' : ''));
      cell.append(el('small', '', slotNames[slot.id]), el('b', '', entry?.name || '空位'));
      wrap.append(cell);
    }
    return wrap;
  }

  function renderFurniture() {
    const unlocked = Math.max(...economy.floorsOwned);
    const grid = el('div', 'shop-grid');
    const matches = entry => furnitureFilter === 'all' || furnitureFilter === entry.kind ||
      (furnitureFilter === 'owned' && economy.owned.includes(entry.id)) ||
      (furnitureFilter === 'available' && !economy.owned.includes(entry.id) && entry.floor <= unlocked);
    const list = furniture.filter(matches).toSorted((a, b) => a.floor - b.floor || a.price - b.price);
    for (const entry of list) {
      const owned = economy.owned.includes(entry.id);
      const locked = entry.floor > unlocked;
      const node = card(locked ? 'locked' : owned ? 'owned' : '');
      node.append(cardHead(furnitureIcon(entry), entry.name, owned ? '已擁有' : money(entry.price)), el('p', 'shop-desc', entry.desc),
        passiveLine(entry, [entry.kind === 'wall' ? '牆面' : '地面', `${entry.floor}F`]));
      const actions = el('div', 'shop-actions');
      if (locked) actions.append(el('span', 'meta', `${entry.floor}F 以上解鎖`));
      else if (!owned) actions.append(button('購買', () => act('buy', { kind: 'furniture', id: entry.id }).then(data => data && setNote(`${entry.name}已送達辦公室。`, 'ok')),
        { primary: true, disabled: economy.funds < entry.price }));
      else {
        const current = Object.entries(economy.placed).find(([, id]) => id === entry.id)?.[0] || '';
        const select = el('select');
        select.setAttribute('aria-label', entry.name + '的擺放位置');
        const stored = el('option', '', '收進倉庫'); stored.value = ''; select.append(stored);
        for (const slot of slots.filter(slot => slot.kind === entry.kind)) {
          const holder = furnitureById[economy.placed[slot.id]];
          const option = el('option', '', slotNames[slot.id] + (holder && holder.id !== entry.id ? `（換下${holder.name}）` : ''));
          option.value = slot.id; option.selected = slot.id === current;
          select.append(option);
        }
        select.onchange = () => act('place', { furniture: entry.id, slot: select.value || null });
        const label = el('label', 'shop-slot', current ? '擺在 ' : '放到 ');
        label.append(select);
        actions.append(label);
      }
      node.append(actions);
      grid.append(node);
    }
    if (!list.length) grid.append(el('p', 'meta', '這個分類目前沒有家具。'));
    return [
      el('p', 'meta shop-intro', '家具擺出來才會生效，會持續影響全員的心情與精力，搬家時一起帶走。地面 6 格、牆面 2 格，閒暇時大家會去使用它們。'),
      layoutSummary(),
      chips([['all', '全部'], ['floor', '地面'], ['wall', '牆面'], ['available', '可購買'], ['owned', '已擁有']], furnitureFilter,
        key => { furnitureFilter = key; render(); }, '家具篩選'),
      grid
    ];
  }

  function renderPerks() {
    const unlocked = Math.max(...economy.floorsOwned);
    const grid = el('div', 'shop-grid');
    for (const perk of perks) {
      const owned = economy.perks?.includes(perk.id);
      const locked = perk.floor > unlocked;
      const node = card(locked ? 'locked' : owned ? 'owned' : '');
      node.append(cardHead(perkIcon(perk.id), perk.name, owned ? '已實施' : money(perk.price)), el('p', 'shop-desc', perk.desc),
        passiveLine(perk));
      const actions = el('div', 'shop-actions');
      if (owned) actions.append(el('span', 'floor-here', '實施中'));
      else if (locked) actions.append(el('span', 'meta', `${perk.floor}F 以上解鎖`));
      else actions.append(button('實施', () => act('buy', { kind: 'perk', id: perk.id }).then(data => data && setNote(`${perk.name}開始實施，大家都很高興。`, 'ok')),
        { primary: true, disabled: economy.funds < perk.price }));
      node.append(actions);
      grid.append(node);
    }
    return [el('p', 'meta shop-intro', '福利制度只需買一次，不佔擺放位置，搬到哪一層都持續有效。'), grid];
  }

  function floorPreview(floor) {
    const key = floor.id + JSON.stringify(economy.placed);
    if (!previews.has(key)) {
      const canvas = document.createElement('canvas');
      paintFloorPreview(canvas, floor.id, economy.placed);
      canvas.className = 'floor-preview';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${floor.id}F ${floor.name}的預覽`);
      previews.set(key, canvas);
    }
    return previews.get(key);
  }

  function renderFloors() {
    const list = el('div', 'floor-list');
    const top = Math.max(...economy.floorsOwned);
    for (const floor of [...floors].reverse()) {
      const owned = economy.floorsOwned.includes(floor.id);
      const current = economy.floor === floor.id;
      const node = card('floor-card-option' + (current ? ' current' : '') + (!owned && floor.id > top + 1 ? ' locked' : ''));
      const info = el('div', 'floor-info');
      const heading = el('div', 'floor-title');
      heading.append(el('span', 'floor-label', floor.id + 'F'), el('strong', '', floor.name), el('em', '', floor.style));
      info.append(heading, el('p', 'shop-desc', floor.blurb), el('p', 'shop-effect', `收入 ×${floor.income} · ${floor.perk}`));
      const actions = el('div', 'shop-actions');
      if (current) actions.append(el('span', 'floor-here', '目前所在樓層'));
      else if (owned) actions.append(button('搬到這層', () => act('floor', { floor: floor.id }).then(data => data && setNote(`搬到 ${floor.id}F ${floor.name}。`, 'ok')), { primary: true }));
      else if (floor.id === top + 1) actions.append(el('span', 'shop-price', money(floor.price)),
        button('承租並搬入', () => act('floor', { floor: floor.id }).then(data => data && setNote(`歡迎來到 ${floor.id}F ${floor.name}！`, 'ok')),
          { primary: true, disabled: economy.funds < floor.price }));
      else actions.append(el('span', 'meta', `先解鎖 ${floor.id - 1}F · ${money(floor.price)}`));
      info.append(actions);
      node.append(floorPreview(floor), info);
      list.append(node);
    }
    return [list];
  }

  function renderLedger() {
    const intro = el('div', 'ledger-intro');
    intro.append(
      el('p', '', `每用掉 1% 訂閱額度（Claude 看 5 小時額度，Codex 看最短的額度視窗）可得 ${money(FUNDS_PER_PERCENT)}，再乘上樓層、家具、福利與士氣倍率。`),
      el('p', 'meta', `目前每 1% = ${money(FUNDS_PER_PERCENT * economy.income)} · 樓層、家具與福利 ×${economy.rates.income} · 士氣 ×${economy.morale}（心情和精力越好，士氣越高，介於 ×0.8 到 ×1.25）。`),
      el('p', 'meta', '工作也會累：每用掉 1% 額度，該組成員精力 −1.2、心情 −0.4。辦公室開著時每 5 分鐘同步一次用量。')
    );
    const totals = el('div', 'ledger-totals');
    totals.append(el('span', '', '累計收入 ' + money(economy.earned)), el('span', '', '累計支出 ' + money(economy.spent)));
    const list = el('ol', 'ledger-list');
    for (const entry of economy.ledger) {
      const row = el('li', entry.amount >= 0 ? 'in' : 'out');
      row.append(el('time', '', new Date(entry.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })),
        el('span', '', entry.note), el('b', '', (entry.amount >= 0 ? '+' : '−') + money(Math.abs(entry.amount))));
      list.append(row);
    }
    const sync = button('立即同步用量', async () => { setNote('正在讀取訂閱用量…'); await load(true); setNote('已同步。', 'ok'); });
    return [intro, totals, sync, list];
  }

  function renderSummary() {
    const floor = floorById[economy.floor];
    const key = economy.floor + JSON.stringify(economy.placed);
    if (key !== previewKey) { previewKey = key; paintFloorPreview(officePreview, economy.floor, economy.placed); }
    officePreview.setAttribute('aria-label', `目前的辦公室：${economy.floor}F ${floor?.name || ''}`);
    const r = economy.rates;
    const stats = [
      ['辦公資金', money(economy.funds), `累計收入 ${money(economy.earned)}`],
      ['每 1% 額度', money(FUNDS_PER_PERCENT * economy.income), `總倍率 ×${economy.income.toFixed(2)}`],
      ['團隊士氣', '×' + economy.morale.toFixed(2), Object.values(economy.agents).filter(a => emotions[a.emotion].tone === 'bad').length + ' 人狀態不佳'],
      [`${economy.floor}F ${floor?.name || ''} · 每小時`, statLine(el, { mood: r.mood }, { unit: '/時' }),
        [...statLine(el, { energy: r.energy }, { unit: '/時' }), r.decay ? ` · 衰退 −${Math.round(r.decay * 100)}%` : '']]
    ];
    document.getElementById('shop-stats').replaceChildren(...stats.map(([label, value, hint]) => {
      const tile = el('div', 'shop-stat');
      const big = el('b'), small = el('span', 'meta');
      big.append(...[value].flat()); small.append(...[hint].flat());
      tile.append(el('small', '', label), big, small);
      return tile;
    }));
  }

  function render() {
    if (!economy) { body.replaceChildren(el('p', 'meta', '正在讀取辦公室資金…')); return; }
    renderSummary();
    for (const node of tabs) {
      const on = node.dataset.shopTab === tab;
      node.classList.toggle('on', on); node.setAttribute('aria-pressed', String(on));
    }
    const views = { items: renderItems, furniture: renderFurniture, perks: renderPerks, floors: renderFloors, ledger: renderLedger };
    const scroll = window.scrollY;
    body.replaceChildren(...views[tab]());
    window.scrollTo({ top: scroll });
  }

  function moodMeters(id, compact = false) {
    const status = economy?.agents[id];
    const wrap = el('div', 'mood-meters' + (compact ? ' compact' : ''));
    if (!status) return wrap;
    const emotion = emotions[status.emotion];
    wrap.append(el('span', 'mood-chip ' + emotion.tone, emotion.label));
    for (const [key, label] of [['mood', '心情'], ['energy', '精力']]) {
      const meter = el('span', 'mood-meter ' + key);
      const bar = el('meter');
      bar.min = 0; bar.max = 100; bar.low = 30; bar.high = 70; bar.optimum = 100; bar.value = status[key];
      bar.setAttribute('aria-label', label);
      meter.append(statIcon(key), bar, el('b', '', String(Math.round(status[key]))));
      wrap.append(meter);
    }
    return wrap;
  }

  function open(nextTab) {
    if (nextTab) tab = nextTab;
    target = getSelected() || target;
    setNote('');
    onOpen();
    render();
    load();
  }

  for (const node of tabs) node.onclick = () => { tab = node.dataset.shopTab; setNote(''); render(); };
  document.getElementById('shop-open').onclick = () => open();
  document.getElementById('wallet').onclick = () => open('ledger');
  load();
  setInterval(() => { if (!document.hidden) load(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });

  return {
    get economy() { return economy; },
    open,
    render() { if (visible()) render(); },
    moodMeters,
    // Quick-give buttons for the member profile.
    giftButtons(id) {
      const wrap = el('div', 'profile-gifts');
      if (!economy) return wrap;
      const owned = items.filter(item => economy.inventory[item.id] && !item.team);
      if (!owned.length) {
        const shop = button('去商店買點東西', () => open('items'));
        shop.classList.add('small-action');
        wrap.append(shop);
        return wrap;
      }
      for (const item of owned) {
        const node = el('button', 'gift-button');
        node.type = 'button';
        node.title = `給 ${nameOf(id)} ${item.name}（${effectText(itemEffect(item, id))}）`;
        node.setAttribute('aria-label', node.title);
        node.append(itemIcon(item.id, 2), el('span', '', '×' + economy.inventory[item.id]));
        if (favorites[id] === item.id) node.classList.add('favorite');
        node.onclick = () => give(item.id, id);
        wrap.append(node);
      }
      return wrap;
    }
  };
}
