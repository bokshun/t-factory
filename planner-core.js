/* Store 19891 forms transcribed from Chris's six photographs, November 12, 2026. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StoreFlowPlanner=factory();})(typeof self==='undefined'?this:self,function(){
'use strict';
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const freshPrep='Prep deep recovery; fill overstock following FIFO; clean and sanitize coolers; receive truck; stock as it arrives in this order: ice cream, milk, refrigerated, frozen.';
const workflow=[
{day:'Saturday',code:'T+2 / P+4',weekly:'Hang ad signs.',workflow:'Finish truck core.',freshTruck:'Fill in overstock following FIFO; ensure PIA is correct for remaining overstock; OHA of 3 items or less and PIA of milk/egg items.',nightly:'Hang ad signs'},
{day:'Sunday',code:'T+3 / P+5',weekly:'',workflow:'Set and fill Seasonal G Sections; set and fill MAG endcaps.',freshTruck:'Closing shift rotates milk/eggs and all other coolers; process damages under camera.',nightly:'Rotation first'},
{day:'Monday',code:'T+4',weekly:'Complete DG Connect.',workflow:'Set POG sky shelves.',freshTruck:'',nightly:'Recovery'},
{day:'Tuesday',code:'T+5 / P-Day',weekly:'Complete Compliance Tuesday.',workflow:'Backstock.',freshTruck:freshPrep,nightly:'Recovery'},
{day:'Wednesday',code:'T+6',weekly:'',workflow:'Organize receiving room; Nones & Tons / outs scans; dry damages.',freshTruck:'',nightly:'Recovery'},
{day:'Thursday',code:'T-Day',weekly:'',workflow:'Plan stocking; receive truck; stock toppers and totes.',freshTruck:'',nightly:'Recovery'},
{day:'Friday',code:'T+1 / 2nd P-Day',weekly:'',workflow:'Stock truck core.',freshTruck:freshPrep,nightly:'Recovery'}];
const daily=['Complete all Daily Planner tasks (Front End, Receiving Room, Sales Floor).','Restock and rotate perishables.','Fill and balance impulse area by 9 a.m.','Recover and clean first 30 feet all day.','Paper / Downstock / Fill.','Recovery 5 p.m. to close: full store (closing activities take priority).'];
const compliance=['Price changes: install core price change labels; hang clearance stickers.','Product Rotation Schedule.','Product Rotation Alerts (available in HHT).','Complete Store Safety Walk.'];
const cleaning=[
['exterior','Exterior / parking lot','Use outdoor broom and pan to remove debris, gum and cigarette butts; empty trash. No rolltainers outside.'],
['doors','Entrance / exit doors','Clean interior and exterior glass; disinfect handles and frames; remove tape and residue.'],
['carts','Shopping carts and baskets','Collect carts in corral and stack baskets; remove loose debris and trash.'],
['lobby','Lobby','Clean checkout/impulse coolers, Magic Table and queue-line bottom bases; sweep/mop; remove labels, gum and residue; keep fixtures clean and correctly merchandised.'],
['register','Register','Clean and sanitize countertops and surfaces; keep self checkout clear and accessible.'],
['fixtures','Fixtures','Clean fixtures including greeting cards, batteries, cosmetics, DVD and specialty black fixtures; stock correct locations and display price labels.'],
['breakroom','Breakroom','Sanitize handles and surfaces; arrange tables/chairs; clean and sanitize refrigerator and microwave if applicable.'],
['office','Office','Organize desk; clean and sanitize handles and surfaces; keep phone and HHT clean and accessible.'],
['coolers','Coolers / freezers','Clean doors, handles, frames and glass on sales floor and in receiving room; clean inside spills. Deep clean on P-Day with focus on yogurt and milk doors/shelves.'],
['restrooms','Restrooms','Sanitize handles, surfaces and dispensers; empty trash and restock liners, soap, paper towels and bath tissue.'],
['floors','Floors','Sweep and mop; remove labels, gum and residue.']
].map(([key,title,notes])=>({key:'clean-'+key,title,notes,section:'Cleaning',minutes:15}));
function item(key,title,section,minutes=15,lead=false,extra={}){return {key,title,section,minutes,lead,...extra};}
const template=[
item('register-coverage','Assign register; declutter and check improper signage','Front end',15,true),
item('checkout','Recover & replenish checkout (tobacco, bag wells)','Front end'),
item('qline','Recover & replenish Q-Line candy','Front end'),
item('front-coolers','Clean, recover and replenish front coolers','Front end'),
item('prices','Check ice machine and propane pricing','Front end'),
item('magic','Load lobby in-stock; set to MAG; price accurately','Front end'),
item('produce','Daily produce culling (if applicable)','Front end',15,false,{optional:true}),
item('rx','FedEx daily inventory scan on HHT (if applicable)','Front end',10,false,{optional:true}),
item('dumpster','Check dumpster / exterior back area','Front end'),
item('first30','Sweep & spot mop first 30 feet','Front end / low traffic'),
item('restroom-trash','Clean restrooms & collect trash','Front end / low traffic'),
item('vestibule','Retrieve carts and organize vestibule','Front end / low traffic'),
item('windows','Clean windows & doors','Front end / low traffic'),
item('parking','Keep parking lot clean','Front end / low traffic'),
item('floor-clear','Sales floor clear of clutter, debris, trash and carts','Sales floor'),
item('endcaps','Endcaps full, clean and priced; no product on top (sky shelves only)','Sales floor'),
item('cooler-clean','Ensure coolers clean inside and out','Sales floor'),
item('recovery','Store recovery — dry and fresh','Sales floor',30),
item('safety','Correct blocked emergency exits, electrical panels, fire extinguishers, aisles, restroom and water-fountain access immediately','Compliance',15,true,{priority:'high'}),
item('deposits','Validate bank deposits and prior-day over/short','SM total loss controls',15,true),
item('clipboard','Update clipboard & Business Center','SM total loss controls',10,true),
item('performance','File Store Performance Summary','SM total loss controls',10,true),
item('cctv','CCTV review — work page 2 of Weekly Store Summary','SM total loss controls',15,true),
item('invoices','Review and confirm iTRAM invoices','SM total loss controls',10,true),
item('3cart','Ensure proper three-cart setup (RT, U-boat, cardboard)','SM total loss controls',10,true),
item('maintenance','Address maintenance issues / submit tickets','SM total loss controls',10,true)
];
function isDriveline(task){return /\bdriveline\b/i.test([task.title,task.notes,task.body,task.owner,task.vendor].filter(Boolean).join(' '));}
function dayWorkflow(date){return workflow.find(x=>x.day===days[new Date(date+'T12:00:00').getDay()]);}
function templates(date){const w=dayWorkflow(date);const list=[...template.filter(x=>!x.optional&&!['restroom-trash','windows','parking','cooler-clean'].includes(x.key)),...cleaning.map(x=>({...x,notes:x.notes+(x.key==='clean-coolers'&&[2,5].includes(new Date(date+'T12:00:00').getDay())?' P-Day deep clean: yogurt and milk doors/shelves.':'')})),item('workflow',w.workflow,'7-day workflow',45),item('closing',w.nightly,'Closing',30,false,{after:1020})];
if(w.weekly)list.push(item('weekly',w.weekly,'Weekly',20,true));if(w.freshTruck)list.push(item('fresh',w.freshTruck,'Fresh truck',45));
if(new Date(date+'T12:00:00').getDay()===2)compliance.forEach((title,i)=>list.push(item('tuesday-'+i,title,'Compliance Tuesday',15,true)));
return list;}
const mins=t=>{const m=/^(\d{2}):(\d{2})$/.exec(t||'');return m&&+m[1]<24&&+m[2]<60?+m[1]*60 + +m[2]:NaN;};
const time=n=>String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const leader=role=>/manager|key\s*holder|lead/i.test(role||'');
const departed=name=>/^(alicia|jeff|louis)\b/i.test(String(name||'').trim());
function roster(date,schedule,team){return schedule.filter(s=>s.date===date&&!departed(s.name)).map(s=>({...s,role:team.find(t=>t.name===s.name)?.role||s.position||'',strength:team.find(t=>t.name===s.name)?.strength||'',startMinute:mins(s.start),endMinute:mins(s.end)})).filter(s=>Number.isFinite(s.startMinute)&&s.endMinute>s.startMinute);}
function assign(entries,shifts,blocks=[]){
 const occupied={};const load={};
 for(const e of entries.filter(x=>x.done||x.initials||x.modInitials)){if(e.owner)(occupied[e.owner] ||= []).push([mins(e.start),mins(e.end)]);}
 for(const b of blocks){if(!occupied[b.name])occupied[b.name]=[];const start=mins(b.start),end=mins(b.end);if(Number.isFinite(start)&&end>start)occupied[b.name].push([start,end]);}
 const assigned=entries.slice().sort((a,b)=>(a.priority==='high'?-1:0)-(b.priority==='high'?-1:0)||Number(b.lead||false)-Number(a.lead||false)).map(entry=>{
 if(entry.done||entry.initials||entry.modInitials)return {...entry};
 if(entry.notApplicable||isDriveline(entry))return {...entry,owner:'',start:'',end:'',reason:entry.notApplicable?'Not applicable':'Driveline only'};
 const choices=[];
 for(const s of shifts){if(entry.lead&&!leader(s.role))continue;
 for(let start=Math.max(s.startMinute,entry.after||0);start+entry.minutes<=s.endMinute;start+=5){const end=start+entry.minutes;if((occupied[s.name]||[]).some(([a,b])=>start<b&&end>a))continue;
 const strength=String(s.strength||'');const score=(load[s.name]||0)/Math.max(1,s.endMinute-s.startMinute)+(entry.lead?0:leader(s.role)?0.2:0)+(String(entry.section||'').startsWith('Front')&&/register|front/i.test(strength)?-0.1:0);choices.push({name:s.name,start,end,score});break;}}
 choices.sort((a,b)=>a.score-b.score||a.start-b.start||a.name.localeCompare(b.name));const best=choices[0];
 if(!best)return {...entry,owner:'',start:'',end:'',reason:entry.lead?'No available leadership block':'No available shift block'};
 (occupied[best.name] ||= []).push([best.start,best.end]);load[best.name]=(load[best.name]||0)+entry.minutes;
 return {...entry,owner:best.name,start:time(best.start),end:time(best.end),reason:'Suggested from shift availability and workload'};
 });const byKey=new Map(assigned.map(e=>[e.key,e]));return entries.map(e=>byKey.get(e.key));}
function validate(entries,shifts,blocks=[]){const issues=[];const active=entries.filter(x=>!x.notApplicable&&!isDriveline(x));
 for(const e of active){if(!e.owner){issues.push(e.title+': unassigned');continue;}const start=mins(e.start),end=mins(e.end);const s=shifts.find(x=>x.name===e.owner&&start>=x.startMinute&&end<=x.endMinute);if(!s||!(end>start)){issues.push(e.title+': outside a scheduled shift or missing time');continue;}if(e.lead&&!leader(s.role))issues.push(e.title+': requires leadership');if(end-start<e.minutes)issues.push(e.title+': time block shorter than estimated minutes');if(blocks.some(b=>b.name===e.owner&&start<mins(b.end)&&end>mins(b.start)))issues.push(e.title+': overlaps a break or coverage block');}
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const a=active[i],b=active[j];if(a.owner&&a.owner===b.owner&&mins(a.start)<mins(b.end)&&mins(a.end)>mins(b.start))issues.push(a.owner+': overlapping tasks ('+a.title+' / '+b.title+')');}
 return [...new Set(issues)];}

/* ---- Automatic baseline drafts, weekly preparation and change review (Nov 14, 2026) ---- */
const fixedRow=e=>!!(e.manual||e.done||e.initials||e.modInitials);
function weekDates(date){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+1)%7));return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');});}
function signature(date,schedule,team){return roster(date,schedule,team).map(s=>s.name+'|'+s.start+'|'+s.end).sort().join(';');}
function suggestMods(shifts){const l=shifts.filter(s=>leader(s.role));const rank=r=>/assistant/i.test(r||'')?1:/manager/i.test(r||'')?0:2;const by=(f)=>l.slice().sort((a,b)=>f(a,b)||rank(a.role)-rank(b.role)||a.name.localeCompare(b.name))[0];return {openingMod:by((a,b)=>a.startMinute-b.startMinute)?.name||'',closingMod:by((a,b)=>b.endMinute-a.endMinute)?.name||''};}
function status(p){return p.postedAt?'posted':(p.compassReviewed&&p.coverageReviewed)?'reviewed':'draft';}
function statusLabel(p){const s=status(p);return s==='posted'?'Posted assignments':s==='reviewed'?'Reviewed':'DRAFT'+(p.compassReviewed?'':' · Compass review pending');}
/* Build or refresh one dated plan with the single shared allocator. Returns null (never guesses) when the date has no valid shifts. */
function buildPlan(date,ctx){
 const {schedule,team,tasks=[],old=null,setup={},isDone=()=>false,now=new Date().toISOString()}=ctx;
 const shifts=roster(date,schedule,team);if(!shifts.length)return null;
 const keep=['compass','blockText','notes','handoff','preparedBy','produce','fedex','compassReviewed','coverageReviewed','openingMod','closingMod','blocks'];
 const prev={};for(const k of keep)if(old&&old[k]!==undefined)prev[k]=old[k];
 const s={compass:'',blockText:'',notes:'',handoff:'',preparedBy:'',produce:false,fedex:false,compassReviewed:false,coverageReviewed:false,blocks:[],...prev,...setup};
 const notes=[];
 const blocks=(s.blocks||[]).filter(b=>{const st=mins(b.start),en=mins(b.end);const ok=shifts.some(x=>x.name===b.name&&st>=x.startMinute&&en<=x.endMinute&&en>st);if(!ok)notes.push('Reserved block dropped (not within a scheduled shift): '+b.name+' '+b.start+'–'+b.end);return ok;});
 const mods=suggestMods(shifts);const onShift=n=>shifts.some(x=>x.name===n);
 const pick=(chosen,suggested,label)=>{if(chosen&&onShift(chosen))return chosen;if(chosen&&suggested!==chosen)notes.push(label+' '+chosen+' is no longer scheduled; suggested '+(suggested||'none')+'.');return suggested;};
 const openingMod=pick(s.openingMod,mods.openingMod,'Opening MOD'),closingMod=pick(s.closingMod,mods.closingMod,'Closing MOD');
 const entries=templates(date);
 if(s.produce)entries.push(template.find(e=>e.key==='produce'));if(s.fedex)entries.push(template.find(e=>e.key==='rx'));
 const vendorWork=[];
 String(s.compass||'').split(/\n/).map(x=>x.trim()).filter(Boolean).forEach(title=>{const e={key:'compass:'+title,title,section:'Compass / ZDWF',minutes:20};if(isDriveline(e))vendorWork.push(e);else entries.push(e);});
 for(const task of tasks.filter(t=>t.due===date&&!t.plannerDate)){const e={key:'task:'+task.id,taskId:task.id,title:task.title,notes:task.notes,section:'Existing daily tasks',minutes:20,lead:/compliance|bank|cctv|deposit/i.test(task.title),done:task.done};if(isDriveline(task))vendorWork.push(e);else if(!entries.some(x=>x.title.toLowerCase()===e.title.toLowerCase()))entries.push(e);}
 const prior=new Map((old?.entries||[]).map(e=>[e.key,e]));
 const merged=entries.map(e=>{const p=prior.get(e.key);return p?{...e,...p,done:isDone(p)||!!p.done}:e;});
 for(const p of old?.entries||[])if(fixedRow({...p,done:isDone(p)||p.done})&&!merged.some(e=>e.key===p.key))merged.push({...p,done:isDone(p)||!!p.done});
 const fixed=merged.filter(fixedRow);
 const reserve=[...blocks,...fixed.filter(e=>e.owner&&e.start).map(e=>({name:e.owner,start:e.start,end:e.end}))];
 const assigned=assign(merged.filter(e=>!fixed.includes(e)),shifts,reserve);
 const byKey=new Map([...fixed,...assigned].map(e=>[e.key,e]));
 const out=merged.map(e=>byKey.get(e.key));
 const plan={...(old||{}),id:date,compass:s.compass,blockText:s.blockText,blocks,notes:s.notes,handoff:s.handoff,preparedBy:s.preparedBy,produce:s.produce,fedex:s.fedex,compassReviewed:!!s.compassReviewed,coverageReviewed:!!s.coverageReviewed,openingMod,closingMod,entries:out,vendorWork,truck:old?.truck||{},postedAt:null,baseline:old?old.baseline:true,generatedAt:now,scheduleSig:signature(date,schedule,team)};
 plan.gaps=planGaps(plan,shifts,notes);return withSmThursday(plan,team);}
