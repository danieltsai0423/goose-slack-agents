// Floor materials and back-wall elevations for each interior style.
import { hash, rgb } from './iso.js';
import { books, painter, pixelText, windowView } from './pixel-kit.js';
import { drawWallArt, drawWallArtLive } from './furniture.js';

const frac = v => v - Math.floor(v);
const shadeOf = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

function planks(colors, seam, { along = 'x', rows = 3 } = {}) {
  const cs = colors.map(rgb), s = rgb(seam);
  return (fx, fy) => {
    const a = along === 'x' ? fx : fy, b = along === 'x' ? fy : fx;
    const row = Math.floor(b * rows);
    if (frac(b * rows) < 0.13) return s;
    const shift = hash(row, 7) * 1.7;
    const seg = Math.floor(a * 0.8 + shift);
    if (frac(a * 0.8 + shift) < 0.05) return s;
    return cs[Math.floor(hash(row, seg) * cs.length)];
  };
}
function herringbone(colors, seam) {
  const x = planks(colors, seam, { along: 'x', rows: 6 }), y = planks(colors, seam, { along: 'y', rows: 6 });
  return (fx, fy, px, py) => (Math.floor(fx * 2) + Math.floor(fy * 2)) % 2 ? x(fx, fy, px, py) : y(fx, fy, px, py);
}
function speckle(base, specks, density = 0.12) {
  const b = rgb(base), sp = specks.map(rgb);
  return (fx, fy, px, py) => { const h = hash(px, py); return h < density ? sp[Math.floor(h / density * sp.length)] : b; };
}
function concrete(base, specks, seam) {
  const inner = speckle(base, specks, 0.1), s = rgb(seam);
  return (fx, fy, px, py) => frac(fx / 2) < 0.025 || frac(fy / 2) < 0.05 ? s : inner(fx, fy, px, py);
}
function tiles(a, b, seam, size = 1) {
  const A = rgb(a), B = rgb(b), S = rgb(seam);
  return (fx, fy) => frac(fx / size) < 0.05 || frac(fy / size) < 0.09 ? S : (Math.floor(fx / size) + Math.floor(fy / size)) % 2 ? A : B;
}
function tatami(base, border) {
  const B = rgb(base), E = rgb(border);
  return (fx, fy, px, py) => {
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const along = (tx + ty) % 2 === 0;
    const u = along ? frac(fx) : frac(fy), v = along ? frac(fy / 2 + (tx % 2) * 0.5) : frac(fx / 2 + (ty % 2) * 0.5);
    if (u < 0.06 || v < 0.03) return E;
    return hash(px, py) > 0.9 ? shadeOf(B, 0.94) : (Math.floor(py) % 2 ? B : shadeOf(B, 0.97));
  };
}
function stone(colors, gap) {
  const cs = colors.map(rgb), G = rgb(gap);
  return (fx, fy) => {
    const row = Math.floor(fy * 1.5), shift = row % 2 ? 0.5 : 0;
    const col = Math.floor(fx * 1.2 + shift);
    if (frac(fy * 1.5) < 0.09 || frac(fx * 1.2 + shift) < 0.06) return G;
    return cs[Math.floor(hash(row, col) * cs.length)];
  };
}
function grass(colors, flowers) {
  const cs = colors.map(rgb), fl = flowers.map(rgb);
  return (fx, fy, px, py) => {
    const h = hash(px, py);
    if (h > 0.994) return fl[Math.floor(hash(py, px) * fl.length)];
    return cs[Math.floor(hash(Math.floor(px / 2), Math.floor(py / 2)) * cs.length)];
  };
}
function marble(a, b, vein, inlay) {
  const A = rgb(a), B = rgb(b), V = rgb(vein), I = rgb(inlay);
  return (fx, fy) => {
    if (frac(fx / 2) < 0.025 || frac(fy / 2) < 0.045) return I;
    const base = (Math.floor(fx) + Math.floor(fy)) % 2 ? A : B;
    const v = Math.sin(fx * 2.3 + fy * 1.1 + Math.sin(fy * 3.7) * 1.4 + hash(Math.floor(fx), Math.floor(fy)) * 9);
    return Math.abs(v) < 0.05 ? V : base;
  };
}
function grate(base, line) {
  const B = rgb(base), L = rgb(line);
  return (fx, fy) => frac(fx * 4) < 0.18 || frac(fy * 4) < 0.3 ? L : B;
}
function carpet(base, alt) { return speckle(base, [alt], 0.18); }

