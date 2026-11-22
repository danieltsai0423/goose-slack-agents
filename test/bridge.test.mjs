import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBridge } from '../src/bridge.mjs';
import { openStore } from '../src/store.mjs';
import { readGooseReply } from '../src/goose.mjs';

const config = { channel: 'CROOM', ownerId: 'UOWNER', timeoutMs: 10000 };
const identities = {
  codex: { userId: 'UCODEX', botId: 'BCODEX' },
  claude: { userId: 'UCLAUDE', botId: 'BCLAUDE' }
};

function message(ts, text, extra = {}) {
  return { type: 'message', channel: config.channel, channel_type: 'group', user: config.ownerId, ts, text, ...extra };
}

function fixture(t, respond = ({ id }) => ({ reply: id, nextAgent: null }), history) {
  const store = openStore(':memory:');
  const calls = [];
  const sent = [];
  const bridge = createBridge({
    store, config, identities, history,
    log: { warn() {}, error() {} },
    async runAgent(turn) {
      calls.push(turn);
      return respond(turn);
    },
    async send(outgoing) {
      sent.push(outgoing);
      return `${1700000000 + sent.length}.000000`;
    }
  });
  t.after(async () => { await bridge.close(); store.close(); });
  return { bridge, calls, sent, store };
}

test('a dual mention gives both agents one snapshot and ignores replays and other users', async (t) => {
  const { bridge, calls, sent } = fixture(t);
  const thread = '1700000000.000001';
  bridge.receive(message(thread, '需求背景'));
  bridge.receive(message('1700000000.000002', '另一個 thread 的文字'));
  bridge.receive(message('1700000000.000003', '@all 外部訊息', { channel: 'COTHER' }));
  bridge.receive(message('1700000000.000004', '@all 外人', { user: 'UOTHER', thread_ts: thread }));
  bridge.receive(message('1700000000.000005', '<@UCODEX> <@UCLAUDE> 各自回答', { thread_ts: thread }));
  bridge.receive(message('1700000000.000005', '<@UCODEX> <@UCLAUDE> 各自回答', { thread_ts: thread }));
  await bridge.idle();
  assert.deepEqual(calls.map(({ id }) => id).sort(), ['claude', 'codex']);
  assert.equal(calls[0].messages, calls[1].messages);
  assert.deepEqual(calls[0].messages.map(({ text }) => text), ['需求背景', '<@UCODEX> <@UCLAUDE> 各自回答']);
  assert.ok(sent.every((outgoing) => outgoing.thread === thread));
});

test('the owner can call both agents using Slack channel and here mentions', async (t) => {
  const { bridge, calls, sent } = fixture(t);
  const channelThread = '1700000000.000001';
  const hereThread = '1700000000.000002';
  bridge.receive(message(channelThread, '<!channel> 報數'));
  bridge.receive(message(hereThread, '<!here> 請回覆'));
  bridge.receive(message('1700000000.000003', '<!channel> 外人發令', { user: 'UOTHER', thread_ts: channelThread }));
  bridge.receive(message('1700000000.000004', '<!here> 其他頻道', { channel: 'COTHER' }));
  bridge.receive(message('1700000000.000005', '<!here> Bot 發令', { user: 'UCLAUDE', thread_ts: hereThread }));
  await bridge.idle();

  assert.equal(calls.length, 4);
  for (const [thread, request] of [[channelThread, '報數'], [hereThread, '請回覆']]) {
    const turns = calls.filter((call) => call.messages[0].ts === thread);
    assert.deepEqual(turns.map((turn) => turn.id).sort(), ['claude', 'codex']);
    assert.ok(turns.every((turn) => turn.request.startsWith(`${request}\n`)));
    assert.equal(sent.filter((reply) => reply.thread === thread).length, 2);
  }
});

test('@all collaboration includes prior bot replies and has a four-turn cap', async (t) => {
  const { bridge, calls, sent } = fixture(t, ({ id }) => ({
    reply: `${id} 的交接`, nextAgent: id === 'codex' ? 'claude' : 'codex'
  }));
  const thread = '1700000000.000001';
  bridge.receive(message(thread, '@all 一起完成這件事'));
  await bridge.idle();
  assert.deepEqual(calls.map(({ id }) => id), ['claude', 'codex', 'claude', 'codex']);
  assert.ok(calls[1].messages.some(({ text }) => text === 'claude 的交接'));
  assert.equal(calls.at(-1).canDelegate, false);
  assert.equal(sent.length, 4);

  bridge.receive(message('1700000009.000001', '@all 自動重跑', {
    bot_id: 'BCLAUDE', user: 'UCLAUDE', subtype: 'bot_message', thread_ts: thread
  }));
  await bridge.idle();
  assert.equal(calls.length, 4);
});

