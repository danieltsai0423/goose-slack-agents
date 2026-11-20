import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createSlackApps } from '../src/slack-setup.mjs';

function setup(t, reply) {
  const directory = mkdtempSync(join(tmpdir(), 'goose-slack-setup-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const calls = [];
  const output = [];
  return {
    directory, calls, output,
    run: () => createSlackApps({
      token: 'test-token', directory, print: (line) => output.push(line),
      async request(url, options) {
        assert.equal(options.headers.Authorization, 'Bearer test-token');
        const method = url.split('.').at(-1);
        const body = JSON.parse(options.body);
        calls.push({ method, body });
        const data = reply(method, body);
        return { ok: true, status: 200, json: async () => data };
      }
    })
  };
}

test('validates both apps, creates once, and reuses existing app IDs', async (t) => {
  const mock = setup(t, (method, body) => method === 'create' ? {
    ok: true, app_id: JSON.parse(body.manifest).settings.socket_mode_enabled ? 'ACODEX' : 'ACLAUDE',
    credentials: { client_secret: 'should-stay-out-of-output' }
  } : { ok: true });
  await mock.run();
  await mock.run();
  assert.deepEqual(mock.calls.map(({ method }) => method), [
    'validate', 'validate', 'create', 'create', 'export', 'export'
  ]);
  assert.deepEqual(JSON.parse(mock.calls[0].body.manifest).settings.event_subscriptions.bot_events, ['message.groups']);
  assert.equal(readFileSync(join(mock.directory, 'codex.app'), 'utf8').trim(), 'ACODEX');
  assert.equal(readFileSync(join(mock.directory, 'claude.app'), 'utf8').trim(), 'ACLAUDE');
  assert.ok(mock.output.every((line) => /^Goose-(Codex|Claude)  https:\/\/api\.slack\.com\/apps\/A[A-Z]+\/oauth$/.test(line)));
});

test('does not duplicate an app when a create request has an unknown outcome', async (t) => {
  const mock = setup(t, (method) => {
    if (method === 'create') throw new Error('request timed out');
    return { ok: true };
  });
  await assert.rejects(mock.run(), /建立結果未知/);
  await assert.rejects(mock.run(), /前一次建立結果待確認/);
  assert.equal(mock.calls.filter(({ method }) => method === 'create').length, 1);
});
