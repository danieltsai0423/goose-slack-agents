// Isometric props, desks, bought furniture and chibi characters. Every drawer takes the iso painter
// (see iso.js) and tile coordinates; nothing here keeps state.
import { drawEmotion } from './furniture.js';

export function shade(hex, k) {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('') + (hex.length > 7 ? hex.slice(7) : '');
}
export const tone = (hex, edge) => ({ top: hex, left: shade(hex, 0.82), right: shade(hex, 0.66), edge });

function shadowAt(p, x, y, rx = 0.42, ry = 0.42) {
  p.poly([p.at(x - rx, y, 0), p.at(x, y - ry, 0), p.at(x + rx, y, 0), p.at(x, y + ry, 0)], '#00000022');
}
// A round top seen in isometric: an ellipse traced through tile space.
function disc(p, cx, cy, z, r, color) {
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push(p.at(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
  p.poly(pts, color);
}
function cylinder(p, cx, cy, z, r, h, color) {
  for (let k = 0; k < h; k++) disc(p, cx, cy, z + k, r, k === h - 1 ? color : shade(color, 0.78));
}
function leaves(p, sx, sy, r, palette, seed = 0) {
  const blobs = [[0, 0, 1], [-0.6, 0.3, 0.7], [0.6, 0.35, 0.72], [-0.2, -0.55, 0.65], [0.35, -0.4, 0.6]];
  blobs.forEach(([dx, dy, k], i) => p.oval(Math.round(sx + dx * r), Math.round(sy + dy * r), Math.max(2, Math.round(r * k)), Math.max(2, Math.round(r * k * 0.8)), palette[(i + seed) % palette.length]));
  p.box(Math.round(sx - r * 0.3), Math.round(sy - r * 0.5), Math.max(2, Math.round(r * 0.5)), 1, '#a9c98a');
}
const greens = ['#568459', '#649353', '#488262', '#5e8f57'];

/* ---------- Built-in props ---------- */
export const props = {
  plant(p, o) {
    const cx = o.x + 0.5, cy = o.y + 0.5;
    shadowAt(p, cx, cy, 0.3, 0.3);
    p.prism(o.x + 0.3, o.y + 0.3, 0, 0.4, 0.4, 8, tone('#c0795a'));
    p.onTop(o.x + 0.3, o.y + 0.3, 8, 0.05, 0.05, 0.3, 0.3, '#5a4030');
    const [sx, sy] = p.at(cx, cy, 18);
    p.box(sx, sy + 2, 1, 8, '#425b41');
    leaves(p, sx, sy, 7, greens, o.x + o.y);
  },
  tree(p, o) {
    const cx = o.x + 0.5, cy = o.y + 0.5;
    shadowAt(p, cx, cy, 0.48, 0.48);
    p.prism(o.x + 0.25, o.y + 0.25, 0, 0.5, 0.5, 6, tone('#8a7a6a'));
    const [sx, sy] = p.at(cx, cy, 6);
    p.box(sx - 1, sy - 22, 3, 22, '#6a4a32');
    leaves(p, sx, sy - 30, 11, ['#3f6c51', '#4d7f58', '#5f9160', '#466f4a'], 1);
    leaves(p, sx + 2, sy - 40, 8, ['#5f9160', '#78a565', '#4d7f58'], 2);
  },
  shelf(p, o, t) {
    const c = tone(t.wood[1]);
    p.prism(o.x + 0.08, o.y + 0.12, 0, 0.84, 0.76, 34, c);
    const colors = ['#a95a4f', '#84a4a0', '#e6be7c', '#617e86', '#c38162', '#668984'];
    for (const v of [4, 15, 26]) {
      for (let i = 0; i < 6; i++) {
        const u = 0.1 + i * 0.12, hgt = 6 + (i * 3 + v) % 3;
        if (o.dir === 'y') p.onRight(o.x + 0.08, o.y + 0.12, 0.84, u, v, 0.09, hgt, colors[(i + v) % colors.length]);
        else p.onLeft(o.x + 0.08, o.y + 0.12, 0.76, u, v, 0.1, hgt, colors[(i + v) % colors.length]);
      }
    }
  },
  cabinet(p, o, t) {
    p.prism(o.x + 0.08, o.y + 0.12, 0, 0.84, 0.76, 15, tone(t.wood[0]));
    for (const v of [4, 9]) {
      if (o.dir === 'y') p.onRight(o.x + 0.08, o.y + 0.12, 0.84, 0.1, v, 0.56, 1, shade(t.wood[0], 0.55));
      else p.onLeft(o.x + 0.08, o.y + 0.12, 0.76, 0.1, v, 0.64, 1, shade(t.wood[0], 0.55));
    }
    const [sx, sy] = p.at(o.x + 0.5, o.y + 0.5, 15);
    p.box(sx - 3, sy - 5, 4, 5, '#e5d5b9'); p.box(sx + 2, sy - 3, 3, 3, '#8da397');
  },
  sofa(p, o, t) {
    const [main, mid, dark] = t.fabric.sofa, len = o.len || 2;
    if (o.dir === 'y') {
      p.prism(o.x + 0.05, o.y, 0, 0.3, len, 20, tone(dark));
      p.prism(o.x + 0.3, o.y, 0, 0.62, len, 9, tone(mid));
      for (let i = 0; i < len; i++) p.prism(o.x + 0.32, o.y + i + 0.08, 9, 0.56, 0.84, 3, tone(main));
      p.prism(o.x + 0.3, o.y, 0, 0.62, 0.12, 13, tone(dark)); p.prism(o.x + 0.3, o.y + len - 0.12, 0, 0.62, 0.12, 13, tone(dark));
    } else {
      p.prism(o.x, o.y + 0.05, 0, len, 0.3, 20, tone(dark));
      p.prism(o.x, o.y + 0.3, 0, len, 0.62, 9, tone(mid));
      for (let i = 0; i < len; i++) p.prism(o.x + i + 0.08, o.y + 0.32, 9, 0.84, 0.56, 3, tone(main));
      p.prism(o.x, o.y + 0.3, 0, 0.12, 0.62, 13, tone(dark)); p.prism(o.x + len - 0.12, o.y + 0.3, 0, 0.12, 0.62, 13, tone(dark));
    }
  },
  armchair(p, o, t) { props.sofa(p, { ...o, len: 1, dir: 'x' }, t); },
  table(p, o, t) {
    const len = o.len || 1, w = o.dir === 'y' ? 1 : len, d = o.dir === 'y' ? len : 1;
    p.prism(o.x + 0.12, o.y + 0.15, 0, w - 0.24, d - 0.3, 8, tone(t.wood[0], shade(t.wood[0], 1.15)));
    const [sx, sy] = p.at(o.x + w / 2, o.y + d / 2, 8);
    p.box(sx - 5, sy - 3, 3, 3, '#f2eadb'); p.box(sx + 2, sy - 2, 5, 2, '#698280');
  },
  roundTable(p, o, t) {
    const cx = o.x + 1, cy = o.y + 1;
    for (const [dx, dy] of [[-0.85, 0], [0.85, 0], [0, -0.85], [0, 0.85]]) p.prism(cx + dx - 0.18, cy + dy - 0.18, 0, 0.36, 0.36, 7, tone(t.fabric.chair));
    p.prism(cx - 0.1, cy - 0.1, 0, 0.2, 0.2, 11, tone('#5a5a5a'));
    cylinder(p, cx, cy, 11, 0.72, 2, t.wood[0]);
    const [sx, sy] = p.at(cx, cy, 13);
    p.box(sx - 6, sy - 2, 5, 3, '#f2eadb'); p.box(sx + 2, sy - 1, 4, 2, '#e5b046');
  },
  longTable(p, o, t) {
    for (const [dx, dy] of [[-0.35, 0.3], [-0.35, 1.2], [2.0, 0.3], [2.0, 1.2], [0.4, -0.35], [1.2, -0.35]]) p.prism(o.x + dx, o.y + dy, 0, 0.32, 0.32, 7, tone(t.fabric.chair));
    p.prism(o.x + 0.1, o.y + 0.1, 0, 1.8, 1.8, 12, tone(t.wood[0], shade(t.wood[0], 1.15)));
    for (const [u, v] of [[0.3, 0.4], [1.2, 0.6], [0.6, 1.3]]) p.onTop(o.x + 0.1, o.y + 0.1, 12, u, v, 0.3, 0.2, '#f2eadb');
  },
  counter(p, o, t) {
    const len = o.len || 2, w = o.dir === 'y' ? 1 : len, d = o.dir === 'y' ? len : 1;
    p.prism(o.x + 0.05, o.y + 0.05, 0, w - 0.1, d - 0.1, 15, tone(t.wood[1], shade(t.wood[1], 1.2)));
    p.prism(o.x + 0.02, o.y + 0.02, 15, w - 0.04, d - 0.04, 2, tone('#e8e4da'));
    p.prism(o.x + 0.2, o.y + 0.2, 17, 0.4, 0.35, 9, tone('#8a9498'));
    const [sx, sy] = p.at(o.x + w - 0.5, o.y + d - 0.5, 17);
    p.box(sx - 3, sy - 4, 3, 4, '#f2eadb'); p.box(sx + 1, sy - 3, 3, 3, '#c9683a');
  },
  stool(p, o, t) { p.prism(o.x + 0.42, o.y + 0.42, 0, 0.16, 0.16, 8, tone('#2a2a2e')); cylinder(p, o.x + 0.5, o.y + 0.5, 8, 0.26, 2, t.fabric.chair); },
  rack(p, o, t, tick) {
    p.prism(o.x + 0.1, o.y + 0.15, 0, 0.8, 0.7, 36, tone('#3a4448'));
    for (let v = 5; v < 34; v += 6) {
      p.onLeft(o.x + 0.1, o.y + 0.15, 0.7, 0.08, v, 0.64, 4, '#26303a');
      p.onLeft(o.x + 0.1, o.y + 0.15, 0.7, 0.6, v + 1, 0.06, 2, (tick + v) % 7 < 4 ? '#7af07a' : '#2f5f3a');
      p.onLeft(o.x + 0.1, o.y + 0.15, 0.7, 0.5, v + 1, 0.06, 2, (tick * 3 + v) % 11 < 2 ? '#f2b04a' : '#5a4a2a');
    }
  },
  bench(p, o, t) {
    p.prism(o.x + 0.08, o.y + 0.1, 0, 0.84, 0.8, 13, tone(t.wood[1], shade(t.wood[1], 1.2)));
    p.prism(o.x + 0.2, o.y + 0.25, 13, 0.25, 0.2, 3, tone('#b7cbca'));
    p.prism(o.x + 0.55, o.y + 0.45, 13, 0.2, 0.3, 5, tone('#c94a3a'));
    const [sx, sy] = p.at(o.x + 0.4, o.y + 0.7, 13); p.box(sx, sy - 2, 5, 1, '#526866');
  },
  boardStand(p, o) {
    p.prism(o.x + 0.2, o.y + 0.45, 0, 0.06, 0.06, 12, tone('#6a7169')); p.prism(o.x + 0.75, o.y + 0.45, 0, 0.06, 0.06, 12, tone('#6a7169'));
    p.prism(o.x + 0.12, o.y + 0.42, 12, 0.78, 0.1, 20, { top: '#6a7169', left: '#f4f1e6', right: '#6a7169' });
    p.onLeft(o.x + 0.12, o.y + 0.42, 0.1, 0.12, 22, 0.3, 1, '#8bada1'); p.onLeft(o.x + 0.12, o.y + 0.42, 0.1, 0.12, 18, 0.45, 1, '#c98a57');
    p.onLeft(o.x + 0.12, o.y + 0.42, 0.1, 0.52, 15, 0.18, 9, '#c1d1b5');
  },
  pillar(p, o, t, tick, wallH) { p.prism(o.x + 0.28, o.y + 0.28, 0, 0.44, 0.44, wallH, tone(t.partition.left === '#9fc4d040' ? '#2b3248' : t.partition.left)); },
  flowerBed(p, o) {
    p.prism(o.x + 0.08, o.y + 0.08, 0, 0.84, 0.84, 7, tone('#8a6a4a'));
    p.onTop(o.x + 0.08, o.y + 0.08, 7, 0.05, 0.05, 0.74, 0.74, '#5a4030');
    for (let i = 0; i < 7; i++) {
      const [sx, sy] = p.at(o.x + 0.2 + (i * 0.37) % 0.6, o.y + 0.2 + (i * 0.23) % 0.6, 7);
      p.box(sx, sy - 4, 1, 4, '#4d7f58'); p.box(sx - 1, sy - 6, 3, 2, ['#f2c94c', '#f0a1b8', '#e07a42', '#ffffff'][i % 4]);
    }
  },
  fountainBig(p, o, t, tick) {
    const cx = o.x + 1, cy = o.y + 1;
    cylinder(p, cx, cy, 0, 0.95, 7, '#8f978d');
    disc(p, cx, cy, 7, 0.82, '#7fc3d3');
    disc(p, cx - 0.2 + (tick % 5) * 0.08, cy + 0.3, 7, 0.12, '#d8f3f8');
    p.prism(cx - 0.15, cy - 0.15, 0, 0.3, 0.3, 18, tone('#a2aca7'));
    cylinder(p, cx, cy, 18, 0.35, 2, '#8f978d');
    const [sx, sy] = p.at(cx, cy, 20);
    p.box(sx - 1, sy - 8, 2, 8, '#c7ecf3');
    for (const dx of [-5, 5]) p.box(sx + dx + (dx > 0 ? tick % 2 : -(tick % 2)), sy - 4 + (tick % 3), 1, 3, '#e8f8fb');
  }
};

/* ---------- Desks and chairs ---------- */
export function drawDesk(p, [x, y, dir], t, { team, lead, busy, tick }) {
  const c = tone(t.desk.top, t.desk.edge), accent = team === 'claude' ? '#c67858' : '#5e91aa';
  const along = dir !== 'y';
  const X = along ? x + 0.04 : x + 0.18, Y = along ? y + 0.18 : y + 0.04, W = along ? 1.92 : 0.7, D = along ? 0.7 : 1.92;
  p.prism(X, Y, 0, W, D, 12, c);
  if (along) p.onLeft(X, Y, D, 0.15, 3, 1.62, 2, accent); else p.onRight(X, Y, W, 0.15, 3, 1.62, 2, accent);
  // Keyboard in front of the seat, monitor on the far half (its back faces the room).
  if (along) {
    p.onTop(X, Y, 12, 0.35, 0.1, 0.5, 0.2, '#d0c4a5');
    p.prism(x + 1.4, y + 0.42, 12, 0.12, 0.12, 3, tone('#6f7c80'));
    p.prism(x + 1.18, y + 0.36, 15, 0.56, 0.08, 10, { top: '#5d6a6e', left: '#8b989c', right: '#6f7c80' });
    p.onLeft(x + 1.18, y + 0.36, 0.08, 0.06, 15.5, 0.44, 1, busy ? (tick % 4 < 2 ? '#9ff0c0' : '#83c5a0') : '#a9b4b6');
    p.onLeft(x + 1.18, y + 0.36, 0.08, 0.25, 20, 0.06, 2, '#c9d2d4');
    const [mx, my] = p.at(x + 0.25, y + 0.55, 12);
    p.box(mx - 2, my - 4, 3, 4, '#f2eadb'); p.box(mx + 1, my - 3, 1, 2, '#f2eadb');
    if (lead) { const [lx, ly] = p.at(x + 1.85, y + 0.75, 12); p.box(lx - 6, ly - 4, 9, 4, accent); p.box(lx - 5, ly - 3, 7, 1, '#fff4d2'); }
  } else {
    p.onTop(X, Y, 12, 0.1, 0.35, 0.2, 0.5, '#d0c4a5');
    p.prism(x + 0.42, y + 1.4, 12, 0.12, 0.12, 3, tone('#6f7c80'));
    p.prism(x + 0.36, y + 1.18, 15, 0.08, 0.56, 10, { top: '#5d6a6e', left: '#6f7c80', right: '#8b989c' });
    p.onRight(x + 0.36, y + 1.18, 0.08, 0.06, 15.5, 0.44, 1, busy ? (tick % 4 < 2 ? '#9ff0c0' : '#83c5a0') : '#a9b4b6');
    p.onRight(x + 0.36, y + 1.18, 0.08, 0.25, 20, 0.06, 2, '#c9d2d4');
    const [mx, my] = p.at(x + 0.55, y + 0.25, 12);
    p.box(mx - 2, my - 4, 3, 4, '#f2eadb');
    if (lead) { const [lx, ly] = p.at(x + 0.75, y + 1.85, 12); p.box(lx - 2, ly - 4, 9, 4, accent); p.box(lx - 1, ly - 3, 7, 1, '#fff4d2'); }
  }
}

export function drawChair(p, seat, t, team) {
  const [px, py] = seat.point, fabric = team === 'claude' ? '#90776a' : '#577b84';
  if (seat.facing === 'sw') {
    p.prism(px - 0.22, py - 0.28, 0, 0.44, 0.1, 21, tone(fabric));
    p.prism(px - 0.22, py - 0.2, 6, 0.44, 0.38, 3, tone(fabric));
  } else {
    p.prism(px - 0.28, py - 0.22, 0, 0.1, 0.44, 21, tone(fabric));
    p.prism(px - 0.2, py - 0.22, 6, 0.38, 0.44, 3, tone(fabric));
  }
}

/* ---------- Bought furniture (one tile each) ---------- */
export const furnitureIso = {
  bonsai(p, x, y) {
    p.prism(x + 0.22, y + 0.3, 0, 0.56, 0.4, 5, tone('#3d4a55'));
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 5);
    p.box(sx - 1, sy - 9, 2, 9, '#6a4a32'); p.box(sx + 1, sy - 11, 3, 2, '#6a4a32');
    p.oval(sx - 5, sy - 9, 4, 2, '#3f6c51'); p.oval(sx + 4, sy - 13, 5, 3, '#4d7f58'); p.oval(sx, sy - 15, 3, 2, '#5f9160');
  },
  beanbag(p, x, y) { const [sx, sy] = p.at(x + 0.5, y + 0.5, 0); p.oval(sx, sy - 4, 10, 5, '#a04a3a'); p.oval(sx - 1, sy - 6, 8, 4, '#c45c47'); p.oval(sx - 3, sy - 8, 4, 2, '#d97a62'); },
  'espresso-bar'(p, x, y, tick) {
    p.prism(x + 0.08, y + 0.1, 0, 0.84, 0.8, 14, tone('#8c6a4e'));
    p.prism(x + 0.2, y + 0.2, 14, 0.5, 0.35, 11, tone('#c98a4a', '#e8b070'));
    const [sx, sy] = p.at(x + 0.5, y + 0.7, 14);
    p.box(sx - 4, sy - 3, 3, 3, '#f2eadb'); p.box(sx + 2, sy - 3, 3, 3, '#f2eadb');
    if (tick % 5 < 3) p.box(sx - 3 + (tick % 2), sy - 8 - (tick % 3), 1, 3, '#f2eadb90');
  },
  fridge(p, x, y) {
    p.prism(x + 0.12, y + 0.12, 0, 0.76, 0.76, 30, { top: '#d8e2e4', left: '#a8d4dc', right: '#9aa6aa' });
    const items = ['#e0604a', '#f2c94c', '#6fb07a', '#f0a1b8', '#5a8fd0'];
    for (const v of [6, 14, 22]) for (let i = 0; i < 4; i++) p.onLeft(x + 0.12, y + 0.12, 0.76, 0.08 + i * 0.17, v, 0.1, 5, items[(i + v) % items.length]);
  },
  record(p, x, y, tick) {
    p.prism(x + 0.1, y + 0.15, 0, 0.8, 0.7, 12, tone('#8a5634'));
    disc(p, x + 0.5, y + 0.5, 12, 0.3, '#141414');
    disc(p, x + 0.5, y + 0.5, 12, 0.1, tick % 2 ? '#c9683a' : '#e5b046');
    const [sx, sy] = p.at(x + 0.75, y + 0.3, 12); p.box(sx, sy - 6, 1, 6, '#c9a45c');
    if (tick % 8 < 4) { const [nx, ny] = p.at(x + 0.5, y + 0.5, 22); p.box(nx + 6, ny - (tick % 4), 2, 3, '#e5b046'); }
  },
  aquarium(p, x, y, tick) {
    p.prism(x + 0.05, y + 0.15, 0, 0.9, 0.7, 8, tone('#4a3a2e'));
    p.prism(x + 0.05, y + 0.15, 8, 0.9, 0.7, 14, { top: '#8fd0e0aa', left: '#5fa8c0cc', right: '#4f8fa8cc' });
    for (const [i, c] of [[0, '#f29a3a'], [1, '#f2e04a'], [2, '#e05a8a']]) {
      const u = ((tick * (i + 1) * 0.04 + i * 0.3) % 0.7) + 0.1;
      p.onLeft(x + 0.05, y + 0.15, 0.7, u, 11 + i * 3, 0.09, 2, c);
    }
    p.onLeft(x + 0.05, y + 0.15, 0.7, 0.05, 8, 0.8, 2, '#d8c79a');
  },
  arcade(p, x, y, tick) {
    p.prism(x + 0.15, y + 0.15, 0, 0.7, 0.7, 30, tone('#3a2f7a'));
    p.onLeft(x + 0.15, y + 0.15, 0.7, 0.1, 15, 0.5, 9, ['#40c0f0', '#2a6a9a', '#e0508a', '#7af07a'][tick % 4]);
    p.onLeft(x + 0.15, y + 0.15, 0.7, 0.05, 26, 0.6, 3, '#e0508a');
    p.onLeft(x + 0.15, y + 0.15, 0.7, 0.2, 10, 0.1, 2, '#e04040');
  },
  'massage-chair'(p, x, y) {
    p.prism(x + 0.15, y + 0.2, 0, 0.7, 0.6, 9, tone('#4a4a52'));
    p.prism(x + 0.15, y + 0.15, 0, 0.7, 0.2, 24, tone('#2a2a2e'));
    p.prism(x + 0.1, y + 0.2, 0, 0.12, 0.6, 14, tone('#3a3a40')); p.prism(x + 0.78, y + 0.2, 0, 0.12, 0.6, 14, tone('#3a3a40'));
    p.onLeft(x + 0.15, y + 0.15, 0.2, 0.2, 16, 0.3, 1, '#c9a45c');
  },
  piano(p, x, y) {
    p.prism(x + 0.05, y + 0.1, 0, 0.9, 0.4, 24, tone('#2e2422'));
    p.prism(x + 0.05, y + 0.5, 9, 0.9, 0.25, 3, { top: '#f5f1e6', left: '#d8d2c4', right: '#b9b4ab' });
    for (let i = 0; i < 7; i++) p.onTop(x + 0.05, y + 0.5, 12, 0.08 + i * 0.12, 0, 0.04, 0.14, '#1a1414');
  },
  trophy(p, x, y) {
    p.prism(x + 0.1, y + 0.15, 0, 0.8, 0.7, 28, { top: '#4a3a36', left: '#a8c4cc', right: '#4a3a36' });
    for (const [u, v, c] of [[0.1, 18, '#e3c27a'], [0.45, 19, '#d8dde2'], [0.2, 6, '#c98a4a'], [0.5, 7, '#e3c27a']]) p.onLeft(x + 0.1, y + 0.15, 0.7, u, v, 0.2, 6, c);
  },
  'floor-lamp'(p, x, y, tick) {
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 0);
    p.oval(sx, sy, 4, 1, '#3a3a3a'); p.box(sx, sy - 30, 1, 30, '#3a3a3a');
    p.poly([[sx - 6, sy - 30], [sx + 6, sy - 30], [sx + 4, sy - 36], [sx - 4, sy - 36]], '#e3c27a');
    p.poly([[sx - 5, sy - 29], [sx + 5, sy - 29], [sx + 13, sy - 2], [sx - 13, sy - 2]], tick % 40 === 0 ? '#fff1c40a' : '#fff1c41c');
  },
  water(p, x, y, tick) {
    p.prism(x + 0.3, y + 0.3, 0, 0.4, 0.4, 18, tone('#e8ecee'));
    cylinder(p, x + 0.5, y + 0.5, 18, 0.18, 10, '#7fc3e0');
    p.onLeft(x + 0.3, y + 0.3, 0.4, 0.05, 12, 0.08, 2, '#3a7ac0'); p.onLeft(x + 0.3, y + 0.3, 0.4, 0.25, 12, 0.08, 2, '#c94a3a');
    if (tick % 12 < 3) { const [sx, sy] = p.at(x + 0.5, y + 0.5, 22 + (tick % 12) * 2); p.box(sx, sy, 1, 1, '#e8f8fb'); }
  },
  foosball(p, x, y) {
    p.prism(x + 0.05, y + 0.2, 0, 0.9, 0.6, 12, { top: '#2f8a4a', left: '#4a2e1e', right: '#3a2418' });
    p.onTop(x + 0.05, y + 0.2, 12, 0.44, 0, 0.02, 0.6, '#e8f2e8');
    for (const [u, c] of [[0.15, '#c94a3a'], [0.35, '#3a6ac9'], [0.55, '#c94a3a'], [0.75, '#3a6ac9']]) {
      p.prism(x + 0.05 + u, y + 0.1, 13, 0.03, 0.8, 1, tone('#c0c6c8'));
      p.prism(x + 0.04 + u, y + 0.4, 12, 0.06, 0.08, 4, tone(c));
    }
  },
  treadmill(p, x, y, tick) {
    p.prism(x + 0.1, y + 0.15, 0, 0.8, 0.7, 4, tone('#2a2a2e'));
    for (let i = 0; i < 4; i++) p.onTop(x + 0.15, y + 0.2, 4, ((i * 0.2 + tick * 0.05) % 0.7), 0, 0.03, 0.6, '#44444c');
    p.prism(x + 0.12, y + 0.15, 4, 0.06, 0.06, 18, tone('#3a3a40')); p.prism(x + 0.12, y + 0.75, 4, 0.06, 0.06, 18, tone('#3a3a40'));
    p.prism(x + 0.1, y + 0.15, 22, 0.15, 0.7, 4, { top: '#5ac8e0', left: '#3a3a40', right: '#2a2a2e' });
  },
  popcorn(p, x, y, tick) {
    p.prism(x + 0.2, y + 0.2, 0, 0.6, 0.6, 10, tone('#c43a3a'));
    p.prism(x + 0.22, y + 0.22, 10, 0.56, 0.56, 14, { top: '#c43a3a', left: '#e8f4f6cc', right: '#c8d8dacc' });
    for (let i = 0; i < 6; i++) p.onLeft(x + 0.22, y + 0.22, 0.56, 0.08 + (i * 0.17 + (i === tick % 6 ? 0.05 : 0)) % 0.45, 11 + (i % 3) * 2, 0.08, 2, i % 2 ? '#fff6d8' : '#f2d27a');
  },
  cat(p, x, y, tick) {
    p.prism(x + 0.15, y + 0.15, 0, 0.7, 0.7, 4, tone('#d8c4a0'));
    p.prism(x + 0.4, y + 0.4, 4, 0.2, 0.2, 14, tone('#c8b48c'));
    p.prism(x + 0.2, y + 0.2, 18, 0.6, 0.6, 3, tone('#d8c4a0'));
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 21);
    p.oval(sx, sy - 3, 5, 3, '#e08a3a'); p.oval(sx + 5, sy - 5, 3, 2, '#e08a3a');
    p.box(sx + 3, sy - 8, 1, 2, '#e08a3a'); p.box(sx + 6, sy - 8, 1, 2, '#e08a3a');
    p.box(sx + 4, sy - 5, tick % 17 === 0 ? 1 : 2, 1, '#7a3a1a');
    const swish = [0, 1, 2, 1][tick % 4];
    p.box(sx - 6, sy - 3 + swish, 2, 1, '#e08a3a'); p.box(sx - 7, sy - 4 + swish * 2, 1, 2, '#e08a3a');
    if (tick % 30 < 15) p.box(sx + 9, sy - 11, 3, 1, '#c8d4e8');
  },
  fountain(p, x, y, tick) {
    cylinder(p, x + 0.5, y + 0.5, 0, 0.42, 5, '#6f7a76');
    disc(p, x + 0.5, y + 0.5, 5, 0.34, '#7fc3d3');
    p.prism(x + 0.43, y + 0.43, 5, 0.14, 0.14, 10, tone('#a2aca7'));
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 15);
    p.box(sx, sy - 4, 1, 4, '#c7ecf3'); p.box(sx - 3 - (tick % 2), sy + (tick % 3), 1, 2, '#e8f8fb'); p.box(sx + 3 + (tick % 2), sy + (tick % 3), 1, 2, '#e8f8fb');
  },
  telescope(p, x, y) {
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 0);
    p.poly([[sx - 7, sy], [sx - 1, sy - 14], [sx + 1, sy - 14], [sx - 5, sy]], '#6a5a4a');
    p.poly([[sx + 7, sy], [sx + 1, sy - 14], [sx - 1, sy - 14], [sx + 5, sy]], '#6a5a4a');
    p.poly([[sx - 9, sy - 15], [sx + 8, sy - 25], [sx + 10, sy - 21], [sx - 7, sy - 12]], '#2f4f7a');
    p.poly([[sx + 7, sy - 26], [sx + 12, sy - 28], [sx + 13, sy - 22], [sx + 9, sy - 21]], '#c9a45c');
  },
  'sleep-pod'(p, x, y, tick) {
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 0);
    p.oval(sx, sy - 9, 14, 9, '#d8dde2'); p.oval(sx, sy - 10, 13, 8, '#f2f5f7');
    p.oval(sx + 2, sy - 11, 8, 5, '#2a3a4a'); p.oval(sx + 2, sy - 11, 7, 4, '#3f5a7a');
    if (tick % 20 < 10) p.box(sx - 12, sy - 11, 2, 3, '#9ff0ff');
  },
  sculpture(p, x, y) {
    p.prism(x + 0.25, y + 0.25, 0, 0.5, 0.5, 9, tone('#efece6'));
    const [sx, sy] = p.at(x + 0.5, y + 0.5, 9);
    p.oval(sx - 2, sy - 6, 4, 6, '#8a5a2a'); p.oval(sx + 3, sy - 11, 3, 4, '#a8743a'); p.oval(sx - 1, sy - 15, 2, 2, '#c98a4a');
  }
};

