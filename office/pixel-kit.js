// Shared pixel drawing helpers for the office floors, furniture and characters.

export function painter(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function box(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function poly(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }
  function trim(x, y, w, h, edge, fill) {
    box(x, y, w, h, edge);
    box(x + 1, y + 1, w - 2, h - 2, fill);
  }
  // A filled ellipse made of horizontal runs, so it stays crisp at pixel scale.
  function oval(cx, cy, rx, ry, color) {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
      if (half > 0) box(cx - half, cy + dy, half * 2, 1, color);
    }
  }
  return { ctx, box, poly, trim, oval };
}

export function seeded(seed) {
  return function next() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const digits = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'], C: ['111', '100', '100', '100', '111'], D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'], H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], L: ['100', '100', '100', '100', '111'], O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'], S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'], X: ['101', '101', '010', '101', '101'], ' ': ['000', '000', '000', '000', '000']
};
export function pixelText(p, x, y, text, color) {
  [...String(text)].forEach((c, i) => (digits[c] || digits[' ']).forEach((row, dy) => [...row].forEach((px, dx) => {
    if (px === '1') p.box(x + i * 4 + dx, y + dy, 1, 1, color);
  })));
}

export function plant(p, x, floor, size = 1, variation = 0, leafColors = ['#568459', '#649353', '#488262']) {
  const { ctx, box } = p;
  ctx.save(); ctx.translate(x, floor); ctx.scale(size, size);
  box(-8, -1, 19, 2, '#6f614d55');
  box(-6, -9, 13, 7, '#754d48'); box(-5, -2, 11, 2, '#775048');
  box(-5, -8, 10, 6, '#c0795a'); box(-4, -7, 2, 5, '#df9972'); box(2, -8, 3, 6, '#a55d4c');
  box(-7, -11, 15, 3, '#795049'); box(-6, -11, 12, 2, '#dda37c'); box(-5, -12, 10, 1, '#584638');
  box(0, -32, 2, 22, '#425b41'); box(-4, -26, 1, 12, '#547647');
  const leaves = [[0, -36, -1], [-4, -32, -1], [2, -31, 1], [-6, -26, -1], [4, -25, 1], [-5, -21, -1], [3, -21, 1], [0, -26, 1]];
  leaves.forEach(([lx, ly, dir], i) => {
    const offset = (variation + i) % 3 - 1;
    const c = leafColors[i % 3];
    const hx = lx + offset;
    if (dir < 0) {
      box(hx - 6, ly, 5, 2, '#3b644c'); box(hx - 7, ly + 2, 9, 3, c); box(hx - 5, ly + 5, 8, 3, c); box(hx - 1, ly + 8, 4, 2, '#40674b');
      box(hx - 5, ly + 2, 5, 1, '#91ae64'); box(hx - 3, ly + 4, 4, 1, '#77a45d');
    } else {
      box(hx + 3, ly, 5, 2, '#406950'); box(hx, ly + 2, 9, 3, c); box(hx - 2, ly + 5, 8, 2, c); box(hx - 3, ly + 7, 4, 2, '#3d6a50');
      box(hx + 4, ly + 1, 3, 1, '#a1b76a'); box(hx + 1, ly + 3, 5, 1, '#7ea95f');
    }
  });
  ctx.restore();
}

export function books(p, x, y, length, seed, colors = ['#a95a4f', '#84a4a0', '#e6be7c', '#617e86', '#c38162', '#668984', '#d0af89']) {
  const rnd = seeded(seed);
  let offset = 0;
  while (offset < length - 3) {
    const w = 2 + Math.floor(rnd() * 3), h = 6 + Math.floor(rnd() * 4);
    p.box(x + offset, y - h, w, h, colors[Math.floor(rnd() * colors.length)]);
    if (w > 2) p.box(x + offset, y - h + 2, w - 1, 1, '#ead6ab');
    offset += w + 1;
  }
}

export function cabinet(p, x, y, w, c = {}) {
  const { box, trim } = p;
  const edge = c.edge ?? '#635344', body = c.body ?? '#c19672', top = c.top ?? '#e8bf89', inner = c.inner ?? '#96735a';
  const door = c.door ?? '#cfa57c', doorEdge = c.doorEdge ?? '#b28a67', pull = c.pull ?? '#7b6d62';
  box(x + 2, y + 21, w + 2, 4, '#77695655');
  trim(x, y, w, 23, edge, body);
  box(x + 1, y, w - 2, 3, top); box(x + 2, y + 4, w - 4, 17, inner);
  for (let j = 0; j < 3; j++) {
    const xx = x + 3 + j * Math.floor((w - 4) / 3);
    trim(xx, y + 5, Math.floor((w - 5) / 3), 15, doorEdge, Array.isArray(door) ? door[j % door.length] : door);
    box(xx + 3, y + 8, 4, 1, pull);
  }
  box(x + 3, y + 23, 3, 2, c.leg ?? '#6a574c'); box(x + w - 6, y + 23, 3, 2, c.leg ?? '#6a574c');
}

