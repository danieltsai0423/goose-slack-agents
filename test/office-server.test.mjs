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
import { readOfficeAttachments } from '../src/office-attachments.mjs';
import { requiresNativeCodex } from '../src/office-models.mjs';
import { runNativeCodex } from '../src/office-codex.mjs';
import { claudeUsage, codexUsage, createOfficeUsage } from '../src/office-usage.mjs';

async function officeServer(t, options = {}) {
  const calls = [];
  const runtime = createOfficeRuntime({file: ':memory:', async runAgent(turn) {
    calls.push(turn);
    return {reply: turn.stage === 'plan' ? '{"route":"self"}' : turn.actor + ' replies to ' + turn.request};
  }});
  const slackHistory = options.slackHistory ?? {read: () => [], close() {}};
  const backend = options.backend ?? (async () => ({ready:true, managers:{claude:true,codex:true}}));
  const server = createOfficeServer({runtime,slackHistory,backend,onboarding:options.onboarding,usage:options.usage});
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

test('subscription windows use server percentages and omit missing values', () => {
  const reset = '2026-11-23T01:00:00Z';
  assert.deepEqual(claudeUsage({ rate_limits_available: true, rate_limits: {
    five_hour: { utilization: 0, resets_at: reset }, seven_day: { utilization: null },
    model_scoped: [{ display_name: 'Fable', utilization: 87, resets_at: null }]
  } }), [
    { label: '5 小時額度', used: 0, resetsAt: Date.parse(reset) },
    { label: '每週額度 · Fable', used: 87, resetsAt: null }
  ]);
  const primary = { usedPercent: 23, windowDurationMins: 300, resetsAt: Date.parse(reset) / 1000 };
  assert.deepEqual(codexUsage({ rateLimits: { primary }, rateLimitsByLimitId: { codex: { primary } } }), [
    { label: '5 小時額度', used: 23, resetsAt: Date.parse(reset) }
  ]);
});

test('usage is fetched on demand, shares parallel probes, and retries after expiry', async t => {
  let now = 1000, reads = 0;
  const usage = createOfficeUsage({ now: () => now, readers: {
    async claude() { reads++; return { plan: 'pro', windows: [{ label: '每週額度', used: 12, resetsAt: null }] }; },
    async codex() { throw new Error('service unavailable'); }
  } });
  const { request, calls, port } = await officeServer(t, { usage });
  await request('/api/state');
  assert.equal(reads, 0);
  assert.equal((await request('/api/usage/claude', undefined, {'Sec-Fetch-Site':'cross-site'})).status, 403);
  const [one, two] = await Promise.all([request('/api/usage/claude'), request('/api/usage/claude')]);
  assert.equal(reads, 1);
  assert.deepEqual(one.body, two.body);
  assert.deepEqual(one.body, { status: 'ready', plan: 'pro', windows: [{ label: '每週額度', used: 12, resetsAt: null }], checkedAt: now });
  assert.equal((await request('/api/usage/codex')).body.status, 'unavailable');
  await request('/api/usage/claude?refresh=1');
  assert.equal(reads, 1);
  now += 60000;
  await request('/api/usage/claude');
  assert.equal(reads, 2);
  await request('/api/connections/check', {}, { Origin: 'http://127.0.0.1:' + port });
  await request('/api/usage/claude');
  assert.equal(reads, 3);
  assert.equal(calls.length, 0);
});

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

test('the login panel can refresh local readiness without calling a manager', async (t) => {
  let loggedIn = false;
  let forcedChecks = 0;
  const { request, port, calls } = await officeServer(t, {
    async backend({ force } = {}) {
      if (force) {
        forcedChecks++;
        loggedIn = true;
      }
      return { ready: loggedIn, managers: { claude: false, codex: loggedIn } };
    }
  });
  assert.equal((await request('/api/state')).body.backend.managers.codex, false);
  assert.equal((await request('/api/connections/check', {})).status, 403);
  assert.equal((await request('/api/connections/check', {}, { Origin: 'http://other.test' })).status, 403);
  assert.equal(forcedChecks, 0);
  const checked = await request('/api/connections/check', {}, { Origin: 'http://127.0.0.1:' + port });
  assert.equal(checked.status, 200);
  assert.equal(checked.body.backend.managers.codex, true);
  assert.equal(forcedChecks, 1);
  assert.deepEqual(calls, []);
});

test('onboarding actions require the office origin and report progress through state', async t => {
  let state = 'idle';
  const snapshot = () => ({ state });
  const { request, port } = await officeServer(t, {
    onboarding: {
      snapshot,
      start() { state = 'running'; return snapshot(); },
      cancel() { state = 'cancelling'; return snapshot(); }
    }
  });
  const start = '/api/connections/setup/start';
  const cancel = '/api/connections/setup/cancel';
  const headers = { Origin: `http://127.0.0.1:${port}` };
  assert.equal((await request(start, {})).status, 403);
  assert.equal((await request(start, {}, { Origin: 'https://another.test' })).status, 403);
  assert.equal((await request('/api/state')).body.onboarding.state, 'idle');
  const started = await request(start, {}, headers);
  assert.equal(started.status, 202);
  assert.equal(started.body.onboarding.state, 'running');
  assert.equal((await request('/api/state')).body.onboarding.state, 'running');
  assert.equal((await request(cancel, {}, headers)).body.onboarding.state, 'cancelling');
});

test('task attachments are shared, downloadable and retained for follow-up turns', async t => {
  const { request, runtime, calls, port } = await officeServer(t);
  const screenshot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKOcAAAAASUVORK5CYII=';
  const body = {
    text: '', managers: ['claude', 'codex'], clientId: 'attachment-test',
    attachments: [
      { name: '截圖.png', data: screenshot },
      { name: '摘要.txt', data: Buffer.from('附件內容').toString('base64') }
    ]
  };
  const sent = await request('/api/tasks', body);
  assert.equal(sent.status, 202);
  const repeated = await request('/api/tasks', body);
  assert.deepEqual(repeated.body.tasks.map(task => task.id), sent.body.tasks.map(task => task.id));
  assert.equal((await request('/api/tasks', { ...body, attachments: body.attachments.slice(1) })).status, 409);
  assert.equal((await request('/api/tasks', { ...body, clientId: 'invalid-attachment-test', attachments: [
    { name: 'false.png', data: Buffer.from('not an image').toString('base64') }
  ] })).status, 400);
  await runtime.idle();
  assert.deepEqual(new Set(calls.map(call => call.id)), new Set(['claude', 'codex']));
  assert.ok(calls.every(call => call.attachments[1].text === '附件內容'));
  const state = (await request('/api/state')).body;
  const [message] = state.messages.filter(item => item.author === 'user');
  const [file] = message.attachments;
  assert.equal(file.name, '截圖.png');
  assert.equal(file.data, undefined);
  const url = `http://127.0.0.1:${port}/api/attachments/${file.id}`;
  const preview = await fetch(url);
  assert.equal(preview.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await preview.arrayBuffer()).toString('base64'), screenshot);
  const download = await fetch(url + '?download=1', { method: 'HEAD' });
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  const follow = await request('/api/tasks/' + sent.body.tasks[0].id + '/messages', { text: '追問附件', managers: ['codex'] });
  assert.equal(follow.status, 202);
  await runtime.idle();
  assert.equal(calls.at(-1).attachments[0].name, '截圖.png');
});

