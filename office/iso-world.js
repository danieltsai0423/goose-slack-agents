// Turns a floor plan into a walkable grid plus the lists the renderer needs. Pure, so tests can check every plan.
import { deskTiles, footprintOf, layouts, seatOf } from './iso-layouts.js';
import { createGrid } from './iso.js';

export function planFloor(id, placed = {}) {
  const layout = layouts[id] || layouts[1];
  const grid = createGrid(layout.w, layout.h);
  const issues = [];
  const taken = new Map();
  function occupy(x, y, what) {
    const key = x + ',' + y;
    if (x < 0 || y < 0 || x >= layout.w || y >= layout.h) issues.push(`${what} is outside the floor at ${key}`);
    else if (taken.has(key)) issues.push(`${what} overlaps ${taken.get(key)} at ${key}`);
    taken.set(key, what);
    grid.block(x, y);
  }
  for (const wall of layout.walls) {
    for (let t = wall.from; t < wall.to; t++) {
      if (wall.doors.includes(t)) continue;
      if (wall.axis === 'x') grid.wall(wall.at - 1, t, wall.at, t); else grid.wall(t, wall.at - 1, t, wall.at);
    }
  }
  const seats = {};
  for (const [id, desk] of Object.entries(layout.desks)) {
    for (const [x, y] of deskTiles(desk)) occupy(x, y, 'desk ' + id);
    seats[id] = seatOf(desk);
  }
  const props = layout.props.map(([kind, x, y, opts = {}]) => {
    const [w, d] = footprintOf(kind, opts);
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) occupy(x + dx, y + dy, kind);
    return { kind, x, y, w, d, ...opts };
  });
  const furniture = [];
  for (const [slot, spot] of Object.entries(layout.slots)) {
    if (!placed[slot]) continue;
    const size = spot.size || 1;
    for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) occupy(spot.at[0] + dx, spot.at[1] + dy, 'slot ' + slot);
    furniture.push({ slot, id: placed[slot], x: spot.at[0], y: spot.at[1], size });
  }
  const roomAt = (x, y) => layout.rooms.find(room => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h) || null;
  return { id: layouts[id] ? id : 1, layout, grid, seats, props, furniture, roomAt, issues };
}

// Every spot a character may need to reach, for validation and for the scene's route cache.
export function destinations(plan) {
  const { layout } = plan;
  return [
    ...Object.entries(layout.places).map(([name, [x, y]]) => ({ name, tile: [x, y] })),
    ...Object.entries(layout.slots).flatMap(([slot, spot]) => (spot.spots || [spot.use]).map((use, i) => ({ name: `slot:${slot}#${i}`, tile: use.slice(0, 2) }))),
    ...Object.entries(plan.seats).map(([id, seat]) => ({ name: 'seat:' + id, tile: seat.tile }))
  ];
}
