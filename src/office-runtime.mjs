import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeOfficeModels } from './office-models.mjs';

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
    return { worker: plan.worker, assignment: plan.assignment.trim().slice(0, 3500) };
  }
  if (canAnswer && (!plan || typeof plan !== 'object' || !Object.hasOwn(plan, 'route'))) return { reply: text };
  return {};
}

export function createOfficeRuntime({ file, runAgent, artifactDir, timeoutMs = 180000, onChange = () => {} }) {
  if (typeof runAgent !== 'function') throw new TypeError('需要設定辦公室模型執行器。');
  let writer;
  let db;
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
  } catch (error) {
    db?.close();
    writer?.close();
    throw error;
  }
  const active = new Map();
  const drafts = new Map();
  let hostTail = Promise.resolve();
  let closing = false;
  let closed = false;
  const byTask = db.prepare('SELECT ' + taskColumns + ' FROM tasks WHERE id=?');
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
  function change(task, status, { author = 'system', text, workerId = task.workerId } = {}) {
    const now = new Date().toISOString();
    transaction(() => {
      db.prepare('UPDATE tasks SET status=?, workerId=?, updatedAt=? WHERE id=?').run(status, workerId, now, task.id);
      if (text) logMessage.run(task.threadId, task.id, task.manager, author, text, now);
    });
    task.status = status;
    task.workerId = workerId;
    onChange();
  }

  function context(task) {
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
        OR (m.taskId=? AND m.author!='user')
        OR (? AND t.clientId=(SELECT clientId FROM tasks WHERE id=?) AND m.author!='user')
      ) ORDER BY m.id DESC LIMIT 30
    `).all(task.threadId, task.id, task.id, Number(executionPrefix.test(task.text)), task.id);
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
    const request = command ? command[1] : task.text;
    async function turn(stage, actor, instructions, assignment) {
      signal.throwIfAborted();
      const files = artifactDir ? join(artifactDir, task.id) : undefined;
      const execute = Boolean(command && (stage === 'self' || stage === 'delegate'));
      const tools = new Map();
      const begin = (kind, label, detail = '') => {
        const now = new Date().toISOString();
        return startActivity.run(task.id, actor.id, kind, label, detail, now, now).lastInsertRowid;
      };
      const finish = (id, status, note = '') => finishActivity.run(status, new Date().toISOString(), note, id);
      const stageId = begin('stage', stageLabels[stage]);
      let outcome = 'failed';
      try {
        if (execute && files) mkdirSync(files, { recursive: true });
        const result = await runAgent({
          stage, id: manager.id, actor: actor.id,
          instructions: command ? instructions + ' 若另一位主管已先處理同一交辦，依紀錄驗證結果並接手剩餘事項，避免重複變更。' : instructions,
          request, assignment, workers, messages: context(task), threadId: task.threadId, taskId: task.id,
          model: task.model, effort: task.effort,
          execute, files, signal, timeoutMs,
          onProgress(event) {
            if (signal.aborted) return;
            if (event.type === 'text') {
              if (!event.text || (stage === 'plan' && command) || /^\s*(?:```(?:json)?\s*)?\{/.test(event.text)) {
                drafts.delete(task.id);
              } else {
                drafts.set(task.id, { taskId: task.id, actor: actor.id, text: event.text, startedAt: new Date().toISOString() });
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
        outcome = 'done';
        return result.reply.trim().slice(0, 24000);
      } finally {
        drafts.delete(task.id);
        finish(stageId, outcome);
        for (const id of tools.values()) finish(id, 'unconfirmed');
      }
    }
    const language = '以使用者的語言回覆，區分實際完成與建議的工作。';
    try {
      change(task, 'planning');
      const plan = await turn('plan', manager, [
        `你是 ${manager.name}，擔任${manager.role}。判斷自己回覆，或分派一位下屬。`,
        `團隊成員：${workers.map((w) => w.id + ' (' + w.role + ')').join('、')}。`,
        '簡單的對話自己回答，適合團隊成員的具體工作分派給對應角色。',
        '分派時只輸出 {"route":"delegate","worker":"員工 ID","assignment":"本次工作內容"}。',
        command ? '若要親自執行，只輸出 {"route":"self"}，實際操作會在下一回合開始。'
          : '若可親自用文字回答，現在就直接給使用者簡潔的 Markdown 答覆。'
      ].join('\n'));
      const delegation = decodePlan(plan, workers, !command);
      if (delegation.reply) {
        change(task, 'done', { author: manager.id, text: delegation.reply });
        return;
      }
      if (!delegation.worker) {
        change(task, 'working');
        const answer = await turn('self', manager, `你是 ${manager.name}，本次親自完成使用者的交辦。${language}`);
        change(task, 'done', { author: manager.id, text: answer });
        return;
      }
      const worker = byId.get(delegation.worker);
      change(task, 'delegated', { workerId: worker.id, author: manager.id,
        text: `交給 ${worker.name}（${worker.role}）：${delegation.assignment}` });
      const work = await turn('delegate', worker, [
        `你是 ${worker.name}，是 ${manager.name} 團隊的${worker.role}。獨立處理分派給你的部分，向主管提交具體成果。`,
        language
      ].join('\n'), delegation.assignment);
      change(task, 'reviewing', { author: worker.id, text: work });
      const review = await turn('review', manager,
        `你是 ${manager.name}。審閱 ${worker.name} 的實際回報，依照使用者原始需求整合成果，清楚說明仍待完成的項目。${language}`);
      change(task, 'done', { author: manager.id, text: review });
    } catch (error) {
      const reason = error?.publicMessage ? String(error.publicMessage).slice(0, 250)
        : (failures[error?.message] || '模型服務未完成這次請求') + '。';
      change(task, 'failed', { text: signal.aborted ? interrupted : `工作中斷：${reason}` });
    }
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
  function submitMany({ managers: selected, text, threadId, clientId, modelSettings } = {}) {
    if (closing) throw fault('服務正在關閉。', 503);
    if (!Array.isArray(selected) || !selected.length || selected.length > 2 ||
        selected.some((id) => !managers.includes(id)) || new Set(selected).size !== selected.length) {
      throw fault('請選擇 Claude、Codex 或兩位主管。', 400);
    }
    if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw fault('訊息長度須介於 1 至 8,000 字元。', 400);
    if (threadId != null && (typeof threadId !== 'string' || !threadId || threadId.length > 128)) throw fault('討論串格式錯誤。', 400);
    if (clientId != null && (typeof clientId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(clientId))) throw fault('請求識別碼格式錯誤。', 400);
    clientId ??= randomUUID();
    text = text.trim();
    const targets = managers.filter((id) => selected.includes(id));
    const settings = normalizeOfficeModels(modelSettings, targets);
    const requestFields = [targets, text, threadId ?? null];
    if (Object.keys(settings).length) requestFields.push(settings);
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
      const ids = targets.map((manager) => {
        const id = randomUUID();
        const selection = settings[manager];
        db.prepare("INSERT INTO tasks(id,clientId,threadId,manager,text,status,createdAt,updatedAt,model,effort) VALUES (?,?,?,?,?,'queued',?,?,?,?)")
          .run(id, clientId, thread, manager, text, now, now, selection?.model ?? null, selection?.effort ?? null);
        return id;
      });
      logMessage.run(thread, ids[0], targets.length === 2 ? 'both' : targets[0], 'user', text, now);
      return { threadId: thread, tasks: clientTasks.all(clientId) };
    });
    for (const target of targets) schedule(target);
    onChange();
    return result;
  }

  // Queued jobs have had no side effects; interrupted jobs need explicit resubmission.
  db.prepare("UPDATE activities SET status='unconfirmed',updatedAt=? WHERE status='running'").run(new Date().toISOString());
  for (const task of db.prepare('SELECT ' + taskColumns + " FROM tasks WHERE status NOT IN ('queued','done','failed')").all()) {
    change(task, 'failed', { text: interrupted });
  }
  for (const manager of managers) schedule(manager);

  return {
    submitMany,
    submit({manager, ...input}) { return submitMany({ ...input, managers: [manager] }).tasks[0]; },
    getTask(id) { return byTask.get(id); },
    snapshot() {
      const tasks = db.prepare('SELECT ' + taskColumns + ' FROM tasks ORDER BY rowid').all();
      const messages = db.prepare('SELECT id, threadId, taskId, manager, author, text, createdAt FROM messages ORDER BY id').all();
      const activities = db.prepare('SELECT * FROM activities ORDER BY id').all();
      const live = tasks.filter((task) => liveStates.has(task.status));
      const employees = officeStaff.map((employee) => {
        const task = live.find((task) => employee.kind === 'manager'
          ? task.manager === employee.id : task.workerId === employee.id && task.status === 'delegated');
        const status = task && employee.kind === 'worker' ? 'working' : task?.status || 'idle';
        return { ...employee, status, taskId: task?.id ?? null };
      });
      return { tasks, messages, employees, activities, drafts: [...drafts.values()] };
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
}
