import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectDir } from './config.mjs';
import { createOfficeRuntime } from './office-runtime.mjs';
import { inspectOfficeBackend, runOfficeAgent } from './office-runner.mjs';
import { openSlackHistory } from './office-slack.mjs';
import { serveOfficeFile } from './office-files.mjs';
import { officeModelCatalog } from './office-models.mjs';
import { createOfficeOnboarding } from './office-onboarding.mjs';
import { attachmentRequestBytes, readOfficeAttachments, serveOfficeAttachment } from './office-attachments.mjs';

const staticFiles = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']], ['/scene.js', ['scene.js', 'text/javascript']],
  ['/life.js', ['life.js', 'text/javascript']],
  ['/attachment-types.js', ['attachment-types.js', 'text/javascript']],
  ['/workspace-tools.js', ['workspace-tools.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']]
]);
function problem(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
async function readPayload(req, limit = 48000) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw problem(415, '請使用 JSON 交辦任務。');
  if (Number(req.headers['content-length']) > limit) throw problem(413, '訊息或附件過大。');
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > limit) throw problem(413, '訊息或附件過大。');
    parts.push(part);
  }
  try {
    const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw problem(400, '訊息格式錯誤。'); }
}

export function createOfficeServer({ runtime, backend, onboarding, slackHistory, artifactDir }) {
  const stateNamespace = randomUUID();
  let stateRevision = 0, stateCache;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const { host, origin } = req.headers;
      const port = req.socket.localPort;
      if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(host) || (origin && origin !== 'http://' + host)) throw problem(403, '僅接受本機辦公室的請求。');
      const { pathname: path, searchParams } = new URL(req.url, 'http://' + host);
      const setupAction = req.method === 'POST' && /^\/api\/connections\/setup\/(start|cancel)$/.exec(path)?.[1];
      const checkLogin = req.method === 'POST' && path === '/api/connections/check';
      if (checkLogin || setupAction) {
        if (origin !== 'http://' + host) throw problem(403, '請從本機辦公室頁面操作登入設定。');
        await readPayload(req);
      }
      if (setupAction) {
        if (!onboarding) throw problem(404, '這個本機服務尚未提供自動設定。');
        const setup = setupAction === 'start' ? onboarding.start() : onboarding.cancel();
        return respond(res, 202, { onboarding: setup });
      }
      if (checkLogin || (req.method === 'GET' && path === '/api/state')) {
        const status = await backend({ force: checkLogin });
        const office = runtime.snapshot();
        const setup = onboarding?.snapshot();
        const slack = slackHistory.read();
        const modelCatalog = officeModelCatalog(status.nativeCodexEfforts);
        const catalogKey = JSON.stringify(modelCatalog);
        if (!stateCache || stateCache.office !== office || stateCache.backend !== status ||
            stateCache.setup !== setup || stateCache.slack !== slack || stateCache.catalogKey !== catalogKey) {
          stateCache = {
            office, backend: status, setup, slack, catalogKey,
            etag: `"${stateNamespace}-${++stateRevision}"`,
            body: JSON.stringify({ ...office, backend: status, onboarding: setup, slackThreads: slack, modelCatalog })
          };
        }
        res.setHeader('ETag', stateCache.etag);
        if (!checkLogin && req.headers['if-none-match'] === stateCache.etag) {
          res.writeHead(304);
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(stateCache.body);
      }
      if (req.method === 'GET' && path === '/api/history/search') {
        return respond(res, 200, { results: runtime.searchHistory(searchParams.get('q')) });
      }
      if (req.method === 'GET' && path === '/api/knowledge') {
        const actor = searchParams.get('actor') || 'claude';
        const status = searchParams.get('status') || 'pending';
        return respond(res, 200, { entries: runtime.listKnowledge(actor, status) });
      }
      if (req.method === 'GET' && path === '/api/workflows') {
        return respond(res, 200, { workflows: runtime.listWorkflows(searchParams.get('thread')) });
      }
      const review = /^\/api\/knowledge\/([a-f\d-]{36})\/(approve|reject|archive)$/.exec(path);
      const retry = /^\/api\/workflows\/([a-f\d-]{36})\/retry$/.exec(path);
      if (req.method === 'POST' && (path === '/api/knowledge' || review || retry)) {
        if (origin !== 'http://' + host) throw problem(403, '請從本機辦公室頁面操作。');
        const body = await readPayload(req);
        if (review) return respond(res, 200, { entry: runtime.reviewKnowledge(review[1], review[2]) });
        if (!retry) return respond(res, 201, { entry: runtime.proposeKnowledge(body) });
        const teams = runtime.workflowTeams(retry[1]);
        const config = await backend();
        if (teams.some(id => !config.managers[id])) throw problem(503, '有工序所屬的主管尚未登入。');
        return respond(res, 202, { task: runtime.retryWorkflow(retry[1]) });
      }
      if (req.method === 'GET' && (staticFiles.has(path) || path === '/markdown-it.js')) {
        const [file, type] = staticFiles.get(path) || ['../node_modules/markdown-it/dist/markdown-it.min.js', 'text/javascript'];
        const content = await readFile(join(projectDir, 'office', file));
        res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
        return res.end(content);
      }
      const artifact = path.match(/^\/api\/tasks\/([a-z\d-]{36})\/files\/([^/]+)$/);
      if (artifact && ['GET', 'HEAD'].includes(req.method) &&
        await serveOfficeFile(req, res, artifactDir, artifact[1], artifact[2], runtime.getTask(artifact[1]))) return;
      const attachment = path.match(/^\/api\/attachments\/([a-f\d-]{36})$/);
      if (attachment && ['GET', 'HEAD'].includes(req.method)) {
        const file = runtime.getAttachment?.(attachment[1]);
        if (file) return serveOfficeAttachment(req, res, file, req.url.endsWith('?download=1'));
      }
      const follow = path.match(/^\/api\/tasks\/([A-Za-z0-9_-]{1,100})\/messages$/);
      if (req.method === 'POST' && (path === '/api/tasks' || follow)) {
        const body = await readPayload(req, attachmentRequestBytes);
        if (!Array.isArray(body.managers) || body.managers.length < 1 || body.managers.length > 2 ||
          body.managers.some(id => !['claude', 'codex'].includes(id))) throw problem(400, '請選擇主管。');
        if (typeof body.text !== 'string' || body.text.length > 8000) throw problem(400, '任務訊息最多 8,000 字。');
        const config = await backend();
        if (!config.ready || body.managers.some(id => !config.managers[id])) throw problem(503, config.detail || '主管的訂閱登入尚未就緒。');
        let threadId;
        if (follow) {
          const task = runtime.getTask(follow[1]);
          if (!task) throw problem(404, '找不到這個任務。');
          threadId = task.threadId;
        }
        const result = runtime.submitMany({
          managers: body.managers, text: body.text, threadId, clientId: body.clientId, modelSettings: body.modelSettings,
          nativeCodexEfforts: config.nativeCodexEfforts,
          references: body.references, workflow: body.workflow, availableManagers: config.managers,
          attachments: await readOfficeAttachments(body.attachments)
        });
        return respond(res, 202, result);
      }
      throw problem(404, '找不到這個頁面。');
    } catch (error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
      if (status === 500) console.error('office request failed:', error.code || error.name);
      if (!res.headersSent) respond(res, status, { error: status === 500 ? '辦公室暫時無法處理請求。' : error.message });
      else res.end();
    }
  });
}

