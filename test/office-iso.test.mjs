import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layouts } from '../office/iso-layouts.js';
import { destinations, planFloor } from '../office/iso-world.js';
import { slots } from '../office/economy.js';
import { personalities } from '../office/life.js';

const everySlot = Object.fromEntries(slots.filter(slot => slot.kind === 'floor').map(slot => [slot.id, 'bonsai']));

for (const id of Object.keys(layouts).map(Number)) {
  test(`floor ${id}: furniture fits and every routine spot is reachable from every desk`, () => {
    const plan = planFloor(id, everySlot);
    assert.deepEqual(plan.issues, []);
    const { layout } = plan;
    for (const name of new Set(Object.values(personalities).flatMap(person => person.habits.map(habit => habit.place)))) {
      assert.ok(layout.places[name], `floor ${id} is missing the place ${name}`);
    }
    for (const slot of slots) {
      if (slot.kind === 'floor') assert.ok(layout.slots[slot.id], `floor ${id} is missing slot ${slot.id}`);
      else assert.ok([...layout.north, ...layout.west].some(entry => entry.kind === 'slot' && entry.id === slot.id), `floor ${id} has no wall for ${slot.id}`);
    }
    for (const target of destinations(plan)) {
      assert.ok(!plan.grid.isBlocked(...target.tile), `floor ${id}: ${target.name} stands on a blocked tile ${target.tile}`);
      for (const [person, seat] of Object.entries(plan.seats)) {
        assert.ok(plan.grid.path(seat.tile, target.tile), `floor ${id}: ${person} cannot reach ${target.name}`);
      }
    }
  });
}
