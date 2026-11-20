const test=require('node:test');const assert=require('node:assert/strict');const P=require('../planner-core.js');
const team=[{name:'Chris C.',role:'Store Manager'},{name:'Nathan H.',role:'Sales Associate'}];
const schedule=team.map(t=>({date:'2026-11-12',name:t.name,start:'08:00',end:'18:00'}));
test('photographed delivery, scanning and fresh cadence',()=>{assert.equal(P.dayWorkflow('2026-11-12').code,'T-Day');assert.match(P.dayWorkflow('2026-11-11').workflow,/Nones & Tons/);assert.match(P.dayWorkflow('2026-11-13').freshTruck,/receive truck/);assert.match(P.dayWorkflow('2026-11-10').freshTruck,/receive truck/);assert.equal(P.dayWorkflow('2026-11-14').code,'T+2 / P+4');});
test('assign only within published shifts and leadership roles, avoid reserved coverage',()=>{const shifts=P.roster('2026-11-12',schedule,team);const blocks=[{name:'Nathan H.',start:'08:00',end:'12:00'}];const result=P.assign(P.templates('2026-11-12'),shifts,blocks);assert.deepEqual(P.validate(result,shifts,blocks),[]);assert.ok(result.filter(e=>e.lead).every(e=>e.owner==='Chris C.'));assert.ok(result.filter(e=>e.owner==='Nathan H.').every(e=>P.mins(e.start)>=720));});
test('no staff or capacity leaves work unassigned',()=>{assert.ok(P.assign(P.templates('2026-11-12'),[]).every(e=>!e.owner));const shifts=P.roster('2026-11-12',[{...schedule[0],end:'08:15'}],team);assert.ok(P.assign(P.templates('2026-11-12'),shifts).some(e=>!e.owner));});
test('Driveline work bypasses staff assignment and validation',()=>{const e={key:'vendor',title:'Driveline seasonal reset',minutes:30};assert.equal(P.isDriveline(e),true);assert.equal(P.assign([e],P.roster('2026-11-12',schedule,team))[0].owner,'');assert.deepEqual(P.validate([e],[]),[]);});
test('signed rows are preserved and occupy their block',()=>{const fixed={key:'fixed',title:'Signed task',owner:'Chris C.',start:'08:00',end:'09:00',minutes:60,initials:'CC'};const other={key:'new',title:'New',minutes:30,lead:true};const result=P.assign([fixed,other],P.roster('2026-11-12',schedule,team));assert.deepEqual(result[0],fixed);assert.ok(P.mins(result[1].start)>=540);});
test('validation catches invalid manual assignments and overlapping tasks',()=>{const shifts=P.roster('2026-11-12',schedule,team);const entries=[{key:'a',title:'a',owner:'Nathan H.',start:'07:00',end:'09:00',minutes:30,lead:true},{key:'b',title:'b',owner:'Nathan H.',start:'08:00',end:'09:00',minutes:30}];assert.ok(P.validate(entries,shifts).some(x=>x.includes('outside')));assert.ok(P.validate(entries,shifts).some(x=>x.includes('overlapping')));});
test('departed staff (Louis, Alicia, Jeff) never enter the planner roster',()=>{const withFormer=[...schedule,{date:'2026-11-12',name:'Louis C.',start:'08:00',end:'18:00'},{date:'2026-11-12',name:'Alicia',start:'08:00',end:'18:00'},{date:'2026-11-12',name:'Jeff',start:'08:00',end:'18:00'}];const names=P.roster('2026-11-12',withFormer,team).map(s=>s.name);assert.ok(!names.some(n=>/^(louis|alicia|jeff)/i.test(n)));assert.equal(names.length,P.roster('2026-11-12',schedule,team).length);});

