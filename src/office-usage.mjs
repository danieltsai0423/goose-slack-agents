import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { prepareAgent } from './goose.mjs';
import { getOfficeClaudeBin, readClaudeSubscription } from './office-auth.mjs';
import { readNativeCodexLimits } from './office-codex.mjs';

function windowUsage(label, used, reset) {
  if (!Number.isFinite(used) || used < 0) return null;
  return { label, used, resetsAt: Number.isFinite(reset) ? reset : null };
}

export function claudeUsage({ rate_limits_available, rate_limits } = {}) {
  if (!rate_limits_available || !rate_limits) return [];
  const rows = [
    ['5 小時額度', rate_limits.five_hour],
    ['每週額度 · 所有模型', rate_limits.seven_day]
  ];
  const models = Array.isArray(rate_limits.model_scoped) ? rate_limits.model_scoped.slice(0, 6) : [];
  if (models.length) {
    for (const model of models) {
      if (typeof model?.display_name === 'string' && model.display_name.trim()) {
        rows.push(['每週額度 · ' + model.display_name.trim().slice(0, 50), model]);
      }
    }
  } else {
    rows.push(['每週額度 · Opus', rate_limits.seven_day_opus], ['每週額度 · Sonnet', rate_limits.seven_day_sonnet]);
  }
  return rows.map(([label, data]) => windowUsage(label, data?.utilization, Date.parse(data?.resets_at))).filter(Boolean);
}

function windowLabel(minutes) {
  if (minutes === 10080) return '每週額度';
  if (minutes > 0 && minutes % 1440 === 0) return `${minutes / 1440} 天額度`;
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60} 小時額度`;
  if (minutes > 0) return `${minutes} 分鐘額度`;
  return '額度';
}

export function codexUsage({ rateLimits, rateLimitsByLimitId } = {}) {
  const pools = new Map(Object.entries(rateLimitsByLimitId ?? {}));
  if (rateLimits && !pools.has(rateLimits.limitId ?? 'codex')) pools.set(rateLimits.limitId ?? 'codex', rateLimits);
  const ordered = [...pools].sort(([a], [b]) => Number(b === 'codex') - Number(a === 'codex'));
  return ordered.slice(0, 4).flatMap(([id, pool]) => [pool?.primary, pool?.secondary].map(data => {
    const name = typeof pool?.limitName === 'string' && pool.limitName.trim() ? pool.limitName.trim() : id;
    const suffix = id === 'codex' ? '' : ' · ' + name.slice(0, 50);
    const reset = Number.isFinite(data?.resetsAt) ? data.resetsAt * 1000 : null;
    return windowUsage(windowLabel(data?.windowDurationMins) + suffix, data?.usedPercent, reset);
  })).filter(Boolean);
}

async function readClaudeUsage() {
  const binary = await getOfficeClaudeBin();
  const options = prepareAgent('claude');
  const subscription = await readClaudeSubscription(binary, options);
  if (!subscription) return { status: 'login' };
  const requireAdapter = createRequire(import.meta.resolve('@agentclientprotocol/claude-agent-acp'));
  const sdk = pathToFileURL(requireAdapter.resolve('@anthropic-ai/claude-agent-sdk'));
  const { query } = await import(sdk);
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), 10000);
  const hold = Promise.withResolvers();
  let session;
  try {
    // Keep the control channel open without putting a prompt on the wire.
    session = query({ prompt: (async function* () { await hold.promise; })(), options: {
      ...options, pathToClaudeCodeExecutable: binary, abortController, persistSession: false,
      settingSources: [], strictMcpConfig: true, mcpServers: {}, tools: [], settings: { disableAllHooks: true }
    } });
    const usage = await session.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET();
    return { plan: usage?.subscription_type ?? subscription.plan, windows: claudeUsage(usage) };
  } finally {
    clearTimeout(timer);
    hold.resolve();
    session?.close();
  }
}

async function readCodexUsage() {
  const response = await readNativeCodexLimits(prepareAgent('codex'));
  return response ? { plan: response.plan, windows: codexUsage(response.result) } : { status: 'login' };
}

export function createOfficeUsage({ readers = { claude: readClaudeUsage, codex: readCodexUsage }, now = Date.now } = {}) {
  const cache = new Map();
  return {
    read(id, refresh = false) {
      const cached = cache.get(id);
      if (cached?.pending) return cached.pending;
      if (cached?.expiresAt > now() && (!refresh || cached.value.checkedAt + 10000 > now())) return cached.value;
      const entry = { pending: Promise.resolve().then(readers[id]).then(result => {
        const status = result.status ?? (result.windows?.length ? 'ready' : 'unavailable');
        const plan = typeof result.plan === 'string' && /^[\w -]{1,32}$/.test(result.plan) ? result.plan : null;
        return { status, plan, windows: result.windows ?? [], checkedAt: now() };
      }).catch(() => ({ status: 'unavailable', plan: null, windows: [], checkedAt: now() })).then(value => {
        entry.value = value;
        entry.expiresAt = value.checkedAt + (value.status === 'ready' ? 60000 : 20000);
        entry.pending = null;
        return value;
      }) };
      cache.set(id, entry);
      return entry.pending;
    },
    clear() { cache.clear(); }
  };
}