test('PDF attachments provide text and rendered scan pages', async () => {
  function pdf(stream) {
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let source = '%PDF-1.4\n';
    const offsets = [];
    for (const [index, item] of objects.entries()) {
      offsets.push(source.length);
      source += `${index + 1} 0 obj\n${item}\nendobj\n`;
    }
    const xref = source.length;
    source += 'xref\n0 6\n0000000000 65535 f \n';
    for (const offset of offsets) source += `${String(offset).padStart(10, '0')} 00000 n \n`;
    source += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(source).toString('base64');
  }
  const [document, scan] = await readOfficeAttachments([
    { name: 'brief.pdf', data: pdf('BT /F1 18 Tf 15 40 Td (Office notes) Tj ET') },
    { name: 'scan.pdf', data: pdf('1 0 0 rg 10 10 92 55 re f') }
  ]);
  assert.match(document.text, /Office notes/);
  assert.deepEqual(document.visuals, []);
  assert.equal(scan.visuals[0].page, 1);
  assert.equal(Buffer.from(scan.visuals[0].data, 'base64').subarray(0, 3).toString('hex'), 'ffd8ff');
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
  assert.equal(state.modelCatalog.codex.defaultModel, 'gpt-6.2-sol');
  assert.equal(state.modelCatalog.codex.defaultEffort, 'high');
});