function planGaps(plan,shifts,notes=[]){const gaps=[...notes];
 if(!shifts.some(s=>leader(s.role)))gaps.push('No scheduled leadership: MOD and leadership duties stay unassigned.');
 else{if(!plan.openingMod)gaps.push('Opening MOD unassigned.');if(!plan.closingMod)gaps.push('Closing MOD unassigned.');}
 const open=plan.entries.filter(e=>!e.owner&&!e.notApplicable&&!isDriveline(e));
 if(open.length){const reasons=[...new Set(open.map(e=>e.reason).filter(Boolean))];gaps.push(open.length+' duty(ies) unassigned'+(reasons.length?': '+reasons.join('; '):'')+'.');}
 return gaps;}
/* Deliberate review of a saved plan against the current schedule. Never changes the plan. */
function reviewIssues(plan,ctx){const shifts=roster(plan.id,ctx.schedule,ctx.team);const out=[];
 if(plan.scheduleSig!==undefined&&plan.scheduleSig!==signature(plan.id,ctx.schedule,ctx.team))out.push({type:'schedule',text:'The imported schedule for '+plan.id+' changed since this plan was prepared.'});
 for(const e of plan.entries){if(!e.owner||e.notApplicable||isDriveline(e))continue;const st=mins(e.start),en=mins(e.end);const ok=!departed(e.owner)&&shifts.some(x=>x.name===e.owner&&st>=x.startMinute&&en<=x.endMinute);if(!ok)out.push({type:'offshift',key:e.key,fixed:fixedRow(e),text:e.title+': '+e.owner+(departed(e.owner)?' is former staff':' is not scheduled for '+(e.start||'?')+'–'+(e.end||'?'))+(fixedRow(e)?' (signed, completed or manual: kept as-is, manager must review)':'')});}
 return out;}
