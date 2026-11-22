import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import {
  FUNDS_PER_PERCENT, STARTING_FUNDS, consumedSince, emotionOf, floorById, floors, furnitureById, incomeMultiplier,
  itemById, itemEffect, moraleMultiplier, perkById, rates, settle, slotById, staffIds, strain
} from '../office/economy.js';

function problem(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
const clamp = value => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

function fresh(now) {
  return {
    version: 1, funds: STARTING_FUNDS, earned: 0, spent: 0, floor: 1, floorsOwned: [1],
    inventory: {}, owned: [], perks: [], placed: {}, meters: {},
    agents: Object.fromEntries(staffIds.map(id => [id, { mood: 64, energy: 78 }])),
    ledger: [{ at: now, kind: 'grant', amount: STARTING_FUNDS, note: '開業資金' }], settledAt: now
  };
}

function load(file, now) {
  if (!file) return fresh(now);
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (data?.version !== 1) return fresh(now);
    const base = fresh(now);
    return {
      ...base, ...data,
      agents: Object.fromEntries(staffIds.map(id => [id, data.agents?.[id] ?? base.agents[id]])),
      owned: Array.isArray(data.owned) ? data.owned.filter(id => furnitureById[id]) : [],
      perks: Array.isArray(data.perks) ? data.perks.filter(id => perkById[id]) : [],
      floorsOwned: Array.isArray(data.floorsOwned) ? data.floorsOwned.filter(id => floorById[id]) : [1]
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('office economy reset:', error.name);
    return fresh(now);
  }
}

export function openOfficeEconomy({ file = null, now = Date.now } = {}) {
  let state = load(file, now());
  function save() {
    if (!file) return;
    const temp = file + '.tmp';
    writeFileSync(temp, JSON.stringify(state));
    renameSync(temp, file);
  }
  function record(kind, amount, note) {
    state.ledger = [{ at: now(), kind, amount, note }, ...state.ledger].slice(0, 40);
  }
  function tick() {
    const at = now();
    const hours = (at - (state.settledAt || at)) / 3600000;
    if (hours > 0) state.agents = settle(state.agents, state, hours);
    state.settledAt = at;
  }
  function spend(price, note) {
    if (state.funds < price) throw problem(409, `資金不足，還差 $${(price - state.funds).toLocaleString('en-US')}。`);
    state.funds -= price;
    state.spent += price;
    record('spend', -price, note);
  }
  function view(event = null) {
    tick();
    return {
      funds: state.funds, earned: state.earned, spent: state.spent, floor: state.floor, floorsOwned: state.floorsOwned,
      inventory: state.inventory, owned: state.owned, perks: state.perks, placed: state.placed, ledger: state.ledger.slice(0, 20),
      agents: Object.fromEntries(staffIds.map(id => [id, { ...state.agents[id], emotion: emotionOf(state.agents[id]) }])),
      morale: moraleMultiplier(state.agents), income: incomeMultiplier(state), rates: rates(state),
      meters: state.meters, event
    };
  }

  return {
    snapshot: () => view(),
    // Feed a usage reading from /api/usage. Only the shortest window earns, so one unit of work is paid once.
    ingest(provider, snapshot) {
      if (!['claude', 'codex'].includes(provider) || snapshot?.status !== 'ready') return null;
      const window = snapshot.windows?.[0];
      tick();
      const { consumed, meter } = consumedSince(state.meters[provider], window);
      if (!meter) return null;
      state.meters[provider] = meter;
      let amount = 0;
      if (consumed > 0) {
        amount = Math.round(consumed * FUNDS_PER_PERCENT * incomeMultiplier(state));
        state.funds += amount;
        state.earned += amount;
        state.agents = strain(state.agents, provider, consumed);
        record('earn', amount, `${provider === 'claude' ? 'Claude' : 'Codex'} 用掉 ${Math.round(consumed * 10) / 10}% 額度`);
      }
      save();
      return amount;
    },
    buy({ kind, id } = {}) {
      tick();
      if (kind === 'item') {
        const item = itemById[id];
        if (!item) throw problem(400, '找不到這個道具。');
        spend(item.price, '購買' + item.name);
        state.inventory[id] = (state.inventory[id] || 0) + 1;
      } else if (kind === 'furniture') {
        const entry = furnitureById[id];
        if (!entry) throw problem(400, '找不到這件家具。');
        if (state.owned.includes(id)) throw problem(409, '已經擁有這件家具。');
        if (Math.max(...state.floorsOwned) < entry.floor) throw problem(409, `需要先解鎖 ${entry.floor}F。`);
        spend(entry.price, '購買' + entry.name);
        state.owned.push(id);
        const free = Object.keys(slotById).find(slot => slotById[slot].kind === entry.kind && !state.placed[slot]);
        if (free) state.placed[free] = id;
      } else if (kind === 'perk') {
        const perk = perkById[id];
        if (!perk) throw problem(400, '找不到這項福利。');
        if (state.perks.includes(id)) throw problem(409, '已經實施這項福利。');
        if (Math.max(...state.floorsOwned) < perk.floor) throw problem(409, `需要先解鎖 ${perk.floor}F。`);
        spend(perk.price, '實施' + perk.name);
        state.perks.push(id);
      } else throw problem(400, '請選擇道具、家具或福利。');
      save();
      return view({ type: 'buy', kind, id });
    },
    use({ item: id, target } = {}) {
      tick();
      const item = itemById[id];
      if (!item) throw problem(400, '找不到這個道具。');
      if (!(state.inventory[id] > 0)) throw problem(409, '背包裡沒有這個道具。');
      const targets = item.team ? staffIds : [target];
      if (!item.team && !staffIds.includes(target)) throw problem(400, '請選擇要給予的成員。');
      const effects = {};
      for (const person of targets) {
        const effect = itemEffect(item, person);
        const current = state.agents[person];
        state.agents[person] = { mood: clamp(current.mood + effect.mood), energy: clamp(current.energy + effect.energy) };
        effects[person] = effect;
      }
      state.inventory[id] -= 1;
      if (!state.inventory[id]) delete state.inventory[id];
      save();
      return view({ type: 'use', item: id, targets, effects });
    },
    place({ furniture: id, slot } = {}) {
      tick();
      if (id && !state.owned.includes(id)) throw problem(409, '尚未擁有這件家具。');
      for (const [key, value] of Object.entries(state.placed)) if (value === id) delete state.placed[key];
      if (slot) {
        const target = slotById[slot];
        if (!target) throw problem(400, '找不到這個位置。');
        if (id && furnitureById[id].kind !== target.kind) throw problem(400, target.kind === 'wall' ? '這是牆面位置。' : '這是地面位置。');
        if (id) state.placed[slot] = id; else delete state.placed[slot];
      }
      save();
      return view({ type: 'place', id, slot });
    },
    moveTo({ floor } = {}) {
      tick();
      const target = floorById[floor];
      if (!target) throw problem(400, '找不到這個樓層。');
      if (!state.floorsOwned.includes(floor)) {
        const next = Math.max(...state.floorsOwned) + 1;
        if (floor !== next) throw problem(409, `請先解鎖 ${next}F。`);
        spend(target.price, `承租 ${floor}F ${target.name}`);
        state.floorsOwned.push(floor);
      }
      state.floor = floor;
      save();
      return view({ type: 'floor', floor });
    },
    floors
  };
}
