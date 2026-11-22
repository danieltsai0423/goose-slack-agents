import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createOfficeRuntime } from '../src/office-runtime.mjs';

function office(t, handler, options = {}) {
  const calls = [];
  const runtime = createOfficeRuntime({ ...options, file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    return { reply: await handler(turn) };
  } });
  t.after(() => runtime.close());
  return { runtime, calls };
}

test('a plain Markdown reply uses a single model call and reports a live draft', async (t) => {
  const gate = Promise.withResolvers();
  const started = Promise.withResolvers();
  const {runtime,calls} = office(t, async ({onProgress}) => {
    onProgress({type:'text',text:'**收到**'});
    started.resolve();
    await gate.promise;
    return '**收到**';
  });
  const task = runtime.submit({manager:'claude',text:'報數'});
  await started.promise;
  assert.equal(runtime.snapshot().drafts[0].text,'**收到**');
  assert.equal(runtime.snapshot().activities[0].status,'running');
  gate.resolve();
  await runtime.idle();
  const snapshot = runtime.snapshot();
  assert.equal(calls.length,1);
  assert.equal(snapshot.drafts.length,0);
  assert.equal(snapshot.activities[0].status,'done');
  assert.equal(snapshot.messages.at(-1).text,'**收到**');
  assert.equal(runtime.getTask(task.id).status,'done');
});

test('a manager can delegate a fresh worker turn and review its actual output', async (t) => {
  const started = Promise.withResolvers();
  const finish = Promise.withResolvers();
  const { runtime, calls } = office(t, async ({stage}) => {
    if (stage === 'plan') return '{"route":"delegate","worker":"codex-test","assignment":"驗證邊界值"}';
    if (stage === 'delegate') { started.resolve(); return finish.promise; }
    return '主管審查結果';
  });
  const task = runtime.submit({ manager: 'codex', text: '檢查計算方式' });
  await started.promise;
  const live = runtime.snapshot();
  assert.equal(live.tasks[0].status, 'delegated');
  assert.equal(live.employees.find((e) => e.id === 'codex-test').taskId, task.id);
  finish.resolve('員工測試報告');
  await runtime.idle();
  assert.deepEqual(calls.map(({stage, actor}) => [stage, actor]), [
    ['plan', 'codex'], ['delegate', 'codex-test'], ['review', 'codex']
  ]);
  assert.equal(calls[1].assignment, '驗證邊界值');
  assert.ok(calls.every((turn) => !turn.execute));
  assert.ok(calls[2].messages.some((m) => m.author === 'codex-test' && m.text === '員工測試報告'));
  assert.deepEqual(runtime.snapshot().messages.map((m) => m.author), ['user', 'codex', 'codex-test', 'codex']);
  assert.equal(runtime.getTask(task.id).status, 'done');
  assert.ok(runtime.snapshot().employees.every((e) => e.status === 'idle'));
});

test('dual submit is atomic and idempotent, with one user message and independent manager calls', async (t) => {
  const started = Promise.withResolvers();
  const unblock = Promise.withResolvers();
  let plans = 0;
  const { runtime, calls } = office(t, async ({stage,id}) => {
    if (stage === 'plan') {
      if (++plans === 2) started.resolve();
      await unblock.promise;
      return '{"route":"self"}';
    }
    return id + ' final';
  });
  const body = { managers: ['codex','claude'], text: '各自回答', clientId:'request-1' };
  const first = runtime.submitMany(body);
  assert.deepEqual(runtime.submitMany(body), first);
  assert.throws(() => runtime.submitMany({...body, text:'變更'}), {statusCode:409});
  assert.throws(() => runtime.submitMany({...body, managers:['codex','other']}), {statusCode:400});
  assert.throws(() => runtime.submitMany({...body, clientId:'other', threadId:'missing'}), {statusCode:404});
  await started.promise;
  assert.equal(runtime.snapshot().messages.length, 1);
  assert.equal(runtime.snapshot().messages[0].manager, 'both');
  unblock.resolve();
  await runtime.idle();
  assert.ok(calls.filter((c) => c.stage === 'self').every((c) => c.messages.length === 0));
  assert.equal(runtime.snapshot().tasks.length, 2);
  assert.equal(runtime.snapshot().messages.length, 3);
});