export const materials = {
  oak: planks(['#d6b386', '#cfac80', '#d8b98b', '#d4b589', '#ddbd8f'], '#b39170'),
  tatami: tatami('#cdc68e', '#6f7b55'),
  sage: carpet('#8fa891', '#7f987f'),
  concrete: concrete('#a3a199', ['#b5b3aa', '#94928a'], '#8b897f'),
  grate: grate('#5d666a', '#3a4044'),
  herringbone: herringbone(['#7a5236', '#8a6040', '#6b4630'], '#4e3322'),
  mustard: carpet('#d4a03a', '#c38a2c'),
  teal: carpet('#4f948d', '#3f8380'),
  terrazzo: speckle('#e4d9c3', ['#c4ae8e', '#d48a5c', '#6f9a8f', '#8b7f70', '#e9c77c'], 0.09),
  parquet: herringbone(['#b06a3c', '#c47d48', '#a0603a'], '#7a4428'),
  deck: planks(['#c49a6e', '#b88d60', '#cfa676'], '#8c6a48', { along: 'y', rows: 3 }),
  moss: carpet('#7d9a63', '#6f8f55'),
  stone: stone(['#8f978d', '#9aa197', '#858d84', '#a2a89c'], '#6f8f55'),
  grass: grass(['#6f9a55', '#78a55d', '#668f4e'], ['#f2c94c', '#f0a1b8', '#ffffff']),
  navy: carpet('#26304a', '#2d3856'),
  marble: marble('#ece9e3', '#e2ded6', '#bdb7ae', '#c9a45c'),
  walnut: herringbone(['#5a3a26', '#6b4630', '#4f3220'], '#2e1d14'),
  kitchen: tiles('#e8e4da', '#cfd8d4', '#b9b4aa', 0.5)
};

/* ---------- Wall elevations ---------- */
const views = {
  studio: {},
  loft: { minH: 5, maxH: 20, bodies: ['#8fb0b2', '#7ea2ab'] },
  mid: { minH: 4, maxH: 15, sky: ['#f0b98a', '#f5d2a2', '#e49a72'], cloud: ['#f7e2c4', '#fff2dc'], bodies: ['#c79a86', '#b98c7a'], side: '#a67a6c', lit: '#f5ddb0', dark: '#a98479', ground: '#9c9d74', groundLight: '#b4b285' },
  forest: { mountains: true, sky: ['#94cde0', '#bfe4ea', '#82bed5'], cloud: ['#eef6f2', '#ffffff'] },
  penthouse: { sky: ['#1a2142', '#2b2f5a', '#151a35', '#4a3a66'], clouds: false, stars: true, bodies: ['#232a45', '#2a3150'], side: '#1b2138', lit: '#f3d38a', dark: '#3a4266', minH: 4, maxH: 18, ground: null, moon: 40 }
};

