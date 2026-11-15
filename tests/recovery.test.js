const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../recovery-core.js');
const S = R.S;

const team = [
  { name: 'Chris C.', role: 'Store Manager' }, { name: 'Margarette L.', role: 'Assistant Store Manager' },
  { name: 'Carlton R.', role: 'Sales Associate' }, { name: 'Nathan H.', role: 'Sales Associate' },
  { name: 'Blaire M.', role: 'Key Holder' }, { name: 'Louis C.', role: 'Sales Associate' }
];
const sh = (date, name, start, end) => ({ date, name, start, end });
const SAT = '2026-11-14', SUN = '2026-11-15';
const baseSchedule = [
  sh(SAT, 'Chris C.', '07:00', '16:00'), sh(SAT, 'Carlton R.', '12:00', '21:00'), sh(SAT, 'Nathan H.', '13:00', '22:00'), sh(SAT, 'Blaire M.', '14:00', '22:00'), sh(SAT, 'Louis C.', '12:00', '22:00'),
  sh(SUN, 'Margarette L.', '12:00', '22:00'), sh(SUN, 'Nathan H.', '15:00', '22:00'), sh(SUN, 'Blaire M.', '09:00', '17:00')
];
const ctx = (extra = {}) => ({ schedule: baseSchedule, team, now: '2026-11-14T12:00:00.000Z', ...extra });
const mgr = { actor: 'Chris C.', actorIsManager: true };
let n = 0;
const op = () => 'op' + ++n;
const at = (h, m = 0, d = SAT) => `${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const post = (plan) => ({ ...plan, postedAt: '2026-11-14T20:00:00.000Z', status: 'posted' });
const act = (plan, events, req, time) => { const r = R.record(plan, events, { opId: op(), ...req }, time); assert.ok(r.ok, JSON.stringify(r.errors)); return r.events; };

function carltonPlan() {
  const plan = post(R.newPlan(SAT, ctx()));
  return plan;
}

test('scheduled Carlton gets the editable starter route at 5 p.m.; off-shift Carlton and former staff get nothing', () => {
  const plan = R.newPlan(SAT, ctx());
  assert.equal(plan.starterApplied, true);
  const r = R.routeOf(plan, 'Carlton R.');
  assert.equal(r.start, '17:00');
  assert.deepEqual(r.zoneKeys.map((k) => R.zoneOf(plan, k).name), ['Back wall — Water', 'Back wall — Kitchen', 'Paper products', 'Pet aisle']);
  assert.ok(plan.zones.every((z) => /face and straighten/i.test(z.instruction)));
  const off = R.newPlan(SAT, ctx({ schedule: baseSchedule.filter((s) => s.name !== 'Carlton R.') }));
  assert.equal(off.routes.length, 0);
  assert.equal(off.starterApplied, undefined);
  const early = R.newPlan(SAT, ctx({ schedule: [sh(SAT, 'Carlton R.', '08:00', '16:30')] }));
  assert.equal(early.routes.length, 0);
  assert.ok(early.gaps.some((g) => /No active employee/.test(g)));
  assert.ok(!R.eligibleStaff(SAT, ctx()).some((s) => /louis/i.test(s.name)));
});

test('suggested start is 5 p.m. for staff already on shift, or their later shift start', () => {
  const staff = R.eligibleStaff(SAT, ctx());
  assert.equal(staff.find((s) => s.name === 'Carlton R.').from, '17:00');
  const late = R.eligibleStaff(SAT, ctx({ schedule: [sh(SAT, 'Nathan H.', '18:30', '22:00')] }));
  assert.equal(late[0].from, '18:30');
});

test('coverage blocks and reserved duties stay in view and are never overlapped; no one available is flagged', () => {
  const dailyPlan = { blocks: [{ name: 'Carlton R.', start: '17:00', end: '18:00', reason: 'Register coverage' }], entries: [{ owner: 'Nathan H.', start: '17:00', end: '22:00', title: 'Closing' }] };
  const staff = R.eligibleStaff(SAT, ctx({ dailyPlan }));
  const c = staff.find((s) => s.name === 'Carlton R.');
  assert.equal(c.from, '18:00');
  assert.equal(c.busy[0].reason, 'Register coverage');
  assert.equal(staff.find((s) => s.name === 'Nathan H.').available, false);
  const plan = R.newPlan(SAT, ctx({ dailyPlan }));
  assert.equal(R.routeOf(plan, 'Carlton R.').start, '18:00');
  const none = R.suggestOwners({ ...R.newPlan(SAT, ctx({ schedule: [] })), zones: [{ id: 'x', key: 'a', name: 'A', instruction: '' }] }, ctx({ schedule: [] }));
  assert.equal(none.routes.length, 0);
  assert.match(none.reasons.a, /No scheduled, available staff/);
  assert.ok(none.gaps.length >= 1);
  const set = R.setRouteStart(plan, 'Carlton R.', '17:15', ctx({ dailyPlan }));
  assert.equal(set.ok, false);
});

test('manager assignment only to scheduled available staff; posted plans get an audit event', () => {
  let plan = R.newPlan(SAT, ctx());
  assert.equal(R.assignZone(plan, R.zoneOf(plan, 'pet-aisle').key, 'Chris C.', ctx(), 'Chris C.').ok, false);
  const ok = R.assignZone(plan, 'pet-aisle', 'Nathan H.', ctx(), 'Chris C.');
  assert.ok(ok.ok);
  assert.equal(ok.event, null);
  assert.deepEqual(R.routeOf(ok.plan, 'Nathan H.').zoneKeys, ['pet-aisle']);
  assert.ok(!R.routeOf(ok.plan, 'Carlton R.').zoneKeys.includes('pet-aisle'));
  const posted = R.assignZone(post(plan), 'pet-aisle', 'Blaire M.', ctx(), 'Chris C.', 'audit1');
  assert.equal(posted.event.action, 'reassign');
  assert.equal(posted.event.fromOwner, 'Carlton R.');
  assert.equal(posted.event.toOwner, 'Blaire M.');
});

test('guided in order, and Carlton can change Water to Pet by naming Pet and recording Water’s disposition', () => {
  const plan = carltonPlan();
  let ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17));
  assert.equal(R.statusOf(R.progress(plan, ev, at(17, 5)), 'back-wall-water'), S.IN_PROGRESS);
  // blank destination rejected
  let bad = R.record(plan, ev, { opId: op(), action: 'move', actor: 'Carlton R.', toKey: '', disposition: 'completed' }, at(17, 20));
  assert.equal(bad.ok, false); assert.match(bad.errors.join(' '), /named destination/);
  // unnamed Other / generic rejected
  for (const otherName of ['', '  ', 'moved elsewhere', 'Other', 'n/a']) {
    bad = R.record(plan, ev, { opId: op(), action: 'move', actor: 'Carlton R.', toKey: 'other', otherName, disposition: 'completed' }, at(17, 20));
    assert.equal(bad.ok, false, otherName);
  }
  // missing disposition rejected; incomplete needs remaining-work note
  bad = R.record(plan, ev, { opId: op(), action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle' }, at(17, 20));
  assert.equal(bad.ok, false); assert.match(bad.errors.join(' '), /Completed, Partially recovered or Not started/);
  bad = R.record(plan, ev, { opId: op(), action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'partial' }, at(17, 20));
  assert.equal(bad.ok, false); assert.match(bad.errors.join(' '), /what remains/);
  // valid change with optional reason
  ev = act(plan, ev, { action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'partial', note: 'left side shelves not faced', reason: 'Truck pallet blocking water' }, at(17, 25));
  const prog = R.progress(plan, ev, at(17, 30));
  assert.equal(prog.zones.get('back-wall-water').status, S.PARTIAL);
  assert.equal(prog.zones.get('back-wall-water').notes[0].text, 'left side shelves not faced');
  assert.equal(prog.zones.get('pet-aisle').status, S.IN_PROGRESS);
  assert.deepEqual(R.routeOf(plan, 'Carlton R.').zoneKeys, ['back-wall-water', 'back-wall-kitchen', 'paper-products', 'pet-aisle'], 'planned route is not rewritten');
  const e = ev[ev.length - 1];
  assert.equal(e.fromKey, 'back-wall-water'); assert.equal(e.toKey, 'pet-aisle'); assert.equal(e.employee, 'Carlton R.'); assert.equal(e.reason, 'Truck pallet blocking water');
  assert.ok(e.at && e.disposition === 'partial' && e.note);
});

test('Other with a specific name becomes a derived section without editing the shared plan', () => {
  const plan = carltonPlan();
  let ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17));
  const before = JSON.stringify(plan);
  ev = act(plan, ev, { action: 'move', actor: 'Carlton R.', toKey: 'other', otherName: 'Aisle 9 — Seasonal', disposition: 'completed' }, at(17, 30));
  assert.equal(JSON.stringify(plan), before);
  const prog = R.progress(plan, ev, at(17, 31));
  assert.equal(prog.zones.get('adhoc-aisle-9-seasonal').status, S.IN_PROGRESS);
  assert.ok(R.allZones(plan, ev).find((z) => z.adHoc && z.name === 'Aisle 9 — Seasonal'));
});

test('pause and break never move or complete a section; paused time is not work time', () => {
  const plan = carltonPlan();
  let ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17, 0));
  ev = act(plan, ev, { action: 'pause', actor: 'Carlton R.' }, at(17, 10));
  let prog = R.progress(plan, ev, at(17, 40));
  assert.equal(prog.zones.get('back-wall-water').status, S.PAUSED);
  assert.equal(prog.zones.get('back-wall-water').elapsedMs, 10 * 60000);
  assert.equal(prog.people['Carlton R.'].zoneKey, 'back-wall-water');
  assert.equal(R.record(plan, ev, { opId: op(), action: 'pause', actor: 'Carlton R.' }, at(17, 41)).ok, false);
  ev = act(plan, ev, { action: 'resume', actor: 'Carlton R.' }, at(17, 40));
  ev = act(plan, ev, { action: 'finish', actor: 'Carlton R.', confirm: true }, at(17, 50));
  prog = R.progress(plan, ev, at(18, 0));
  assert.equal(prog.zones.get('back-wall-water').elapsedMs, 20 * 60000, '10 min + 10 min, break excluded');
  // leaving a paused section still requires disposition
  const plan2 = carltonPlan();
  let ev2 = act(plan2, [], { action: 'start', actor: 'Carlton R.', toKey: 'paper-products' }, at(17));
  ev2 = act(plan2, ev2, { action: 'pause', actor: 'Carlton R.' }, at(17, 5));
  assert.equal(R.record(plan2, ev2, { opId: op(), action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle' }, at(17, 6)).ok, false);
});

test('finish requires confirmation, then suggests the next unfinished route section the employee can accept or change', () => {
  const plan = carltonPlan();
  let ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17));
  assert.equal(R.record(plan, ev, { opId: op(), action: 'finish', actor: 'Carlton R.' }, at(17, 20)).ok, false);
  const r = R.record(plan, ev, { opId: op(), action: 'finish', actor: 'Carlton R.', confirm: true }, at(17, 20));
  assert.equal(r.suggestNext, 'back-wall-kitchen');
  ev = r.events;
  assert.equal(R.progress(plan, ev, at(17, 21)).zones.get('back-wall-water').status, S.COMPLETE);
  // accept the suggestion or change with the same required destination flow
  assert.equal(R.record(plan, ev, { opId: op(), action: 'start', actor: 'Carlton R.', toKey: '' }, at(17, 21)).ok, false);
  assert.ok(R.record(plan, ev, { opId: op(), action: 'start', actor: 'Carlton R.', toKey: 'pet-aisle' }, at(17, 21)).ok);
  // a completed section is not silently restarted
  assert.equal(R.record(plan, ev, { opId: op(), action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17, 21)).ok, false);
});

test('occupied sections show a conflict first; collaboration needs explicit acknowledgment; nothing is taken over', () => {
  let plan = R.assignZone(carltonPlan(), 'pet-aisle', 'Nathan H.', ctx(), 'Chris C.').plan;
  plan = post(plan);
  let ev = act(plan, [], { action: 'start', actor: 'Nathan H.', toKey: 'pet-aisle' }, at(17));
  ev = act(plan, ev, { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17, 1));
  const res = R.record(plan, ev, { opId: op(), action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'completed' }, at(17, 5));
  assert.equal(res.ok, false);
  assert.deepEqual(res.conflict, { zoneKey: 'pet-aisle', by: ['Nathan H.'] });
  ev = act(plan, ev, { action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'completed', ackCollab: true }, at(17, 6));
  const prog = R.progress(plan, ev, at(17, 7));
  assert.deepEqual(Object.keys(prog.zones.get('pet-aisle').workers).sort(), ['Carlton R.', 'Nathan H.']);
  assert.equal(R.routeOf(plan, 'Nathan H.').zoneKeys[0], 'pet-aisle', 'Nathan’s assignment is untouched');
  assert.equal(ev[ev.length - 1].collaboration, true);
});

test('workers only update their own route; unposted plans and unrouted staff are rejected; manager reassign is audited', () => {
  const plan = carltonPlan();
  const unposted = R.newPlan(SAT, ctx());
  assert.equal(R.record(unposted, [], { opId: op(), action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17)).ok, false);
  assert.equal(R.record(plan, [], { opId: op(), action: 'start', actor: 'Nathan H.', employee: 'Carlton R.', toKey: 'back-wall-water' }, at(17)).ok, false);
  assert.equal(R.record(plan, [], { opId: op(), action: 'start', actor: 'Nathan H.', toKey: 'back-wall-water' }, at(17)).ok, false, 'Nathan has no route');
  const byMgr = R.record(plan, [], { opId: op(), ...mgr, employee: 'Carlton R.', action: 'start', toKey: 'back-wall-water' }, at(17));
  assert.ok(byMgr.ok); assert.equal(byMgr.event.byManager, true); assert.equal(byMgr.event.actor, 'Chris C.');
});

test('retrying the same operation never duplicates progress; log is append-only', () => {
  const plan = carltonPlan();
  const req = { opId: 'retry-1', action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' };
  const a = R.record(plan, [], req, at(17));
  const b = R.record(plan, a.events, req, at(17, 1));
  assert.equal(b.duplicate, true);
  assert.equal(b.events.length, 1);
  const c = R.record(plan, a.events, { opId: 'retry-2', action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'completed' }, at(17, 5));
  const d = R.record(plan, c.events, { opId: 'retry-2', action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'completed' }, at(17, 6));
  assert.equal(d.events.length, 2);
  assert.deepEqual(c.events.slice(0, 1), a.events, 'prior events preserved');
});

test('flag issue is recorded without changing status; MOD verification is separate from employee completion', () => {
  const plan = carltonPlan();
  let ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'paper-products' }, at(17));
  assert.equal(R.record(plan, ev, { opId: op(), action: 'flag', actor: 'Carlton R.' }, at(17, 2)).ok, false);
  ev = act(plan, ev, { action: 'flag', actor: 'Carlton R.', note: 'Wet floor by endcap' }, at(17, 2));
  let prog = R.progress(plan, ev, at(17, 3));
  assert.equal(prog.zones.get('paper-products').status, S.IN_PROGRESS);
  assert.equal(prog.zones.get('paper-products').issues[0].text, 'Wet floor by endcap');
  assert.equal(R.record(plan, ev, { opId: op(), ...mgr, action: 'verify', zoneKey: 'paper-products' }, at(17, 4)).ok, false, 'not complete yet');
  ev = act(plan, ev, { action: 'finish', actor: 'Carlton R.', confirm: true }, at(17, 30));
  assert.equal(R.record(plan, ev, { opId: op(), actor: 'Carlton R.', action: 'verify', zoneKey: 'paper-products' }, at(17, 31)).ok, false, 'employee cannot verify');
  ev = act(plan, ev, { ...mgr, action: 'verify', zoneKey: 'paper-products' }, at(17, 40));
  prog = R.progress(plan, ev, at(17, 41));
  assert.equal(prog.zones.get('paper-products').status, S.VERIFIED);
  assert.equal(prog.zones.get('paper-products').completedBy, 'Carlton R.');
  assert.equal(prog.zones.get('paper-products').verifiedBy, 'Chris C.');
});

/* ----- next-day continuation: the specification's acceptance example ----- */
function saturdayProgress() {
  const plan = carltonPlan();
  let ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17));
  ev = act(plan, ev, { action: 'finish', actor: 'Carlton R.', confirm: true }, at(17, 30));
  ev = act(plan, ev, { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-kitchen' }, at(17, 31));
  ev = act(plan, ev, { action: 'flag', actor: 'Carlton R.', note: 'Leaking case' }, at(17, 50));
  ev = act(plan, ev, { action: 'move', actor: 'Carlton R.', toKey: 'pet-aisle', disposition: 'partial', note: 'bottom shelves left', reason: 'Pet truck freight' }, at(18, 20));
  // Paper never started. Pet left in progress at the end of the night.
  return { plan, ev };
}

test('next day: unfinished first with last worker and notes; completed Water stays history; owners only from that day’s staff', () => {
  const { plan, ev } = saturdayProgress();
  const out = R.prepareNextDay(plan, ev, SUN, ctx({ now: at(23, 0) }));
  const names = out.plan.zones.map((z) => z.name);
  assert.deepEqual(names, ['Back wall — Kitchen', 'Pet aisle', 'Paper products'], 'partial first (route order), then not started; Water not carried');
  const kitchen = out.plan.zones[0];
  assert.equal(kitchen.carry.lastWorker, 'Carlton R.');
  assert.deepEqual(kitchen.carry.notes, ['bottom shelves left']);
  assert.deepEqual(kitchen.carry.issues, ['Leaking case']);
  assert.ok(kitchen.carry.lastAt);
  assert.equal(kitchen.carryOrigin.planId, SAT);
  assert.equal(kitchen.carryOrigin.zoneId, SAT + ':back-wall-kitchen');
  assert.equal(out.plan.suggestedNextKey, 'carry:' + SAT + ':paper-products');
  // Carlton is off Sunday: not assigned; only Sunday's after-5 staff (Margarette, Nathan; Blaire ends at 17:00)
  const owners = out.plan.routes.map((r) => r.owner).sort();
  assert.ok(!owners.includes('Carlton R.') && !owners.includes('Blaire M.') && !owners.includes('Louis C.'));
  assert.ok(owners.every((o) => ['Margarette L.', 'Nathan H.'].includes(o)));
  assert.equal(out.plan.zones.length, [...out.plan.routes.flatMap((r) => r.zoneKeys)].length);
  assert.equal(out.plan.postedAt, null, 'nothing is posted until the manager confirms');
});

test('rebuilding Sunday twice creates only one follow-up per originating section and keeps manual assignments', () => {
  const { plan, ev } = saturdayProgress();
  let first = R.prepareNextDay(plan, ev, SUN, ctx({ now: at(23, 0) })).plan;
  first = R.assignZone(first, 'carry:' + SAT + ':paper-products', 'Nathan H.', ctx(), 'Chris C.').plan;
  const second = R.prepareNextDay(plan, ev, SUN, ctx({ old: first, now: at(23, 30) }));
  assert.equal(second.added, 0);
  assert.equal(second.plan.zones.length, 3);
  assert.equal(R.routeOf(second.plan, 'Nathan H.').zoneKeys.includes('carry:' + SAT + ':paper-products'), true);
  const third = R.prepareNextDay(plan, ev, SUN, ctx({ old: second.plan }));
  assert.equal(third.plan.zones.length, 3);
  assert.equal(new Set(third.plan.zones.map((z) => z.carryOrigin.zoneId)).size, 3);
});

test('last worker is preferred only when scheduled that day; missing next-day schedule yields an unassigned handoff, never guesses', () => {
  const { plan, ev } = saturdayProgress();
  const carltonOn = [...baseSchedule, sh(SUN, 'Carlton R.', '14:00', '22:00')];
  const withCarlton = R.prepareNextDay(plan, ev, SUN, ctx({ schedule: carltonOn }));
  assert.equal(R.routeOf(withCarlton.plan, 'Carlton R.').zoneKeys.includes('carry:' + SAT + ':back-wall-kitchen'), true);
  const nobody = R.prepareNextDay(plan, ev, SUN, ctx({ schedule: baseSchedule.filter((s) => s.date === SAT) }));
  assert.equal(nobody.plan.routes.length, 0);
  assert.equal(nobody.plan.zones.length, 3);
  assert.ok(Object.values(nobody.plan.reasons).every((r) => /No scheduled/.test(r)));
  assert.ok(nobody.plan.gaps.some((g) => /no owner|No active employee/i.test(g)));
});

test('Sunday carryover keeps Saturday history intact; a completed section needs a clearly dated new pass', () => {
  const { plan, ev } = saturdayProgress();
  const out = R.prepareNextDay(plan, ev, SUN, ctx());
  const sat = R.progress(plan, ev, at(23));
  assert.equal(sat.zones.get('back-wall-water').status, S.COMPLETE);
  const sun = R.progress(out.plan, [], at(12, 0, SUN));
  assert.ok([...sun.zones.values()].every((z) => z.status === S.NOT_STARTED), 'yesterday’s completion is not copied onto new work');
  assert.ok(!out.plan.zones.some((z) => /water/i.test(z.name)));
  const np = R.addNewPass(out.plan, 'Back wall — Water', ctx());
  assert.ok(np.ok);
  assert.match(R.zoneOf(np.plan, np.key).name, /new pass 2026-11-15/);
  const np2 = R.addNewPass(np.plan, 'Back wall — Water', ctx());
  assert.notEqual(np2.key, np.key);
});

test('unfinished stays visible until completed or deliberately deferred with a manager note; handoff lists it', () => {
  const { plan, ev } = saturdayProgress();
  assert.deepEqual(R.unfinished(plan, ev, at(23)).map((u) => u.key), ['back-wall-kitchen', 'paper-products', 'pet-aisle']);
  const lines = R.handoffLines(plan, ev, at(23));
  assert.match(lines.join('\n'), /Back wall — Kitchen — Partially recovered \(last: Carlton R\.\): bottom shelves left/);
  assert.equal(R.record(plan, ev, { opId: op(), ...mgr, action: 'defer', zoneKey: 'paper-products' }, at(23)).ok, false, 'needs a note');
  const ev2 = act(plan, ev, { ...mgr, action: 'defer', zoneKey: 'paper-products', note: 'Pallet arrives Monday' }, at(23, 5));
  assert.ok(!R.unfinished(plan, ev2, at(23, 6)).some((u) => u.key === 'paper-products'));
  assert.equal(R.deferredList(plan, ev2, at(23, 6))[0].note, 'Pallet arrives Monday');
  const out = R.prepareNextDay(plan, ev2, SUN, ctx());
  assert.ok(!out.plan.zones.some((z) => z.name === 'Paper products'), 'deferred work is not auto-carried');
});

test('chained carryover (Sunday → Monday) keeps a root origin link and never duplicates', () => {
  const { plan, ev } = saturdayProgress();
  const sunday = post(R.prepareNextDay(plan, ev, SUN, ctx()).plan);
  const MON = '2026-11-16';
  const sched = [...baseSchedule, sh(MON, 'Nathan H.', '12:00', '22:00')];
  const mon = R.prepareNextDay(sunday, [], MON, ctx({ schedule: sched }));
  assert.equal(mon.plan.zones.length, 3);
  const z = mon.plan.zones[0];
  assert.equal(z.carryOrigin.planId, SUN);
  assert.equal(z.carryOrigin.rootPlanId, SAT);
  assert.equal(R.prepareNextDay(sunday, [], MON, ctx({ schedule: sched, old: mon.plan })).plan.zones.length, 3);
});

test('no prior record produces a visible gap, not guessed work', () => {
  const out = R.prepareNextDay(null, [], SUN, ctx());
  assert.equal(out.plan.zones.length, 0);
  assert.ok(out.plan.gaps.some((g) => /No recovery record/.test(g)));
});

test('schedule changes flag off-shift owners for review without reassigning', () => {
  const plan = carltonPlan();
  const changed = baseSchedule.filter((s) => s.name !== 'Carlton R.');
  const issues = R.reviewPlan(plan, ctx({ schedule: changed }));
  assert.ok(issues.some((i) => i.type === 'schedule'));
  assert.ok(issues.some((i) => i.type === 'offshift' && i.owner === 'Carlton R.'));
  assert.equal(R.routeOf(plan, 'Carlton R.').zoneKeys.length, 4);
});

test('sections with recorded activity cannot be removed; unused ones can', () => {
  const plan = carltonPlan();
  const ev = act(plan, [], { action: 'start', actor: 'Carlton R.', toKey: 'back-wall-water' }, at(17));
  assert.equal(R.removeZone(plan, ev, 'back-wall-water').ok, false);
  assert.ok(R.removeZone(plan, ev, 'pet-aisle').ok);
  assert.equal(R.addZone(plan, 'elsewhere').ok, false);
});
