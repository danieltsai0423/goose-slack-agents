// Pixel sprites for shop furniture (placed on the office floor or wall) and consumable items.
// Floor sprites stand on y = base and stay within 38 × 22 px; wall sprites hang from y = 14.

const shadow = (p, x, base, w) => p.box(x - w / 2, base - 1, w, 2, '#3b2f2440');

const floorSprites = {
  bonsai(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 24);
    box(x - 10, b - 5, 20, 4, '#3d4a55'); box(x - 9, b - 5, 18, 1, '#6d7f8c'); box(x - 8, b - 1, 3, 1, '#2b343c'); box(x + 5, b - 1, 3, 1, '#2b343c');
    box(x - 8, b - 6, 16, 1, '#5a4a3a');
    box(x - 1, b - 14, 3, 8, '#6a4a32'); box(x + 1, b - 17, 2, 4, '#6a4a32'); box(x - 4, b - 12, 4, 2, '#6a4a32');
    oval(x - 6, b - 14, 5, 2, '#3f6c51'); oval(x + 4, b - 19, 6, 3, '#4d7f58'); oval(x - 1, b - 21, 4, 2, '#5f9160');
    box(x + 1, b - 21, 4, 1, '#8fbf7a'); box(x - 8, b - 15, 3, 1, '#7aa967');
  },
  beanbag(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 34);
    oval(x, b - 7, 16, 7, '#a04a3a'); oval(x - 1, b - 9, 14, 6, '#c45c47'); oval(x - 4, b - 12, 8, 3, '#d97a62');
    box(x - 6, b - 13, 5, 1, '#ec9b82'); box(x + 6, b - 5, 6, 1, '#8a3d30');
  },
  'espresso-bar'(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 34);
    trim(x - 16, b - 12, 32, 12, '#4a3a2e', '#8c6a4e'); box(x - 15, b - 12, 30, 2, '#b08660');
    trim(x - 12, b - 22, 20, 10, '#7a5530', '#c98a4a'); box(x - 11, b - 22, 18, 2, '#e8b070');
    p.oval(x - 2, b - 18, 3, 3, '#e8dcc0'); box(x - 3, b - 19, 2, 1, '#5a4030');
    box(x - 9, b - 12, 2, 3, '#3a3a3a'); box(x + 3, b - 12, 2, 3, '#3a3a3a');
    box(x - 10, b - 9, 5, 4, '#f2eadb'); box(x + 2, b - 9, 5, 4, '#f2eadb');
    box(x + 10, b - 17, 4, 5, '#d8d0c0'); box(x + 10, b - 18, 4, 1, '#a8a090');
  },
  fridge(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 24);
    trim(x - 11, b - 22, 22, 22, '#5f6a6e', '#d8e2e4');
    trim(x - 9, b - 20, 18, 17, '#7f8b8f', '#a8d4dc');
    for (const [yy, colors] of [[b - 15, ['#e0604a', '#f2c94c', '#6fb07a']], [b - 9, ['#f0a1b8', '#5a8fd0', '#f2eadb']]]) {
      box(x - 8, yy + 2, 16, 1, '#e8f4f6');
      colors.forEach((c, i) => box(x - 7 + i * 5, yy - 3, 3, 5, c));
    }
    box(x + 7, b - 18, 1, 6, '#5f6a6e'); box(x - 10, b - 2, 20, 1, '#5f6a6e');
  },
  record(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 30);
    trim(x - 14, b - 12, 28, 12, '#4a2e1e', '#8a5634'); box(x - 13, b - 12, 26, 2, '#a86d44');
    for (let i = 0; i < 4; i++) box(x - 12 + i * 3, b - 9, 2, 8, ['#c9683a', '#2f6d69', '#e5b046', '#5a3f6a'][i]);
    trim(x - 13, b - 16, 26, 4, '#2c2622', '#4a403a');
    box(x + 9, b - 20, 1, 5, '#c9a45c'); box(x + 6, b - 20, 4, 1, '#c9a45c');
  },
  aquarium(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 36);
    trim(x - 17, b - 6, 34, 6, '#2c2622', '#4a3a2e');
    trim(x - 17, b - 22, 34, 16, '#3a4a50', '#5fa8c0');
    box(x - 16, b - 21, 32, 2, '#8fd0e0'); box(x - 16, b - 9, 32, 2, '#d8c79a');
    for (const [dx, h] of [[-12, 8], [-9, 6], [10, 9], [13, 6]]) box(x + dx, b - 8 - h, 1, h, '#4d9a5a');
    box(x - 17, b - 23, 34, 1, '#2c2622');
  },
  arcade(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 22);
    trim(x - 9, b - 22, 18, 22, '#1e1e3a', '#3a2f7a');
    box(x - 8, b - 22, 16, 4, '#e0508a'); box(x - 6, b - 21, 12, 2, '#ffd36a');
    trim(x - 7, b - 17, 14, 8, '#101020', '#1a2a4a');
    box(x - 8, b - 9, 16, 3, '#2a2a5a'); box(x - 4, b - 9, 1, 2, '#e04040'); box(x - 5, b - 10, 3, 1, '#e04040');
    box(x + 2, b - 8, 2, 1, '#40c0f0'); box(x + 5, b - 8, 2, 1, '#f0e040');
    box(x - 9, b - 6, 18, 1, '#e0508a');
  },
  'massage-chair'(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 32);
    trim(x - 14, b - 22, 12, 18, '#2a2a2e', '#4a4a52');
    trim(x - 14, b - 10, 28, 7, '#2a2a2e', '#56565f');
    trim(x + 6, b - 7, 10, 5, '#2a2a2e', '#4a4a52');
    box(x - 13, b - 21, 10, 2, '#6a6a75'); box(x - 12, b - 17, 8, 1, '#c9a45c'); box(x - 12, b - 14, 8, 1, '#c9a45c');
    box(x - 15, b - 13, 3, 6, '#3a3a40'); box(x + 2, b - 13, 3, 4, '#3a3a40');
    box(x - 10, b - 3, 2, 3, '#1e1e22'); box(x + 8, b - 3, 2, 3, '#1e1e22');
  },
  piano(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 38);
    trim(x - 18, b - 22, 36, 16, '#1a1414', '#2e2422');
    box(x - 17, b - 22, 34, 2, '#4a3a36');
    box(x - 10, b - 19, 20, 5, '#3a2e2a'); box(x - 8, b - 18, 6, 3, '#f2eadb'); box(x + 1, b - 18, 6, 3, '#f2eadb');
    box(x - 18, b - 7, 36, 3, '#f5f1e6');
    for (let i = -17; i < 18; i += 3) { box(x + i, b - 7, 1, 3, '#b9b4ab'); if (i % 2 === 0) box(x + i + 1, b - 7, 1, 2, '#1a1414'); }
    box(x - 18, b - 4, 36, 4, '#2e2422'); box(x - 15, b - 4, 2, 4, '#1a1414'); box(x + 13, b - 4, 2, 4, '#1a1414');
  },
  trophy(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 34);
    trim(x - 16, b - 22, 32, 22, '#2e2422', '#4a3a36');
    trim(x - 14, b - 20, 28, 18, '#6a5a50', '#a8c4cc');
    box(x - 13, b - 12, 26, 1, '#e8f2f4'); box(x - 13, b - 4, 26, 1, '#e8f2f4');
    box(x - 11, b - 19, 6, 4, '#e3c27a'); box(x - 9, b - 15, 2, 2, '#c9a45c'); box(x - 10, b - 13, 4, 1, '#a8843f');
    box(x - 1, b - 19, 4, 6, '#d8dde2'); box(x, b - 13, 2, 1, '#a0a8b0');
    box(x + 7, b - 18, 5, 5, '#c98a4a'); box(x + 8, b - 13, 3, 1, '#8a5a2a');
    box(x - 10, b - 10, 8, 5, '#e3c27a'); box(x - 9, b - 9, 6, 1, '#fff1c4');
    box(x + 2, b - 10, 9, 5, '#f2eadb'); box(x + 3, b - 8, 7, 1, '#c9a45c');
  },
  'floor-lamp'(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 18);
    oval(x - 6, b - 2, 5, 1, '#3a3a3a');
    box(x - 7, b - 22, 2, 20, '#3a3a3a');
    for (let i = 0; i < 9; i++) box(x - 6 + i, b - 23 - Math.round(Math.sin(i / 8 * Math.PI) * 2), 1, 1, '#3a3a3a');
    box(x + 1, b - 22, 8, 3, '#e3c27a'); box(x + 2, b - 22, 6, 1, '#fff1c4'); box(x + 2, b - 19, 6, 1, '#c9963a');
  },
  water(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 18);
    trim(x - 7, b - 14, 14, 14, '#8a9498', '#e8ecee');
    box(x - 5, b - 22, 10, 8, '#7fc3e0'); box(x - 4, b - 21, 3, 6, '#b8e4f4'); box(x - 5, b - 22, 10, 1, '#4f8fb0');
    box(x - 4, b - 11, 2, 2, '#3a7ac0'); box(x + 2, b - 11, 2, 2, '#c94a3a');
    box(x - 5, b - 7, 10, 2, '#6a7478');
  },
  foosball(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 36);
    trim(x - 17, b - 16, 34, 10, '#4a2e1e', '#2f8a4a');
    box(x - 16, b - 15, 32, 1, '#5fb070'); box(x, b - 15, 1, 8, '#e8f2e8');
    for (const [rx, c] of [[-11, '#c94a3a'], [-4, '#3a6ac9'], [4, '#c94a3a'], [11, '#3a6ac9']]) {
      box(x + rx, b - 18, 1, 14, '#c0c6c8');
      for (const dy of [-14, -10]) box(x + rx - 1, b + dy, 3, 2, c);
    }
    box(x - 15, b - 6, 3, 6, '#3a2418'); box(x + 12, b - 6, 3, 6, '#3a2418');
  },
  treadmill(p, x, b) {
    const { box } = p;
    shadow(p, x, b, 36);
    box(x - 17, b - 4, 34, 4, '#2a2a2e'); box(x - 16, b - 4, 32, 1, '#55555f');
    box(x + 12, b - 20, 2, 16, '#3a3a40'); box(x + 8, b - 22, 9, 4, '#3a3a40'); box(x + 9, b - 21, 6, 2, '#5ac8e0');
    box(x - 15, b - 6, 28, 2, '#44444c');
  },
  popcorn(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 24);
    trim(x - 10, b - 8, 20, 6, '#7a1f1f', '#c43a3a');
    box(x - 9, b - 2, 2, 2, '#2a2a2a'); box(x + 7, b - 2, 2, 2, '#2a2a2a');
    trim(x - 9, b - 22, 18, 14, '#7a1f1f', '#e8f4f6');
    box(x - 10, b - 23, 20, 2, '#c43a3a');
    for (let i = 0; i < 12; i++) box(x - 7 + (i * 5) % 14, b - 13 + Math.floor(i / 3) % 4, 2, 2, i % 3 ? '#fff6d8' : '#f2d27a');
  },
  cat(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 30);
    trim(x - 14, b - 6, 14, 6, '#8a6a4a', '#d8c4a0');
    box(x - 9, b - 20, 4, 14, '#c8b48c'); for (let y = b - 19; y < b - 6; y += 3) box(x - 9, y, 4, 1, '#a8946c');
    trim(x - 13, b - 23, 12, 4, '#8a6a4a', '#d8c4a0');
    trim(x + 2, b - 12, 14, 12, '#8a6a4a', '#b89a74'); p.oval(x + 9, b - 6, 3, 3, '#3a2a20');
  },
  fountain(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 36);
    oval(x, b - 4, 17, 4, '#6f7a76'); oval(x, b - 5, 15, 3, '#7fc3d3'); box(x - 14, b - 5, 6, 1, '#d8f3f8');
    box(x - 3, b - 16, 6, 11, '#86918c'); box(x - 2, b - 16, 2, 11, '#a2aca7');
    oval(x, b - 17, 6, 2, '#79847f'); oval(x, b - 18, 5, 1, '#7fc3d3');
  },
  telescope(p, x, b) {
    const { box, poly } = p;
    shadow(p, x, b, 26);
    poly([[x - 10, b], [x - 1, b - 10], [x + 1, b - 10], [x - 8, b]], '#6a5a4a');
    poly([[x + 10, b], [x + 1, b - 10], [x - 1, b - 10], [x + 8, b]], '#6a5a4a');
    box(x - 1, b - 10, 2, 10, '#5a4a3a');
    poly([[x - 12, b - 12], [x + 10, b - 22], [x + 12, b - 18], [x - 10, b - 9]], '#2f4f7a');
    poly([[x + 9, b - 23], [x + 14, b - 25], [x + 16, b - 20], [x + 11, b - 18]], '#c9a45c');
    box(x - 1, b - 15, 3, 3, '#c9a45c');
  },
  'sleep-pod'(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 38);
    oval(x, b - 10, 18, 10, '#d8dde2'); oval(x, b - 10, 17, 9, '#f2f5f7');
    oval(x + 2, b - 11, 11, 6, '#2a3a4a'); oval(x + 2, b - 11, 10, 5, '#3f5a7a');
    box(x - 4, b - 14, 6, 1, '#8fc6f0');
    box(x - 14, b - 2, 28, 2, '#b8c0c8'); box(x - 15, b - 12, 2, 4, '#5ac8e0');
  },
  claw(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 22);
    trim(x - 9, b - 8, 18, 8, '#9a2a5a', '#e0508a');
    trim(x - 9, b - 22, 18, 14, '#9a2a5a', '#d8eef8'); box(x - 9, b - 23, 18, 2, '#e0508a');
    for (const [dx, c] of [[-6, '#f2c94c'], [-2, '#7ac0f0'], [2, '#f0a1b8'], [5, '#7af07a']]) box(x + dx, b - 11, 3, 3, c);
    box(x, b - 21, 1, 5, '#8a9094'); box(x - 2, b - 16, 5, 1, '#8a9094'); box(x - 2, b - 15, 1, 2, '#8a9094'); box(x + 2, b - 15, 1, 2, '#8a9094');
    box(x - 4, b - 6, 3, 2, '#f2c94c'); box(x + 3, b - 6, 2, 2, '#c43a3a');
  },
  hoops(p, x, b) {
    const { box, trim, oval } = p;
    shadow(p, x, b, 30);
    trim(x - 12, b - 8, 24, 8, '#1f4a8a', '#2f6ac9'); box(x - 11, b - 8, 22, 2, '#e08a3a');
    trim(x - 9, b - 22, 18, 12, '#b8c0c4', '#eef2f4'); box(x - 3, b - 18, 6, 4, '#c43a3a'); box(x - 2, b - 17, 4, 2, '#eef2f4');
    oval(x, b - 13, 4, 1, '#e05a2a'); box(x - 3, b - 12, 1, 3, '#d8dde0'); box(x + 2, b - 12, 1, 3, '#d8dde0');
    oval(x + 8, b - 25, 2, 2, '#e08a3a'); box(x + 7, b - 25, 3, 1, '#8a4a1a');
  },
  'dance-pad'(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 34);
    trim(x - 15, b - 4, 30, 4, '#1a1a2a', '#2a2a3a');
    for (const [dx, c] of [[-12, '#e0508a'], [-5, '#40c0f0'], [2, '#7af07a'], [9, '#f2c94c']]) box(x + dx, b - 3, 5, 2, c);
    trim(x - 10, b - 22, 20, 18, '#2a2260', '#3a2f7a'); box(x - 7, b - 19, 14, 9, '#40c0f0'); box(x - 5, b - 17, 3, 3, '#f2c94c'); box(x + 2, b - 15, 3, 3, '#e0508a');
  },
  vr(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 36);
    oval(x, b - 3, 16, 3, '#2a2f3a'); oval(x, b - 4, 13, 2, '#3a5a8a');
    for (const dx of [-15, 14]) { box(x + dx, b - 22, 2, 19, '#4a4e58'); box(x + dx - 1, b - 24, 4, 3, '#7af0f0'); }
    box(x - 6, b - 14, 12, 6, '#2a2f3a'); box(x - 5, b - 13, 10, 2, '#40c0f0'); box(x - 7, b - 12, 1, 3, '#2a2f3a'); box(x + 6, b - 12, 1, 3, '#2a2f3a');
  },
  racing(p, x, b) {
    const { box, trim, oval } = p;
    shadow(p, x, b, 36);
    trim(x - 17, b - 5, 34, 5, '#1a1a1e', '#2a2a2e');
    trim(x - 16, b - 22, 14, 17, '#1a1a1e', '#26303a'); box(x - 14, b - 20, 10, 9, '#5a9ad0'); box(x - 12, b - 14, 6, 1, '#f2c94c');
    oval(x - 3, b - 11, 3, 3, '#3a3a40'); oval(x - 3, b - 11, 1, 1, '#c0c6c8');
    trim(x + 2, b - 18, 6, 13, '#7a1f1f', '#c43a3a'); trim(x + 2, b - 9, 13, 4, '#7a1f1f', '#c43a3a');
  },
  pingpong(p, x, b) {
    const { box, poly } = p;
    shadow(p, x, b, 38);
    box(x - 16, b - 9, 2, 9, '#3a3a40'); box(x + 14, b - 9, 2, 9, '#3a3a40'); box(x - 8, b - 7, 2, 7, '#2a2a30'); box(x + 6, b - 7, 2, 7, '#2a2a30');
    poly([[x - 18, b - 10], [x + 10, b - 10], [x + 18, b - 16], [x - 10, b - 16]], '#2f6ab0');
    poly([[x - 18, b - 10], [x + 10, b - 10], [x + 10, b - 9], [x - 18, b - 9]], '#1c446e');
    poly([[x - 4, b - 10], [x - 3, b - 10], [x + 4, b - 16], [x + 3, b - 16]], '#e8f2f8');
    box(x - 1, b - 16, 2, 4, '#f2f2f2'); box(x - 14, b - 21, 4, 4, '#c43a3a'); box(x - 13, b - 17, 1, 2, '#8a5a3a'); box(x + 6, b - 22, 2, 2, '#ffffff');
  },
  'air-hockey'(p, x, b) {
    const { box, poly, oval } = p;
    shadow(p, x, b, 38);
    poly([[x - 18, b - 6], [x + 10, b - 6], [x + 18, b - 14], [x - 10, b - 14]], '#3a6ac9');
    poly([[x - 16, b - 7], [x + 9, b - 7], [x + 15, b - 13], [x - 9, b - 13]], '#eef4f8');
    poly([[x - 2, b - 7], [x - 1, b - 7], [x + 4, b - 13], [x + 3, b - 13]], '#e05a5a');
    box(x - 18, b - 6, 28, 6, '#2a2f3a'); box(x + 10, b - 6, 8, 2, '#2a2f3a');
    oval(x - 9, b - 10, 2, 1, '#e05a5a'); oval(x + 9, b - 11, 2, 1, '#e0b03a'); oval(x + 2, b - 10, 2, 1, '#1a1a2a');
  },
  pool(p, x, b) {
    const { box, poly } = p;
    shadow(p, x, b, 38);
    box(x - 15, b - 8, 3, 8, '#5a3a22'); box(x + 12, b - 8, 3, 8, '#5a3a22');
    poly([[x - 19, b - 8], [x + 11, b - 8], [x + 19, b - 16], [x - 11, b - 16]], '#6a4428');
    poly([[x - 16, b - 9], [x + 10, b - 9], [x + 16, b - 15], [x - 10, b - 15]], '#2f7a4a');
    for (const [dx, dy, c] of [[4, -12, '#f2c94c'], [7, -11, '#c43a3a'], [6, -13, '#2f58a8'], [9, -12, '#5a2a6a'], [-7, -11, '#f8f8f2']]) box(x + dx, b + dy, 2, 2, c);
    poly([[x - 18, b - 18], [x - 17, b - 19], [x - 6, b - 12], [x - 7, b - 11]], '#c49a6a');
  },
  karaoke(p, x, b) {
    const { box, trim } = p;
    shadow(p, x, b, 38);
    trim(x - 18, b - 5, 36, 5, '#2a1a30', '#4a2e52');
    trim(x - 12, b - 22, 24, 15, '#1a1420', '#2a2040'); box(x - 10, b - 20, 20, 11, '#7a4ac0'); box(x - 8, b - 15, 16, 1, '#ffffff'); box(x - 6, b - 12, 12, 1, '#f2c94c');
    trim(x - 18, b - 15, 5, 10, '#0a0a0e', '#1a1a1e'); trim(x + 13, b - 15, 5, 10, '#0a0a0e', '#1a1a1e');
    box(x + 7, b - 18, 1, 13, '#8a8a92'); box(x + 6, b - 20, 3, 2, '#2a2a2e');
    box(x - 16, b - 24, 2, 2, '#e0508a'); box(x + 15, b - 25, 2, 2, '#40c0f0');
  },
  boardgame(p, x, b) {
    const { box, oval } = p;
    shadow(p, x, b, 34);
    box(x - 1, b - 9, 3, 9, '#5a4030'); oval(x, b - 1, 6, 1, '#3a2a20');
    oval(x, b - 11, 16, 5, '#7a5230'); oval(x, b - 12, 15, 4, '#a8743a');
    oval(x, b - 12, 9, 3, '#efe3c4'); for (const dx of [-6, -2, 2, 6]) box(x + dx, b - 13 + (dx % 4 ? 1 : 0), 2, 1, '#c9b48a');
    box(x - 5, b - 17, 2, 4, '#c43a3a'); box(x + 3, b - 16, 2, 3, '#2f58a8'); box(x - 1, b - 15, 2, 3, '#3f8a4a');
    box(x + 9, b - 18, 3, 3, '#ffffff'); box(x + 10, b - 17, 1, 1, '#1a1a1a');
  },
  sculpture(p, x, b) {
    const { box, trim, oval } = p;
    shadow(p, x, b, 22);
    trim(x - 8, b - 8, 16, 8, '#c9c4bc', '#efece6');
    oval(x - 2, b - 15, 4, 6, '#8a5a2a'); oval(x + 3, b - 19, 3, 4, '#a8743a'); oval(x - 1, b - 22, 2, 2, '#c98a4a');
    box(x - 4, b - 13, 2, 3, '#c98a4a');
  }
};

