import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { FUNDS_PER_PERCENT, STARTING_FUNDS, consumedSince, emotionOf, settle, strain } from '../office/economy.js';
import { openOfficeEconomy } from '../src/office-economy.mjs';

const reading = (used, resetsAt = 1_000_000) => ({ status: 'ready', windows: [{ label: '5 小時額度', used, resetsAt }] });

test('usage readings earn only the new consumption, including across a window reset', () => {
  assert.equal(consumedSince(null, { label: 'a', used: 30 }).consumed, 0);
  const meter = { label: 'a', used: 30, resetsAt: 1000 };
  assert.equal(consumedSince(meter, { label: 'a', used: 42, resetsAt: 1000 }).consumed, 12);
  assert.equal(consumedSince(meter, { label: 'a', used: 30, resetsAt: 1000 }).consumed, 0);
  assert.equal(consumedSince(meter, { label: 'a', used: 5, resetsAt: 1000 + 5 * 3600000 }).consumed, 5);
  assert.equal(consumedSince(meter, { label: 'b', used: 50 }).consumed, 0);
});

test('the server ledger pays for usage, tires the team that worked and persists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'office-economy-'));
  let clock = Date.parse('2026-11-22T00:00:00Z');
  try {
    const file = join(dir, 'economy.json');
    const economy = openOfficeEconomy({ file, now: () => clock });
    assert.equal(economy.snapshot().funds, STARTING_FUNDS);
    assert.equal(economy.ingest('claude', reading(20)), 0);
    const before = economy.snapshot();
    const earned = economy.ingest('claude', reading(30));
    assert.equal(earned, Math.round(10 * FUNDS_PER_PERCENT * before.income));
    const after = economy.snapshot();
    assert.ok(after.agents['claude-research'].energy < before.agents['claude-research'].energy);
    assert.equal(after.agents['codex-test'].energy, before.agents['codex-test'].energy);
    assert.equal(economy.ingest('codex', { status: 'login', windows: [] }), null);
    const reopened = openOfficeEconomy({ file, now: () => clock });
    assert.equal(reopened.snapshot().funds, after.funds);
    assert.equal(reopened.ingest('claude', reading(30)), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('items, furniture and floors spend funds and enforce their rules', () => {
  let clock = 0;
  const economy = openOfficeEconomy({ now: () => clock });
  assert.throws(() => economy.use({ item: 'tea', target: 'claude' }), /背包/);
  economy.buy({ kind: 'item', id: 'tea' });
  const used = economy.use({ item: 'tea', target: 'claude' });
  assert.equal(used.event.effects.claude.favorite, true);
  assert.equal(used.inventory.tea, undefined);
  assert.throws(() => economy.buy({ kind: 'furniture', id: 'record' }), /2F/);
  const bought = economy.buy({ kind: 'furniture', id: 'bonsai' });
  assert.equal(Object.values(bought.placed)[0], 'bonsai');
  assert.throws(() => economy.place({ furniture: 'bonsai', slot: 'w1' }), /牆面/);
  assert.throws(() => economy.moveTo({ floor: 3 }), /2F/);
  assert.throws(() => economy.moveTo({ floor: 2 }), /資金不足/);
  economy.ingest('codex', reading(0, 1));
  for (let k = 1; k <= 3; k++) economy.ingest('codex', reading(100, k * 1e7));
  assert.ok(economy.snapshot().funds >= 6000);
  assert.equal(economy.moveTo({ floor: 2 }).floor, 2);
  assert.equal(economy.moveTo({ floor: 1 }).floor, 1);
  const before = economy.snapshot().rates.energy;
  assert.deepEqual(economy.buy({ kind: 'perk', id: 'flex' }).perks, ['flex']);
  assert.equal(economy.snapshot().rates.energy, before + 2);
  assert.throws(() => economy.buy({ kind: 'perk', id: 'flex' }), /已經實施/);
  assert.throws(() => economy.buy({ kind: 'perk', id: 'bonus' }), /5F/);
});

test('moods recover over time and emotions follow mood and energy', () => {
  const tired = strain({ codex: { mood: 60, energy: 50 } }, 'codex', 30);
  assert.equal(emotionOf(tired.codex), 'tired');
  const rested = settle(tired, { floor: 1, placed: {} }, 10);
  assert.ok(rested.codex.energy > tired.codex.energy);
  assert.equal(emotionOf({ mood: 90, energy: 90 }), 'elated');
  assert.equal(emotionOf({ mood: 10, energy: 90 }), 'sad');
});
