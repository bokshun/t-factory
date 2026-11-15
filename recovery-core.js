/* Guided recovery routes (5 p.m. to close) and next-day carryover for Store 19891.
   Pure logic with no DOM or network access so every rule can be tested. Specification: Chris, Nov 14, 2026.

   Data kept in the existing synced board:
   - recoveryPlans: one plan per date { id: 'YYYY-MM-DD', zones, routes, ... }   (the PLANNED route)
   - recoveryEvents: append-only log of actual section activity                   (the ACTUAL route)
   Planned route and actual activity are stored separately; events are never edited or deleted. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./planner-core.js'));
  else root.StoreFlowRecovery = factory(root.StoreFlowPlanner);
})(typeof self === 'undefined' ? this : self, function (P) {
  'use strict';

  const START = 17 * 60; // recovery starts at 5 p.m.
  const MIN_WINDOW = 15; // a free window shorter than this is not counted as availability
  const S = {
    NOT_STARTED: 'Not started',
    IN_PROGRESS: 'In progress',
    PAUSED: 'Paused',
    PARTIAL: 'Partially recovered',
    COMPLETE: 'Employee complete',
    VERIFIED: 'MOD verified'
  };
  const DISPOSITIONS = { completed: 'Completed', partial: 'Partially recovered', notstarted: 'Not started' };
  const DEFAULT_INSTRUCTION = 'Face and straighten products; return misplaced merchandise; fill accessible gaps where appropriate; keep aisles clear; flag stocking or safety problems.';
  // Chris's editable starter example. It is an example route, not a verified store map or a permanent assignment.
  const STARTER = { owner: /^carlton\b/i, zones: ['Back wall — Water', 'Back wall — Kitchen', 'Paper products', 'Pet aisle'] };
  const GENERIC_DESTINATION = /^\s*(other|others|elsewhere|moved elsewhere|somewhere|somewhere else|n\/?a|none|unknown|tbd|misc|\?+|-+|\.+)\s*$/i;

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const slug = (s) => String(s || '').toLowerCase().replace(/[—–]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const hhmm = (n) => P.time(n);
  const complete = (st) => st === S.COMPLETE || st === S.VERIFIED;
  const unfinishedStatus = (st) => !complete(st);

  /* ---------- who can recover on a date ---------- */

  /* Active employees actually scheduled for 5 p.m. to close, with reserved duties kept in view.
     Never replaces coverage, breaks or other reserved duties and never overlaps them. */
  function eligibleStaff(date, ctx) {
    const day = ctx.dailyPlan || null;
    const shifts = P.roster(date, ctx.schedule || [], ctx.team || []).filter((s) => s.endMinute > START);
    const byName = new Map();
    for (const s of shifts) {
      const rec = byName.get(s.name) || { name: s.name, role: s.role, shifts: [], busy: [], free: [] };
      rec.shifts.push(s);
      byName.set(s.name, rec);
    }
    for (const rec of byName.values()) {
      for (const b of day?.blocks || []) {
        if (b.name === rec.name) rec.busy.push({ start: P.mins(b.start), end: P.mins(b.end), reason: b.reason || 'Reserved coverage' });
      }
      for (const e of day?.entries || []) {
        if (e.owner === rec.name && !e.notApplicable && e.start && e.end && !P.isDriveline(e)) {
          rec.busy.push({ start: P.mins(e.start), end: P.mins(e.end), reason: e.title });
        }
      }
      rec.busy = rec.busy.filter((b) => Number.isFinite(b.start) && b.end > b.start && b.end > START).sort((a, b) => a.start - b.start);
      for (const s of rec.shifts) {
        let cursor = Math.max(START, s.startMinute);
        const limit = s.endMinute;
        for (const b of rec.busy) {
          if (b.end <= cursor || b.start >= limit) continue;
          if (b.start > cursor) rec.free.push({ start: cursor, end: Math.min(b.start, limit) });
          cursor = Math.max(cursor, b.end);
        }
        if (cursor < limit) rec.free.push({ start: cursor, end: limit });
      }
      rec.free = rec.free.filter((w) => w.end - w.start >= MIN_WINDOW).sort((a, b) => a.start - b.start);
      rec.available = rec.free.length > 0;
      rec.from = rec.available ? hhmm(rec.free[0].start) : '';
      rec.shiftText = rec.shifts.map((s) => s.start + '–' + s.end).join(', ');
      rec.reason = rec.available ? '' : 'Reserved duties cover the whole 5 p.m.–close window';
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /* ---------- timing: shift hours, breaks and register coverage ---------- */

  const pad2 = (n) => String(n).padStart(2, '0');
  function localParts(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return { date: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()), minute: d.getHours() * 60 + d.getMinutes() };
  }
  /* Free windows as absolute milliseconds for one date, so recorded intervals can be clipped to them. */
  function windowsMap(date, staff) {
    const [y, m, d] = date.split('-').map(Number);
    const base = new Date(y, m - 1, d).getTime();
    const out = {};
    for (const rec of staff || []) out[rec.name] = rec.free.map((w) => [base + w.start * 60000, base + w.end * 60000]);
    return out;
  }
  /* Where is this employee RIGHT NOW relative to their shift, breaks and coverage?
     state: free | reserved | before | after | unscheduled | wrongday. Starting or resuming work is only allowed when free. */
  function availabilityNow(date, rec, nowIso) {
    if (!rec) return { state: 'unscheduled', text: 'You are not scheduled from 5 p.m. to close on ' + date + '.' };
    const t = localParts(nowIso);
    if (!t) return { state: 'unknown', text: 'Could not read the current time.' };
    if (t.date !== date) return { state: 'wrongday', text: 'This recovery plan is for ' + date + ', not today.' };
    const m = t.minute;
    const win = rec.free.find((w) => m >= w.start && m < w.end);
    if (win) {
      const nextBusy = rec.busy.find((b) => b.start >= m) || null;
      const shiftEnd = Math.max(...rec.shifts.map((s) => s.endMinute));
      return { state: 'free', until: hhmm(win.end), nextBusy, shiftEnd: hhmm(shiftEnd), text: '' };
    }
    const busy = rec.busy.find((b) => m >= b.start && m < b.end);
    const later = rec.free.find((w) => w.start > m);
    if (busy) return { state: 'reserved', reason: busy.reason, until: later ? hhmm(later.start) : hhmm(busy.end), text: 'You are reserved for ' + busy.reason + ' until ' + (later ? hhmm(later.start) : hhmm(busy.end)) + '. Starting, resuming or changing a section is unavailable until then.' };
    if (later) return { state: 'before', until: hhmm(later.start), text: 'Recovery time for you starts at ' + hhmm(later.start) + '.' };
    return { state: 'after', text: 'Your scheduled shift has ended. Pause or finish what you have open; do not start new work.' };
  }

  /* ---------- plan structure ---------- */

  const zoneId = (planId, key) => planId + ':' + key;
  const routeId = (planId, owner) => planId + ':route:' + slug(owner);

  function uniqueKey(plan, base) {
    let key = base || 'zone';
    let n = 2;
    while (plan.zones.some((z) => z.key === key)) key = base + '-' + n++;
    return key;
  }

  function addZone(plan, name, opts = {}) {
    const clean = String(name || '').trim();
    if (!clean) return { ok: false, error: 'Enter a zone name.' };
    if (GENERIC_DESTINATION.test(clean)) return { ok: false, error: 'Enter a specific aisle or section name.' };
    const next = clone(plan);
    const key = uniqueKey(next, opts.key || slug(clean));
    next.zones.push({
      id: zoneId(next.id, key), key, name: clean,
      instruction: String(opts.instruction || '').trim() || DEFAULT_INSTRUCTION,
      department: String(opts.department || '').trim(),
      ...(opts.carryOrigin ? { carryOrigin: opts.carryOrigin, carry: opts.carry } : {}),
      ...(opts.pass ? { pass: opts.pass } : {})
    });
    return { ok: true, plan: next, key };
  }

  function newPlan(date, ctx) {
    const staff = eligibleStaff(date, ctx);
    const plan = {
      id: date, zones: [], routes: [], reasons: {}, deferred: [], gaps: [], status: 'draft', postedAt: null,
      generatedAt: (ctx.now || new Date().toISOString()), scheduleSig: P.signature(date, ctx.schedule || [], ctx.team || []), carriedFrom: null
    };
    const carlton = staff.find((s) => STARTER.owner.test(s.name) && s.available);
    if (carlton) {
      let p = plan;
      for (const name of STARTER.zones) p = addZone(p, name).plan;
      p.routes.push({ id: routeId(date, carlton.name), owner: carlton.name, start: carlton.from, zoneKeys: p.zones.map((z) => z.key) });
      p.starterApplied = true;
      p.gaps = gapsFor(p, staff);
      return p;
    }
    plan.gaps = gapsFor(plan, staff);
    return plan;
  }

  function gapsFor(plan, staff) {
    const gaps = [];
    if (!staff.length) gaps.push('No active employee is scheduled from 5 p.m. to close. Nothing is assigned; no staff or shifts are guessed.');
    else if (!staff.some((s) => s.available)) gaps.push('Scheduled staff are fully covered by reserved duties after 5 p.m. Nothing is assigned.');
    const open = plan.zones.filter((z) => !plan.routes.some((r) => r.zoneKeys.includes(z.key)));
    if (open.length) gaps.push(open.length + ' section(s) have no owner' + (plan.reasons && Object.values(plan.reasons).length ? ': ' + [...new Set(Object.values(plan.reasons))].join('; ') : '.'));
    return gaps;
  }

  const routeOf = (plan, owner) => plan.routes.find((r) => r.owner === owner);
  const zoneOf = (plan, key) => plan.zones.find((z) => z.key === key);

  /* Fill only UNASSIGNED sections from the day's available staff. Manual assignments and posted work are never moved. */
  function suggestOwners(plan, ctx, prefer = {}) {
    const next = clone(plan);
    const staff = eligibleStaff(next.id, ctx).filter((s) => s.available);
    const load = (name) => routeOf(next, name)?.zoneKeys.length || 0;
    next.reasons = {};
    for (const z of next.zones) {
      if (next.routes.some((r) => r.zoneKeys.includes(z.key))) continue;
      if (!staff.length) { next.reasons[z.key] = 'No scheduled, available staff from 5 p.m. to close'; continue; }
      const preferred = prefer[z.key] && staff.find((s) => s.name === prefer[z.key]);
      const capacity = (s) => s.free.reduce((sum, w) => sum + (w.end - w.start), 0);
      // Weight by free minutes so someone with 30 free minutes is not given as many sections as someone free all evening.
      const pick = preferred || staff.slice().sort((a, b) => (load(a.name) + 1) / capacity(a) - (load(b.name) + 1) / capacity(b) || a.free[0].start - b.free[0].start || a.name.localeCompare(b.name))[0];
      let route = routeOf(next, pick.name);
      if (!route) { route = { id: routeId(next.id, pick.name), owner: pick.name, start: pick.from, zoneKeys: [] }; next.routes.push(route); }
      route.zoneKeys.push(z.key);
    }
    next.gaps = gapsFor(next, eligibleStaff(next.id, ctx));
    return next;
  }

  /* Manager assigns/moves a section to a scheduled, available employee. Posted plans get an audit event. */
  function assignZone(plan, key, owner, ctx, actor, opId) {
    if (!zoneOf(plan, key)) return { ok: false, error: 'Unknown section.' };
    const staff = eligibleStaff(plan.id, ctx);
    const target = staff.find((s) => s.name === owner);
    if (!target) return { ok: false, error: owner + ' is not scheduled from 5 p.m. to close on ' + plan.id + '.' };
    if (!target.available) return { ok: false, error: owner + ' has no free time after 5 p.m. (' + target.reason + ').' };
    const next = clone(plan);
    const from = next.routes.find((r) => r.zoneKeys.includes(key));
    if (from) from.zoneKeys = from.zoneKeys.filter((k) => k !== key);
    let route = routeOf(next, owner);
    if (!route) { route = { id: routeId(next.id, owner), owner, start: target.from, zoneKeys: [] }; next.routes.push(route); }
    route.zoneKeys.push(key);
    next.routes = next.routes.filter((r) => r.zoneKeys.length || r.owner === owner);
    delete next.reasons[key];
    next.gaps = gapsFor(next, staff);
    const event = next.postedAt ? {
      id: opId || 'reassign:' + plan.id + ':' + key + ':' + owner + ':' + Date.now(), opId: opId || null, planId: plan.id, action: 'reassign', zoneKey: key,
      actor, byManager: true, employee: owner, fromOwner: from?.owner || '', toOwner: owner, at: ctx.now || new Date().toISOString()
    } : null;
    return { ok: true, plan: next, event };
  }

  function unassignZone(plan, key) {
    const next = clone(plan);
    for (const r of next.routes) r.zoneKeys = r.zoneKeys.filter((k) => k !== key);
    next.routes = next.routes.filter((r) => r.zoneKeys.length);
    return next;
  }

  function reorderZone(plan, owner, key, delta) {
    const next = clone(plan);
    const r = routeOf(next, owner);
    if (!r) return next;
    const i = r.zoneKeys.indexOf(key), j = i + delta;
    if (i < 0 || j < 0 || j >= r.zoneKeys.length) return next;
    [r.zoneKeys[i], r.zoneKeys[j]] = [r.zoneKeys[j], r.zoneKeys[i]];
    return next;
  }

  function setRouteStart(plan, owner, time, ctx) {
    const staff = eligibleStaff(plan.id, ctx).find((s) => s.name === owner);
    const m = P.mins(time);
    if (!staff) return { ok: false, error: owner + ' is not scheduled after 5 p.m.' };
    if (!Number.isFinite(m) || !staff.free.some((w) => m >= w.start && m < w.end)) return { ok: false, error: 'Start time must fall in a free window (' + staff.free.map((w) => hhmm(w.start) + '–' + hhmm(w.end)).join(', ') + ').' };
    const next = clone(plan);
    const r = routeOf(next, owner);
    if (!r) return { ok: false, error: 'No route for ' + owner };
    r.start = time;
    return { ok: true, plan: next };
  }

  /* ---------- progress derived from the append-only event log ---------- */

  const ordered = (events) => events.map((e, i) => ({ e, i })).sort((a, b) => String(a.e.at).localeCompare(String(b.e.at)) || a.i - b.i).map((x) => x.e);
  const planEvents = (plan, events) => ordered((events || []).filter((e) => e.planId === plan.id));

  /* Sections chosen as 'Other' by staff are added to the derived zone list, so staff never have to edit the shared plan. */
  function allZones(plan, events) {
    const zones = plan.zones.map((z) => ({ ...z }));
    for (const e of planEvents(plan, events)) {
      if (e.toName && e.toKey && !zones.some((z) => z.key === e.toKey)) {
        zones.push({ id: zoneId(plan.id, e.toKey), key: e.toKey, name: e.toName, instruction: DEFAULT_INSTRUCTION, department: '', adHoc: true, addedBy: e.employee });
      }
    }
    return zones;
  }

  function progress(plan, events, nowIso, opts) {
    const now = Date.parse(nowIso || new Date().toISOString());
    const zones = new Map(allZones(plan, events).map((z) => [z.key, {
      key: z.key, name: z.name, base: S.NOT_STARTED, status: S.NOT_STARTED, workers: {}, lastWorker: '', lastAt: '', notes: [], issues: [],
      elapsedMs: 0, outsideMs: 0, moves: 0, deferred: null, verifiedBy: '', verifiedAt: '', completedBy: '', completedAt: ''
    }]));
    const people = new Map();
    const stats = {};
    const st = (emp) => (stats[emp] ||= { elapsedMs: 0, outsideMs: 0, pauses: 0, order: [], completed: [], flags: 0 });
    const log = [];
    const settle = (z) => {
      const states = Object.values(z.workers);
      z.status = states.includes('running') ? S.IN_PROGRESS : states.includes('paused') ? S.PAUSED : z.base;
    };
    // Recorded work time counts only inside the employee's free windows (shift hours minus breaks, coverage and reserved duties).
    // Anything else is kept as 'excluded' so it stays visible but is never presented as recovery work.
    const clip = (emp, from, to) => {
      const total = Math.max(0, to - from);
      const w = opts && opts.windows && opts.windows[emp];
      if (!w) return { inside: total, outside: 0 };
      let inside = 0;
      for (const [s0, e0] of w) inside += Math.max(0, Math.min(to, e0) - Math.max(from, s0));
      return { inside, outside: total - inside };
    };
    const addTime = (emp, zone, from, to) => {
      const c = clip(emp, from, to);
      if (zone) { zone.elapsedMs += c.inside; zone.outsideMs += c.outside; }
      st(emp).elapsedMs += c.inside; st(emp).outsideMs += c.outside;
    };
    const closeInterval = (emp, at) => {
      const a = people.get(emp);
      if (a && a.running && a.since) {
        addTime(emp, zones.get(a.zoneKey), Date.parse(a.since), Date.parse(at));
        a.running = false; a.since = null;
      }
    };
    const note = (z, e, text) => { if (text) z.notes.push({ by: e.employee, at: e.at, text, status: z.base }); };
    for (const e of planEvents(plan, events)) {
      const z = e.action === 'move' ? zones.get(e.toKey) : zones.get(e.zoneKey || e.toKey);
      const emp = e.employee;
      const touch = (zone) => { if (zone) { zone.lastWorker = emp; zone.lastAt = e.at; } };
      switch (e.action) {
        case 'start': {
          if (!z || people.get(emp)?.zoneKey) break;
          people.set(emp, { zoneKey: z.key, running: true, since: e.at });
          st(emp).order.push(z.key);
          z.workers[emp] = 'running'; touch(z); settle(z);
          break;
        }
        case 'pause': {
          const a = people.get(emp);
          if (!a || !a.running) break;
          st(emp).pauses++;
          closeInterval(emp, e.at);
          const pz = zones.get(a.zoneKey); pz.workers[emp] = 'paused'; touch(pz); settle(pz);
          break;
        }
        case 'resume': {
          const a = people.get(emp);
          if (!a || a.running) break;
          a.running = true; a.since = e.at;
          const rz = zones.get(a.zoneKey); rz.workers[emp] = 'running'; touch(rz); settle(rz);
          break;
        }
        case 'finish': {
          const a = people.get(emp);
          if (!a) break;
          closeInterval(emp, e.at);
          const fz = zones.get(a.zoneKey);
          delete fz.workers[emp]; fz.base = S.COMPLETE; fz.completedBy = emp; fz.completedAt = e.at; st(emp).completed.push(fz.key); touch(fz); settle(fz);
          people.delete(emp);
          break;
        }
        case 'move': {
          const a = people.get(emp);
          if (a) {
            closeInterval(emp, e.at);
            const sz = zones.get(a.zoneKey);
            delete sz.workers[emp]; sz.moves++;
            sz.base = e.disposition === 'completed' ? S.COMPLETE : e.disposition === 'partial' ? S.PARTIAL : (sz.base === S.PARTIAL ? S.PARTIAL : S.NOT_STARTED);
            if (e.disposition === 'completed') { sz.completedBy = emp; sz.completedAt = e.at; st(emp).completed.push(sz.key); }
            note(sz, e, e.note); touch(sz); settle(sz);
            people.delete(emp);
          }
          if (z && e.toKey) {
            people.set(emp, { zoneKey: z.key, running: true, since: e.at });
            st(emp).order.push(z.key);
            z.workers[emp] = 'running'; touch(z); settle(z);
          }
          break;
        }
        case 'flag': if (z) { st(emp).flags++; z.issues.push({ by: emp, at: e.at, text: e.note || '' }); touch(z); } break;
        case 'verify': if (z && complete(z.base)) { z.base = S.VERIFIED; z.verifiedBy = e.actor || emp; z.verifiedAt = e.at; settle(z); } break;
        case 'defer': if (z) { z.deferred = { by: e.actor, at: e.at, note: e.note }; } break;
        default: break;
      }
      log.push(e);
    }
    // Provisional elapsed time for work running right now (only counted from an explicit start/resume).
    for (const [emp, a] of people) {
      if (a.running && a.since) {
        addTime(emp, zones.get(a.zoneKey), Date.parse(a.since), now);
      }
    }
    const who = {};
    for (const [emp, a] of people) who[emp] = { zoneKey: a.zoneKey, running: a.running };
    return { zones, people: who, stats, log };
  }

  const statusOf = (prog, key) => prog.zones.get(key)?.status || S.NOT_STARTED;

  /* ---------- explicit actions: validated, idempotent, appended to the log ---------- */

  function suggestNext(plan, prog, employee, afterKey) {
    const r = routeOf(plan, employee);
    if (!r) return null;
    const order = r.zoneKeys;
    const start = Math.max(0, order.indexOf(afterKey) + 1);
    const rotated = [...order.slice(start), ...order.slice(0, start)];
    return rotated.find((k) => k !== afterKey && [S.NOT_STARTED, S.PARTIAL].includes(prog.zones.get(k)?.base) && !prog.zones.get(k)?.workers[employee]) || null;
  }

  /* req: { action, actor, actorIsManager, employee, opId, zoneKey, toKey, otherName, disposition, note, reason, ackCollab, confirm } */
  function check(plan, events, req, nowIso, opts) {
    const errors = [];
    const prog = progress(plan, events, nowIso, opts);
    const employee = req.employee || req.actor;
    const act = prog.people[employee] || null;
    const base = { prog, employee, errors, source: act, conflict: null, toKey: null, toName: null };
    const dup = req.opId && (events || []).some((e) => e.id === req.opId || e.opId === req.opId);
    if (dup) return { ...base, ok: true, duplicate: true };
    if (!plan.postedAt && !req.actorIsManager) errors.push('This recovery plan has not been posted by a manager yet.');
    if (req.actor !== employee && !req.actorIsManager) errors.push('You can only update your own route.');
    if (!routeOf(plan, employee) && !(act) && req.action !== 'verify' && req.action !== 'defer') errors.push(employee + ' has no recovery route in the plan for ' + plan.id + '.');
    const zones = allZones(plan, events);
    const zByKey = (k) => zones.find((z) => z.key === k);
    if (req.action === 'pause' && !(act && act.running)) errors.push('There is no running section to pause.');
    if (req.action === 'resume' && !(act && !act.running)) errors.push('There is no paused section to resume.');
    if (req.action === 'finish') {
      if (!act) errors.push('There is no active section to finish.');
      if (!req.confirm) errors.push('Confirm that this section is finished.');
    }
    if (req.action === 'flag') {
      if (!(act || req.zoneKey)) errors.push('Choose the section the issue is in.');
      if (!String(req.note || '').trim()) errors.push('Describe the stocking or safety issue.');
    }
    // Shift hours, breaks and register coverage: an employee cannot start, resume or change into work while reserved or off shift.
    // Pause and finish stay available so a break or the end of a shift can always be recorded. A manager correcting a record is audited instead.
    if (opts && opts.staff && ['start', 'move', 'resume'].includes(req.action) && !(req.actorIsManager && req.actor !== employee)) {
      const a = availabilityNow(plan.id, opts.staff.find((s) => s.name === employee), nowIso);
      if (a.state !== 'free') errors.push(a.text);
    }
    if (req.action === 'start' || req.action === 'move') {
      if (req.action === 'start' && act) errors.push('Finish or change your current section first.');
      if (req.action === 'move' && !act) errors.push('You have no active section; use Start for a new section.');
      // mandatory named destination
      let toKey = req.toKey || '';
      let toName = '';
      if (toKey === 'other') {
        toName = String(req.otherName || '').trim();
        if (!toName) errors.push('Other needs a specific aisle or section name.');
        else if (GENERIC_DESTINATION.test(toName)) errors.push('“' + toName + '” is not a destination. Enter the specific aisle or section name.');
        else { toKey = 'adhoc-' + slug(toName); const existing = zones.find((z) => slug(z.name) === slug(toName)); if (existing) toKey = existing.key; }
      } else if (!toKey) errors.push('Choose a named destination section.');
      else if (!zByKey(toKey)) errors.push('Unknown destination section.');
      if (toKey && act && act.zoneKey === toKey) errors.push('That is already your current section.');
      if (toKey && toKey !== 'other') {
        const st = prog.zones.get(toKey);
        if (st && complete(st.base)) errors.push('That section is already complete. A manager can add a new dated pass if it needs recovery again.');
        const others = st ? Object.keys(st.workers).filter((n) => n !== employee) : [];
        if (others.length) {
          base.conflict = { zoneKey: toKey, by: others };
          if (!req.ackCollab) errors.push('Already in progress by ' + others.join(', ') + '. Choose another section or acknowledge you are collaborating.');
        }
      }
      base.toKey = toKey; base.toName = toName || zByKey(toKey)?.name || '';
      if (req.action === 'move' && act) {
        if (!['completed', 'partial', 'notstarted'].includes(req.disposition)) errors.push('Record the status of ' + (zByKey(act.zoneKey)?.name || 'your current section') + ': Completed, Partially recovered or Not started.');
        else if (req.disposition !== 'completed' && !String(req.note || '').trim()) errors.push('Add a short note of what remains in ' + (zByKey(act.zoneKey)?.name || 'your current section') + '.');
      }
    }
    if (req.action === 'verify') {
      if (!req.actorIsManager) errors.push('Only a manager can record MOD verification.');
      const st = prog.zones.get(req.zoneKey);
      if (!st || !complete(st.base) || st.base === S.VERIFIED) errors.push('Only an Employee complete section can be MOD verified.');
    }
    if (req.action === 'defer') {
      if (!req.actorIsManager) errors.push('Only a manager can defer a section.');
      if (!String(req.note || '').trim()) errors.push('A deferral needs a manager note.');
      const st = prog.zones.get(req.zoneKey);
      if (!st || complete(st.base)) errors.push('Only an unfinished section can be deferred.');
    }
    return { ...base, ok: errors.length === 0, duplicate: false };
  }

  function record(plan, events, req, nowIso, opts) {
    const at = nowIso || new Date().toISOString();
    const result = check(plan, events, req, at, opts);
    if (result.duplicate) return { ok: true, duplicate: true, events, errors: [] };
    if (!result.ok) return { ok: false, errors: result.errors, conflict: result.conflict, events, source: result.source };
    const employee = result.employee;
    const act = result.source;
    const e = {
      id: req.opId || ('ev:' + plan.id + ':' + employee + ':' + at + ':' + (events || []).length), opId: req.opId || null,
      planId: plan.id, at, action: req.action, actor: req.actor, byManager: !!(req.actorIsManager && req.actor !== employee), employee,
      zoneKey: req.zoneKey || act?.zoneKey || '', fromKey: act?.zoneKey || '', toKey: result.toKey || '', toName: req.toKey === 'other' ? result.toName : '',
      disposition: req.action === 'move' ? req.disposition : '', note: String(req.note || '').trim(), reason: String(req.reason || '').trim(),
      collaboration: !!(result.conflict && req.ackCollab), routeId: routeOf(plan, employee)?.id || ''
    };
    if (req.action === 'finish') e.disposition = 'completed';
    if (req.action === 'start') e.zoneKey = result.toKey;
    const next = [...(events || []), e];
    const prog = progress(plan, next, at, opts);
    const out = { ok: true, duplicate: false, events: next, event: e, errors: [] };
    if (req.action === 'finish') out.suggestNext = suggestNext(plan, prog, employee, e.zoneKey);
    return out;
  }

  /* ---------- handoff, review and carryover ---------- */

  function unfinished(plan, events, nowIso) {
    const prog = progress(plan, events, nowIso);
    return allZones(plan, events).map((z) => ({ z, p: prog.zones.get(z.key) }))
      .filter(({ p }) => p && unfinishedStatus(p.status) && !p.deferred)
      .map(({ z, p }) => ({ key: z.key, name: z.name, status: p.status, base: p.base, lastWorker: p.lastWorker, lastAt: p.lastAt, notes: p.notes.map((n) => n.text), issues: p.issues.map((i) => i.text), carryOrigin: z.carryOrigin || null, instruction: z.instruction, department: z.department }));
  }

  function deferredList(plan, events, nowIso) {
    const prog = progress(plan, events, nowIso);
    return allZones(plan, events).map((z) => ({ z, p: prog.zones.get(z.key) })).filter(({ p }) => p?.deferred && !complete(p.base)).map(({ z, p }) => ({ key: z.key, name: z.name, note: p.deferred.note, by: p.deferred.by, at: p.deferred.at }));
  }

  function handoffLines(plan, events, nowIso) {
    return unfinished(plan, events, nowIso).map((u) => u.name + ' — ' + u.status + (u.lastWorker ? ' (last: ' + u.lastWorker + ')' : '') + (u.notes.length ? ': ' + u.notes.join('; ') : '') + (u.issues.length ? ' · Issues: ' + u.issues.join('; ') : ''));
  }

  /* Off-shift or former-staff owners are flagged for the manager. Nothing is silently reassigned and signed or completed work is kept. */
  function reviewPlan(plan, ctx) {
    const staff = eligibleStaff(plan.id, ctx);
    const out = [];
    if (plan.scheduleSig !== undefined && plan.scheduleSig !== P.signature(plan.id, ctx.schedule || [], ctx.team || [])) out.push({ type: 'schedule', text: 'The imported schedule for ' + plan.id + ' changed since this recovery plan was prepared.' });
    for (const r of plan.routes) {
      const s = staff.find((x) => x.name === r.owner);
      if (!s) out.push({ type: 'offshift', owner: r.owner, text: r.owner + ' is not scheduled from 5 p.m. to close on ' + plan.id + '. Review ' + r.zoneKeys.length + ' section(s).' });
      else if (!s.available) out.push({ type: 'unavailable', owner: r.owner, text: r.owner + ' has no free time after 5 p.m. (reserved duties).' });
      else if (!s.free.some((w) => P.mins(r.start) >= w.start && P.mins(r.start) < w.end)) out.push({ type: 'start', owner: r.owner, text: r.owner + ' start ' + r.start + ' is outside their free time (' + s.free.map((w) => hhmm(w.start) + '–' + hhmm(w.end)).join(', ') + '), which excludes breaks, coverage and shift hours.' });
    }
    return out;
  }

  /* Manager-facing timing flags from recorded activity. Nothing is changed or reassigned automatically. */
  function timingIssues(plan, events, nowIso, opts) {
    const prog = progress(plan, events, nowIso, opts);
    const zones = allZones(plan, events);
    const nm = (k) => zones.find((z) => z.key === k)?.name || k;
    const out = [];
    for (const [emp, a] of Object.entries(prog.people)) {
      if (!a.running || !(opts && opts.staff)) continue;
      const av = availabilityNow(plan.id, opts.staff.find((s) => s.name === emp), nowIso);
      if (av.state === 'reserved') out.push({ type: 'running-reserved', employee: emp, text: emp + ' still has ' + nm(a.zoneKey) + ' running during ' + av.reason + '. That time is excluded from recovery time.' });
      else if (av.state === 'after') out.push({ type: 'running-after-shift', employee: emp, text: emp + ' still has ' + nm(a.zoneKey) + ' running after their shift ended. That time is excluded from recovery time.' });
    }
    for (const [emp, s] of Object.entries(prog.stats)) {
      if (s.outsideMs >= 60000) out.push({ type: 'excluded', employee: emp, text: Math.round(s.outsideMs / 60000) + ' min of ' + emp + '’s recorded time fell during breaks, coverage or outside the shift and is excluded.' });
    }
    return out;
  }

  /* Next scheduled day's draft from the previous day's RECORDED progress.
     Partially recovered (including work left in progress) first, then not-started; deferred and completed work is not carried.
     Stable carry-origin ids guarantee rebuilding or reprinting never duplicates the same unfinished section. */
  function carryoverItems(prevPlan, prevEvents, nowIso) {
    if (!prevPlan) return [];
    const list = unfinished(prevPlan, prevEvents, nowIso);
    const routeOrder = (key) => { const r = prevPlan.routes.find((x) => x.zoneKeys.includes(key)); return r ? r.zoneKeys.indexOf(key) : 999; };
    const tier = (u) => (u.base === S.NOT_STARTED && u.status === S.NOT_STARTED ? 1 : 0);
    return list.map((u) => ({
      u,
      zone: {
        key: 'carry:' + prevPlan.id + ':' + u.key,
        name: u.name,
        instruction: u.instruction,
        department: u.department,
        carryOrigin: { planId: prevPlan.id, zoneKey: u.key, zoneId: zoneId(prevPlan.id, u.key), rootPlanId: u.carryOrigin?.rootPlanId || u.carryOrigin?.planId || prevPlan.id, rootZoneKey: u.carryOrigin?.rootZoneKey || u.carryOrigin?.zoneKey || u.key },
        carry: { status: u.status, lastWorker: u.lastWorker, lastAt: u.lastAt, notes: u.notes, issues: u.issues }
      }
    })).sort((a, b) => tier(a.u) - tier(b.u) || routeOrder(a.u.key) - routeOrder(b.u.key));
  }

  function applyCarryover(plan, prevPlan, prevEvents, nowIso) {
    let next = clone(plan);
    const items = carryoverItems(prevPlan, prevEvents, nowIso);
    let added = 0;
    for (const { zone } of items) {
      const originId = zone.carryOrigin.zoneId;
      if (next.zones.some((z) => z.carryOrigin?.zoneId === originId)) continue; // idempotent: one follow-up per originating section
      const res = addZone(next, zone.name, { key: zone.key, instruction: zone.instruction, department: zone.department, carryOrigin: zone.carryOrigin, carry: zone.carry });
      if (res.ok) { next = res.plan; added++; }
    }
    next.carriedFrom = prevPlan ? prevPlan.id : next.carriedFrom;
    // Carryover goes in front of any other sections, partial first, then not-started, in the manager's route order.
    const carryKeys = items.map((i) => i.zone.key).filter((k) => next.zones.some((z) => z.key === k));
    const carried = carryKeys.map((k) => next.zones.find((z) => z.key === k));
    next.zones = [...carried, ...next.zones.filter((z) => !carryKeys.includes(z.key))];
    const firstNotStarted = items.find((i) => i.u.base === S.NOT_STARTED && i.u.status === S.NOT_STARTED);
    next.suggestedNextKey = firstNotStarted ? firstNotStarted.zone.key : null;
    return { plan: next, added, items };
  }

  /* Prepare a dated plan for the next scheduled day: only that day's active scheduled staff are used. */
  function prepareNextDay(prevPlan, prevEvents, date, ctx) {
    const old = ctx.old || null;
    let plan = old ? clone(old) : newPlan(date, ctx);
    if (!old) { plan.zones = []; plan.routes = []; plan.starterApplied = false; } // the starter example is for a fresh plan, not a continuation
    const res = applyCarryover(plan, prevPlan, prevEvents, ctx.now);
    plan = res.plan;
    const prefer = {};
    for (const { zone } of res.items) if (zone.carry.lastWorker) prefer[zone.key] = zone.carry.lastWorker;
    plan = suggestOwners(plan, ctx, prefer);
    if (!prevPlan) plan.gaps.push('No recovery record exists for the previous day. Nothing was guessed; build the route manually.');
    if (prevPlan && !res.items.length) plan.gaps.push('The previous route has no unfinished sections. Add a new dated pass if recovery is still needed.');
    return { plan, added: res.added, items: res.items };
  }

  /* A previously completed section is recovered again as a clearly dated NEW pass; old completion is never reused. */
  function addNewPass(plan, name, ctx) {
    const base = slug(name);
    const passes = plan.zones.filter((z) => z.key === base || z.key.startsWith(base + ':pass')).length;
    const key = passes ? base + ':pass' + (passes + 1) : base;
    const res = addZone(plan, name, { key, pass: passes + 1 });
    if (!res.ok) return res;
    res.plan.zones[res.plan.zones.length - 1].name = name + ' (new pass ' + plan.id + ')';
    return { ok: true, plan: res.plan, key };
  }

  function canRemoveZone(plan, events, key) {
    return !(events || []).some((e) => e.planId === plan.id && (e.zoneKey === key || e.toKey === key || e.fromKey === key));
  }
  function removeZone(plan, events, key) {
    if (!canRemoveZone(plan, events, key)) return { ok: false, error: 'This section already has recorded activity and is kept for history.' };
    const next = clone(plan);
    next.zones = next.zones.filter((z) => z.key !== key);
    for (const r of next.routes) r.zoneKeys = r.zoneKeys.filter((k) => k !== key);
    next.routes = next.routes.filter((r) => r.zoneKeys.length);
    return { ok: true, plan: next };
  }

  return {
    START, S, DISPOSITIONS, DEFAULT_INSTRUCTION, STARTER, GENERIC_DESTINATION, slug,
    eligibleStaff, newPlan, addZone, removeZone, canRemoveZone, suggestOwners, assignZone, unassignZone, reorderZone, setRouteStart,
    availabilityNow, windowsMap, timingIssues, allZones, progress, statusOf, check, record, suggestNext, unfinished, deferredList, handoffLines, reviewPlan,
    carryoverItems, applyCarryover, prepareNextDay, addNewPass, routeOf, zoneOf, zoneId, routeId
  };
});
