import { createBehaviors, errandPhase } from './behavior.js';
import { facilities } from './iso-facilities.js';
import { headingOf } from './stack.js';
import { drawAnimeCharacter } from './anime-people.js';
import { drawFurnitureStack } from './voxel-furniture.js';

// Static pieces drawn as sprite-stacked voxel models instead of flat iso drawings.
const stackedProps = new Set();
const stackedFurniture = new Set(['bonsai', 'trophy', 'sculpture', 'telescope']);
import { createOfficeLife } from './life.js';
import { furnitureById, itemById } from './economy.js';
import { drawBurst, drawItem } from './furniture.js';
import { blitWall, createProjection, isoPainter, rasterFloor } from './iso.js';
import { planFloor } from './iso-world.js';
import { materials, paintWall, setSky, themes } from './iso-themes.js';
import { drawCharacter, drawChair, drawDesk, drawEmote, furnitureIso, props as propDrawers, setSeason, shade, tone } from './iso-props.js';

// A 2.5D isometric office. The floor, back walls and rugs are drawn once per floor; desks, props,
// partitions and people are depth-sorted every frame into a world-sized canvas, which the camera
// then scales onto the visible canvas (drag to pan, wheel or pinch to zoom).
export const variants = { claude: 0, codex: 1, 'claude-research': 2, 'claude-review': 3, 'codex-build': 4, 'codex-test': 5 };
const teamOf = id => id.startsWith('claude') ? 'claude' : 'codex';
const workingStates = new Set(['planning', 'working', 'running', 'busy', 'delegated', 'reviewing', 'queued']);
const deskProps = ['cup', 'note', 'book', 'note', 'tools', 'cup'];
// What people do at each bought piece. onto: they climb on (beanbag, pod, treadmill) instead of standing beside it.
const activities = {
  beanbag: { action: 'sit', onto: true, z: 3, facing: 'sw' }, 'massage-chair': { action: 'sit', onto: true, z: 6, facing: 'sw' },
  'sleep-pod': { action: 'lie', onto: true, z: 7 }, treadmill: { action: 'run', onto: true, z: 4, facing: 'se' },
  piano: { action: 'piano' }, arcade: { action: 'play' }, foosball: { action: 'play' }, record: { action: 'dance' }, cat: { action: 'pet' },
  'espresso-bar': { action: 'drink', prop: 'cup' }, water: { action: 'drink', prop: 'water' }, fridge: { action: 'eat' }, popcorn: { action: 'eat' },
  bonsai: { action: 'fix', prop: 'tools' }, 'floor-lamp': { action: 'read', prop: 'book' }, telescope: { action: 'look' },
  aquarium: { action: 'look' }, fountain: { action: 'look' }, trophy: { action: 'look' }, sculpture: { action: 'look' },
  claw: { action: 'play', emote: 'heart' }, hoops: { action: 'shoot' }, 'dance-pad': { action: 'dance', onto: true, z: 3, facing: 'sw' },
  vr: { action: 'vr', onto: true, z: 1, facing: 'sw' }, racing: { action: 'drive', onto: true, z: 4, facing: 'ne' },
  // Group games: one role per spot around the table, in the order the layout lists the spots.
  pingpong: { roles: ['paddle', 'paddle'] }, 'air-hockey': { roles: ['paddle', 'paddle'] }, pool: { roles: ['cue', 'cue'], turns: true },
  karaoke: { roles: ['sing', 'cheer', 'cheer'], emotes: [null, null, 'note'], stage: true }, boardgame: { roles: ['play', 'think', 'play'], emotes: [null, 'dots', null] }
};
for (const spec of Object.values(activities)) if (spec.roles) spec.action ??= spec.roles[0];
const propActions = { cup: 'drink', book: 'read', note: 'write', tools: 'fix', water: 'water' };
// What someone does when an errand takes them to one of the named spots.
const placeActions = {
  board: { action: 'write', prop: 'note', emote: 'idea' }, boardRight: { action: 'write', prop: 'note' },
  windowLeft: { action: 'look' }, windowRight: { action: 'look', emote: 'dots' },
  plantLeft: { action: 'water', prop: 'water' }, shelf: { action: 'read', prop: 'book' }, shelfLeft: { action: 'read', prop: 'book', emote: 'question' },
  rack: { action: 'fix', prop: 'tools' }, workbench: { action: 'fix', prop: 'tools' },
  loungeLeft: { action: 'drink', prop: 'cup', emote: 'coffee' }, loungeRight: { action: 'drink', prop: 'cup' }
};
const turn = { sw: 'se', se: 'sw', ne: 'nw', nw: 'ne' };
const msPerTile = 430;
const drinks = new Set(['tea', 'espresso', 'cocoa', 'boba', 'energy']);
const foods = new Set(['macaron', 'pizza', 'icecream', 'fruit', 'ramen']);

// The backdrop is drawing paper with a faint dot grid; the night floors get a dark paper.
const darkPaper = new Set(['neon', 'penthouse']);
function paintPaper(ctx, w, h, dpr, theme) {
  const dark = darkPaper.has(theme) || nightNow;
  ctx.fillStyle = dark ? '#1a1d2b' : '#f1eadb';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = dark ? '#2a2f45' : '#d9ceb6';
  const step = Math.round(16 * dpr), size = Math.max(1, Math.round(dpr));
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) ctx.fillRect(Math.round(x), Math.round(y), size, size);
}
let nightNow = false;