const team2=[{name:'Chris C.',role:'Store Manager'},{name:'Sanah I.',role:'Assistant Store Manager'},{name:'Blaire M.',role:'Key Holder'},{name:'Nathan H.',role:'Sales Associate'},{name:'Dominic S.',role:'Sales Associate'}];
const sched2=(date,names,start='08:00',end='20:00')=>names.map(name=>({name,date,start,end}));
test('baseline draft from shifts only, with MOD suggested and Compass pending; none for dates without shifts',()=>{const schedule=sched2('2026-11-15',['Sanah I.','Blaire M.','Nathan H.']);const plan=P.buildPlan('2026-11-15',{schedule,team:team2,tasks:[]});assert.equal(plan.openingMod,'Sanah I.');assert.equal(P.status(plan),'draft');assert.equal(plan.compassReviewed,false);assert.equal(plan.postedAt,null);assert.equal(P.buildPlan('2026-11-16',{schedule,team:team2}),null);});
test('a day Chris is off still suggests scheduled leadership; no leadership stays visibly unassigned',()=>{const off=P.buildPlan('2026-11-15',{schedule:sched2('2026-11-15',['Blaire M.','Nathan H.']),team:team2});assert.equal(off.openingMod,'Blaire M.');assert.equal(off.closingMod,'Blaire M.');const none=P.buildPlan('2026-11-15',{schedule:sched2('2026-11-15',['Nathan H.','Dominic S.']),team:team2});assert.equal(none.openingMod,'');assert.ok(none.gaps.some(g=>/No scheduled leadership/.test(g)));assert.ok(none.entries.filter(e=>e.lead).every(e=>!e.owner&&e.reason));});
test('prepareWeek covers Saturday–Friday with one allocator: no double booking, gaps reported, existing plans untouched',()=>{const dates=P.weekDates('2026-11-18');assert.equal(dates[0],'2026-11-14');assert.equal(dates[6],'2026-11-20');const schedule=[...sched2('2026-11-14',['Chris C.','Nathan H.']),...sched2('2026-11-15',['Sanah I.','Dominic S.']),...sched2('2026-11-17',['Chris C.','Blaire M.','Nathan H.'])];const existing={id:'2026-11-14',entries:[{key:'clean-office',owner:'Chris C.',initials:'CC'}],marker:'keep'};const r=P.prepareWeek('2026-11-18',{schedule,team:team2,tasks:[],plans:[existing]});assert.deepEqual(r.kept,['2026-11-14']);assert.deepEqual(r.plans.map(p=>p.id),['2026-11-15','2026-11-17']);assert.deepEqual(r.gaps.map(g=>g.date),['2026-11-16','2026-11-18','2026-11-19','2026-11-20']);for(const p of r.plans){const shifts=P.roster(p.id,schedule,team2);assert.deepEqual(P.validate(p.entries,shifts,p.blocks).filter(x=>/overlapping/.test(x)),[]);assert.ok(p.entries.filter(e=>e.section==='Cleaning').every(e=>e.owner));}assert.equal(existing.marker,'keep');});
test('refresh keeps signed/completed/manual rows, flags off-shift owners and schedule changes, never uses Louis',()=>{const schedule=[...sched2('2026-11-15',['Chris C.','Nathan H.','Dominic S.']),{name:'Louis C.',date:'2026-11-15',start:'08:00',end:'20:00'}];const plan=P.buildPlan('2026-11-15',{schedule,team:[...team2,{name:'Louis C.',role:'Sales Associate'}]});assert.ok(plan.entries.every(e=>e.owner!=='Louis C.'));const row=plan.entries.find(e=>e.key==='clean-floors');row.initials='ND';row.manual=true;const changed=schedule.filter(s=>s.name!==row.owner);assert.ok(P.reviewIssues(plan,{schedule:changed,team:team2}).some(x=>x.type==='schedule'));assert.ok(P.reviewIssues(plan,{schedule:changed,team:team2}).some(x=>x.type==='offshift'&&x.key==='clean-floors'&&x.fixed));const next=P.buildPlan('2026-11-15',{schedule:changed,team:team2,old:plan});const kept=next.entries.find(e=>e.key==='clean-floors');assert.equal(kept.owner,row.owner);assert.equal(kept.initials,'ND');const former=P.buildPlan('2026-11-15',{schedule:[{name:'Louis C.',date:'2026-11-15',start:'08:00',end:'20:00'}],team:team2});assert.equal(former,null);});