export function rug(p, x, y, w, h, edge, base, thread, fringe = ['#d9ba89', '#cdaa78']) {
  const { box } = p;
  for (let n = 1; n < w; n += 4) {
    box(x + n, y - 2, 2, 2, fringe[0]); box(x + n, y + h, 2, 2, fringe[1]);
  }
  box(x, y, w, h, edge); box(x + 1, y + 1, w - 2, h - 2, base);
  box(x + 3, y + 3, w - 6, 1, thread); box(x + 3, y + h - 4, w - 6, 1, thread);
  box(x + 3, y + 3, 1, h - 6, thread); box(x + w - 4, y + 3, 1, h - 6, thread);
  for (let cx = x + 8; cx < x + w - 8; cx += 12) {
    box(cx, y + 5, 3, 1, thread); box(cx + 1, y + 6, 1, 1, thread);
    box(cx, y + h - 6, 3, 1, thread); box(cx + 1, y + h - 7, 1, 1, thread);
  }
}

// The view through a window. Higher floors look down on shorter rooftops; some floors face forest or night.
export function windowView(p, x, y, w, h, start, view = {}) {
  const { ctx, box } = p;
  const v = {
    sky: ['#80bbcd', '#9ed6da', '#72a8c0'], cloud: ['#e9ece2', '#f9f3dd'], bodies: ['#85b3b8', '#77a7b1'], side: '#719ba7',
    lit: '#b8d3c7', dark: '#709aa5', minH: 6, maxH: 23, ground: '#79a99a', groundLight: '#91bca9', clouds: true, ...view
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  box(x, y, w, h, v.sky[1]);
  box(x, y, w, h * 0.55 | 0, v.sky[0]);
  box(x, y, w, 4, v.sky[2]);
  if (v.sky[3]) box(x, y + h - 10, w, 10, v.sky[3]);
  const rnd = seeded(start);
  if (v.stars) for (let i = 0; i < w / 4; i++) box(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h * 0.6), 1, 1, rnd() > 0.6 ? '#fff6d8' : '#a9b3d6');
  if (v.moon) { p.oval(x + v.moon, y + 9, 4, 4, '#f6edc8'); p.oval(x + v.moon + 2, y + 8, 3, 3, v.sky[0]); }
  if (v.clouds) {
    const cloud = (cx, cy, size) => {
      box(cx, cy + 3, size, 2, v.cloud[0]);
      box(cx + 3, cy + 1, size - 7, 3, v.cloud[1]);
      box(cx + 7, cy - 1, size - 14, 2, v.cloud[1]);
    };
    cloud(x + 10, y + 9, 31); cloud(x + 54, y + 15, 27); cloud(x + 91, y + 4, 34);
  }
  if (v.mountains) {
    for (let i = 0; i < w; i++) {
      const peak = Math.round(9 + 6 * Math.sin((i + start) / 13) + 4 * Math.sin((i + start) / 5.3));
      box(x + i, y + h - 6 - peak, 1, peak + 6, i % 23 < 11 ? '#7c9aa6' : '#8aa6ad');
      if (peak > 15) box(x + i, y + h - 6 - peak, 1, 2, '#e8efe8');
    }
    for (let i = -4; i < w; i += 6) {
      const th = 9 + Math.floor(rnd() * 9), tx = x + i;
      for (let r = 0; r < th; r++) box(tx + 3 - Math.floor(r / 3), y + h - th + r, 1 + 2 * Math.floor(r / 3), 1, r % 4 === 0 ? '#3f6c51' : '#4d7f58');
    }
  } else {
    let bx = x - 3;
    while (bx < x + w) {
      const bw = Math.round(6 + rnd() * 11);
      const bh = Math.round(v.minH + rnd() * (v.maxH - v.minH));
      const by = y + h - bh;
      const body = rnd() < 0.5 ? v.bodies[0] : v.bodies[1];
      box(bx, by, bw, bh, body);
      box(bx + 2, by - 2, bw - 3, 2, body);
      box(bx + bw - 3, by, 3, bh, v.side);
      for (let wy = by + 3; wy < y + h - 1; wy += 5)
        for (let wx = bx + 2; wx < bx + bw - 3; wx += 4)
          if (rnd() > 0.23) box(wx, wy, 2, 2, rnd() > 0.5 ? v.lit : v.dark);
      bx += bw + 1;
    }
    if (v.ground) for (let i = 0; i < w; i += 10) {
      const hh = 2 + Math.floor(rnd() * 5);
      box(x + i, y + h - hh, 12, hh, v.ground);
      box(x + i + 2, y + h - hh - 2, 7, 3, v.groundLight);
    }
  }
  ctx.restore();
}