/* Baseline drafts for every missing date of the Saturday–Friday week. Existing plans are left untouched. */
function prepareWeek(date,ctx){const dates=weekDates(date);const plans=[],kept=[],gaps=[];
 for(const d of dates){if((ctx.plans||[]).some(p=>p.id===d)){kept.push(d);continue;}
  const plan=buildPlan(d,{...ctx,old:null,setup:{preparedBy:ctx.preparedBy||''}});if(plan)plans.push(plan);else gaps.push({date:d,reason:'No valid scheduled shifts: nothing assigned'});}
 return {dates,plans,kept,gaps};}

/* ---- SM Thursday print-and-post checklist and Think Shrink review (Chris, Nov 15, 2026) ----
   Kept apart from the allocator on purpose: this is Chris's own accountability, never assigned to a generic leader,
   never given an invented time block, and never delegated silently. No report figures are stored or fabricated. */
const smReports=[
{key:'sales-plan',title:'Sales to plan / comp sales, SM sales-to-gap goal and scan engagement (last week and rolling four weeks, one sheet)'},
{key:'compliance-training',title:'Compliance Training Report'},
{key:'shrink-damage',title:'Total loss / shrink and damage report, including risk assessments and recommended actions'},
{key:'pos-activity',title:'Point-of-Sale Activity by Associate (weekly and period-to-date panels)'},
{key:'product-rotation',title:'Product Rotation Schedule (source target dates are product pull-through/expiry criteria, not an employee work deadline)'}];
/* daily links are read-only references to the existing daily rows; Thursday reviews them and never duplicates or moves them. */
const thinkShrink=[
{key:'deposits',title:'Deposit log compliance verified',daily:'deposits'},
{key:'coupons',title:'Coupon envelopes mailed'},
{key:'cash',title:'Cash over/short controls and counseling follow-up'},
{key:'summary',title:'Store summary daily prints'},
{key:'training',title:'Shrink, prepaid-fraud and robbery-prevention training reviewed'},
{key:'dsd-match',title:'DSD invoices matched'},
{key:'damages',title:'Damage processing and disposal'},
{key:'store-use',title:'Store-use verification'},
{key:'eas',title:'Defensive merchandising / EAS'},
{key:'bc-brave',title:'Business Center and BRAVE updates and conversations',daily:'clipboard'},
{key:'condition',title:'Office and breakroom condition'},
{key:'cctv',title:'CCTV / Weekly Store Summary video review and DSD invoice CCTV log review',daily:'cctv'},
{key:'truck-credits',title:'Truck credits / Respond approval'},
{key:'receiving',title:'Receiving compliance in HHT and backdoor-key verification'}];
const isThursday=date=>new Date(date+'T12:00:00').getDay()===4;
const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(v+'T12:00:00'));
function smOwner(team){return (team||[]).find(t=>/^store manager$/i.test(String(t.role||'').trim()))?.name||'Chris C.';}
function newSmThursday(team){return {owner:smOwner(team),reports:Object.fromEntries(smReports.map(r=>[r.key,{asOf:'',unavailable:false,printed:false,posted:false,reviewed:false,note:''}])),think:Object.fromEntries(thinkShrink.map(t=>[t.key,{checked:false,note:''}])),delegation:null};}
/* Add the checklist to a Thursday plan only; keeps whatever is already saved so rebuilding never duplicates or erases statuses. */
function withSmThursday(plan,team){if(!plan||!isThursday(plan.id))return plan;const fresh=newSmThursday(team);const have=plan.smThursday||{};return {...plan,smThursday:{...fresh,...have,reports:Object.fromEntries(smReports.map(r=>[r.key,{...fresh.reports[r.key],...(have.reports||{})[r.key]}])),think:Object.fromEntries(thinkShrink.map(t=>[t.key,{...fresh.think[t.key],...(have.think||{})[t.key]}]))}};}
/* Returns an error string, or '' after changing sm in place. Printed/Posted/Reviewed never rest on an upload and need an acknowledged source date. */
function setReportField(sm,key,field,value,date){const r=sm?.reports?.[key];if(!r)return 'Unknown report.';
 if(field==='asOf'){if(value&&!isoDate(value))return 'Enter the report source / as-of date.';if(value&&value>date)return 'The source date cannot be after the Thursday date.';r.asOf=value||'';if(!r.asOf){r.printed=r.posted=r.reviewed=false;}return '';}
 if(field==='unavailable'){if(value){if(!String(r.note||'').trim())return 'Add a note saying why this report is unavailable (nothing is substituted).';r.printed=r.posted=r.reviewed=false;}r.unavailable=!!value;return '';}
 if(field==='note'){r.note=String(value||'');return '';}
 if(['printed','posted','reviewed'].includes(field)){if(value&&r.unavailable)return 'This report is flagged unavailable.';if(value&&!r.asOf)return 'Record the report source / as-of date before marking it '+field+'.';r[field]=!!value;return '';}
 return 'Unknown field.';}
