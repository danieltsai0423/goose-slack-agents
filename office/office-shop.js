import {
  FUNDS_PER_PERCENT, emotions, favorites, firstFloorFor, fits, floorById, floors, furniture, furnitureById, itemById, itemEffect, items, perks, slotsFor
} from './economy.js';
import { painter } from './pixel-kit.js';
import { drawFurniture, drawItem, drawPerk, drawWallArt, drawWallArtLive, whenItemArt } from './furniture.js';
import { paintFloorPreview, variants } from './scene.js';
import { drawAnimeCharacter } from './anime-people.js';
import { furnitureSprite, models as voxelModels } from './voxel-furniture.js';
import { DIRECTIONS } from './stack.js';

const money = value => '$' + Math.round(value || 0).toLocaleString('en-US');
const slotName = id => ({ f: '地面', g: '大型', w: '牆面' })[id[0]] + ' · ' + id.slice(1);
const playersText = { 2: '雙人', 3: '三人' };
const capacityText = floor => { const c = floor.capacity; return `地面 ${c.small} · 大型 ${c.large} · 牆面 ${c.wall}`; };
const signed = value => (value > 0 ? '+' : '') + value;
const effectText = entry => [
  entry.mood ? `心情 ${signed(entry.mood)}` : '', entry.energy ? `精力 ${signed(entry.energy)}` : ''
].filter(Boolean).join(' · ');
const teamOf = id => id === 'codex' || id?.startsWith('codex-') ? 'codex' : 'claude';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function sprite(width, height, scale, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.width = width * scale + 'px'; canvas.style.height = height * scale + 'px';
  canvas.className = 'shop-sprite';
  canvas.setAttribute('aria-hidden', 'true');
  draw(painter(canvas));
  return canvas;
}
const paintRows = (rows, colors) => p => rows.forEach((row, y) => [...row].forEach((c, x) => {
  if (colors[c]) p.box(x, y, 1, 1, colors[c]);
}));
// 16 × 16 so atlas sprites fit; redrawn once the sprite image arrives.
export const itemIcon = (id, scale = 2) => {
  const canvas = sprite(16, 16, scale, p => drawItem(p, id, 2, 2));
  whenItemArt(id, () => { const p = painter(canvas); p.ctx.clearRect(0, 0, 16, 16); drawItem(p, id, 2, 2); });
  return canvas;
};

// Pixel icons for the two stats: a heart for 心情 and a lightning bolt for 精力.
const statArt = {
  mood: { rows: ['.KK.KK.', 'KPPKPPK', 'KPWPPPK', 'KPPPPPK', '.KPPPK.', '..KPK..', '...K...'], colors: { K: '#8a2a44', P: '#ff6f91', W: '#ffd0dc' } },
  energy: { rows: ['...KKK', '..KYYK', '.KYYK.', 'KYYYYK', 'KKYYK.', '.KYK..', '.KK...'], colors: { K: '#7a5200', Y: '#ffd23f' } }
};
const statNames = { mood: '心情', energy: '精力' };
export function statIcon(kind, scale = 2) {
  const art = statArt[kind];
  const icon = sprite(art.rows[0].length, art.rows.length, scale, paintRows(art.rows, art.colors));
  icon.classList.add('stat-icon', kind);
  icon.removeAttribute('aria-hidden');
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', statNames[kind]);
  icon.title = statNames[kind];
  return icon;
}