// Day and night follow the local clock unless someone picks one; seasons follow the month.
export function skyFor(mode = 'auto', date = new Date()) {
  const hour = date.getHours(), month = date.getMonth() + 1;
  const night = mode === 'night' || (mode === 'auto' && (hour >= 19 || hour < 6));
  const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  return { night, season };
}
// Things that glow at night: [colour, radius in px, height in px].
const glowing = {
  'floor-lamp': ['#ffd89a', 46, 30], arcade: ['#b48cff', 34, 18], claw: ['#ff9ac8', 30, 22], 'dance-pad': ['#8cf0ff', 30, 10],
  vr: ['#7af0f0', 30, 14], racing: ['#7fb8ff', 26, 16], aquarium: ['#7fd8ff', 30, 14], karaoke: ['#d08cff', 52, 20],
  'espresso-bar': ['#ffcf8a', 24, 18], record: ['#ffd89a', 22, 12], popcorn: ['#ffd27a', 24, 16], 'sleep-pod': ['#9ff0ff', 24, 10]
};
function nightLight(ctx, floor, agents, placed, tick) {
  const at = floor.proj.at;
  ctx.save();
  // Only darken what is drawn (source-atop), so the paper around the room stays as it is.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(24, 30, 72, 0.46)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const glow = ([sx, sy], color, radius, strength) => {
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    g.addColorStop(0, color + Math.round(strength * 255).toString(16).padStart(2, '0'));
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
  };
  for (const [id, [x, y, dir]] of Object.entries(floor.layout.desks)) {
    const busy = workingStates.has(agents.get(id)?.status);
    const flicker = busy && tick % 6 === 0 ? 0.08 : 0;
    glow(at(dir === 'y' ? x + 0.5 : x + 1, dir === 'y' ? y + 1 : y + 0.5, 22), '#8fc4ff', busy ? 42 : 30, (busy ? 0.55 : 0.34) - flicker);
  }
  for (const item of floor.plan.furniture) {
    const spec = glowing[item.id];
    if (spec) glow(at(item.x + item.size / 2, item.y + item.size / 2, spec[2]), spec[0], spec[1], 0.5);
  }
  for (const [slot, id] of Object.entries(placed)) if (id === 'neon' && slot.startsWith('w')) glow(at(1, 1, 40), '#ff8ad0', 60, 0.25);
  ctx.restore();
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function rug(p, r) {
  const [edge, fill] = r.colors;
  if (r.kind === 'round') {
    const cx = r.x + r.w / 2, cy = r.y + r.d / 2;
    for (const [k, color] of [[1, edge], [0.9, fill], [0.62, edge], [0.52, fill]]) {
      const pts = [];
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(p.at(cx + Math.cos(a) * r.w / 2 * k, cy + Math.sin(a) * r.d / 2 * k)); }
      p.poly(pts, color);
    }
    return;
  }
  p.flat(r.x, r.y, r.w, r.d, edge);
  p.flat(r.x + 0.12, r.y + 0.12, r.w - 0.24, r.d - 0.24, fill);
  if (r.kind === 'kilim') for (let i = 0.5; i < r.w - 0.3; i += 0.7) p.flat(r.x + i, r.y + 0.3, 0.25, r.d - 0.6, edge);
  else p.flat(r.x + 0.3, r.y + 0.3, r.w - 0.6, r.d - 0.6, shade(fill, 1.08));
}

function partitionSegment(p, wall, t, style, theme) {
  const thick = 0.14, h = theme.partition.h;
  const [x, y, w, d] = wall.axis === 'x' ? [wall.at - thick / 2, t, thick, 1] : [t, wall.at - thick / 2, 1, thick];
  if (style === 'glass') {
    const g = theme.glass || { top: '#c9c4b0', pane: '#bfe0ea40', frame: '#8a8f8c' };
    const H = h + 8;
    p.prism(x, y, 0, w, d, 4, tone(g.frame));
    p.prism(x, y, 4, w, d, H - 6, { top: g.pane, left: g.pane, right: g.pane });
    p.prism(x, y, H - 2, w, d, 2, tone(g.top));
    if (wall.axis === 'x') p.prism(x, y, 0, w, 0.06, H, tone(g.frame)); else p.prism(x, y, 0, 0.06, d, H, tone(g.frame));
    return;
  }
  if (style === 'hedge' || theme.partition.hedge) {
    p.prism(x - 0.03, y - 0.03, 0, w + 0.06, d + 0.06, 5, tone('#8a6a4a'));
    p.prism(x - 0.08, y - 0.08, 5, w + 0.16, d + 0.16, 10, tone('#4d7f58'));
    const [sx, sy] = p.at(x + w / 2, y + d / 2, 15);
    p.oval(sx - 3, sy, 4, 2, '#5f9160'); p.oval(sx + 4, sy - 1, 3, 2, '#78a565');
    return;
  }
  const c = theme.partition;
  p.prism(x, y, 0, w, d, h, { top: c.top, left: c.left, right: c.right });
}

