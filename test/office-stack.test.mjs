import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIRECTIONS, createModel, headingOf, quantize } from '../office/stack.js';
import { models } from '../office/voxel-furniture.js';
import { furniture } from '../office/economy.js';

test('voxel models place voxels relative to the ground point and drop anything outside the grid', () => {
  const m = createModel(8, 6, 10);
  m.box(-1, -1, 0, 0, 0, 2, '#ff0000').set(100, 0, 0, '#00ff00');
  assert.equal(m.get(m.ox, m.oy, 0), '#ff0000');
  assert.equal(m.get(m.ox - 1, m.oy - 1, 2), '#ff0000');
  assert.equal(m.cells.filter(Boolean).length, 2 * 2 * 3);
  m.cyl(0, 0, 1, 5, 5, '#0000ff');
  assert.equal(m.get(m.ox, m.oy, 5), '#0000ff');
});

test('headings snap to the baked directions and the four facings are a quarter turn apart', () => {
  assert.equal(quantize(0), 0);
  assert.equal(quantize(Math.PI * 2), 0);
  assert.equal(quantize(-Math.PI / 2), DIRECTIONS * 3 / 4);
  assert.equal(quantize(headingOf.sw) - quantize(headingOf.se), DIRECTIONS / 4);
  assert.equal(quantize(headingOf.nw), DIRECTIONS / 2);
});

test('every 3D furniture model builds, has voxels and matches a catalog entry or office prop', () => {
  const ids = new Set([...furniture.map(entry => entry.id), 'plant']);
  for (const [id, build] of Object.entries(models)) {
    assert.ok(ids.has(id), `${id} is not in the catalog`);
    const m = build();
    assert.ok(m.cells.some(Boolean), `${id} is empty`);
    assert.ok(m.get(m.ox, m.oy, 0) || m.cells.slice(0, m.w * m.d).some(Boolean), `${id} doesn't touch the ground`);
  }
});

test('day and night follow the clock unless pinned, and seasons follow the month', async () => {
  const { skyFor } = await import('../office/scene.js');
  const at = (month, hour) => new Date(2026, month - 1, 15, hour);
  assert.deepEqual(skyFor('auto', at(11, 21)), { night: true, season: 'autumn' });
  assert.deepEqual(skyFor('auto', at(7, 12)), { night: false, season: 'summer' });
  assert.equal(skyFor('auto', at(1, 5)).night, true);
  assert.equal(skyFor('auto', at(1, 6)).night, false);
  assert.equal(skyFor('day', at(1, 23)).night, false);
  assert.equal(skyFor('night', at(4, 12)).night, true);
  assert.equal(skyFor('auto', at(4, 12)).season, 'spring');
  assert.equal(skyFor('auto', at(12, 12)).season, 'winter');
});
