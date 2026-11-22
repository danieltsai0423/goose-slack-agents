import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as wait } from 'node:timers/promises';
import { test } from 'node:test';
import { createOfficeRuntime } from '../src/office-runtime.mjs';
import { createOfficeServer } from '../src/office-server.mjs';

const step = (key, worker, dependsOn = []) => ({ key, worker, dependsOn, assignment: '完成工序 ' + key });

test('history indexes existing turns, freezes selected quotes, and skips model calls for searches', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'goose-office-history-'));
  const file = join(dir, 'office.sqlite');
  const calls = [];
  const open = () => createOfficeRuntime({ file, async runAgent(turn) {
    calls.push(turn);
    return { reply: '已驗證蘭花狀態，測試通過。' };
  } });
  const first = open();
  t.after(async () => { await first.close(); });
  const task = first.submit({ manager: 'claude', text: '確認部署結果' });
  await first.idle();
  await first.close();
  // Simulate upgrading a database whose tasks predate the search index.
  const old = new DatabaseSync(file);
  old.exec('DROP TRIGGER office_message_insert; DROP TRIGGER office_message_remove; DROP TRIGGER office_message_update; DROP TABLE office_message_search;');
  old.close();
  const runtime = open();
  t.after(async () => { await runtime.close(); await rm(dir, { recursive: true, force: true }); });
  const [match] = runtime.searchHistory('驗證蘭花');
  assert.equal(match.threadId, task.threadId);
  assert.equal(match.author, 'claude');
  assert.ok(runtime.searchHistory('蘭花').length);
  assert.deepEqual(runtime.searchHistory('" OR 1=1'), []);
  assert.equal(calls.length, 1);
  const second = runtime.submit({ manager: 'codex', text: '', references: [{ id: match.id, offset: match.offset }] });
  assert.notEqual(second.threadId, task.threadId);
  await runtime.idle();
  assert.equal(calls.at(-1).references[0].excerpt, match.excerpt);
  assert.equal(calls.at(-1).execute, false);
  const user = runtime.snapshot().messages.find(message => message.threadId === second.threadId && message.author === 'user');
  assert.equal(user.references[0].sourceThread, task.threadId);
  assert.throws(() => runtime.submit({ manager: 'codex', text: '引用', references: [{ id: match.id, offset: 99999 }] }), { statusCode: 400 });
});

test('knowledge suggestions stay pending until review, load by actor and keyword, and can be archived', async t => {
  const calls = [];
  const runtime = createOfficeRuntime({ file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    return {
      reply: '收到。', ...(turn.request === '記住使用正體中文' && {
        knowledge: [{ kind: 'memory', title: '語言', body: '交付使用正體中文。' }]
      })
    };
  } });
  t.after(() => runtime.close());
  runtime.submit({ manager: 'claude', text: '記住使用正體中文' });
  await runtime.idle();
  const [memory] = runtime.listKnowledge('claude', 'pending');
  assert.equal(memory.body, '交付使用正體中文。');
  assert.ok(memory.sourceTaskId);
  const skill = runtime.proposeKnowledge({actor:'claude',kind:'skill',title:'上線前',body:'核對儀表板。',keywords:['部署']});
  runtime.submit({manager:'claude',text:'部署下一版'});
  await runtime.idle();
  assert.deepEqual(calls.at(-1).knowledge,{ memories:[],skills:[] });
  runtime.reviewKnowledge(memory.id, 'approve');
  runtime.reviewKnowledge(skill.id, 'approve');
  runtime.submitMany({managers:['claude','codex'],text:'部署下一版'});
  await runtime.idle();
  const claude = calls.findLast(call => call.id === 'claude');
  const codex = calls.findLast(call => call.id === 'codex');
  assert.deepEqual(claude.knowledge.memories.map(item => item.title), ['語言']);
  assert.deepEqual(claude.knowledge.skills.map(item => item.title), ['上線前']);
  assert.deepEqual(codex.knowledge, {memories:[],skills:[]});
  runtime.reviewKnowledge(memory.id, 'archive');
  assert.throws(() => runtime.reviewKnowledge(memory.id, 'reject'), { statusCode: 409 });
  runtime.submit({manager:'claude',text:'一般問題'});
  await runtime.idle();
  assert.deepEqual(calls.at(-1).knowledge,{ memories:[],skills:[] });
});

test('cross-team DAGs enforce dependencies, recover failed branches, and review persisted reports once', async t => {
  const calls = [];
  let fail = true;
  const runtime = createOfficeRuntime({ file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    if (turn.actor === 'codex-build' && fail) return { reply: '缺少可驗證的實作結果', stepStatus: 'blocked' };
    return { reply: '由 ' + turn.actor + ' 交付' };
  } });
  t.after(() => runtime.close());
  const steps = [step('verify', 'codex-test', ['build']), step('research', 'claude-research'),
    step('build', 'codex-build', ['research']), step('proof', 'claude-review')];
  assert.throws(() => runtime.submit({ manager: 'codex', text: 'loop', workflow: [
    step('a', 'codex-test', ['b']), step('b', 'codex-build', ['a'])
  ] }), { statusCode: 400 });
  const task = runtime.submit({ manager: 'codex', text: '整理研究、實作與驗證', workflow: steps });
  await runtime.idle();
  const [failed] = runtime.listWorkflows();
  assert.equal(failed.status, 'failed');
  assert.equal(failed.steps.find(item => item.key === 'verify').status, 'blocked');
  assert.equal(failed.steps.find(item => item.key === 'research').status, 'done');
  assert.equal(calls.some(call => call.stage === 'review' || call.actor === 'codex-test'), false);
  fail = false;
  runtime.retryWorkflow(task.id);
  runtime.retryWorkflow(task.id);
  await runtime.idle();
  assert.equal(runtime.getTask(task.id).status, 'done');
  assert.equal(calls.filter(call => call.actor === 'claude-research').length, 1);
  const worker = calls.find(call => call.actor === 'codex-test');
  assert.deepEqual(worker.prerequisiteResults.map(item => item.key), ['build']);
  assert.equal(worker.messages.some(message => message.author === 'claude-review'), false);
  assert.equal(calls.filter(call => call.stage === 'review').length, 1);
  assert.equal(calls.at(-1).prerequisiteResults.length, 4);
});

