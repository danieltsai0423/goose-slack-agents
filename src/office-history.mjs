const quoteLimit = 1400;

function badInput(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function openOfficeHistory(db) {
  const existing = db.prepare("SELECT 1 FROM sqlite_master WHERE name='office_message_search'").get();
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS office_message_search USING fts5(
      text, content='messages', content_rowid='id', tokenize='trigram'
    );
    CREATE TRIGGER IF NOT EXISTS office_message_insert AFTER INSERT ON messages BEGIN
      INSERT INTO office_message_search(rowid,text) VALUES(new.id,new.text);
    END;
    CREATE TRIGGER IF NOT EXISTS office_message_remove AFTER DELETE ON messages BEGIN
      INSERT INTO office_message_search(office_message_search,rowid,text) VALUES('delete',old.id,old.text);
    END;
    CREATE TRIGGER IF NOT EXISTS office_message_update AFTER UPDATE OF text ON messages BEGIN
      INSERT INTO office_message_search(office_message_search,rowid,text) VALUES('delete',old.id,old.text);
      INSERT INTO office_message_search(rowid,text) VALUES(new.id,new.text);
    END;
    CREATE TABLE IF NOT EXISTS office_references (
      clientId TEXT NOT NULL REFERENCES requests(clientId), position INTEGER NOT NULL,
      sourceId INTEGER NOT NULL, sourceThread TEXT NOT NULL, author TEXT NOT NULL, excerpt TEXT NOT NULL,
      PRIMARY KEY(clientId,position)
    );
  `);
  if (!existing) db.exec("INSERT INTO office_message_search(office_message_search) VALUES('rebuild')");
  const columns = 'm.id,m.threadId,m.author,m.text,m.createdAt';
  const recent = db.prepare(`
    SELECT ${columns} FROM messages m WHERE m.author!='system' AND m.text!=''
    ORDER BY m.id DESC LIMIT 24
  `);
  const indexed = db.prepare(`
    SELECT ${columns} FROM office_message_search s JOIN messages m ON m.id=s.rowid
    WHERE office_message_search MATCH ? AND m.author!='system'
    ORDER BY rank, m.id DESC LIMIT 24
  `);
  const short = db.prepare(`
    SELECT ${columns} FROM messages m WHERE m.author!='system' AND instr(lower(m.text),lower(?))>0
    ORDER BY m.id DESC LIMIT 24
  `);
  const source = db.prepare(`SELECT ${columns} FROM messages m WHERE m.id=? AND m.author!='system'`);
  const insert = db.prepare('INSERT INTO office_references VALUES(?,?,?,?,?,?)');
  const forRequest = db.prepare('SELECT sourceId,sourceThread,author,excerpt FROM office_references WHERE clientId=? ORDER BY position');
  const allReferences = db.prepare('SELECT clientId,sourceId,sourceThread,author,excerpt FROM office_references ORDER BY clientId,position');

  function search(input) {
    const query = String(input ?? '').trim().slice(0, 120).replaceAll('\0', '');
    const rows = !query ? recent.all() : [...query].length < 3
      ? short.all(query) : indexed.all('"' + query.replaceAll('"', '""') + '"');
    return rows.map(({ text, ...row }) => {
      const hit = query ? text.toLowerCase().indexOf(query.toLowerCase()) : 0;
      const offset = Math.max(0, hit - 160);
      return { ...row, offset, excerpt: text.slice(offset, offset + quoteLimit), clipped: offset > 0 || offset + quoteLimit < text.length };
    });
  }

  function prepare(input = []) {
    if (!Array.isArray(input) || input.length > 4) throw badInput('一次最多引用 4 則紀錄。');
    const seen = new Set();
    return input.map(item => {
      if (!Number.isSafeInteger(item?.id) || !Number.isSafeInteger(item.offset) || item.offset < 0 || seen.has(item.id)) {
        throw badInput('引用格式錯誤或重複。');
      }
      seen.add(item.id);
      const row = source.get(item.id);
      if (!row || item.offset >= row.text.length) throw badInput('找不到這則可引用的任務紀錄。');
      return {
        sourceId: row.id, sourceThread: row.threadId, author: row.author,
        excerpt: row.text.slice(item.offset, item.offset + quoteLimit)
      };
    });
  }
  return {
    search, prepare,
    save(clientId, rows) { rows.forEach((row, index) => insert.run(clientId, index, row.sourceId, row.sourceThread, row.author, row.excerpt)); },
    forRequest: id => forRequest.all(id),
    all: () => allReferences.all()
  };
}
