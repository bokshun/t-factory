const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const P = require('../planner-core.js');
const R = require('../recovery-core.js');
const ops = require('../operations.js');

const RealDate = Date;
const SAT = '2026-11-14', SUN = '2026-11-15';
const people = [
  ['Chris C.', 'Store Manager'], ['Margarette L.', 'Assistant Store Manager'], ['Carlton R.', 'Sales Associate'],
  ['Nathan H.', 'Sales Associate'], ['Blaire M.', 'Key Holder']
];
const team = people.map(([name, role]) => ({ name, role }));
const sh = (date, name, start, end) => ({ date, name, start, end });

function harness({ member = 'Chris C.', manager = true } = {}) {
  const handlers = {};
  const fields = {};
  const host = { innerHTML: '', addEventListener: (name, fn) => { handlers[name] = fn; } };
  const banner = { hidden: true, textContent: '' };
  let nowMs = new RealDate(2026, 10, 14, 17, 5).getTime();
  function FixedDate(...args) { return args.length ? new RealDate(...args) : new RealDate(nowMs); }
  FixedDate.now = () => nowMs; FixedDate.parse = RealDate.parse; FixedDate.prototype = RealDate.prototype;
  let printed = 0, saves = 0, failSave = false;
  const store = {};
  const state = {
    team,
    schedule: [
      sh(SAT, 'Chris C.', '07:00', '16:00'), sh(SAT, 'Carlton R.', '12:00', '21:00'), sh(SAT, 'Nathan H.', '13:00', '22:00'), sh(SAT, 'Blaire M.', '14:00', '22:00'),
      sh(SUN, 'Margarette L.', '12:00', '22:00'), sh(SUN, 'Nathan H.', '15:00', '22:00')
    ],
    tasks: [], dailyPlans: [], recoveryPlans: [], recoveryEvents: []
  };
  const context = {
    state, ops: { ...ops, dateKey: (d) => (d ? ops.dateKey(d) : SAT) }, currentAccess: { member, role: manager ? 'manager' : 'associate' },
    canUseManagerTools: () => context.currentAccess.role === 'manager',
    escapeHtml: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    saveState: () => { saves++; return !failSave; },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    document: { body: { dataset: {} }, querySelector: (s) => (s === '#recoveryView' ? host : s === '#recoveryDueBanner' ? banner : (fields[s] ||= null)), querySelectorAll: () => [] },
    window: { StoreFlowRecovery: R, StoreFlowPlanner: P, addEventListener: () => {}, print: () => { printed++; }, confirm: () => true },
    Date: FixedDate, Map, Set, setTimeout: (fn) => fn(), console
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../recovery-ui.js'), 'utf8'), context);
  const ui = context.window.StoreFlowRecoveryUI;
  const click = (action, dataset = {}) => handlers.click({ target: { dataset: { action, ...dataset }, type: 'button' } });
  const change = (field, value, extra = {}) => handlers.change({ target: { dataset: { field, ...extra }, value, type: extra.type || 'text', checked: extra.checked } });
  const submit = (id) => handlers.submit({ preventDefault() {}, target: { id } });
  const as = (name, isManager) => { context.currentAccess = { member: name, role: isManager ? 'manager' : 'associate' }; ui.render(); };
  return {
    state, host, banner, ui, click, change, submit, as, context,
    setNow: (h, m = 0, day = 14) => { nowMs = new RealDate(2026, 10, day, h, m).getTime(); },
    date: () => new RealDate(nowMs),
    printed: () => printed, saves: () => saves, failSave: (v) => { failSave = v; }, store,
    plan: (d = SAT) => state.recoveryPlans.find((p) => p.id === d)
  };
}

function prepared() {
  const x = harness();
  x.click('prepare');
  x.click('post');
  x.as('Carlton R.', false);
  return x;
}

test('manager prepares a draft from the schedule; staff see nothing until the manager posts; no tasks are created', () => {
  const x = harness();
  x.click('prepare');
  const plan = x.plan();
  assert.equal(plan.postedAt, null);
  assert.equal(plan.routes[0].owner, 'Carlton R.');
  assert.match(x.host.innerHTML, /DRAFT — not posted/);
  assert.match(x.host.innerHTML, /Starter example for Carlton/);
  assert.match(x.host.innerHTML, /Alerts appear only while StoreFlow is open/);
  x.as('Carlton R.', false);
  assert.match(x.host.innerHTML, /has not posted the recovery plan/);
  assert.doesNotMatch(x.host.innerHTML, /Post reviewed plan/);
  x.as('Chris C.', true);
  x.click('post');
  assert.ok(x.plan().postedAt);
  assert.equal(x.state.tasks.length, 0, 'posting recovery never creates or changes Task Board tasks');
});

test('opening or printing never posts; print uses the native dialog in recovery mode', () => {
  const x = harness();
  x.click('prepare');
  x.click('print');
  assert.equal(x.printed(), 1);
  assert.equal(x.context.document.body.dataset.printMode, 'recovery');
  assert.equal(x.plan().postedAt, null);
});

test('scheduled Carlton gets the 5 p.m. in-app prompt and banner; an off-shift employee gets none', () => {
  const x = prepared();
  const rung = [];
  x.setNow(16, 55);
  x.ui.tick(x.date(), (t, d) => rung.push([t, d]));
  assert.equal(x.banner.hidden, true);
  x.setNow(17, 0);
  x.ui.tick(x.date(), (t, d) => rung.push([t, d]));
  assert.equal(x.banner.hidden, false);
  assert.match(x.banner.textContent, /start Back wall — Water/);
  x.ui.tick(x.date(), (t, d) => rung.push([t, d]));
  assert.equal(rung.length, 1, 'alert fires once; banner stays as fallback');
  assert.match(rung[0][1], /Back wall — Water/);
  assert.match(x.host.innerHTML, /Recovery is due now/);
  assert.match(x.host.innerHTML, /not enabled and has not been phone-tested/);
  x.as('Chris C.', false);
  x.ui.tick(x.date(), () => assert.fail('off-shift employee must not be alerted'));
  assert.equal(x.banner.hidden, true);
  assert.match(x.host.innerHTML, /no recovery route/);
});

test('without alerts enabled the banner still shows (tick receives no sender)', () => {
  const x = prepared();
  x.setNow(17, 10);
  x.ui.tick(x.date(), null);
  assert.equal(x.banner.hidden, false);
});

test('guided Water → Kitchen → Paper → Pet; Carlton may change Water → Pet with a named destination and Water’s status', () => {
  const x = prepared();
  assert.match(x.host.innerHTML, /Next planned section<\/small><strong>Back wall — Water/);
  x.click('startNext', { zone: 'back-wall-water' });
  assert.match(x.host.innerHTML, /Current section<\/small><strong>Back wall — Water — In progress/);
  assert.match(x.host.innerHTML, /Next planned section<\/small><strong>Back wall — Kitchen/);
  x.click('change');
  assert.match(x.host.innerHTML, /Destination \(required\)/);
  assert.match(x.host.innerHTML, /Back wall — Water — what is its status\? \(required\)/.source ? /Back wall — Water — what is its status/ : /x/);
  // blank destination
  x.submit('recoveryChange');
  assert.match(x.host.innerHTML, /Choose a named destination section/);
  assert.match(x.host.innerHTML, /Record the status of Back wall — Water/);
  assert.equal(x.state.recoveryEvents.length, 1, 'nothing saved while invalid');
  // Other without a name, and a generic name
  x.change('toKey', 'other');
  x.change('disposition', 'completed', { type: 'radio' });
  x.submit('recoveryChange');
  assert.match(x.host.innerHTML, /Other needs a specific aisle or section name/);
  x.change('otherName', 'moved elsewhere');
  x.submit('recoveryChange');
  assert.match(x.host.innerHTML, /is not a destination/);
  // valid: Pet, Water partial needs remaining-work detail
  x.change('toKey', 'pet-aisle');
  x.change('disposition', 'partial', { type: 'radio' });
  x.submit('recoveryChange');
  assert.match(x.host.innerHTML, /Add a short note of what remains in Back wall — Water/);
  x.change('note', 'left side shelves not faced');
  x.change('reason', 'Pallet blocking water');
  x.submit('recoveryChange');
  assert.equal(x.state.recoveryEvents.length, 2);
  const e = x.state.recoveryEvents[1];
  assert.deepEqual([e.action, e.employee, e.fromKey, e.toKey, e.disposition, e.note, e.reason], ['move', 'Carlton R.', 'back-wall-water', 'pet-aisle', 'partial', 'left side shelves not faced', 'Pallet blocking water']);
  assert.match(x.host.innerHTML, /Current section<\/small><strong>Pet aisle — In progress/);
  assert.match(x.host.innerHTML, /Back wall — Water<\/b> — Partially recovered/);
  assert.deepEqual(x.plan().routes[0].zoneKeys, ['back-wall-water', 'back-wall-kitchen', 'paper-products', 'pet-aisle'], 'planned route unchanged');
});

test('Other with a specific name records an actual-route section visible to the manager without editing the plan', () => {
  const x = prepared();
  x.click('startNext', { zone: 'back-wall-water' });
  const planBefore = JSON.stringify(x.plan());
  x.click('change');
  x.change('toKey', 'other');
  x.change('otherName', 'Aisle 9 — Seasonal');
  x.change('disposition', 'completed', { type: 'radio' });
  x.submit('recoveryChange');
  assert.equal(JSON.stringify(x.plan()), planBefore);
  assert.equal(x.state.recoveryEvents[1].toName, 'Aisle 9 — Seasonal');
  x.as('Chris C.', true);
  assert.match(x.host.innerHTML, /Aisle 9 — Seasonal/);
});

test('pause is not a move: no destination required, section stays current, resume shows it, paused time is not counted', () => {
  const x = prepared();
  x.setNow(17, 0);
  x.click('startNext', { zone: 'back-wall-water' });
  x.setNow(17, 10);
  x.click('pause');
  assert.match(x.host.innerHTML, /Back wall — Water — Paused/);
  assert.match(x.host.innerHTML, /Resume/);
  assert.equal(x.state.recoveryEvents[1].action, 'pause');
  assert.equal(x.state.recoveryEvents[1].toKey, '');
  x.setNow(17, 40);
  assert.match(x.host.innerHTML.replace(/<[^>]+>/g, ' '), /Recorded time 10 min/);
  x.click('resume');
  assert.match(x.host.innerHTML, /Back wall — Water — In progress/);
  x.setNow(17, 45);
  x.click('finish');
  assert.match(x.host.innerHTML, /Yes, this section is finished/);
  assert.equal(x.state.recoveryEvents.length, 3, 'finish needs explicit confirmation');
  x.click('confirmFinish');
  assert.match(x.host.innerHTML, /Next suggested section: Back wall — Kitchen/);
  assert.match(x.host.innerHTML, /Start Back wall — Kitchen/);
  assert.match(x.host.innerHTML, /Back wall — Water<\/b> — Employee complete/);
});

test('an occupied section shows the conflict before confirmation and needs acknowledgment', () => {
  const x = harness();
  x.click('prepare');
  x.click('assign');
  x.change('assign', 'Nathan H.', { zone: 'pet-aisle', type: 'select-one' });
  x.click('post');
  x.as('Nathan H.', false);
  x.click('startNext', { zone: 'pet-aisle' });
  x.as('Carlton R.', false);
  x.click('startNext', { zone: 'back-wall-water' });
  x.click('change');
  x.change('toKey', 'pet-aisle');
  x.change('disposition', 'completed', { type: 'radio' });
  assert.match(x.host.innerHTML, /already in progress by Nathan H\./);
  x.submit('recoveryChange');
  assert.match(x.host.innerHTML, /acknowledge you are collaborating/);
  x.change('ackCollab', true, { type: 'checkbox', checked: true });
  x.submit('recoveryChange');
  const last = x.state.recoveryEvents[x.state.recoveryEvents.length - 1];
  assert.equal(last.collaboration, true);
  assert.deepEqual(x.plan().routes.find((r) => r.owner === 'Nathan H.').zoneKeys, ['pet-aisle'], 'Nathan’s assignment untouched');
});

test('staff cannot manage the plan; the manager panel is hidden for associates', () => {
  const x = prepared();
  assert.doesNotMatch(x.host.innerHTML, /Post reviewed plan|Re-post plan|recoveryAddZone/);
  const before = JSON.stringify(x.state.recoveryPlans);
  x.click('post'); x.click('addZone'); x.click('prepareNext');
  x.change('assign', 'Nathan H.', { zone: 'pet-aisle', type: 'select-one' });
  assert.equal(JSON.stringify(x.state.recoveryPlans), before);
});

test('pending sync is shown and cleared once the app confirms the push; failed saves are reported', () => {
  const x = prepared();
  x.click('startNext', { zone: 'back-wall-water' });
  assert.match(x.host.innerHTML, /1 change\(s\) saved on this device, waiting to sync/);
  x.ui.markSynced();
  assert.match(x.host.innerHTML, /All recorded changes are synced/);
  x.ui.noteConflicts(2);
  assert.match(x.host.innerHTML, /reported 2 edit conflict/);
  x.ui.noteConflicts(0);
  x.failSave(true);
  x.click('pause');
  assert.match(x.host.innerHTML, /Could not save this change on the device/);
});

/* ----- manager progress and next-day continuation through the UI ----- */
function saturdayWork(x) {
  x.as('Carlton R.', false);
  x.setNow(17, 0); x.click('startNext', { zone: 'back-wall-water' });
  x.setNow(17, 30); x.click('finish'); x.click('confirmFinish');
  x.setNow(17, 31); x.click('startNext', { zone: 'back-wall-kitchen' });
  x.setNow(18, 20); x.click('change');
  x.change('toKey', 'pet-aisle'); x.change('disposition', 'partial', { type: 'radio' }); x.change('note', 'bottom shelves left'); x.submit('recoveryChange');
}

test('manager sees assigned staff, current section, completed sections, actual order, pauses, time and unfinished', () => {
  const x = prepared();
  saturdayWork(x);
  x.as('Chris C.', true);
  const text = x.host.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /Carlton R\. Pet aisle Back wall — Water Back wall — Water → Back wall — Kitchen → Pet aisle 0 \d+ min 0 Back wall — Kitchen, Paper products, Pet aisle/);
  assert.match(text, /Unfinished — stays on the handoff/);
  assert.match(text, /bottom shelves left/);
  x.click('verify', { zone: 'back-wall-water' });
  assert.match(x.host.innerHTML, /MOD verification recorded/);
  assert.equal(x.state.recoveryEvents.at(-1).action, 'verify');
  assert.equal(x.state.recoveryEvents.filter((e) => e.action === 'finish').length, 1, 'employee completion and MOD verification stay separate');
});

