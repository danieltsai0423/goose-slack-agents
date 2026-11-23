import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBehaviors, errandPhase } from '../office/behavior.js';

const ids = ['claude', 'codex', 'claude-research', 'claude-review', 'codex-build', 'codex-test'];
function seeded(seed = 7) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
const errands = id => [
  { key: 'board', tile: [0, 1], action: 'write' }, { key: 'window', tile: [2, 1], action: 'look' },
  ...ids.filter(other => other !== id).map(other => ({ key: 'seat:' + other, tile: [5, 5], visit: other, action: 'talk' }))
];

test('everyone keeps busy at the same time, and errands respect the walker cap and destinations', () => {
  const behaviors = createBehaviors(seeded());
  const seen = new Map(ids.map(id => [id, new Set()]));
  let concurrent = 0;
  for (let now = 0; now <= 240000; now += 100) {
    const acts = behaviors.step(now, { ids, maxWalkers: 2, errands, measure: () => 2000 });
    const walkers = [...acts.values()].filter(act => act.kind === 'errand');
    assert.ok(walkers.length <= 2, `too many walkers at ${now}`);
    assert.equal(new Set(walkers.map(act => act.dest.key)).size, walkers.length, 'two people headed to the same spot');
    concurrent = Math.max(concurrent, acts.size);
    for (const [id, act] of acts) seen.get(id).add(act.kind === 'errand' ? 'errand' : act.action);
  }
  assert.ok(concurrent >= 4, 'several people should be doing something at once');
  for (const [id, kinds] of seen) {
    assert.ok(kinds.has('errand'), `${id} never left the desk`);
    assert.ok(kinds.size >= 4, `${id} only did ${[...kinds]}`);
  }
});

test('tired people doze, and working people only check on their delegated work', () => {
  const behaviors = createBehaviors(seeded(3));
  const actions = new Set();
  for (let now = 0; now <= 120000; now += 100) {
    const acts = behaviors.step(now, { ids: ['claude', 'codex'], working: new Set(['codex']), tired: new Set(['claude']), errands, measure: () => 1500 });
    if (acts.get('claude')?.kind === 'fidget') actions.add(acts.get('claude').action);
    const codex = acts.get('codex');
    if (codex?.kind === 'errand') assert.ok(codex.work);
    if (codex?.kind === 'fidget') assert.ok(['think', 'sip', 'read', 'idea', 'stretch'].includes(codex.action));
  }
  assert.ok(actions.has('doze'));
});

test('a new task sends someone back from an errand without teleporting', () => {
  const behaviors = createBehaviors(() => 0);
  let act;
  for (let now = 0; !act && now < 60000; now += 100) {
    act = behaviors.step(now, { ids: ['codex'], errands, measure: () => 4000 }).get('codex');
    if (act?.kind !== 'errand') act = null;
  }
  assert.ok(act, 'expected an errand');
  const midway = act.start + 1000;
  assert.equal(errandPhase(act, midway).phase, 'out');
  behaviors.step(midway, { ids: ['codex'], working: new Set(['codex']), errands, measure: () => 4000 });
  const back = errandPhase(act, midway);
  assert.equal(back.phase, 'back');
  assert.equal(back.progress, 0.75); // a quarter of the way out = three quarters of the way back
  assert.equal(act.endsAt, midway + 1000);
  const later = behaviors.step(act.endsAt + 1, { ids: ['codex'], working: new Set(['codex']), errands, measure: () => 4000 });
  assert.notEqual(later.get('codex')?.kind, 'errand');
});

test('disabling life or a scripted scene clears ambient acts', () => {
  const behaviors = createBehaviors(seeded(11));
  for (let now = 0; now <= 20000; now += 100) behaviors.step(now, { ids, errands, measure: () => 1500 });
  assert.equal(behaviors.step(20100, { ids, enabled: false }).size, 0);
  const acts = behaviors.step(30000, { ids, blocked: new Set(ids), errands, measure: () => 1500 });
  assert.equal(acts.size, 0);
});
