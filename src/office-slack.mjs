import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Read the bridge's durable local mirror. Opening the office never connects to Slack.
export function openSlackHistory(dir, channel) {
  let db, threads, replies;
  function connect() {
    if (!/^[CG][A-Z0-9]+$/.test(channel || '')) return false;
    const matches = readdirSync(dir).filter(f => /^T[A-Z0-9]+-[CG][A-Z0-9]+\.sqlite$/.test(f) && f.endsWith(`-${channel}.sqlite`));
    if (matches.length !== 1) return false;
    db = new DatabaseSync(join(dir, matches[0]), { readOnly: true, timeout: 1000 });
    threads = db.prepare('SELECT thread, MAX(revision) AS latest FROM messages WHERE text IS NOT NULL GROUP BY thread ORDER BY latest DESC LIMIT 30');
    replies = db.prepare(`SELECT ts,author,text FROM messages WHERE thread=? AND text IS NOT NULL AND
      (ts=? OR ts IN (SELECT ts FROM messages WHERE thread=? AND text IS NOT NULL ORDER BY ts DESC LIMIT 40)) ORDER BY ts`);
    return true;
  }
  const iso = ts => new Date(Number(ts) * 1000).toISOString();
  let cached = [], checked = 0;
  return {
    read() {
      if (Date.now() - checked < 3500) return cached;
      checked = Date.now();
      try {
        if (!db && !connect()) return [];
        cached = threads.all().map(({ thread, latest }) => {
          const messages = replies.all(thread, thread, thread).map(({ ts, author, text }) => ({
            id: ts, author: author === 'owner' ? 'user' : author, text, createdAt: iso(ts)
          }));
          return { id: 'slack-' + thread, text: messages[0]?.text || '', updatedAt: iso(latest), messages };
        });
      } catch { this.close(); }
      return cached;
    },
    close() { if (db) db.close(); db = null; }
  };
}