/* ---------- Characters ---------- */
export const people = [
  { hair: '#733e32', light: '#bb7950', skin: '#eab891', shirt: '#c67858', fold: '#935140', trousers: '#526b68' },
  { hair: '#354956', light: '#637b80', skin: '#dbb08d', shirt: '#5e91aa', fold: '#416d86', trousers: '#445768' },
  { hair: '#493739', light: '#835858', skin: '#c78e6b', shirt: '#c5a355', fold: '#977c46', trousers: '#655567' },
  { hair: '#86593d', light: '#c69361', skin: '#e8bd99', shirt: '#749779', fold: '#557461', trousers: '#636678' },
  { hair: '#493d3b', light: '#876c51', skin: '#bf8666', shirt: '#6f94a4', fold: '#4d7080', trousers: '#625e69' },
  { hair: '#563d4c', light: '#886276', skin: '#e7b18a', shirt: '#aa85a2', fold: '#815e80', trousers: '#50667a' }
];
const ink = '#2f3436';

// Chibi worker with feet at (sx, sy). facing: se / sw look towards the viewer, ne / nw away.
// action picks the pose: walk, type, sit, lie, run, play, piano, dance, pet, drink, eat, read, write,
// fix, water, talk, listen, cheer, stretch, look. z lifts the whole figure (sitting on furniture).
export function drawCharacter(p, variant, sx, sy, {
  facing = 'sw', seated = false, busy = false, tick = 0, emotion = 'calm', lead = false, team = 'claude',
  prop = null, action = null, z = 0, hop = 0, emoteBusy = false
} = {}) {
  const c = people[variant % people.length];
  const act = action || (busy && seated ? 'type' : 'idle');
  if (act === 'lie') return drawLying(p, c, sx, sy - z, tick);
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
  // Shoulders rise and fall slowly when still; a one-pixel bob on the passing frames when walking.
  const breathe = !walking && !busy && t % 8 >= 4 ? 1 : 0;
  const bob = walking ? [0, 1, 0, 1][frame] : 0;
  const droop = act === 'doze' ? 2 : emotion === 'tired' || emotion === 'sad' ? 1 : 0;
  const lift = seated ? -6 : sitting ? -2 : 0;
  const base = sy - z - hop;
  if (!seated && z === 0) p.oval(sx + sway, sy, 6, 2, hop ? '#00000020' : '#00000030');
  if (!sitting) {
    // Four-frame cycle: contact, passing, contact, passing.
    const raise1 = walking ? [2, 0, 0, 0][frame] : 0, raise2 = walking ? [0, 0, 2, 0][frame] : 0;
    const stride = walking ? [-1, 0, 1, 0][frame] : 0;
    const leg = (dx, raise, shift) => {
      B(dx + shift, base - 6 - raise + crouch, 3, 6 - crouch, ink);
      B(dx + 1 + shift, base - 5 - raise + crouch, 1, Math.max(1, 4 - crouch), c.trousers);
      B(dx + shift, base - 1 - raise, 3, 1, '#3a3436');
    };
    leg(-3, raise1, stride); leg(1, raise2, -stride);
  } else if (!seated) {
    // Knees forward when sitting on a beanbag, chair or piano bench.
    B(-3, base - 4, 3, 3, ink); B(1, base - 4, 3, 3, ink); B(-2, base - 3, 1, 1, c.trousers); B(2, base - 3, 1, 1, c.trousers);
    B(-3, base - 1, 3, 1, '#3a3436'); B(1, base - 1, 3, 1, '#3a3436');
  }
  const body = base - 6 + lift - bob + crouch;
  const sh = body - 7 + breathe;
  B(-5, sh - 1, 10, 9 - breathe, ink);
  B(-4, sh, 8, 7 - breathe, c.shirt);
  B(2, sh, 2, 7 - breathe, c.fold);
  if (front) { B(-1, sh, 2, 1, '#f1d9ae'); if (lead) B(0, sh + 1, 1, 4, team === 'claude' ? '#f0d197' : '#a9c9c7'); }

  // Arms take one of a few shapes; "near" is the arm on the side the character faces.
  const arm = (side, shape) => {
    const dx = side === 'near' ? 4 : -6, out = side === 'near' ? 1 : -1, inner = out > 0 ? 0 : 1;
    if (shape === 'up') {
      // Raised arms sit just outside the big head so they stay visible.
      const ux = side === 'near' ? 6 : -8;
      B(ux, sh - 8, 2, 9, ink); B(ux + (out > 0 ? 0 : 1), sh - 6, 1, 5, c.shirt); B(ux, sh - 10, 2, 2, c.skin);
      return [ux, sh - 11];
    }
    if (shape === 'wave') {
      // Raised hand that rocks side to side.
      const ux = (side === 'near' ? 6 : -8) + (t % 2 ? out : 0);
      B(ux, sh - 7, 2, 8, ink); B(ux + (out > 0 ? 0 : 1), sh - 5, 1, 4, c.shirt); B(ux - (t % 2 ? 0 : out), sh - 10, 3, 3, c.skin);
      return [ux, sh - 11];
    }
    if (shape === 'chin') { B(dx - out, sh, 2, 4, ink); B(dx - out * 2, sh - 2, 2, 2, c.skin); return [dx - out * 2, sh - 2]; }
    if (shape === 'forward') { B(dx, sh + 1, 2, 3, ink); B(dx + out * 2, sh + 1, 2, 2, ink); B(dx + out * 2 + inner, sh + 1, 1, 1, c.skin); return [dx + out * 2, sh]; }
    if (shape === 'mouth') { B(dx - out, sh - 2, 2, 5, ink); B(dx - out * 2, sh - 3, 2, 2, c.skin); return [dx - out * 2, sh - 4]; }
    if (shape === 'reach') { B(dx, sh + 2, 2, 7, ink); B(dx + out, sh + 7, 2, 2, c.skin); return [dx + out, sh + 8]; }
    const swing = shape === 'swingA' ? -1 : shape === 'swingB' ? 1 : 0;
    B(dx, sh + swing, 2, 6, ink); B(dx + inner, sh + 1 + swing, 1, 4, c.shirt); B(dx + inner, sh + 5 + swing, 1, 1, c.skin);
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

  // Head: nods while listening, droops when tired or sad.
  const nod = act === 'listen' && t % 6 < 2 || act === 'groove' && t % 2 || act === 'phone' || act === 'doze' && t % 8 < 4 ? 1 : 0;
  const head = body - 18 + droop + nod + breathe;
  p.box(X(-4, 8), head - 2, 8, 1, ink); p.box(X(-5, 10), head - 1, 10, 1, ink);
  p.box(X(-6, 12), head, 12, 8, ink); p.box(X(-5, 10), head + 8, 10, 1, ink);
  p.box(X(-4, 8), head - 1, 8, 1, c.hair); p.box(X(-5, 10), head, 10, 8, c.hair);
  if (front) {
    B(-4, head + 3, 8, 5, c.skin); B(-3, head + 8, 6, 1, c.skin);
    B(-4, head + 2, 8, 1, c.hair);
    if (variant === 2 || variant === 5) { B(-5, head + 3, 1, 6, c.hair); B(4, head + 3, 1, 6, c.hair); }
    const eyeY = head + 5;
    const closed = (t * 7) % 29 === 0 || emotion === 'tired' || act === 'piano' && phase || act === 'doze' || act === 'yawn' || act === 'groove' && t % 4 < 2;
    const glad = act === 'cheer' || emotion === 'elated';
    if (variant === 1 || variant === 4) { B(-3, eyeY - 1, 3, 3, '#3f5053'); B(1, eyeY - 1, 3, 3, '#3f5053'); B(-2, eyeY, 1, 1, '#c8e0e8'); B(2, eyeY, 1, 1, '#c8e0e8'); }
    else if (glad) { B(-3, eyeY, 2, 1, '#2f2a2a'); B(1, eyeY, 2, 1, '#2f2a2a'); }
    else { B(-2, eyeY, 1, closed ? 1 : 2, '#2f2a2a'); B(2, eyeY, 1, closed ? 1 : 2, '#2f2a2a'); }
    const mouthOpen = act === 'talk' && phase || act === 'cheer' || act === 'idea' || (act === 'eat' || act === 'drink') && phase;
    if (act === 'vr') { B(-5, head + 3, 10, 3, '#2a2f3a'); B(-4, head + 4, 8, 1, t % 2 ? '#7af0f0' : '#40c0f0'); }
    if (act === 'yawn' || act === 'sing' && phase) B(-1, head + 6, 3, 3, '#7d3a32');
    else if (mouthOpen) B(-1, head + 7, 2, 2, '#7d3a32');
    else if (emotion === 'happy' || emotion === 'elated') B(-1, head + 8, 3, 1, '#a86a5a');
    else if (emotion === 'sad' || emotion === 'grumpy') B(-1, head + 8, 2, 1, '#7d5446');
    else B(0, head + 8, 1, 1, '#a86a5a');
    if (emotion === 'happy' || emotion === 'elated' || act === 'cheer') { B(-4, head + 7, 1, 1, '#f0a090'); B(3, head + 7, 1, 1, '#f0a090'); }
    B(-3, head - 1, 5, 2, c.light);
  } else {
    B(-4, head + 1, 6, 2, c.light);
    B(-5, head + 7, 10, 2, shade(c.hair, 0.85));
  }
  if (variant === 5) { B(-2, head - 3, 4, 3, c.hair); B(-1, head - 3, 2, 1, c.light); }
  if (variant === 0) B(-5, head + 1, 3, 2, c.hair);
  // Small effects that belong to the pose.
  if (notes && t % 6 < 4) { const nx = sx + 8 + (t % 3), ny = head - 4 - (t % 6); p.box(nx, ny, 1, 4, '#f2c94c'); p.box(nx - 2, ny + 3, 2, 2, '#f2c94c'); p.box(nx + 1, ny, 2, 1, '#f2c94c'); }
  if (hearts) { const hx2 = sx + 6, hy2 = head - 4 - (t % 3); p.box(hx2, hy2, 2, 1, '#ff7a9a'); p.box(hx2 + 3, hy2, 2, 1, '#ff7a9a'); p.box(hx2, hy2 + 1, 5, 1, '#ff7a9a'); p.box(hx2 + 1, hy2 + 2, 3, 1, '#ff7a9a'); p.box(hx2 + 2, hy2 + 3, 1, 1, '#ff7a9a'); }
  if (sweat) p.box(X(6), head + 2 + (t % 4), 1, 2, '#8fc6f0');
  if (act === 'cheer' && t % 2) { p.box(sx - 9, head - 2, 1, 1, '#fff1c4'); p.box(sx + 9, head - 4, 1, 1, '#fff1c4'); }
  if (emotion !== 'calm' && !walking && !notes && !hearts && act !== 'cheer' && !emoteBusy) drawEmotion(p, emotion, sx, head - 2, tick);
  return { top: head - 2 };
}

// Asleep in a pod: lying on the back under a blanket, with drifting Z's.
function drawLying(p, c, sx, sy, tick) {
  const y = sy - 6;
  p.box(sx - 11, y - 3, 22, 7, ink);
  p.box(sx - 3, y - 2, 13, 5, '#d8e2ef'); p.box(sx - 3, y - 2, 13, 1, '#f2f5f7');
  p.box(sx - 11, y - 5, 9, 9, ink); p.box(sx - 10, y - 4, 7, 7, c.hair); p.box(sx - 9, y - 2, 5, 4, c.skin);
  p.box(sx - 8, y - 1, 2, 1, '#2f2a2a'); p.box(sx - 5, y - 1, 1, 1, '#2f2a2a');
  const z = tick % 12;
  if (z < 9) { const zx = sx - 4 + Math.floor(z / 3) * 3, zy = y - 9 - z; p.box(zx, zy, 3, 1, '#c8d4e8'); p.box(zx + 1, zy + 1, 1, 1, '#c8d4e8'); p.box(zx, zy + 2, 3, 1, '#c8d4e8'); }
  return { top: y - 8 };
}

// Small speech-bubble icons above a head: thinking dots, Z's, a light bulb, a note, a question or a heart.
export function drawEmote(p, kind, x, y, tick) {
  if (!kind) return;
  const bx = Math.round(x) - 5, by = Math.round(y) - 12 - (tick % 8 < 4 ? 0 : 1);
  p.box(bx, by, 11, 8, ink); p.box(bx + 1, by + 1, 9, 6, '#fffaf0'); p.box(bx + 3, by + 8, 2, 1, ink); p.box(bx + 4, by + 7, 1, 1, '#fffaf0');
  const X = bx + 2, Y = by + 2, dot = (dx, dy, color, w = 1, h = 1) => p.box(X + dx, Y + dy, w, h, color);
  if (kind === 'dots' || kind === 'chat') {
    const lit = tick % 6, col = kind === 'chat' ? '#5f8fd0' : '#4a4446';
    for (let i = 0; i < 3; i++) dot(i * 3, 2, i <= lit % 4 ? col : '#d8d0c0', 2, 2);
  } else if (kind === 'zz') {
    dot(0, 0, '#6f86b8', 3, 1); dot(1, 1, '#6f86b8'); dot(0, 2, '#6f86b8', 3, 1);
    dot(4, 2, '#93a7d4', 3, 1); dot(5, 3, '#93a7d4'); dot(4, 4, '#93a7d4', 3, 1);
  } else if (kind === 'idea') {
    dot(2, 0, '#f2c94c', 3, 3); dot(1, 1, '#f2c94c', 5, 1); dot(3, 3, '#b8963c', 1, 1); dot(2, 3, '#9a9a9a', 3, 1);
    if (tick % 2) { dot(0, 0, '#fff1c4'); dot(6, 0, '#fff1c4'); }
  } else if (kind === 'note') {
    dot(4, 0, '#d46a8a', 1, 4); dot(5, 0, '#d46a8a', 2, 1); dot(2, 3, '#d46a8a', 3, 2);
  } else if (kind === 'question') {
    dot(2, 0, '#5f8fd0', 3, 1); dot(5, 1, '#5f8fd0'); dot(4, 2, '#5f8fd0'); dot(3, 2, '#5f8fd0'); dot(3, 4, '#5f8fd0');
  } else if (kind === 'heart') {
    dot(1, 0, '#ff7a9a', 2, 1); dot(4, 0, '#ff7a9a', 2, 1); dot(0, 1, '#ff7a9a', 7, 1); dot(1, 2, '#ff7a9a', 5, 1); dot(2, 3, '#ff7a9a', 3, 1); dot(3, 4, '#ff7a9a');
  } else if (kind === 'coffee') {
    dot(1, 1, '#f2eadb', 4, 3); dot(1, 1, '#8a5a3a', 4, 1); dot(5, 2, '#f2eadb'); if (tick % 2) dot(2, 0, '#c8c0b0'); else dot(3, 0, '#c8c0b0');
  }
}