export const themes = {
  studio: {
    backdrop: '#3d4f52', slab: ['#8d735c', '#6f5a48'], cap: ['#8f9c8e', '#eef0e0'],
    partition: { h: 18, top: '#e8c896', left: '#c9a77c', right: '#a8855e' },
    base(p, L, H) {
      p.box(0, 0, L, H, '#d9dcc6');
      for (let x = 5; x < L; x += 9) p.box(x, 4, 1, H - 18, '#cdd2bb');
      p.box(0, H - 15, L, 11, '#b08a62'); p.box(0, H - 15, L, 2, '#d8b48a'); p.box(0, H - 4, L, 4, '#7a5f48');
      for (let x = 8; x < L; x += 16) p.box(x, H - 12, 1, 8, '#9c7650');
    },
    frame: ['#6d7f76', '#e9dfc0'], board: { frame: '#6a7169', face: '#d8caa5' }, shelf: { wood: '#8a6a50', back: '#6e5440' },
    desk: { top: '#d4a470', left: '#b77f59', right: '#9c6a48', edge: '#efc693' },
    fabric: { sofa: ['#72917c', '#5f7f6a', '#496258'], chair: '#90776a' }, wood: ['#c99a6a', '#a87a52', '#8a6440'],
    door: { frame: '#606e66', face: '#bd9878', glass: '#91ada8', label: '1F' }
  },
  loft: {
    backdrop: '#262b2e', slab: ['#5e5d56', '#46453f'], cap: ['#2c3135', '#4b5357'],
    partition: { h: 18, top: '#3a4044', left: '#2c3135', right: '#22272a' },
    glass: { top: '#2c3135', pane: '#9fc4d040', frame: '#2c3135' },
    base(p, L, H) {
      p.box(0, 0, L, H, '#b59a83');
      const bricks = ['#9a5443', '#8c4a3b', '#a5604b', '#83432f', '#97513f'];
      for (let r = 0; 6 + r * 4 < H - 6; r++) for (let x = -(r % 2) * 5; x < L; x += 10) p.box(x, 6 + r * 4, 9, 3, bricks[Math.floor(hash(x, r) * bricks.length)]);
      p.box(0, 0, L, 5, '#2c3135'); p.box(0, 5, L, 1, '#4b5357');
      for (let x = 4; x < L; x += 12) p.box(x, 2, 1, 1, '#6c767b');
      p.box(0, 8, L, 3, '#8f989b'); p.box(0, 8, L, 1, '#c3cacb');
      p.box(0, H - 6, L, 6, '#3a4044'); p.box(0, H - 6, L, 1, '#5e676b');
    },
    frame: ['#1f2427', '#232a2d'], board: { frame: '#5b3f2a', face: '#2f4538', chalk: true }, shelf: { wood: '#2a2f33', back: '#3a3f42' },
    desk: { top: '#7a5236', left: '#5d3d28', right: '#4a3020', edge: '#9b6a45', legs: '#2b2b2b' },
    fabric: { sofa: ['#a86538', '#8f532f', '#4e2c19'], chair: '#3a3a40' }, wood: ['#8b6342', '#6b4c33', '#4e3524'],
    door: { frame: '#2a3033', face: '#6e787b', glass: '#5d666a', label: '2F', freight: true }
  },
  mid: {
    backdrop: '#5b3622', slab: ['#5e3a26', '#4a2c1c'], cap: ['#6f7c43', '#a5ad6a'],
    partition: { h: 20, top: '#c98a57', left: '#a8653a', right: '#7f4a2a' },
    base(p, L, H) {
      p.box(0, 0, L, H, '#eedcb0');
      p.box(0, 0, L, 4, '#6f7c43');
      for (let x = 0; x < L; x += 4) { p.box(x, H - 20, 3, 16, '#a8653a'); p.box(x + 3, H - 20, 1, 16, '#7f4a2a'); }
      p.box(0, H - 21, L, 1, '#c98a57'); p.box(0, H - 4, L, 4, '#5e3a26');
    },
    frame: ['#7a4428', '#7a4428'], arch: true, board: { frame: '#2f6d69', face: '#3f8a86', shapes: true }, shelf: { wood: '#7a4428', back: '#5b3622' },
    desk: { top: '#b06a3c', left: '#8a5030', right: '#6b3a22', edge: '#cf8a55', legs: '#5b3622' },
    fabric: { sofa: ['#de7f4c', '#c9683a', '#9a4a28'], chair: '#d4a03a' }, wood: ['#b06a3c', '#8a5030', '#6b3a22'],
    door: { frame: '#8a5a24', face: '#a5643a', glass: '#c98a57', label: '3F' }
  },
  forest: {
    backdrop: '#2f4a3a', slab: ['#5d5f56', '#45473f'], cap: ['#d5eef3', '#7a5a3c'],
    partition: { h: 14, top: '#5f9160', left: '#4d7f58', right: '#3f6c51', hedge: true },
    base(p, L, H) {
      p.box(0, 0, L, H, '#b48a5f');
      for (let x = 0; x < L; x += 7) { p.box(x, 6, 1, H, '#9c7550'); p.box(x + 3, 6, 1, H, '#c49b6e'); }
      p.box(0, 0, L, 6, '#d5eef3'); for (let x = 0; x < L; x += 18) p.box(x, 0, 2, 6, '#7a5a3c'); p.box(0, 5, L, 2, '#6e4f34');
      p.box(0, H - 10, L, 6, '#6e4f34');
      for (let x = 0; x < L; x += 3) { const hh = 2 + Math.floor(hash(x, 9) * 5); p.box(x, H - 10 - hh, 2, hh, ['#4d7f58', '#5f9160', '#3f6c51', '#78a565'][Math.floor(hash(x, 4) * 4)]); }
      p.box(0, H - 4, L, 4, '#5d5f56');
    },
    frame: ['#6e4f34', '#6e4f34'], board: { frame: '#5f8a4a', face: '#c9a475', cork: true }, shelf: { wood: '#6e4f34', back: '#5e4329' },
    desk: { top: '#d9c29a', left: '#bfa67e', right: '#a08a62', edge: '#efdcb6', legs: '#8c7452' },
    fabric: { sofa: ['#8fae8a', '#7d9c78', '#5f7f5c'], chair: '#7d9c78' }, wood: ['#c49a68', '#a07a52', '#8a6440'],
    door: { frame: '#5e4329', face: '#8c6a48', glass: '#7a5a3c', label: '4F' }
  },
  penthouse: {
    backdrop: '#0f1320', slab: ['#141927', '#0c0f18'], cap: ['#151a28', '#c9a45c'],
    partition: { h: 22, top: '#c9a45c', left: '#9fc4d040', right: '#9fc4d030' },
    glass: { top: '#c9a45c', pane: '#a8c8e838', frame: '#c9a45c' },
    base(p, L, H) {
      p.box(0, 0, L, H, '#1f2638');
      for (let x = 8; x < L; x += 24) p.box(x, 5, 1, H - 10, '#c9a45c40');
      p.box(0, 0, L, 4, '#151a28'); p.box(0, 4, L, 1, '#c9a45c'); p.box(0, H - 5, L, 5, '#141927'); p.box(0, H - 5, L, 1, '#c9a45c');
    },
    frame: ['#c9a45c', '#c9a45c'], tall: true, board: { frame: '#c9a45c', face: '#2b2e36', dark: true }, shelf: { wood: '#2d2540', back: '#3b3150' },
    desk: { top: '#2a2b30', left: '#1d1e22', right: '#141518', edge: '#c9a45c', legs: '#c9a45c' },
    fabric: { sofa: ['#4b8a72', '#2f6b57', '#1c4033'], chair: '#2a2b30' }, wood: ['#3a2a20', '#2a1d14', '#1a120c'],
    door: { frame: '#a8843f', face: '#b8955a', glass: '#e3c27a', label: 'PH' }
  }
};
for (const [name, theme] of Object.entries(themes)) theme.view = views[name];