const wallSprites = {
  clock(p, x, y) {
    const { box, oval } = p;
    oval(x, y + 10, 8, 8, '#8a6a3a'); oval(x, y + 10, 7, 7, '#c9a45c'); oval(x, y + 10, 6, 6, '#f6efd9');
    for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) box(x + dx, y + 10 + dy, 1, 1, '#5a4a3a');
    box(x - 3, y + 19, 6, 6, '#c9a45c'); box(x - 1, y + 19, 2, 4, '#8a6a3a');
  },
  map(p, x, y) {
    const { box, trim } = p;
    trim(x - 9, y + 2, 18, 14, '#6a4a32', '#9fd0da');
    box(x - 7, y + 5, 5, 4, '#8fbf7a'); box(x - 6, y + 9, 3, 4, '#8fbf7a'); box(x - 1, y + 4, 4, 5, '#c9b47a');
    box(x + 2, y + 9, 3, 3, '#c9b47a'); box(x + 4, y + 4, 4, 4, '#8fbf7a'); box(x + 5, y + 11, 2, 2, '#c9b47a');
    box(x - 5, y + 6, 1, 1, '#c43a3a'); box(x + 5, y + 5, 1, 1, '#c43a3a'); box(x + 1, y + 6, 1, 1, '#f2c94c');
  },
  'vinyl-wall'(p, x, y) {
    const { box, oval } = p;
    const covers = ['#c9683a', '#2f6d69', '#e5b046', '#5a3f6a', '#c43a3a', '#3a6ac9'];
    covers.forEach((c, i) => {
      const cx = x - 8 + (i % 2) * 9, cy = y + (i >> 1) * 9;
      box(cx, cy, 8, 8, '#1a1a1a'); box(cx + 1, cy + 1, 6, 6, c);
      oval(cx + 4, cy + 4, 2, 2, '#1a1a1a'); box(cx + 4, cy + 4, 1, 1, '#f2eadb');
    });
  },
  poster(p, x, y) {
    const { box, trim } = p;
    trim(x - 8, y, 16, 22, '#3a3a3a', '#f2e6c8');
    box(x - 6, y + 2, 12, 9, '#9fd0da'); box(x - 6, y + 7, 12, 4, '#3f8a86');
    p.poly([[x - 6, y + 11], [x - 1, y + 4], [x + 4, y + 11]], '#e07a42'); box(x + 2, y + 3, 3, 3, '#f2c94c');
    box(x - 5, y + 14, 10, 1, '#c9683a'); box(x - 4, y + 17, 8, 1, '#7a6a5a');
  },
  neon(p, x, y) {
    const { box } = p;
    box(x - 9, y + 2, 18, 14, '#1a1a2a');
    box(x - 10, y + 1, 20, 1, '#3a3a4a');
  },
  painting(p, x, y) {
    const { box, trim } = p;
    trim(x - 9, y, 18, 26, '#c9a45c', '#f2eadb');
    box(x - 7, y + 2, 14, 22, '#e9e2d0');
    box(x - 7, y + 2, 8, 9, '#c9683a'); box(x + 1, y + 6, 6, 10, '#2f6d69'); box(x - 5, y + 13, 7, 9, '#e5b046');
    box(x - 7, y + 18, 3, 6, '#1a1a2a'); box(x + 3, y + 18, 4, 3, '#c43a3a');
  }
};

