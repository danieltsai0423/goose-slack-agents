const maxSteps = 6;
const invalid = message => Object.assign(new Error(message), { statusCode: 400 });

export function normalizeWorkflow(input, allowedWorkers) {
  if (!Array.isArray(input) || !input.length || input.length > maxSteps) {
    throw invalid('分工需要 1 至 6 個工序。');
  }
  const keys = new Set();
  const steps = input.map(item => {
    const { key, worker, dependsOn = [] } = item ?? {};
    const assignment = typeof item?.assignment === 'string' ? item.assignment.trim() : '';
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,24}$/.test(key) || keys.has(key) ||
        !allowedWorkers.has(worker) || !assignment || assignment.length > 1600 ||
        !Array.isArray(dependsOn) || dependsOn.length >= maxSteps ||
        dependsOn.some(parent => typeof parent !== 'string') || new Set(dependsOn).size !== dependsOn.length) {
      throw invalid('請確認工序編號、負責人、工作說明和依賴。');
    }
    keys.add(key);
    return { key, worker, assignment, dependsOn };
  });
  if (steps.some(step => step.dependsOn.some(key => !keys.has(key)))) throw invalid('依賴的工序不存在。');
  const ordered = new Set();
  while (ordered.size < steps.length) {
    const ready = steps.filter(step => !ordered.has(step.key) && step.dependsOn.every(key => ordered.has(key)));
    if (!ready.length) throw invalid('工序不能循環依賴。');
    for (const step of ready) ordered.add(step.key);
  }
  return steps;
}