test('the office catalog defaults can be sent as explicit settings for both managers', async t => {
  const {request, runtime, calls} = await officeServer(t, {
    backend: async () => ({ ready: true, managers: { claude: true, codex: true },
      nativeCodexEfforts: { 'gpt-6.2-sol': ['medium', 'high', 'xhigh', 'max'] } })
  });
  const {body: {modelCatalog}} = await request('/api/state');
  const modelSettings = Object.fromEntries(Object.entries(modelCatalog).map(([id, {defaultModel, defaultEffort}]) =>
    [id, { model: defaultModel, effort: defaultEffort }]));
  assert.deepEqual(modelSettings, {
    claude: { model: 'claude-opus-5-5', effort: 'medium' },
    codex: { model: 'gpt-6.2-sol', effort: 'xhigh' }
  });
  const response = await request('/api/tasks', { managers: ['claude', 'codex'], text: '回報結果', modelSettings });
  assert.equal(response.status, 202);
  await runtime.idle();
  assert.ok(calls.length >= 2);
  for (const {id, model, effort} of calls) assert.deepEqual({model, effort}, modelSettings[id]);
  assert.equal(requiresNativeCodex('gpt-6.2-sol', 'xhigh'), true);
});

test('native Codex adds only the verified model efforts and keeps the selected effort during handoff', async t => {
  const { request, runtime, calls } = await officeServer(t, {
    backend: async () => ({
      ready: true, managers: { claude: true, codex: true },
      nativeCodexEfforts: { 'gpt-6.2-sol': ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] }
    })
  });
  const catalog = (await request('/api/state')).body.modelCatalog.codex;
  assert.deepEqual(catalog.models.find(model => model.id === 'gpt-6.2-sol').efforts, ['medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(catalog.models.find(model => model.id === 'gpt-6.2-astra').efforts, ['medium', 'high']);
  const task = { managers: ['codex'], text: '驗證', modelSettings: { codex: { model: 'gpt-6.2-sol', effort: 'max' } } };
  assert.equal((await request('/api/tasks', task)).status, 202);
  const unavailable = { ...task, modelSettings: { codex: { model: 'gpt-6.2-astra', effort: 'max' } } };
  assert.equal((await request('/api/tasks', unavailable)).status, 400);
  await runtime.idle();
  assert.ok(calls.length > 0 && calls.every(call => call.model === 'gpt-6.2-sol' && call.effort === 'max'));
  assert.equal(requiresNativeCodex('gpt-6.2-sol', 'max'), true);
  assert.equal(requiresNativeCodex('gpt-5.6-sol', 'xhigh'), false);
});

test('native Codex passes the precise effort and uses the appropriate tool scope', async () => {
  for (const execute of [false, true]) {
    const events = [];
    const reply = await runNativeCodex({
      model: 'gpt-6.2-sol', effort: 'max', execute, artifactDir: 'out', images: [], input: 'test',
      onProgress: event => events.push(event),
      async invoke(_command, args, input, feed) {
        assert.ok(args.includes('model_reasoning_effort="max"'));
        assert.ok(args.includes('forced_login_method="chatgpt"'));
        assert.ok(args.includes(execute ? 'workspace-write' : 'read-only'));
        assert.equal(args.includes('--add-dir'), execute);
        assert.equal(args.includes('features.shell_tool=false'), !execute);
        assert.equal(input, 'test');
        if (execute) {
          const item = { id: 'command-1', type: 'command_execution', command: 'node --version' };
          feed(JSON.stringify({type: 'item.started', item}) + '\n');
          feed(JSON.stringify({type: 'item.completed', item: {...item, exit_code: 0}}) + '\n');
        }
        feed(JSON.stringify({type: 'item.completed', item: {type: 'agent_message', text: 'ready'}}) + '\n');
      }
    });
    assert.equal(reply, 'ready');
    assert.deepEqual(events.at(-1), {type: 'text', text: 'ready'});
    if (execute) {
      assert.equal(events[0].kind, 'command');
      assert.equal(events[1].status, 'done');
      assert.equal(events[0].id, events[1].id);
    } else assert.equal(events.length, 1);
  }
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