export function drawFurniture(p, id, x, base) {
  floorSprites[id]?.(p, x, base);
}
export function drawWallArt(p, id, x, top) {
  wallSprites[id]?.(p, x, top);
}

// Frame-by-frame details drawn over the cached room.
export function drawFurnitureLive(p, id, x, base, tick) {
  const { box } = p;
  if (id === 'aquarium') {
    for (const [i, color] of [[0, '#f29a3a'], [1, '#f2e04a'], [2, '#e05a8a']]) {
      const span = 26, t = (tick * (i + 1) + i * 9) % (span * 2);
      const dx = t < span ? t : span * 2 - t, left = t >= span;
      const fx = x - 13 + dx, fy = base - 18 + i * 3;
      box(fx, fy, 3, 2, color); box(left ? fx + 3 : fx - 1, fy, 1, 2, color);
    }
    if (tick % 6 < 3) box(x + 8, base - 19 + (tick % 3), 1, 1, '#e8f8fb');
  }
  if (id === 'record') {
    const angle = tick % 4;
    p.oval(x, base - 14, 8, 2, '#141414'); p.oval(x, base - 14, 3, 1, ['#c9683a', '#e5b046', '#c9683a', '#e5b046'][angle]);
    box(x - 6 + angle * 3, base - 15, 2, 1, '#4a4a4a');
    if (tick % 8 < 4) { box(x + 11, base - 26 - (tick % 4), 2, 3, '#e5b046'); box(x + 13, base - 27 - (tick % 4), 1, 2, '#e5b046'); }
  }
  if (id === 'arcade') {
    const c = ['#40c0f0', '#f0e040', '#e0508a', '#7af07a'][tick % 4];
    box(x - 5, base - 15, 3, 2, c); box(x + 1 + (tick % 3), base - 13, 2, 2, '#f2eadb'); box(x - 6, base - 11, 12, 1, '#40c0f0');
  }
  if (id === 'espresso-bar' && tick % 5 < 3) {
    box(x - 9 + (tick % 2), base - 13 - (tick % 3), 1, 2, '#f2eadb80'); box(x + 3, base - 12 - (tick % 2), 1, 2, '#f2eadb80');
  }
  if (id === 'floor-lamp') {
    p.poly([[x + 1, base - 19], [x + 9, base - 19], [x + 14, base - 2], [x - 4, base - 2]], tick % 40 === 0 ? '#fff1c40a' : '#fff1c418');
  }
  if (id === 'water' && tick % 12 < 3) {
    box(x - 2, base - 16 - (tick % 12) * 2, 2, 2, '#e8f8fb'); box(x + 1, base - 15 - (tick % 12), 1, 1, '#e8f8fb');
  }
  if (id === 'treadmill') {
    for (let i = 0; i < 28; i += 5) box(x - 15 + (i + tick) % 28, base - 6, 2, 1, '#2a2a2e');
  }
  if (id === 'popcorn' && tick % 4 < 2) {
    box(x - 5 + (tick * 3) % 10, base - 20 + (tick % 2) * 2, 2, 2, '#fff6d8');
  }
  if (id === 'cat') {
    // An orange cat dozing on the top of the tree; its tail swishes and it blinks now and then.
    const cx = x - 7, cy = base - 23;
    p.oval(cx, cy - 3, 5, 3, '#e08a3a'); box(cx - 3, cy - 5, 6, 1, '#f2a85a'); box(cx - 2, cy - 2, 1, 2, '#c06a2a'); box(cx + 1, cy - 2, 1, 2, '#c06a2a');
    p.oval(cx + 5, cy - 5, 3, 2, '#e08a3a'); box(cx + 3, cy - 8, 1, 2, '#e08a3a'); box(cx + 6, cy - 8, 1, 2, '#e08a3a');
    if (tick % 17 === 0) { box(cx + 4, cy - 5, 1, 1, '#2a2a2a'); box(cx + 6, cy - 5, 1, 1, '#2a2a2a'); }
    else { box(cx + 4, cy - 5, 2, 1, '#7a3a1a'); box(cx + 6, cy - 5, 1, 1, '#7a3a1a'); }
    const swish = [0, 1, 2, 1][tick % 4];
    box(cx - 6, cy - 3 + swish, 2, 1, '#e08a3a'); box(cx - 7, cy - 4 + swish * 2, 1, 2, '#e08a3a');
    if (tick % 30 < 15) { box(cx + 9, cy - 11 - (tick % 15 > 7 ? 2 : 0), 3, 1, '#c8d4e8'); }
  }
  if (id === 'fountain') {
    const phase = tick % 3;
    box(x - 1, base - 23, 2, 5, '#c7ecf3');
    for (const [dx, dy] of [[-3, -20], [3, -20], [-5, -16], [5, -16]]) box(x + dx + (dx > 0 ? phase : -phase) / 2, base + dy + phase, 1, 2, '#e8f8fb');
    box(x - 10 + (tick % 20), base - 5, 3, 1, '#d8f3f8');
  }
  if (id === 'sleep-pod' && tick % 20 < 10) box(x - 15, base - 12, 2, 4, '#9ff0ff');
}