test('same manager serializes queued follow-ups, and the first turn never sees a later request', async (t) => {
  const started = Promise.withResolvers();
  const unblock = Promise.withResolvers();
  const { runtime, calls } = office(t, async ({stage,request}) => {
    if (stage === 'plan' && request === 'first') { started.resolve(); await unblock.promise; }
    if (stage === 'plan') return '{"route":"delegate","worker":"claude-review","assignment":"wrong team"}';
    return 'reply ' + request;
  });
  const first = runtime.submit({manager:'codex', text:'first'});
  await started.promise;
  runtime.submit({manager:'codex', text:'second', threadId:first.threadId});
  unblock.resolve();
  await runtime.idle();
  assert.deepEqual(calls.map(({request,stage}) => [request,stage]), [
    ['first','plan'],['first','self'],['second','plan'],['second','self']
  ]);
  assert.equal(calls[1].messages.length, 0);
  assert.ok(calls[2].messages.some((m) => m.text === 'reply first'));
  assert.ok(calls[2].messages.some((m) => m.text === 'first'));
});

test('both host requests run in series and the second can see work already completed', async (t) => {
  const artifactDir = mkdtempSync(join(tmpdir(),'goose-office-output-'));
  let running = 0;
  const { runtime, calls } = office(t, async ({stage,id,files}) => {
    if (stage === 'plan') return '{"route":"self"}';
    assert.ok(existsSync(files));
    assert.equal(++running, 1);
    await new Promise((resolve) => setImmediate(resolve));
    --running;
    return 'performed by ' + id;
  }, {artifactDir});
  runtime.submitMany({managers:['claude','codex'], text:'執行：handle one change'});
  await runtime.idle();
  const work = calls.filter((c) => c.stage === 'self');
  assert.equal(work.length, 2);
  assert.ok(work.every((c) => c.execute && c.request === 'handle one change'));
  assert.ok(calls.filter((c) => c.stage === 'plan').every((c) => !c.execute));
  assert.ok(work[1].messages.some((m) => m.text === 'performed by ' + work[0].id));
});

test('a failed worker leaves a truthful failure and skips manager review', async (t) => {
  const {runtime, calls} = office(t, async ({stage}) => {
    if (stage === 'plan') return '{"route":"delegate","worker":"claude-review","assignment":"校對"}';
    throw new Error('authentication');
  });
  const task = runtime.submit({manager:'claude', text:'請校對'});
  await runtime.idle();
  assert.equal(runtime.getTask(task.id).status, 'failed');
  assert.equal(calls.length, 2);
  assert.match(runtime.snapshot().messages.at(-1).text, /登入/);
});

test('restart recovers queued jobs, flags interrupted jobs, and protects the active database owner', async (t) => {
  const file = join(mkdtempSync(join(tmpdir(), 'goose-office-')), 'office.sqlite');
  const runAgent = async ({stage}) => ({reply: stage === 'plan' ? '{"route":"self"}' : 'completed'});
  const a = createOfficeRuntime({file, runAgent});
  assert.throws(() => createOfficeRuntime({file, runAgent}), /locked/);
  const first = a.submit({manager:'claude', text:'repeat', clientId:'approved'});
  const next = a.submit({manager:'codex', text:'queued'});
  await a.close();
  const db = new DatabaseSync(file);
  db.prepare("UPDATE tasks SET status='working' WHERE id=?").run(first.id);
  db.close();
  const b = createOfficeRuntime({file, runAgent});
  t.after(() => b.close());
  await b.idle();
  assert.equal(b.getTask(first.id).status, 'failed');
  assert.equal(b.getTask(next.id).status, 'done');
  assert.equal(b.submit({manager:'claude',text:'repeat',clientId:'approved'}).id, first.id);
  assert.equal(b.snapshot().tasks.length, 2);
});
