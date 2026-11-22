// Isometric (2:1, "45° top-down") engine for the office: projection, crisp pixel polygons,
// box prisms, floor rasterising, back-wall decals and grid path finding.
// Tile axes: +x runs down-right on screen, +y runs down-left. The back walls stand on x = 0 and y = 0.

export const TILE_W = 32, TILE_H = 16;
const HALF_W = TILE_W / 2, HALF_H = TILE_H / 2;

export function createProjection({ w, h, wallH, pad = 14, slab = 8 }) {
  const ox = h * HALF_W + pad, oy = wallH + pad;
  return {
    w, h, wallH, slab, ox, oy,
    width: (w + h) * HALF_W + pad * 2,
    height: (w + h) * HALF_H + wallH + slab + pad * 2,
    // Tile coordinates (fractional allowed) and height in px → world pixels.
    at(fx, fy, z = 0) { return [ox + (fx - fy) * HALF_W, oy + (fx + fy) * HALF_H - z]; },
    toTile(sx, sy) {
      const a = (sx - ox) / HALF_W, b = (sy - oy) / HALF_H;
      return [(a + b) / 2, (b - a) / 2];
    }
  };
}

// Scanline polygon fill with whole pixels, so shapes stay sharp when the world is scaled up.
export function fillPoly(ctx, pts, color) {
  if (!color) return;
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  ctx.fillStyle = color;
  const n = pts.length;
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) * (bx - ax) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }
}

export function isoPainter(ctx, proj) {
  const box = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const poly = (pts, color) => fillPoly(ctx, pts, color);
  const trim = (x, y, w, h, edge, fill) => { box(x, y, w, h, edge); box(x + 1, y + 1, w - 2, h - 2, fill); };
  function oval(cx, cy, rx, ry, color) {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
      if (half > 0) box(cx - half, cy + dy, half * 2, 1, color);
    }
  }
  const at = proj.at;
  // A box standing on the floor: footprint (x, y, w, d) in tiles, base height z and height h in px.
  // c.top / c.left (the face looking down-left) / c.right (down-right).
  function prism(x, y, z, w, d, h, c) {
    const A = at(x, y, z + h), B = at(x + w, y, z + h), C = at(x + w, y + d, z + h), D = at(x, y + d, z + h);
    const Cb = at(x + w, y + d, z), Db = at(x, y + d, z), Bb = at(x + w, y, z);
    if (h > 0) {
      poly([D, C, Cb, Db], c.left);
      poly([B, C, Cb, Bb], c.right);
    }
    poly([A, B, C, D], c.top);
    if (c.edge && h > 0) { poly([D, C, [C[0], C[1] + 1], [D[0], D[1] + 1]], c.edge); poly([C, B, [B[0], B[1] + 1], [C[0], C[1] + 1]], c.edge); }
  }
  // Rectangles painted on a face. u runs along the face (tiles), v is the height above the floor (px).
  function onLeft(x, y, d, u, v, uw, vh, color) {
    const Y = y + d;
    poly([at(x + u, Y, v + vh), at(x + u + uw, Y, v + vh), at(x + u + uw, Y, v), at(x + u, Y, v)], color);
  }
  function onRight(x, y, w, u, v, uw, vh, color) {
    const X = x + w;
    poly([at(X, y + u, v + vh), at(X, y + u + uw, v + vh), at(X, y + u + uw, v), at(X, y + u, v)], color);
  }
  function onTop(x, y, z, u0, v0, uw, vd, color) {
    poly([at(x + u0, y + v0, z), at(x + u0 + uw, y + v0, z), at(x + u0 + uw, y + v0 + vd, z), at(x + u0, y + v0 + vd, z)], color);
  }
  function flat(x, y, w, d, color, z = 0) { poly([at(x, y, z), at(x + w, y, z), at(x + w, y + d, z), at(x, y + d, z)], color); }
  return { ctx, proj, box, poly, trim, oval, at, prism, onLeft, onRight, onTop, flat };
}