export function drawWallArtLive(p, id, x, top, tick) {
  const { box } = p;
  if (id === 'clock') {
    const minute = tick % 12, angle = minute / 12 * Math.PI * 2 - Math.PI / 2;
    for (let r = 1; r < 5; r++) box(Math.round(x + Math.cos(angle) * r), Math.round(top + 10 + Math.sin(angle) * r), 1, 1, '#2a2a2a');
    box(x, top + 7, 1, 3, '#2a2a2a');
    const swing = [0, 1, 2, 1, 0, -1, -2, -1][tick % 8];
    box(x - 1 + swing, top + 22, 3, 3, '#e3c27a');
    return;
  }
  if (id !== 'neon') return;
  const on = tick % 23 !== 0;
  const pink = on ? '#ff6ad0' : '#6a3a5a', blue = on ? '#6ae0ff' : '#2a5a6a';
  if (on) box(x - 10, top + 1, 20, 16, '#ff6ad014');
  // "SHIP IT" in two rows of tube letters.
  const rows = [['S', 'H', 'I', 'P'], ['I', 'T']];
  const glyph = {
    S: ['111', '100', '111', '001', '111'], H: ['101', '101', '111', '101', '101'], I: ['1', '1', '1', '1', '1'],
    P: ['111', '101', '111', '100', '100'], T: ['111', '010', '010', '010', '010']
  };
  rows.forEach((letters, r) => {
    let cx = x - (r ? 4 : 8);
    for (const letter of letters) {
      glyph[letter].forEach((row, dy) => [...row].forEach((px, dx) => { if (px === '1') box(cx + dx, top + 4 + r * 6 + dy, 1, 1, r ? blue : pink); }));
      cx += glyph[letter][0].length + 1;
    }
  });
}

