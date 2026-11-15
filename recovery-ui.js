/* Guided Recovery view: manager setup/posting/progress and the staff route flow.
   Uses the existing board state, saveState() and sync; no new service, account or tracking. */
(function () {
  'use strict';
  const R = window.StoreFlowRecovery;
  const P = window.StoreFlowPlanner;
  const host = document.querySelector('#recoveryView');
  if (!host || !R) return;
  const h = escapeHtml;
  const S = R.S;
  const PENDING_KEY = 'storeflow-recovery-pending';
  const LIMITATION = 'Alerts appear only while StoreFlow is open on this device. Background and locked-phone delivery is not enabled and has not been phone-tested, so keep the app open; the banner on this page is the fallback.';

  let selectedDate = ops.dateKey();
  let ui = { mode: null, fields: {}, errors: [], opId: '', notice: '' };
  let saveError = '';
  let deferNotes = {};
  let conflictCount = 0;
  const firedDue = new Set();

  const plans = () => (state.recoveryPlans ||= []);
  const events = () => (state.recoveryEvents ||= []);
  const current = () => plans().find((p) => p.id === selectedDate) || null;
  const me = () => currentAccess.member || '';
  const isMgr = () => canUseManagerTools();
  const nowIso = () => new Date().toISOString();
  const newOp = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'op-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  /* Shift hours, breaks and register coverage for a date. Passed to the core so work can only start inside free time. */
  const timingFor = (date) => { const staff = R.eligibleStaff(date, ctx(date)); return { staff, windows: R.windowsMap(date, staff) }; };
  const dailyPlan = (date) => (state.dailyPlans || []).find((p) => p.id === date) || null;
  const ctx = (date) => ({ schedule: state.schedule, team: state.team, dailyPlan: dailyPlan(date || selectedDate), now: nowIso() });

  function pendingIds() { try { return new Set(JSON.parse(localStorage.getItem(PENDING_KEY) || '[]')); } catch { return new Set(); } }
  function setPending(set) { try { localStorage.setItem(PENDING_KEY, JSON.stringify([...set])); } catch { /* storage full: sync status still shows plain events */ } }
  function markPending(id) { const s = pendingIds(); s.add(id); setPending(s); }

  function persistPlan(plan) {
    const list = plans();
    const i = list.findIndex((p) => p.id === plan.id);
    plan.updatedAt = nowIso();
    if (i < 0) list.push(plan); else list[i] = plan;
    saveError = saveState() ? '' : 'Could not save the recovery plan on this device. Free space before leaving this page.';
  }
  function persistEvents(next, ids) {
    state.recoveryEvents = next;
    ids.forEach(markPending);
    saveError = saveState() ? '' : 'Could not save this change on the device. Do not close the page; free space and try again.';
  }

  const fmtTime = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(); };
  const mins = (ms) => Math.round(ms / 60000) + ' min';
  const label = (z) => h(z.name) + (z.carryOrigin ? ' <small>Carryover from ' + h(z.carryOrigin.planId) + '</small>' : '') + (z.adHoc ? ' <small>Added by ' + h(z.addedBy || 'staff') + '</small>' : '');
  const planStatus = (p) => (p.postedAt ? 'Posted to staff' : 'DRAFT — not posted');

  /* ---------- staff flow ---------- */

  function myRoute(plan) { return plan ? R.routeOf(plan, me()) : null; }

  function nextPlanned(plan, prog, who) {
    const r = R.routeOf(plan, who);
    if (!r) return null;
    const active = prog.people[who];
    if (active) return R.suggestNext(plan, prog, who, active.zoneKey);
    return r.zoneKeys.find((k) => [S.NOT_STARTED, S.PARTIAL].includes(prog.zones.get(k)?.base)) || null;
  }

  function destinationOptions(plan, evs, prog, who) {
    const zones = R.allZones(plan, evs);
    const active = prog.people[who];
    return zones.filter((z) => !active || z.key !== active.zoneKey).map((z) => {
      const st = prog.zones.get(z.key);
      const busy = st ? Object.keys(st.workers).filter((n) => n !== who) : [];
      const done = st && (st.base === S.COMPLETE || st.base === S.VERIFIED);
      return `<option value="${h(z.key)}" ${ui.fields.toKey === z.key ? 'selected' : ''} ${done ? 'disabled' : ''}>${h(z.name)} — ${h(st ? st.status : S.NOT_STARTED)}${busy.length ? ' (in progress: ' + h(busy.join(', ')) + ')' : ''}</option>`;
    }).join('');
  }

  function previewRequest(plan, who) {
    const f = ui.fields;
    return { action: ui.mode === 'change' ? 'move' : 'start', actor: who, employee: who, toKey: f.toKey || '', otherName: f.otherName || '', disposition: f.disposition || '', note: f.note || '', reason: f.reason || '', ackCollab: !!f.ackCollab };
  }

  function destinationForm(plan, evs, prog, who) {
    const active = prog.people[who];
    const src = active ? R.allZones(plan, evs).find((z) => z.key === active.zoneKey) : null;
    const f = ui.fields;
    const preview = R.check(plan, evs, { ...previewRequest(plan, who), opId: '' }, nowIso(), timingFor(plan.id));
    const conflict = preview.conflict;
    return `<form id="recoveryChange" class="recovery-form" novalidate>
<h4>${ui.mode === 'change' ? 'Change section' : 'Choose your next section'}</h4>
<label>Destination (required)<select data-field="toKey"><option value="">Choose a named section…</option>${destinationOptions(plan, evs, prog, who)}<option value="other" ${f.toKey === 'other' ? 'selected' : ''}>Other (type the aisle or section name)</option></select></label>
${f.toKey === 'other' ? `<label>Specific aisle or section name (required)<input data-field="otherName" value="${h(f.otherName || '')}" placeholder="e.g. Aisle 9 — Seasonal"></label>` : ''}
${conflict ? `<p class="recovery-conflict" role="alert"><b>${h(R.allZones(plan, evs).find((z) => z.key === conflict.zoneKey)?.name || 'This section')}</b> is already in progress by ${h(conflict.by.join(', '))}. Choose another section, or confirm you are collaborating.</p><label class="check-row"><input type="checkbox" data-field="ackCollab" ${f.ackCollab ? 'checked' : ''}>I am collaborating with ${h(conflict.by.join(', '))} (this does not change their assignment)</label>` : ''}
${src ? `<fieldset><legend>${h(src.name)} — what is its status? (required)</legend>${Object.entries(R.DISPOSITIONS).map(([k, v]) => `<label class="check-row"><input type="radio" name="disposition" data-field="disposition" value="${k}" ${f.disposition === k ? 'checked' : ''}>${h(v)}</label>`).join('')}</fieldset>
<label>${f.disposition === 'completed' ? 'Note (optional)' : 'What is left in ' + h(src.name) + '? (required unless Completed)'}<textarea data-field="note" rows="2" maxlength="300">${h(f.note || '')}</textarea></label>` : ''}
<label>Reason for the change (optional)<input data-field="reason" value="${h(f.reason || '')}" maxlength="200"></label>
${ui.errors.length ? `<ul class="recovery-errors" role="alert">${ui.errors.map((e) => '<li>' + h(e) + '</li>').join('')}</ul>` : ''}
<div class="actions-row"><button type="submit" class="primary-button" data-action="confirmChange">${ui.mode === 'change' ? 'Save change and start section' : 'Start section'}</button><button type="button" class="secondary-button" data-action="cancel">Cancel</button></div>
</form>`;
  }

  function staffPanel(plan, evs) {
    const who = me();
    const route = myRoute(plan);
    if (!who) return '<div class="panel recovery-staff"><p>Open StoreFlow with your name to see your recovery route.</p></div>';
    if (!plan || !plan.postedAt) return `<div class="panel recovery-staff"><h3>Your recovery route</h3><p>${plan ? 'The manager has not posted the recovery plan for ' + h(plan.id) + ' yet.' : 'No recovery plan for ' + h(selectedDate) + '.'}</p></div>`;
    if (!route) return `<div class="panel recovery-staff"><h3>Your recovery route</h3><p>You have no recovery route on ${h(plan.id)}.</p></div>`;
    const timing = timingFor(plan.id);
    const prog = R.progress(plan, evs, nowIso(), timing);
    const zones = R.allZones(plan, evs);
    const zone = (k) => zones.find((z) => z.key === k);
    const active = prog.people[who];
    const cur = active ? zone(active.zoneKey) : null;
    const nextKey = nextPlanned(plan, prog, who);
    const nxt = nextKey ? zone(nextKey) : null;
    const curSt = cur ? prog.zones.get(cur.key) : null;
    const rec = timing.staff.find((x) => x.name === who);
    const av = R.availabilityNow(plan.id, rec, nowIso());
    const free = av.state === 'free';
    const dis = free ? '' : ' disabled';
    const timingLine = timingNote(av);
    const dueNow = !evs.some((e) => e.planId === plan.id && e.employee === who) && route.start <= hhmmNow() && plan.id === ops.dateKey();
    const buttons = [];
    if (ui.mode === 'finish') {
      buttons.push(`<div class="recovery-form"><p><b>Finish ${h(cur?.name || '')}?</b> This marks it Employee complete. A manager verifies separately.</p><div class="actions-row"><button class="primary-button" data-action="confirmFinish">Yes, this section is finished</button><button class="secondary-button" data-action="cancel">Not yet</button></div></div>`);
    } else if (ui.mode === 'flag') {
      buttons.push(`<form id="recoveryFlag" class="recovery-form"><label>Issue in ${h(cur?.name || 'this section')} (stocking or safety)<textarea data-field="flagNote" rows="2">${h(ui.fields.flagNote || '')}</textarea></label>${ui.errors.length ? `<ul class="recovery-errors" role="alert">${ui.errors.map((e) => '<li>' + h(e) + '</li>').join('')}</ul>` : ''}<div class="actions-row"><button type="submit" class="primary-button" data-action="confirmFlag">Flag issue</button><button type="button" class="secondary-button" data-action="cancel">Cancel</button></div></form>`);
    } else if (ui.mode === 'change' || ui.mode === 'start') {
      buttons.push(destinationForm(plan, evs, prog, who));
    } else if (!active) {
      buttons.push(`<div class="actions-row">${nxt ? `<button class="primary-button" data-action="startNext" data-zone="${h(nxt.key)}"${dis}>Start ${h(nxt.name)}</button>` : ''}<button class="secondary-button" data-action="chooseOther"${dis}>Choose another section</button></div>`);
    } else {
      buttons.push(`<div class="actions-row"><button class="primary-button" data-action="finish">Finish section</button><button class="secondary-button" data-action="change"${dis}>Change section</button>${active.running ? '<button class="secondary-button" data-action="pause">Pause / break</button>' : `<button class="primary-button" data-action="resume"${dis}>Resume</button>`}<button class="secondary-button" data-action="flag">Flag issue</button></div>`);
    }
    const alertLine = saveError ? `<p class="recovery-errors" role="alert">${h(saveError)}</p>` : '';
    const suggestion = alertLine + (ui.notice ? `<p role="status" class="recovery-notice">${h(ui.notice)}</p>` : '');
    return `<div class="panel recovery-staff">
<h3>Your recovery route · ${h(plan.id)} · starts ${h(route.start)}</h3>
${dueNow ? `<p class="operations-alert recovery-due" role="status">Recovery is due now. Start ${h(nxt?.name || 'your first section')}.</p>` : ''}
${timingLine}<p class="form-hint">${h(LIMITATION)}</p>${suggestion}
<div class="recovery-now"><div><small>Current section</small><strong>${cur ? h(cur.name) + ' — ' + (active.running ? 'In progress' : 'Paused') : 'None'}</strong>${cur ? `<p>${h(cur.instruction)}</p><small>Recorded time ${mins(curSt.elapsedMs)}${active.running ? '' : ' (paused time is not counted)'}${curSt.outsideMs >= 60000 ? ' · ' + mins(curSt.outsideMs) + ' excluded (break, coverage or outside your shift)' : ''}</small>` : ''}</div>
<div><small>Next planned section</small><strong>${nxt ? h(nxt.name) : 'None left on your route'}</strong>${nxt ? `<p>${h(nxt.instruction)}</p>${prog.zones.get(nxt.key).notes.length ? '<small>Left from earlier today: ' + h(prog.zones.get(nxt.key).notes.map((n) => n.text).join('; ')) + '</small>' : ''}${carrySummary(nxt)}` : ''}</div></div>
${buttons.join('')}
<ol class="recovery-route">${route.zoneKeys.map((k) => { const z = zone(k); const st = prog.zones.get(k); return z ? `<li><b>${label(z)}</b> — ${h(st.status)}${st.issues.length ? ' · ⚑ ' + h(st.issues.map((i) => i.text).join('; ')) : ''}${carrySummary(z)}</li>` : ''; }).join('')}</ol>
${pendingLine(evs.filter((e) => e.employee === who && e.planId === plan.id))}
</div>`;
  }

  /* What the employee needs to know about their own shift, breaks and coverage before acting. */
  function timingNote(av) {
    if (av.state === 'free') {
      const nb = av.nextBusy;
      return `<p class="recovery-timing" role="status">You are free until ${h(av.until)}${nb ? ' — next reserved: ' + h(P.time(nb.start)) + '–' + h(P.time(nb.end)) + ' ' + h(nb.reason) + '. Pause or finish before then.' : '. Your shift ends at ' + h(av.shiftEnd) + '.'}</p>`;
    }
    return `<p class="recovery-timing recovery-conflict" role="alert">${h(av.text)}</p>`;
  }

  function carrySummary(z) {
    if (!z.carry) return '';
    const c = z.carry;
    return '<small>Carried over from ' + h(z.carryOrigin.planId) + ' · ' + h(c.status) + (c.lastWorker ? ' · last: ' + h(c.lastWorker) + ' ' + h(fmtTime(c.lastAt)) : '') + (c.notes.length ? ' · remaining: ' + h(c.notes.join('; ')) : '') + (c.issues.length ? ' · issues: ' + h(c.issues.join('; ')) : '') + '</small>';
  }

  function hhmmNow() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function pendingLine(evs) {
    const pend = pendingIds();
    const n = evs.filter((e) => pend.has(e.id)).length;
    return `<p class="recovery-sync" role="status">${n ? '⏳ ' + n + ' change(s) saved on this device, waiting to sync to the team board.' : evs.length ? '✓ All recorded changes are synced.' : ''}${conflictCount ? ' ⚠ The last sync reported ' + conflictCount + ' edit conflict(s). Managers: review before posting again.' : ''}</p>`;
  }

  /* ---------- manager view ---------- */

  function availabilityTable(staff, plan) {
    const rows = staff.map((s) => `<tr><td>${h(s.name)}</td><td>${h(s.role)}</td><td>${h(s.shiftText)}</td><td>${s.available ? h(s.from) : '<b>Unavailable</b>'}</td><td>${h(s.busy.map((b) => P.time(b.start) + '–' + P.time(b.end) + ' ' + b.reason).join('; ') || '—')}</td><td>${plan && R.routeOf(plan, s.name) ? R.routeOf(plan, s.name).zoneKeys.length + ' section(s)' : '—'}</td></tr>`).join('');
    return `<table class="recovery-table"><thead><tr><th>Employee</th><th>Role</th><th>Shift</th><th>Free from</th><th>Reserved duties kept in view</th><th>Route</th></tr></thead><tbody>${rows || '<tr><td colspan="6"><b>No active employee is scheduled from 5 p.m. to close.</b></td></tr>'}</tbody></table>`;
  }

  function freeLine(rec) {
    if (!rec) return '<p class="form-hint"><b>Not scheduled from 5 p.m. to close</b> — review this route.</p>';
    return '<p class="form-hint">Free: ' + (rec.free.map((w) => P.time(w.start) + '–' + P.time(w.end)).join(', ') || 'none') + (rec.busy.length ? ' · Reserved: ' + rec.busy.map((b) => P.time(b.start) + '–' + P.time(b.end) + ' ' + b.reason).join('; ') : '') + '</p>';
  }

  function ownerOptions(staff, value) {
    return '<option value="">Unassigned</option>' + staff.filter((s) => s.available).map((s) => `<option ${s.name === value ? 'selected' : ''}>${h(s.name)}</option>`).join('');
  }

  function zoneRow(plan, evs, prog, staff, z, owner, index, total) {
    const st = prog.zones.get(z.key);
    const removable = R.canRemoveZone(plan, evs, z.key);
    const next = st && (st.base === S.COMPLETE) ? `<button data-action="verify" data-zone="${h(z.key)}" class="secondary-button">MOD verify</button>` : '';
    return `<tr data-zone="${h(z.key)}"><td>${index + 1}</td><td><b>${label(z)}</b>${z.carry ? `<small>Last: ${h(z.carry.lastWorker || '—')} ${h(fmtDate(z.carry.lastAt))} ${h(fmtTime(z.carry.lastAt))}${z.carry.notes.length ? ' · Remaining: ' + h(z.carry.notes.join('; ')) : ''}${z.carry.issues.length ? ' · Issues: ' + h(z.carry.issues.join('; ')) : ''}</small>` : ''}
<input data-field="instruction" data-zone="${h(z.key)}" value="${h(z.instruction)}" aria-label="Instruction for ${h(z.name)}"></td>
<td><select data-field="assign" data-zone="${h(z.key)}" aria-label="Assign ${h(z.name)}">${ownerOptions(staff, owner)}</select>${!owner && plan.reasons?.[z.key] ? `<small><b>Unassigned:</b> ${h(plan.reasons[z.key])}</small>` : ''}</td>
<td>${h(st.status)}${st.lastWorker ? '<small>' + h(st.lastWorker) + '</small>' : ''}</td>
<td>${owner ? `<button data-action="up" data-zone="${h(z.key)}" data-owner="${h(owner)}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button data-action="down" data-zone="${h(z.key)}" data-owner="${h(owner)}" ${index === total - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>` : ''}${removable ? `<button data-action="remove" data-zone="${h(z.key)}">Remove</button>` : ''}${next}</td></tr>`;
  }

  function progressTable(plan, evs, prog) {
    const names = [...new Set([...plan.routes.map((r) => r.owner), ...Object.keys(prog.stats)])];
    const zones = R.allZones(plan, evs);
    const nm = (k) => zones.find((z) => z.key === k)?.name || k;
    const rows = names.map((n) => {
      const s = prog.stats[n] || { elapsedMs: 0, pauses: 0, order: [], completed: [], flags: 0 };
      const act = prog.people[n];
      const route = R.routeOf(plan, n);
      return `<tr><td>${h(n)}</td><td>${act ? h(nm(act.zoneKey)) + (act.running ? '' : ' (paused)') : '—'}</td><td>${h(s.completed.map(nm).join(', ') || '—')}</td><td>${h(s.order.map(nm).join(' → ') || 'No activity recorded')}</td><td>${s.pauses}</td><td>${mins(s.elapsedMs)}${s.outsideMs >= 60000 ? '<small>' + mins(s.outsideMs) + ' excluded (break, coverage or off shift)</small>' : ''}</td><td>${s.flags}</td><td>${h((route?.zoneKeys || []).filter((k) => !['Employee complete', 'MOD verified'].includes(prog.zones.get(k)?.status)).map(nm).join(', ') || '—')}</td></tr>`;
    }).join('');
    const moves = evs.filter((e) => e.planId === plan.id).slice().reverse().slice(0, 40).map((e) => `<li>${h(fmtTime(e.at))} · ${h(e.employee)}${e.byManager ? ' (by ' + h(e.actor) + ')' : ''} · ${h(e.action)}${e.fromKey ? ' · from ' + h(nm(e.fromKey)) : ''}${e.toKey ? ' → ' + h(e.toName || nm(e.toKey)) : ''}${e.disposition ? ' · ' + h(R.DISPOSITIONS[e.disposition] || e.disposition) : ''}${e.note ? ' · “' + h(e.note) + '”' : ''}${e.reason ? ' · reason: ' + h(e.reason) : ''}${e.collaboration ? ' · collaborating' : ''}${e.action === 'reassign' ? ' · ' + h(e.fromOwner || 'unassigned') + ' → ' + h(e.toOwner) : ''}${pendingIds().has(e.id) ? ' · ⏳ pending sync' : ''}</li>`).join('');
    return `<table class="recovery-table"><thead><tr><th>Employee</th><th>Current section</th><th>Completed</th><th>Actual order</th><th>Pauses</th><th>Recorded time</th><th>Issues</th><th>Unfinished</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No activity recorded yet.</td></tr>'}</tbody></table>
<details><summary>Activity log (${evs.filter((e) => e.planId === plan.id).length})</summary><ol class="recovery-log">${moves || '<li>None.</li>'}</ol></details>`;
  }

  function managerPanel(plan, evs) {
    const c = ctx();
    const staff = R.eligibleStaff(selectedDate, c);
    const timing = plan ? timingFor(plan.id) : null;
    const prog = plan ? R.progress(plan, evs, nowIso(), timing) : null;
    const timingFlags = plan ? R.timingIssues(plan, evs, nowIso(), timing) : [];
    const review = plan ? R.reviewPlan(plan, c) : [];
    const zones = plan ? R.allZones(plan, evs) : [];
    const owned = new Map();
    if (plan) plan.routes.forEach((r) => r.zoneKeys.forEach((k) => owned.set(k, r.owner)));
    const body = plan ? `
${plan.gaps?.length ? `<div class="planner-gaps"><b>Gaps / follow-up:</b><ul>${plan.gaps.map((g) => '<li>' + h(g) + '</li>').join('')}</ul></div>` : ''}
${review.length ? `<div class="planner-issues"><b>Review needed:</b><ul>${review.map((x) => '<li>' + h(x.text) + '</li>').join('')}</ul></div>` : ''}
${timingFlags.length ? `<div class="planner-issues" role="alert"><b>Timing — shift hours, breaks and coverage:</b><ul>${timingFlags.map((x) => '<li>' + h(x.text) + '</li>').join('')}</ul></div>` : ''}
${plan.starterApplied ? '<p class="form-hint">Starter example for Carlton (Water → Kitchen → Paper products → Pet aisle) is editable. It is an example route, not a verified store map or a permanent assignment.</p>' : ''}
${plan.routes.map((r) => `<section class="recovery-route-block"><h4>${h(r.owner)} <label>Start <input type="time" data-field="routeStart" data-owner="${h(r.owner)}" value="${h(r.start)}"></label></h4>${freeLine(staff.find((x) => x.name === r.owner))}
<table class="recovery-table"><thead><tr><th>#</th><th>Section and instruction</th><th>Assigned</th><th>Status</th><th>Order / actions</th></tr></thead><tbody>${r.zoneKeys.map((k, i) => { const z = zones.find((x) => x.key === k); return z ? zoneRow(plan, evs, prog, staff, z, r.owner, i, r.zoneKeys.length) : ''; }).join('')}</tbody></table></section>`).join('')}
${zones.some((z) => !owned.has(z.key)) ? `<section class="recovery-route-block"><h4>Unassigned sections</h4><table class="recovery-table"><thead><tr><th>#</th><th>Section and instruction</th><th>Assigned</th><th>Status</th><th>Actions</th></tr></thead><tbody>${zones.filter((z) => !owned.has(z.key)).map((z, i, a) => zoneRow(plan, evs, prog, staff, z, '', i, a.length)).join('')}</tbody></table></section>` : ''}
<form id="recoveryAddZone" class="recovery-form" novalidate><h4>Add a recovery section</h4><div class="two-col"><label>Section name<input data-field="zoneName" value="${h(ui.fields.zoneName || '')}" placeholder="e.g. Aisle 4 — Snacks"></label><label>Department / aisle label (optional)<input data-field="zoneDept" value="${h(ui.fields.zoneDept || '')}"></label></div><label>Store-specific direction (optional; default shown to staff otherwise)<input data-field="zoneInstruction" value="${h(ui.fields.zoneInstruction || '')}" placeholder="${h(R.DEFAULT_INSTRUCTION)}"></label>${ui.errors.length && ui.mode === 'addZone' ? `<ul class="recovery-errors" role="alert">${ui.errors.map((e) => '<li>' + h(e) + '</li>').join('')}</ul>` : ''}<div class="actions-row"><button type="submit" class="secondary-button" data-action="addZone">Add section</button></div></form>
<h4>Progress</h4>${progressTable(plan, evs, prog)}
${R.unfinished(plan, evs, nowIso()).length ? `<h4>Unfinished — stays on the handoff until completed or deferred</h4><ul class="recovery-unfinished">${R.unfinished(plan, evs, nowIso()).map((u) => `<li data-zone="${h(u.key)}"><b>${h(u.name)}</b> — ${h(u.status)}${u.lastWorker ? ' · last ' + h(u.lastWorker) : ''}${u.notes.length ? ' · ' + h(u.notes.join('; ')) : ''}${u.issues.length ? ' · issues: ' + h(u.issues.join('; ')) : ''} <input data-field="deferNote" data-zone="${h(u.key)}" placeholder="Manager note to defer" value="${h(deferNotes[u.key] || '')}"><button data-action="defer" data-zone="${h(u.key)}" class="secondary-button">Defer with note</button></li>`).join('')}</ul>` : ''}
${R.deferredList(plan, evs, nowIso()).length ? `<h4>Deferred</h4><ul>${R.deferredList(plan, evs, nowIso()).map((d) => `<li>${h(d.name)} — ${h(d.note)} (${h(d.by)})</li>`).join('')}</ul>` : ''}
<div class="actions-row"><label>New dated pass for a completed section<input data-field="passName" value="${h(ui.fields.passName || '')}" placeholder="Section name"></label><button data-action="newPass" class="secondary-button">Add new pass</button></div>
<div class="actions-row"><button class="primary-button" data-action="post">${plan.postedAt ? 'Re-post plan to staff' : 'Post reviewed plan to staff'}</button><button class="secondary-button" data-action="print">Print recovery plan</button></div>` : '<p>No recovery plan for this date yet. Prepare one from the schedule, or carry forward from the previous day.</p>';
    return `<div class="panel planner-controls recovery-controls">
<div class="panel-heading"><h3>Recovery Plan · Store 19891</h3><label>Plan date<input id="recoveryDate" data-field="date" type="date" value="${h(selectedDate)}"></label></div>
<div class="actions-row"><button class="primary-button" data-action="prepare">${plan ? 'Suggest owners for unassigned sections' : 'Prepare plan from schedule'}</button><button class="secondary-button" data-action="prepareNext">Prepare from previous day’s unfinished sections</button>${plan ? '' : ''}</div>
<p class="form-hint">Uses only active employees scheduled from 5 p.m. to close. Drafts are never posted automatically. ${h(LIMITATION)}</p>
${saveError ? `<p class="recovery-errors" role="alert">${h(saveError)}</p>` : ''}<p id="recoveryStatus" role="status">${plan ? h(planStatus(plan)) : 'No plan'} ${ui.notice ? '· ' + h(ui.notice) : ''}</p>
${availabilityTable(staff, plan)}${body}${plan ? pendingLine(evs.filter((e) => e.planId === plan.id)) : ''}</div>`;
  }

  /* ---------- printable plan (also embedded in the dated daily planner) ---------- */

  function printHtml(date, opts = {}) {
    const plan = plans().find((p) => p.id === date);
    if (!plan) return opts.embedded ? '' : '<p>No recovery plan for ' + h(date) + '.</p>';
    const evs = events();
    const c = ctx(date);
    const staff = R.eligibleStaff(date, c);
    const prog = R.progress(plan, evs, nowIso(), { staff, windows: R.windowsMap(date, staff) });
    const zones = R.allZones(plan, evs);
    const rows = (r) => r.zoneKeys.map((k, i) => { const z = zones.find((x) => x.key === k); const st = prog.zones.get(k); if (!z) return ''; return `<tr><td>${i + 1}</td><td><b>${h(z.name)}</b>${z.department ? ' <small>' + h(z.department) + '</small>' : ''}${z.carry ? `<small>CARRYOVER from ${h(z.carryOrigin.planId)} · last: ${h(z.carry.lastWorker || '—')} ${h(fmtDate(z.carry.lastAt))} ${h(fmtTime(z.carry.lastAt))}${z.carry.notes.length ? ' · remaining: ' + h(z.carry.notes.join('; ')) : ''}${z.carry.issues.length ? ' · issues: ' + h(z.carry.issues.join('; ')) : ''}</small>` : ''}</td><td>${h(z.instruction)}</td><td>${h(st.status)}${st.lastWorker && st.status !== S.NOT_STARTED ? '<small>' + h(st.lastWorker) + '</small>' : ''}</td><td>Progress: ☐ started ☐ partial ☐ done<br>Initials: _____ &nbsp; MOD: _____</td></tr>`; }).join('');
    const unassigned = zones.filter((z) => !plan.routes.some((r) => r.zoneKeys.includes(z.key)));
    const open = R.handoffLines(plan, evs, nowIso());
    const deferred = R.deferredList(plan, evs, nowIso());
    return `<section class="planner-section recovery-paper-section"${opts.embedded ? '' : ' id="recoveryPrintBody"'}><h3>Recovery 5 p.m. to close · ${h(date)} · ${h(plan.postedAt ? 'Posted' : 'DRAFT — not posted')}</h3>
<p>Planned route. Staff may change sections; each change records a named destination and the status of the section left. Alerts work only while the app is open.</p>
${(plan.gaps || []).length ? '<div class="planner-gaps"><b>Gaps:</b><ul>' + plan.gaps.map((g) => '<li>' + h(g) + '</li>').join('') + '</ul></div>' : ''}
<p><b>Staff and reserved duties:</b> ${staff.map((s) => h(s.name) + ' ' + h(s.shiftText) + (s.available ? ' (free from ' + h(s.from) + ')' : ' (unavailable)') + (s.busy.length ? ' — reserved: ' + h(s.busy.map((b) => P.time(b.start) + '–' + P.time(b.end) + ' ' + b.reason).join('; ')) : '')).join(' · ') || 'No scheduled staff after 5 p.m.'}</p>
${plan.routes.map((r) => `<table class="recovery-print-table"><caption>${h(r.owner)} · start ${h(r.start)} · free ${h((staff.find((x) => x.name === r.owner)?.free || []).map((w) => P.time(w.start) + '–' + P.time(w.end)).join(', ') || 'none')}</caption><colgroup><col style="width:4%"><col style="width:24%"><col style="width:32%"><col style="width:12%"><col style="width:28%"></colgroup><thead><tr><th>#</th><th>Section</th><th>Instruction</th><th>Status</th><th>Progress / verification</th></tr></thead><tbody>${rows(r)}</tbody></table>`).join('')}
${unassigned.length ? `<table class="recovery-print-table"><caption>UNASSIGNED sections</caption><colgroup><col style="width:4%"><col style="width:24%"><col style="width:32%"><col style="width:12%"><col style="width:28%"></colgroup><thead><tr><th>#</th><th>Section</th><th>Instruction</th><th>Status</th><th>Reason</th></tr></thead><tbody>${unassigned.map((z, i) => `<tr><td>${i + 1}</td><td><b>${h(z.name)}</b></td><td>${h(z.instruction)}</td><td>${h(prog.zones.get(z.key).status)}</td><td>${h(plan.reasons?.[z.key] || 'No owner chosen')}</td></tr>`).join('')}</tbody></table>` : ''}
<h4>Unfinished sections for the closing/opening handoff</h4>${open.length ? '<ul>' + open.map((l) => '<li>' + h(l) + '</li>').join('') + '</ul>' : '<p>None recorded.</p>'}
${deferred.length ? '<p><b>Deferred:</b> ' + deferred.map((d) => h(d.name) + ' — ' + h(d.note)).join('; ') + '</p>' : ''}
<p>Employee sign-off: __________ &nbsp; MOD verification: __________ &nbsp; Date/time: __________</p></section>`;
  }

  /* ---------- rendering ---------- */

  function render() {
    const plan = current();
    const evs = events();
    const parts = [];
    if (isMgr()) parts.push(managerPanel(plan, evs));
    if (!isMgr() || myRoute(plan)) parts.push(staffPanel(plan, evs));
    if (isMgr() && plan) parts.push(`<div id="recoveryPaper" class="recovery-paper planner-paper">${printHtml(selectedDate)}</div>`);
    host.innerHTML = parts.join('');
    updateBanner();
  }
  window.renderRecovery = render;

  /* ---------- explicit actions ---------- */

  function commit(req, success) {
    const plan = current();
    const out = R.record(plan, events(), { opId: ui.opId || newOp(), actor: me(), actorIsManager: isMgr(), ...req }, nowIso(), timingFor(plan.id));
    if (!out.ok) { ui.errors = out.errors; return false; }
    if (!out.duplicate) persistEvents(out.events, [out.event.id]);
    ui.errors = []; ui.fields = {}; ui.mode = null; ui.opId = '';
    ui.notice = success || '';
    if (out.suggestNext) {
      const z = R.allZones(plan, events()).find((x) => x.key === out.suggestNext);
      ui.notice = (success || '') + ' Next suggested section: ' + (z ? z.name : out.suggestNext) + '.';
    }
    return true;
  }

  function open(mode) { ui = { mode, fields: {}, errors: [], opId: newOp(), notice: '' }; }

  function actionOf(target) { return target?.dataset?.action || (typeof target?.closest === 'function' ? target.closest('[data-action]')?.dataset?.action : '') || ''; }
  function attr(target, name) { return target?.dataset?.[name] ?? (typeof target?.closest === 'function' ? target.closest('[data-' + name + ']')?.dataset?.[name] : undefined); }

  function doAction(action, target) {
    const plan = current();
    const evs = events();
    const who = me();
    const manager = isMgr();
    switch (action) {
      case 'prepare': {
        if (!manager) return;
        let next = plan;
        if (!next) next = R.newPlan(selectedDate, ctx());
        else next = R.suggestOwners(next, ctx());
        persistPlan(next);
        ui.notice = plan ? 'Suggestions filled for unassigned sections only.' : 'Draft prepared from the schedule. Nothing is posted.';
        break;
      }
      case 'prepareNext': {
        if (!manager) return;
        const earlier = plans().filter((p) => p.id < selectedDate).sort((a, b) => b.id.localeCompare(a.id))[0] || null;
        const out = R.prepareNextDay(earlier, evs, selectedDate, { ...ctx(), old: plan });
        persistPlan(out.plan);
        ui.notice = (out.added ? out.added + ' unfinished section(s) carried forward from ' + earlier.id + '.' : earlier ? 'No new sections to carry forward from ' + earlier.id + '.' : 'No earlier recovery plan found.') + ' Review before posting; nothing was posted.';
        break;
      }
      case 'post': {
        if (!manager || !plan) return;
        const issues = R.reviewPlan(plan, ctx()).filter((i) => i.type !== 'schedule');
        if (issues.length && typeof window.confirm === 'function' && !window.confirm('Post with these open review items?\n\n' + issues.map((i) => '• ' + i.text).join('\n'))) return;
        persistPlan({ ...plan, postedAt: nowIso(), status: 'posted', scheduleSig: P.signature(plan.id, state.schedule, state.team) });
        ui.notice = 'Posted to staff.';
        break;
      }
      case 'print': document.body.dataset.printMode = 'recovery'; window.print(); return;
      case 'addZone': {
        if (!manager || !plan) return;
        const res = R.addZone(plan, ui.fields.zoneName, { department: ui.fields.zoneDept, instruction: ui.fields.zoneInstruction });
        if (!res.ok) { ui.errors = [res.error]; ui.mode = 'addZone'; break; }
        persistPlan(res.plan);
        ui.fields = {}; ui.errors = []; ui.mode = null; ui.notice = 'Section added. Assign it to a scheduled employee.';
        break;
      }
      case 'remove': {
        if (!manager || !plan) return;
        const res = R.removeZone(plan, evs, attr(target, 'zone'));
        if (res.ok) persistPlan(res.plan); else ui.notice = res.error;
        break;
      }
      case 'up': case 'down': {
        if (!manager || !plan) return;
        persistPlan(R.reorderZone(plan, attr(target, 'owner'), attr(target, 'zone'), action === 'up' ? -1 : 1));
        break;
      }
      case 'verify': {
        if (!manager || !plan) return;
        commit({ action: 'verify', zoneKey: attr(target, 'zone'), employee: who }, 'MOD verification recorded.');
        break;
      }
      case 'defer': {
        if (!manager || !plan) return;
        const key = attr(target, 'zone');
        const ok = commit({ action: 'defer', zoneKey: key, employee: who, note: deferNotes[key] || '' }, 'Deferred with manager note.');
        if (ok) delete deferNotes[key];
        break;
      }
      case 'newPass': {
        if (!manager || !plan) return;
        const res = R.addNewPass(plan, String(ui.fields.passName || '').trim(), ctx());
        if (!res.ok) { ui.notice = res.error; break; }
        persistPlan(res.plan); ui.fields = {}; ui.notice = 'Dated new pass added. Assign it before posting.';
        break;
      }
      case 'startNext': ui.opId = newOp(); commit({ action: 'start', toKey: attr(target, 'zone') }, 'Section started.'); break;
      case 'chooseOther': open('start'); break;
      case 'change': open('change'); break;
      case 'pause': ui.opId = newOp(); commit({ action: 'pause' }, 'Paused. Break time is not counted as work time and the section stays yours.'); break;
      case 'resume': ui.opId = newOp(); commit({ action: 'resume' }, 'Resumed.'); break;
      case 'finish': open('finish'); break;
      case 'confirmFinish': commit({ action: 'finish', confirm: true }, 'Section marked Employee complete.'); break;
      case 'flag': open('flag'); break;
      case 'confirmFlag': commit({ action: 'flag', note: ui.fields.flagNote || '' }, 'Issue flagged.'); break;
      case 'confirmChange': {
        const active = R.progress(plan, evs, nowIso(), timingFor(plan.id)).people[who];
        commit({ action: active ? 'move' : 'start', toKey: ui.fields.toKey || '', otherName: ui.fields.otherName || '', disposition: ui.fields.disposition || '', note: ui.fields.note || '', reason: ui.fields.reason || '', ackCollab: !!ui.fields.ackCollab }, 'Route updated.');
        break;
      }
      case 'cancel': ui = { mode: null, fields: {}, errors: [], opId: '', notice: '' }; break;
      default: return;
    }
    render();
  }

  host.addEventListener('click', (event) => {
    const action = actionOf(event.target);
    if (!action) return;
    if (action === 'confirmChange' || action === 'confirmFlag' || action === 'addZone') { if (event.target.type === 'submit') return; } // submit handler runs it
    doAction(action, event.target);
  });
  host.addEventListener('submit', (event) => {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    const id = event.target?.id;
    if (id === 'recoveryChange') doAction('confirmChange', event.target);
    if (id === 'recoveryFlag') doAction('confirmFlag', event.target);
    if (id === 'recoveryAddZone') doAction('addZone', event.target);
  });
  const onField = (event) => {
    const el = event.target;
    const field = el?.dataset?.field;
    if (!field) return;
    const value = el.type === 'checkbox' ? !!el.checked : el.value;
    const plan = current();
    if (field === 'date') { if (ops.validDate(value)) selectedDate = value; ui = { mode: null, fields: {}, errors: [], opId: '', notice: '' }; render(); return; }
    if (field === 'deferNote') { deferNotes[el.dataset.zone] = value; return; }
    if (['instruction', 'assign', 'routeStart'].includes(field)) {
      if (!isMgr() || !plan) return;
      if (field === 'instruction') persistPlan({ ...plan, zones: plan.zones.map((z) => (z.key === el.dataset.zone ? { ...z, instruction: String(value).trim() || R.DEFAULT_INSTRUCTION } : z)) });
      if (field === 'assign') {
        if (!value) persistPlan(R.unassignZone(plan, el.dataset.zone));
        else {
          const res = R.assignZone(plan, el.dataset.zone, value, ctx(), me(), newOp());
          if (!res.ok) ui.notice = res.error;
          else { persistPlan(res.plan); if (res.event) persistEvents([...events(), res.event], [res.event.id]); ui.notice = ''; }
        }
      }
      if (field === 'routeStart') { const res = R.setRouteStart(plan, el.dataset.owner, value, ctx()); if (res.ok) persistPlan(res.plan); else ui.notice = res.error; }
      render();
      return;
    }
    ui.fields[field] = value;
    ui.errors = [];
    if (field === 'toKey' || field === 'disposition' || field === 'ackCollab') {
      if (field === 'toKey') ui.fields.ackCollab = false;
      render();
    }
  };
  host.addEventListener('change', onField);
  host.addEventListener('input', (event) => { if (event.target?.dataset?.field && ['otherName', 'note', 'reason', 'flagNote', 'zoneName', 'zoneDept', 'zoneInstruction', 'passName', 'deferNote'].includes(event.target.dataset.field)) onField(event); });
  window.addEventListener('afterprint', () => { if (document.body.dataset.printMode === 'recovery') delete document.body.dataset.printMode; });

  /* ---------- fallback banner and app-open alert ---------- */

  function dueInfo(now = new Date()) {
    const who = me();
    const date = ops.dateKey(now);
    const plan = plans().find((p) => p.id === date);
    if (!who || !plan || !plan.postedAt) return null;
    const route = R.routeOf(plan, who);
    if (!route) return null;
    if (events().some((e) => e.planId === plan.id && e.employee === who)) return null;
    // Due only while the employee is actually free (inside their shift, not on a break or register coverage) and at/after their start.
    const av = R.availabilityNow(plan.id, timingFor(plan.id).staff.find((s) => s.name === who), now.toISOString());
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (av.state !== 'free' || route.start > hhmm) return null;
    const first = R.allZones(plan, events()).find((z) => z.key === route.zoneKeys[0]);
    return { plan, route, zone: first };
  }

  function updateBanner(now) {
    const banner = document.querySelector('#recoveryDueBanner');
    if (!banner) return;
    const due = dueInfo(now);
    banner.hidden = !due;
    if (due) banner.textContent = 'Recovery due: start ' + (due.zone?.name || 'your first section') + ' (assigned ' + due.route.start + '). Open Guided Recovery.';
  }

  /* Called once a second by the app. The in-app banner always shows; the sound/notification only fires while the app is open and alerts are on. */
  function tick(now, post) {
    updateBanner(now);
    const due = dueInfo(now);
    if (!due || typeof post !== 'function') return;
    const id = 'recovery:' + due.plan.id + ':' + me();
    if (firedDue.has(id)) return;
    firedDue.add(id);
    post('Recovery time', 'Start ' + (due.zone?.name || 'your first section') + '. ' + (due.zone?.instruction || ''));
  }

  window.StoreFlowRecoveryUI = {
    printHtml, tick, render,
    markSynced() { setPending(new Set()); if (typeof host.classList === 'undefined' || host.classList.contains('active')) render(); },
    noteConflicts(n) { conflictCount = n || 0; render(); },
    _state: () => ({ ui, selectedDate })
  };
  if (typeof document.querySelectorAll === 'function') document.querySelectorAll('[data-view="recovery"]').forEach((b) => b.addEventListener('click', () => setTimeout(render, 0)));
  render();
})();