function setThinkField(sm,key,field,value){const t=sm?.think?.[key];if(!t)return 'Unknown item.';if(field==='checked'){t.checked=!!value;return '';}if(field==='note'){t.note=String(value||'');return '';}return 'Unknown field.';}
/* Delegation is deliberate and recorded; the owner never changes silently. */
function delegateSm(sm,to,reason,by,at=new Date().toISOString()){if(!sm)return 'No checklist.';if(!String(to||'').trim())return 'Choose who receives the handoff.';if(!String(reason||'').trim())return 'A handoff reason is required.';sm.delegation={to,reason:String(reason).trim(),by:by||'',at};return '';}
function smStatus(plan,schedule,team){const sm=plan?.smThursday;if(!sm)return null;const shifts=roster(plan.id,schedule,team);const owner=sm.owner;const onShift=shifts.some(s=>s.name===owner);
 const reports=smReports.map(r=>({...r,...sm.reports[r.key]}));
 return {owner,onShift,delegation:sm.delegation||null,pendingReview:!onShift,reports,unavailable:reports.filter(r=>r.unavailable).length,printed:reports.filter(r=>r.printed).length,posted:reports.filter(r=>r.posted).length,reviewed:reports.filter(r=>r.reviewed).length,thinkDone:thinkShrink.filter(t=>sm.think[t.key]?.checked).length,thinkTotal:thinkShrink.length,
  note:onShift?'':owner+' is not scheduled on '+plan.id+': this stays pending for his review or a recorded handoff. No time block is invented.'};}
