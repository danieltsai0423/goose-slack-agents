import { createOfficeLife } from './life.js';
import { furnitureById, itemById } from './economy.js';
import { drawBurst, drawItem } from './furniture.js';
import { blitWall, createProjection, isoPainter, rasterFloor } from './iso.js';
import { planFloor } from './iso-world.js';
import { materials, paintWall, themes } from './iso-themes.js';
import { drawCharacter, drawChair, drawDesk, furnitureIso, props as propDrawers, shade, tone } from './iso-props.js';

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
  aquarium: { action: 'look' }, fountain: { action: 'look' }, trophy: { action: 'look' }, sculpture: { action: 'look' }
};
const propActions = { cup: 'drink', book: 'read', note: 'write', tools: 'fix', water: 'water' };
const drinks = new Set(['tea', 'espresso', 'cocoa', 'boba', 'energy']);
const foods = new Set(['macaron', 'pizza', 'icecream', 'fruit', 'ramen']);

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
    const drawer = propDrawers[prop.kind];
    if (drawer) objects.push({ key: prop.x + prop.w / 2 + prop.y + prop.d / 2, draw: (q, tick) => drawer(q, prop, theme, tick, L.wallH) });
  }
  for (const item of plan.furniture) {
    const drawer = furnitureIso[item.id];
    if (drawer) objects.push({ key: item.x + item.y + 1, draw: (q, tick) => drawer(q, item.x, item.y, tick) });
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
      return { x: from[0] + (to[0] - from[0]) * f, y: from[1] + (to[1] - from[1]) * f, facing: facingOf(to[0] - from[0], to[1] - from[1]) };
    }
    remaining -= length;
  }
  const last = points.at(-1), prev = points.at(-2) || last;
  return { x: last[0], y: last[1], facing: facingOf(last[0] - prev[0], last[1] - prev[1], 'sw') };
}

function drawFrame(world, floor, { agents, poses, moods, selected, hovered, tick, effects, now, deskProp, looks = new Map() }) {
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
        const { top } = drawCharacter(q, variants[id], Math.round(sx), Math.round(sy), {
          facing: pose ? pose.facing : seat.facing, seated: !pose, busy, tick,
          emotion: moods[id] || 'calm', lead: id === 'claude' || id === 'codex', team: teamOf(id), prop: held,
          action: look.action ?? (pose?.moving ? 'walk' : pose?.action ?? (!pose && held ? propActions[held] : null)),
          z: look.z ?? pose?.z ?? 0, hop: look.hop || 0
        });
        anchors.set(id, { x: sx, y: sy, top });
        if (selected === id || hovered === id) {
          const col = teamOf(id) === 'claude' ? '#f2aa81' : '#91b8ef';
          q.poly([[sx - 3, top - 6], [sx + 4, top - 6], [sx + 0.5, top - 2]], col);
          q.box(sx - 3, top - 7, 7, 1, '#fff6e0');
        }
      }
    });
  }
  list.sort((a, b) => a.key - b.key);
  for (const item of list) item.draw(p, tick);
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
  let poses = new Map(), anchors = new Map(), effects = [];
  const routes = new Map();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ambient = createOfficeLife();
  const camera = { x: floor.proj.width / 2, y: floor.proj.height / 2, zoom: 0, fit: 1, cssW: 1, cssH: 1, dpr: 1 };

  function rebuild() {
    const key = JSON.stringify([floorId, placed]);
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
    if (reduced.matches || !floor.plan.seats[id]) return null;
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
  // Short overrides: reacting to a gift, or stretching at the desk now and then.
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
    for (const [id, agent] of agents) {
      if (looks.has(id) || poses.has(id) || agent.status !== 'idle' || reduced.matches) continue;
      if ((now / 1000 + variants[id] * 11) % 47 < 1.6) looks.set(id, { action: 'stretch' });
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
    frame = ambient.step(now, roster, tasks, animateLife);
    poses = new Map();
    for (const [index, id] of (frame?.actors || []).entries()) {
      const pose = poseFor(id, frame, index);
      if (pose) poses.set(id, pose);
    }
    effects = effects.filter(effect => now - effect.start < effect.duration);
    const liveTick = reduced.matches ? 0 : tick;
    anchors = drawFrame(world, floor, {
      agents, poses, moods, selected, hovered, tick: liveTick, effects, now, looks: looksFor(now),
      deskProp: (id, agent) => animateLife && !reduced.matches && agent.status === 'idle' && !frame?.actors.includes(id) &&
        (now + variants[id] * 2090) % (5100 + variants[id] * 1140) < 1250 ? deskProps[variants[id]] : null
    });
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
    ctx.fillStyle = floor.theme.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    if (!lifeEnabled && reduced.matches && !effects.length) return;
    const busy = [...agents.values()].some(a => workingStates.has(a.status));
    const moving = !reduced.matches && [...poses.values()].some(pose => pose.moving);
    timer = setTimeout(() => { if (!reduced.matches) tick++; render(); schedule(); }, effects.length ? 60 : moving ? 95 : frame ? 180 : busy ? 350 : 500);
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
