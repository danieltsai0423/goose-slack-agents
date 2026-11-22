import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createOfficeOnboarding } from '../src/office-onboarding.mjs';

async function expectState(setup, state) {
  for (let i = 0; i < 30 && setup.snapshot().state !== state; i++) await delay(10);
  assert.equal(setup.snapshot().state, state);
}

test('setup starts one flow and retries just the remaining provider', async t => {
  const managers = { claude: true, codex: false };
  const attempts = [];
  const setup = createOfficeOnboarding({
    check: async () => ({ managers: { ...managers } }),
    install: async () => {},
    async authenticate(id, { onAuthorize }) {
      attempts.push(id);
      onAuthorize();
      if (attempts.length === 1) throw new Error('Test authorization cancelled in browser.');
      managers[id] = true;
    }
  });
  t.after(() => setup.close());
  assert.equal(setup.start().state, 'running');
  assert.equal(setup.start().state, 'running');
  await expectState(setup, 'failed');
  assert.equal(setup.snapshot().managers.claude.state, 'ready');
  assert.equal(setup.snapshot().managers.codex.state, 'failed');
  assert.deepEqual(attempts, ['codex']);
  setup.start();
  await expectState(setup, 'done');
  assert.deepEqual(attempts, ['codex', 'codex']);
});

test('cancelling one authorization unlocks retry and does not open the next provider', async t => {
  const entered = Promise.withResolvers();
  const attempts = [];
  const setup = createOfficeOnboarding({
    check: async () => ({ managers: { claude: false, codex: false } }),
    install: async () => {},
    async authenticate(id, { onAuthorize, signal }) {
      attempts.push(id);
      onAuthorize();
      entered.resolve();
      await delay(60000, undefined, { signal });
    }
  });
  t.after(() => setup.close());
  setup.start();
  await entered.promise;
  assert.equal(setup.snapshot().managers.claude.state, 'authorizing');
  assert.equal(setup.cancel().state, 'cancelling');
  await expectState(setup, 'cancelled');
  assert.equal(setup.snapshot().managers.claude.state, 'cancelled');
  assert.deepEqual(attempts, ['claude']);
});
