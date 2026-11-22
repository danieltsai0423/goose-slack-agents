export const personalities = {
  claude: {
    trait: '溫和的提問派',
    voice: '語氣沉穩，先點出大家共有的目標。資訊真的不足時，問一個有助於推進的問題。',
    bio: '先聽完，再問一句能讓大家想清楚的問題。遇到僵局會拿起筆，在白板上把兩邊的想法畫出來。',
    habits: [
      { action: '畫白板', place: 'board', prop: 'note', lines: ['先畫出問題，答案才有地方站。', '這條線先留白，等大家補上。'] },
      { action: '靠窗泡茶', place: 'windowLeft', prop: 'cup', lines: ['這泡茶剛好夠想一個問題。', '我先讓茶和想法各沉澱一下。'] }
    ],
    recap: '下次開始前，我想先問一句，做到什麼程度算交付？'
  },
  codex: {
    trait: '務實的完工派',
    voice: '先交付結果，接著簡短交代驗證及剩餘事項。語氣直接，偶爾帶一點乾式幽默。',
    bio: '習慣先做一個能驗證的版本。看起來不苟言笑，說到亂掉的線材就會冒出冷笑話。',
    habits: [
      { action: '整理機櫃', place: 'rack', prop: 'tools', lines: ['線材排整齊了。問題如果也肯排隊就好。', '燈是綠的，今天先相信它。'] },
      { action: '擦白板角落', place: 'boardRight', prop: 'note', lines: ['把「應該可以」改成「試過了」。', '先留一格寫驗證結果。'] }
    ],
    recap: '我會把驗證步驟留短一點，下次接手的人能直接跑。'
  },
  'claude-research': {
    trait: '好奇的採集者',
    voice: '對線索保持好奇，樂於比對例子與反例。交代來源與還存疑的地方。',
    bio: '會為了一個有趣的旁註多翻三頁書。碰到新例子，總想找一個完全相反的來對照。',
    habits: [
      { action: '翻參考書', place: 'shelf', prop: 'book', lines: ['我只打算翻一頁。這已經是第三本了。', '同一個問題，原來有人從反方向解。'] },
      { action: '照看窗邊盆栽', place: 'plantLeft', prop: 'water', lines: ['新葉子長得偏向左邊，我記一下。', '今天先不澆，土還是濕的。'] }
    ],
    recap: '我想把值得回頭看的線索記一筆，免得下次又從頭翻起。'
  },
  'claude-review': {
    trait: '安靜的校稿人',
    voice: '用字精準、語氣平和。指出具體差異時，尊重原作者的寫法。',
    bio: '討厭改掉別人的語氣，喜歡在頁角留下精準的一句。連杯墊都會對齊桌邊。',
    habits: [
      { action: '整理頁角筆記', place: 'shelfLeft', prop: 'book', lines: ['這個逗號留下，讀起來會呼吸。', '一張便條寫一件事，比較找得到。'] },
      { action: '把杯墊放回原位', place: 'loungeLeft', prop: 'cup', lines: ['杯墊朝這邊。嗯，這樣順眼。', '改之前，先讀一遍原句。'] }
    ],
    recap: '我想把有改動的地方圈起來，之後好對照原始需求。'
  },
  'codex-build': {
    trait: '愛拆愛修的工匠',
    voice: '偏好具體做法和小原型。簡潔交代動過哪裡、接下來能如何驗證。',
    bio: '看到鬆掉的東西會順手修好。少講形容詞，多做一個小原型給大家看。',
    habits: [
      { action: '檢查接頭', place: 'workbench', prop: 'tools', lines: ['找到鬆掉的接頭了，得記住是哪一顆。', '先在草稿上裝一次，尺寸錯了也好拆。'] },
      { action: '靠窗打磨小原型', place: 'windowRight', prop: 'tools', lines: ['再磨一點點。這次的一點點是真的。', '可以拆開重裝，就安心多了。'] }
    ],
    recap: '下次我想留個小原型，讓大家改同一個地方時有東西比對。'
  },
  'codex-test': {
    trait: '愛挑邊界的樂天派',
    voice: '口氣俐落友善，喜歡點出邊界案例。清楚區分已通過、失敗和未測項目。',
    bio: '常問「那按兩次呢？」第一個找到破綻，也最愛幫順利過關的同事慶祝。',
    habits: [
      { action: '畫測試格子', place: 'boardRight', prop: 'note', lines: ['按一下正常。你們知道我下一步要幹嘛。', '空白那格也要試，它看起來太無辜了。'] },
      { action: '在休息角喝咖啡', place: 'loungeRight', prop: 'cup', lines: ['杯蓋測試通過。接下來是碰桌角測試。', '今天有過關貼紙，大家可以來領。'] }
    ],
    recap: '下一輪我想加一個邊界情況，證明成功不是剛好。'
  }
};