// 9×9 pixel badges for the shop tabs and the summary HUD.
const badgeArt = {
  items: { rows: ['..R...R..', '.RWR.RWR.', '..RRRRR..', 'KKKKRKKKK', 'KGGgRGGgK', 'KGGgRGGgK', 'KGGgRGGgK', 'KgggRgggK', 'KKKKKKKKK'],
    colors: { K: '#26363a', G: '#8fd18a', g: '#5fa067', R: '#ff6f91', W: '#ffd0dc' } },
  furniture: { rows: ['.KKKKKKK.', 'KBBBBBBBK', 'KBWBBBBBK', 'KBBBBBBBK', 'KKKKKKKKK', 'KBBBBBBBK', 'KbbbbbbbK', 'KKKKKKKKK', '.K.....K.'],
    colors: { K: '#1f2c40', B: '#91b8ef', b: '#5e86c0', W: '#d6e6ff' } },
  perks: { rows: ['.RR...BB.', '..RR.BB..', '...RBB...', '...KKK...', '..KYYYK..', '.KYWYYyK.', '.KYYYYyK.', '..KyyyK..', '...KKK...'],
    colors: { K: '#6b4400', Y: '#ffd23f', y: '#e0a526', W: '#fff4c2', R: '#ff6f91', B: '#6fb6ff' } },
  floors: { rows: ['..KKKKK..', '..KGGGK..', '.KKKKKKK.', '.KSWSWSK.', '.KSSSSSK.', '.KSWSWSK.', '.KSSSSSK.', '.KSWDWSK.', 'KKKKDKKKK'],
    colors: { K: '#1d2a30', S: '#7e95a0', W: '#ffe08a', G: '#c6ed8c', D: '#a8743a' } },
  ledger: { rows: ['..KKKKK..', '.KYYYYYK.', 'KYWYKYyyK', 'KYWKKKyyK', 'KYYYKYyyK', 'KYYKKKyyK', 'KYYYKYyyK', '.KyyyyyK.', '..KKKKK..'],
    colors: { K: '#6b4400', Y: '#ffd23f', y: '#e0a526', W: '#fff4c2' } },
  rate: { rows: ['....K....', '...KGK...', '..KGGGK..', '.KGGWGGK.', 'KKKGGGKKK', '...KGK...', '...KGK...', '...KGK...', '...KKK...'],
    colors: { K: '#2b4a1c', G: '#9be26b', W: '#e8ffd0' } },
  morale: { rows: ['...KKK...', '..KYYYK..', '.KYYYYYK.', 'KYKYYYKYK', 'KYYYYYYYK', 'KYKYYYKYK', '.KYKKKYK.', '..KYYYK..', '...KKK...'],
    colors: { K: '#6b4400', Y: '#ffd23f' } },
  clock: { rows: ['..KKKKK..', '.KWWWWWK.', 'KWWWKWWWK', 'KWWWKWWWK', 'KWWWKKKWK', 'KWWWWWWWK', 'KWWWWWWWK', '.KWWWWWK.', '..KKKKK..'],
    colors: { K: '#26363a', W: '#d6f0ff' } },
  lock: { rows: ['..KKKKK..', '.KK...KK.', '.K.....K.', 'KKKKKKKKK', 'KYYYYYYYK', 'KYYYKYYYK', 'KYYYKYYYK', 'KYYYYYYYK', 'KKKKKKKKK'],
    colors: { K: '#1d2226', Y: '#c9a24a' } }
};
const badge = (name, scale = 2) => {
  const art = badgeArt[name];
  const icon = sprite(9, 9, scale, paintRows(art.rows, art.colors));
  icon.classList.add('pixel-badge');
  return icon;
};

