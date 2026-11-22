import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOfficeLife, personalities, summarizeBrief } from '../office/life.js';
import { officeStaff } from '../src/office-runtime.mjs';

const staff = officeStaff.map(person => ({ ...person, status: 'idle' }));
const task = {
  id: 'test-task', threadId: 'original-thread', manager: 'codex', workerId: 'codex-test', status: 'done',
  createdAt: '2026-11-22T03:00:00.000Z', updatedAt: '2026-11-22T03:00:24.000Z', brief:'報數'
};

test('each character has distinct routines and the schedule includes social scenes', () => {
  const life = createOfficeLife(() => 0);
  const habits = new Map();
  let conversation;
  for (let now = 0; now <= 180000; now += 500) {
    const frame = life.step(now, staff, []);
    if (frame?.kind === 'solo' && frame.speech) habits.set(frame.actors[0], frame.action);
    if (frame?.kind === 'social' && frame.speech) conversation = frame;
  }
  assert.deepEqual([...habits.keys()].sort(), Object.keys(personalities).sort());
  assert.ok(new Set(habits.values()).size >= 5);
  assert.equal(new Set(conversation.actors).size, 2);
});

test('recaps reference finished threads and do not repeat or include outstanding work', () => {
  const scheduled = { ...task, id: 'followup', status: 'queued', updatedAt: '2026-11-22T03:01:00.000Z' };
  const life = createOfficeLife(() => 0);
  const recaps = new Map();
  for (let now = 0; now <= 170000; now += 500) {
    const tasks = now < 65000 ? [task, scheduled] : [task];
    const frame = life.step(now, staff, tasks);
    if (frame?.kind === 'recap') {
      assert.ok(now >= 65000);
      recaps.set(frame.id, frame);
    }
  }
  assert.equal(recaps.size, 1);
  const recap = [...recaps.values()][0];
  assert.equal(recap.threadId, task.threadId);
  assert.match(recap.lines[0], /「報數」已完成.*24 秒/);
  assert.equal(summarizeBrief('執行：整理辦公室'), '整理辦公室');
  assert.equal(summarizeBrief('會議密碼 AABB'), '');
});

test('a new task interrupts an idle scene and disabling life clears it', () => {
  const life = createOfficeLife(() => 0);
  life.step(0,staff,[]);
  assert.deepEqual(life.step(1800,staff,[]).actors,['claude']);
  assert.equal(life.step(2000,staff,[{...task,manager:'claude',status:'queued'}]),null);
  assert.equal(life.step(30000,staff,[],false),null);
  assert.equal(life.step(31000,staff,[],true),null);
  assert.ok(life.step(33000,staff,[],true));
});
