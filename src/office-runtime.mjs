import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeOfficeModels } from './office-models.mjs';
import { attachmentLimit, attachmentTotalBytes } from '../office/attachment-types.js';
import { openOfficeHistory } from './office-history.mjs';
import { openOfficeKnowledge } from './office-knowledge.mjs';
import { normalizeWorkflow, openOfficeWorkflows } from './office-workflows.mjs';

const managers = ['claude', 'codex'];
export const officeStaff = [
  { id: 'claude', manager: 'claude', name: 'Claude', role: '規劃主管', kind: 'manager' },
  { id: 'codex', manager: 'codex', name: 'Codex', role: '工程主管', kind: 'manager' },
  { id: 'claude-research', manager: 'claude', name: 'Mira', role: '研究員', kind: 'worker' },
  { id: 'claude-review', manager: 'claude', name: 'Theo', role: '審閱員', kind: 'worker' },
  { id: 'codex-build', manager: 'codex', name: 'Finn', role: '工程師', kind: 'worker' },
  { id: 'codex-test', manager: 'codex', name: 'Nova', role: '測試員', kind: 'worker' }
];
const byId = new Map(officeStaff.map((member) => [member.id, member]));
const workerIds = new Set(officeStaff.filter(person => person.kind === 'worker').map(person => person.id));
const liveStates = new Set(['planning', 'working', 'delegated', 'reviewing']);
const taskColumns = 'id, threadId, manager, text, status, workerId, createdAt, updatedAt, model, effort';
const executionPrefix = /^(?:執行|execute)\s*[:：]\s*(\S[\s\S]*)$/iu;
const interrupted = '辦公室服務已中斷，這次工作未確認完成。可以在討論串中重新交辦。';
const stageLabels = { plan: '評估交辦', self: '親自處理', delegate: '執行分派任務', review: '審閱成果' };
const failures = {
  authentication: '模型登入需要更新', bad_output: '模型未提供可用的回覆',
  goose_failed: 'Goose 執行失敗', missing_goose: '找不到 Goose CLI', missing_adapter: '找不到模型轉接器',
  model_config: '模型設定無法使用', model_unavailable: '本機模型服務無法使用',
  rate_limit: '模型已達使用限制', timeout: '本次模型呼叫逾時', work_dir: '工作目錄不存在',
  output_limit: '回覆超出長度上限', approval_required: '此操作需要互動核准'
};

