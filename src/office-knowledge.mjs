import { randomUUID } from 'node:crypto';

const states = ['pending', 'approved', 'rejected', 'archived'];
const kinds = ['memory', 'skill'];
const fault = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export function openOfficeKnowledge(db, people) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS office_knowledge (
      id TEXT PRIMARY KEY, actor TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('memory','skill')),
      title TEXT NOT NULL, body TEXT NOT NULL, keywords TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','archived')),
      sourceTaskId TEXT REFERENCES tasks(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS office_knowledge_scope ON office_knowledge(actor,status,updatedAt DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS office_knowledge_duplicate ON office_knowledge(actor,kind,title,body)
      WHERE status IN ('pending','approved');
  `);
  const byId = db.prepare('SELECT * FROM office_knowledge WHERE id=?');
  const list = db.prepare(`
    SELECT * FROM office_knowledge WHERE actor=? AND status=? ORDER BY updatedAt DESC,id LIMIT 100
  `);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO office_knowledge(id,actor,kind,title,body,keywords,status,sourceTaskId,createdAt,updatedAt)
    VALUES(?,?,?,?,?,?,'pending',?,?,?)
  `);
  const transition = db.prepare('UPDATE office_knowledge SET status=?,updatedAt=? WHERE id=? AND status=?');
  const approved = db.prepare(`
    SELECT id,kind,title,body,keywords FROM office_knowledge WHERE actor=? AND status='approved'
    ORDER BY updatedAt DESC,id LIMIT 100
  `);
  const read = row => ({ ...row, keywords: JSON.parse(row.keywords) });

  function propose(input, sourceTaskId = null) {
    const { actor, kind } = input ?? {};
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const body = typeof input?.body === 'string' ? input.body.trim() : '';
    const rawKeywords = input?.keywords ?? [];
    if (!people.has(actor) || !kinds.includes(kind) || !title || title.length > 90 || !body ||
        body.length > (kind === 'memory' ? 600 : 2400) || !Array.isArray(rawKeywords) || rawKeywords.length > 8 ||
        rawKeywords.some(word => typeof word !== 'string' || !word.trim() || word.length > 48)) {
      throw fault('請確認成員、類型、標題、內容及觸發詞。');
    }
    const keywords = [...new Set(rawKeywords.map(word => word.trim().toLowerCase()))];
    if (kind === 'skill' && !keywords.length) throw fault('技能至少需要一個觸發詞。');
    const now = new Date().toISOString();
    const id = randomUUID();
    const result = insert.run(id, actor, kind, title, body, JSON.stringify(keywords), sourceTaskId, now, now);
    if (!result.changes) throw fault('相同內容已送審或核准。', 409);
    return read(byId.get(id));
  }

  function review(id, action) {
    const moves = { approve: ['pending', 'approved'], reject: ['pending', 'rejected'], archive: ['approved', 'archived'] };
    if (!Object.hasOwn(moves, action)) throw fault('未知的審核動作。');
    const [before, after] = moves[action];
    const row = byId.get(id);
    if (!row) throw fault('這筆提案不存在。', 404);
    if (row.status === after) return read(row);
    if (row.status !== before) throw fault('這筆提案已被更新。', 409);
    transition.run(after, new Date().toISOString(), id, before);
    return read(byId.get(id));
  }

  function suggestions(input, actor, taskId) {
    if (!Array.isArray(input)) return [];
    const accepted = [];
    for (const suggestion of input.slice(0, 2)) {
      try { accepted.push(propose({ ...suggestion, actor }, taskId)); } catch (error) {
        if (!error.statusCode) throw error;
      }
    }
    return accepted;
  }

  function context(rows, text) {
    const input = text.toLowerCase();
    const memories = [], skills = [];
    let remaining = 1800;
    for (const { id, kind, title, body, keywords } of rows) {
      if (kind === 'memory' && body.length <= remaining) {
        memories.push({ id, title, body });
        remaining -= body.length;
      } else if (kind === 'skill' && skills.length < 2 && keywords.some(word => input.includes(word))) {
        skills.push({ id, title, body });
      }
    }
    return { memories, skills };
  }
  return {
    list(actor, status) {
      if (!people.has(actor) || !states.includes(status)) throw fault('請選擇成員與審核狀態。');
      return list.all(actor, status).map(read);
    },
    propose, review, suggestions, context,
    approved: actor => approved.all(actor).map(read)
  };
}