// 12 × 12 item icons, drawn at the top-left corner (x, y).
const itemSprites = {
  tea(p, x, y) { const { box } = p; box(x + 2, y + 5, 8, 6, '#e8dcc0'); box(x + 3, y + 6, 6, 2, '#a8743f'); box(x + 10, y + 6, 2, 3, '#e8dcc0'); box(x + 1, y + 11, 10, 1, '#8a7a6a'); box(x + 4, y + 1, 1, 3, '#f2eadb90'); box(x + 7, y, 1, 3, '#f2eadb90'); },
  espresso(p, x, y) { const { box } = p; box(x + 3, y + 6, 6, 5, '#f2eadb'); box(x + 4, y + 6, 4, 2, '#5a3420'); box(x + 9, y + 7, 2, 2, '#f2eadb'); box(x + 1, y + 11, 10, 1, '#c9a45c'); box(x + 5, y + 2, 1, 3, '#f2eadb90'); },
  macaron(p, x, y) { const { box } = p; for (const [dx, dy, c] of [[0, 2, '#f0a1b8'], [6, 2, '#a8d48a'], [3, 7, '#f2c94c']]) { box(x + dx, y + dy, 6, 2, c); box(x + dx, y + dy + 2, 6, 1, '#f8f0e0'); box(x + dx, y + dy + 3, 6, 2, c); } },
  pizza(p, x, y) { const { box, poly } = p; poly([[x, y + 2], [x + 12, y + 2], [x + 6, y + 12]], '#f2c94c'); box(x, y + 1, 12, 2, '#c98a4a'); box(x + 3, y + 4, 2, 2, '#c43a3a'); box(x + 7, y + 5, 2, 2, '#c43a3a'); box(x + 5, y + 8, 2, 1, '#c43a3a'); },
  pillow(p, x, y) { const { box } = p; box(x + 1, y + 3, 10, 7, '#dfe6f2'); box(x, y + 4, 12, 5, '#dfe6f2'); box(x + 2, y + 4, 8, 1, '#ffffff'); box(x + 2, y + 9, 8, 1, '#a8b4c8'); box(x + 8, y, 1, 1, '#a8b4c8'); box(x + 9, y + 1, 2, 1, '#a8b4c8'); },
  book(p, x, y) { const { box } = p; box(x + 1, y + 1, 10, 10, '#6a3a2a'); box(x + 2, y + 2, 8, 8, '#8a4a32'); box(x + 9, y + 2, 2, 9, '#f2eadb'); box(x + 3, y + 4, 5, 1, '#e3c27a'); box(x + 4, y + 6, 3, 1, '#e3c27a'); },
  kit(p, x, y) { const { box, oval } = p; oval(x + 6, y + 6, 5, 5, '#8a9498'); oval(x + 6, y + 6, 2, 2, '#3a4044'); for (const [dx, dy] of [[5, 0], [5, 10], [0, 5], [10, 5]]) box(x + dx, y + dy, 2, 2, '#8a9498'); box(x + 9, y + 1, 3, 3, '#c9683a'); },
  massage(p, x, y) { const { box } = p; box(x, y + 3, 12, 7, '#e3c27a'); box(x + 1, y + 4, 10, 5, '#fff1c4'); box(x + 3, y + 5, 6, 1, '#c9683a'); box(x + 3, y + 7, 4, 1, '#a8843f'); box(x, y + 6, 1, 1, '#fff'); box(x + 11, y + 6, 1, 1, '#fff'); },
  party(p, x, y) { const { box, poly } = p; poly([[x + 1, y + 11], [x + 5, y + 3], [x + 9, y + 7]], '#e0508a'); box(x + 3, y + 8, 2, 1, '#f2c94c'); box(x + 8, y, 1, 2, '#6ae0ff'); box(x + 10, y + 3, 2, 1, '#f2c94c'); box(x + 6, y + 1, 1, 1, '#7af07a'); box(x + 11, y + 6, 1, 2, '#e0508a'); },
  cocoa(p, x, y) { const { box } = p; box(x + 2, y + 4, 8, 7, '#c9683a'); box(x + 3, y + 4, 6, 2, '#6a3a2a'); box(x + 4, y + 3, 2, 2, '#fff6f0'); box(x + 7, y + 3, 2, 2, '#ffe0e8'); box(x + 10, y + 6, 2, 3, '#c9683a'); box(x + 1, y + 11, 10, 1, '#8a5a3a'); },
  boba(p, x, y) { const { box } = p; box(x + 3, y + 3, 7, 9, '#e8d4b4'); box(x + 3, y + 3, 7, 1, '#c9b48c'); box(x + 7, y, 1, 4, '#3a6ac9'); for (const [dx, dy] of [[4, 9], [6, 10], [8, 9], [5, 11], [7, 11]]) box(x + dx, y + dy, 1, 1, '#3a2418'); },
  icecream(p, x, y) { const { box, poly, oval } = p; poly([[x + 3, y + 6], [x + 9, y + 6], [x + 6, y + 12]], '#d8a46a'); oval(x + 6, y + 4, 4, 3, '#8fbf6a'); box(x + 4, y + 2, 3, 1, '#b8e08a'); },
  energy(p, x, y) { const { box } = p; box(x + 3, y + 1, 6, 11, '#2a2a3a'); box(x + 4, y + 1, 4, 1, '#c0c6c8'); box(x + 4, y + 4, 4, 1, '#7af07a'); box(x + 6, y + 5, 2, 2, '#f2e04a'); box(x + 4, y + 7, 2, 2, '#f2e04a'); box(x + 5, y + 9, 1, 1, '#f2e04a'); },
  fruit(p, x, y) { const { box, oval } = p; box(x, y + 7, 12, 4, '#f2eadb'); box(x + 1, y + 11, 10, 1, '#c9c0b0'); oval(x + 3, y + 6, 2, 2, '#f2a83a'); oval(x + 8, y + 6, 2, 2, '#7ac04a'); box(x + 5, y + 3, 2, 2, '#8a4aa8'); box(x + 6, y + 5, 2, 2, '#8a4aa8'); },
  ramen(p, x, y) { const { box, oval } = p; oval(x + 6, y + 8, 6, 3, '#c43a3a'); oval(x + 6, y + 7, 5, 2, '#f2d8a4'); box(x + 3, y + 6, 3, 2, '#fff6d8'); box(x + 4, y + 6, 1, 1, '#f2a83a'); box(x + 7, y + 6, 3, 1, '#7ac04a'); box(x + 8, y, 1, 6, '#c9a45c'); box(x + 10, y + 1, 1, 5, '#c9a45c'); },
  aroma(p, x, y) { const { box } = p; box(x + 3, y + 6, 6, 6, '#7a9a8a'); box(x + 4, y + 7, 4, 4, '#a8c8b4'); box(x + 5, y + 4, 2, 2, '#c9a45c'); box(x + 5, y + 2, 1, 2, '#f2eadb90'); box(x + 7, y, 1, 3, '#f2eadb90'); box(x + 3, y + 1, 1, 2, '#f2eadb90'); },
  trip(p, x, y) { const { box, poly } = p; poly([[x, y + 10], [x + 5, y + 3], [x + 9, y + 8], [x + 12, y + 10]], '#7a9aa8'); box(x + 4, y + 3, 2, 1, '#ffffff'); box(x + 9, y + 1, 3, 3, '#f2a83a'); box(x, y + 10, 12, 2, '#5fa8c0'); box(x + 2, y + 9, 3, 1, '#e8f8fb'); }
};
// Shop items with a 16 × 16 sprite from the Pixel Art Atlas (office/sprites/CREDITS.md). Drawn centred on the
// 12 × 12 icon box, so they overhang it by 2 px on each side; until an image loads the hand-drawn icon is used.
const itemArt = {};
for (const id of ['tea', 'espresso', 'macaron', 'pizza', 'pillow', 'book', 'massage', 'party', 'cocoa', 'boba', 'icecream', 'energy', 'fruit', 'ramen', 'aroma', 'trip']) {
  if (typeof Image !== 'function') break;
  const img = new Image();
  img.src = `./sprites/items/${id}.png`;
  itemArt[id] = img;
}
export const itemArtReady = id => Boolean(itemArt[id]?.complete && itemArt[id].naturalWidth);
export function whenItemArt(id, fn) { const img = itemArt[id]; if (img && !itemArtReady(id)) img.addEventListener('load', fn, { once: true }); }
export function drawItem(p, id, x, y) {
  if (itemArtReady(id)) { p.ctx.imageSmoothingEnabled = false; p.ctx.drawImage(itemArt[id], Math.round(x) - 2, Math.round(y) - 2, 16, 16); return; }
  itemSprites[id]?.(p, x, y);
}

