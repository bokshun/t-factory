/* Regression tests: recovery must respect shift hours, breaks and register coverage. */
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../recovery-core.js');
const S = R.S;

const team = [
  { name: 'Chris C.', role: 'Store Manager' }, { name: 'Margarette L.', role: 'Assistant Store Manager' },
  { name: 'Carlton R.', role: 'Sales Associate' }, { name: 'Nathan H.', role: 'Sales Associate' }
];
const sh = (date, name, start, end) => ({ date, name, start, end });
const SAT = '2026-11-14', SUN = '2026-11-15';
const schedule = [
  sh(SAT, 'Chris C.', '07:00', '16:00'), sh(SAT, 'Carlton R.', '12:00', '21:00'), sh(SAT, 'Nathan H.', '13:00', '22:00'),
  sh(SUN, 'Margarette L.', '12:00', '22:00'), sh(SUN, 'Nathan H.', '15:00', '22:00')
];
// Carlton: break 19:00–19:30, register coverage 20:00–21:00 (shift ends 21:00). Free: 17:00–19:00 and 19:30–20:00.
const dailyPlan = { id: SAT, blocks: [{ name: 'Carlton R.', start: '19:00', end: '19:30', reason: 'Break' }, { name: 'Carlton R.', start: '20:00', end: '21:00', reason: 'Register coverage' }], entries: [] };
const ctx = (extra = {}) => ({ schedule, team, dailyPlan, now: '2026-11-14T12:00:00.000Z', ...extra });
const L = (h, m = 0, day = 14) => new Date(2026, 10, day, h, m).toISOString(); // local clock time
const mgr = { actor: 'Chris C.', actorIsManager: true };
let n = 0;
const op = () => 'tm' + ++n;
const timing = (c = ctx(), date = SAT) => { const staff = R.eligibleStaff(date, c); return { staff, windows: R.windowsMap(date, staff) }; };
const posted = (c = ctx()) => ({ ...R.newPlan(SAT, c), postedAt: L(16), status: 'posted' });
const rec = (plan, ev, req, at, o = timing()) => R.record(plan, ev, { opId: op(), ...req }, at, o);
const ok = (plan, ev, req, at, o) => { const r = rec(plan, ev, req, at, o); assert.ok(r.ok, JSON.stringify(r.errors)); return r.events; };

test('free windows exclude breaks, register coverage and hours outside the shift', () => {
  const c = R.eligibleStaff(SAT, ctx()).find((s) => s.name === 'Carlton R.');
  assert.deepEqual(c.free.map((w) => [w.start, w.end]), [[17 * 60, 19 * 60], [19 * 60 + 30, 20 * 60]]);
  assert.deepEqual(c.busy.map((b) => b.reason), ['Break', 'Register coverage']);
  const n2 = R.eligibleStaff(SAT, ctx()).find((s) => s.name === 'Nathan H.');
  assert.deepEqual(n2.free.map((w) => [w.start, w.end]), [[17 * 60, 22 * 60]]);
  assert.ok(!R.eligibleStaff(SAT, ctx()).some((s) => s.name === 'Chris C.'), 'shift ended at 16:00');
});

test('availability now: before, free (with next reserved block), break, coverage, after shift, wrong day, unscheduled', () => {
  const staff = R.eligibleStaff(SAT, ctx());
  const c = staff.find((s) => s.name === 'Carlton R.');
  const at = (h, m) => R.availabilityNow(SAT, c, L(h, m));
  assert.equal(at(16, 30).state, 'before');
  const free = at(17, 0);
  assert.equal(free.state, 'free'); assert.equal(free.until, '19:00'); assert.equal(free.nextBusy.reason, 'Break'); assert.equal(free.shiftEnd, '21:00');
  const brk = at(19, 10);
  assert.equal(brk.state, 'reserved'); assert.equal(brk.reason, 'Break'); assert.equal(brk.until, '19:30');
  assert.equal(at(19, 45).state, 'free');
  const cov = at(20, 30);
  assert.equal(cov.state, 'reserved'); assert.equal(cov.reason, 'Register coverage');
  assert.equal(at(21, 30).state, 'after');
  assert.equal(R.availabilityNow(SAT, c, L(17, 30, 15)).state, 'wrongday');
  assert.equal(R.availabilityNow(SAT, undefined, L(17, 30)).state, 'unscheduled');
});

