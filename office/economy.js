// Shared rules for the office economy. The server owns the balance; the browser reads the same catalog.

export const STARTING_FUNDS = 800;
// Funds earned for every percentage point of a provider's shortest usage window.
export const FUNDS_PER_PERCENT = 40;

export const teams = {
  claude: ['claude', 'claude-research', 'claude-review'],
  codex: ['codex', 'codex-build', 'codex-test']
};
export const staffIds = [...teams.claude, ...teams.codex];

export const favorites = {
  claude: 'tea', codex: 'pizza', 'claude-research': 'book',
  'claude-review': 'macaron', 'codex-build': 'kit', 'codex-test': 'espresso'
};
export const FAVORITE_BONUS = 1.6;

// The building, bottom to top. Each floor is bigger than the last and has room for more furniture:
// "small" spots take one-tile pieces, "large" spots take 2×2 multi-player facilities, "wall" spots hang art.
export const floors = [
  {
    id: 1, name: '暖木工作室', style: 'Japandi 暖木', price: 0, income: 1, energy: 0, mood: 0, decay: 0, size: '14 × 11',
    capacity: { small: 3, large: 0, wall: 1 },
    blurb: '淺色橡木地板、亞麻沙發與滿室綠植。小團隊起家的地方，溫暖但很擠，只放得下三件小家具。',
    perk: '基準樓層'
  },
  {
    id: 2, name: '工業風 Loft', style: 'Industrial Loft', price: 6000, income: 1.2, energy: 2, mood: 0, decay: 0, size: '16 × 12',
    capacity: { small: 5, large: 1, wall: 2 },
    blurb: '紅磚牆、黑鐵格窗、清水模地板與裸露管線。終於有一塊空地，擺得下第一張雙人遊戲桌。',
    perk: '吧台常備咖啡：精力每小時 +2'
  },
  {
    id: 3, name: '中世紀摩登', style: 'Mid-century Modern', price: 18000, income: 1.45, energy: 1, mood: 2, decay: 0, size: '18 × 13',
    capacity: { small: 6, large: 1, wall: 2 },
    blurb: '柚木格柵、芥末黃牆面、磨石子地板，兩組各有工作室，中間是寬敞的交誼廳。',
    perk: '心情每小時 +2、精力 +1'
  },
  {
    id: 4, name: '霓虹遊戲基地', style: 'Neon Game Lab', price: 40000, income: 1.6, energy: 1, mood: 3, decay: 0.2, size: '20 × 14',
    capacity: { small: 6, large: 2, wall: 2 },
    blurb: '深色地坪、霓虹燈條和整片遊戲大廳。專為大型遊樂設施設計的一層，午休時間最熱鬧。',
    perk: '心情每小時 +3，心情衰退 −20%'
  },
  {
    id: 5, name: '森林中庭', style: 'Biophilic Atrium', price: 70000, income: 1.85, energy: 2, mood: 2, decay: 0.5, size: '20 × 14',
    capacity: { small: 6, large: 2, wall: 2 },
    blurb: '植生牆、天窗光束、石板步道與室內瀑布。親自然設計讓人自然放鬆。',
    perk: '心情衰退減半，心情與精力每小時 +2'
  },
  {
    id: 6, name: '天際頂樓', style: 'Skyline Penthouse', price: 120000, income: 2.2, energy: 3, mood: 4, decay: 0.5, size: '20 × 15',
    capacity: { small: 7, large: 2, wall: 2 },
    blurb: '整面落地窗俯瞰城市夜景，大理石地板、黃銅線條與水晶吊燈。',
    perk: '心情每小時 +4、精力 +3'
  },
  {
    id: 7, name: '空中園區', style: 'Sky Campus', price: 220000, income: 2.6, energy: 4, mood: 4, decay: 0.6, size: '24 × 17',
    capacity: { small: 8, large: 3, wall: 3 },
    blurb: '整層樓頂的園區：兩間工作坊、一座遊樂中庭和空中花園。所有設施都放得下。',
    perk: '收入最高，心情與精力每小時 +4，心情衰退 −60%'
  }
];

