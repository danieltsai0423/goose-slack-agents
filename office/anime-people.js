// The staff as anime-style chibi pixel sprites: a big round head with layered bangs and a hair highlight band,
// large eyes with lashes, coloured irises and a catch-light, blush, and a small body. Heads are pixel templates
// drawn looking left; the body and every action pose follow the original 2D figures in iso-props.js.
import { drawEmotion } from './furniture.js';

const INK = '#2b2233';
const SKIN = '#fbe1cf', SKIN_SHADE = '#eab8a2', SKIN_DEEP = '#d99a86';

// Per person: hair [main, light, dark], eyes [iris, dark, light], outfit [jacket, shade, inner], trousers, style.
export const looks = [
  { hair: ['#b8543a', '#e48a5e', '#7a3328'], eyes: ['#e0a040', '#8a5418', '#f6d690'], outfit: ['#e8d6b8', '#c9b08c', '#ffffff'], legs: '#4f5d6b', style: 'ahoge' },      // Claude
  { hair: ['#34477a', '#5b78b8', '#1f2a4c'], eyes: ['#4a90d8', '#1f4a88', '#a8d4ff'], outfit: ['#2f4166', '#22304c', '#e8f0f8'], legs: '#2a3140', style: 'glasses' },    // Codex
  { hair: ['#7b5aa6', '#ab8ad6', '#4e3872'], eyes: ['#9a6ad8', '#53328a', '#d8c0ff'], outfit: ['#c88a6a', '#a46a4e', '#fff4e6'], legs: '#5a4a62', style: 'long' },       // Mira
  { hair: ['#c99a4a', '#efc878', '#8a642a'], eyes: ['#58a878', '#2a6a44', '#b8ecc8'], outfit: ['#7a9a80', '#5d7c64', '#f4f4ec'], legs: '#4c5664', style: 'swept' },      // Theo
  { hair: ['#2b5d61', '#4f9294', '#173a3d'], eyes: ['#30b0b8', '#156870', '#a0eef0'], outfit: ['#4f7f94', '#3a6274', '#e6eef0'], legs: '#3a4048', style: 'spiky' },      // Finn
  { hair: ['#e0749a', '#f8a8c4', '#a84a6c'], eyes: ['#e05a8a', '#8a2850', '#ffc0d8'], outfit: ['#a688b8', '#85699a', '#fff0f6'], legs: '#4a5470', style: 'twintails' }   // Nova
];

// Head, looking left. o outline, h hair, l highlight band, d hair shadow, f skin. 18 × 17.
const HEAD_FRONT = [
  '......oooooo......',
  '....oohhhhhhoo....',
  '...ohhhllllhhho...',
  '..ohhllhhhhhhhhho.',
  '.ohhlhhhhhhhhhhhho',
  '.ohhhhhhhhhhhhhhho',
  'ohhhhdhhhhdhhhhhho',
  'ohhdffdhhdffdhhhho',
  'ohdffffdffffffdhho',
  'ohfffffffffffffdho',
  'ohfffffffffffffdho',
  'ohfffffffffffffdho',
  '.offfffffffffffdo.',
  '.offffffffffffffo.',
  '..offfffffffffoo..',
  '...oofffffffoo....',
  '.....ooooooo......'
];
const HEAD_BACK = [
  '......oooooo......',
  '....oohhhhhhoo....',
  '...ohhhllllhhho...',
  '..ohhllhhhhhhhhho.',
  '.ohhlhhhhhhhhhhhho',
  '.ohhhhhhhhhhhhhhho',
  'ohhhhhhhhhhhhhhhho',
  'ohhhhhhhhhhhhhhhho',
  'ohhhhhhhhhhhhhhhho',
  'ohdhhhhhhhhhhhhdho',
  'ohhdhhhhhhhhhhdhho',
  '.ohhdhhhhhhhhdhho.',
  '.ohhhdhhhhhhdhhho.',
  '..ohhhhhhhhhhhoo..',
  '...oohhhhhhhoo....',
  '.....ooooooo......',
  '..................'
];

