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
function roster(date,schedule,team){return schedule.filter(s=>s.date===date&&!/^(alicia|jeff)\b/i.test(s.name)).map(s=>({...s,role:team.find(t=>t.name===s.name)?.role||s.position||'',strength:team.find(t=>t.name===s.name)?.strength||'',startMinute:mins(s.start),endMinute:mins(s.end)})).filter(s=>Number.isFinite(s.startMinute)&&s.endMinute>s.startMinute);}
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
return {isDriveline,workflow,daily,compliance,cleaning,template,templates,dayWorkflow,roster,assign,validate,mins,time,leader};
});
