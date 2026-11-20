import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SocketModeClient } from '@slack/socket-mode';
import { WebClient, LogLevel } from '@slack/web-api';
import { createBridge } from './bridge.mjs';
import { loadConfig } from './config.mjs';
import { runAgent } from './goose.mjs';
import { openStore } from './store.mjs';

function label(error) {
  const value = error?.data?.error || error?.code;
  return typeof value === 'string' && /^[a-z0-9_]+$/i.test(value) ? `（${value}）` : '';
}

async function start() {
  let config;
  try { config = loadConfig(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const webOptions = { timeout: 8000, retryConfig: { retries: 0 }, rejectRateLimitedCalls: true };
  const slack = {
    codex: new WebClient(config.tokens.codex, webOptions),
    claude: new WebClient(config.tokens.claude, webOptions)
  };
  const [codex, claude] = await Promise.all([slack.codex.auth.test(), slack.claude.auth.test()]);
  if (!/^[A-Z0-9]+$/.test(codex.team_id || '') || codex.team_id !== claude.team_id ||
      !codex.user_id || !claude.user_id || !codex.bot_id || !claude.bot_id || codex.user_id === claude.user_id ||
      [codex.user_id, claude.user_id].includes(config.ownerId)) {
    console.error('需要同一個 Slack workspace 內的兩個獨立 Bot，且唯一真人 ID 必須與兩者不同。');
    process.exitCode = 1;
    return;
  }

  const team = codex.team_id;
  mkdirSync(config.stateDir, { recursive: true });
  const store = openStore(join(config.stateDir, `${team}-${config.channel}.sqlite`));
  const socket = new SocketModeClient({ appToken: config.appToken, logLevel: LogLevel.ERROR });
  const bridge = createBridge({
    store, config, runAgent,
    identities: {
      codex: { userId: codex.user_id, botId: codex.bot_id },
      claude: { userId: claude.user_id, botId: claude.bot_id }
    },
    async send({ id, thread, text }) {
      const data = await slack[id].chat.postMessage({
        channel: config.channel, thread_ts: thread, text, mrkdwn: false,
        unfurl_links: false, unfurl_media: false
      });
      if (!data.ts) throw new Error('missing_message_ts');
      return data.ts;
    },
    async history(thread) {
      const { messages } = await slack.codex.conversations.replies({ channel: config.channel, ts: thread, limit: 100 });
      return messages ?? [];
    }
  });

  socket.on('slack_event', ({ type, body, ack }) => {
    try {
      if (type === 'events_api' && body?.team_id === team) bridge.receive(body.event);
    } catch {
      console.error('SQLite 收訊寫入失敗，等候 Slack 重送。');
      return;
    }
    ack().catch(() => console.error('Slack 事件確認失敗。'));
  });
  socket.on('connected', () => bridge.refreshHistory());
  socket.on('error', (error) => console.error(`Slack Socket Mode 連線錯誤${label(error)}。`));

  let ending = false;
  async function shutdown() {
    if (ending) return;
    ending = true;
    try {
      await Promise.all([bridge.close(), socket.disconnect()]);
    } finally {
      store.close();
    }
  }

  try {
    await socket.start();
    console.log('Goose Slack 橋接器已連線，等待指定私人頻道的訊息。');
  } catch (error) {
    await shutdown();
    throw error;
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => shutdown().catch(() => { process.exitCode = 1; }));
  }
}

start().catch((error) => {
  console.error(`無法啟動 Slack 橋接器${label(error)}，請確認 App 與 Bot tokens。`);
  process.exitCode = 1;
});
