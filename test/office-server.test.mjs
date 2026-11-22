import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createOfficeRuntime } from '../src/office-runtime.mjs';
import { createOfficeServer } from '../src/office-server.mjs';
import { openSlackHistory } from '../src/office-slack.mjs';
import { openStore } from '../src/store.mjs';

async function officeServer(t, options = {}) {
  const calls = [];
  const runtime = createOfficeRuntime({file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    return {reply: turn.stage === 'plan' ? '{"route":"self"}' : turn.actor + ' replies to ' + turn.request};
  }});
  const slackHistory = options.slackHistory ?? {read: () => [], close() {}};
  const backend = options.backend ?? (async () => ({ready:true, managers:{claude:true,codex:true}}));
  const server = createOfficeServer({runtime,slackHistory,backend});
  server.listen(0, '127.0.0.1');
  await once(server,'listening');
  const port = server.address().port;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runtime.close();
    slackHistory.close();
  });
  async function request(path, body, headers = {}) {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const res = await new Promise((accept, reject) => {
      const req = http.request({host:'127.0.0.1', port, path, method:data ? 'POST' : 'GET',
        headers:{...(data ? {'Content-Type':'application/json'} : {}), ...headers}}, accept);
      req.once('error', reject);
      req.end(data);
    });
    let output = '';
    res.setEncoding('utf8');
    for await (const chunk of res) output += chunk;
    return {status:res.statusCode, body:JSON.parse(output)};
  }
  return {request, runtime, calls, port};
}

test('HTTP dispatch retries are idempotent and a follow-up by task id joins the conversation', async (t) => {
  const {request,runtime,calls} = await officeServer(t);
  const dual = {managers:['claude','codex'],text:'最初的需求',clientId:'dual-1'};
  const [one,two] = await Promise.all([request('/api/tasks', dual),request('/api/tasks', dual)]);
  assert.equal(one.status, 202);
  assert.equal(two.status, 202);
  assert.equal(one.body.threadId, two.body.threadId);
  assert.deepEqual(one.body.tasks.map((v) => v.id),two.body.tasks.map((v) => v.id));
  await runtime.idle();
  const reply = await request('/api/tasks/' + one.body.tasks[0].id + '/messages',
    {managers:['claude'],text:'補充條件',clientId:'follow-1'});
  assert.equal(reply.status, 202);
  assert.equal(reply.body.threadId, one.body.threadId);
  assert.equal((await request('/api/tasks/not-found/messages', dual)).status, 404);
  assert.equal((await request('/api/tasks',{...dual,text:'不同內容'})).status, 409);
  await runtime.idle();
  const {body:state,status} = await request('/api/state');
  assert.equal(status,200);
  assert.ok(state.backend.ready);
  assert.equal(state.employees.length,6);
  assert.equal(state.tasks.length,3);
  assert.ok(state.tasks.every((task) => task.status === 'done'));
  assert.deepEqual(state.messages.filter((m) => m.author === 'user').map((m) => m.text),['最初的需求','補充條件']);
  assert.equal(calls.filter((turn) => turn.stage === 'self').length,3);
  assert.ok(calls.at(-1).messages.some((m) => m.author === 'codex' && m.text.includes('最初的需求')));
});

test('HTTP only accepts the local office origin, JSON and available managers', async (t) => {
  const {request,runtime,port} = await officeServer(t,{backend:async () => ({ready:true,managers:{claude:false,codex:true}})});
  const body = {managers:['codex'],text:'測試',clientId:'guarded'};
  assert.equal((await request('/api/state',undefined,{Host:'other.test:' + port})).status,403);
  assert.equal((await request('/api/tasks',body,{Origin:'https://other.test'})).status,403);
  assert.equal((await request('/api/tasks',body,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await request('/api/tasks',{...body,managers:['claude']})).status,503);
  assert.equal((await request('/api/tasks',{...body,managers:['other']})).status,400);
  assert.equal(runtime.snapshot().tasks.length,0);
  assert.equal((await request('/api/tasks',body,{Origin:'http://127.0.0.1:' + port})).status,202);
});

test('dual and follow-up requests pin their own model and effort for every stage', async (t) => {
  const {request,runtime,calls} = await officeServer(t);
  const modelSettings = {
    claude:{model:'claude-sonnet-5-5',effort:'low'},
    codex:{model:'gpt-6.2-astra',effort:'high'}
  };
  const body = {managers:['claude','codex'],text:'各自回覆',clientId:'models-1',modelSettings};
  const created = await request('/api/tasks',body);
  assert.equal(created.status,202);
  assert.equal((await request('/api/tasks',{...body,modelSettings:{...modelSettings,codex:{model:'gpt-6.2-astra',effort:'low'}}})).status,400);
  assert.equal((await request('/api/tasks',{...body,modelSettings:{...modelSettings,codex:{model:'gpt-6.2-astra',effort:'medium'}}})).status,409);
  const first = created.body.tasks[0];
  const follow = await request('/api/tasks/'+first.id+'/messages',{
    managers:['claude'],text:'再確認一下',modelSettings:{claude:{model:'claude-opus-5-5',effort:'xhigh'}}
  });
  assert.equal(follow.status,202);
  await runtime.idle();
  const followId = follow.body.tasks[0].id;
  for(const {id,taskId,model,effort} of calls) {
    const expected = taskId===followId?{model:'claude-opus-5-5',effort:'xhigh'}:modelSettings[id];
    assert.deepEqual({model,effort},expected);
  }
  const {body:state}=await request('/api/state');
  assert.deepEqual(state.modelCatalog.codex.models.find(model=>model.id==='gpt-6.2-astra').efforts,['medium','high']);
});

test('state contains only the selected local Slack channel with deleted entries omitted', async (t) => {
  const dir = mkdtempSync(join(tmpdir(),'goose-slack-fixture-'));
  const saved = openStore(join(dir,'TTEAM-CWORK.sqlite'));
  const thread = '1770000000.000000';
  saved.record({ts:thread,thread,author:'owner',text:'需求規劃'});
  saved.record({ts:'1770000001.000000',thread,author:'claude',text:'主管回覆'});
  saved.record({ts:'1770000002.000000',thread,author:'codex',text:'臨時稿'});
  saved.record({ts:'1770000002.000000',thread,author:'codex',text:null,revision:'1770000003.000000'});
  saved.close();
  const other = openStore(join(dir,'TTEAM-COTHER.sqlite'));
  other.record({ts:thread,thread,author:'owner',text:'其他頻道'});
  other.close();
  const {request,calls} = await officeServer(t,{slackHistory:openSlackHistory(dir,'CWORK')});
  const {body:state} = await request('/api/state');
  assert.equal(state.slackThreads.length,1);
  assert.equal(state.slackThreads[0].id,'slack-' + thread);
  assert.deepEqual(state.slackThreads[0].messages.map((m) => [m.author,m.text]),[['user','需求規劃'],['claude','主管回覆']]);
  assert.equal(state.tasks.length,0);
  assert.equal(calls.length,0);
});