// 12 × 12 icons for office perks.
const perkSprites = {
  flex(p, x, y) { const { box, oval } = p; oval(x + 6, y + 6, 6, 6, '#3f8a86'); oval(x + 6, y + 6, 5, 5, '#f6efd9'); box(x + 6, y + 2, 1, 4, '#2a2a2a'); box(x + 6, y + 6, 3, 1, '#2a2a2a'); box(x + 10, y, 2, 2, '#f2c94c'); },
  snacks(p, x, y) { const { box } = p; box(x + 1, y + 3, 10, 9, '#e07a42'); box(x + 1, y + 3, 10, 2, '#f2c94c'); box(x + 3, y + 1, 2, 3, '#f2eadb'); box(x + 7, y, 2, 4, '#c43a3a'); box(x + 3, y + 7, 6, 2, '#fff6d8'); },
  gym(p, x, y) { const { box } = p; box(x + 2, y + 5, 8, 2, '#8a9498'); for (const dx of [0, 10]) box(x + dx, y + 3, 2, 6, '#3a4044'); box(x + 2, y + 4, 1, 4, '#3a4044'); box(x + 9, y + 4, 1, 4, '#3a4044'); },
  pet(p, x, y) { const { box, oval } = p; oval(x + 6, y + 8, 4, 3, '#c98a4a'); for (const [dx, dy] of [[2, 3], [5, 1], [8, 1], [11, 3]]) oval(x + dx, y + dy + 1, 1, 1, '#c98a4a'); },
  training(p, x, y) { const { box, poly } = p; poly([[x, y + 5], [x + 6, y + 2], [x + 12, y + 5], [x + 6, y + 8]], '#2a3a5a'); box(x + 3, y + 6, 6, 4, '#2a3a5a'); box(x + 11, y + 5, 1, 5, '#f2c94c'); box(x + 10, y + 10, 2, 1, '#f2c94c'); },
  counsel(p, x, y) { const { box } = p; box(x + 1, y + 2, 10, 7, '#a8c8e8'); box(x + 3, y + 9, 2, 2, '#a8c8e8'); box(x + 3, y + 4, 2, 2, '#f29ab0'); box(x + 7, y + 4, 2, 2, '#f29ab0'); box(x + 4, y + 6, 4, 1, '#f29ab0'); box(x + 5, y + 7, 2, 1, '#f29ab0'); },
  remote(p, x, y) { const { box, poly } = p; poly([[x + 6, y], [x + 12, y + 5], [x, y + 5]], '#c9683a'); box(x + 1, y + 5, 10, 7, '#f2e6c8'); box(x + 3, y + 7, 3, 5, '#6a4a32'); box(x + 7, y + 7, 3, 3, '#9fd0da'); },
  bonus(p, x, y) { const { box, oval } = p; oval(x + 4, y + 8, 4, 3, '#c9963a'); oval(x + 4, y + 7, 4, 3, '#f2c94c'); oval(x + 8, y + 5, 4, 3, '#c9963a'); oval(x + 8, y + 4, 4, 3, '#f2d27a'); box(x + 7, y + 3, 2, 1, '#fff1c4'); }
};
export function drawPerk(p, id, x, y) {
  perkSprites[id]?.(p, x, y);
}

