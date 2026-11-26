// Sprite-stacked voxel models of furniture, for the shop's turntable previews and the static pieces in the office.
// One tile is about 22 voxels across, so a one-tile piece fits in roughly 18 × 18 voxels; heights are in pixels.
import { bake, createModel, drawStack } from './stack.js';

const M = (w, d, h) => createModel(w, d, h);
const leaves = (m, cx, cy, cz, r, colors) => {
  for (let z = -r; z <= r; z++) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const dist = Math.hypot(x, y, z * 1.2);
    if (dist <= r + 0.2) m.set(cx + x, cy + y, cz + z, colors[(Math.abs(x * 7 + y * 3 + z * 5)) % colors.length]);
  }
};

export const models = {
  plant() { const m = M(14, 14, 30); m.cyl(0, 0, 3.5, 0, 7, '#c0795a').cyl(0, 0, 3, 7, 7, '#5a4030').box(0, 0, 8, 0, 0, 14, '#425b41'); leaves(m, 0, 0, 18, 5, ['#568459', '#649353', '#488262']); leaves(m, 2, -1, 24, 3, ['#5e8f57', '#78a565']); return m; },
  bonsai() { const m = M(18, 14, 24); m.box(-6, -3, 0, 5, 3, 3, '#3d4a55').box(-5, -2, 4, 4, 2, 4, '#5a4a3a').box(0, 0, 5, 0, 0, 12, '#6a4a32').box(1, 0, 11, 3, 0, 12, '#6a4a32'); leaves(m, -3, 0, 12, 2, ['#3f6c51', '#4d7f58']); leaves(m, 3, 0, 15, 3, ['#4d7f58', '#5f9160']); leaves(m, 0, 0, 18, 2, ['#5f9160', '#78a565']); return m; },
  trophy() { const m = M(16, 12, 30); m.box(-7, -5, 0, 6, 4, 27, '#4a3a36').box(-6, 4, 2, 5, 4, 26, '#a8c4cc'); for (const [x, z, c] of [[-4, 4, '#c98a4a'], [2, 5, '#e3c27a'], [-3, 16, '#e3c27a'], [3, 17, '#d8dde2']]) { m.box(x - 1, 1, z, x + 1, 3, z + 1, c).box(x, 2, z + 2, x, 2, z + 4, c).box(x - 1, 1, z + 5, x + 1, 3, z + 6, c); } m.box(-7, -5, 13, 6, 4, 13, '#4a3a36'); return m; },
  sculpture() { const m = M(14, 14, 28); m.box(-5, -5, 0, 4, 4, 8, '#efece6'); leaves(m, -1, 0, 13, 3, ['#8a5a2a', '#9a6a32']); leaves(m, 2, 0, 19, 2, ['#a8743a']); leaves(m, -1, 1, 23, 1, ['#c98a4a']); return m; },
  telescope() { const m = M(20, 14, 30); for (const [x, y] of [[-5, 3], [5, 3], [0, -4]]) for (let z = 0; z < 14; z++) m.set(Math.round(x * (1 - z / 16)), Math.round(y * (1 - z / 16)), z, '#6a5a4a'); for (let i = 0; i < 16; i++) { const z = 14 + Math.round(i * 0.7); m.box(-7 + i, -1, z, -7 + i, 1, z + 1, i > 12 ? '#c9a45c' : '#2f4f7a'); } return m; },
  beanbag() { const m = M(20, 20, 14); for (let z = 0; z < 10; z++) { const r = 8 - Math.abs(z - 4) * 0.8; m.cyl(0, 0, r, z, z, z > 6 ? '#d97a62' : '#c45c47'); } return m; },
  'espresso-bar'() { const m = M(18, 16, 28); m.box(-8, -6, 0, 7, 6, 13, '#8c6a4e').box(-5, -3, 14, 4, 1, 24, '#c98a4a').box(-5, -3, 24, 4, 1, 25, '#e8b070').box(-3, 2, 14, -2, 3, 16, '#f2eadb').box(2, 2, 14, 3, 3, 16, '#f2eadb').box(-1, 2, 18, 0, 4, 18, '#3a3a3a'); return m; },
  fridge() { const m = M(16, 16, 32); m.box(-7, -7, 0, 6, 6, 30, '#9aa6aa').box(-6, 6, 1, 5, 6, 29, '#a8d4dc'); for (const z of [6, 14, 22]) { m.box(-5, 5, z - 1, 4, 5, z - 1, '#d8e2e4'); for (let i = 0; i < 4; i++) m.box(-5 + i * 3, 5, z, -4 + i * 3, 5, z + 3, ['#e0604a', '#f2c94c', '#6fb07a', '#5a8fd0'][i]); } return m; },
  record() { const m = M(18, 16, 20); m.box(-8, -7, 0, 7, 6, 11, '#8a5634').cyl(0, 0, 6, 12, 12, '#141414').cyl(0, 0, 2, 13, 13, '#c9683a').box(5, -5, 12, 5, -5, 17, '#c9a45c').box(2, -5, 17, 5, -5, 17, '#c9a45c'); return m; },
  aquarium() { const m = M(20, 16, 24); m.box(-9, -7, 0, 8, 6, 7, '#4a3a2e').box(-9, -7, 8, 8, 6, 21, '#5fa8c0').box(-8, -6, 8, 7, 5, 9, '#d8c79a'); for (const [x, z, c] of [[-4, 12, '#f29a3a'], [2, 16, '#f2e04a'], [5, 11, '#e05a8a']]) m.box(x, 6, z, x + 2, 6, z + 1, c); return m; },
  arcade() { const m = M(16, 16, 32); m.box(-6, -6, 0, 5, 5, 29, '#3a2f7a').box(-5, 6, 15, 4, 6, 23, '#40c0f0').box(-6, 6, 10, 5, 8, 12, '#2a2260').box(-3, 8, 13, -3, 8, 14, '#e04040').box(1, 8, 13, 2, 8, 13, '#f2c94c').box(-6, -6, 26, 5, 6, 29, '#e0508a'); return m; },
  'massage-chair'() { const m = M(18, 18, 28); m.box(-7, -4, 0, 6, 6, 8, '#4a4a52').box(-7, -7, 0, 6, -4, 24, '#2a2a2e').box(-9, -4, 0, -8, 6, 13, '#3a3a40').box(7, -4, 0, 8, 6, 13, '#3a3a40').box(-3, -4, 18, 2, -4, 19, '#c9a45c'); return m; },
  piano() { const m = M(20, 12, 28); m.box(-9, -5, 0, 8, 1, 25, '#2e2422').box(-9, 2, 9, 8, 5, 11, '#f5f1e6'); for (let x = -8; x < 8; x += 2) m.box(x, 3, 12, x, 5, 12, '#1a1414'); m.box(-9, 2, 0, -9, 5, 8, '#2e2422').box(8, 2, 0, 8, 5, 8, '#2e2422'); return m; },
  'floor-lamp'() { const m = M(16, 16, 40); m.cyl(0, 0, 4, 0, 1, '#3a3a3a').box(0, 0, 2, 0, 0, 30, '#3a3a3a').box(0, 1, 30, 0, 5, 30, '#3a3a3a'); for (let z = 31; z < 37; z++) m.cyl(0, 5, 2 + (36 - z) * 0.7, z, z, '#e3c27a'); return m; },
  water() { const m = M(12, 12, 32); m.box(-4, -4, 0, 3, 3, 18, '#e8ecee').box(-3, 4, 11, -3, 4, 12, '#3a7ac0').box(1, 4, 11, 1, 4, 12, '#c94a3a').cyl(-0.5, -0.5, 3.4, 19, 29, '#7fc3e0').box(-1, -1, 30, 0, 0, 30, '#5a9ab8'); return m; },
  foosball() { const m = M(22, 14, 18); m.box(-10, -5, 0, 9, 5, 11, '#4a2e1e').box(-9, -4, 11, 8, 4, 11, '#2f8a4a').box(0, -4, 11, 0, 4, 11, '#e8f2e8'); for (const [x, c] of [[-7, '#c94a3a'], [-3, '#3a6ac9'], [3, '#c94a3a'], [7, '#3a6ac9']]) { m.box(x, -7, 13, x, 7, 13, '#c0c6c8').box(x, -1, 11, x, 1, 14, c); } return m; },
  treadmill() { const m = M(14, 22, 26); m.box(-6, -10, 0, 5, 9, 3, '#2a2a2e').box(-5, -9, 4, 4, 8, 4, '#44444c').box(-6, -10, 4, -6, -10, 21, '#3a3a40').box(5, -10, 4, 5, -10, 21, '#3a3a40').box(-6, -11, 20, 5, -9, 23, '#3a3a40').box(-3, -11, 22, 2, -11, 23, '#5ac8e0'); return m; },
  popcorn() { const m = M(14, 14, 30); m.box(-5, -5, 0, 4, 4, 9, '#c43a3a').box(-5, -5, 10, 4, 4, 23, '#e8f4f6').box(-5, -5, 24, 4, 4, 26, '#c43a3a'); for (let i = 0; i < 14; i++) m.set(-4 + (i * 5) % 9, -4 + (i * 3) % 9, 10 + (i % 4), i % 3 ? '#fff6d8' : '#f2d27a'); return m; },
  cat() { const m = M(18, 18, 30); m.box(-7, -7, 0, 6, 6, 3, '#d8c4a0').box(-1, -1, 4, 0, 0, 17, '#c8b48c').box(-6, -6, 18, 5, 5, 20, '#d8c4a0'); leaves(m, 0, 0, 23, 3, ['#e08a3a', '#f2a85a']); m.box(2, 2, 25, 3, 3, 27, '#e08a3a').box(-1, 2, 26, -1, 2, 27, '#e08a3a').box(2, -1, 26, 2, -1, 27, '#e08a3a'); return m; },
  fountain() { const m = M(20, 20, 26); m.cyl(0, 0, 8.5, 0, 5, '#6f7a76').cyl(0, 0, 7, 5, 5, '#7fc3d3').box(-1, -1, 5, 0, 0, 15, '#a2aca7').cyl(-0.5, -0.5, 3, 15, 16, '#79847f').cyl(-0.5, -0.5, 2, 17, 17, '#7fc3d3').box(-1, -1, 18, 0, 0, 22, '#c7ecf3'); return m; },
  'sleep-pod'() { const m = M(24, 16, 20); for (let z = 0; z < 16; z++) { const r = 7.5 - Math.abs(z - 7) * 0.45; for (let x = -10; x <= 9; x++) m.cyl(x, 0, r, z, z, '#f2f5f7'); } for (let x = -2; x <= 7; x++) m.box(x, 4, 7, x, 6, 12, '#3f5a7a'); m.box(-10, -1, 7, -10, 0, 9, '#9ff0ff'); return m; },
  claw() { const m = M(16, 16, 36); m.box(-7, -7, 0, 6, 6, 12, '#e0508a').box(-7, -7, 13, 6, 6, 32, '#d8eef8').box(-6, -6, 13, 5, 5, 31, '#bfe0f0').box(-7, -7, 33, 6, 6, 35, '#e0508a'); for (const [x, y, c] of [[-3, -2, '#f2c94c'], [2, 1, '#7ac0f0'], [-1, 3, '#f0a1b8'], [3, -3, '#7af07a']]) m.box(x, y, 13, x + 1, y + 1, 14, c); m.box(0, 0, 24, 0, 0, 32, '#c0c6c8').box(-1, -1, 23, 1, 1, 23, '#c0c6c8'); return m; },
  hoops() { const m = M(18, 20, 36); m.box(-8, -4, 0, 7, 9, 10, '#2f6ac9').box(-7, -3, 10, 6, 8, 10, '#e08a3a').box(-8, -6, 10, 7, -5, 33, '#e8ecee').box(-2, -4, 26, 1, -4, 29, '#c43a3a'); m.cyl(-0.5, -1, 2.5, 25, 25, '#e05a2a'); return m; },
  'dance-pad'() { const m = M(20, 20, 26); m.box(-9, -9, 0, 8, 8, 2, '#2a2a3a'); for (const [x, y, c] of [[-2, -7, '#e0508a'], [5, -1, '#40c0f0'], [-2, 5, '#7af07a'], [-8, -1, '#f2c94c']]) m.box(x, y, 3, x + 3, y + 3, 3, c); m.box(-9, -10, 3, 8, -9, 24, '#3a2f7a').box(-6, -8, 12, 5, -8, 20, '#40c0f0'); return m; },
  vr() { const m = M(22, 22, 30); m.cyl(-0.5, -0.5, 9.5, 0, 0, '#2a2f3a').cyl(-0.5, -0.5, 8.5, 1, 1, '#3a5a8a'); for (const [x, y] of [[-9, -9], [8, 8]]) m.box(x, y, 0, x, y, 26, '#4a4e58').box(x, y, 27, x, y, 28, '#7af0f0'); return m; },
  racing() { const m = M(16, 22, 26); m.box(-7, -10, 0, 6, 10, 4, '#2a2a2e').box(-4, -1, 5, 3, 5, 9, '#c43a3a').box(-4, -3, 5, 3, -1, 20, '#c43a3a').box(-7, 8, 5, 6, 9, 22, '#1a1a1e').box(-6, 8, 10, 5, 8, 20, '#5a9ad0').cyl(-0.5, 6, 2.5, 13, 13, '#3a3a40'); return m; },
  // 2 × 2 facilities: about 40 × 40 voxels.
  pingpong() { const m = M(40, 32, 22); for (const [x, y] of [[-17, -12], [16, -12], [-17, 11], [16, 11]]) m.box(x, y, 0, x, y, 11, '#3a3a40'); m.box(-18, -13, 12, 17, 12, 12, '#2f6ab0').box(-18, -1, 12, 17, 0, 12, '#e8f2f8').box(0, -14, 13, 0, 13, 15, '#f2f2f2'); return m; },
  'air-hockey'() { const m = M(40, 30, 16); m.box(-18, -13, 0, 17, 12, 9, '#2a2f3a').box(-18, -13, 10, 17, 12, 10, '#3a6ac9').box(-16, -11, 11, 15, 10, 11, '#eef4f8').box(0, -11, 11, 0, 10, 11, '#e05a5a').cyl(-10, 0, 1.5, 12, 12, '#e05a5a').cyl(9, 0, 1.5, 12, 12, '#e0b03a').cyl(-1, 3, 1, 12, 12, '#1a1a2a'); return m; },
  pool() { const m = M(42, 32, 18); for (const [x, y] of [[-17, -12], [16, -12], [-17, 11], [16, 11]]) m.box(x, y, 0, x, y, 9, '#5a3a22'); m.box(-19, -14, 10, 18, 13, 12, '#6a4428').box(-17, -12, 12, 16, 11, 12, '#2f7a4a'); for (const [x, y, c] of [[6, 0, '#f2c94c'], [8, -2, '#c43a3a'], [8, 2, '#2f58a8'], [10, 0, '#5a2a6a'], [-8, 1, '#f8f8f2']]) m.box(x, y, 13, x, y, 13, c); return m; },
  karaoke() { const m = M(40, 40, 34); m.box(-19, -19, 0, 18, 18, 3, '#4a2e52').box(-19, -19, 4, 18, -18, 30, '#1a1420').box(-10, -17, 12, 9, -17, 24, '#7a4ac0').box(-18, -17, 4, -14, -13, 18, '#1a1a1e').box(13, -17, 4, 17, -13, 18, '#1a1a1e').box(0, 2, 4, 0, 2, 20, '#8a8a92').box(-1, 2, 21, 1, 2, 22, '#2a2a2e'); return m; },
  boardgame() { const m = M(36, 36, 18); m.box(-1, -1, 0, 0, 0, 10, '#5a4030').cyl(-0.5, -0.5, 14, 11, 12, '#a8743a').box(-8, -8, 13, 7, 7, 13, '#efe3c4'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) m.box(-8 + i * 4, -8 + j * 4, 13, -5 + i * 4, -5 + j * 4, 13, '#c9b48a'); for (const [x, y, c] of [[-5, -4, '#c43a3a'], [3, -1, '#2f58a8'], [-1, 4, '#3f8a4a']]) m.box(x, y, 14, x, y, 16, c); return m; }
};

// The baked sprite of a model at a heading (radians), cached by stack.js.
export const furnitureSprite = (id, heading = Math.PI / 2) => models[id] ? bake('f:' + id, models[id], heading) : null;

// Draw a stacked piece in the office with its ground centre at tile (tx, ty).
export function drawFurnitureStack(p, id, tx, ty, heading = Math.PI / 2) {
  const sprite = furnitureSprite(id, heading);
  if (!sprite) return false;
  const [sx, sy] = p.at(tx, ty);
  drawStack(p, sprite, sx, sy);
  return true;
}