// A 9×9 pixel face per emotion, tinted so it never reads as a team colour swatch.
const faceTint = { elated: '#ff9cb7', happy: '#ffd23f', calm: '#9ed4a6', grumpy: '#f0a060', tired: '#a9bde0', sad: '#8f9fd0' };
const faceRows = {
  elated: ['KFKFFFKFK', 'KPFFFFFPK', 'KFKFFFKFK', 'KFFKKKFFK'],
  happy: ['KFKFFFKFK', 'KFFFFFFFK', 'KFKFFFKFK', 'KFFKKKFFK'],
  calm: ['KFKFFFKFK', 'KFFFFFFFK', 'KFFFFFFFK', 'KFFKKKFFK'],
  grumpy: ['KFKFFFKFK', 'KFFFFFFFK', 'KFFKKKFFK', 'KFKFFFKFK'],
  tired: ['KKKFFFKKK', 'KFFFFFFFK', 'KFFFFFFFK', 'KFFKKKFFK'],
  sad: ['KFKFFFKFK', 'KTFFFFFFK', 'KFFKKKFFK', 'KFKFFFKFK']
};
export function moodFace(emotion, scale = 2) {
  const rows = ['..KKKKK..', '.KFFFFFK.', 'KFFFFFFFK', ...(faceRows[emotion] || faceRows.calm), '.KFFFFFK.', '..KKKKK..'];
  return sprite(9, 9, scale, paintRows(rows, { K: '#2a2422', F: faceTint[emotion] || faceTint.calm, P: '#ff6f91', T: '#5fb0ff' }));
}
const perkIcon = id => sprite(12, 12, 3, p => drawPerk(p, id, 0, 0));
function furnitureIcon(entry, scale = 2) {
  if (entry.kind === 'wall') return sprite(24, 30, scale, p => { drawWallArt(p, entry.id, 12, 2); drawWallArtLive(p, entry.id, 12, 2, 1); });
  if (voxelModels[entry.id] && scale >= 2) return turntable(entry.id);
  return sprite(42, 26, scale, p => drawFurniture(p, entry.id, 21, 25));
}
// Sprite-stacked furniture slowly turning on the shop card, like a product turntable.
const turning = new Set();
let turnTimer = null;
function turntable(id) {
  // Crop to the highest point the model reaches at any angle, then zoom by a whole number so pixels stay square.
  let first = null, top = Infinity;
  for (let dir = 0; dir < DIRECTIONS; dir += 4) {
    const sprite = furnitureSprite(id, dir / DIRECTIONS * Math.PI * 2);
    first ??= sprite;
    top = Math.min(top, sprite.ay + sprite.top);
  }
  const crop = Math.max(0, top - 2);
  const canvas = document.createElement('canvas');
  canvas.width = first.canvas.width; canvas.height = first.canvas.height - crop;
  canvas.className = 'shop-sprite turntable';
  canvas.setAttribute('aria-hidden', 'true');
  const zoom = Math.max(2, Math.min(5, Math.floor(Math.min(120 / canvas.width, 74 / canvas.height))));
  canvas.style.width = canvas.width * zoom + 'px';
  canvas.style.height = canvas.height * zoom + 'px';
  canvas.dataset.model = id;
  canvas.dataset.crop = String(crop);
  canvas.dataset.offset = String(Math.floor(Math.random() * DIRECTIONS));
  paintTurn(canvas);
  turning.add(canvas);
  turnTimer ??= setInterval(() => {

    for (const node of turning) {
      if (!node.isConnected) { turning.delete(node); continue; }
      // Turn only while the card is hovered or focused, so nothing keeps moving on its own.
      const card = node.closest('.shop-card') || node.parentElement;
      if (node.offsetParent && card?.matches(':hover, :focus-within') && !matchMedia('(prefers-reduced-motion: reduce)').matches) { node.dataset.turn = String(Number(node.dataset.turn || 0) + 1); paintTurn(node); }
    }
    if (!turning.size) { clearInterval(turnTimer); turnTimer = null; }
  }, 140);
  return canvas;
}
function paintTurn(canvas) {
  const dir = (Number(canvas.dataset.turn || 0) + Number(canvas.dataset.offset)) % DIRECTIONS;
  const sprite = furnitureSprite(canvas.dataset.model, dir / DIRECTIONS * Math.PI * 2);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sprite.canvas, 0, -Number(canvas.dataset.crop));
}
function portrait(id, emotion, scale = 2) {
  // The anime chibi the office draws, facing the viewer.
  return sprite(30, 40, scale * 0.8, p => drawAnimeCharacter(p, variants[id] ?? 0, 15, 38, {
    facing: 'se', emotion, team: teamOf(id), lead: id === 'claude' || id === 'codex'
  }));
}

