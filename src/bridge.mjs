import { agentNames } from './config.mjs';

const maxRounds = 4;
const fallbackRequest = '請依照這個討論串目前的任務接續處理。';
const errorLabels = {
  authentication: '請確認對應的 Goose 訂閱登入',
  bad_output: '未收到可辨識的回覆',
  goose_failed: 'Goose 回傳錯誤',
  missing_adapter: '本機找不到 Claude ACP adapter',
  missing_goose: '本機找不到 Goose CLI',
  model_config: 'Goose 無法載入模型設定',
  output_limit: '輸出超過上限',
  rate_limit: '已達模型使用限制',
  spawn_failed: '無法啟動 Goose',
  timeout: '執行逾時'
};

function interpret(text, identities, auto) {
  const command = text.trim();
  if (command === '!stop') return { kind: 'stop' };
  if (command === '!auto on' || command === '!auto off') {
    return { kind: 'auto', enabled: command.endsWith('on') };
  }
  const everyone = /^(?:@all(?=$|[\s:：，,])|<!(?:channel|here)(?:\|[^>]+)?>)[\s:：，,]*/iu.exec(command);
  if (everyone) {
    const request = command.slice(everyone[0].length).trim() || fallbackRequest;
    const collaborate = /^(?:一起|協作|接力|collaborate\b)/iu.test(request);
    return { kind: collaborate ? 'collaborate' : 'compare', agents: agentNames, request };
  }
  const tagged = new Set([...text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g)].map((match) => match[1]));
  const requestedAgents = agentNames.filter((id) => tagged.has(identities[id].userId));
  if (requestedAgents.length) {
    return { kind: requestedAgents.length === 2 ? 'compare' : 'direct', agents: requestedAgents, request: command };
  }
  if (auto) return { kind: 'proactive', agents: agentNames, request: command };
  return null;
}