test('defer needs a manager note; deferred work is not auto-carried', () => {
  const x = prepared();
  saturdayWork(x);
  x.as('Chris C.', true);
  x.click('defer', { zone: 'paper-products' });
  assert.ok(!x.state.recoveryEvents.some((e) => e.action === 'defer'));
  x.change('deferNote', 'Pallet arrives Monday', { zone: 'paper-products' });
  x.click('defer', { zone: 'paper-products' });
  assert.equal(x.state.recoveryEvents.at(-1).action, 'defer');
  x.change('date', SUN);
  x.click('prepareNext');
  assert.ok(!x.plan(SUN).zones.some((z) => z.name === 'Paper products'));
});

test('next day: unfinished sections first with last worker and notes, owners only from Sunday’s staff, never posted, no duplicates', () => {
  const x = prepared();
  saturdayWork(x);
  x.as('Chris C.', true);
  x.change('date', SUN);
  x.click('prepareNext');
  const sunday = x.plan(SUN);
  assert.deepEqual(sunday.zones.map((z) => z.name), ['Back wall — Kitchen', 'Pet aisle', 'Paper products']);
  assert.equal(sunday.postedAt, null);
  assert.ok(sunday.routes.every((r) => ['Margarette L.', 'Nathan H.'].includes(r.owner)), 'Carlton is off Sunday and is not reassigned');
  assert.match(x.host.innerHTML, /Carryover from 2026-11-14/);
  assert.match(x.host.innerHTML, /Last: Carlton R\./);
  assert.match(x.host.innerHTML, /Remaining: bottom shelves left/);
  x.click('prepareNext');
  x.click('prepareNext');
  assert.equal(x.plan(SUN).zones.length, 3);
  assert.equal(new Set(x.plan(SUN).zones.map((z) => z.carryOrigin.zoneId)).size, 3);
  assert.match(x.host.innerHTML, /No new sections to carry forward/);
  // Saturday history stays intact, and Water is not carried
  const sat = R.progress(x.plan(SAT), x.state.recoveryEvents, '2026-11-14T23:00:00.000Z');
  assert.equal(sat.zones.get('back-wall-water').status, 'Employee complete');
  assert.ok(!sunday.zones.some((z) => /water/i.test(z.name)));
  // manager can add a dated new Water pass
  x.change('passName', 'Back wall — Water');
  x.click('newPass');
  assert.ok(x.plan(SUN).zones.some((z) => /Water \(new pass 2026-11-15\)/.test(z.name)));
});