export const items = [
  { id: 'tea', name: '焙茶', price: 60, mood: 8, energy: 6, desc: '溫熱的焙茶，適合想事情的時候。', lines: ['這泡茶剛好。', '先暖手，再暖腦。'] },
  { id: 'espresso', name: '雙份濃縮', price: 80, mood: 2, energy: 22, desc: '一口喝完的那種，精力大補。', lines: ['好，我醒了。非常醒。', '再給我一個邊界案例！'] },
  { id: 'macaron', name: '馬卡龍禮盒', price: 120, mood: 16, energy: 0, desc: '六色馬卡龍，排得整整齊齊。', lines: ['顏色排得很順，我喜歡。', '這盒我會對齊再吃。'] },
  { id: 'pizza', name: '深夜披薩', price: 180, mood: 12, energy: 12, desc: '加班必備，整個團隊都聞得到。', lines: ['先吃一片，再交付一版。', '這是今天最好的部署。'] },
  { id: 'pillow', name: '午睡枕', price: 150, mood: 4, energy: 40, desc: '趴在桌上睡二十分鐘。', lines: ['……再五分鐘。', '睡飽了，剛剛夢到測試全過。'] },
  { id: 'book', name: '絕版古書', price: 220, mood: 10, energy: 0, desc: '書頁泛黃，旁註比正文還多。', lines: ['這個旁註太棒了。', '我只看一頁。大概。'] },
  { id: 'kit', name: '機械模型套件', price: 260, mood: 12, energy: 0, desc: '一盒等著被組起來的齒輪。', lines: ['零件一個都不能少。', '組好了！再拆開一次。'] },
  { id: 'massage', name: '按摩券', price: 400, mood: 12, energy: 30, desc: '肩頸放鬆，一整週的僵硬都散了。', lines: ['肩膀終於回到原位了。', '我可以再寫一千行。'] },
  { id: 'party', name: '慶功派對', price: 900, mood: 18, energy: 8, team: true, desc: '全辦公室一起慶祝，彩帶與蛋糕。', lines: ['今天大家都辛苦了！', '敬下一次順利交付！'] },
  { id: 'cocoa', name: '熱可可', price: 70, mood: 9, energy: 3, desc: '上面浮著兩顆棉花糖。', lines: ['棉花糖是重點。', '暖到手指都醒了。'] },
  { id: 'boba', name: '珍珠奶茶', price: 90, mood: 10, energy: 4, desc: '半糖少冰，珍珠 Q 彈。', lines: ['這杯的珍珠有記住我。', '半糖剛好，人生也是。'] },
  { id: 'icecream', name: '抹茶冰淇淋', price: 100, mood: 14, energy: 0, desc: '濃抹茶雙球，要趁快吃。', lines: ['冷靜下來了，真的。', '苦一點的甜最好。'] },
  { id: 'energy', name: '能量飲料', price: 110, mood: -2, energy: 30, desc: '提神效果驚人，但喝多了會有點煩躁。', lines: ['心跳有點快，但程式碼也是。', '我現在可以重構整個專案。'] },
  { id: 'fruit', name: '水果拼盤', price: 140, mood: 8, energy: 10, desc: '芒果、葡萄與奇異果，切好裝盒。', lines: ['今天的芒果很甜。', '吃點顏色，腦袋也亮了。'] },
  { id: 'ramen', name: '拉麵外送', price: 200, mood: 10, energy: 18, desc: '豚骨湯頭，加一顆溏心蛋。', lines: ['湯先喝一口，再說。', '溏心蛋的熟度跟測試一樣完美。'] },
  { id: 'aroma', name: '香氛精油', price: 650, mood: 8, energy: 4, team: true, desc: '在辦公室點上雪松與柑橘的味道。', lines: ['整間辦公室聞起來像森林。', '深呼吸，再開始。'] },
  { id: 'trip', name: '員工旅遊', price: 3500, mood: 35, energy: 30, team: true, desc: '包下溫泉旅館兩天一夜，全員放風。', lines: ['我們回來了，帶了伴手禮！', '泡完溫泉，bug 也變可愛了。'] }
];