/* ---- SM Thursday checklist ---- */
const thuTeam=[{name:'Chris C.',role:'Store Manager'},{name:'Sanah I.',role:'Assistant Store Manager'},{name:'Nathan H.',role:'Sales Associate'}];
const mk=(date,names)=>names.map(name=>({date,name,start:'08:00',end:'18:00'}));
test('Thursday plan gets the five-report checklist; other days do not',()=>{
  const thu=P.buildPlan('2026-11-12',{schedule:mk('2026-11-12',['Chris C.','Nathan H.']),team:thuTeam});
  assert.deepEqual(Object.keys(thu.smThursday.reports),['sales-plan','compliance-training','shrink-damage','pos-activity','product-rotation']);
  assert.equal(thu.smThursday.owner,'Chris C.');
  const fri=P.buildPlan('2026-11-13',{schedule:mk('2026-11-13',['Chris C.','Nathan H.']),team:thuTeam});
  assert.equal(fri.smThursday,undefined);
  const r=thu.smThursday.reports['pos-activity'];assert.deepEqual([r.asOf,r.printed,r.posted,r.reviewed,r.unavailable],['',false,false,false,false]);
});
test('Printed, Posted and Reviewed each need a source date and stay separate',()=>{
  const sm=P.newSmThursday(thuTeam);
  assert.match(P.setReportField(sm,'sales-plan','printed',true,'2026-11-12'),/as-of/);
  assert.equal(P.setReportField(sm,'sales-plan','asOf','2026-11-09','2026-11-12'),'');
  assert.match(P.setReportField(sm,'sales-plan','asOf','2026-11-20','2026-11-12'),/after/);
  assert.equal(P.setReportField(sm,'sales-plan','printed',true,'2026-11-12'),'');
  const r=sm.reports['sales-plan'];assert.deepEqual([r.printed,r.posted,r.reviewed],[true,false,false]);
  P.setReportField(sm,'sales-plan','asOf','','2026-11-12');assert.deepEqual([r.printed,r.posted,r.reviewed],[false,false,false]);
});
test('unavailable reports need a reason, block statuses, and are never substituted',()=>{
  const sm=P.newSmThursday(thuTeam);
  assert.match(P.setReportField(sm,'compliance-training','unavailable',true,'2026-11-12'),/note/);
  P.setReportField(sm,'compliance-training','note','Not published yet','2026-11-12');
  assert.equal(P.setReportField(sm,'compliance-training','unavailable',true,'2026-11-12'),'');
  P.setReportField(sm,'compliance-training','asOf','2026-11-02','2026-11-12');
  assert.match(P.setReportField(sm,'compliance-training','reviewed',true,'2026-11-12'),/unavailable/);
  assert.equal(P.smStatus({id:'2026-11-12',smThursday:sm},mk('2026-11-12',['Chris C.']),thuTeam).unavailable,1);
});
test('owner is Chris even when scheduled leadership exists; off day stays pending with no time block or silent delegation',()=>{
  const plan=P.buildPlan('2026-11-12',{schedule:mk('2026-11-12',['Sanah I.','Nathan H.']),team:thuTeam});
  const st=P.smStatus(plan,mk('2026-11-12',['Sanah I.','Nathan H.']),thuTeam);
  assert.equal(st.owner,'Chris C.');assert.equal(st.onShift,false);assert.equal(st.pendingReview,true);assert.match(st.note,/not scheduled/);assert.equal(st.delegation,null);
  assert.ok(plan.entries.every(e=>!/print and post|SM Thursday/i.test(e.title)));
  assert.match(P.delegateSm(plan.smThursday,'','x','Chris C.'),/who/i);
  assert.match(P.delegateSm(plan.smThursday,'Sanah I.','','Chris C.'),/reason/i);
  assert.equal(P.delegateSm(plan.smThursday,'Sanah I.','Chris off','Chris C.','2026-11-11T12:00:00Z'),'');
  assert.equal(plan.smThursday.owner,'Chris C.');assert.equal(plan.smThursday.delegation.to,'Sanah I.');
});
test('rebuilding or refreshing a Thursday plan keeps checklist statuses and adds nothing twice',()=>{
  const ctx={schedule:mk('2026-11-12',['Chris C.','Nathan H.']),team:thuTeam};
  const a=P.buildPlan('2026-11-12',ctx);P.setReportField(a.smThursday,'sales-plan','asOf','2026-11-09','2026-11-12');P.setReportField(a.smThursday,'sales-plan','printed',true,'2026-11-12');P.setThinkField(a.smThursday,'cash','checked',true);
  const b=P.buildPlan('2026-11-12',{...ctx,old:a});assert.equal(b.smThursday.reports['sales-plan'].printed,true);assert.equal(b.smThursday.think.cash.checked,true);assert.equal(Object.keys(b.smThursday.reports).length,5);
  assert.equal(P.withSmThursday(b,thuTeam).smThursday.reports['sales-plan'].asOf,'2026-11-09');
});
test('daily CCTV and routines stay once on every daily plan; no Saturday rotation tasks are created',()=>{
  for(const d of ['2026-11-12','2026-11-13','2026-11-14']){const t=P.templates(d);assert.equal(t.filter(e=>e.key==='cctv').length,1);assert.equal(t.filter(e=>/cctv/i.test(e.title)).length,1);assert.ok(t.every(e=>!/first[- ]saturday|second[- ]saturday|1st saturday|2nd saturday/i.test(e.title+e.notes)));}
  assert.equal(P.templates('2026-11-12').filter(e=>/print|think shrink/i.test(e.title)).length,0);
  assert.ok(P.thinkShrink.filter(t=>t.daily).every(t=>P.templates('2026-11-12').some(e=>e.key===t.daily)));
});
test('Thursday reminder task is one stable Chris-owned task; follow-ups need source date, review and a note',()=>{
  const plan=P.buildPlan('2026-11-12',{schedule:mk('2026-11-12',['Chris C.']),team:thuTeam});
  const t=P.smReminderTask(plan,thuTeam);assert.equal(t.id,'smthu:2026-11-12');assert.equal(t.owner,'Chris C.');assert.equal(t.due,'2026-11-12');assert.equal(P.smReminderTask(plan,thuTeam).id,t.id);
  assert.match(P.followUpTask(plan,'shrink-damage',thuTeam).error,/as-of/);
  P.setReportField(plan.smThursday,'shrink-damage','asOf','2026-11-08','2026-11-12');assert.match(P.followUpTask(plan,'shrink-damage',thuTeam).error,/reviewed/);
  P.setReportField(plan.smThursday,'shrink-damage','reviewed',true,'2026-11-12');assert.match(P.followUpTask(plan,'shrink-damage',thuTeam).error,/note/);
  P.setReportField(plan.smThursday,'shrink-damage','note','Check damage disposal log','2026-11-12');
  const f=P.followUpTask(plan,'shrink-damage',thuTeam);assert.equal(f.task.id,'smfu:2026-11-12:shrink-damage');assert.match(f.task.notes,/as-of 2026-11-08/);
});