// Rarity frames come from where an entry sits in its own price list, so every catalog gets the full range.
const tiers = [['common', '普通'], ['rare', '精良'], ['epic', '稀有'], ['legendary', '傳說']];
const tierMaps = new Map();
function tierOf(list, entry) {
  if (!tierMaps.has(list)) {
    const sorted = list.toSorted((a, b) => a.price - b.price);
    tierMaps.set(list, new Map(sorted.map((item, index) => {
      const q = index / Math.max(1, sorted.length - 1);
      return [item.id, tiers[q < 0.35 ? 0 : q < 0.65 ? 1 : q < 0.88 ? 2 : 3]];
    })));
  }
  return tierMaps.get(list).get(entry.id);
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
  const plaque = document.getElementById('shop-floor-plaque');
  let economy = null, tab = 'items', target = '', busy = false, lastLedger = null, toastTimer, noteTimer, previewKey = '';
  let furnitureFilter = 'all';
  const previews = new Map();
  const visible = () => !page.hidden;

  for (const node of tabs) {
    if (!node.querySelector('.pixel-badge')) node.prepend(badge(node.dataset.shopTab));
    node.setAttribute('role', 'tab');
  }

  function setNote(text, tone = '') {
    note.textContent = text || ''; note.dataset.tone = tone; note.hidden = !text;
    clearTimeout(noteTimer);
    if (text && tone === 'ok') {
      note.classList.remove('show'); void note.offsetWidth; note.classList.add('show');
      noteTimer = setTimeout(() => { note.hidden = true; }, 6000);
    }
  }
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

  // A short pop on the card or tile that just changed, with the amount floating up from it.
  function celebrate(key, text, tone = 'spend') {
    const node = body.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!node) return;
    node.classList.remove('just-bought'); void node.offsetWidth; node.classList.add('just-bought');
    if (reducedMotion()) return;
    const float = el('span', 'float-text ' + tone, text);
    float.setAttribute('aria-hidden', 'true');
    node.append(float);
    setTimeout(() => float.remove(), 1300);
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
  async function buy(kind, entry, message) {
    const data = await act('buy', { kind, id: entry.id });
    if (!data) return;
    setNote(message, 'ok');
    celebrate(kind + ':' + entry.id, '−' + money(entry.price));
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
    const gain = effect ? [effect.mood ? '♥' + signed(effect.mood) : '', effect.energy ? '⚡' + signed(effect.energy) : ''].filter(Boolean).join(' ') : '';
    for (const id of item.team ? targets : [person]) celebrate('staff:' + id, gain || '♥', 'gain');
    onReact(targets, itemId, lead, line);
  }

  /* Building blocks */
  function button(label, handler, { tone = '', disabled = false } = {}) {
    const node = el('button', 'game-btn' + (tone ? ' ' + tone : ''), label);
    node.type = 'button'; node.disabled = disabled || busy;
    node.onclick = handler;
    return node;
  }
  function priceTag(price, { free = '', afford = true } = {}) {
    const tag = el('span', 'price-tag' + (free ? ' done' : afford ? '' : ' short'));
    if (free) { tag.textContent = free; return tag; }
    tag.append(el('i', 'coin'), el('b', '', money(price)));
    if (!afford) tag.title = `還差 ${money(price - economy.funds)}`;
    return tag;
  }
  function sectionHead(title, sub = '') {
    const head = el('h3', 'shop-section');
    head.append(el('span', '', title));
    if (sub) head.append(el('small', '', sub));
    return head;
  }
  function effectLine(entry, { unit = '', extra = [], prefix = '', mixed = false } = {}) {
    const line = el('p', 'shop-effect' + (mixed ? ' mixed' : ''));
    if (prefix) line.append(el('span', 'stat-part tag', prefix));
    for (const kind of ['mood', 'energy']) {
      if (!entry[kind]) continue;
      const part = el('span', 'stat-part ' + kind + (entry[kind] < 0 ? ' down' : ''));
      part.append(statIcon(kind), el('span', '', signed(entry[kind]) + unit));
      line.append(part);
    }
    for (const text of extra) if (text) line.append(el('span', 'stat-part tag', text));
    return line;
  }
  const passiveExtras = entry => [
    entry.decay ? `衰退 −${Math.round(entry.decay * 100)}%` : '', entry.income ? `收入 +${Math.round(entry.income * 100)}%` : ''
  ];
  // One card shape for every catalog: framed art on top, then name, blurb, effects and the action row.
  function shopCard({ key, list, entry, icon, art = '', state = '', corner = null, effect, foot }) {
    const [tierKey, tierLabel] = tierOf(list, entry);
    const node = el('article', `shop-card tier-${tierKey}${state ? ' ' + state : ''}`);
    node.dataset.key = key;
    const frame = el('div', 'card-art' + (art ? ' ' + art : ''));
    frame.append(icon, el('span', 'tier-tag', tierLabel));
    if (corner) frame.append(corner);
    if (state === 'locked') {
      const veil = el('span', 'lock-veil');
      veil.append(badge('lock', 3), el('b', '', `${entry.floor}F 解鎖`));
      frame.append(veil);
    }
    const text = el('div', 'card-text');
    text.append(el('strong', 'card-name', entry.name), el('p', 'shop-desc', entry.desc), effect);
    node.append(frame, text, foot);
    return node;
  }
  function chips(options, value, onPick, label) {
    const group = el('div', 'shop-chips');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    for (const [key, text, count] of options) {
      const chip = el('button', 'shop-chip' + (key === value ? ' on' : ''), text);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(key === value));
      if (count != null) chip.append(el('span', 'chip-count', String(count)));
      chip.onclick = () => onPick(key);
      group.append(chip);
    }
    return group;
  }

  /* 道具 */
  // Picks who receives an item: a party roster with each member's portrait and mood at a glance.
  function pickTarget(staff = getStaff()) {
    if (!staff.some(person => person.id === target)) target = getSelected() || staff[0]?.id || '';
  }
  function staffPicker() {
    const staff = getStaff();
    pickTarget(staff);
    const grid = el('div', 'staff-picker');
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', '給予對象');
    for (const person of staff) {
      const status = economy.agents[person.id];
      const team = person.manager || teamOf(person.id);
      const tile = el('button', 'staff-tile ' + team + (person.id === target ? ' on' : ''));
      tile.type = 'button';
      tile.dataset.key = 'staff:' + person.id;
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-checked', String(person.id === target));
      const frame = el('span', 'staff-portrait');
      frame.append(portrait(person.id, status?.emotion || 'calm'));
      const info = el('span', 'staff-info');
      const head = el('span', 'staff-tile-head');
      head.append(el('strong', '', person.name), el('span', 'meta', person.role));
      const fav = el('span', 'staff-fav');
      const favItem = itemById[favorites[person.id]];
      if (favItem) fav.append(itemIcon(favItem.id, 1), el('span', '', favItem.name));
      else fav.textContent = '沒有最愛';
      info.append(head, moodMeters(person.id, true), fav);
      tile.append(frame, info);
      if (!status) tile.disabled = true;
      tile.onclick = () => { target = person.id; render(); };
      grid.append(tile);
    }
    return grid;
  }

  function renderItems() {
    pickTarget();
    const solo = items.filter(item => !item.team), team = items.filter(item => item.team);
    const itemCard = item => {
      const owned = economy.inventory[item.id] || 0;
      const favorite = !item.team && favorites[target] === item.id;
      const afford = economy.funds >= item.price;
      let corner = null;
      if (owned) corner = el('span', 'stock-badge', '×' + owned);
      const effect = effectLine(item.team ? item : itemEffect(item, target), {
        prefix: item.team ? '全員' : '', extra: [favorite ? '★ 最愛 ×1.6' : ''], mixed: item.mood < 0
      });
      const foot = el('div', 'card-foot');
      foot.append(priceTag(item.price, { afford }));
      const actions = el('div', 'card-actions');
      actions.append(button('購買', () => buy('item', item, `買了${item.name}，放進道具欄。`), { tone: owned ? 'ghost' : 'buy', disabled: !afford }));
      if (owned) actions.append(button(item.team ? '舉辦' : `送給 ${nameOf(target)}`, () => give(item.id, target), { tone: 'use' }));
      foot.append(actions);
      const node = shopCard({ key: 'item:' + item.id, list: items, entry: item, icon: itemIcon(item.id, 4),
        state: [owned ? 'owned' : '', favorite ? 'favorite' : ''].filter(Boolean).join(' '), corner, effect, foot });
      if (favorite) node.querySelector('.card-art').append(el('span', 'fav-ribbon', '★ 最愛'));
      return node;
    };
    const grid = el('div', 'shop-grid');
    grid.append(...solo.map(itemCard));
    const teamGrid = el('div', 'shop-grid events');
    teamGrid.append(...team.map(itemCard));
    const stocked = items.reduce((sum, item) => sum + (economy.inventory[item.id] || 0), 0);
    return [
      sectionHead('給予對象', `送給 ${nameOf(target)} · 最愛道具效果 ×1.6`), staffPicker(),
      sectionHead('個人道具', stocked ? `道具欄 ${stocked} 件` : '先買下來，再送給隊友'), grid,
      sectionHead('全員活動', '一次影響整個團隊'), teamGrid
    ];
  }

  /* 家具 */
  const firstLargeFloor = () => floors.find(floor => floor.capacity.large > 0)?.id;
  function layoutSummary() {
    const board = el('div', 'slot-board');
    const here = slotsFor(economy.floor);
    for (const [kind, label, size] of [['wall', '牆面', 1], ['floor', '地面', 1], ['floor', '大型', 2]]) {
      const row = el('div', 'slot-row ' + kind + (size === 2 ? ' large' : ''));
      const spots = here.filter(slot => slot.kind === kind && slot.size === size);
      if (!spots.length && size === 2) {
        row.append(el('span', 'slot-row-label', label), el('span', 'meta', `這層沒有大型空位 · ${firstLargeFloor()}F 起可擺雙人遊戲桌`));
        board.append(row);
        continue;
      }
      row.append(el('span', 'slot-row-label', label));
      const cells = el('div', 'slot-cells');
      for (const slot of spots) {
        const entry = furnitureById[economy.placed[slot.id]];
        const cell = el('span', 'slot-cell' + (entry ? ' filled' : ''));
        const well = el('span', 'slot-well');
        if (entry) well.append(furnitureIcon(entry, 1));
        else well.append(el('span', 'slot-plus', '+'));
        const caption = el('span', 'slot-caption');
        caption.append(el('small', '', slotName(slot.id)), el('b', '', entry?.name || '空位'));
        cell.append(well, caption);
        cells.append(cell);
      }
      row.append(cells);
      board.append(row);
    }
    return board;
  }

  function renderFurniture() {
    const unlocked = Math.max(...economy.floorsOwned);
    const isOwned = entry => economy.owned.includes(entry.id);
    const filters = {
      all: () => true, games: entry => Boolean(entry.players), floor: entry => entry.kind === 'floor', wall: entry => entry.kind === 'wall',
      available: entry => !isOwned(entry) && entry.floor <= unlocked, owned: isOwned
    };
    const here = slotsFor(economy.floor);
    const fitsHere = entry => here.some(slot => fits(entry, slot));
    const list = furniture.filter(filters[furnitureFilter]).toSorted((a, b) => a.floor - b.floor || a.price - b.price);
    const grid = el('div', 'shop-grid');
    for (const entry of list) {
      const owned = isOwned(entry);
      const locked = entry.floor > unlocked;
      const foot = el('div', 'card-foot');
      if (locked) foot.append(priceTag(entry.price, { afford: false }), el('span', 'meta', `${entry.floor}F 以上解鎖`));
      else if (!owned) {
        const afford = economy.funds >= entry.price;
        const roomy = here.some(slot => fits(entry, slot) && !economy.placed[slot.id]);
        foot.append(priceTag(entry.price, { afford }),
          button('購買', () => buy('furniture', entry, roomy ? `${entry.name}已送達辦公室。` : `${entry.name}已送達，這層放不下，先收進倉庫。`), { tone: 'buy', disabled: !afford }));
        if (!fitsHere(entry)) foot.append(el('span', 'meta warn', `這層放不下 · ${firstFloorFor(entry)}F 起有位置`));
        else if (!roomy) foot.append(el('span', 'meta warn', '位置已滿，買了先放倉庫'));
      } else if (!fitsHere(entry)) {
        foot.append(priceTag(0, { free: '倉庫中' }), el('span', 'meta warn', `需要${entry.size === 2 ? '大型空位' : '位置'} · ${firstFloorFor(entry)}F 起`));
      } else {
        const current = Object.entries(economy.placed).find(([, id]) => id === entry.id)?.[0] || '';
        const select = el('select');
        select.setAttribute('aria-label', entry.name + '的擺放位置');
        const stored = el('option', '', '收進倉庫'); stored.value = ''; select.append(stored);
        for (const slot of here.filter(slot => fits(entry, slot))) {
          const holder = furnitureById[economy.placed[slot.id]];
          const option = el('option', '', slotName(slot.id) + (holder && holder.id !== entry.id ? `（換下${holder.name}）` : ''));
          option.value = slot.id; option.selected = slot.id === current;
          select.append(option);
        }
        select.onchange = () => act('place', { furniture: entry.id, slot: select.value || null });
        const label = el('label', 'shop-slot' + (current ? ' placed' : ''), current ? '擺在' : '放到');
        label.append(select);
        foot.append(priceTag(0, { free: current ? '使用中' : '倉庫中' }), label);
      }
      const corner = el('span', 'kind-badge', [entry.kind === 'wall' ? '牆面' : entry.size === 2 ? '大型 2×2' : '地面', playersText[entry.players], entry.floor + 'F'].filter(Boolean).join(' · '));
      grid.append(shopCard({ key: 'furniture:' + entry.id, list: furniture, entry, icon: furnitureIcon(entry, entry.kind === 'wall' ? 3 : 2),
        art: entry.kind, state: locked ? 'locked' : owned ? 'owned' : '', corner,
        effect: effectLine(entry, { unit: '/時', extra: passiveExtras(entry) }), foot }));
    }
    if (!list.length) grid.append(el('p', 'shop-empty', '這個分類目前沒有家具。'));
    const count = key => furniture.filter(filters[key]).length;
    const stored = economy.owned.filter(id => !Object.values(economy.placed).includes(id)).length;
    return [
      sectionHead('目前擺設', `擺出來才會生效 · 這層 ${capacityText(floorById[economy.floor])}` + (stored ? ` · 倉庫 ${stored} 件` : '') + ' · 搬家時自動重新擺放'),
      layoutSummary(),
      sectionHead('家具目錄', '持續影響全員的心情與精力 · 遊樂設施會讓主管與員工相約一起玩'),
      chips([['all', '全部', count('all')], ['games', '遊樂設施', count('games')], ['floor', '地面', count('floor')], ['wall', '牆面', count('wall')],
        ['available', '可購買', count('available')], ['owned', '已擁有', count('owned')]], furnitureFilter,
      key => { furnitureFilter = key; render(); }, '家具篩選'),
      grid
    ];
  }

  /* 福利 */
  function renderPerks() {
    const unlocked = Math.max(...economy.floorsOwned);
    const grid = el('div', 'shop-grid');
    for (const perk of perks) {
      const owned = economy.perks?.includes(perk.id);
      const locked = perk.floor > unlocked;
      const foot = el('div', 'card-foot');
      if (owned) foot.append(priceTag(0, { free: '✓ 實施中' }));
      else if (locked) foot.append(priceTag(perk.price, { afford: false }), el('span', 'meta', `${perk.floor}F 以上解鎖`));
      else {
        const afford = economy.funds >= perk.price;
        foot.append(priceTag(perk.price, { afford }),
          button('實施', () => buy('perk', perk, `${perk.name}開始實施，大家都很高興。`), { tone: 'buy', disabled: !afford }));
      }
      grid.append(shopCard({ key: 'perk:' + perk.id, list: perks, entry: perk, icon: perkIcon(perk.id), art: 'perk',
        state: locked ? 'locked' : owned ? 'owned' : '', effect: effectLine(perk, { unit: '/時', extra: passiveExtras(perk) }), foot }));
    }
    const active = perks.filter(perk => economy.perks?.includes(perk.id)).length;
    return [sectionHead('公司福利', `已實施 ${active} / ${perks.length} · 買一次永久有效，不佔擺放位置`), grid];
  }

  /* 樓層 */
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
      const next = !owned && floor.id === top + 1;
      const state = current ? 'current' : owned ? 'owned' : next ? 'next' : 'locked';
      const node = el('article', 'floor-card-option ' + state);
      node.dataset.key = 'floor:' + floor.id;
      const stop = el('div', 'floor-stop');
      stop.append(el('b', '', floor.id + 'F'), el('span', '', { current: '所在', owned: '已解鎖', next: '可承租', locked: '未開放' }[state]));
      const view = el('div', 'floor-view');
      view.append(floorPreview(floor));
      if (current) view.append(el('span', 'here-pin', '▼ 目前樓層'));
      if (state === 'locked') { const veil = el('span', 'lock-veil'); veil.append(badge('lock', 3)); view.append(veil); }
      const info = el('div', 'floor-info');
      const heading = el('div', 'floor-title');
      heading.append(el('strong', '', floor.name), el('em', '', floor.style));
      const perksLine = el('p', 'shop-effect');
      perksLine.append(el('span', 'stat-part tag income', `收入 ×${floor.income}`), el('span', 'stat-part tag', floor.perk),
        el('span', 'stat-part tag', `${floor.size} 格 · ${capacityText(floor)}`));
      info.append(heading, el('p', 'shop-desc', floor.blurb), perksLine);
      const actions = el('div', 'card-foot');
      if (current) actions.append(priceTag(0, { free: '✓ 進駐中' }));
      else if (owned) actions.append(priceTag(0, { free: '已承租' }),
        button('搬到這層', () => act('floor', { floor: floor.id }).then(data => data && setNote(`搬到 ${floor.id}F ${floor.name}。`, 'ok')), { tone: 'use' }));
      else if (next) {
        const afford = economy.funds >= floor.price;
        actions.append(priceTag(floor.price, { afford }),
          button('承租並搬入', () => act('floor', { floor: floor.id }).then(data => data && setNote(`歡迎來到 ${floor.id}F ${floor.name}！`, 'ok')),
            { tone: 'buy', disabled: !afford }));
      } else actions.append(priceTag(floor.price, { afford: false }), el('span', 'meta', `先解鎖 ${floor.id - 1}F`));
      info.append(actions);
      node.append(stop, view, info);
      list.append(node);
    }
    return [sectionHead('大樓樓層', `已解鎖 ${economy.floorsOwned.length} / ${floors.length} 層 · 越高收入倍率越高`), list];
  }

  /* 收支 */
  function renderLedger() {
    const totals = el('div', 'ledger-totals');
    const total = (label, value, tone) => {
      const tile = el('div', 'ledger-total ' + tone);
      tile.append(el('small', '', label), el('b', '', value));
      return tile;
    };
    totals.append(total('累計收入', '+' + money(economy.earned), 'in'), total('累計支出', '−' + money(economy.spent), 'out'),
      total('每 1% 額度', money(FUNDS_PER_PERCENT * economy.income), 'rate'));
    const rules = el('details', 'ledger-rules');
    rules.append(el('summary', '', '資金怎麼來？'),
      el('p', '', `每用掉 1% 訂閱額度（Claude 看 5 小時額度，Codex 看最短的額度視窗）可得 ${money(FUNDS_PER_PERCENT)}，再乘上樓層、家具、福利與士氣倍率。`),
      el('p', 'meta', `目前樓層、家具與福利 ×${economy.rates.income} · 士氣 ×${economy.morale}（心情和精力越好，士氣越高，介於 ×0.8 到 ×1.25）。`),
      el('p', 'meta', '工作也會累：每用掉 1% 額度，該組成員精力 −1.2、心情 −0.4。辦公室開著時每 5 分鐘同步一次用量。'));
    const toolbar = el('div', 'ledger-toolbar');
    toolbar.append(sectionHead('收支明細', `${economy.ledger.length} 筆`),
      button('立即同步用量', async () => { setNote('正在讀取訂閱用量…'); await load(true); setNote('已同步。', 'ok'); }, { tone: 'ghost' }));
    const list = el('ol', 'ledger-list');
    for (const entry of economy.ledger) {
      const row = el('li', entry.amount >= 0 ? 'in' : 'out');
      row.append(el('time', '', new Date(entry.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })),
        el('span', '', entry.note), el('b', '', (entry.amount >= 0 ? '+' : '−') + money(Math.abs(entry.amount))));
      list.append(row);
    }
    if (!economy.ledger.length) list.append(el('li', 'empty', '還沒有收支紀錄。'));
    return [totals, rules, toolbar, list];
  }

  /* Summary HUD */
  function renderSummary() {
    const floor = floorById[economy.floor];
    const key = economy.floor + JSON.stringify(economy.placed);
    if (key !== previewKey) { previewKey = key; paintFloorPreview(officePreview, economy.floor, economy.placed); }
    officePreview.setAttribute('aria-label', `目前的辦公室：${economy.floor}F ${floor?.name || ''}`);
    plaque.replaceChildren(el('b', '', economy.floor + 'F'), el('span', '', floor?.name || ''));
    const r = economy.rates;
    const unhappy = Object.values(economy.agents).filter(a => emotions[a.emotion].tone === 'bad').length;
    const stats = [
      ['ledger', '辦公資金', money(economy.funds), `累計收入 ${money(economy.earned)}`, 'funds'],
      ['rate', '每 1% 額度', money(FUNDS_PER_PERCENT * economy.income), `總倍率 ×${economy.income.toFixed(2)}`, ''],
      ['morale', '團隊士氣', '×' + economy.morale.toFixed(2), unhappy ? `${unhappy} 人狀態不佳` : '大家狀態不錯', unhappy ? 'warn' : ''],
      ['clock', '每小時回復', r.mood || r.energy ? [...effectLine({ mood: r.mood, energy: r.energy }).childNodes] : '沒有加成',
        r.decay ? `心情衰退 −${Math.round(r.decay * 100)}%` : '樓層、家具與福利加總', 'hourly']
    ];
    document.getElementById('shop-stats').replaceChildren(...stats.map(([icon, label, value, hint, tone]) => {
      const tile = el('div', 'shop-stat' + (tone ? ' ' + tone : ''));
      const big = el('b'), small = el('span', 'meta');
      big.append(...[value].flat()); small.append(hint);
      const head = el('small');
      head.append(badge(icon, 2), label);
      tile.append(head, big, small);
      return tile;
    }));
  }

  function render() {
    if (!economy) { body.replaceChildren(el('p', 'shop-empty', '正在讀取辦公室資金…')); return; }
    renderSummary();
    for (const node of tabs) {
      const on = node.dataset.shopTab === tab;
      node.classList.toggle('on', on); node.setAttribute('aria-selected', String(on));
    }
    const views = { items: renderItems, furniture: renderFurniture, perks: renderPerks, floors: renderFloors, ledger: renderLedger };
    const scroll = window.scrollY;
    body.dataset.tab = tab;
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
        const shop = el('button', 'login-trigger small-action', '去商店買點東西');
        shop.type = 'button';
        shop.onclick = () => open('items');
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