function fault(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function decodePlan(text, workers, canAnswer) {
  let plan;
  try {
    plan = JSON.parse(text.replace(/^```(?:json)?\s*([\s\S]+?)\s*```$/i, '$1'));
  } catch {
    return canAnswer && !/^\s*(?:```(?:json)?\s*)?\{\s*"(?:route|assignment|worker)"/i.test(text) ? { reply: text } : {};
  }
  if (plan?.route === 'delegate' && workers.some((employee) => employee.id === plan.worker) &&
      typeof plan.assignment === 'string' && plan.assignment.trim()) {
    return { steps: [{ key: '1', worker: plan.worker, assignment: plan.assignment.trim().slice(0, 1600), dependsOn: [] }] };
  }
  if (plan?.route === 'workflow') return { steps: normalizeWorkflow(plan.steps, new Set(workers.map(worker => worker.id))) };
  if (canAnswer && (!plan || typeof plan !== 'object' || !Object.hasOwn(plan, 'route'))) return { reply: text };
  return {};
}

export function createOfficeRuntime({ file, runAgent, artifactDir, timeoutMs = 180000, onChange = () => {} }) {
  if (typeof runAgent !== 'function') throw new TypeError('需要設定辦公室模型執行器。');
  let writer;
  let db;
  let history, knowledge, workflows;
  try {
    if (file !== ':memory:') {
      mkdirSync(dirname(file), { recursive: true });
      // An OS-managed SQLite lock is released even on a hard process exit. Only the
      // active owner may recover unfinished jobs and start agents for this office.
      writer = new DatabaseSync(file + '.lock');
      writer.exec('BEGIN EXCLUSIVE');
    }
    db = new DatabaseSync(file);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS requests (
        clientId TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, threadId TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, clientId TEXT NOT NULL REFERENCES requests(clientId), threadId TEXT NOT NULL,
        manager TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL, workerId TEXT,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, model TEXT, effort TEXT, UNIQUE(clientId, manager)
      );
      CREATE INDEX IF NOT EXISTS tasks_thread ON tasks(threadId);
      CREATE INDEX IF NOT EXISTS tasks_queue ON tasks(manager,status);
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY, threadId TEXT NOT NULL, taskId TEXT NOT NULL REFERENCES tasks(id),
        manager TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_thread ON messages(threadId,id);
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, clientId TEXT NOT NULL REFERENCES requests(clientId), position INTEGER NOT NULL,
        name TEXT NOT NULL, mime TEXT NOT NULL, data BLOB NOT NULL, text TEXT NOT NULL,
        visuals TEXT NOT NULL, UNIQUE(clientId,position)
      );
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), actor TEXT NOT NULL,
        kind TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL,
        startedAt TEXT NOT NULL, updatedAt TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS activities_task ON activities(taskId,id);
    `);
    const columns = new Set(db.prepare('PRAGMA table_info(tasks)').all().map(column => column.name));
    if (!columns.has('model')) db.exec('ALTER TABLE tasks ADD COLUMN model TEXT');
    if (!columns.has('effort')) db.exec('ALTER TABLE tasks ADD COLUMN effort TEXT');
    db.exec('BEGIN IMMEDIATE');
    history = openOfficeHistory(db);
    knowledge = openOfficeKnowledge(db, byId);
    workflows = openOfficeWorkflows(db);
    db.exec('COMMIT');
  } catch (error) {
    db?.close();
    writer?.close();
    throw error;
  }
  const active = new Map();
  const drafts = new Map();
  const providerTail = new Map();
  let hostTail = Promise.resolve();
  let closing = false;
  let closed = false;
  let snapshotCache, durableSnapshot;
  const byTask = db.prepare('SELECT ' + taskColumns + ' FROM tasks WHERE id=?');
  const byClient = db.prepare('SELECT clientId FROM tasks WHERE id=?');
  const updateTask = db.prepare('UPDATE tasks SET status=?, workerId=?, updatedAt=? WHERE id=?');
  const taskAttachments = db.prepare(`
    SELECT a.name,a.mime,a.data,a.text,a.visuals
    FROM attachments a JOIN requests r ON r.clientId=a.clientId
    WHERE r.threadId=? AND r.rowid<=(SELECT req.rowid FROM tasks t JOIN requests req ON req.clientId=t.clientId WHERE t.id=?)
    ORDER BY r.rowid DESC,a.position LIMIT ${attachmentLimit}
  `);
  const attachmentById = db.prepare('SELECT name,mime,data FROM attachments WHERE id=?');
  const addAttachment = db.prepare('INSERT INTO attachments(id,clientId,position,name,mime,data,text,visuals) VALUES (?,?,?,?,?,?,?,?)');
  const logMessage = db.prepare('INSERT INTO messages(threadId, taskId, manager, author, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
  const startActivity = db.prepare(`INSERT INTO activities(taskId,actor,kind,label,detail,status,startedAt,updatedAt)
    VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`);
  const finishActivity = db.prepare("UPDATE activities SET status=?,updatedAt=?,note=? WHERE id=? AND status='running'");
  function transaction(write) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = write();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function invalidate({ draftOnly = false } = {}) {
    snapshotCache = undefined;
    if (!draftOnly) durableSnapshot = undefined;
  }
  function change(task, status, { author = 'system', text, workerId = task.workerId } = {}) {
    const now = new Date().toISOString();
    transaction(() => {
      updateTask.run(status, workerId, now, task.id);
      if (text) logMessage.run(task.threadId, task.id, task.manager, author, text, now);
    });
    task.status = status;
    task.workerId = workerId;
    invalidate();
    onChange();
  }

  function withProvider(id, invoke) {
    const work = (providerTail.get(id) ?? Promise.resolve()).then(invoke);
    const settled = work.catch(() => {});
    providerTail.set(id, settled);
    settled.then(() => { if (providerTail.get(id) === settled) providerTail.delete(id); });
    return work;
  }

  function context(task, includeCurrent = true) {
    // If a follow-up was typed during a run, it belongs to the following turn.
    // A dual assignment also keeps each manager's concurrent opinion independent.
    const opening = db.prepare(`
      SELECT m.id,m.author,m.text,t.clientId=(SELECT clientId FROM tasks WHERE id=?) AS currentBatch
      FROM messages m JOIN tasks t ON m.taskId=t.id WHERE m.threadId=? AND m.author='user'
      ORDER BY m.id LIMIT 1
    `).get(task.id, task.threadId);
    const rows = db.prepare(`
      SELECT m.id,m.author,m.text FROM messages m JOIN tasks t ON m.taskId=t.id
      JOIN requests r ON t.clientId=r.clientId
      WHERE m.threadId=? AND m.author!='system' AND (
        r.rowid<(SELECT rq.rowid FROM requests rq JOIN tasks cur ON cur.clientId=rq.clientId WHERE cur.id=?)
        OR (? AND m.taskId=? AND m.author!='user')
        OR (? AND m.taskId!=? AND t.clientId=(SELECT clientId FROM tasks WHERE id=?) AND m.author!='user')
      ) ORDER BY m.id DESC LIMIT 30
    `).all(task.threadId, task.id, Number(includeCurrent), task.id, Number(executionPrefix.test(task.text)), task.id, task.id);
    let remaining = 14000;
    const result = [];
    // Include the original brief even after a long series of follow-ups, but never
    // a queued future request that happened to be entered before this call began.
    const original = opening && !opening.currentBatch ? { author: opening.author, text: opening.text.slice(0, 3500) } : null;
    if (original) remaining -= original.text.length;
    for (const { id, author, text } of rows) {
      if (remaining <= 0) break;
      if (original && id === opening.id) continue;
      const excerpt = text.slice(0, Math.min(remaining, 3500));
      remaining -= excerpt.length;
      result.unshift({ author, text: excerpt });
    }
    if (original) result.unshift(original);
    return result;
  }

  async function processTask(task, signal) {
    const manager = byId.get(task.manager);
    const workers = officeStaff.filter((person) => person.kind === 'worker' && person.manager === manager.id);
    const command = executionPrefix.exec(task.text);
    let remaining = attachmentTotalBytes;
    let visualPages = 4;
    const attachments = [];
    for (const attachment of taskAttachments.all(task.threadId, task.id)) {
      if (attachment.data.byteLength > remaining) continue;
      remaining -= attachment.data.byteLength;
      const visuals = JSON.parse(attachment.visuals).slice(0, visualPages);
      visualPages -= visuals.length;
      attachments.push({ ...attachment, visuals });
    }
    const references = history.forRequest(byClient.get(task.id).clientId);
    const request = command ? command[1] : task.text || (references.length
      ? '請閱讀本次引用的任務紀錄，並簡要說明內容。' : '請查看本次附件，並簡要說明內容。');
    const approvedKnowledge = new Map();
    function turn(stage, actor, instructions, assignment, prerequisiteResults, onBegin) {
      return withProvider(actor.manager, () => runTurn(stage, actor, instructions, assignment, prerequisiteResults, onBegin));
    }
    async function runTurn(stage, actor, instructions, assignment, prerequisiteResults, onBegin) {
      signal.throwIfAborted();
      onBegin?.();
      const files = artifactDir ? join(artifactDir, task.id) : undefined;
      const execute = Boolean(command && (stage === 'self' || stage === 'delegate'));
      const draftKey = task.id + ':' + actor.id;
      const maySuggest = stage !== 'plan' || /記住|整理成技能|remember|reusable skill/iu.test(request);
      const tools = new Map();
      const begin = (kind, label, detail = '') => {
        const now = new Date().toISOString();
        const id = startActivity.run(task.id, actor.id, kind, label, detail, now, now).lastInsertRowid;
        invalidate();
        return id;
      };
      const finish = (id, status, note = '') => {
        if (finishActivity.run(status, new Date().toISOString(), note, id).changes) invalidate();
      };
      const stageId = begin('stage', stageLabels[stage]);
      let outcome = 'failed';
      try {
        if (execute && files) mkdirSync(files, { recursive: true });
        if (!approvedKnowledge.has(actor.id)) approvedKnowledge.set(actor.id, knowledge.approved(actor.id));
        const scopedKnowledge = knowledge.context(approvedKnowledge.get(actor.id), request + '\n' + (assignment ?? ''));
        const result = await runAgent({
          stage, id: actor.manager, actor: actor.id,
          instructions: command ? instructions + ' 若另一位主管已先處理同一交辦，依紀錄驗證結果並接手剩餘事項，避免重複變更。' : instructions,
          request, assignment, workers, messages: context(task, stage !== 'delegate'), attachments, references, prerequisiteResults,
          knowledge: scopedKnowledge, maySuggest, threadId: task.threadId, taskId: task.id,
          model: actor.manager === manager.id ? task.model : undefined,
          effort: actor.manager === manager.id ? task.effort : undefined,
          execute, files, signal, timeoutMs,
          onProgress(event) {
            if (signal.aborted) return;
            if (event.type === 'text') {
              if (!event.text || (stage === 'plan' && command) || /^\s*(?:```(?:json)?\s*)?\{/.test(event.text)) {
                if (drafts.delete(draftKey)) invalidate({ draftOnly: true });
              } else {
                const startedAt = drafts.get(draftKey)?.startedAt ?? new Date().toISOString();
                drafts.set(draftKey, { taskId: task.id, actor: actor.id, text: event.text, startedAt });
                invalidate({ draftOnly: true });
              }
            } else if (event.type === 'tool') {
              if (event.status === 'running' && tools.size < 150 && !tools.has(event.id)) {
                tools.set(event.id, begin(event.kind, event.name, event.detail));
              } else if (['done', 'failed'].includes(event.status) && tools.has(event.id)) {
                finish(tools.get(event.id), event.status, event.detail);
              }
            }
          }
        });
        signal.throwIfAborted();
        if (typeof result?.reply !== 'string' || !result.reply.trim()) throw new Error('bad_output');
        if (maySuggest && result.knowledge?.length) {
          transaction(() => knowledge.suggestions(result.knowledge, actor.id, task.id));
        }
        outcome = stage === 'delegate' && result.stepStatus === 'blocked' ? 'failed' : 'done';
        return { reply: result.reply.trim().slice(0, 24000), blocked: result.stepStatus === 'blocked' };
      } finally {
        if (drafts.delete(draftKey)) invalidate({ draftOnly: true });
        finish(stageId, outcome);
        for (const id of tools.values()) finish(id, 'unconfirmed');
      }
    }
    const language = '以使用者的語言回覆，區分實際完成與建議的工作。';
    async function workStep(step, previous) {
      const worker = byId.get(step.worker);
      let started = false;
      try {
        const report = await turn('delegate', worker, [
          `你是 ${worker.name}，負責分工工序 ${step.key}。只處理交給你的事項。參考直接前置工序的成果，交付具體結果、驗證情形與阻礙。`,
          language
        ].join('\n'), step.assignment, previous, () => {
          started = transaction(() => {
            const now = new Date().toISOString();
            if (!workflows.start(task.id, step.key, now)) return false;
            logMessage.run(task.threadId, task.id, task.manager, manager.id,
              `交給 ${worker.name}（${worker.role}）：${step.assignment}`, now);
            return true;
          });
          if (!started) throw new Error('workflow_conflict');
          invalidate();
          onChange();
        });
        transaction(() => {
          const now = new Date().toISOString();
          const result = logMessage.run(task.threadId, task.id, task.manager, worker.id, report.reply, now).lastInsertRowid;
          const status = report.blocked ? 'failed' : 'done';
          if (!workflows.finish(task.id, step.key, status, result, report.blocked ? '員工回報尚有阻礙。' : '', now)) {
            throw new Error('workflow_conflict');
          }
        });
      } catch (error) {
        if (!started) throw error;
        const reason = error?.publicMessage || failures[error?.message] || '工序未完成。';
        const status = signal.aborted ? 'interrupted' : 'failed';
        workflows.finish(task.id, step.key, status, null, signal.aborted ? interrupted : reason.slice(0, 250), new Date().toISOString());
      } finally { invalidate(); onChange(); }
    }
    async function runWorkflow() {
      change(task, 'delegated');
      const running = new Map();
      try {
        for (;;) {
          signal.throwIfAborted();
          const items = workflows.steps(task.id);
          const byKey = new Map(items.map(step => [step.key, step]));
          for (const step of items) {
            if (command && running.size) break;
            if (step.status !== 'pending' || !step.dependsOn.every(key => byKey.get(key).status === 'done')) continue;
            const provider = byId.get(step.worker).manager;
            if (running.has(provider)) continue;
            const prerequisites = step.dependsOn.map(key => resultOf(byKey.get(key)));
            running.set(provider, workStep(step, prerequisites).then(() => provider));
          }
          if (running.size) {
            running.delete(await Promise.race(running.values()));
            continue;
          }
          if (items.some(step => step.status !== 'done')) {
            const reason = items.find(step => step.error)?.error;
            change(task, 'failed', { text: reason ? `分工中斷：${reason} 可從分工看板重試。` : '分工有未完成的工序，可從分工看板重試。' });
            return;
          }
          change(task, 'reviewing');
          const review = await turn('review', manager,
            `你是 ${manager.name}。依原始需求審閱已完成工序的實際回報，整合成果與驗證，指出仍待確認的項目。${language}`,
            undefined, items.map(resultOf));
          change(task, 'done', { author: manager.id, text: review.reply });
          return;
        }
      } finally {
        // Finish all launched workers before recovery or closing the database.
        await Promise.allSettled(running.values());
      }
    }
    function resultOf(step) {
      return { key: step.key, worker: step.worker, assignment: step.assignment, result: step.result?.slice(0, 2600) ?? '' };
    }
    try {
      if (workflows.has(task.id)) {
        await runWorkflow();
        return;
      }
      change(task, 'planning');
      const plan = await turn('plan', manager, [
        `你是 ${manager.name}，擔任${manager.role}。判斷自己回覆，或把工作分派給團隊。`,
        `團隊成員：${workers.map((w) => w.id + ' (' + w.role + ')').join('、')}。`,
        '簡單的對話自己回答，適合團隊成員的具體工作分派給對應角色。',
        '分派時只輸出 {"route":"delegate","worker":"員工 ID","assignment":"本次工作內容"}。',
        '有多個有明確產出或依賴的工序，可輸出 {"route":"workflow","steps":[{"key":"a","worker":"員工 ID","assignment":"本次工作","dependsOn":[]}]}。最多六個工序，只能用自己的員工，dependsOn 列出前置工序的 key，禁止循環。',
        command ? '若要親自執行，只輸出 {"route":"self"}，實際操作會在下一回合開始。'
          : '若可親自用文字回答，現在就直接給使用者簡潔的 Markdown 答覆。'
      ].join('\n'));
      const delegation = decodePlan(plan.reply, workers, !command);
      if (delegation.reply) {
        change(task, 'done', { author: manager.id, text: delegation.reply });
        return;
      }
      if (!delegation.steps) {
        change(task, 'working');
        const answer = await turn('self', manager, `你是 ${manager.name}，本次親自完成使用者的交辦。${language}`);
        change(task, 'done', { author: manager.id, text: answer.reply });
        return;
      }
      transaction(() => workflows.save(task.id, delegation.steps, new Date().toISOString()));
      await runWorkflow();
    } catch (error) {
      if (signal.aborted && workflows.has(task.id)) {
        recoverWorkflow(task);
        return;
      }
      const reason = error?.publicMessage ? String(error.publicMessage).slice(0, 250)
        : error?.statusCode === 400 ? error.message : (failures[error?.message] || '模型服務未完成這次請求') + '。';
      change(task, 'failed', { text: signal.aborted ? interrupted : `工作中斷：${reason}` });
    }
  }

  function recoverWorkflow(task) {
    const now = new Date().toISOString();
    const host = executionPrefix.test(task.text);
    transaction(() => {
      if (host) workflows.interrupted(task.id, 'interrupted', interrupted, now);
      else workflows.restore(task.id);
      const uncertain = host && workflows.steps(task.id).some(step => step.status === 'interrupted');
      updateTask.run(uncertain ? 'failed' : 'queued', null, now, task.id);
      if (uncertain) logMessage.run(task.threadId, task.id, task.manager, 'system',
        '本機工序在執行時中斷。分工看板會保留已完成的成果，請確認工作目錄後再重試。', now);
    });
    invalidate();
  }

  function schedule(manager) {
    if (closing || active.has(manager)) return;
    const controller = new AbortController();
    const promise = Promise.resolve().then(async () => {
      while (!closing) {
        const job = db.prepare('SELECT ' + taskColumns + " FROM tasks WHERE manager=? AND status='queued' ORDER BY rowid LIMIT 1").get(manager);
        if (!job) return;
        if (executionPrefix.test(job.text)) {
          // Both providers share GOOSE_WORK_DIR. A second host task must see the
          // result of the first before it begins making changes.
          const execution = hostTail.then(() => {
            if (!closing) return processTask(job, controller.signal);
          });
          hostTail = execution.catch(() => {});
          await execution;
        } else {
          await processTask(job, controller.signal);
        }
      }
    }).finally(() => {
      active.delete(manager);
      if (!closing && db.prepare("SELECT 1 FROM tasks WHERE manager=? AND status='queued' LIMIT 1").get(manager)) schedule(manager);
    });
    active.set(manager, { controller, promise });
  }

  const findClient = db.prepare('SELECT * FROM requests WHERE clientId=?');
  const clientTasks = db.prepare('SELECT ' + taskColumns + ' FROM tasks WHERE clientId=? ORDER BY rowid');
  function submitMany({ managers: selected, text, threadId, clientId, modelSettings, attachments = [],
    nativeCodexEfforts, references, workflow, availableManagers } = {}) {
    if (closing) throw fault('服務正在關閉。', 503);
    if (!Array.isArray(selected) || !selected.length || selected.length > 2 ||
        selected.some((id) => !managers.includes(id)) || new Set(selected).size !== selected.length) {
      throw fault('請選擇 Claude、Codex 或兩位主管。', 400);
    }
    const quotes = history.prepare(references);
    if (typeof text !== 'string' || (!text.trim() && !attachments.length && !quotes.length) || text.length > 8000) {
      throw fault('請輸入至多 8,000 字元、附加檔案或引用紀錄。', 400);
    }
    const steps = workflow === undefined ? null : normalizeWorkflow(workflow, workerIds);
    if (steps && (selected.length !== 1 || !text.trim())) throw fault('請指定一位審閱主管並填寫分工目標。', 400);
    if (steps && availableManagers && steps.some(step => !availableManagers[byId.get(step.worker).manager])) {
      throw fault('有工序所屬的主管尚未登入。', 503);
    }
    if (threadId != null && (typeof threadId !== 'string' || !threadId || threadId.length > 128)) throw fault('討論串格式錯誤。', 400);
    if (clientId != null && (typeof clientId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(clientId))) throw fault('請求識別碼格式錯誤。', 400);
    clientId ??= randomUUID();
    text = text.trim();
    const targets = managers.filter((id) => selected.includes(id));
    const settings = normalizeOfficeModels(modelSettings, targets, nativeCodexEfforts);
    const requestFields = [targets, text, threadId ?? null];
    if (Object.keys(settings).length) requestFields.push(settings);
    if (attachments.length) requestFields.push(attachments.map(({ name, hash }) => [name, hash]));
    if (quotes.length || steps) requestFields.push({ references: references?.map(({ id, offset }) => [id, offset]), steps });
    const fingerprint = JSON.stringify(requestFields);
    const result = transaction(() => {
      const previous = findClient.get(clientId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw fault('這個請求識別碼已用於其他訊息。', 409);
        return { threadId: previous.threadId, tasks: clientTasks.all(clientId) };
      }
      if (threadId && !db.prepare('SELECT 1 FROM tasks WHERE threadId=? LIMIT 1').get(threadId)) throw fault('找不到討論串。', 404);
      const thread = threadId || randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO requests(clientId,fingerprint,threadId) VALUES(?,?,?)').run(clientId, fingerprint, thread);
      history.save(clientId, quotes);
      attachments.forEach((file, position) => {
        addAttachment.run(randomUUID(), clientId, position, file.name, file.mime, file.data, file.text, JSON.stringify(file.visuals));
      });
      const ids = targets.map((manager) => {
        const id = randomUUID();
        const selection = settings[manager];
        db.prepare("INSERT INTO tasks(id,clientId,threadId,manager,text,status,createdAt,updatedAt,model,effort) VALUES (?,?,?,?,?,'queued',?,?,?,?)")
          .run(id, clientId, thread, manager, text, now, now, selection?.model ?? null, selection?.effort ?? null);
        return id;
      });
      logMessage.run(thread, ids[0], targets.length === 2 ? 'both' : targets[0], 'user', text, now);
      if (steps) workflows.save(ids[0], steps, now);
      return { threadId: thread, tasks: clientTasks.all(clientId) };
    });
    for (const target of targets) schedule(target);
    invalidate();
    onChange();
    return result;
  }

  function workflowTeams(taskId) {
    const task = byTask.get(taskId);
    if (!task || !workflows.has(taskId)) throw fault('找不到這份分工。', 404);
    const remaining = workflows.steps(taskId).filter(step => step.status !== 'done');
    return [...new Set([task.manager, ...remaining.map(step => byId.get(step.worker).manager)])];
  }

  function retryWorkflow(taskId) {
    if (closing) throw fault('服務正在關閉。', 503);
    workflowTeams(taskId);
    const task = transaction(() => {
      const current = byTask.get(taskId);
      if (current.status === 'queued') return current;
      if (current.status !== 'failed') throw fault('只有未完成的分工可以重試。', 409);
      workflows.retry(taskId);
      updateTask.run('queued', null, new Date().toISOString(), taskId);
      return byTask.get(taskId);
    });
    schedule(task.manager);
    invalidate();
    onChange();
    return task;
  }

  // Queued jobs have had no side effects; interrupted jobs need explicit resubmission.
  db.prepare("UPDATE activities SET status='unconfirmed',updatedAt=? WHERE status='running'").run(new Date().toISOString());
  for (const task of db.prepare('SELECT ' + taskColumns + " FROM tasks WHERE status NOT IN ('queued','done','failed')").all()) {
    if (workflows.has(task.id)) recoverWorkflow(task);
    else change(task, 'failed', { text: interrupted });
  }
  for (const manager of managers) schedule(manager);

  return {
    submitMany,
    submit({manager, ...input}) { return submitMany({ ...input, managers: [manager] }).tasks[0]; },
    getTask(id) { return byTask.get(id); },
    getAttachment(id) { return attachmentById.get(id); },
    searchHistory: history.search, listKnowledge: knowledge.list, proposeKnowledge: knowledge.propose,
    reviewKnowledge: knowledge.review, listWorkflows: workflows.board, workflowTeams, retryWorkflow,
    snapshot() {
      if (snapshotCache) return snapshotCache;
      durableSnapshot ??= readDurableSnapshot();
      snapshotCache = { ...durableSnapshot, drafts: [...drafts.values()] };
      return snapshotCache;
    },
    async idle() { while (active.size) await Promise.all([...active.values()].map(({promise}) => promise)); },
    async close() {
      closing = true;
      for (const {controller} of active.values()) controller.abort();
      await this.idle();
      if (!closed) {
        closed = true;
        db.close();
        writer?.close();
      }
    }
  };

  function readDurableSnapshot() {
    const tasks = db.prepare('SELECT ' + taskColumns +
      ', id IN (SELECT taskId FROM office_workflows) AS hasWorkflow FROM tasks ORDER BY rowid').all();
    const messages = db.prepare('SELECT m.id,m.threadId,m.taskId,m.manager,m.author,m.text,m.createdAt,t.clientId FROM messages m JOIN tasks t ON t.id=m.taskId ORDER BY m.id').all();
    const byRequest = new Map();
    for (const { clientId, ...file } of db.prepare('SELECT id,clientId,name,mime,length(data) AS size FROM attachments ORDER BY clientId,position').all()) {
      if (!byRequest.has(clientId)) byRequest.set(clientId, []);
      byRequest.get(clientId).push(file);
    }
    const referenceMap = new Map();
    for (const { clientId, ...reference } of history.all()) {
      if (!referenceMap.has(clientId)) referenceMap.set(clientId, []);
      referenceMap.get(clientId).push(reference);
    }
    const timeline = messages.map(({ clientId, ...message }) => {
      const files = message.author === 'user' && byRequest.get(clientId);
      const quotes = message.author === 'user' && referenceMap.get(clientId);
      return { ...message, ...(files && { attachments: files }), ...(quotes && { references: quotes }) };
    });
    const activities = db.prepare('SELECT * FROM activities ORDER BY id').all();
    const live = tasks.filter((task) => liveStates.has(task.status));
    const currentWorkers = new Map(workflows.running().map(step => [step.worker, step.taskId]));
    const employees = officeStaff.map((employee) => {
      const task = live.find((task) => employee.kind === 'manager'
        ? task.manager === employee.id : currentWorkers.get(employee.id) === task.id ||
          (task.workerId === employee.id && task.status === 'delegated'));
      const status = task && employee.kind === 'worker' ? 'working' : task?.status || 'idle';
      return { ...employee, status, taskId: task?.id ?? null };
    });
    return { tasks, messages: timeline, employees, activities };
  }
}