const TILE = 16; // elevation pixels per tile along a wall

function windowFeature(p, t, x, w, H, seed) {
  const top = t.tall ? 6 : 9, bottom = t.tall ? H - 6 : H - 18, h = bottom - top;
  p.box(x - 2, top - 2, w + 4, h + 4, t.frame[0]);
  windowView(p, x, top, w, h, seed, t.view);
  for (let xx = x + Math.floor(w / 3); xx < x + w - 2; xx += Math.max(8, Math.floor(w / 3))) p.box(xx, top, 1, h, t.frame[0]);
  if (!t.tall) p.box(x, top + Math.floor(h * 0.35), w, 1, t.frame[0]);
  if (t.arch) for (let i = 0; i < 5; i++) { const inset = [6, 4, 2, 1, 1][i]; p.box(x - 2, top - 2 + i, inset, 1, '#eedcb0'); p.box(x + w + 2 - inset, top - 2 + i, inset, 1, '#eedcb0'); }
  p.ctx.save(); p.ctx.beginPath(); p.ctx.rect(x, top, w, h); p.ctx.clip();
  p.poly([[x + 6, top], [x + 10, top], [x + 2, bottom], [x - 2, bottom]], '#ffffff22');
  p.ctx.restore();
  if (!t.tall) { p.box(x - 3, bottom + 2, w + 6, 2, t.frame[1]); p.box(x - 3, bottom + 4, w + 6, 1, '#00000030'); }
}

function boardFeature(p, t, x, w, H) {
  const b = t.board, top = 10, h = Math.min(20, H - 30);
  p.trim(x, top, w, h, b.frame, b.face);
  if (b.chalk) { p.box(x + 3, top + 4, w - 10, 1, '#d8dccf'); p.box(x + 3, top + 8, w - 14, 1, '#b9c3b4'); p.box(x + w - 9, top + 5, 6, 5, '#c9d1c4'); p.box(x + w - 8, top + 6, 4, 3, b.face); }
  else if (b.shapes) { p.oval(x + 7, top + 9, 4, 4, '#e07a42'); p.box(x + 14, top + 5, 8, 8, '#e5b046'); p.poly([[x + w - 12, top + 14], [x + w - 3, top + 14], [x + w - 7, top + 4]], '#6f7c43'); }
  else if (b.dark) { p.box(x + 3, top + 4, w - 8, 1, '#c9a45c'); p.box(x + 3, top + 8, w - 12, 1, '#8fa4d6'); p.box(x + 3, top + 12, w - 16, 1, '#e8f0ff'); }
  else {
    p.box(x + 3, top + 3, 8, 7, b.cork ? '#f3ead2' : '#ede1ba'); p.box(x + 4, top + 5, 6, 1, '#8bada1');
    p.box(x + 13, top + 3, 7, 5, b.cork ? '#eaf3df' : '#d6ae72'); p.box(x + w - 9, top + 9, 6, 6, '#c1d1b5'); p.box(x + 5, top + 13, 10, 1, '#7c6a58');
  }
  p.box(x + 2, top + h, w - 4, 2, '#00000025');
}