test('host execution requires a leading mention and an explicit command from the owner', async (t) => {
  const { bridge, calls, sent } = fixture(t, ({ id }) => ({ reply: `${id} 已驗證`, nextAgent: 'codex' }));
  const thread = '1700000000.000001';
  bridge.receive(message(thread, '任務背景'));
  bridge.receive(message('1700000000.000002', '<@UCODEX> 執行：外人發令', { user: 'UOTHER', thread_ts: thread }));
  bridge.receive(message('1700000000.000003', '@all 執行：Bot 發令', { user: 'UCLAUDE', thread_ts: thread }));
  bridge.receive(message('1700000000.000004', '討論 <@UCODEX> 執行：這個寫法', { thread_ts: thread }));
  bridge.receive(message('1700000000.000005', '<@UCLAUDE> 執行：跑測試並把結果給 <@UCODEX>', { thread_ts: thread }));
  bridge.receive(message('1700000000.000006', '@all 執行：查看工作目錄', { thread_ts: thread }));
  await bridge.idle();

  assert.deepEqual(calls.map(({ id, execute }) => [id, execute]), [
    ['codex', false], ['claude', true], ['claude', true], ['codex', true]
  ]);
  assert.equal(calls[1].request, '跑測試並把結果給 <@UCODEX>');
  assert.equal(calls[2].request, '查看工作目錄');
  assert.ok(calls[3].messages.some(({ text }) => text === 'claude 已驗證'));
  assert.ok(calls.filter(({ execute }) => execute).every(({ canDelegate }) => !canDelegate));
  assert.ok(sent.every((reply) => reply.thread === thread));
});

test('a passive follow-up only runs after auto mode is enabled and agents may skip', async (t) => {
  const { bridge, calls, sent } = fixture(t, ({ id }) => ({ reply: id === 'codex' ? '有更新' : '', nextAgent: null }));
  const thread = '1700000000.000001';
  bridge.receive(message(thread, '任務背景'));
  await bridge.idle();
  assert.equal(calls.length, 0);

  bridge.receive(message('1700000000.000002', '!auto on', { thread_ts: thread }));
  bridge.receive(message('1700000000.000003', '補充一個驗收條件', { thread_ts: thread }));
  await bridge.idle();
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => !call.required));
  assert.equal(sent.at(-1).text, '有更新');
  assert.equal(sent.length, 2);
});

test('stop aborts the active turn, drops queued work and keeps the thread quiet', async (t) => {
  const cancel = Promise.withResolvers();
  const started = Promise.withResolvers();
  const { bridge, calls, sent, store } = fixture(t, ({ signal }) => {
    signal.addEventListener('abort', () => cancel.resolve({ reply: '過期輸出', nextAgent: 'codex' }), { once: true });
    started.resolve();
    return cancel.promise;
  });
  const thread = '1700000000.000001';
  bridge.receive(message(thread, '@all 協作'));
  await started.promise;
  bridge.receive(message('1700000000.000002', '再做一件事', { thread_ts: thread }));
  bridge.receive(message('1700000000.000003', '!stop', { thread_ts: thread }));
  await bridge.idle();
  assert.equal(store.isAuto(thread), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(sent.map(({ text }) => text), ['已停止本串的自動接力。']);
});

test('edited and deleted Slack messages update context without starting work', async (t) => {
  const { bridge, calls, store } = fixture(t);
  const thread = '1700000000.000001';
  const note = message('1700000000.000002', '初稿', { thread_ts: thread });
  bridge.receive(message(thread, '任務'));
  bridge.receive(note);
  bridge.receive(message('1700000000.000003', '', {
    subtype: 'message_changed', message: { ...note, text: '@all 修改後的草稿' }
  }));
  assert.equal(store.context(thread).at(-1).text, '@all 修改後的草稿');
  bridge.receive(message('1700000000.000004', '', { subtype: 'message_deleted', previous_message: note }));
  bridge.receive(note);
  assert.deepEqual(store.context(thread).map(({ text }) => text), ['任務']);
  await bridge.idle();
  assert.equal(calls.length, 0);
});

test('a cold thread includes authorized Slack history in its first turn', async (t) => {
  const thread = '1700000000.000001';
  const { bridge, calls } = fixture(t, undefined, async () => [
    message(thread, '早上的需求'),
    message('1700000000.000002', '另一隻 Bot 的方案', { user: 'UCLAUDE', thread_ts: thread }),
    message('1700000000.000003', '外人訊息', { user: 'UOTHER', thread_ts: thread })
  ]);
  bridge.receive(message('1700000000.000004', '<@UCODEX> 接手', { thread_ts: thread }));
  await bridge.idle();
  assert.deepEqual(calls[0].messages.map(({ text }) => text), ['早上的需求', '另一隻 Bot 的方案', '<@UCODEX> 接手']);
});

test('Goose decodes only the final assistant text and validates handoffs', () => {
  const output = (reply) => `goose is ready\n${JSON.stringify({ messages: [
    { role: 'user', content: [{ type: 'text', text: 'ignored' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'intermediate step' }] },
    { role: 'assistant', content: [{ type: 'text', text: reply }] }
  ] }, null, 2)}`;
  assert.deepEqual(readGooseReply(output('```json\n{"reply":"方案","next_agent":"codex"}\n```'), 'claude', true), {
    reply: '方案', nextAgent: 'codex'
  });
  assert.deepEqual(readGooseReply(output('{"reply":"方案","next_agent":"claude"}'), 'claude', true), {
    reply: '方案', nextAgent: null
  });
  assert.deepEqual(readGooseReply(output('plain text'), 'claude', false), { reply: '', nextAgent: null });
  assert.deepEqual(readGooseReply(output('{"status":"completed"}'), 'claude', true), {
    reply: '{"status":"completed"}', nextAgent: null
  });
});