test('dated printable plan shows staff, order, instructions, carryover detail and sign-off room; embedded for the daily planner', () => {
  const x = prepared();
  saturdayWork(x);
  x.as('Chris C.', true);
  x.change('date', SUN);
  x.click('prepareNext');
  const html = x.ui.printHtml(SUN);
  assert.match(html, /Recovery 5 p\.m\. to close · 2026-11-15 · DRAFT — not posted/);
  assert.match(html, /CARRYOVER from 2026-11-14 · last: Carlton R\./);
  assert.match(html, /remaining: bottom shelves left/);
  assert.match(html, /Face and straighten products/);
  assert.match(html, /Initials: _____ &nbsp; MOD: _____/);
  assert.match(html, /Unfinished sections for the closing\/opening handoff/);
  assert.match(html, /Employee sign-off/);
  assert.match(html, /Margarette L\./);
  assert.doesNotMatch(html, /Carlton R\. 12:00/);
  const embedded = x.ui.printHtml(SUN, { embedded: true });
  assert.ok(embedded.length > 100 && !/id="recoveryPrintBody"/.test(embedded));
  assert.equal(x.ui.printHtml('2026-12-01', { embedded: true }), '');
});

test('schedule gap: no staff scheduled after 5 p.m. leaves an unassigned, visibly explained handoff', () => {
  const x = prepared();
  saturdayWork(x);
  x.as('Chris C.', true);
  x.state.schedule = x.state.schedule.filter((s) => s.date !== SUN);
  x.change('date', SUN);
  x.click('prepareNext');
  const plan = x.plan(SUN);
  assert.equal(plan.routes.length, 0);
  assert.match(x.host.innerHTML, /No active employee is scheduled from 5 p\.m\. to close/);
  assert.match(x.host.innerHTML, /No scheduled, available staff from 5 p\.m\. to close/);
  assert.match(x.ui.printHtml(SUN), /UNASSIGNED sections/);
});