// Small emotion marks drawn above a character's head (x is the head centre, y its top).
export function drawEmotion(p, emotion, x, y, tick) {
  const { box } = p;
  const bob = tick % 6 < 3 ? 0 : 1;
  if (emotion === 'elated') {
    box(x + 7, y - 6 + bob, 2, 2, '#ff7a9a'); box(x + 10, y - 6 + bob, 2, 2, '#ff7a9a'); box(x + 7, y - 4 + bob, 5, 2, '#ff7a9a'); box(x + 8, y - 2 + bob, 3, 1, '#ff7a9a');
    if (tick % 4 < 2) box(x - 9, y - 3, 1, 1, '#fff1c4');
  } else if (emotion === 'happy') {
    if (tick % 10 < 5) { box(x + 8, y - 7 + bob, 1, 5, '#f2c94c'); box(x + 6, y - 3 + bob, 3, 2, '#f2c94c'); box(x + 9, y - 7 + bob, 2, 1, '#f2c94c'); }
  } else if (emotion === 'tired') {
    const z = tick % 9;
    box(x + 7, y - 4 - (z > 3 ? 3 : 0), 3, 1, '#c8d4e8'); box(x + 8, y - 3 - (z > 3 ? 3 : 0), 1, 1, '#c8d4e8'); box(x + 7, y - 2 - (z > 3 ? 3 : 0), 3, 1, '#c8d4e8');
  } else if (emotion === 'grumpy') {
    box(x + 6, y - 6, 6, 3, '#55606a'); box(x + 5, y - 5, 8, 2, '#55606a');
    if (tick % 4 < 2) { box(x + 7, y - 2, 1, 2, '#f2c94c'); box(x + 8, y - 1, 1, 1, '#f2c94c'); }
  } else if (emotion === 'sad') {
    box(x + 5, y - 7, 8, 3, '#7a8a9a'); box(x + 6, y - 8, 5, 1, '#7a8a9a');
    box(x + 6 + (tick % 3) * 2, y - 3 + (tick % 2), 1, 2, '#8fc6f0');
  }
}