/* One reminder task per Thursday (stable id), always owned by the Store Manager, never done by itself. */
function smReminderTask(plan,team){if(!plan?.smThursday)return null;return {id:'smthu:'+plan.id,title:'Thursday: print and post SM reports, then Think Shrink review',owner:plan.smThursday.owner||smOwner(team),due:plan.id,notes:'Obtain the latest available version of each report from its source and print it. Track source/as-of date, Printed, Posted and Reviewed separately in the Daily Planner for '+plan.id+':\n'+smReports.map((r,i)=>(i+1)+'. '+r.title).join('\n')+'\nThen complete the Think Shrink review.',category:'compliance',priority:'high',smThursdayDate:plan.id};}
/* A follow-up is only created after the report has a source date AND a manager has marked it reviewed, and needs a manager-written note. */
function followUpTask(plan,key,team,owner){const sm=plan?.smThursday;const r=sm?.reports?.[key];const def=smReports.find(x=>x.key===key);if(!r||!def)return {error:'Unknown report.'};if(r.unavailable)return {error:'Report is flagged unavailable.'};if(!r.asOf)return {error:'Record the source / as-of date first.'};if(!r.reviewed)return {error:'Mark the report reviewed before creating a follow-up.'};if(!String(r.note||'').trim())return {error:'Write the follow-up note first (manager decides the action).'};
 return {task:{id:'smfu:'+plan.id+':'+key,title:'Follow up: '+def.title.split(' (')[0],owner:owner||sm.owner||smOwner(team),due:plan.id,notes:'Report as-of '+r.asOf+'. '+r.note.trim(),category:'compliance',priority:'medium',smThursdayDate:plan.id}};}
return {smReports,thinkShrink,isThursday,smOwner,newSmThursday,withSmThursday,setReportField,setThinkField,delegateSm,smStatus,smReminderTask,followUpTask,isDriveline,workflow,daily,compliance,cleaning,template,templates,dayWorkflow,roster,assign,validate,mins,time,leader,departed,fixedRow,weekDates,signature,suggestMods,status,statusLabel,buildPlan,planGaps,reviewIssues,prepareWeek};
});