function buildFloor(floorId, placed = {}) {
  const plan = planFloor(floorId, placed);
  const L = plan.layout, theme = themes[L.theme];
  const proj = createProjection({ w: L.w, h: L.h, wallH: L.wallH });
  const base = makeCanvas(proj.width, proj.height);
  const ctx = base.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const p = isoPainter(ctx, proj);
  rasterFloor(ctx, proj, plan.roomAt, materials);
  for (const r of L.rugs || []) rug(p, r);
  // Floor slab along the two open edges, like a cut-away doll's house.
  p.poly([p.at(0, L.h), p.at(L.w, L.h), p.at(L.w, L.h, -proj.slab), p.at(0, L.h, -proj.slab)], theme.slab[0]);
  p.poly([p.at(L.w, 0), p.at(L.w, L.h), p.at(L.w, L.h, -proj.slab), p.at(L.w, 0, -proj.slab)], theme.slab[1]);
  blitWall(ctx, proj, paintWall(L.theme, 'north', L.w, L.wallH, L.north, placed, floorId * 7), 'north');
  blitWall(ctx, proj, paintWall(L.theme, 'west', L.h, L.wallH, L.west, placed, floorId * 13), 'west');
  // Wall ends, showing their thickness.
  const [ex, ey] = p.at(L.w, 0, 0), [wx, wy] = p.at(0, L.h, 0);
  p.box(ex, ey - L.wallH, 3, L.wallH, shade(theme.slab[1], 1.1)); p.box(wx - 3, wy - L.wallH, 3, L.wallH, shade(theme.slab[0], 1.1));

  const objects = [];
  for (const wall of L.walls) {
    for (let t = wall.from; t < wall.to; t++) {
      if (wall.doors.includes(t)) continue;
      const key = wall.at + t + 0.5;
      objects.push({ key, draw: q => partitionSegment(q, wall, t, wall.style, theme) });
    }
  }
  for (const prop of plan.props) {
    if (stackedProps.has(prop.kind)) {
      objects.push({ key: prop.x + prop.w / 2 + prop.y + prop.d / 2, draw: q => drawFurnitureStack(q, prop.kind, prop.x + 0.5, prop.y + 0.5, Math.PI / 2 + (prop.x * 7 + prop.y * 3) % 4) });
      continue;
    }
    const drawer = propDrawers[prop.kind];
    if (drawer) objects.push({ key: prop.x + prop.w / 2 + prop.y + prop.d / 2, draw: (q, tick) => drawer(q, prop, theme, tick, L.wallH) });
  }
  for (const item of plan.furniture) {
    if (stackedFurniture.has(item.id)) {
      objects.push({ key: item.x + item.y + item.size, draw: q => drawFurnitureStack(q, item.id, item.x + 0.5, item.y + 0.5) });
      continue;
    }
    const facility = facilities[item.id], drawer = facility || furnitureIso[item.id];
    if (drawer) objects.push({ key: item.x + item.y + item.size, draw: (q, tick, live) => drawer(q, item.x, item.y, tick, Boolean(live?.active.has(item.slot))) });
  }
  return { plan, layout: L, theme, proj, base, objects, painter: p };
}

function facingOf(dx, dy, fallback) {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'se' : 'nw') : (dy > 0 ? 'sw' : 'ne');
}

function along(points, progress) {
  const segments = points.slice(1).map((to, i) => ({ from: points[i], to, length: Math.hypot(to[0] - points[i][0], to[1] - points[i][1]) })).filter(s => s.length);
  let remaining = segments.reduce((sum, s) => sum + s.length, 0) * progress;
  for (const { from, to, length } of segments) {
    if (remaining <= length) {
      const f = remaining / length;
      return { x: from[0] + (to[0] - from[0]) * f, y: from[1] + (to[1] - from[1]) * f, facing: facingOf(to[0] - from[0], to[1] - from[1]),
        heading: Math.atan2(to[1] - from[1], to[0] - from[0]) };
    }
    remaining -= length;
  }
  const last = points.at(-1), prev = points.at(-2) || last;
  return { x: last[0], y: last[1], facing: facingOf(last[0] - prev[0], last[1] - prev[1], 'sw') };
}