// Short burst particles after an item is given.
export function drawBurst(p, kind, x, y, progress) {
  const { box } = p;
  const rise = Math.round(progress * 14);
  const fade = progress < 0.8;
  const colors = kind === 'party' ? ['#e0508a', '#f2c94c', '#6ae0ff', '#7af07a'] : kind === 'energy' ? ['#f2c94c', '#fff1c4'] : ['#ff7a9a', '#ffb0c0'];
  for (let i = 0; i < (kind === 'party' ? 10 : 5); i++) {
    const angle = i * 2.4 + progress * 2;
    const r = 6 + progress * (kind === 'party' ? 22 : 10);
    const px = Math.round(x + Math.cos(angle) * r), py = Math.round(y - rise + Math.sin(angle) * r * 0.5);
    if (!fade && i % 2) continue;
    if (kind === 'love' || kind === 'mood') { box(px, py, 2, 1, colors[0]); box(px + 3, py, 2, 1, colors[0]); box(px, py + 1, 5, 1, colors[0]); box(px + 1, py + 2, 3, 1, colors[0]); box(px + 2, py + 3, 1, 1, colors[0]); }
    else if (kind === 'energy') { box(px + 1, py, 2, 2, colors[0]); box(px, py + 2, 3, 1, colors[0]); box(px + 1, py + 3, 1, 2, colors[0]); }
    else box(px, py, 2, 2, colors[i % colors.length]);
  }
}