function shelfFeature(p, t, x, w, H) {
  const s = t.shelf, top = 8, h = H - 14;
  p.box(x, top, w, h, s.back);
  p.box(x, top, 2, h, s.wood); p.box(x + w - 2, top, 2, h, s.wood);
  for (let row = top + 10; row < top + h; row += 10) {
    p.box(x, row, w, 2, s.wood);
    books(p, x + 3, row, w - 6, row * 13 + x);
  }
  p.box(x, top, w, 2, s.wood);
}

function barFeature(p, t, x, w, H) {
  p.trim(x, 6, w, H - 12, '#c9a45c', '#2d2540'); p.box(x + 2, 8, w - 4, 12, '#4b3d66');
  const bottles = ['#3f7a4a', '#a8433a', '#d9b25a', '#5a7ab0', '#7a3f6a', '#e7e1cf'];
  for (const row of [22, 34, 46]) {
    if (row > H - 8) break;
    p.box(x + 2, row, w - 4, 1, '#d8e2ef');
    for (let i = 0; i * 5 + 4 < w - 3; i++) { const bh = 6 + (i * 3 + row) % 4; p.box(x + 4 + i * 5, row - bh, 3, bh, bottles[(i + row) % bottles.length]); p.box(x + 5 + i * 5, row - bh - 2, 1, 2, bottles[(i + row) % bottles.length]); }
  }
}

function doorFeature(p, t, x, w, H) {
  const d = t.door, top = H - 40;
  p.trim(x, top, w, 40 - 3, d.frame, d.face);
  p.box(x + Math.floor(w / 2) - 1, top + 6, 2, 31, d.frame);
  if (d.freight) for (let i = x + 3; i < x + w - 3; i += 3) p.box(i, top + 6, 1, 30, '#5d666a');
  else { p.box(x + 4, top + 9, Math.floor(w / 2) - 7, 14, d.glass); p.box(x + Math.floor(w / 2) + 3, top + 9, Math.floor(w / 2) - 7, 14, d.glass); }
  p.trim(x + Math.floor(w / 2) - 7, top - 7, 14, 7, d.frame, '#1d2326');
  pixelText(p, x + Math.floor(w / 2) - 4, top - 6, d.label, '#f2b04a');
}

function clockFeature(p, x) {
  p.oval(x, 18, 6, 6, '#65746a'); p.oval(x, 18, 5, 5, '#f1e7bc'); p.box(x, 14, 1, 4, '#535b55'); p.box(x, 18, 3, 1, '#8b6753');
}

// Paints one back wall. Features are placed in tiles from the room corner; the west wall reads right-to-left.
export function paintWall(themeName, side, lengthTiles, H, features, placed = {}, seed = 1) {
  const t = themes[themeName];
  const L = Math.round(lengthTiles * TILE);
  const canvas = document.createElement('canvas');
  canvas.width = L; canvas.height = H;
  const p = painter(canvas);
  t.base(p, L, H);
  const span = (u, len) => side === 'north' ? Math.round(u * TILE) : Math.round(L - (u + len) * TILE);
  const centre = u => side === 'north' ? Math.round(u * TILE) : Math.round(L - u * TILE);
  for (const f of features) {
    const len = f.len || 1, x = span(f.u, len), w = Math.round(len * TILE);
    if (f.kind === 'window' || f.kind === 'glass') windowFeature(p, f.kind === 'glass' ? { ...t, tall: true } : t, x, w, H, seed + Math.round(f.u * 31));
    else if (f.kind === 'board') boardFeature(p, t, x, w, H);
    else if (f.kind === 'shelf') shelfFeature(p, t, x, w, H);
    else if (f.kind === 'bar') barFeature(p, t, x, w, H);
    else if (f.kind === 'door') doorFeature(p, t, x, w, H);
    else if (f.kind === 'clock') clockFeature(p, centre(f.u));
    else if (f.kind === 'slot' && placed[f.id]) { drawWallArt(p, placed[f.id], centre(f.u), 6); drawWallArtLive(p, placed[f.id], centre(f.u), 6, 1); }
  }
  // Cap along the top of the wall.
  p.box(0, 0, L, 2, t.cap[0]); p.box(0, 2, L, 1, t.cap[1]);
  return canvas;
}