export function drawAnimeCharacter(p, variant, sx, sy, {
  facing = 'sw', seated = false, busy = false, tick = 0, emotion = 'calm', lead = false, team = 'claude',
  prop = null, action = null, z = 0, hop = 0, emoteBusy = false
} = {}) {
  const look = looks[variant % looks.length];
  const [hair, hairLight, hairDark] = look.hair;
  const act = action || (busy && seated ? 'type' : 'idle');
  const front = facing === 'sw' || facing === 'se';
  const m = facing === 'se' || facing === 'ne' ? 1 : -1; // 1 = looking right
  const t = tick + variant * 3;
  const walking = act === 'walk' || act === 'run';
  const frame = walking ? (act === 'run' ? tick * 2 : tick) % 4 : 0;
  const sway = act === 'dance' ? [0, 1, 0, -1][t % 4] : 0;
  const X = (dx, w = 1) => (m > 0 ? sx + dx : sx - dx - w) + sway;
  const B = (dx, y, w, h, color) => p.box(X(dx, w), y, w, h, color);
  const sitting = seated || act === 'sit' || act === 'piano' || act === 'drive';
  const crouch = act === 'pet' ? 3 : 0;
  const breathe = !walking && !busy && t % 8 >= 4 ? 1 : 0;
  const bob = walking ? [0, 1, 0, 1][frame] : 0;
  const droop = act === 'doze' ? 2 : emotion === 'tired' || emotion === 'sad' ? 1 : 0;
  const lift = seated ? -6 : sitting ? -2 : 0;
  const base = sy - z - hop;
  const [jacket, jacketShade, inner] = look.outfit;
  if (!seated && z === 0) p.oval(sx + sway, sy, 7, 2, hop ? '#00000020' : '#00000030');

  const body = base - 6 + lift - bob + crouch;
  const sh = body - 7 + breathe;
  const nod = act === 'listen' && t % 6 < 2 || act === 'groove' && t % 2 || act === 'phone' || act === 'doze' && t % 8 < 4 ? 1 : 0;
  const headTop = sh - 15 + droop + nod;
  // Head pixel in the left-looking template → screen, mirrored for the facing.
  const px = (col, row, color, w = 1, h = 1) => B(8 - col - (w - 1), headTop + row, w, h, color);

  // Hair that hangs behind the body (long hair, twin tails) goes first when facing us.
  const backHair = () => {
    if (look.style === 'long') {
      for (let r = 8; r < 26; r++) { const inset = r > 22 ? r - 22 : 0; px(1 + inset, r, INK, 16 - inset * 2); px(2 + inset, r, r % 5 === 0 ? hairDark : hair, 14 - inset * 2); }
      px(2, 26, INK, 14);
    }
    if (look.style === 'twintails') {
      for (const side of [-3, 17]) for (let r = 3; r < 24; r++) {
        const w = r < 6 ? 3 : r > 19 ? 2 : 4, c0 = side < 0 ? side - (w - 3) : side;
        px(c0 - 1, r, INK, w + 2); px(c0, r, r % 6 === 2 ? hairLight : r % 6 === 5 ? hairDark : hair, w);
      }
      for (const side of [-3, 17]) px(side < 0 ? side : side, 24, INK, 3);
    }
  };
  if (front) backHair();

  if (!sitting) {
    const raise1 = walking ? [2, 0, 0, 0][frame] : 0, raise2 = walking ? [0, 0, 2, 0][frame] : 0;
    const stride = walking ? [-1, 0, 1, 0][frame] : 0;
    const leg = (dx, raise, shift) => {
      B(dx + shift, base - 6 - raise + crouch, 3, 6 - crouch, INK);
      B(dx + 1 + shift, base - 5 - raise + crouch, 1, Math.max(1, 3 - crouch), look.legs);
      B(dx + 1 + shift, base - 2 - raise, 1, 1, '#fff6ee'); // socks
      B(dx + shift, base - 1 - raise, 3, 1, '#4a3440');
    };
    leg(-3, raise1, stride); leg(1, raise2, -stride);
  } else if (!seated) {
    B(-3, base - 4, 3, 3, INK); B(1, base - 4, 3, 3, INK); B(-2, base - 3, 1, 1, look.legs); B(2, base - 3, 1, 1, look.legs);
    B(-3, base - 1, 3, 1, '#4a3440'); B(1, base - 1, 3, 1, '#4a3440');
  }
  // Torso: a jacket over a light shirt, with a ribbon or tie for the leads.
  B(-5, sh - 1, 10, 9 - breathe, INK);
  B(-4, sh, 8, 7 - breathe, jacket);
  B(2, sh, 2, 7 - breathe, jacketShade);
  if (front) {
    B(-1, sh, 3, 4, inner); B(-2, sh, 1, 2, inner);
    if (lead) { B(0, sh + 1, 1, 1, team === 'claude' ? '#e0604a' : '#3a8ac8'); B(-1, sh + 1, 3, 1, team === 'claude' ? '#e0604a' : '#3a8ac8'); B(0, sh + 2, 1, 2, team === 'claude' ? '#c04a3a' : '#2a6aa8'); }
    B(-3, sh + 5 - breathe, 6, 1, jacketShade);
  }
  if (!front) backHair();

  // Arms; "near" is the arm on the side the character faces. Raised arms clear the big head.
  const arm = (side, shape) => {
    const dx = side === 'near' ? 4 : -6, out = side === 'near' ? 1 : -1, inner2 = out > 0 ? 0 : 1;
    if (shape === 'up' || shape === 'wave') {
      const ux = (side === 'near' ? 9 : -11) + (shape === 'wave' && t % 2 ? out : 0);
      B(ux, sh - 9, 2, 10, INK); B(ux + (out > 0 ? 0 : 1), sh - 7, 1, 6, jacket); B(ux, sh - 11, 2, 2, SKIN);
      return [ux, sh - 12];
    }
    if (shape === 'chin') { B(dx - out, sh, 2, 4, INK); B(dx - out * 2, sh - 2, 2, 2, SKIN); return [dx - out * 2, sh - 2]; }
    if (shape === 'forward') { B(dx, sh + 1, 2, 3, INK); B(dx + out * 2, sh + 1, 2, 2, INK); B(dx + out * 2 + inner2, sh + 1, 1, 1, SKIN); return [dx + out * 2, sh]; }
    if (shape === 'mouth') { B(dx - out, sh - 2, 2, 5, INK); B(dx - out * 2, sh - 3, 2, 2, SKIN); return [dx - out * 2, sh - 4]; }
    if (shape === 'reach') { B(dx, sh + 2, 2, 7, INK); B(dx + out, sh + 7, 2, 2, SKIN); return [dx + out, sh + 8]; }
    const swing = shape === 'swingA' ? -1 : shape === 'swingB' ? 1 : 0;
    B(dx, sh + swing, 2, 6, INK); B(dx + inner2, sh + 1 + swing, 1, 4, jacket); B(dx + inner2, sh + 5 + swing, 1, 1, SKIN);
    return [dx, sh + 5 + swing];
  };
  const phase = t % 4 < 2;
  let near = 'down', far = 'down', held = prop, notes = false, hearts = false, sweat = false;
  switch (act) {
    case 'walk': near = ['swingA', 'down', 'swingB', 'down'][frame]; far = ['swingB', 'down', 'swingA', 'down'][frame]; break;
    case 'run': near = ['swingA', 'down', 'swingB', 'down'][frame]; far = ['swingB', 'down', 'swingA', 'down'][frame]; sweat = t % 10 < 5; break;
    case 'type': case 'piano': near = t % 2 ? 'forward' : 'swingA'; far = t % 2 ? 'swingA' : 'forward'; notes = act === 'piano'; break;
    case 'play': near = phase ? 'forward' : 'up'; far = 'forward'; break;
    case 'dance': near = phase ? 'up' : 'down'; far = phase ? 'down' : 'up'; notes = true; break;
    case 'pet': near = 'reach'; hearts = t % 6 < 3; break;
    case 'drink': case 'eat': near = phase ? 'mouth' : 'forward'; held = held || (act === 'drink' ? 'cup' : 'snack'); break;
    case 'read': near = 'forward'; far = 'forward'; held = held || 'book'; break;
    case 'write': near = phase ? 'up' : 'forward'; held = held || 'note'; break;
    case 'fix': near = phase ? 'forward' : 'reach'; held = held || 'tools'; break;
    case 'water': near = 'forward'; held = held || 'water'; break;
    case 'talk': near = phase ? 'forward' : 'down'; far = t % 6 < 2 ? 'forward' : 'down'; break;
    case 'cheer': case 'stretch': case 'yawn': near = 'up'; far = 'up'; break;
    case 'idea': near = 'up'; break;
    case 'wave': near = 'wave'; break;
    case 'think': near = 'chin'; break;
    case 'phone': near = 'forward'; far = 'forward'; held = 'phone'; break;
    case 'groove': notes = true; break;
    case 'paddle': near = t % 2 ? 'forward' : 'swingA'; held = 'paddle'; break;
    case 'cue': near = 'forward'; far = 'forward'; held = 'cue'; break;
    case 'sing': near = 'mouth'; far = phase ? 'up' : 'down'; held = 'mic'; notes = true; break;
    case 'shoot': near = t % 6 < 2 ? 'up' : 'forward'; far = t % 6 < 2 ? 'up' : 'forward'; break;
    case 'vr': near = t % 4 < 2 ? 'up' : 'forward'; far = t % 4 < 2 ? 'forward' : 'up'; break;
    case 'drive': near = 'forward'; far = 'forward'; break;
    default: if (held) near = 'forward';
  }
  arm('far', far);

  // Head from the template, with skin shadow under the bangs.
  const rows = front ? HEAD_FRONT : HEAD_BACK;
  const colors = { o: INK, h: hair, l: hairLight, d: hairDark, f: SKIN };
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      let color = colors[ch];
      if (ch === 'f' && r > 0 && 'hld'.includes(rows[r - 1][c])) color = SKIN_SHADE;
      px(c, r, color);
    }
  });
  // Signature details.
  if (look.style === 'ahoge') { px(9, -1, INK); px(10, -2, INK); px(11, -3, INK); px(12, -3, INK); px(10, -1, hair); px(11, -2, hair); px(12, -2, INK); }
  if (look.style === 'swept') { for (let c = 2; c < 8; c++) px(c, 7 + (c > 4 ? 1 : 0), c % 2 ? hairDark : hair); }
  if (look.style === 'spiky') { for (const [c, h] of [[4, 2], [7, 3], [10, 3], [13, 2]]) for (let i = 1; i <= h; i++) { px(c, -i + 1, INK, 3); px(c + 1, -i + 2, i === h ? hairLight : hair); } }
  if (look.style === 'twintails') { for (const c of [1, 15]) { px(c, 3, INK, 3); px(c + 1, 3, '#f2c94c'); } }
  if (look.style === 'long' && front) for (let c = 2; c < 16; c++) if (rows[4][c] !== '.' && rows[4][c] !== 'o') px(c, 4, c % 3 ? '#f2e6a0' : '#e8c860'); // hairband

  if (front) {
    // Eyes: the far eye (screen side the face turns to) is narrower.
    const [iris, irisDark, irisLight] = look.eyes;
    const closed = (t * 7) % 29 === 0 || emotion === 'tired' || act === 'piano' && phase || act === 'doze' || act === 'yawn' || act === 'groove' && t % 4 < 2;
    const glad = act === 'cheer' || emotion === 'elated';
    if (act === 'vr') { px(1, 9, '#2a2f3a', 15, 4); px(2, 10, t % 2 ? '#7af0f0' : '#40c0f0', 13); }
    else if (closed) { px(8, 11, INK, 3); px(7, 10, INK); px(3, 11, INK, 2); }
    else if (glad) { px(9, 10, INK); px(8, 11, INK); px(10, 11, INK); px(3, 10, INK); px(2, 11, INK); px(4, 11, INK); }
    else {
      px(8, 9, INK, 4); px(2, 9, INK, 3);                                           // upper lashes
      px(8, 10, '#ffffff'); px(9, 10, irisDark, 2); px(3, 10, '#ffffff'); px(4, 10, irisDark);
      px(8, 11, iris, 3); px(3, 11, iris, 2);
      px(8, 12, iris); px(9, 12, irisLight); px(10, 12, iris); px(3, 12, iris); px(4, 12, irisLight);
      if (look.style === 'glasses') { px(7, 8, '#3b3f5c', 5); px(7, 13, '#3b3f5c', 5); px(7, 9, '#3b3f5c', 1, 4); px(11, 9, '#3b3f5c', 1, 4); px(2, 8, '#3b3f5c', 3); px(2, 13, '#3b3f5c', 3); px(1, 9, '#3b3f5c', 1, 4); px(5, 10, '#3b3f5c', 2); }
    }
    // Blush and mouth.
    if (emotion === 'happy' || emotion === 'elated' || act === 'cheer' || glad) { px(9, 13, '#f5a0ae', 2); px(2, 13, '#f5a0ae'); }
    else { px(9, 13, '#f8c4c0', 2); }
    const mouthOpen = act === 'talk' && phase || act === 'cheer' || act === 'idea' || (act === 'eat' || act === 'drink') && phase;
    if (act === 'yawn' || act === 'sing' && phase) { px(5, 13, '#8a3038', 2, 2); px(5, 14, '#e07a86'); }
    else if (mouthOpen) { px(5, 14, '#8a3038', 2); px(5, 15, '#e07a86', 2); }
    else if (emotion === 'happy' || emotion === 'elated') { px(4, 14, SKIN_DEEP); px(5, 15, '#b05a5a', 2); px(7, 14, SKIN_DEEP); }
    else if (emotion === 'sad' || emotion === 'grumpy') { px(5, 15, '#9a5a5a', 2); px(4, 16, SKIN_DEEP); }
    else px(6, 14, '#c0706a');
  }
  if (look.style === 'spiky' && front) { px(4, 5, '#3a3a40', 10); px(5, 4, '#7fd0e0', 2); px(10, 4, '#7fd0e0', 2); } // goggles on the forehead

  const [hx, hy] = arm('near', near);
  if (held === 'cup') { B(hx, hy - 2, 3, 3, '#f2eadb'); B(hx, hy - 2, 3, 1, '#8a5a3a'); }
  if (held === 'snack') { B(hx, hy - 2, 3, 2, '#f2c94c'); B(hx + 1, hy - 3, 1, 1, '#c43a3a'); }
  if (held === 'book' || held === 'note') B(hx - 1, hy - 2, 4, 3, held === 'book' ? '#a95a4f' : '#fcf0c9');
  if (held === 'tools') B(hx, hy - 1, 3, 1, '#b7cbca');
  if (held === 'paddle') { B(hx, hy - 3, 3, 3, '#c43a3a'); B(hx + 1, hy, 1, 2, '#8a5a3a'); }
  if (held === 'mic') B(hx, hy - 1, 2, 2, '#2a2a2e');
  if (held === 'cue') for (let i = 0; i < 9; i++) p.box(X(hx - 2 + i, 1), hy + 1 + Math.floor(i / 3), 1, 1, i < 2 ? '#e8e4da' : '#a8743a');
  if (held === 'phone') { B(hx - 1, hy - 3, 3, 4, '#2c3440'); B(hx, hy - 2, 1, 2, t % 5 ? '#9fe0ff' : '#ffffff'); }
  if (held === 'water') { B(hx, hy - 2, 3, 3, '#668b9d'); if (phase) B(hx + 3, hy + 1, 1, 2, '#8fc6f0'); }

  const top = headTop - (look.style === 'ahoge' ? 4 : look.style === 'spiky' ? 3 : 1);
  if (notes && t % 6 < 4) { const nx = sx + 10 + (t % 3), ny = top - 2 - (t % 6); p.box(nx, ny, 1, 4, '#f2c94c'); p.box(nx - 2, ny + 3, 2, 2, '#f2c94c'); p.box(nx + 1, ny, 2, 1, '#f2c94c'); }
  if (hearts) { const hx2 = sx + 8, hy2 = top - 2 - (t % 3); p.box(hx2, hy2, 2, 1, '#ff7a9a'); p.box(hx2 + 3, hy2, 2, 1, '#ff7a9a'); p.box(hx2, hy2 + 1, 5, 1, '#ff7a9a'); p.box(hx2 + 1, hy2 + 2, 3, 1, '#ff7a9a'); p.box(hx2 + 2, hy2 + 3, 1, 1, '#ff7a9a'); }
  if (sweat) p.box(X(9), headTop + 4 + (t % 4), 1, 2, '#8fc6f0');
  if (act === 'cheer' && t % 2) { p.box(sx - 12, top + 2, 1, 1, '#fff1c4'); p.box(sx + 12, top, 1, 1, '#fff1c4'); }
  if (emotion !== 'calm' && !walking && !notes && !hearts && act !== 'cheer' && !emoteBusy) drawEmotion(p, emotion, sx, top, tick);
  return { top };
}
