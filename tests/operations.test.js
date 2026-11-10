const assert = require('node:assert/strict');
const { test } = require('node:test');
const ops = require('../operations.js');

const roster = [
  { name: 'Nathan H.', role: 'Sales Associate' },
  { name: 'Blaire M.', role: 'Key Holder' },
  { name: 'Margarette L.', role: 'Assistant Store Manager' }
];

test('the published dates drive each week rather than hardcoded sample dates', () => {
  assert.deepEqual(ops.scheduleWeekStarts([], '2026-11-10'), ['2026-11-07', '2026-11-14']);
  assert.deepEqual(ops.scheduleWeekStarts([{ week: 1, start: '2026-12-05' }], '2026-11-10'),
    ['2026-11-28', '2026-12-05']);
  assert.deepEqual(ops.scheduleWeekStarts([{ week: 0, start: '2026-12-05' }, { week: 1, start: '2026-12-19' }], '2026-11-10'),
    ['2026-12-05', '2026-12-19']);
});

test('CSV and dated PDF rows use roster roles and validate dates and times', () => {
  const text = 'Date,Name,Start,End\n2026-11-07,Nate,9:00 AM,5:00 PM\n11/14/2026 Blaire 9:00 PM - 12:00 AM\n2026-11-15,Marge,10:00,18:30';
  const { rows, problems } = ops.readShiftRows(text, roster);
  assert.deepEqual(problems, []);
  assert.deepEqual(rows.map(({ name, position, start, end }) => [name, position, start, end]), [
    ['Nathan H.', 'Sales Associate', '09:00', '17:00'],
    ['Blaire M.', 'Key Holder', '21:00', '00:00'],
    ['Margarette L.', 'Assistant Store Manager', '10:00', '18:30']
  ]);
  assert.equal(ops.readShiftRows('2026-02-31,Nathan,09:00,17:00\n2026-11-07,Jeff,09:00,17:00\n2026-11-07,Nathan,09:60,17:00', roster).problems.length, 3);
});

test('recovery changes at the agreed local shift boundaries', () => {
  const at = (hour, minute) => ops.recoveryAt(new Date(2026, 10, 10, hour, minute))[0];
  assert.match(at(16, 59), /Before/);
  assert.match(at(17, 0), /Zone C/);
  assert.match(at(18, 30), /Zone B/);
  assert.match(at(20, 30), /Zone A/);
  assert.match(at(21, 15), /close/);
});

test('a paused timer does not count break time and resumes from its recorded elapsed time', () => {
  const start = '2026-11-10T00:00:00.000Z';
  const now = Date.parse(start) + 61000;
  assert.equal(ops.timerElapsed({ startedAt: start }, now), 61000);
  assert.equal(ops.timerElapsed({ startedAt: null, elapsedMs: 61000 }, now + 600000), 61000);
  assert.equal(ops.timerElapsed({ startedAt: new Date(now).toISOString(), elapsedMs: 61000 }, now + 15000), 76000);
});