export function openOfficeWorkflows(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS office_workflows (
      taskId TEXT PRIMARY KEY REFERENCES tasks(id), createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS office_workflows_created ON office_workflows(createdAt DESC);
    CREATE TABLE IF NOT EXISTS office_workflow_steps (
      taskId TEXT NOT NULL REFERENCES office_workflows(taskId), key TEXT NOT NULL, position INTEGER NOT NULL,
      worker TEXT NOT NULL, assignment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed','interrupted')),
      resultId INTEGER REFERENCES messages(id), error TEXT NOT NULL DEFAULT '', startedAt TEXT, finishedAt TEXT,
      PRIMARY KEY(taskId,key), UNIQUE(taskId,position)
    );
    CREATE TABLE IF NOT EXISTS office_workflow_edges (
      taskId TEXT NOT NULL, step TEXT NOT NULL, prerequisite TEXT NOT NULL,
      PRIMARY KEY(taskId,step,prerequisite),
      FOREIGN KEY(taskId,step) REFERENCES office_workflow_steps(taskId,key),
      FOREIGN KEY(taskId,prerequisite) REFERENCES office_workflow_steps(taskId,key)
    );
  `);
  const exists = db.prepare('SELECT 1 FROM office_workflows WHERE taskId=?');
  const newWorkflow = db.prepare('INSERT INTO office_workflows VALUES(?,?)');
  const newStep = db.prepare('INSERT INTO office_workflow_steps(taskId,key,position,worker,assignment) VALUES(?,?,?,?,?)');
  const newEdge = db.prepare('INSERT INTO office_workflow_edges VALUES(?,?,?)');
  const start = db.prepare(`
    UPDATE office_workflow_steps SET status='running',startedAt=?
    WHERE taskId=? AND key=? AND status='pending' AND NOT EXISTS (
      SELECT 1 FROM office_workflow_edges e
      JOIN office_workflow_steps parent ON parent.taskId=e.taskId AND parent.key=e.prerequisite
      WHERE e.taskId=office_workflow_steps.taskId AND e.step=office_workflow_steps.key AND parent.status!='done'
    )
  `);
  const finish = db.prepare(`
    UPDATE office_workflow_steps SET status=?,resultId=?,error=?,finishedAt=? WHERE taskId=? AND key=? AND status='running'
  `);
  const clearFailures = db.prepare(`
    UPDATE office_workflow_steps SET status='pending',resultId=NULL,error='',startedAt=NULL,finishedAt=NULL
    WHERE taskId=? AND status IN ('failed','interrupted')
  `);
  const interrupt = db.prepare(`
    UPDATE office_workflow_steps SET status=?,error=?,finishedAt=? WHERE taskId=? AND status='running'
  `);
  const restore = db.prepare(`
    UPDATE office_workflow_steps SET status='pending',error='',startedAt=NULL,finishedAt=NULL
    WHERE taskId=? AND status IN ('running','interrupted')
  `);
  const stepColumns = `
    s.taskId,s.key,s.worker,s.assignment,s.status,s.error,s.startedAt,s.finishedAt,
      m.text AS result,
      (SELECT json_group_array(e.prerequisite) FROM office_workflow_edges e
       WHERE e.taskId=s.taskId AND e.step=s.key) AS dependencies`;
  const selectSteps = db.prepare(`
    SELECT ${stepColumns} FROM office_workflow_steps s LEFT JOIN messages m ON m.id=s.resultId
    WHERE s.taskId=? ORDER BY s.position
  `);
  const selectBoardSteps = db.prepare(`
    SELECT ${stepColumns} FROM office_workflow_steps s LEFT JOIN messages m ON m.id=s.resultId
    WHERE s.taskId IN (SELECT value FROM json_each(?)) ORDER BY s.taskId,s.position
  `);
  const columns = 't.id,t.threadId,t.manager,t.text,t.status,t.updatedAt';
  const list = db.prepare(`
    SELECT ${columns} FROM office_workflows w JOIN tasks t ON t.id=w.taskId ORDER BY w.createdAt DESC LIMIT 36
  `);
  const listThread = db.prepare(`
    SELECT ${columns} FROM tasks t JOIN office_workflows w ON w.taskId=t.id
    WHERE t.threadId=? ORDER BY w.createdAt DESC LIMIT 36
  `);
  const activeWorkers = db.prepare("SELECT taskId,worker FROM office_workflow_steps WHERE status='running'");

  const unpack = ({ taskId, dependencies, ...step }) => ({ ...step, dependsOn: JSON.parse(dependencies) });
  const steps = taskId => selectSteps.all(taskId).map(unpack);

  function display(row, items) {
    const byKey = new Map(items.map(item => [item.key, item]));
    const blocked = new Set(items.filter(item => ['failed', 'interrupted'].includes(item.status)).map(item => item.key));
    for (let i = 0; i < items.length; i++) {
      for (const step of items) if (step.dependsOn.some(key => blocked.has(key))) blocked.add(step.key);
    }
    return { ...row, steps: items.map(({ result, ...step }) => ({
      ...step, result: result?.slice(0, 1800) ?? '',
      status: step.status !== 'pending' ? step.status : blocked.has(step.key) ? 'blocked'
        : step.dependsOn.every(key => byKey.get(key)?.status === 'done') ? 'ready' : 'waiting'
    })) };
  }
  return {
    has: id => Boolean(exists.get(id)), steps,
    save(id, items, now) {
      newWorkflow.run(id, now);
      items.forEach((step, position) => newStep.run(id, step.key, position, step.worker, step.assignment));
      for (const step of items) for (const parent of step.dependsOn) newEdge.run(id, step.key, parent);
    },
    start(id, key, now) { return start.run(now, id, key).changes > 0; },
    finish(id, key, state, result, error, now) { return finish.run(state, result, error, now, id, key).changes > 0; },
    retry: id => clearFailures.run(id),
    restore: id => restore.run(id),
    interrupted(id, state, reason, now) { return interrupt.run(state, reason, now, id).changes; },
    board(thread) {
      const rows = thread ? listThread.all(thread) : list.all();
      if (!rows.length) return [];
      const grouped = new Map(rows.map(row => [row.id, []]));
      const ids = JSON.stringify(rows.map(row => row.id));
      for (const step of selectBoardSteps.all(ids)) grouped.get(step.taskId).push(unpack(step));
      return rows.map(row => display(row, grouped.get(row.id)));
    },
    running: () => activeWorkers.all()
  };
}