// Slot ids: f1… small floor spots, g1… large (2×2) floor spots, w1… wall spots. Each floor has the first N of each.
const slotIds = { small: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'], large: ['g1', 'g2', 'g3'], wall: ['w1', 'w2', 'w3'] };
export const slots = [
  ...slotIds.small.map(id => ({ id, kind: 'floor', size: 1 })),
  ...slotIds.large.map(id => ({ id, kind: 'floor', size: 2 })),
  ...slotIds.wall.map(id => ({ id, kind: 'wall', size: 1 }))
];
export function slotsFor(floorId) {
  const capacity = (floors.find(floor => floor.id === floorId) || floors[0]).capacity;
  return slots.filter(slot => {
    const group = slot.kind === 'wall' ? 'wall' : slot.size === 2 ? 'large' : 'small';
    return slotIds[group].indexOf(slot.id) < capacity[group];
  });
}
export const sizeOf = entry => entry?.size || 1;
// The lowest floor with a spot this piece fits in.
export const firstFloorFor = entry => floors.find(floor => slotsFor(floor.id).some(slot => slot.kind === entry.kind && slot.size === sizeOf(entry)))?.id ?? null;
export const fits = (entry, slot) => Boolean(entry && slot && entry.kind === slot.kind && sizeOf(entry) === slot.size);

export const furniture = [
  { id: 'bonsai', name: '松柏盆景', kind: 'floor', price: 600, floor: 1, mood: 1, desc: '修剪得剛好的小松樹。', use: ['修一下這根枝條。', '它長得比我有耐心。'] },
  { id: 'beanbag', name: '懶骨頭', kind: 'floor', price: 900, floor: 1, mood: 2, desc: '一坐下去就不想起來。', use: ['讓我陷進去五分鐘。', '這是最好的思考姿勢。'] },
  { id: 'espresso-bar', name: '濃縮咖啡機', kind: 'floor', price: 1200, floor: 1, energy: 3, desc: '銅色鍋爐的半自動咖啡機。', use: ['萃取二十五秒，剛好。', '奶泡打得很綿。'] },
  { id: 'poster', name: '復古旅遊海報', kind: 'wall', price: 400, floor: 1, mood: 1, desc: '一張山與海的絹印海報。' },
  { id: 'fridge', name: '零食冰箱', kind: 'floor', price: 1500, floor: 2, mood: 1, energy: 2, desc: '永遠有人補貨的玻璃冰箱。', use: ['最後一瓶氣泡水是我的。', '有人把布丁補滿了！'] },
  { id: 'record', name: '黑膠唱盤', kind: 'floor', price: 1600, floor: 2, mood: 3, desc: '放一張爵士樂，辦公室就慢下來。', use: ['換一張比較有節奏的。', '這首的貝斯很好。'] },
  { id: 'neon', name: '霓虹招牌', kind: 'wall', price: 1800, floor: 2, mood: 2, energy: 1, desc: '粉藍色的「SHIP IT」燈管。' },
  { id: 'aquarium', name: '熱帶魚缸', kind: 'floor', price: 2400, floor: 2, mood: 1, decay: 0.3, desc: '看魚游泳能讓心情慢慢穩定。', use: ['那條橘色的又在發呆。', '牠們都不用寫測試。'] },
  { id: 'arcade', name: '復古街機', kind: 'floor', price: 3200, floor: 3, mood: 4, desc: '一枚代幣可以玩到下班。', use: ['再一局，最後一局。', '破紀錄了！'] },
  { id: 'massage-chair', name: '按摩椅', kind: 'floor', price: 4500, floor: 3, energy: 5, desc: '十二段力道，含肩頸加強。', use: ['啊……就是這裡。', '我宣布休息十分鐘。'] },
  { id: 'painting', name: '抽象油畫', kind: 'wall', price: 6000, floor: 5, mood: 3, income: 0.05, desc: '色塊大膽的原作，客戶都會多看兩眼。' },
  { id: 'piano', name: '直立鋼琴', kind: 'floor', price: 8000, floor: 5, mood: 5, desc: '午休時間總有人彈一段。', use: ['我只會這一段。', '這段旋律可以當成功提示音。'] },
  { id: 'trophy', name: '金獎陳列櫃', kind: 'floor', price: 12000, floor: 6, mood: 3, income: 0.1, desc: '放滿這間辦公室得過的獎。', use: ['這座獎盃要擦亮。', '下一座放這裡。'] },
  { id: 'floor-lamp', name: '弧形落地燈', kind: 'floor', price: 500, floor: 1, mood: 1, desc: '暖黃光從頭頂灑下來。', use: ['光線剛好，眼睛不累。', '我把燈調暗一格。'] },
  { id: 'water', name: '飲水機', kind: 'floor', price: 700, floor: 1, mood: 1, energy: 1, desc: '冷熱兩用，還會咕嚕冒泡。', use: ['多喝水，少寫 bug。', '聽，它又咕嚕了。'] },
  { id: 'clock', name: '復古掛鐘', kind: 'wall', price: 800, floor: 1, energy: 1, desc: '黃銅指針，每小時輕敲一聲。' },
  { id: 'map', name: '世界地圖', kind: 'wall', price: 1200, floor: 2, mood: 2, desc: '插著大家想去旅行的圖釘。' },
  { id: 'foosball', name: '桌上足球', kind: 'floor', price: 2600, floor: 2, mood: 3, desc: '紅藍兩隊，午休必搶。', use: ['這球不算，我手滑了。', '再來一局決勝負！'] },
  { id: 'treadmill', name: '走步機', kind: 'floor', price: 2800, floor: 2, mood: 1, energy: 3, desc: '邊走邊想，靈感會跟著來。', use: ['走一公里，想一個解法。', '腳在動，腦袋也在動。'] },
  { id: 'popcorn', name: '爆米花機', kind: 'floor', price: 1900, floor: 3, mood: 2, energy: 1, desc: '紅色小推車，香味飄滿整層樓。', use: ['奶油口味，滿滿一杯。', '劈哩啪啦，聽起來像在編譯。'] },
  { id: 'vinyl-wall', name: '唱片牆', kind: 'wall', price: 3000, floor: 3, mood: 2, decay: 0.1, desc: '六張經典專輯封面，框成一面牆。' },
  { id: 'cat', name: '辦公室貓咪', kind: 'floor', price: 5000, floor: 3, mood: 4, decay: 0.1, desc: '一隻橘貓和牠的跳台，會在上面打盹。', use: ['牠剛剛對我眨眼了。', '今天的會議由貓主持。'] },
  { id: 'fountain', name: '石砌噴泉', kind: 'floor', price: 7500, floor: 5, mood: 2, decay: 0.2, desc: '流水聲讓整層樓安靜下來。', use: ['水聲剛好蓋過鍵盤聲。', '我丟了一枚硬幣許願。'] },
  { id: 'telescope', name: '天文望遠鏡', kind: 'floor', price: 9000, floor: 5, mood: 3, desc: '晚上可以看到土星環。', use: ['看到土星了！', '宇宙那麼大，這個 bug 很小。'] },
  { id: 'sleep-pod', name: '睡眠艙', kind: 'floor', price: 15000, floor: 6, energy: 7, desc: '隔音、調光、二十分鐘喚醒。', use: ['二十分鐘，充飽電。', '……我睡著前在想什麼？'] },
  { id: 'sculpture', name: '青銅雕塑', kind: 'floor', price: 20000, floor: 6, mood: 3, income: 0.08, desc: '藝術家親手鑄造的抽象作品。', use: ['每個角度看起來都不一樣。', '它好像在思考什麼。'] },
  // Interactive facilities. players: how many people use it together (the first walks over and invites the rest).
  { id: 'claw', name: '夾娃娃機', kind: 'floor', price: 1400, floor: 1, mood: 2, players: 1, desc: '投一枚代幣，夾一隻玩偶回座位。', use: ['往左一點……再一點……', '夾到了！給你。'] },
  { id: 'boardgame', name: '桌遊桌', kind: 'floor', size: 2, price: 2800, floor: 2, mood: 3, players: 3, desc: '一整櫃桌遊，三個人圍著就能開一局。', use: ['輪到你了，想好了嗎？', '這張卡我留到最後。'] },
  { id: 'hoops', name: '投籃機', kind: 'floor', price: 2200, floor: 2, mood: 2, energy: 1, players: 1, desc: '六十秒內能投進幾球？', use: ['唰！空心！', '再一球就破紀錄了。'] },
  { id: 'pingpong', name: '桌球桌', kind: 'floor', size: 2, price: 3800, floor: 2, mood: 3, energy: 2, players: 2, desc: '主管和員工最常約的一局，一球見真章。', use: ['這球我接到了！', '再一局，三戰兩勝。'] },
  { id: 'dance-pad', name: '跳舞機', kind: 'floor', price: 3400, floor: 3, mood: 3, energy: 1, players: 1, desc: '上下左右，跟著節拍踩。', use: ['全部 Perfect！', '這首的節奏太快了吧。'] },
  { id: 'air-hockey', name: '空氣曲棍球', kind: 'floor', size: 2, price: 5200, floor: 3, mood: 4, players: 2, desc: '冰面上的圓盤飛得比 bug 還快。', use: ['擋下來了！', '這球不算，我還沒準備好。'] },
  { id: 'vr', name: 'VR 體驗區', kind: 'floor', price: 6500, floor: 4, mood: 4, players: 1, desc: '戴上頭盔，走進另一個世界。', use: ['等等，我在月球上。', '這個關卡我閉著眼都會。'] },
  { id: 'racing', name: '賽車模擬器', kind: 'floor', price: 7200, floor: 4, mood: 4, energy: 1, players: 1, desc: '方向盤會震動的整座駕駛艙。', use: ['最後一個彎道！', '我刷新圈速了。'] },
  { id: 'pool', name: '撞球台', kind: 'floor', size: 2, price: 9800, floor: 5, mood: 4, income: 0.04, players: 2, desc: '綠色檯呢與黃銅邊框，午後的一場慢節奏對決。', use: ['先打這顆，再走位。', '一桿清台，看好了。'] },
  { id: 'karaoke', name: '卡拉OK舞台', kind: 'floor', size: 2, price: 16000, floor: 6, mood: 6, energy: 2, players: 3, desc: '小舞台、麥克風與彩色燈光，一人唱、大家喊安可。', use: ['下一首換你唱！', '安可！安可！'] }
];

// One-off policies: bought once, they stay in effect wherever the office moves.
export const perks = [
  { id: 'flex', name: '彈性工時', price: 2000, floor: 1, energy: 2, desc: '想早點來或晚點走都可以。' },
  { id: 'snacks', name: '零食津貼', price: 3000, floor: 1, mood: 2, desc: '每週補滿一次零食櫃。' },
  { id: 'gym', name: '健身補助', price: 5000, floor: 2, energy: 2, mood: 1, desc: '健身房月費公司出一半。' },
  { id: 'pet', name: '寵物友善', price: 6000, floor: 2, mood: 3, desc: '可以帶狗狗一起上班。' },
  { id: 'training', name: '學習基金', price: 8000, floor: 3, income: 0.05, desc: '每人每年一筆課程與書籍預算。' },
  { id: 'counsel', name: '心理諮商', price: 12000, floor: 3, mood: 1, decay: 0.2, desc: '每月一次免費諮商，壓力有地方放。' },
  { id: 'remote', name: '遠端工作日', price: 15000, floor: 5, energy: 3, mood: 2, desc: '每週五可以在家工作。' },
  { id: 'bonus', name: '年終分紅', price: 25000, floor: 6, mood: 2, income: 0.1, desc: '業績好，大家一起分。' }
];

export const itemById = Object.fromEntries(items.map(entry => [entry.id, entry]));
export const furnitureById = Object.fromEntries(furniture.map(entry => [entry.id, entry]));
export const perkById = Object.fromEntries(perks.map(entry => [entry.id, entry]));
export const floorById = Object.fromEntries(floors.map(entry => [entry.id, entry]));
export const slotById = Object.fromEntries(slots.map(entry => [entry.id, entry]));

export const emotions = {
  elated: { label: '興奮', tone: 'good' },
  happy: { label: '開心', tone: 'good' },
  calm: { label: '平靜', tone: 'neutral' },
  grumpy: { label: '煩躁', tone: 'bad' },
  tired: { label: '疲憊', tone: 'bad' },
  sad: { label: '沮喪', tone: 'bad' }
};

const clamp = (value, low = 0, high = 100) => Math.min(high, Math.max(low, value));

export function emotionOf({ mood = 60, energy = 70 } = {}) {
  if (mood < 22) return 'sad';
  if (energy < 25) return 'tired';
  if (mood < 40) return 'grumpy';
  if (mood >= 80 && energy >= 50) return 'elated';
  if (mood >= 62) return 'happy';
  return 'calm';
}

// Team spirit scales earnings between 0.8× and 1.25×.
export function moraleMultiplier(agents = {}) {
  const values = staffIds.map(id => agents[id]).filter(Boolean);
  if (!values.length) return 1;
  const score = values.reduce((sum, { mood, energy }) => sum + mood * 0.6 + energy * 0.4, 0) / values.length;
  return Math.round((0.8 + 0.45 * score / 100) * 100) / 100;
}

export function placedFurniture(state) {
  return Object.values(state.placed || {}).map(id => furnitureById[id]).filter(Boolean);
}

export function rates(state) {
  const floor = floorById[state.floor] || floors[0];
  const placed = [...placedFurniture(state), ...(state.perks || []).map(id => perkById[id]).filter(Boolean)];
  const sum = key => placed.reduce((total, entry) => total + (entry[key] || 0), 0);
  return {
    mood: floor.mood + sum('mood'),
    energy: floor.energy + sum('energy'),
    decay: Math.min(0.8, floor.decay + sum('decay')),
    income: Math.round((floor.income + sum('income')) * 100) / 100
  };
}

export function incomeMultiplier(state) {
  return Math.round(rates(state).income * moraleMultiplier(state.agents) * 100) / 100;
}

// Passive change over time: moods drift back towards 60 while furniture and floors push them up.
export function settle(agents, state, hours) {
  if (!(hours > 0)) return agents;
  const hoursUsed = Math.min(hours, 72);
  const rate = rates(state);
  const next = {};
  for (const id of staffIds) {
    const current = agents[id] || { mood: 60, energy: 70 };
    let mood = current.mood;
    if (mood > 60) mood = Math.max(60, mood - 4 * (1 - rate.decay) * hoursUsed);
    else mood = Math.min(60, mood + 2 * hoursUsed);
    mood = clamp(mood + rate.mood * hoursUsed);
    const energy = clamp(current.energy + (3 + rate.energy) * hoursUsed);
    next[id] = { mood: Math.round(mood * 10) / 10, energy: Math.round(energy * 10) / 10 };
  }
  return next;
}

// Work drains the team that consumed the quota.
export function strain(agents, team, percent) {
  const next = { ...agents };
  for (const id of teams[team] || []) {
    const current = next[id] || { mood: 60, energy: 70 };
    next[id] = {
      mood: Math.round(clamp(current.mood - percent * 0.4) * 10) / 10,
      energy: Math.round(clamp(current.energy - percent * 1.2) * 10) / 10
    };
  }
  return next;
}

export function itemEffect(item, target) {
  const boost = favorites[target] === item.id ? FAVORITE_BONUS : 1;
  return { mood: Math.round(item.mood * boost), energy: Math.round(item.energy * boost), favorite: boost > 1 };
}

// Converts a usage reading into earned percentage points.
export function consumedSince(previous, window) {
  if (!window || !Number.isFinite(window.used)) return { consumed: 0, meter: previous ?? null };
  const meter = { label: window.label, used: window.used, resetsAt: window.resetsAt ?? null };
  if (!previous || previous.label !== window.label) return { consumed: 0, meter };
  const resetMoved = previous.resetsAt && window.resetsAt && window.resetsAt - previous.resetsAt > 60000;
  if (resetMoved || window.used < previous.used - 0.5) return { consumed: Math.min(100, window.used), meter };
  return { consumed: Math.min(100, Math.max(0, window.used - previous.used)), meter };
}