test('schedule change after posting is flagged for review; the owner stays assigned until a manager decides', () => {
  const x = prepared();
  x.as('Chris C.', true);
  x.state.schedule = x.state.schedule.filter((s) => s.name !== 'Carlton R.');
  x.ui.render();
  assert.match(x.host.innerHTML, /Review needed/);
  assert.match(x.host.innerHTML, /Carlton R\. is not scheduled from 5 p\.m\. to close/);
  assert.equal(x.plan().routes[0].owner, 'Carlton R.');
});

test('reassigning on a posted plan writes an audit event and keeps prior events', () => {
  const x = prepared();
  x.click('startNext', { zone: 'back-wall-water' });
  x.as('Chris C.', true);
  x.change('assign', 'Nathan H.', { zone: 'pet-aisle', type: 'select-one' });
  const audit = x.state.recoveryEvents.at(-1);
  assert.equal(audit.action, 'reassign');
  assert.equal(audit.toOwner, 'Nathan H.');
  assert.equal(audit.byManager, true);
  assert.equal(x.state.recoveryEvents[0].action, 'start');
  // cannot assign to someone not scheduled after 5 p.m.
  x.change('assign', 'Chris C.', { zone: 'paper-products', type: 'select-one' });
  assert.match(x.host.innerHTML, /not scheduled from 5 p\.m\. to close/);
});