// People turn toward where they're going instead of snapping between four directions.
const TURN_RATE = Math.PI * 3; // radians per second
function easeHeading(headings, id, target, dt) {
  const current = headings.get(id);
  if (current == null || !dt) { headings.set(id, target); return target; }
  const diff = ((target - current) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const next = current + Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
  headings.set(id, next);
  return next;
}

function drawFrame(world, floor, { agents, poses, moods, selected, hovered, tick, effects, now, deskProp, looks = new Map(), active = new Set(),
  headings = new Map(), dt = 0, flat = false, night = false, placed = {} }) {
  const ctx = world.getContext('2d');
  ctx.clearRect(0, 0, world.width, world.height);
  ctx.drawImage(floor.base, 0, 0);
  const p = isoPainter(ctx, floor.proj);
  const list = [...floor.objects];
  const anchors = new Map();
  for (const [id, desk] of Object.entries(floor.layout.desks)) {
    const seat = floor.plan.seats[id], agent = agents.get(id);
    const busy = agent && workingStates.has(agent.status);
    const [x, y, dir] = desk;
    list.push({ key: dir === 'y' ? x + 0.5 + y + 1 : x + 1 + y + 0.5, draw: q => drawDesk(q, desk, floor.theme, { team: teamOf(id), lead: id === 'claude' || id === 'codex', busy, tick }) });
    list.push({ key: seat.point[0] + seat.point[1] - 0.02, draw: q => drawChair(q, seat, floor.theme, teamOf(id)) });
    if (!agent) continue;
    const pose = poses.get(id);
    const fx = pose ? pose.x : seat.point[0], fy = pose ? pose.y : seat.point[1];
    list.push({
      key: fx + fy + 0.001, draw: q => {
        const [sx, sy] = q.at(fx, fy);
        const look = looks.get(id) || {};
        const held = look.prop ?? pose?.prop ?? deskProp(id, agent);
        const facing = look.facing ?? (pose ? pose.facing : seat.facing);
        const action = look.action ?? (pose?.moving ? 'walk' : pose?.action ?? (!pose && held ? propActions[held] : null));
        const heading = easeHeading(headings, id, look.heading ?? (pose?.moving ? pose.heading : null) ?? headingOf[facing], dt);
        // The anime sprites face one of four ways: the nearest to the smoothly turning heading.
        const turned = ['se', 'sw', 'nw', 'ne'][((Math.round(heading / (Math.PI / 2)) % 4) + 4) % 4];
        // The sleep pod pose and the flat style keep the original 2D figure.
        const draw = flat || action === 'lie' ? drawCharacter : drawAnimeCharacter;
        const { top } = draw(q, variants[id], Math.round(sx), Math.round(sy), {
          facing: turned, seated: !pose, busy, tick,
          emoteBusy: Boolean(look.emote ?? (pose?.moving ? null : pose?.emote)),
          emotion: moods[id] || 'calm', lead: id === 'claude' || id === 'codex', team: teamOf(id), prop: held,
          action, z: look.z ?? pose?.z ?? 0, hop: look.hop || 0
        });
        anchors.set(id, { x: sx, y: sy, top, emote: look.emote ?? (pose?.moving ? null : pose?.emote) });
        if (selected === id || hovered === id) {
          const col = teamOf(id) === 'claude' ? '#f2aa81' : '#91b8ef';
          q.poly([[sx - 3, top - 6], [sx + 4, top - 6], [sx + 0.5, top - 2]], col);
          q.box(sx - 3, top - 7, 7, 1, '#fff6e0');
        }
      }
    });
  }
  list.sort((a, b) => a.key - b.key);
  for (const item of list) item.draw(p, tick, { active });
  if (night) nightLight(ctx, floor, agents, placed, tick);
  for (const anchor of anchors.values()) if (anchor.emote) drawEmote(p, anchor.emote, anchor.x, anchor.top, tick);
  for (const effect of effects) {
    const anchor = anchors.get(effect.id);
    if (!anchor) continue;
    const progress = Math.max(0, (now - effect.start) / effect.duration);
    const top = Math.round(anchor.top - 6 - Math.min(1, progress * 3) * 6);
    if (progress < 0.75) drawItem(p, effect.item, Math.round(anchor.x - 6), top - 10);
    if (progress > 0.2) drawBurst(p, effect.kind, anchor.x, anchor.top - 4, (progress - 0.2) / 0.8);
  }
  return anchors;
}

export function createOfficeScene(canvas, { onSelect = () => {}, onLife = () => {}, onView = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  canvas.tabIndex = 0;
  let floorId = 1, placed = {}, moods = {}, layoutKey = '';
  let floor = buildFloor(1, {});
  let world = makeCanvas(floor.proj.width, floor.proj.height);
  let agents = new Map(), roster = [], tasks = [], lifeEnabled = true, selected = null, hovered = null;
  let tick = 0, timer = null, raf = 0, visible = true, dead = false, frame = null, previousLife = '';
  const headings = new Map();
  let lastRender = 0;
  let daylight = 'auto', skyCheckedAt = 0;
  let poses = new Map(), anchors = new Map(), effects = [];
  const routes = new Map();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Reduced motion keeps the office still unless the person has switched 辦公室日常 on, which overrides it.
  const still = () => reduced.matches && !lifeEnabled;
  const ambient = createOfficeLife();
  const behaviors = createBehaviors();
  let acts = new Map();
  const camera = { x: floor.proj.width / 2, y: floor.proj.height / 2, zoom: 0, fit: 1, cssW: 1, cssH: 1, dpr: 1 };

  function rebuild() {
    const { night, season } = skyFor(daylight);
    setSky({ night, season }); setSeason(season); nightNow = night;
    const key = JSON.stringify([floorId, placed, night, season]);
    if (key === layoutKey) return;
    const changedFloor = !layoutKey || JSON.parse(layoutKey)[0] !== floorId;
    layoutKey = key;
    floor = buildFloor(floorId, placed);
    world = makeCanvas(floor.proj.width, floor.proj.height);
    routes.clear();
    if (changedFloor) { camera.zoom = 0; camera.x = floor.proj.width / 2; camera.y = floor.proj.height / 2; }
    resize();
  }

  /* ----- camera ----- */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    camera.cssW = Math.max(1, rect.width); camera.cssH = Math.max(1, rect.height);
    camera.dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(camera.cssW * camera.dpr), h = Math.round(camera.cssH * camera.dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    // Keep the zoom relative to "whole floor fits", so resizing the window keeps the same framing.
    const relative = camera.zoom && camera.fit ? camera.zoom / camera.fit : 1;
    camera.fit = Math.min(camera.cssW / floor.proj.width, camera.cssH / floor.proj.height);
    camera.zoom = camera.fit * relative;
    clamp();
    requestDraw();
  }
  const minZoom = () => camera.fit * 0.85, maxZoom = () => Math.max(5, camera.fit * 5);
  function clamp() {
    camera.zoom = Math.min(maxZoom(), Math.max(minZoom(), camera.zoom));
    const halfW = camera.cssW / 2 / camera.zoom, halfH = camera.cssH / 2 / camera.zoom;
    const W = floor.proj.width, H = floor.proj.height;
    camera.x = halfW * 2 >= W ? W / 2 : Math.min(W - halfW, Math.max(halfW, camera.x));
    camera.y = halfH * 2 >= H ? H / 2 : Math.min(H - halfH, Math.max(halfH, camera.y));
  }
  const toWorld = (cx, cy) => [camera.x + (cx - camera.cssW / 2) / camera.zoom, camera.y + (cy - camera.cssH / 2) / camera.zoom];
  const toCss = (wx, wy) => [(wx - camera.x) * camera.zoom + camera.cssW / 2, (wy - camera.y) * camera.zoom + camera.cssH / 2];
  function zoomAt(factor, cx = camera.cssW / 2, cy = camera.cssH / 2) {
    const [wx, wy] = toWorld(cx, cy);
    camera.zoom *= factor; clamp();
    const [nx, ny] = toWorld(cx, cy);
    camera.x += wx - nx; camera.y += wy - ny; clamp();
    viewChanged();
  }
  function pan(dx, dy) { camera.x -= dx / camera.zoom; camera.y -= dy / camera.zoom; clamp(); viewChanged(); }
  function resetView() { camera.zoom = camera.fit; camera.x = floor.proj.width / 2; camera.y = floor.proj.height / 2; clamp(); viewChanged(); }
  function viewChanged() { requestDraw(); onView(); }

  /* ----- people ----- */
  function placeTile(name, index) {
    const L = floor.layout;
    if (name?.startsWith('slot:')) { const spot = L.slots[name.slice(5)]; return spot ? spot.use : null; }
    return L.places[name] || L.places[['loungeLeft', 'loungeRight'][index % 2]];
  }
  function routeFor(id, place) {
    const key = id + '>' + place.join(',');
    if (!routes.has(key)) {
      const seat = floor.plan.seats[id];
      const path = floor.plan.grid.path(seat.tile, place.slice(0, 2)) || [seat.tile];
      routes.set(key, [seat.point, ...path.map(([x, y]) => [x + 0.5, y + 0.5])]);
    }
    return routes.get(key);
  }
  function poseFor(id, life, index) {
    if (still() || !floor.plan.seats[id]) return null;
    const place = placeTile(life.place, index);
    if (!place) return null;
    const route = routeFor(id, place);
    if (life.elapsed < life.walk) return { ...along(route, life.elapsed / life.walk), moving: true };
    const returnAt = life.endsAt - life.start - life.walk;
    if (life.elapsed >= returnAt) return { ...along(route.toReversed(), Math.min(1, (life.elapsed - returnAt) / life.walk)), moving: true };
    const end = route.at(-1);
    const slot = life.place?.startsWith('slot:') ? life.place.slice(5) : null;
    if (slot) {
      const spec = activities[placed[slot]] || { action: 'look' };
      if (spec.onto) {
        const [ax, ay] = floor.layout.slots[slot].at;
        return { x: ax + 0.5, y: ay + 0.55, facing: spec.facing || place[2] || 'sw', action: spec.action, z: spec.z, prop: spec.prop };
      }
      return { x: end[0], y: end[1], facing: place[2] || 'sw', action: spec.action, prop: spec.prop };
    }
    const talking = life.kind === 'social' || life.kind === 'recap';
    const action = talking ? (life.speech?.actor === id ? 'talk' : 'listen')
      : life.place === 'board' || life.place === 'boardRight' ? 'write' : propActions[life.prop] || 'look';
    return { x: end[0], y: end[1], facing: place[2] || 'sw', prop: talking ? null : life.prop, action };
  }
  /* ----- ambient errands ----- */
  function pathFor(id, tile) {
    const key = id + '>' + tile.join(',');
    if (!routes.has(key)) {
      const seat = floor.plan.seats[id];
      const path = seat && floor.plan.grid.path(seat.tile, tile);
      routes.set(key, path ? [seat.point, ...path.map(([x, y]) => [x + 0.5, y + 0.5])] : null);
    }
    return routes.get(key);
  }
  // A free tile beside a colleague's chair to stand on while chatting.
  function besideSeat(id) {
    const seat = floor.plan.seats[id];
    if (!seat) return null;
    const seatTiles = new Set(Object.values(floor.plan.seats).map(s => s.tile.join(',')));
    const [x, y] = seat.tile;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (floor.plan.grid.isBlocked(nx, ny) || seatTiles.has(nx + ',' + ny) || floor.plan.grid.walled(x, y, nx, ny)) continue;
      return [nx, ny];
    }
    return null;
  }
  function errandsFor(id, working) {
    const L = floor.layout, list = [];
    const visit = other => {
      const tile = besideSeat(other);
      if (!tile) return;
      const [px, py] = floor.plan.seats[other].point;
      list.push({ key: 'seat:' + other, tile, visit: other, action: 'talk', emote: 'chat', facing: facingOf(px - tile[0] - 0.5, py - tile[1] - 0.5, 'sw') });
    };
    if (working) {
      // A lead with delegated work walks over to check on the person doing it.
      if (agents.get(id)?.status !== 'delegated') return list;
      for (const task of tasks) {
        if (task.manager === id && task.workerId && task.workerId !== id && workingStates.has(task.status) && agents.has(task.workerId)) visit(task.workerId);
      }
      return list;
    }
    const lifePlace = frame?.place;
    for (const [name, [x, y, facing]] of Object.entries(L.places)) {
      if (name !== lifePlace) list.push({ key: name, tile: [x, y], facing, ...(placeActions[name] || { action: 'look' }) });
    }
    for (const [slot, item] of Object.entries(placed)) {
      const spot = L.slots[slot];
      if (!spot || !furnitureById[item] || 'slot:' + slot === lifePlace) continue;
      const spec = activities[item] || { action: 'look' };
      if (spec.roles) {
        const spots = spot.spots || [spot.use];
        const group = spec.roles.slice(0, spots.length).map((action, i) => ({
          key: `slot:${slot}#${i}`, tile: spots[i].slice(0, 2), facing: spots[i][2], slot, action, turns: spec.turns, emote: spec.emotes?.[i] ?? null,
          stage: spec.stage && i === 0
        }));
        // Popular: list games twice so people pick them more often than a plant.
        for (let copy = 0; copy < 2; copy++) list.push({ key: 'slot:' + slot, group, min: 2 });
        continue;
      }
      list.push({ key: 'slot:' + slot, tile: spot.use.slice(0, 2), facing: spot.use[2], slot, ...spec, emote: spec.action === 'look' ? 'heart' : spec.emote });
    }
    for (const other of agents.keys()) if (other !== id && floor.plan.seats[other]) visit(other);
    return list;
  }
  function measureErrand(id, dest) {
    const route = pathFor(id, dest.tile);
    if (!route || route.length < 2) return null;
    let length = 0;
    for (let i = 1; i < route.length; i++) length += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    return Math.max(900, length * msPerTile);
  }
  function errandPose(id, act, now) {
    const route = pathFor(id, act.dest.tile);
    if (!route) return null;
    const { phase, progress } = errandPhase(act, now);
    if (phase === 'out') return { ...along(route, progress), moving: true };
    if (phase === 'back') return { ...along(route.toReversed(), progress), moving: true };
    const end = route.at(-1), dest = act.dest;
    const playing = now >= (act.playAt ?? act.start + act.walk);
    let action = playing ? dest.action : null;
    // Pool: players take turns at the table.
    if (playing && dest.turns) action = Math.floor((now - act.playAt) / 3200) % 2 === dest.index % 2 ? dest.action : 'look';
    const base = { facing: dest.facing || 'sw', action, prop: playing ? dest.prop : null, emote: playing ? dest.emote : 'dots', arrived: now - act.start - act.walk };
    if (dest.onto && !playing) return { ...base, x: end[0], y: end[1] };
    if (dest.stage && playing && floor.layout.slots[dest.slot]) {
      // The singer steps up onto the middle of the stage and faces the room.
      const [ax, ay] = floor.layout.slots[dest.slot].at;
      return { ...base, x: ax + 1.1, y: ay + 1.2, z: 4, facing: 'sw' };
    }
    if (dest.onto && dest.slot && floor.layout.slots[dest.slot]) {
      const [ax, ay] = floor.layout.slots[dest.slot].at;
      return { ...base, x: ax + 0.5, y: ay + 0.55, z: dest.z };
    }
    return { ...base, x: end[0], y: end[1] };
  }
  // A fidget at the desk becomes an action, a facing and maybe an emote bubble.
  function fidgetLook(id, act, now) {
    const seat = floor.plan.seats[id];
    const elapsed = now - act.start;
    switch (act.action) {
      case 'look': return { facing: Math.floor(elapsed / 900 + act.seed * 4) % 3 === 1 ? turn[seat.facing] : seat.facing };
      case 'spin': return { heading: headingOf[seat.facing] + elapsed / 1000 * Math.PI * 2.4 };
      case 'sip': return { action: 'drink', prop: 'cup' };
      case 'read': return { action: 'read', prop: 'book' };
      default: return { action: act.action, emote: act.emote };
    }
  }

  // Short overrides: reacting to a gift, a fidget at the desk, chatting with a visitor or waving at a passer-by.
  function looksFor(now) {
    const looks = new Map();
    for (const effect of effects) {
      const progress = (now - effect.start) / effect.duration;
      if (progress < 0) continue;
      const eating = drinks.has(effect.item) ? 'drink' : foods.has(effect.item) ? 'eat' : null;
      const action = eating && progress < 0.55 ? eating : 'cheer';
      looks.set(effect.id, { action, hop: action === 'cheer' ? Math.round(Math.abs(Math.sin(progress * Math.PI * 5)) * 3) : 0,
        prop: action === 'drink' ? 'cup' : action === 'eat' ? 'snack' : null });
    }
    for (const [id, act] of acts) {
      if (looks.has(id) || poses.has(id) || act.kind !== 'fidget' || !floor.plan.seats[id]) continue;
      looks.set(id, fidgetLook(id, act, now));
    }
    for (const [id, pose] of poses) {
      const act = acts.get(id);
      const host = act?.kind === 'errand' && act.dest.visit;
      if (host && !pose.moving && !poses.has(host) && floor.plan.seats[host]) {
        // Take turns talking; a busy colleague keeps typing and just looks up with a question mark.
        const [hx, hy] = floor.plan.seats[host].point;
        const busy = workingStates.has(agents.get(host)?.status);
        const hostTalks = !busy && pose.arrived % 5600 > 2800;
        if (hostTalks) { pose.action = 'listen'; pose.emote = null; }
        looks.set(host, busy ? { emote: 'question' }
          : { facing: facingOf(pose.x - hx, pose.y - hy, 'sw'), action: hostTalks ? 'talk' : 'listen', emote: hostTalks ? 'chat' : null });
        continue;
      }
      if (!pose.moving) continue;
      for (const [other, seat] of Object.entries(floor.plan.seats)) {
        if (other === id || poses.has(other) || looks.get(other)?.emote || !agents.has(other) || workingStates.has(agents.get(other).status)) continue;
        const [sx, sy] = seat.point;
        if (Math.hypot(pose.x - sx, pose.y - sy) < 1.4) looks.set(other, { action: 'wave', facing: facingOf(pose.x - sx, pose.y - sy, seat.facing) });
      }
    }
    return looks;
  }
  const anchorCss = id => {
    const a = anchors.get(id);
    if (!a) return null;
    const [x, y] = toCss(a.x, a.y), [, top] = toCss(a.x, a.top);
    return { x: x / camera.cssW, y: y / camera.cssH, top: top / camera.cssH };
  };

  function render() {
    if (dead) return;
    const now = performance.now();
    const animateLife = lifeEnabled && visible && !document.hidden;
    const ids = [...agents.keys()].filter(id => floor.plan.seats[id]);
    acts = behaviors.step(now, {
      ids, working: new Set(ids.filter(id => workingStates.has(agents.get(id).status))),
      blocked: new Set(frame?.actors || []), enabled: animateLife,
      tired: new Set(ids.filter(id => moods[id] === 'tired' || moods[id] === 'sad')),
      happy: new Set(ids.filter(id => moods[id] === 'happy' || moods[id] === 'elated')),
      maxWalkers: Math.max(1, Math.min(3, Math.floor(ids.length / 2))), errands: errandsFor, measure: measureErrand
    });
    // People out on an errand sit out the scripted scenes until they are back at their desk.
    const lifeRoster = roster.map(agent => acts.get(agent.id)?.kind === 'errand' ? { ...agent, status: 'away' } : agent);
    frame = ambient.step(now, lifeRoster, tasks, animateLife);
    poses = new Map();
    for (const [index, id] of (frame?.actors || []).entries()) {
      const pose = poseFor(id, frame, index);
      if (pose) poses.set(id, pose);
    }
    for (const [id, act] of acts) {
      if (act.kind !== 'errand' || poses.has(id)) continue;
      const pose = errandPose(id, act, now);
      if (pose) poses.set(id, pose);
    }
    tick = Math.floor(now / 150);
    if (now - skyCheckedAt > 60000) { skyCheckedAt = now; rebuild(); }
    // Facilities animate only while someone is playing them.
    const active = new Set();
    for (const act of acts.values()) {
      if (act.kind === 'errand' && act.dest.slot && errandPhase(act, now).phase === 'stay' && now >= (act.playAt ?? 0)) active.add(act.dest.slot);
    }
    if (frame?.place?.startsWith('slot:') && frame.elapsed >= frame.walk && frame.elapsed < frame.endsAt - frame.start - frame.walk) active.add(frame.place.slice(5));
    effects = effects.filter(effect => now - effect.start < effect.duration);
    const liveTick = still() ? 0 : tick;
    anchors = drawFrame(world, floor, {
      agents, poses, moods, selected, hovered, tick: liveTick, effects, now, looks: looksFor(now), active,
      headings, dt: lastRender ? Math.min(0.25, (now - lastRender) / 1000) : 0,
      night: nightNow, placed,
      deskProp: (id, agent) => animateLife && agent.status === 'idle' && !frame?.actors.includes(id) && !acts.has(id) &&
        (now + variants[id] * 2090) % (5100 + variants[id] * 1140) < 1250 ? deskProps[variants[id]] : null
    });
    lastRender = now;
    const phase = frame && (frame.elapsed < frame.walk ? 'out' : frame.elapsed >= frame.endsAt - frame.start - frame.walk ? 'back' : 'activity');
    const lifeKey = frame ? [frame.id, phase, frame.speech?.key].join(':') : '';
    if (previousLife !== lifeKey) {
      previousLife = lifeKey;
      const speaker = frame?.speech;
      onLife(frame ? { actors: frame.actors, kind: frame.kind, action: frame.action, phase,
        speech: speaker ? { ...speaker, ...anchorCss(speaker.actor) } : null } : null);
    }
    blit();
  }
  function blit() {
    const d = camera.dpr, s = camera.zoom * d;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    paintPaper(ctx, canvas.width, canvas.height, d, floor.layout.theme);
    const dx = Math.round(canvas.width / 2 - camera.x * s), dy = Math.round(canvas.height / 2 - camera.y * s);
    ctx.drawImage(world, dx, dy, Math.round(world.width * s), Math.round(world.height * s));
    const tip = hovered && agents.get(hovered);
    if (tip && frame?.speech?.actor !== hovered) {
      const a = anchors.get(hovered);
      if (a) {
        const [x, y] = toCss(a.x, a.top);
        const text = String(tip.name || hovered).slice(0, 21);
        ctx.font = `bold ${Math.round(11 * d)}px ui-monospace, "Microsoft JhengHei", monospace`;
        const w = ctx.measureText(text).width + 12 * d, h = 18 * d;
        const left = Math.min(canvas.width - w - 2, Math.max(2, x * d - w / 2)), top = Math.max(2, y * d - h - 12 * d);
        ctx.fillStyle = '#2f3436'; ctx.fillRect(left, top, w, h);
        ctx.fillStyle = '#ffefd0'; ctx.fillRect(left + d, top + d, w - 2 * d, h - 2 * d);
        ctx.fillStyle = '#2f3436'; ctx.textBaseline = 'middle'; ctx.fillText(text, left + 6 * d, top + h / 2);
      }
    }
  }
  function requestDraw() {
    if (raf || dead) return;
    raf = requestAnimationFrame(() => { raf = 0; blit(); });
  }

  /* ----- input ----- */
  const pointers = new Map();
  let drag = null, pinch = null;
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function hit(cx, cy) {
    const [wx, wy] = toWorld(cx, cy);
    let best = null;
    for (const [id, a] of anchors) {
      if (Math.abs(wx - a.x) <= 8 && wy >= a.top - 2 && wy <= a.y + 3 && (!best || a.y > anchors.get(best).y)) best = id;
    }
    return best;
  }
  function down(e) {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) drag = { start: local(e), last: local(e), moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      drag = null;
    }
  }
  function move(e) {
    const point = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, point);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      pan(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      if (pinch.dist > 0) zoomAt(dist / pinch.dist, mid[0], mid[1]);
      pinch = { dist, mid };
      return;
    }
    if (drag && pointers.has(e.pointerId)) {
      if (!drag.moved && Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) > 4) { drag.moved = true; canvas.classList.add('dragging'); }
      if (drag.moved) pan(point[0] - drag.last[0], point[1] - drag.last[1]);
      drag.last = point;
      return;
    }
    const id = hit(...point);
    if (id !== hovered) { hovered = id; requestDraw(); }
    canvas.style.cursor = id ? 'pointer' : 'grab';
  }
  function up(e) {
    const point = local(e);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !drag.moved && pointers.size === 0) { const id = hit(...point); if (id) onSelect(id); }
    if (pointers.size === 0) { drag = null; canvas.classList.remove('dragging'); }
  }
  function leave() { if (!pointers.size && hovered) { hovered = null; requestDraw(); } }
  function wheel(e) {
    e.preventDefault();
    const [cx, cy] = local(e);
    zoomAt(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004), cx, cy);
  }
  function key(e) {
    const step = 60;
    const actions = { ArrowLeft: () => pan(step, 0), ArrowRight: () => pan(-step, 0), ArrowUp: () => pan(0, step), ArrowDown: () => pan(0, -step),
      '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(0.8), '0': resetView };
    if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
  }
  function dbl(e) { const [cx, cy] = local(e); if (!hit(cx, cy)) zoomAt(1.6, cx, cy); }

  // Zoom buttons over the map.
  const controls = document.createElement('div');
  controls.className = 'map-controls';
  for (const [label, text, fn] of [['放大', '+', () => zoomAt(1.3)], ['縮小', '−', () => zoomAt(1 / 1.3)], ['重設視角', '⟲', resetView]]) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = text; b.title = label; b.setAttribute('aria-label', label);
    b.addEventListener('click', fn);
    controls.append(b);
  }
  canvas.parentElement?.append(controls);

  function update(state = {}) {
    if (state.agents) { roster = Array.isArray(state.agents) ? state.agents : Object.values(state.agents || {}); agents = new Map(roster.map(a => [a.id, a])); }
    if (state.tasks) tasks = state.tasks;
    if (typeof state.lifeEnabled === 'boolean') lifeEnabled = state.lifeEnabled;
    if (state.daylight && state.daylight !== daylight) { daylight = state.daylight; rebuild(); }
    if ('selected' in state || 'selectedId' in state) selected = state.selected ?? state.selectedId ?? null;
    if (state.economy) {
      floorId = state.economy.floor || 1;
      placed = state.economy.placed || {};
      moods = Object.fromEntries(Object.entries(state.economy.agents || {}).map(([id, value]) => [id, value.emotion]));
      rebuild();
      const plan = floor.layout;
      ambient.setFurniture?.(Object.entries(placed).filter(([slot, id]) => furnitureById[id]?.use && plan.slots[slot])
        .map(([slot, id]) => ({ place: 'slot:' + slot, name: furnitureById[id].name, lines: furnitureById[id].use })));
    }
    render(); schedule();
  }
  function react(targets, itemId) {
    const item = itemById[itemId];
    const kind = item?.team ? 'party' : item && item.energy > item.mood ? 'energy' : 'mood';
    const start = performance.now();
    targets.forEach((id, i) => effects.push({ id, item: itemId, kind, start: start + i * 120, duration: 2600 }));
    render(); schedule();
    return targets[0] ? anchorCss(targets[0]) : null;
  }
  function schedule() {
    clearTimeout(timer);
    if (dead || !visible || document.hidden) return;
    if (still() && !effects.length) return;
    const busy = [...agents.values()].some(a => workingStates.has(a.status));
    const moving = !still() && [...poses.values()].some(pose => pose.moving);
    const lively = !still() && (acts.size || frame || busy);
    timer = setTimeout(() => { render(); schedule(); }, effects.length ? 60 : moving ? 80 : lively ? 150 : 500);
  }
  function refreshVisibility() { render(); schedule(); }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refreshVisibility(); }) : null;
  observer?.observe(canvas);
  const sizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { resize(); onView(); }) : null;
  sizeObserver?.observe(canvas);
  const events = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, pointerleave: leave, dblclick: dbl, keydown: key };
  for (const [name, fn] of Object.entries(events)) canvas.addEventListener(name, fn);
  canvas.addEventListener('wheel', wheel, { passive: false });
  document.addEventListener('visibilitychange', refreshVisibility); reduced.addEventListener('change', refreshVisibility);
  resize(); render(); schedule();
  return {
    update, setState: update, react, anchorOf: anchorCss, resetView,
    destroy() {
      dead = true; clearTimeout(timer); cancelAnimationFrame(raf); observer?.disconnect(); sizeObserver?.disconnect(); controls.remove();
      for (const [name, fn] of Object.entries(events)) canvas.removeEventListener(name, fn);
      canvas.removeEventListener('wheel', wheel);
      document.removeEventListener('visibilitychange', refreshVisibility); reduced.removeEventListener('change', refreshVisibility);
    }
  };
}

// The whole floor at 1:1 for the shop, with everyone at their desks.
export function paintFloorPreview(canvas, floorId, placed = {}) {
  const floor = buildFloor(floorId, placed);
  canvas.width = floor.proj.width; canvas.height = floor.proj.height;
  const agents = new Map(Object.keys(variants).map(id => [id, { id, status: 'idle' }]));
  drawFrame(canvas, floor, { agents, poses: new Map(), moods: {}, selected: null, hovered: null, tick: 1, effects: [], now: 0, deskProp: () => null });
}
