// Interactive facilities: arcade machines and multi-player games. Each drawer takes the iso painter, the slot's
// tile origin, the animation tick and `active` (someone is playing right now), so the game only moves while used.
// One-tile pieces stand on (x, y); 2×2 pieces cover x…x+2, y…y+2 and are played from both ends along x.
import { shade, tone } from './iso-props.js';

function disc(p, cx, cy, z, r, color) {
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push(p.at(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
  p.poly(pts, color);
}
const legs = (p, x, y, w, d, h, color) => {
  for (const [u, v] of [[0.05, 0.05], [w - 0.15, 0.05], [0.05, d - 0.15], [w - 0.15, d - 0.15]]) p.prism(x + u, y + v, 0, 0.1, 0.1, h, tone(color));
};
// A value that goes 0 → 1 → 0 over `period` ticks: a ball going back and forth.
const rally = (tick, period) => { const t = (tick % period) / period; return t < 0.5 ? t * 2 : 2 - t * 2; };

export const facilities = {
  claw(p, x, y, tick, active) {
    p.prism(x + 0.12, y + 0.12, 0, 0.76, 0.76, 12, tone('#e0508a'));
    p.prism(x + 0.12, y + 0.12, 12, 0.76, 0.76, 20, { top: '#f8d0e0', left: '#c8e8f860', right: '#a8d0e060' });
    p.prism(x + 0.12, y + 0.12, 32, 0.76, 0.76, 4, tone('#e0508a'));
    // Prizes in the pit.
    for (const [u, v, c] of [[0.25, 0.3, '#f2c94c'], [0.5, 0.25, '#7ac0f0'], [0.35, 0.55, '#f0a1b8'], [0.6, 0.55, '#7af07a']]) disc(p, x + 0.12 + u, y + 0.12 + v, 13, 0.1, c);
    const sweep = active ? rally(tick, 16) : 0.5, drop = active && tick % 16 > 10 ? 10 : 2;
    const [cx, cy] = p.at(x + 0.25 + sweep * 0.5, y + 0.45, 31);
    p.box(cx, cy, 1, drop, '#c0c6c8'); p.box(cx - 2, cy + drop, 5, 1, '#c0c6c8'); p.box(cx - 2, cy + drop + 1, 1, 2, '#c0c6c8'); p.box(cx + 2, cy + drop + 1, 1, 2, '#c0c6c8');
    if (active && tick % 4 < 2) p.onLeft(x + 0.12, y + 0.12, 0.76, 0.1, 34, 0.56, 1, '#fff1c4');
  },
  hoops(p, x, y, tick, active) {
    p.prism(x + 0.1, y + 0.1, 0, 0.8, 0.8, 10, tone('#2f6ac9'));
    p.onTop(x + 0.1, y + 0.1, 10, 0.05, 0.05, 0.7, 0.7, '#e08a3a');
    p.prism(x + 0.1, y + 0.1, 10, 0.8, 0.08, 30, tone('#e8ecee'));
    p.onLeft(x + 0.1, y + 0.1, 0.08, 0.3, 26, 0.2, 6, '#c43a3a');
    const [rx, ry] = p.at(x + 0.5, y + 0.25, 26);
    p.oval(rx, ry, 4, 1, '#e05a2a');
    if (active) {
      const t = (tick % 10) / 10, arc = Math.sin(t * Math.PI);
      const [bx, by] = p.at(x + 0.5, y + 0.95 - t * 0.7, 14 + arc * 22);
      p.oval(bx, by, 2, 2, '#e08a3a'); p.box(bx - 1, by, 3, 1, '#8a4a1a');
      p.box(rx - 12, ry - 14, 5, 3, '#1a1a2a'); p.box(rx - 11, ry - 13, 3, 1, tick % 2 ? '#f2c94c' : '#e05a2a');
    }
  },
  'dance-pad'(p, x, y, tick, active) {
    p.prism(x + 0.05, y + 0.05, 0, 0.9, 0.9, 3, tone('#2a2a3a'));
    const lit = active ? tick % 4 : -1;
    for (const [i, u, v] of [[0, 0.35, 0.08], [1, 0.62, 0.35], [2, 0.35, 0.62], [3, 0.08, 0.35]]) {
      p.onTop(x + 0.05, y + 0.05, 3, u, v, 0.22, 0.22, i === lit ? '#fff1c4' : ['#e0508a', '#40c0f0', '#7af07a', '#f2c94c'][i]);
    }
    p.prism(x + 0.05, y + 0.02, 3, 0.9, 0.08, 22, tone('#3a2f7a'));
    p.onLeft(x + 0.05, y + 0.02, 0.08, 0.15, 12, 0.6, 8, active ? ['#e0508a', '#40c0f0', '#7af07a', '#f2c94c'][tick % 4] : '#2a2a3a');
  },
  vr(p, x, y, tick, active) {
    disc(p, x + 0.5, y + 0.5, 0, 0.45, '#2a2f3a'); disc(p, x + 0.5, y + 0.5, 1, 0.4, active ? '#3a5a8a' : '#33384a');
    for (const [u, v] of [[0.08, 0.08], [0.92, 0.92]]) {
      p.prism(x + u - 0.04, y + v - 0.04, 0, 0.08, 0.08, 26, tone('#4a4e58'));
      const [sx, sy] = p.at(x + u, y + v, 26);
      p.box(sx - 1, sy - 2, 3, 2, active && tick % 2 ? '#7af0f0' : '#2a8a9a');
    }
    if (active) for (let i = 0; i < 3; i++) { const a = (tick * 0.6 + i * 2.1); disc(p, x + 0.5 + Math.cos(a) * 0.3, y + 0.5 + Math.sin(a) * 0.3, 1, 0.04, '#7af0f0'); }
  },
  racing(p, x, y, tick, active) {
    p.prism(x + 0.1, y + 0.05, 0, 0.8, 0.9, 5, tone('#2a2a2e'));
    p.prism(x + 0.2, y + 0.4, 5, 0.6, 0.45, 5, tone('#c43a3a'));
    p.prism(x + 0.2, y + 0.75, 5, 0.6, 0.12, 16, tone('#c43a3a'));
    p.prism(x + 0.1, y + 0.05, 5, 0.8, 0.12, 22, tone('#1a1a1e'));
    p.onLeft(x + 0.1, y + 0.05, 0.12, 0.08, 12, 0.64, 13, active ? ['#5a9ad0', '#6aaae0', '#4a8ac0'][tick % 3] : '#26303a');
    if (active) { p.onLeft(x + 0.1, y + 0.05, 0.12, 0.3 + (tick % 3) * 0.05, 16, 0.1, 2, '#f2c94c'); p.onLeft(x + 0.1, y + 0.05, 0.12, 0.1, 13, 0.6, 1, '#8a8a8a'); }
    const [wx, wy] = p.at(x + 0.5, y + 0.3, 14);
    p.oval(wx, wy, 3, 2, '#3a3a40');
  },

  // ---------- 2×2, played from both ends along x ----------
  pingpong(p, x, y, tick, active) {
    legs(p, x + 0.15, y + 0.3, 1.7, 1.4, 11, '#3a3a40');
    p.prism(x + 0.15, y + 0.3, 11, 1.7, 1.4, 1, { top: '#2f6ab0', left: '#24548c', right: '#1c446e' });
    p.onTop(x + 0.15, y + 0.3, 12, 0, 0.68, 1.7, 0.04, '#e8f2f8');
    p.onTop(x + 0.15, y + 0.3, 12, 0, 0, 1.7, 0.03, '#e8f2f8'); p.onTop(x + 0.15, y + 0.3, 12, 0, 1.37, 1.7, 0.03, '#e8f2f8');
    p.prism(x + 0.98, y + 0.25, 12, 0.04, 1.5, 3, { top: '#f2f2f2', left: '#d8dde0c0', right: '#b8c0c4c0' });
    if (active) {
      const t = rally(tick, 12), bounce = Math.abs(Math.sin(t * Math.PI * 2));
      const [bx, by] = p.at(x + 0.25 + t * 1.5, y + 0.9 + Math.sin(tick * 0.7) * 0.2, 13 + bounce * 9);
      p.box(bx - 1, by - 1, 2, 2, '#ffffff'); p.box(bx - 1, by + 1 + Math.round(bounce * 9), 2, 1, '#00000030');
    }
  },
  'air-hockey'(p, x, y, tick, active) {
    p.prism(x + 0.1, y + 0.3, 0, 1.8, 1.4, 9, tone('#2a2f3a'));
    p.prism(x + 0.1, y + 0.3, 9, 1.8, 1.4, 2, { top: '#3a6ac9', left: '#2f58a8', right: '#244888' });
    p.onTop(x + 0.1, y + 0.3, 11, 0.08, 0.08, 1.64, 1.24, '#eef4f8');
    p.onTop(x + 0.1, y + 0.3, 11, 0.88, 0.08, 0.03, 1.24, '#e05a5a');
    for (const u of [0.08, 1.64]) p.onTop(x + 0.1, y + 0.3, 11, u, 0.5, 0.08, 0.4, '#1a1a2a');
    const t = active ? rally(tick, 8) : 0.5;
    const [px, py] = p.at(x + 0.35 + t * 1.3, y + 1 + (active ? Math.sin(tick * 1.3) * 0.35 : 0), 11);
    p.oval(px, py, 3, 1, '#1a1a2a');
    for (const [u, c] of [[0.3, '#e05a5a'], [1.7, '#e0b03a']]) { const [mx, my] = p.at(x + u, y + 1 + (active ? Math.sin(tick + u) * 0.3 : 0), 11); p.oval(mx, my - 1, 2, 1, c); p.box(mx, my - 3, 1, 2, c); }
    p.onLeft(x + 0.1, y + 0.3, 1.4, 0.7, 5, 0.4, 3, active && tick % 2 ? '#7af07a' : '#2a4a2a');
  },
  pool(p, x, y, tick, active) {
    legs(p, x + 0.15, y + 0.3, 1.7, 1.4, 9, '#5a3a22');
    p.prism(x + 0.1, y + 0.25, 9, 1.8, 1.5, 3, tone('#6a4428'));
    p.onTop(x + 0.1, y + 0.25, 12, 0.1, 0.1, 1.6, 1.3, '#2f7a4a');
    for (const [u, v] of [[0.1, 0.1], [0.85, 0.08], [1.62, 0.1], [0.1, 1.32], [0.85, 1.34], [1.62, 1.32]]) p.onTop(x + 0.1, y + 0.25, 12, u, v, 0.08, 0.08, '#141414');
    const balls = [['#f2c94c', 1.2, 0.5], ['#c43a3a', 1.3, 0.75], ['#2f58a8', 1.42, 0.62], ['#5a2a6a', 1.42, 0.88], ['#e08a3a', 1.1, 1]];
    const shot = active ? (tick % 14) / 14 : 0;
    balls.forEach(([c, u, v], i) => disc(p, x + 0.1 + u + (shot > 0.4 ? (i - 2) * 0.05 * (shot - 0.4) : 0), y + 0.25 + v + (shot > 0.4 ? Math.sin(i * 2) * 0.12 * (shot - 0.4) : 0), 12.5, 0.05, c));
    disc(p, x + 0.1 + (active ? 0.4 + Math.min(0.4, shot) * 1.5 : 0.45), y + 0.25 + 0.7, 12.5, 0.05, '#f8f8f2');
  },
  // A small stage: warm wooden boards with footlights along the front, red curtains at the sides, a modest
  // lyrics screen at the back, two floor speakers and a mic stand. Lights sweep only while someone sings.
  karaoke(p, x, y, tick, active) {
    const soft = c => ({ ...tone(c), ink: false });
    p.prism(x + 0.05, y + 0.05, 0, 1.9, 1.9, 4, tone('#8a5a3a'));                       // stage
    for (let i = 0; i < 6; i++) p.onTop(x + 0.05, y + 0.05, 4, 0.05, 0.08 + i * 0.3, 1.8, 0.02, '#a8744a');
    p.onTop(x + 0.05, y + 0.05, 4, 0.1, 0.1, 1.7, 1.7, '#b0794c55');
    for (let i = 0; i < 7; i++) {                                                         // footlights
      const lit = active ? (tick + i) % 3 !== 0 : i % 2 === 0;
      p.onLeft(x + 0.05, y + 0.05, 1.9, 0.12 + i * 0.25, 1, 0.08, 2, lit ? '#ffe27a' : '#7a5a3a');
    }
    // Back wall with a lyrics screen.
    p.prism(x + 0.05, y + 0.05, 4, 1.9, 0.08, 22, tone('#3a2a44'));
    p.onLeft(x + 0.05, y + 0.05, 0.08, 0.45, 9, 1.0, 13, '#1a1420');
    p.onLeft(x + 0.05, y + 0.05, 0.08, 0.5, 10, 0.9, 11, active ? ['#7a4ac0', '#5a3aa0', '#8a5ad0', '#6a4ab0'][tick % 4] : '#2a2040');
    if (active) for (let i = 0; i < 3; i++) p.onLeft(x + 0.05, y + 0.05, 0.08, 0.58 + i * 0.12, 17 - i * 3, 0.5 - i * 0.1, 1, i === (tick % 3) ? '#ffe27a' : '#ffffff');
    // Curtains on both sides, folded.
    for (const u of [0.05, 1.71]) {
      p.prism(x + u, y + 0.13, 4, 0.24, 0.12, 21, tone('#b03a4a'));
      for (let f = 0; f < 3; f++) p.onLeft(x + u, y + 0.13, 0.12, 0.03 + f * 0.08, 5, 0.02, 19, '#8a2a3a');
      p.prism(x + u - 0.02, y + 0.11, 23, 0.28, 0.16, 3, soft('#d8a84a'));            // valance
    }
    for (const [u, v] of [[0.12, 1.55], [1.6, 1.55]]) {                                  // floor speakers
      p.prism(x + u, y + v, 4, 0.28, 0.28, 8, tone('#2a2a2e'));
      const [sx, sy] = p.at(x + u + 0.14, y + v + 0.28, 8);
      p.oval(sx, sy, 2, 2, active && tick % 2 ? '#6a6a72' : '#45454c');
    }
    const [mx, my] = p.at(x + 0.95, y + 1.0, 4);
    p.oval(mx, my, 3, 1, '#2a2a2e'); p.box(mx, my - 17, 1, 17, '#8a8a92'); p.oval(mx, my - 18, 2, 1, '#2a2a2e');
    if (active) for (const [i, c] of [[0, '#e0508a'], [1, '#40c0f0'], [2, '#f2c94c']]) {
      const [lx, ly] = p.at(x + 0.4 + i * 0.6, y + 0.3, 30);
      if ((tick + i) % 3) p.poly([[lx - 1, ly], [lx + 1, ly], [lx + 7 - i * 6, ly + 26], [lx - 5 - i * 4, ly + 26]], c + '22');
    }
  },
  boardgame(p, x, y, tick, active) {
    disc(p, x + 1, y + 1, 0, 0.18, '#3a2a20');
    p.prism(x + 0.92, y + 0.92, 0, 0.16, 0.16, 11, tone('#5a4030'));
    for (let k = 0; k < 2; k++) disc(p, x + 1, y + 1, 11 + k, 0.72, k ? '#a8743a' : shade('#a8743a', 0.78));
    p.onTop(x + 0.55, y + 0.55, 13, 0, 0, 0.9, 0.9, '#efe3c4');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) p.onTop(x + 0.55, y + 0.55, 13, 0.1 + i * 0.18, 0.1 + j * 0.18, 0.18, 0.18, '#c9b48a');
    const hop = active && tick % 6 < 2 ? 3 : 0;
    for (const [u, v, c, moving] of [[0.3, 0.3, '#c43a3a', true], [0.6, 0.4, '#2f58a8', false], [0.4, 0.65, '#3f8a4a', false]]) {
      const [sx, sy] = p.at(x + 0.55 + u, y + 0.55 + v, 13);
      p.box(sx - 1, sy - 4 - (moving ? hop : 0), 3, 4, c); p.box(sx, sy - 5 - (moving ? hop : 0), 1, 1, c);
    }
    if (active && tick % 8 < 4) { const [dx, dy] = p.at(x + 1.3, y + 0.8, 16 + (tick % 4)); p.box(dx - 1, dy - 1, 3, 3, '#ffffff'); p.box(dx, dy, 1, 1, '#1a1a1a'); }
  }
};