test('planner print embeds the recovery section for the same date', () => {
  const src = fs.readFileSync(require.resolve('../planner-ui.js'), 'utf8');
  assert.match(src, /StoreFlowRecoveryUI\.printHtml\(p\.id,\{embedded:true\}\)/);
});

/* ----- timing regressions: shift hours, breaks and register coverage ----- */
const withCoverage = () => {
  const x = harness();
  x.state.dailyPlans.push({ id: SAT, blocks: [{ name: 'Carlton R.', start: '19:00', end: '19:30', reason: 'Break' }, { name: 'Carlton R.', start: '20:00', end: '21:00', reason: 'Register coverage' }], entries: [] });
  x.click('prepare');
  x.click('post');
  x.as('Carlton R.', false);
  return x;
};
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('staff see their free time and the next reserved block before it starts', () => {
  const x = withCoverage();
  x.setNow(18, 50);
  x.click('startNext', { zone: 'back-wall-water' });
  assert.match(plain(x.host.innerHTML), /You are free until 19:00 — next reserved: 19:00–19:30 Break\. Pause or finish before then\./);
});

test('during a break Start, Resume and Change are disabled and refused; Pause and Finish stay available', () => {
  const x = withCoverage();
  x.setNow(18, 50);
  x.click('startNext', { zone: 'back-wall-water' });
  x.setNow(19, 10);
  x.as('Carlton R.', false);
  assert.match(plain(x.host.innerHTML), /reserved for Break until 19:30/);
  assert.match(x.host.innerHTML, /data-action="change" disabled/);
  assert.doesNotMatch(x.host.innerHTML, /data-action="pause" disabled|data-action="finish" disabled/);
  // the manager is told the section is still running during the break
  x.as('Chris C.', true);
  assert.match(plain(x.host.innerHTML), /Timing — shift hours, breaks and coverage/);
  assert.match(plain(x.host.innerHTML), /Carlton R\. still has Back wall — Water running during Break/);
  x.as('Carlton R.', false);
  x.click('pause');
  assert.equal(x.state.recoveryEvents.at(-1).action, 'pause');
  assert.match(x.host.innerHTML, /data-action="resume" disabled/);
  const count = x.state.recoveryEvents.length;
  x.setNow(19, 15);
  x.click('resume');
  assert.equal(x.state.recoveryEvents.length, count, 'resume refused during the break');
  assert.match(plain(x.host.innerHTML), /reserved for Break until 19:30/);
  x.setNow(19, 30);
  x.as('Carlton R.', false);
  x.click('resume');
  assert.equal(x.state.recoveryEvents.at(-1).action, 'resume');
});

