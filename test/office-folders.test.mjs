import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openOfficeFolders } from '../src/office-folders.mjs';
import { createOfficeRuntime } from '../src/office-runtime.mjs';
import { runNativeCodex } from '../src/office-codex.mjs';

test('folder choices persist, rank recent first and validate submissions', async () => {
  const root = mkdtempSync(join(tmpdir(), 'goose-folders-'));
  const [alpha, beta] = ['alpha', 'beta'].map(name => { const dir = join(root, name); mkdirSync(dir); return dir; });
  const file = join(root, 'state', 'folders.json');
  let picked = beta;
  const folders = openOfficeFolders({ file, defaultDir: root, pick: async () => picked });
  assert.equal(folders.snapshot().current, null);
  folders.select(alpha);
  assert.equal((await folders.browse()).current, beta);
  assert.deepEqual(folders.snapshot().recent.map(item => item.name), ['beta', 'alpha']);
  picked = null;
  const cancelled = await folders.browse();
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.current, beta);

  assert.throws(() => folders.select('relative/path'), { statusCode: 400 });
  assert.throws(() => folders.select(join(root, 'missing')), { statusCode: 404 });
  assert.equal(folders.forSubmission(undefined), beta);
  assert.equal(folders.forSubmission(null), null);
  assert.equal(folders.forSubmission(alpha), alpha);
  assert.throws(() => folders.forSubmission(root), { statusCode: 400 });

  const reopened = openOfficeFolders({ file, defaultDir: root, pick: null });
  assert.equal(reopened.snapshot().current, beta);
  assert.equal(reopened.snapshot().canBrowse, false);
  rmSync(beta, { recursive: true });
  assert.equal(reopened.snapshot().recent[0].exists, false);
  assert.throws(() => reopened.forSubmission(beta), { statusCode: 409 });
  reopened.select(null);
  assert.equal(openOfficeFolders({ file, defaultDir: root }).snapshot().current, null);
  rmSync(root, { recursive: true, force: true });
});

test('only host-execution turns receive the submitted project folder', async () => {
  const calls = [];
  const runtime = createOfficeRuntime({ file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    return { reply: turn.stage === 'plan' ? '{"route":"self"}' : 'done' };
  } });
  const folder = join(tmpdir(), 'project');
  runtime.submit({ manager: 'claude', text: '執行：列出檔案', workDir: folder });
  runtime.submit({ manager: 'codex', text: '聊聊計畫', workDir: folder });
  assert.throws(() => runtime.submit({ manager: 'claude', text: 'x', workDir: 3 }), { statusCode: 400 });
  for (let i = 0; i < 200 && runtime.snapshot().tasks.some(task => !['done', 'failed'].includes(task.status)); i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  await runtime.close();
  assert.ok(calls.length);
  for (const call of calls) assert.equal(call.workDir, call.execute ? folder : undefined);
  assert.ok(calls.some(call => call.execute));
});

test('the permission mode, not the text prefix, decides tool access for new tasks', async () => {
  const calls = [];
  const runtime = createOfficeRuntime({ file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    return { reply: turn.stage === 'plan' ? '{"route":"self"}' : 'done' };
  } });
  runtime.submit({ manager: 'claude', text: '整理專案', access: 'full', clientId: 'full' });
  runtime.submit({ manager: 'claude', text: '執行：不應有工具', access: 'chat', clientId: 'chat' });
  runtime.submit({ manager: 'codex', text: '執行：舊式交辦', clientId: 'legacy' });
  assert.throws(() => runtime.submit({ manager: 'claude', text: 'x', access: 'root' }), { statusCode: 400 });
  await runtime.idle();
  const work = calls.filter(call => call.stage === 'self');
  const by = text => work.find(call => call.request === text);
  assert.equal(by('整理專案').execute, true);
  assert.equal(by('整理專案').access, 'full');
  assert.equal(by('不應有工具').execute, false);
  assert.equal(by('舊式交辦').access, 'workspace');
  assert.ok(calls.filter(call => call.stage === 'plan').every(call => !call.execute));
  await runtime.close();
});

test('full access lifts the native Codex sandbox', async () => {
  for (const [fullAccess, sandbox] of [[false, 'workspace-write'], [true, 'danger-full-access']]) {
    await runNativeCodex({
      model: 'gpt-6.2-sol', effort: 'max', execute: true, fullAccess, artifactDir: 'out', images: [], input: 'test',
      async invoke(_command, args, _input, feed) {
        assert.equal(args[args.indexOf('--sandbox') + 1], sandbox);
        feed(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'ok' } }) + '\n');
      }
    });
  }
});

test('tool turns get the longer host timeout while chat turns keep the short one', async () => {
  const calls = [];
  const runtime = createOfficeRuntime({ file: ':memory:', timeoutMs: 1000, hostTimeoutMs: 5000, async runAgent(turn) {
    calls.push(turn);
    return { reply: turn.stage === 'plan' ? '{"route":"self"}' : 'done' };
  } });
  runtime.submit({ manager: 'claude', text: 'build it', access: 'workspace' });
  await runtime.idle();
  assert.deepEqual(calls.map(call => [call.stage, call.timeoutMs]), [['plan', 1000], ['self', 5000]]);
  await runtime.close();
});