export function createBridge({ store, config, identities, runAgent, send, history, log = console }) {
  const states = new Map();
  const hydrated = new Set();
  const notices = new Set();
  let closing = false;

  function authorOf(message) {
    for (const id of agentNames) {
      const identity = identities[id];
      if (message.user === identity.userId || (identity.botId && message.bot_id === identity.botId)) return id;
    }
    if (message.user === config.ownerId && !message.bot_id && !message.app_id) return 'owner';
    return null;
  }

  function remember(message, revision, deleted = false) {
    const author = authorOf(message);
    if (!author || typeof message.ts !== 'string') return null;
    if (!deleted && typeof message.text !== 'string') return null;
    const thread = message.thread_ts || message.ts;
    store.record({ ts: message.ts, thread, author, text: deleted ? null : message.text, revision });
    return { author, thread };
  }

  async function publish(id, thread, reply) {
    const text = reply.length > 3900 ? `${reply.slice(0, 3860)}\n…（回覆已截短）` : reply;
    const ts = await send({ id, thread, text });
    store.record({ ts, thread, author: id, text });
  }

  async function hydrate(thread) {
    if (!history || hydrated.has(thread)) return;
    try {
      const messages = await history(thread);
      for (const message of messages) remember(message, message.edited?.ts || message.ts);
      hydrated.add(thread);
    } catch {
      log.warn('Slack 討論串歷史讀取失敗，本輪使用本機紀錄。');
    }
  }

  async function execute(job, signal) {
    const { thread, agents, kind, request } = job;
    await hydrate(thread);
    if (signal.aborted) return;

    const canHandoff = kind === 'collaborate' || kind === 'proactive' ||
      (kind === 'direct' && store.isAuto(thread));

    async function turn(id, messages, instruction, required, canDelegate) {
      if (signal.aborted) return null;
      let result;
      try {
        result = await runAgent({ id, request: instruction, messages, required, canDelegate, signal, timeoutMs: config.timeoutMs });
      } catch (error) {
        if (signal.aborted) return null;
        const label = Object.hasOwn(errorLabels, error.message) ? errorLabels[error.message] : '執行失敗';
        log.warn(`${id}：${label}`);
        if (required) await publish(id, thread, `這一輪未完成（${label}）。`);
        return null;
      }
      if (signal.aborted || !result.reply) return null;
      await publish(id, thread, result.reply);
      return canDelegate && agentNames.includes(result.nextAgent) && result.nextAgent !== id ? result.nextAgent : null;
    }

    if (kind === 'compare') {
      const snapshot = store.context(thread);
      const instruction = `${request}\n請獨立回答，本輪由兩位 Agent 各自提供觀點。`;
      await Promise.allSettled(agents.map((id) => turn(id, snapshot, instruction, true, false)))
        .then((results) => {
          if (results.some(({ status }) => status === 'rejected')) log.error('部分 Slack 回覆未能送達。');
        });
      return;
    }

    let nextAgent;
    let rounds = 0;
    for (const id of agents) {
      rounds += 1;
      const anotherAlreadyScheduled = rounds < agents.length;
      const instruction = kind === 'collaborate'
        ? `${request}\n${anotherAlreadyScheduled ? '請先整理做法，另一位 Agent 會接續。' : '請接續前一位 Agent 的內容並推進任務。'}`
        : request;
      nextAgent = await turn(id, store.context(thread), instruction, kind !== 'proactive', canHandoff && !anotherAlreadyScheduled);
    }
    while (nextAgent && rounds < maxRounds && !signal.aborted) {
      rounds += 1;
      nextAgent = await turn(nextAgent, store.context(thread),
        `${request}\n收到對方交接，請針對最新的交接事項推進。`, true, rounds < maxRounds);
    }
  }

  async function pump(thread, state) {
    try {
      while (state.queue.length && !closing) {
        state.controller = new AbortController();
        try {
          await execute(state.queue.shift(), state.controller.signal);
        } catch {
          log.error('這一輪未能送達 Slack。');
        }
      }
    } finally {
      states.delete(thread);
    }
  }

  function enqueue(thread, job) {
    let state = states.get(thread);
    if (!state) {
      state = { queue: [], controller: null, running: null };
      states.set(thread, state);
      state.queue.push(job);
      state.running = Promise.resolve().then(() => pump(thread, state));
      return;
    }
    state.queue.push(job);
  }

  function notice(thread, text) {
    const pending = publish('codex', thread, text).catch(() => log.error('Slack 狀態訊息未能送達。'));
    notices.add(pending);
    pending.then(() => notices.delete(pending));
  }

  return {
    receive(event) {
      if (closing || event?.type !== 'message' || event.channel !== config.channel) return;
      if (event.channel_type && event.channel_type !== 'group') return;
      if (event.subtype === 'message_changed' || event.subtype === 'message_deleted') {
        const deleted = event.subtype === 'message_deleted';
        const message = deleted ? event.previous_message : event.message;
        if (message) remember(message, event.event_ts || event.ts, deleted);
        return;
      }
      if (event.subtype && !['bot_message', 'thread_broadcast', 'file_share'].includes(event.subtype)) return;
      const saved = remember(event);
      if (saved?.author !== 'owner' || !event.text.trim() || !store.claim(event.ts)) return;

      const { thread } = saved;
      const job = interpret(event.text, identities, store.isAuto(thread));
      if (!job) return;
      if (job.kind === 'stop') {
        store.auto(thread, false);
        const state = states.get(thread);
        if (state) {
          state.queue.length = 0;
          state.controller?.abort();
        }
        notice(thread, '已停止本串的自動接力。');
      } else if (job.kind === 'auto') {
        store.auto(thread, job.enabled);
        notice(thread, job.enabled ? '已開啟本串的自主回覆。' : '已關閉本串的自主回覆。');
      } else {
        if (job.kind === 'collaborate') store.auto(thread, true);
        enqueue(thread, { ...job, thread });
      }
    },
    async idle() {
      await Promise.all([...notices, ...[...states.values()].map((state) => state.running)]);
    },
    refreshHistory() { hydrated.clear(); },
    async close() {
      closing = true;
      for (const state of states.values()) state.controller?.abort();
      await this.idle();
    }
  };
}