test('time worked through a break is excluded from recorded time and shown as excluded', () => {
  const x = withCoverage();
  x.setNow(18, 50);
  x.click('startNext', { zone: 'back-wall-water' });
  x.setNow(19, 40);
  x.click('finish'); x.click('confirmFinish');
  x.as('Chris C.', true);
  const text = plain(x.host.innerHTML);
  assert.match(text, /Carlton R\. .* 0 20 min 30 min excluded \(break, coverage or off shift\)/);
  assert.match(text, /30 min of Carlton R\.’s recorded time fell during breaks, coverage or outside the shift/);
});

test('the due banner shows only while the employee is free: not on a break, not on coverage, not after the shift', () => {
  const x = withCoverage();
  const shown = (h, m) => { x.setNow(h, m); x.ui.tick(x.date(), null); return !x.banner.hidden; };
  assert.equal(shown(16, 50), false, 'before recovery time');
  assert.equal(shown(17, 0), true);
  assert.equal(shown(19, 10), false, 'on break');
  assert.equal(shown(19, 45), true);
  assert.equal(shown(20, 30), false, 'on register coverage');
  assert.equal(shown(21, 30), false, 'shift ended');
});

test('manager sees free and reserved time per route; start times cannot be set inside a break', () => {
  const x = harness();
  x.state.dailyPlans.push({ id: SAT, blocks: [{ name: 'Carlton R.', start: '19:00', end: '19:30', reason: 'Break' }, { name: 'Carlton R.', start: '20:00', end: '21:00', reason: 'Register coverage' }], entries: [] });
  x.click('prepare');
  const text = plain(x.host.innerHTML);
  assert.match(text, /Free: 17:00–19:00, 19:30–20:00 · Reserved: 19:00–19:30 Break; 20:00–21:00 Register coverage/);
  x.change('routeStart', '19:10', { owner: 'Carlton R.', type: 'time' });
  assert.match(plain(x.host.innerHTML), /Start time must fall in a free window/);
  assert.equal(x.plan().routes[0].start, '17:00');
  x.change('routeStart', '19:30', { owner: 'Carlton R.', type: 'time' });
  assert.equal(x.plan().routes[0].start, '19:30');
});

test('printed plan lists each person’s free windows and the reserved duties kept in view', () => {
  const x = withCoverage();
  x.as('Chris C.', true);
  const html = x.ui.printHtml(SAT);
  assert.match(plain(html), /Carlton R\. · start 17:00 · free 17:00–19:00, 19:30–20:00/);
  assert.match(plain(html), /reserved: 19:00–19:30 Break; 20:00–21:00 Register coverage/);
});

test('an employee off shift for recovery is refused even if the app is opened late', () => {
  const x = withCoverage();
  x.setNow(21, 30);
  x.as('Carlton R.', false);
  assert.match(plain(x.host.innerHTML), /Your scheduled shift has ended/);
  assert.match(x.host.innerHTML, /data-action="startNext"[^>]* disabled/);
  x.click('startNext', { zone: 'back-wall-water' });
  assert.equal(x.state.recoveryEvents.length, 0);
});