async function start() {
  const port = Number(process.env.OFFICE_PORT || 4178);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('OFFICE_PORT 必須是有效的連接埠。');
  const dir = resolve(projectDir, process.env.STATE_DIR || '.data');
  const artifactDir = join(dir, 'office-files');
  const seconds = Number(process.env.GOOSE_TURN_TIMEOUT_SECONDS || 180);
  if (!(seconds >= 10 && seconds <= 900)) throw new Error('請檢查 GOOSE_TURN_TIMEOUT_SECONDS。');
  mkdirSync(dir, { recursive: true });
  const history = openSlackHistory(dir, process.env.SLACK_CHANNEL_ID);
  let status, pendingCheck, checkedAt = 0;
  const backend = ({ force = false } = {}) => {
    if (pendingCheck) return pendingCheck;
    if (!force && status && Date.now() - checkedAt < 120000) return status;
    pendingCheck = inspectOfficeBackend().then(result => {
      status = result;
      checkedAt = Date.now();
      return status;
    }).finally(() => { pendingCheck = undefined; });
    return pendingCheck;
  };
  const onboarding = createOfficeOnboarding({
    async check() {
      if (pendingCheck) await pendingCheck;
      return backend({ force: true });
    }
  });
  // Reserve the listening address before starting durable queue recovery.
  let runtime;
  const server = createOfficeServer({ runtime: {
    snapshot: () => runtime.snapshot(), getTask: id => runtime.getTask(id),
    getAttachment: id => runtime.getAttachment(id), submitMany: spec => runtime.submitMany(spec),
    searchHistory: query => runtime.searchHistory(query), listKnowledge: (...args) => runtime.listKnowledge(...args),
    proposeKnowledge: input => runtime.proposeKnowledge(input), reviewKnowledge: (...args) => runtime.reviewKnowledge(...args),
    listWorkflows: thread => runtime.listWorkflows(thread), workflowTeams: id => runtime.workflowTeams(id),
    retryWorkflow: id => runtime.retryWorkflow(id)
  }, backend, onboarding, slackHistory: history, artifactDir });
  await new Promise((ok, fail) => server.once('error', fail).listen(port, '127.0.0.1', ok));
  try {
    runtime = createOfficeRuntime({ file: join(dir, 'office.sqlite'), runAgent: runOfficeAgent, timeoutMs: seconds * 1000, artifactDir });
  } catch (error) { server.close(); throw error; }
  backend();
  console.log(`Goose 數位辦公室 http://127.0.0.1:${port}/`);
  const shutdown = async () => { server.close(); await onboarding.close(); await runtime.close(); history.close(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  start().catch(error => { console.error(error.message); process.exitCode = 1; });
}
