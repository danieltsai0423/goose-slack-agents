import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layouts } from '../office/iso-layouts.js';
import { destinations, planFloor } from '../office/iso-world.js';
import { floors, furniture, slotsFor } from '../office/economy.js';
import { personalities } from '../office/life.js';


for (const id of Object.keys(layouts).map(Number)) {
  test(`floor ${id}: furniture fits and every routine spot is reachable from every desk`, () => {
    const everySlot = Object.fromEntries(slotsFor(id).filter(slot => slot.kind === 'floor').map(slot => [slot.id, slot.size === 2 ? 'pingpong' : 'bonsai']));
    const plan = planFloor(id, everySlot);
    assert.deepEqual(plan.issues, []);
    const { layout } = plan;
    for (const name of new Set(Object.values(personalities).flatMap(person => person.habits.map(habit => habit.place)))) {
      assert.ok(layout.places[name], `floor ${id} is missing the place ${name}`);
    }
    // The plan has exactly the spots its capacity promises, at the right size.
    const wallSlots = [...layout.north, ...layout.west].filter(entry => entry.kind === 'slot').map(entry => entry.id);
    assert.deepEqual([...Object.keys(layout.slots), ...wallSlots].sort(), slotsFor(id).map(slot => slot.id).sort());
    for (const slot of slotsFor(id).filter(slot => slot.kind === 'floor')) {
      const spot = layout.slots[slot.id];
      assert.equal(spot.size || 1, slot.size, `floor ${id} slot ${slot.id} has the wrong size`);
      if (slot.size === 2) assert.ok(spot.spots?.length >= 3, `floor ${id} slot ${slot.id} needs a spot for each player`);
    }
    for (const target of destinations(plan)) {
      assert.ok(!plan.grid.isBlocked(...target.tile), `floor ${id}: ${target.name} stands on a blocked tile ${target.tile}`);
      for (const [person, seat] of Object.entries(plan.seats)) {
        assert.ok(plan.grid.path(seat.tile, target.tile), `floor ${id}: ${person} cannot reach ${target.name}`);
      }
    }
  });
}

test('floors grow bigger and roomier going up, and every facility fits somewhere', () => {
  const area = id => layouts[id].w * layouts[id].h;
  for (let i = 1; i < floors.length; i++) {
    const [lower, upper] = [floors[i - 1], floors[i]];
    assert.ok(upper.price > lower.price && upper.income > lower.income);
    assert.ok(area(upper.id) >= area(lower.id));
    assert.ok(slotsFor(upper.id).length >= slotsFor(lower.id).length);
  }
  assert.equal(slotsFor(1).some(slot => slot.size === 2), false, 'the starting studio is too small for 2×2 facilities');
  for (const entry of furniture) {
    if (entry.size === 2) assert.ok(slotsFor(entry.floor).some(slot => slot.size === 2), `${entry.id} unlocks on a floor without a large spot`);
  }
});