const rgbCache = new Map();
export function rgb(hex) {
  let value = rgbCache.get(hex);
  if (!value) {
    const n = parseInt(hex.slice(1, 7), 16);
    value = [n >> 16, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, value);
  }
  return value;
}
export function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Rasterises every floor tile through its room's material: material(fx, fy, px, py) → [r, g, b].
export function rasterFloor(ctx, proj, roomAt, materials) {
  const image = ctx.createImageData(proj.width, proj.height);
  const data = image.data;
  for (let py = 0; py < proj.height; py++) {
    for (let px = 0; px < proj.width; px++) {
      const [fx, fy] = proj.toTile(px + 0.5, py + 0.5);
      if (fx < 0 || fy < 0 || fx >= proj.w || fy >= proj.h) continue;
      const room = roomAt(Math.floor(fx), Math.floor(fy));
      if (!room) continue;
      const [r, g, b] = materials[room.floor](fx, fy, px, py, room);
      // Soft shade along the two back walls.
      const shade = 0.82 + 0.18 * Math.min(1, fx * 1.4, fy * 1.4);
      const i = (py * proj.width + px) * 4;
      data[i] = r * shade; data[i + 1] = g * shade; data[i + 2] = b * shade; data[i + 3] = 255;
    }
  }
  const layer = document.createElement('canvas');
  layer.width = proj.width; layer.height = proj.height;
  layer.getContext('2d').putImageData(image, 0, 0);
  ctx.drawImage(layer, 0, 0);
}

// Copies a flat wall elevation onto a back wall, one pixel column at a time, giving clean 2:1 steps.
// side 'north' runs along y = 0 (left edge of the image at the corner); 'west' runs along x = 0
// (right edge of the image at the corner).
export function blitWall(ctx, proj, image, side, startU = 0) {
  const len = image.width, H = image.height;
  const [cx, cy] = proj.at(side === 'north' ? startU : 0, side === 'north' ? 0 : startU);
  for (let i = 0; i < len; i++) {
    if (side === 'north') ctx.drawImage(image, i, 0, 1, H, cx + i, Math.round(cy + (i + 0.5) / 2) - H, 1, H);
    else {
      const k = len - 1 - i;
      ctx.drawImage(image, i, 0, 1, H, cx - k - 1, Math.round(cy + (k + 0.5) / 2) - H, 1, H);
    }
  }
}

// Grid with blocked tiles and blocked edges (partitions). 4-way A*.
export function createGrid(w, h) {
  const blocked = new Uint8Array(w * h);
  const walls = new Set();
  const edge = (x, y, nx, ny) => x < nx || y < ny ? `${x},${y},${nx},${ny}` : `${nx},${ny},${x},${y}`;
  return {
    w, h,
    block(x, y) { if (x >= 0 && y >= 0 && x < w && y < h) blocked[y * w + x] = 1; },
    open(x, y) { if (x >= 0 && y >= 0 && x < w && y < h) blocked[y * w + x] = 0; },
    isBlocked: (x, y) => x < 0 || y < 0 || x >= w || y >= h || blocked[y * w + x] === 1,
    wall(x, y, nx, ny) { walls.add(edge(x, y, nx, ny)); },
    walled: (x, y, nx, ny) => walls.has(edge(x, y, nx, ny)),
    path(from, to) {
      const key = (x, y) => y * w + x;
      const goal = key(to[0], to[1]);
      const open = [[from[0], from[1]]], came = new Map(), g = new Map([[key(from[0], from[1]), 0]]);
      const score = ([x, y]) => g.get(key(x, y)) + Math.abs(x - to[0]) + Math.abs(y - to[1]);
      const free = (x, y) => !this.isBlocked(x, y) || key(x, y) === goal;
      while (open.length) {
        let best = 0;
        for (let i = 1; i < open.length; i++) if (score(open[i]) < score(open[best])) best = i;
        const [x, y] = open.splice(best, 1)[0];
        if (key(x, y) === goal) {
          const route = [[x, y]];
          let k = goal;
          while (came.has(k)) { k = came.get(k); route.unshift([k % w, Math.floor(k / w)]); }
          return route;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !free(nx, ny) || this.walled(x, y, nx, ny)) continue;
          const cost = g.get(key(x, y)) + 1, k = key(nx, ny);
          if (cost < (g.get(k) ?? Infinity)) {
            g.set(k, cost); came.set(k, key(x, y));
            if (!open.some(([ox, oy]) => ox === nx && oy === ny)) open.push([nx, ny]);
          }
        }
      }
      return null;
    }
  };
}