test('Start, Resume and Change are refused during a break, during coverage, before the shift window and after the shift', () => {
  const plan = posted();
  assert.equal(R.routeOf(plan, 'Carlton R.').start, '17:00');
  const start = (when) => rec(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(...when));
  assert.equal(start([16, 45]).ok, false);
  assert.match(start([19, 10]).errors.join(' '), /reserved for Break until 19:30/);
  assert.match(start([20, 15]).errors.join(' '), /reserved for Register coverage/);
  assert.match(start([21, 5]).errors.join(' '), /shift has ended/);
  assert.equal(start([17, 0]).ok, true);
  assert.equal(start([19, 45]).ok, true);
  // working at 18:50, then try to resume or change while on break
  let ev = ok(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(18, 50));
  ev = ok(plan, ev, { action: 'pause', actor: 'Carlton R.' }, L(19, 0));
  const resume = rec(plan, ev, { action: 'resume', actor: 'Carlton R.' }, L(19, 10));
  assert.equal(resume.ok, false); assert.match(resume.errors.join(' '), /Break/);
  assert.equal(rec(plan, ev, { action: 'resume', actor: 'Carlton R.' }, L(19, 30)).ok, true);
  let ev2 = ok(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(19, 40));
  const change = rec(plan, ev2, { action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'partial', note: 'half left' }, L(20, 5));
  assert.equal(change.ok, false); assert.match(change.errors.join(' '), /Register coverage/);
  assert.equal(R.statusOf(R.progress(plan, ev2, L(20, 5), timing()), 'pet-aisle'), S.NOT_STARTED, 'nothing started during coverage');
});

test('a break or the end of the shift can always be recorded: Pause and Finish are never blocked', () => {
  const plan = posted();
  let ev = ok(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(18, 55));
  assert.equal(rec(plan, ev, { action: 'pause', actor: 'Carlton R.' }, L(19, 15)).ok, true, 'pause during the break itself');
  assert.equal(rec(plan, ev, { action: 'finish', actor: 'Carlton R.', confirm: true }, L(21, 20)).ok, true, 'finish after the shift ended');
  assert.equal(rec(plan, ev, { action: 'flag', actor: 'Carlton R.', note: 'Spill' }, L(20, 10)).ok, true);
});

test('shift start later than 5 p.m. is respected', () => {
  const late = { ...ctx(), schedule: [...schedule, sh(SAT, 'Margarette L.', '19:00', '22:00')], dailyPlan: null };
  const staff = R.eligibleStaff(SAT, late);
  assert.equal(staff.find((s) => s.name === 'Margarette L.').from, '19:00');
  let plan = R.assignZone(posted(late), 'pet-aisle', 'Margarette L.', late, 'Chris C.').plan;
  assert.equal(R.routeOf(plan, 'Margarette L.').start, '19:00');
  const o = timing(late);
  assert.match(rec(plan, [], { action: 'start', actor: 'Margarette L.', toKey: 'pet-aisle' }, L(18, 30), o).errors.join(' '), /starts at 19:00/);
  assert.equal(rec(plan, [], { action: 'start', actor: 'Margarette L.', toKey: 'pet-aisle' }, L(19, 0), o).ok, true);
});

test('recorded time counts only inside free windows; reserved and off-shift minutes are excluded but stay visible', () => {
  const plan = posted();
  // forgot to pause: worked 18:50 → 19:40 straight through the 19:00–19:30 break
  let ev = ok(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(18, 50));
  ev = ok(plan, ev, { action: 'finish', actor: 'Carlton R.', confirm: true }, L(19, 40));
  const prog = R.progress(plan, ev, L(19, 45), timing());
  const z = prog.zones.get('back-wall-water');
  assert.equal(z.elapsedMs, 20 * 60000, '10 min before the break + 10 min after');
  assert.equal(z.outsideMs, 30 * 60000);
  assert.equal(prog.stats['Carlton R.'].elapsedMs, 20 * 60000);
  assert.equal(prog.stats['Carlton R.'].outsideMs, 30 * 60000);
  assert.ok(R.timingIssues(plan, ev, L(19, 45), timing()).some((i) => i.type === 'excluded' && /30 min/.test(i.text)));
  // without timing data nothing is clipped (explicit events only)
  assert.equal(R.progress(plan, ev, L(19, 45)).zones.get('back-wall-water').elapsedMs, 50 * 60000);
});

test('work still running into coverage or past the end of the shift is flagged and not counted', () => {
  const plan = posted();
  const ev = ok(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(19, 45));
  // now = 20:20, Carlton is on register coverage but his section is still running
  const issues = R.timingIssues(plan, ev, L(20, 20), timing());
  assert.ok(issues.some((i) => i.type === 'running-reserved' && /Register coverage/.test(i.text)));
  assert.equal(R.progress(plan, ev, L(20, 20), timing()).zones.get('back-wall-water').elapsedMs, 15 * 60000, '19:45–20:00 only');
  // Nathan forgot to stop after 22:00
  const p2 = R.assignZone(posted(), 'pet-aisle', 'Nathan H.', ctx(), 'Chris C.').plan;
  const ev2 = ok(p2, [], { action: 'start', actor: 'Nathan H.', toKey: 'pet-aisle' }, L(21, 50));
  assert.ok(R.timingIssues(p2, ev2, L(23, 30), timing()).some((i) => i.type === 'running-after-shift' && i.employee === 'Nathan H.'));
  assert.equal(R.progress(p2, ev2, L(23, 30), timing()).zones.get('pet-aisle').elapsedMs, 10 * 60000, 'time after 22:00 is not recovery time');
});

