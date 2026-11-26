// Sprite stacking: pseudo-3D pixel art from a stack of horizontal slices (the technique from
// github.com/danielwh2/sprite-stacking, MIT). Models are small voxel grids built in code; each slice is drawn
// rotated, squashed to the isometric camera and lifted one pixel per layer, bottom to top. Every (model, heading)
// pair is baked once into a sprite with lighting and a 1 px outline, so drawing a frame is a single blit.

// The office's isometric camera: a tile is a 2:1 diamond, which is the ground rotated 45° and squashed to 0.5.
export const SQUASH = 0.5;
export const DIRECTIONS = 32;
const LIGHT = norm([-0.55, -0.35, 0.76]); // From the upper left, like the rest of the office art.
const INK = [47, 52, 54];

function norm([x, y, z]) { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }
function rgb(hex) { const n = parseInt(hex.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

// A voxel grid. x runs left→right, y back→front (the model faces +y), z up from the ground.
// ox/oy is the voxel that sits on the ground point.
export function createModel(w, d, h, { ox = Math.floor(w / 2), oy = Math.floor(d / 2) } = {}) {
  const cells = new Array(w * d * h).fill(null);
  const idx = (x, y, z) => (z * d + y) * w + x;
  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < w && y < d && z < h;
  const m = {
    w, d, h, ox, oy, cells,
    get(x, y, z) { return inside(x, y, z) ? cells[idx(x, y, z)] : null; },
    // Coordinates are relative to the ground point; out-of-range voxels are dropped.
    set(x, y, z, color) { x += ox; y += oy; if (inside(x, y, z)) cells[idx(x, y, z)] = color; return m; },
    clear(x, y, z) { return m.set(x, y, z, null); },
    box(x0, y0, z0, x1, y1, z1, color) {
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) m.set(x, y, z, color);
      }
      return m;
    },
    // Upright cylinder (or a disc when z0 = z1).
    cyl(cx, cy, r, z0, z1, color) {
      for (let z = z0; z <= z1; z++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) m.set(x, y, z, color);
      }
      return m;
    },
    // Hollow box: only the outer skin, handy for hair over a head.
    shell(x0, y0, z0, x1, y1, z1, color) {
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1) m.set(x, y, z, color);
      }
      return m;
    }
  };
  return m;
}

// Light one voxel: brighter when its open faces point toward the light after turning the model by `turn`.
function shadeOf(m, x, y, z, turn, base) {
  const c = Math.cos(turn), s = Math.sin(turn);
  let lit = 0, faces = 0;
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]]) {
    if (m.get(x + dx, y + dy, z + dz)) continue;
    // Model normal → screen-aligned world (rotation in the ground plane), then dot with the light.
    const nx = dx * c - dy * s, ny = dx * s + dy * c;
    lit += Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + dz * LIGHT[2]);
    faces++;
  }
  if (!faces) return base;
  // Ambient occlusion: a little darker near the ground.
  const k = 0.68 + 0.42 * (lit / faces) - (z < 2 ? 0.06 : 0);
  return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];
}

const cache = new Map();
const CACHE_LIMIT = 1600;

// Heading (radians, in tile space: 0 = +x/"se", π/2 = +y/"sw") → the screen rotation of the model, whose front is +y.
// Iso screen space is tile space rotated by 45° before the squash.
const screenTurn = heading => heading + Math.PI / 4 - Math.PI / 2;
export const quantize = heading => ((Math.round(heading / (Math.PI * 2) * DIRECTIONS) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;

// Bake (or reuse) the sprite for `key` at a heading. build() makes the model the first time a key is seen.
export function bake(key, build, heading, { outline = true, spacing = 1 } = {}) {
  const dir = quantize(heading);
  const id = key + '@' + dir;
  const hit = cache.get(id);
  if (hit) { cache.delete(id); cache.set(id, hit); return hit; }
  let model = cache.get(key + '#model');
  if (!model) { model = build(); cache.set(key + '#model', model); }
  const turn = screenTurn(dir / DIRECTIONS * Math.PI * 2);
  const { w, d, h } = model;
  const radius = Math.ceil(Math.hypot(w, d) / 2) + 2;
  const W = radius * 2 + 2, H = Math.ceil(radius * 2 * SQUASH) + Math.ceil(h * spacing) + 4;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const ground = [W / 2, H - radius * SQUASH - 2];
  const slice = document.createElement('canvas');
  slice.width = w; slice.height = d;
  const sctx = slice.getContext('2d');
  // Symmetric centre so 90° turns don't wobble half a pixel. The ground point (ox, oy) lands on `ground`.
  const cx = model.ox + 0.5, cy = model.oy + 0.5;
  for (let z = 0; z < h; z++) {
    const image = sctx.createImageData(w, d);
    let any = false;
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
      const color = model.get(x, y, z);
      if (!color) continue;
      const [r, g, b] = shadeOf(model, x, y, z, turn, rgb(color));
      const i = (y * w + x) * 4;
      image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
      any = true;
    }
    if (!any) continue;
    sctx.putImageData(image, 0, 0);
    // Two passes per layer close the gaps a 1 px lift leaves when the camera is squashed.
    for (const lift of [z * spacing, z * spacing + 0.5]) {
      ctx.setTransform(1, 0, 0, SQUASH, ground[0], ground[1] - lift);
      ctx.rotate(turn);
      ctx.drawImage(slice, -cx, -cy);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (outline) traceOutline(ctx, W, H);
  const top = topOf(ctx, W, H);
  const sprite = { canvas, ax: Math.round(ground[0]), ay: Math.round(ground[1]), top: top - Math.round(ground[1]) };
  cache.set(id, sprite);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return sprite;
}

// One dark pixel around everything opaque, matching the ink outlines of the rest of the office.
function traceOutline(ctx, W, H) {
  const image = ctx.getImageData(0, 0, W, H), src = image.data, out = new Uint8ClampedArray(src);
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 96;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (src[i + 3] > 96) { out[i + 3] = 255; continue; }
    if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) { out[i] = INK[0]; out[i + 1] = INK[1]; out[i + 2] = INK[2]; out[i + 3] = 255; }
    else out[i + 3] = 0;
  }
  image.data.set(out);
  ctx.putImageData(image, 0, 0);
}
function topOf(ctx, W, H) {
  const data = ctx.getImageData(0, 0, W, H).data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3]) return y;
  return H;
}

// Blit a baked sprite with its ground point at screen (sx, sy). Returns the screen y of its top edge.
export function drawStack(p, sprite, sx, sy) {
  p.ctx.drawImage(sprite.canvas, Math.round(sx - sprite.ax), Math.round(sy - sprite.ay));
  return Math.round(sy) + sprite.top;
}

// Facing names used around the office → heading in tile space.
export const headingOf = { se: 0, sw: Math.PI / 2, nw: Math.PI, ne: -Math.PI / 2 };