test('ready downstream work can run while an independent branch is still active', async t => {
  const both = Promise.withResolvers();
  const dependent = Promise.withResolvers();
  const release = Promise.withResolvers();
  const started = [];
  const runtime = createOfficeRuntime({ file: ':memory:', async runAgent(turn) {
    if (turn.stage === 'delegate') {
      started.push(turn.assignment);
      if (started.length === 2) both.resolve();
      if (turn.actor === 'claude-research') await release.promise;
      if (turn.assignment === '完成工序 verify') dependent.resolve();
    }
    return { reply: 'ready' };
  } });
  t.after(() => { release.resolve(); return runtime.close(); });
  runtime.submit({ manager: 'codex', text: '跨組分工', workflow: [
    step('research','claude-research'), step('build','codex-build'), step('verify','codex-test',['build']),
    step('join','codex-test',['research','verify'])
  ] });
  await Promise.race([both.promise, wait(1000).then(() => { throw new Error('Independent branches did not overlap'); })]);
  assert.deepEqual(new Set(started.slice(0, 2)), new Set(['完成工序 research','完成工序 build']));
  await Promise.race([dependent.promise, wait(1000).then(() => { throw new Error('Ready step waited for the unrelated branch'); })]);
  assert.equal(runtime.listWorkflows()[0].steps[3].status, 'waiting');
  release.resolve();
  await runtime.idle();
  assert.equal(started.at(-1), '完成工序 join');
});

test('workflow restarts keep completed steps and require confirmation for interrupted host work', async t => {
  for (const execute of [false, true]) {
    const dir = await mkdtemp(join(tmpdir(), 'goose-office-flow-'));
    const file = join(dir, 'office.sqlite');
    const entered = Promise.withResolvers();
    const first = createOfficeRuntime({ file, async runAgent({ actor, signal }) {
      if (actor === 'codex-test') {
        entered.resolve();
        await wait(60000, undefined, { signal });
      }
      return { reply: 'completed dependency' };
    } });
    let restarted;
    t.after(async () => { await restarted?.close(); await first.close(); await rm(dir, { recursive: true, force: true }); });
    const task = first.submit({ manager:'codex', text: (execute ? '執行：' : '') + '檢查',
      workflow:[step('first','codex-build'),step('later','codex-test',['first'])] });
    await entered.promise;
    await first.close();
    const calls = [];
    restarted = createOfficeRuntime({ file, async runAgent(turn) { calls.push(turn); return { reply:'resumed' }; } });
    if (execute) {
      assert.equal(restarted.getTask(task.id).status, 'failed');
      assert.equal(restarted.listWorkflows()[0].steps[1].status, 'interrupted');
      assert.deepEqual(calls, []);
      restarted.retryWorkflow(task.id);
    }
    await restarted.idle();
    assert.equal(restarted.getTask(task.id).status, 'done');
    assert.deepEqual(calls.map(turn => turn.actor), ['codex-test','codex']);
    assert.equal(calls[0].prerequisiteResults[0].result, 'completed dependency');
  }
});

test('idle polling reuses state and mutations are limited to the office origin', async t => {
  const runtime = createOfficeRuntime({ file: ':memory:', async runAgent() { return { reply: 'ready' }; } });
  const status = { ready: true, managers: { claude: true, codex: true } };
  const slack = [];
  const server = createOfficeServer({ runtime, backend: async () => status, slackHistory: { read: () => slack } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await runtime.close(); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const initial = await fetch(origin + '/api/state');
  const tag = initial.headers.get('etag');
  assert.ok(tag);
  await initial.json();
  const unchanged = await fetch(origin + '/api/state', { headers: { 'If-None-Match':tag } });
  assert.equal(unchanged.status, 304);
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  const payload = JSON.stringify({ actor:'codex', kind:'memory', title:'測試', body:'待核准' });
  const denied = await fetch(origin + '/api/knowledge', { method:'POST', headers:{'Content-Type':'application/json'},body:payload });
  assert.equal(denied.status, 403);
  const allowed = await fetch(origin + '/api/knowledge', { method:'POST', headers, body:payload });
  assert.equal(allowed.status, 201);
  const submitted = await fetch(origin + '/api/tasks', { method:'POST', headers, body:JSON.stringify({managers:['codex'],text:'測試更新'}) });
  assert.equal(submitted.status, 202);
  await runtime.idle();
  const changed = await fetch(origin + '/api/state', { headers: { 'If-None-Match':tag } });
  assert.equal(changed.status, 200);
  assert.notEqual(changed.headers.get('etag'), tag);
  await changed.json();
});