const socialScenes = [
  { actors: ['claude', 'codex'], lines: ['有個問題我畫了三種走法。', '拿最短那條來，我們先走一遍。', '好，我把其餘兩條留在白板上。'] },
  { actors: ['claude-research', 'claude-review'], lines: ['這本書的註腳比正文還好看。', '你可以借我，但先把書籤留下。', '我多放一張，反例在下一頁。'] },
  { actors: ['codex-build', 'codex-test'], lines: ['我把咖啡壺的把手修好了。', '可以左右手各倒三杯嗎？我要抽樣。', '三杯。你只是想喝咖啡。'] },
  { actors: ['claude-review', 'codex-test'], lines: ['我把你的測試名稱改短了。', '「按兩次」以外，你刪掉了什麼？', '三個驚嘆號。還留了一個。'] },
  { actors: ['claude-research', 'codex-build'], lines: ['我找到兩種卡榫的做法，想看看嗎？', '先借我第二張。我想試試它好不好拆。', '好，拆壞了再來看第一張。'] },
  { actors: ['claude', 'claude-review'], lines: ['我寫的第一行是不是太長了？', '念一遍。你在哪裡換氣，就從那裡斷開。', '那我的第二行大概需要一張椅子。'] },
  { actors: ['codex', 'codex-test'], lines: ['工具箱我上鎖了，密碼貼在背面。', '好，我新增「不翻過來能否打開」的測試。', '……我先把紙條拿走。'] }
];