test('a manager correcting a record is audited instead of blocked; the employee’s own actions are not', () => {
  const plan = posted();
  const byMgr = rec(plan, [], { ...mgr, employee: 'Carlton R.', action: 'start', toKey: 'back-wall-water' }, L(19, 10));
  assert.equal(byMgr.ok, true);
  assert.equal(byMgr.event.byManager, true);
  assert.equal(rec(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(19, 10)).ok, false);
});

test('acting on a plan for another date is refused', () => {
  const plan = posted();
  const r = rec(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(17, 30, 15));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /plan is for 2026-11-14/);
});

test('suggested owners are weighted by free minutes: someone with 30 free minutes is not given an equal share', () => {
  const c = { ...ctx(), dailyPlan: { blocks: [{ name: 'Nathan H.', start: '17:00', end: '21:30', reason: 'Register coverage' }], entries: [] } };
  const staff = R.eligibleStaff(SAT, c);
  assert.equal(staff.find((s) => s.name === 'Nathan H.').free.reduce((a, w) => a + w.end - w.start, 0), 30);
  let plan = R.newPlan(SAT, { ...c, schedule: schedule.map((s) => (s.name === 'Carlton R.' ? { ...s, name: 'Margarette L.' } : s)) });
  plan = { ...plan, zones: [], routes: [], starterApplied: false };
  for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) plan = R.addZone(plan, 'Aisle ' + name).plan;
  const out = R.suggestOwners(plan, { ...c, schedule: schedule.map((s) => (s.name === 'Carlton R.' ? { ...s, name: 'Margarette L.' } : s)) });
  const count = (name) => R.routeOf(out, name)?.zoneKeys.length || 0;
  assert.equal(count('Nathan H.'), 0);
  assert.equal(count('Margarette L.'), 6);
  // no one has free time at all: unassigned with a reason, never forced onto a break
  const full = { ...ctx(), dailyPlan: { blocks: ['Carlton R.', 'Nathan H.'].map((name) => ({ name, start: '17:00', end: '22:00', reason: 'Register coverage' })), entries: [] } };
  const none = R.suggestOwners(plan, full);
  assert.equal(none.routes.length, 0);
  assert.ok(Object.values(none.reasons).every((r) => /No scheduled, available staff/.test(r)));
});

test('review flags a route start that now falls in a break or coverage block added after planning', () => {
  const plan = posted({ ...ctx(), dailyPlan: null });
  assert.equal(R.reviewPlan(plan, ctx({ dailyPlan: null })).filter((i) => i.type === 'start').length, 0);
  const later = ctx({ dailyPlan: { blocks: [{ name: 'Carlton R.', start: '17:00', end: '17:45', reason: 'Register coverage' }], entries: [] } });
  const issues = R.reviewPlan(plan, later);
  assert.ok(issues.some((i) => i.type === 'start' && /outside their free time/.test(i.text)));
  assert.equal(R.routeOf(plan, 'Carlton R.').start, '17:00', 'not silently changed');
});

test('reserved duties already assigned in the daily planner are never overlapped', () => {
  const c = ctx({ dailyPlan: { blocks: [], entries: [{ owner: 'Carlton R.', start: '17:00', end: '18:30', title: 'Closing prep' }, { owner: 'Carlton R.', start: '06:00', end: '07:00', title: 'Morning task' }] } });
  const staff = R.eligibleStaff(SAT, c).find((s) => s.name === 'Carlton R.');
  assert.equal(staff.from, '18:30');
  assert.deepEqual(staff.busy.map((b) => b.reason), ['Closing prep'], 'morning duty is outside the window');
  assert.equal(R.routeOf(R.newPlan(SAT, c), 'Carlton R.').start, '18:30');
});

test('next day uses the NEW day’s breaks, coverage and shifts when suggesting owners and starts', () => {
  const plan = posted({ ...ctx(), dailyPlan: null });
  const c = ctx({ dailyPlan: { id: SUN, blocks: [{ name: 'Margarette L.', start: '17:00', end: '19:00', reason: 'Register coverage' }], entries: [] }, now: L(23) });
  let ev = ok(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, L(17, 0), timing({ ...ctx(), dailyPlan: null }));
  ev = ok(plan, ev, { action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'partial', note: 'left shelves' }, L(17, 30), timing({ ...ctx(), dailyPlan: null }));
  const out = R.prepareNextDay(plan, ev, SUN, c);
  const m = R.routeOf(out.plan, 'Margarette L.');
  if (m) assert.equal(m.start, '19:00', 'starts after her coverage, not at 5 p.m.');
  for (const r of out.plan.routes) {
    const s = R.eligibleStaff(SUN, c).find((x) => x.name === r.owner);
    assert.ok(s.free.some((w) => R.availabilityNow && P_mins(r.start) >= w.start && P_mins(r.start) < w.end), r.owner + ' start is inside a free window');
  }
});
function P_mins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
