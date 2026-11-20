import { DatabaseSync } from 'node:sqlite';

export function openStore(file) {
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS messages (
      ts TEXT PRIMARY KEY, thread TEXT NOT NULL, author TEXT NOT NULL,
      text TEXT, revision TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_thread ON messages (thread, ts);
    CREATE TABLE IF NOT EXISTS threads (
      ts TEXT PRIMARY KEY, auto INTEGER NOT NULL CHECK (auto IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS handled (
      ts TEXT PRIMARY KEY
    );
  `);

  const putMessage = db.prepare(`
    INSERT INTO messages (ts, thread, author, text, revision) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (ts) DO UPDATE SET thread = excluded.thread, author = excluded.author,
      text = excluded.text, revision = excluded.revision
    WHERE excluded.revision > messages.revision
  `);
  const takeTrigger = db.prepare('INSERT OR IGNORE INTO handled (ts) VALUES (?)');
  const getAuto = db.prepare('SELECT auto FROM threads WHERE ts = ?');
  const setAuto = db.prepare(`
    INSERT INTO threads (ts, auto) VALUES (?, ?)
    ON CONFLICT (ts) DO UPDATE SET auto = excluded.auto
  `);
  const recent = db.prepare(`
    SELECT ts, author, text FROM messages
    WHERE thread = ? AND ts != ? AND text IS NOT NULL ORDER BY ts DESC LIMIT 30
  `);
  const root = db.prepare('SELECT ts, author, text FROM messages WHERE ts = ? AND text IS NOT NULL');

  return {
    record({ ts, thread, author, text, revision = ts }) {
      putMessage.run(ts, thread, author, text, revision);
    },
    claim(ts) {
      return takeTrigger.run(ts).changes === 1;
    },
    isAuto(thread) {
      return getAuto.get(thread)?.auto === 1;
    },
    auto(thread, value) {
      setAuto.run(thread, Number(value));
    },
    context(thread) {
      const first = root.get(thread);
      const messages = [];
      let remaining = 18000;
      for (const message of recent.all(thread, thread)) {
        if (!remaining) break;
        const text = message.text.slice(0, Math.min(remaining, 3500));
        remaining -= text.length;
        messages.push({ ...message, text });
      }
      messages.reverse();
      if (first) messages.unshift({ ...first, text: first.text.slice(0, 3500) });
      return messages;
    },
    close() {
      db.close();
    }
  };
}