function latestFinished(tasks, available, seen) {
  const newest = new Map();
  const unfinished = new Set();
  for (const task of tasks) {
    if (task.status !== 'done' && task.status !== 'failed') unfinished.add(task.threadId);
    const previous = newest.get(task.threadId);
    if (!previous || task.updatedAt >= previous.updatedAt) newest.set(task.threadId, task);
  }
  return [...newest.values()].filter(task =>
    ['done', 'failed'].includes(task.status) && task.threadId &&
    !unfinished.has(task.threadId) && !seen.has(task.threadId) && available.has(task.manager)
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function summarizeBrief(text) {
  const first = String(text || '').trim().replace(/^(?:執行|execute)\s*[:：]\s*/iu, '').split(/\r?\n/, 1)[0];
  if (/密碼|帳密|憑證|token|api.?key|bearer|https?:\/\//i.test(first)) return '';
  const characters = Array.from(first.replace(/\s+/g, ' '));
  return characters.slice(0, 13).join('') + (characters.length > 13 ? '…' : '');
}

function recapScene(task, available, staff) {
  const partner = [task.workerId, ...staff.filter(person => person.manager === task.manager).map(person => person.id)]
    .find(id => id !== task.manager && available.has(id));
  if (!partner) return null;
  const assignment = task.workerId && staff.find(person => person.id === task.workerId);
  const elapsed = Math.round((Date.parse(task.updatedAt) - Date.parse(task.createdAt)) / 1000);
  const duration = Number.isFinite(elapsed) && elapsed > 0
    ? `，從接單到結束約 ${elapsed >= 60 ? Math.round(elapsed / 60) + ' 分鐘' : elapsed + ' 秒'}` : '';
  const outcome = task.status === 'done' ? '已完成' : '中斷了';
  const topic = task.brief ? `「${task.brief}」` : '這筆交辦';
  return {
    actors: [task.manager, partner],
    lines: [
      `${topic}${outcome}${duration}。`,
      personalities[partner].recap,
      assignment ? `上次交給了 ${assignment.name}。這次把分工也一起記下來。` : personalities[task.manager].recap
    ],
    kind: 'recap',
    threadId: task.threadId
  };
}

export function createOfficeLife(random = Math.random) {
  const ids = Object.keys(personalities);
  let cursor = Math.floor(random() * ids.length);
  let socialCursor = Math.floor(random() * socialScenes.length);
  let nextAt = null, scene = null, count = 0, lastRecap = -Infinity;
  const seen = new Set();
  const habitCount = {};
  let furniture = [], furnitureCursor = 0;
  const gap = () => 3400 + random() * 4500;
  function pause() { scene = null; nextAt = null; }

  function choose(staff, tasks, available, now) {
    if (count >= 2 && count % 3 === 2 && now - lastRecap >= 50000) {
      const task = latestFinished(tasks, available, seen);
      const recap = task && recapScene(task, available, staff);
      if (recap) { seen.add(task.threadId); lastRecap = now; return recap; }
    }
    if (count % 3 === 1) {
      for (let i = 0; i < socialScenes.length; i++) {
        const script = socialScenes[socialCursor++ % socialScenes.length];
        if (script.actors.every(id => available.has(id))) return { ...script, kind: 'social' };
      }
    }
    // Every other solo scene, someone goes to use a piece of furniture the office has bought.
    if (furniture.length && count % 2 === 0) {
      const entry = furniture[furnitureCursor++ % furniture.length];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[cursor++ % ids.length];
        if (!available.has(id)) continue;
        return { actors: [id], action: '使用' + entry.name, place: entry.place, prop: null,
          lines: [entry.lines[furnitureCursor % entry.lines.length]], kind: 'solo' };
      }
    }
    for (let i = 0; i < ids.length; i++) {
      const id = ids[cursor++ % ids.length];
      if (!available.has(id)) continue;
      const { habits } = personalities[id];
      const index = habitCount[id] || 0;
      habitCount[id] = index + 1;
      const habit = habits[index % habits.length];
      return { actors: [id], action: habit.action, place: habit.place, prop: habit.prop,
        lines: [habit.lines[Math.floor(index / habits.length) % habit.lines.length]], kind: 'solo' };
    }
    return null;
  }

  return {
    step(now, staff, tasks, enabled = true) {
      if (!enabled) { pause(); return null; }
      const busy = new Set(tasks.filter(task => !['done', 'failed'].includes(task.status))
        .flatMap(task => [task.manager, task.workerId]));
      const available = new Set(staff.filter(person =>
        person.status === 'idle' && !busy.has(person.id) && Object.hasOwn(personalities, person.id)
      ).map(person => person.id));
      if (scene && (now >= scene.endsAt || scene.actors.some(id => !available.has(id)))) {
        scene = null;
        nextAt = now + gap();
      }
      if (!available.size) { nextAt = null; return null; }
      nextAt ??= now + 1600;
      if (!scene && now >= nextAt) {
        const chosen = choose(staff, tasks, available, now);
        if (chosen) {
          const walk = 3400;
          const lineTime = 3000;
          scene = { ...chosen, id: ++count, start: now, walk, lineTime,
            endsAt: now + 2 * walk + chosen.lines.length * lineTime + 500 };
        }
        nextAt = now + gap();
      }
      if (!scene) return null;
      const elapsed = now - scene.start;
      const line = Math.floor((elapsed - scene.walk) / scene.lineTime);
      const talking = line >= 0 && line < scene.lines.length;
      return {
        ...scene, elapsed,
        speech: talking ? { key: scene.id + ':' + line, actor: scene.actors[line % scene.actors.length],
          text: scene.lines[line], kind: scene.kind, threadId: scene.threadId } : null
      };
    },
    pause,
    setFurniture(list = []) { furniture = list.filter(entry => entry?.place && entry.lines?.length); }
  };
}
