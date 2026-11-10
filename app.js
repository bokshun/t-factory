const storageKey = 'dg-storeflow-state-v1';
const syncConfigKey = 'dg-storeflow-sync-config-v1';
const accessProfileKey = 'dg-storeflow-access-profile-v1';
const appVersion = '2026.11.09.1';
const ops = window.StoreFlowOperations;
const alertSettingsKey = 'dg-storeflow-operations-alerts-v1';
let alertsEnabled = localStorage.getItem(alertSettingsKey) === 'on';
const firedAlerts = new Set();
let hiddenSince = 0;
let checkTaskId = '';
let dismissedAlertTimer = null;
let importReadToken = 0;
let importDraft = null;
let alertAudio = null;

let syncSaveTimer = null;
let syncChannel = null;
const syncMetaKey = 'dg-storeflow-sync-meta-v1';
const syncBackupKey = 'dg-storeflow-pre-sync-backup-v1';
let syncClient = null;
let syncClientId = '';
let syncEngine = null;
let syncEngineStore = '';
let syncPollTimer = null;
let syncPullTimer = null;
let syncRealtimeOk = false;
let syncVisibilityBound = false;
let isApplyingRemoteState = false;

const today = new Date();
const isoToday = ops.dateKey(today);
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const inventoryDate = '2026-06-25';
const inventoryLabel = 'June 25, 2026';
const defaultPlanningEvent = {
  id: 'clearance-event',
  name: 'Clearance Event',
  date: '2026-07-15',
  focus: 'clearance'
};

const sevenDayWorkflow = [
  {
    day: 'Saturday',
    code: 'T+1',
    weekly: 'Hang ad signs at 7:00 p.m.',
    workflow: 'Stock truck core',
    freshTruck: 'P+4: Fill in overstock using FIFO. Ensure MAG is correct for remaining overstock. Check OHA of 3 items or less and PIA of milk/egg items.',
    nightly: 'Recovery'
  },
  {
    day: 'Sunday',
    code: 'T+2',
    weekly: '',
    workflow: 'Finish truck core',
    freshTruck: '',
    nightly: 'Recovery'
  },
  {
    day: 'Monday',
    code: 'T+3',
    weekly: 'Complete fresh damages/rotation and complete DG Connect.',
    workflow: 'Set and fill Seasonal G Sections. Set and fill MAG endcaps.',
    freshTruck: '',
    nightly: 'Recovery'
  },
  {
    day: 'Tuesday',
    code: 'T+4 / P-Day',
    weekly: 'Complete Compliance Tuesday.',
    workflow: 'Set POG sky shelves.',
    freshTruck: 'Prep deep recovery. Fill overstock using FIFO. Clean and sanitize coolers. Receive truck. Rotate nones as they arrive by priority: ice cream, milk, refrigerated, frozen.',
    nightly: 'Recovery'
  },
  {
    day: 'Wednesday',
    code: 'T+5',
    weekly: '',
    workflow: 'Backstock',
    freshTruck: '',
    nightly: 'Recovery'
  },
  {
    day: 'Thursday',
    code: 'T+6',
    weekly: 'Complete fresh damages/rotation.',
    workflow: 'Organize RR nones and tons. Complete dry damages.',
    freshTruck: '',
    nightly: 'Recovery'
  },
  {
    day: 'Friday',
    code: 'T-Day',
    weekly: '',
    workflow: 'Plan stocking. Receive truck. Stock toppers and totes.',
    freshTruck: '',
    nightly: 'Recovery'
  }
];

const complianceTuesdayTasks = [
  'Price changes: install core price change labels and hang clearance stickers.',
  'Complete nones and tons routine from the Store Business Center.',
  'Prioritize OTC sections.',
  'Product Rotation Alerts in HHT.',
  'Store Safety Walk: confirm register flash, fire extinguisher, and electrical panels are clear, unobstructed, and accessible.'
];

const dailyActivities = [
  'Complete all Daily Planner tasks for Front End, Receiving Room, and Sales Floor.',
  'Restock and rotate perishables.',
  'Fill Balance Impulse area by 9:00 a.m.',
  'Recover and clean first 30 feet all day.',
  'Deep recovery and stock FHB.',
  'Daily recovery from 5:00 p.m. to close for full store.'
];

const companyStandards = [
  {
    area: 'Core Stocking',
    ownerLevel: 'Manager direction, team execution',
    triggers: ['truck', 'core stocking', 'rolltainer', 'tote', 'topper', 'receiving'],
    checks: [
      'T, T+1, and T+2 focus on planning, receiving, stocking, and core merchandise.',
      'Check StoreNet for truck notifications, carton count, delivery day, and T+1/T+2 readiness.',
      'Receiving room must be ready before the truck arrives.',
      'Driver unloads truck; store helps ensure U-boats are available, answers HHT questions, secures back door, and prints delivery receipt.',
      'Start with toppers to free U-boats, then move on to totes.',
      'Stock merchandise in the proper location, apply EAS tags and rotation when applicable, and do not make on-hand adjustments during core stocking.',
      'Core rolltainers, toppers, and totes should be stocked by end of T+2; recovery after 5 p.m. remains critical.'
    ]
  },
  {
    area: 'Dry Core Scanning',
    ownerLevel: 'Manager/key holder oversight',
    triggers: ['dry core', 'scan', 'nones', 'tons', 'ohaust', 'all-in-one'],
    checks: [
      'T-Day through T+1: no adjustments; core stocking should be completed by T+2.',
      'T+2 through T+5: use All-In-One screen for positive and negative adjustments as issues are found.',
      'Only complete positive adjustments while working sky shelves, front end/candy cart, and backstock totes.',
      'T+6: complete Nones and Tons for sales floor and receiving room.',
      'Scan goal is 200 dry core scans: positive, negative, and no adjustment.',
      'Nones screen focus is department outs on the sales floor, prioritizing planograms that reset the prior week.',
      'Tons screen focus is full case packs for focus departments and restocking cases the HHT identifies as opportunity.'
    ]
  },
  {
    area: 'MAG, POG, Endcaps, and Sky Shelves',
    ownerLevel: 'Manager direction, assigned project owner execution',
    triggers: ['mag', 'pog', 'planogram', 'endcap', 'g-section', 'sky shelf', 'sky shelves'],
    checks: [
      'Monthly Activity Guide gives detailed store layouts and displays by week.',
      'MAG and POG abbreviations appear on carton labels.',
      'Use the MAG book to set and fill four-foot G-sections, complete planned MAG endcaps, label and sticker G-sections, and set aside MAG product from T+1 through T+2.',
      'Planograms should be completed by end of T+4.',
      'Sky shelves should be completed by end of T+4.',
      'Make positive all-in-one adjustments on the HHT for overstock items placed on sky shelves.',
      'Avoid storing heavy items like pet food on sky shelves; use U-boats in the receiving room and try to store sky shelf backstock directly above its home location or within 12 feet.'
    ]
  },
  {
    area: 'T+5 and T+6 Next Truck Prep',
    ownerLevel: 'Manager/key holder oversight',
    triggers: ['t+5', 't+6', 'next truck', 'backstock', 'receiving room', 'damages'],
    checks: [
      'T+5 focus is reworking backstock, filling outs, and reducing receiving room inventory for the next delivery.',
      'Work both backstock U-boats and totes to keep things organized.',
      'T+6 includes backstock, nones and tons, and preparing the receiving room.',
      'Organize receiving room into delivery, backstock, and warehouse/storage zones.',
      'Label backstock U-boats and totes with department, employee name, date last worked, and other needed details.',
      'Complete damages in the HHT, follow camera/SOP guidance when needed, and put damaged items into the damage control center.'
    ]
  },
  {
    area: 'Stocking Methods Observation',
    ownerLevel: 'Store manager only',
    triggers: ['stocking observation', 'coaching', 'stocking method', 'pace'],
    checks: [
      'Observe stocking preparation: rolltainer retrieval, placement by visual inspection, cardboard/overstock U-boat placement, and proper tools.',
      'Observe stocking activity: DC label use, safe lifting, MAG/backstock handling, no ducking backstock, steady pace, efficient box opening, two-hand stocking, facing/blocking, cardboard breakdown, and selecting boxes before reaching the rolltainer.',
      'Observe backroom organization: cardboard and empty rolltainers in delivery zone, backstock organized to U-boats, and MAG organized to proper U-boat or MAG area.',
      'Capture store manager notes, employee comments, actions, and manager recommendations.'
    ]
  },
  {
    area: 'Plastic Film and Cardboard Rolltainer Compliance',
    ownerLevel: 'All team, manager verification',
    triggers: ['plastic', 'recycling', 'cardboard', 'rolltainer compliance', 'liner'],
    checks: [
      'Tie black or white trash bag to left side of cardboard rolltainer and clear recycling liner to right side.',
      'Clear plastic film from case packs goes only in the clear recycling liner.',
      'Other waste goes in the black or white trash bag or dumpster.',
      'Do not leave trash bags tied outside rolltainers and do not return trash to DCs.',
      'A full cardboard rolltainer should include a full clear recycling liner containing only plastic film, tied closed, on top of the cardboard.',
      'Load rolltainers fully, break down all cardboard boxes, and store cardboard rolltainers inside until the DC truck arrives.',
      'Do not add plastic, trash, or styrofoam to the cardboard rolltainer; store rolltainers outside overhang only as needed.'
    ]
  },
  {
    area: 'Respond Tickets',
    ownerLevel: 'Store manager / leadership only',
    triggers: ['respond', 'ticket', 'sku increase', 'stock level', 'excessive sku', 'special order'],
    checks: [
      'Use Respond for DG replenished stock level issues and requests after the 7-day workflow has been followed.',
      'Common needs include SKU increase, excessive SKUs, SKUs not listed in current MAG/POG, special customer orders, not receiving stock after PIA is complete, and significant sales changes.',
      'Tickets need clear current issue/request notes, specific issue selections, example SKUs/UPCs, and POG ID when applicable.',
      'Check submitted tickets daily and do not submit vague tickets without clear store details.',
      'Missing required details may place tickets in pending status until more information is provided.'
    ]
  },
  {
    area: 'Department Last Worked and MM Labels',
    ownerLevel: 'Team execution, manager review',
    triggers: ['department sheet', 'last worked', 'mm', 'mixed merchandise', 'u-boat', 'overstock'],
    checks: [
      'Use a universal department worked sheet instead of separate paper for every department when possible.',
      'Track department, category/aisle, core or non-core, date last worked, name, remaining work, and manager follow-up.',
      'Support department presets such as Beauty Care/Cosmetics, Home Decor/Candles and Potpourri, Sundries/Batteries, and Seasonal blank.',
      'Support printable labels/sheets for MM boxes, overstock rolltainers, U-boats, and tote process follow-up.',
      'Team members should be able to print a sheet, retrieve it from the office printer, and label the MM box or work vehicle.'
    ]
  },
  {
    area: 'Store Manager Override',
    ownerLevel: 'Store manager only',
    triggers: ['override', 'manual time', 'forgot timer', 'blocked', 'move on'],
    checks: [
      'Standards should guide the work, but manager judgment keeps the day moving.',
      'Allow manager override when task was completed but not marked, a worker forgot to start/stop timer, customer coverage took priority, task is blocked, or manager verified manually.',
      'Override should require a reason and keep follow-up visible when work is still incomplete.',
      'Manual time adjustment should be manager-only and require team member, task, time/minutes, and reason.'
    ]
  }
];

const sampleState = {
  team: [
    { id: 't1', name: 'Chris C.', role: 'Store Manager', strength: 'workflow and compliance' },
    { id: 't2', name: 'Sanah I.', role: 'Assistant Store Manager', strength: 'opening manager and compliance' },
    { id: 't12', name: 'Nathan H.', role: 'Sales Associate', strength: 'sales floor support' },
    { id: 't4', name: 'Blaire M.', role: 'Key Holder', strength: 'stocking and closing coverage' },
    { id: 't5', name: 'Elvis J.', role: 'Sales Associate', strength: 'recovery and closing' },
    { id: 't6', name: 'Louis C.', role: 'Sales Associate', strength: 'core freight and sales floor support' },
    { id: 't7', name: 'Carlton R.', role: 'Sales Associate', strength: 'recovery and planogram support' },
    { id: 't8', name: 'Jazmin G.', role: 'Sales Associate', strength: 'register and truck support' },
    { id: 't13', name: 'Dominic S.', role: 'Sales Associate', strength: 'sales floor support' },
    { id: 't11', name: 'Margarette L.', role: 'Assistant Store Manager', strength: 'shift leadership' },
    { id: 't10', name: 'Asael H.', role: 'Sales Associate', strength: 'closing coverage' }
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Review Compass updates and post shift priorities',
      category: 'compliance',
      priority: 'high',
      owner: 'Chris C.',
      due: isoToday,
      notes: 'Pull daily and weekly notes, then turn them into short position directions.',
      done: false
    },
    {
      id: 'task-2',
      title: 'Complete safety walk and temperature checks',
      category: 'compliance',
      priority: 'high',
      owner: 'Sanah I.',
      due: isoToday,
      notes: 'Log issues before noon and assign fixes immediately.',
      done: false
    },
    {
      id: 'task-3',
      title: 'Finish CBL training follow-up',
      category: 'training',
      priority: 'medium',
      owner: 'Jazmin G.',
      due: isoToday,
      notes: 'Check required modules and confirm completion before end of shift.',
      done: false
    },
    {
      id: 'task-4',
      title: 'Set POG sky shelves',
      category: 'planogram',
      priority: 'medium',
      owner: 'Carlton R.',
      due: addDays(1),
      notes: 'Tuesday T+4 workflow: set POG sky shelves and confirm labels.',
      done: false
    },
    {
      id: 'task-5',
      title: 'Daily recovery 5:00 p.m. to close',
      category: 'reset',
      priority: 'low',
      owner: 'Chris C.',
      due: addDays(2),
      notes: 'Full store recovery every night; keep first 30 feet clean all day.',
      done: true
    },
    {
      id: 'task-6',
      title: 'Inventory prep: recover and clean first 30 feet',
      category: 'inventory',
      priority: 'high',
      owner: 'Chris C.',
      due: addDays(1),
      notes: 'Front end, checkout, seasonal entry, and high-traffic areas must stay faced and clean.',
      done: false
    },
    {
      id: 'task-7',
      title: 'Inventory prep: backroom and rolltainer count readiness',
      category: 'inventory',
      priority: 'high',
      owner: 'Blaire M.',
      due: addDays(2),
      notes: 'Stage, organize, and label problem areas so the team can count cleanly on inventory day.',
      done: false
    },
    {
      id: 'task-8',
      title: 'Inventory prep: damages, nones, tons, and dry damages',
      category: 'inventory',
      priority: 'high',
      owner: 'Chris C.',
      due: addDays(3),
      notes: 'Clear product that should not be counted as sellable and document follow-up.',
      done: false
    }
  ],
  schedule: [],
  schedulePdfs: [],
  scheduleWeeks: [],
  compassNotes: [
    { id: 'c1', title: '7-day setup', body: 'T-Day is Friday. P-Day is Tuesday. Pre-open stocking is yes. Dedicated delivery store is no.' },
    { id: 'c2', title: 'Daily reminder', body: 'Assign one owner per workflow task and check progress before shift change.' }
  ],
  messages: [
    { id: 'm1', from: 'Chris C.', body: 'Morning focus: compliance first, then training, then seasonal reset progress.', time: '7:12 AM' },
    { id: 'm2', from: 'Sanah I.', body: 'Safety walk started. I will update once temperature checks are logged.', time: '8:06 AM' }
  ],
  photos: [],
  assistantDecision: null,
  planningEvent: defaultPlanningEvent,
  reminders: [
    { id: 'r1', title: 'Inventory countdown check', due: isoToday, owner: 'Chris C.', notes: 'Review open inventory prep tasks and assign each one before shift change.', done: false },
    { id: 'r2', title: 'Backroom readiness check', due: addDays(2), owner: 'Blaire M.', notes: 'Confirm rolltainers, totes, and staged freight are organized for counting.', done: false },
    { id: 'r3', title: 'Final sales floor recovery push', due: '2026-06-24', owner: 'Sanah I.', notes: 'Full store recovery before inventory day on June 25, 2026.', done: false }
  ],
  timeEntries: [],
  activeTimer: null
};

let state = loadState();
let activeFilter = 'all';
let activeScheduleWeek = getCurrentScheduleWeek();
let currentAccess = loadAccessProfile();

const views = {
  dashboard: document.querySelector('#dashboardView'),
  tasks: document.querySelector('#tasksView'),
  inventory: document.querySelector('#inventoryView'),
  schedule: document.querySelector('#scheduleView'),
  compass: document.querySelector('#compassView'),
  photos: document.querySelector('#photosView'),
  team: document.querySelector('#teamView')
};

const pageTitles = {
  dashboard: 'Daily Command Center',
  tasks: 'Task Board',
  inventory: 'Event Planner',
  schedule: 'Schedule and Position Direction',
  compass: 'Compass and 7-Day Workflow',
  photos: 'Photo Intake',
  team: 'Team Communication'
};

document.querySelector('#todayLabel').textContent = `${dayNames[today.getDay()]}, ${today.toLocaleDateString()}`;
document.querySelector('#appVersionLabel').textContent = `Updated build ${appVersion}`;
document.querySelector('#taskDue').value = isoToday;

bindEvents();
render();
registerServiceWorker();
clearOldAppCaches();
connectCloudSync();
window.setInterval(refreshOperations, 1000);

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addDaysToDate(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCurrentScheduleWeek() {
  const current = ops.dateKey();
  const [, secondWeek] = ops.scheduleWeekStarts(state.scheduleWeeks, current);
  return current >= secondWeek && current <= ops.shiftDate(secondWeek, 6) ? 1 : 0;
}



function normalizeSchedule(schedule) {
  return schedule
    .filter((shift) => shift && shift.name)
    .map((shift, index) => {
      if (shift.date && shift.start && shift.end) {
        return {
          ...shift,
          id: shift.id || `s-normalized-${index}`,
          position: shift.position || 'Assigned Coverage',
          direction: shift.direction || 'Add shift direction based on store needs.'
        };
      }
      const [start, end] = parseShiftTime(shift.time || '9:00 AM - 1:00 PM');
      return {
        id: shift.id || `s-normalized-${index}`,
        date: shift.date || isoToday,
        name: shift.name,
        position: shift.position || 'Assigned Coverage',
        start,
        end,
        direction: shift.direction || 'Add shift direction based on store needs.'
      };
    });
}

function parseShiftTime(value) {
  const [startLabel, endLabel] = value.split('-').map((part) => part.trim());
  return [toTwentyFourHour(startLabel), toTwentyFourHour(endLabel)];
}

function toTwentyFourHour(value) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '09:00';
  let hour = Number(match[1]);
  const minute = match[2];
  const marker = match[3].toUpperCase();
  if (marker === 'PM' && hour !== 12) hour += 12;
  if (marker === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(sampleState);

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(sampleState);
  }
}

function normalizeState(savedState) {
  const merged = {
    ...structuredClone(sampleState),
    ...savedState,
    team: sampleState.team,
    tasks: savedState.tasks || sampleState.tasks,
    schedule: normalizeSchedule(savedState.schedule || sampleState.schedule),
    schedulePdfs: savedState.schedulePdfs || [],
    scheduleWeeks: Array.isArray(savedState.scheduleWeeks) ? savedState.scheduleWeeks : [],
    compassNotes: savedState.compassNotes || sampleState.compassNotes,
    messages: savedState.messages || sampleState.messages,
    photos: savedState.photos || [],
    assistantDecision: savedState.assistantDecision || null,
    planningEvent: normalizePlanningEvent(savedState.planningEvent),
    reminders: savedState.reminders || sampleState.reminders,
    timeEntries: savedState.timeEntries || [],
    activeTimer: savedState.activeTimer || null
  };
  migratePlaceholderNames(merged);
  return merged;
}

function migratePlaceholderNames(targetState) {
  const replacements = {
    Maya: 'Sanah I.',
    Jordan: 'Jazmin G.',
    Devin: 'Carlton R.',
    Chris: 'Chris C.'
  };

  const replaceName = (value) => value ? ops.staffName(replacements[value] || value) : value;
  const replaceText = (value) => {
    if (!value) return value;
    return Object.entries(replacements).reduce(
      (text, [from, to]) => text.replaceAll(`${from}:`, `${to}:`).replaceAll(from, to),
      value
    );
  };

  targetState.tasks = targetState.tasks.map((task) => ({
    ...task,
    owner: replaceName(task.owner),
    notes: replaceText(task.notes)
  }));

  targetState.reminders = targetState.reminders.map((reminder) => ({
    ...reminder,
    owner: replaceName(reminder.owner),
    notes: replaceText(reminder.notes)
  }));

  targetState.messages = targetState.messages.map((message) => ({
    ...message,
    from: replaceName(message.from),
    body: replaceText(message.body)
  }));

  targetState.photos = targetState.photos.map((photo) => ({
    ...photo,
    owner: replaceName(photo.owner),
    instruction: replaceText(photo.instruction)
  }));

  targetState.schedule = targetState.schedule.map((shift) => ({
    ...shift,
    name: replaceName(shift.name),
    direction: replaceText(shift.direction)
  }));

  targetState.timeEntries = targetState.timeEntries.map((entry) => ({
    ...entry,
    owner: replaceName(entry.owner)
  }));

  targetState.schedulePdfs = targetState.schedulePdfs.map((reference) => ({
    ...reference,
    owner: replaceName(reference.owner)
  }));
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (!isApplyingRemoteState) scheduleCloudSave();
    return true;
  } catch {
    return false;
  }
}

function loadAccessProfile() {
  const params = new URLSearchParams(window.location.search);
  const urlRole = normalizeAccessRole(params.get('access'));
  const urlMember = params.get('member')?.trim() || '';

  if (urlRole) {
    const profile = {
      role: urlRole,
      member: ops.staffName(urlMember) || (urlRole === 'manager' ? 'Chris C.' : '')
    };
    localStorage.setItem(accessProfileKey, JSON.stringify(profile));
    return profile;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(accessProfileKey));
    return normalizeAccessProfile(saved);
  } catch {
    return { role: 'manager', member: 'Chris C.' };
  }
}

function normalizeAccessProfile(profile = {}) {
  return {
    role: normalizeAccessRole(profile?.role) || 'manager',
    member: ops.staffName(profile?.member) || 'Chris C.'
  };
}

function normalizeAccessRole(role) {
  return ['manager', 'keyholder', 'associate'].includes(role) ? role : '';
}

function saveAccessProfile(event) {
  event.preventDefault();
  currentAccess = {
    role: document.querySelector('#accessRole').value,
    member: document.querySelector('#accessMember').value
  };
  localStorage.setItem(accessProfileKey, JSON.stringify(currentAccess));
  applyAccessControls();
  renderTasks();
  renderMessages();
  renderRoster();
}

function isManagerAccess() {
  return currentAccess.role === 'manager';
}

function isKeyholderAccess() {
  return currentAccess.role === 'keyholder';
}

function isAssociateAccess() {
  return currentAccess.role === 'associate';
}

function getAllowedViews() {
  if (isManagerAccess()) return ['dashboard', 'tasks', 'inventory', 'schedule', 'compass', 'photos', 'team'];
  if (isKeyholderAccess()) return ['dashboard', 'tasks', 'schedule', 'compass', 'team'];
  return ['tasks', 'team'];
}

function canUseManagerTools() {
  return isManagerAccess();
}

function canWorkTask(task) {
  if (!isAssociateAccess()) return true;
  return Boolean(currentAccess.member) && ops.staffName(task.owner) === currentAccess.member;
}

function getVisibleTasks(tasks = state.tasks) {
  return tasks.filter(canWorkTask);
}

function getAccessLabel() {
  if (isManagerAccess()) return `Manager mode${currentAccess.member ? ` - ${currentAccess.member}` : ''}`;
  if (isKeyholderAccess()) return `Keyholder mode${currentAccess.member ? ` - ${currentAccess.member}` : ''}`;
  return `Associate mode${currentAccess.member ? ` - ${currentAccess.member}` : ''}`;
}

function applyAccessControls() {
  const allowedViews = getAllowedViews();
  document.querySelectorAll('.nav-item').forEach((button) => {
    const allowed = allowedViews.includes(button.dataset.view);
    button.classList.toggle('is-hidden', !allowed);
    button.disabled = !allowed;
  });

  const currentViewName = Object.entries(views).find(([, view]) => view.classList.contains('active'))?.[0] || 'dashboard';
  if (!allowedViews.includes(currentViewName)) setView(allowedViews[0]);

  const managerSelectors = [
    '#openTaskModal',
    '#buildRoutineChecks',
    '#previewCourseAction',
    '#managerUpdateForm',
    '#addInventoryPlan',
    '#eventSetupForm',
    '#addReminder',
    '#schedulePdfForm',
    '#clearSchedulePdfs',
    '#addShift',
    '#addCompassNote',
    '#photoForm',
    '#clearPhotos',
    '#syncForm'
  ];

  managerSelectors.forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.classList.toggle('is-hidden', !canUseManagerTools());
  });

  document.querySelectorAll('.schedule-pdf-panel').forEach((panel) => {
    panel.classList.toggle('is-hidden', !canUseManagerTools());
  });

  const accessForm = document.querySelector('#accessForm');
  if (accessForm) accessForm.classList.toggle('is-hidden', !canUseManagerTools());

  const status = document.querySelector('#accessStatus');
  if (status) status.textContent = getAccessLabel();

  const hint = document.querySelector('#accessHint');
  if (hint) {
    hint.textContent = canUseManagerTools()
      ? 'Select Manager / Assistant Manager for Margarette L. or Sanah I. and Key holder for Blaire. Device views are separate from sign-in.'
      : 'This phone is limited to the work this role should see. Ask a manager for changes to schedule, uploads, sync, or store setup.';
  }

  populateAccessMembers();
}

function populateAccessMembers() {
  const select = document.querySelector('#accessMember');
  if (!select) return;
  const roster = getRosterFromSchedule();
  const names = [...new Set([currentAccess.member, 'Chris C.', ...roster.map((member) => member.name)].filter(Boolean))];
  select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.value = names.includes(currentAccess.member) ? currentAccess.member : names[0] || '';
  const roleSelect = document.querySelector('#accessRole');
  if (roleSelect) roleSelect.value = currentAccess.role;
}

function copyAccessLink(role) {
  const member = document.querySelector('#accessMember').value || currentAccess.member || '';
  const url = new URL(window.location.href);
  url.searchParams.set('access', role);
  if (member) url.searchParams.set('member', member);
  navigator.clipboard
    ?.writeText(url.toString())
    .then(() => alert(`${capitalize(role)} link copied for ${member || 'team member'}.`))
    .catch(() => alert(`Copy this link: ${url.toString()}`));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`./service-worker.js?v=${appVersion}`).catch(() => {});
  });
}

function clearOldAppCaches() {
  if (!('caches' in window)) return;
  caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('dg-storeflow-') && key !== 'dg-storeflow-v14')
          .map((key) => caches.delete(key))
      )
    )
    .catch(() => {});
}

function getSyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(syncConfigKey)) || {};
  } catch {
    return {};
  }
}

function hasSyncConfig(config = getSyncConfig()) {
  return Boolean(config.url && config.key && config.storeId);
}

function getSupabaseClient() {
  const config = getSyncConfig();
  if (!hasSyncConfig(config) || !window.supabase?.createClient) return null;
  const id = `${config.url}|${config.key}`;
  if (!syncClient || syncClientId !== id) {
    syncClient = window.supabase.createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    syncClientId = id;
    syncEngine = null;
    syncClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') stopLiveSync();
    });
  }
  return syncClient;
}

function loadSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(syncMetaKey));
  } catch {
    return null;
  }
}

function saveSyncMeta(meta) {
  try {
    if (meta) localStorage.setItem(syncMetaKey, JSON.stringify(meta));
    else localStorage.removeItem(syncMetaKey);
  } catch {
    updateSyncUi('Storage full: could not save sync marker');
  }
}

// Keeps the last 3 local boards before a first-time device adopts the cloud board.
function backupLocalBoard(localState) {
  try {
    localStorage.setItem(`${syncBackupKey}-${Date.now()}`, JSON.stringify({ savedAt: new Date().toISOString(), state: localState }));
    Object.keys(localStorage)
      .filter((key) => key.startsWith(`${syncBackupKey}-`))
      .sort()
      .slice(0, -3)
      .forEach((key) => localStorage.removeItem(key));
    return true;
  } catch {
    return false; // the engine refuses to replace this device's board without a backup
  }
}

function getSyncEngine() {
  const config = getSyncConfig();
  const client = getSupabaseClient();
  if (!client || !window.StoreFlowSyncCore) return null;
  if (!syncEngine || syncEngineStore !== config.storeId) {
    syncEngineStore = config.storeId;
    syncEngine = window.StoreFlowSyncCore.createEngine({
      client,
      storeId: config.storeId,
      getState: exportSyncState,
      setState: applyRemoteState,
      normalize: normalizeState,
      loadMeta: loadSyncMeta,
      saveMeta: saveSyncMeta,
      backupLocal: backupLocalBoard,
      onStatus: (text) => updateSyncUi(text)
    });
  }
  return syncEngine;
}

async function hasSyncSession() {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data?.session);
}

function updateSyncUi(message) {
  const config = getSyncConfig();
  const status = document.querySelector('#syncStatus');
  if (!status) return;
  const base = message || (hasSyncConfig(config) ? 'Sync configured' : 'Local only');
  status.textContent = `${base}${syncRealtimeOk && hasSyncConfig(config) ? ' - live' : ''}`;
  const form = document.querySelector('#syncForm');
  if (form && form.contains(document.activeElement)) return; // never overwrite what someone is typing
  document.querySelector('#syncStoreId').value = config.storeId || '';
  document.querySelector('#syncUrl').value = config.url || '';
  document.querySelector('#syncKey').value = config.key || '';
}

function saveSyncSettings(event) {
  event.preventDefault();
  const storeId = document.querySelector('#syncStoreId').value.trim();
  if (!storeId) {
    alert('Enter the store sync ID first (for testing: 19891-test).');
    return;
  }
  const config = {
    storeId,
    url: document.querySelector('#syncUrl').value.trim(),
    key: document.querySelector('#syncKey').value.trim()
  };
  localStorage.setItem(syncConfigKey, JSON.stringify(config));
  connectCloudSync();
}

function stopLiveSync() {
  window.clearInterval(syncPollTimer);
  window.clearTimeout(syncPullTimer);
  syncPollTimer = null;
  syncRealtimeOk = false;
  if (syncChannel && syncClient) syncClient.removeChannel?.(syncChannel);
  syncChannel = null;
}

// Turning sync off never deletes local or cloud data.
function disableCloudSync() {
  stopLiveSync();
  localStorage.removeItem(syncConfigKey);
  syncClient = null;
  syncEngine = null;
  updateSyncUi('Local only');
}

async function signInToSync() {
  const email = document.querySelector('#syncEmail').value.trim();
  const password = document.querySelector('#syncPassword').value;
  const storeId = document.querySelector('#syncStoreId').value.trim();
  const url = document.querySelector('#syncUrl').value.trim();
  const key = document.querySelector('#syncKey').value.trim();
  if (!storeId || !url || !key) return alert('Fill in the store sync ID, Supabase URL, and anon key first.');
  if (!email || !password) return alert('Enter your email and password.');
  localStorage.setItem(syncConfigKey, JSON.stringify({ storeId, url, key }));
  const client = getSupabaseClient();
  if (!client) return alert('Sync library did not load. Check your connection and reload.');
  updateSyncUi('Signing in...');
  const { error } = await client.auth.signInWithPassword({ email, password });
  document.querySelector('#syncPassword').value = '';
  if (error) {
    updateSyncUi('Sign-in failed');
    return alert(`Sign-in failed: ${error.message}`);
  }
  await connectCloudSync();
}

async function signOutOfSync() {
  const client = getSupabaseClient();
  stopLiveSync();
  if (client) await client.auth.signOut();
  updateSyncUi('Signed out');
}

async function connectCloudSync() {
  try {
    updateSyncUi();
    const config = getSyncConfig();
    const client = getSupabaseClient();
    if (!client || !hasSyncConfig(config)) return;
    if (!(await hasSyncSession())) {
      stopLiveSync();
      updateSyncUi('Sign in required');
      return;
    }
    await pullCloudState(false);
    startLiveSync(client, config);
  } catch (error) {
    updateSyncUi('Sync error');
  }
}

function schedulePull() {
  window.clearTimeout(syncPullTimer);
  syncPullTimer = window.setTimeout(() => pullCloudState(false), 400);
}

// Realtime watches the tiny storeflow_sync_meta row (the server bumps it on every board write).
// It is only a "something changed" signal; the board itself is always re-fetched, so the 1 MB
// Realtime payload limit never applies. A 30 second poll is the safety net.
function startLiveSync(client, config) {
  stopLiveSync();
  syncChannel = client
    .channel(`storeflow-${config.storeId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'storeflow_sync_meta', filter: `store_id=eq.${config.storeId}` },
      schedulePull
    )
    .subscribe((status) => {
      syncRealtimeOk = status === 'SUBSCRIBED';
      updateSyncUi(document.querySelector('#syncStatus')?.textContent.replace(/ - live$/, '') || undefined);
    });
  syncPollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') pullCloudState(false);
  }, 30000);
  if (!syncVisibilityBound) {
    syncVisibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && syncChannel) pullCloudState(false);
    });
  }
}

function scheduleCloudSave() {
  if (!hasSyncConfig()) return;
  window.clearTimeout(syncSaveTimer);
  syncSaveTimer = window.setTimeout(() => pushCloudState(false), 900);
}

function exportSyncState() {
  return {
    ...state,
    activeTimer: null,
    syncedAt: new Date().toISOString(),
    appVersion
  };
}

const syncResultMessages = {
  pushed: 'Your changes are saved to the team board.',
  'nothing-to-push': 'Nothing new to push.',
  'needs-pull': 'Tap "Pull latest" first. This device has not joined the team board yet.',
  'refused-empty': 'This board is empty, so it was not uploaded.',
  'cloud-exists': 'The cloud board already exists. Tap "Pull latest" instead.',
  'cloud-empty': 'The cloud board is empty. Use "Start cloud board" only from the device with the real board.',
  adopted: 'Joined the team board. Your previous local board was backed up on this device.',
  'backup-failed': 'Could not back up this device\'s current board (storage may be full), so nothing was replaced. Free up space or tell Chris.',
  updated: 'Pulled the latest team board.',
  merged: 'Merged teammate changes with yours.',
  current: 'Already up to date.',
  initialized: 'Cloud board started from this device.',
  'conflict-retry-exhausted': 'Others are editing right now. It will retry on your next change.',
  error: 'Sync failed. Check your connection and sign-in.'
};

async function pushCloudState(showAlert) {
  const engine = getSyncEngine();
  if (!engine) {
    updateSyncUi('Sync not set up');
    if (showAlert) alert('Sync is not set up yet. Add the store sync ID, Supabase URL, and anon key.');
    return;
  }
  if (!(await hasSyncSession())) {
    updateSyncUi('Sign in required');
    if (showAlert) alert('Sign in first.');
    return;
  }
  let result;
  try {
    result = await engine.push();
  } catch (error) {
    updateSyncUi('Sync error');
    result = { result: 'error', error };
  }
  if (showAlert) alert(syncResultMessages[result.result] || result.result);
  return result;
}

async function pullCloudState(showAlert) {
  const engine = getSyncEngine();
  if (!engine) {
    updateSyncUi('Sync not set up');
    if (showAlert) alert('Sync is not set up yet. Add the store sync ID, Supabase URL, and anon key.');
    return;
  }
  if (!(await hasSyncSession())) {
    updateSyncUi('Sign in required');
    if (showAlert) alert('Sign in first.');
    return;
  }
  let result;
  try {
    result = await engine.pull();
  } catch (error) {
    updateSyncUi('Sync error');
    result = { result: 'error', error };
  }
  const init = document.querySelector('#syncInit');
  if (init) init.classList.toggle('is-hidden', result.result !== 'cloud-empty');
  if (result.needsPush) scheduleCloudSave();
  if (showAlert) alert(syncResultMessages[result.result] || result.result);
  return result;
}

async function startCloudBoard() {
  const engine = getSyncEngine();
  if (!engine || !(await hasSyncSession())) return alert('Sign in first.');
  const storeId = getSyncConfig().storeId;
  const ok = confirm(`Start the cloud board for "${storeId}" from THIS device's current board?\n\nThis only works if the cloud board is empty. It can never replace an existing cloud board.`);
  if (!ok) return;
  const result = await engine.initializeCloud();
  alert(syncResultMessages[result.result] || result.result);
  if (result.result === 'initialized') document.querySelector('#syncInit')?.classList.add('is-hidden');
}

function applyRemoteState(remoteState) {
  const next = normalizeState(remoteState);
  const localTimer = state.activeTimer;
  const meta = loadSyncMeta();
  const hadJoined = alertsEnabled && meta && meta.storeId === getSyncConfig().storeId;
  const knownMessages = hadJoined ? new Set(state.messages.map((message) => message.id)) : null;
  const priorTasks = hadJoined ? new Map(state.tasks.map((task) => [task.id, task])) : null;
  // Cloud payloads intentionally exclude the device's running timer.
  if (localTimer && next.tasks.some((task) => task.id === localTimer.taskId && !task.done)) next.activeTimer = localTimer;
  else next.activeTimer = null;
  localStorage.setItem(storageKey, JSON.stringify(next)); // throws if storage is full; the current board stays untouched
  isApplyingRemoteState = true;
  state = next;
  isApplyingRemoteState = false;
  render();
  if (knownMessages) {
    const newMessages = next.messages.filter((message) => !knownMessages.has(message.id) && message.from !== currentAccess.member);
    const newAssignments = next.tasks.filter((task) => !task.done && task.owner === currentAccess.member && priorTasks.get(task.id)?.owner !== currentAccess.member);
    const items = [];
    if (newAssignments.length) items.push(newAssignments.length + ' new assignment(s)');
    if (newMessages.length) items.push(newMessages.length + ' new team message(s)');
    if (items.length) postOperationsAlert('Team update', items.join(' · '));
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  document.querySelectorAll('[data-view-jump]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.viewJump));
  });

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((chip) => chip.classList.remove('active'));
      button.classList.add('active');
      renderTasks();
    });
  });

  document.querySelectorAll('[data-schedule-week]').forEach((button) => {
    button.addEventListener('click', () => {
      activeScheduleWeek = Number(button.dataset.scheduleWeek);
      document.querySelectorAll('[data-schedule-week]').forEach((tab) => tab.classList.remove('active'));
      button.classList.add('active');
      showScheduleWeek(activeScheduleWeek);
    });
  });

  document.querySelector('#openTaskModal').addEventListener('click', openTaskDialog);
  document.querySelector('#refreshSuggestions').addEventListener('click', () => {
    renderSuggestions();
    renderAssistantPlan();
    document.querySelector('#refreshSuggestions').textContent = 'Updated just now';
  });

  document.querySelector('#buildRoutineChecks').addEventListener('click', buildRoutineChecks);
  document.querySelector('#previewCourseAction').addEventListener('click', previewCourseAction);
  document.querySelector('#managerUpdateForm').addEventListener('submit', applyCourseAction);

  document.querySelector('#taskForm').addEventListener('submit', (event) => {
    const submitter = event.submitter;
    if (submitter?.value === 'cancel') return;
    event.preventDefault();
    if (!canUseManagerTools()) return alert('Only manager access can create new tasks.');
    createTask();
  });

  document.querySelector('#messageForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector('#messageInput');
    const body = input.value.trim();
    if (!body) return;
    state.messages.unshift({
      id: crypto.randomUUID(),
      from: currentAccess.member || 'Team Member',
      body,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    });
    input.value = '';
    saveState();
    renderMessages();
  });



  document.querySelector('#addCompassNote').addEventListener('click', () => {
    if (!canUseManagerTools()) return alert('Only manager access can add Compass notes.');
    state.compassNotes.unshift({
      id: crypto.randomUUID(),
      title: 'New Compass note',
      body: 'Paste the key update here, then convert it into assigned tasks.'
    });
    saveState();
    renderCompass();
  });

  document.querySelector('#photoForm').addEventListener('submit', handlePhotoUpload);
  document.querySelector('#clearPhotos').addEventListener('click', () => {
    if (!canUseManagerTools()) return alert('Only manager access can clear photos.');
    state.photos = [];
    saveState();
    render();
  });

  document.querySelector('#addReminder').addEventListener('click', addInventoryReminder);
  document.querySelector('#addInventoryPlan').addEventListener('click', addInventoryPrepPlan);
  document.querySelector('#eventSetupForm').addEventListener('submit', updatePlanningEvent);
  document.querySelector('#schedulePdfForm').addEventListener('submit', applyScheduleImport);
  document.querySelector('#scheduleRead').addEventListener('click', readScheduleImport);
  document.querySelector('#addShift').addEventListener('click', () => {
    if (canUseManagerTools()) document.querySelector('#scheduleImportRows').focus();
  });
  document.querySelector('#schedulePdfInput').addEventListener('change', () => { importReadToken++; importDraft = null; });
  document.querySelector('#schedulePdfWeek').addEventListener('change', (event) => {
    showScheduleWeek(Number(event.target.value));
  });
  document.querySelector('#enableAlerts').addEventListener('click', toggleOperationsAlerts);
  document.addEventListener('pointerdown', unlockAlertAudio);
  document.querySelector('#workCheckDialog').addEventListener('close', handleWorkCheck);
  document.addEventListener('visibilitychange', handleWorkVisibility);
  document.querySelector('#clearSchedulePdfs').addEventListener('click', () => {
    if (!canUseManagerTools()) return alert('Only manager access can clear schedule PDFs.');
    state.schedulePdfs = [];
    saveState();
    renderSchedulePdfs();
  });

  document.querySelector('#syncForm').addEventListener('submit', saveSyncSettings);
  document.querySelector('#syncPull').addEventListener('click', () => pullCloudState(true));
  document.querySelector('#syncPush').addEventListener('click', () => pushCloudState(true));
  document.querySelector('#syncDisable').addEventListener('click', disableCloudSync);
  document.querySelector('#syncSignIn').addEventListener('click', signInToSync);
  document.querySelector('#syncSignOut').addEventListener('click', signOutOfSync);
  document.querySelector('#syncInit').addEventListener('click', startCloudBoard);
  document.querySelector('#syncPassword').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      signInToSync();
    }
  });
  document.querySelector('#accessForm').addEventListener('submit', saveAccessProfile);
  document.querySelector('#copyAssociateLink').addEventListener('click', () => copyAccessLink('associate'));
  document.querySelector('#copyKeyholderLink').addEventListener('click', () => copyAccessLink('keyholder'));
}

function setView(viewName) {
  const allowedViews = getAllowedViews();
  if (!allowedViews.includes(viewName)) viewName = allowedViews[0];
  Object.values(views).forEach((view) => view.classList.remove('active'));
  views[viewName].classList.add('active');
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
  document.querySelector('#pageTitle').textContent = pageTitles[viewName];
}

function openTaskDialog() {
  const ownerSelect = document.querySelector('#taskOwner');
  ownerSelect.innerHTML = getRosterFromSchedule()
    .map((member) => `<option value="${member.name}">${member.name} - ${member.role}</option>`)
    .join('');
  document.querySelector('#taskDue').value = isoToday;
  document.querySelector('#taskModal').showModal();
}

function populatePhotoOwners() {
  document.querySelector('#photoOwner').innerHTML = getRosterFromSchedule()
    .map((member) => `<option value="${member.name}">${member.name} - ${member.role}</option>`)
    .join('');
}

function populateSchedulePdfOwners() {
  document.querySelector('#schedulePdfOwner').innerHTML = getLeadershipRoster()
    .map((member) => `<option value="${member.name}">${member.name} - ${member.role}</option>`)
    .join('');
}

function createTask() {
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title: document.querySelector('#taskTitle').value.trim(),
    category: document.querySelector('#taskCategory').value,
    priority: document.querySelector('#taskPriority').value,
    owner: document.querySelector('#taskOwner').value,
    due: document.querySelector('#taskDue').value,
    dueTime: document.querySelector('#taskDueTime').value,
    alarmMinutes: Number(document.querySelector('#taskAlarmMinutes').value) || null,
    notes: document.querySelector('#taskNotes').value.trim(),
    done: false
  });
  document.querySelector('#taskForm').reset();
  document.querySelector('#taskModal').close();
  saveState();
  render();
}

function addInventoryReminder() {
  if (!canUseManagerTools()) return alert('Only manager access can add reminders.');
  const event = getPlanningEvent();
  state.reminders.unshift({
    id: crypto.randomUUID(),
    title: `${event.name} reminder`,
    due: isoToday,
    owner: getLeadershipOwner(),
    notes: `Check open ${event.name.toLowerCase()} prep work before shift change. Target date: ${formatDateLong(event.date)}.`,
    eventId: event.id,
    done: false
  });
  saveState();
  renderInventory();
}

function addInventoryPrepPlan() {
  if (!canUseManagerTools()) return alert('Only manager access can add prep plans.');
  const event = getPlanningEvent();
  const plans = getEventPlanTemplates(event);
  const eventTasks = getEventTasks(event);
  const [title, notes, ownerType = 'associate'] = plans[eventTasks.length % plans.length];
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title,
    category: 'inventory',
    priority: 'high',
    owner: ownerType === 'leader' ? getLeadershipOwner() : getRotatingOwner().name,
    due: isoToday,
    notes,
    eventId: event.id,
    done: false
  });
  saveState();
  render();
}

function updatePlanningEvent(event) {
  event.preventDefault();
  if (!canUseManagerTools()) return alert('Only manager access can update events.');
  const name = document.querySelector('#eventNameInput').value.trim() || defaultPlanningEvent.name;
  const date = document.querySelector('#eventDateInput').value || defaultPlanningEvent.date;
  const focus = document.querySelector('#eventFocusInput').value || defaultPlanningEvent.focus;
  state.planningEvent = {
    id: `${focus}-${date}`,
    name,
    date,
    focus
  };
  saveState();
  render();
}

function getEventPlanTemplates(event) {
  if (event.focus === 'clearance') {
    return [
      [`${event.name}: identify clearance sections`, 'Walk the sales floor and list clearance endcaps, tables, seasonal sections, and problem areas.', 'leader'],
      [`${event.name}: verify labels and markdown signs`, 'Check clearance labels, shelf tags, and sign placement so customers can clearly read the event pricing.', 'associate'],
      [`${event.name}: stage discontinued and event product`, 'Group product by department, remove damaged items, and stage anything that needs manager review.', 'associate'],
      [`${event.name}: recover and face event areas`, 'Recover the event set, front-facing product and clearing blocked aisles before peak traffic.', 'associate'],
      [`${event.name}: final manager walk`, 'Confirm pricing, signing, recovery, customer flow, and any compliance concerns before the event date.', 'leader']
    ];
  }

  if (event.focus === 'reset') {
    return [
      [`${event.name}: confirm planogram materials`, 'Verify labels, strips, fixtures, discontinued product, and POG notes are ready.', 'leader'],
      [`${event.name}: stage reset area`, 'Clear the section, group product, and stage tools before reset work starts.', 'associate'],
      [`${event.name}: final set and recovery`, 'Complete set, recover surrounding aisles, and note blockers for follow-up.', 'associate']
    ];
  }

  if (event.focus === 'seasonal') {
    return [
      [`${event.name}: fill seasonal feature`, 'Fill event product, face high-traffic areas, and identify outs or signing issues.', 'associate'],
      [`${event.name}: review seasonal endcaps`, 'Check MAG/endcap execution and make a follow-up list for missing product.', 'leader'],
      [`${event.name}: customer-ready recovery`, 'Recover seasonal, queue line, and front entrance areas before evening traffic.', 'associate']
    ];
  }

  return [
    [`${event.name}: verify top stock and sky shelves`, 'Check labels, overstock, and shelf location issues before final recovery.', 'associate'],
    [`${event.name}: clean receiving room paths`, 'Make count access easy and remove blockers from backroom work areas.', 'associate'],
    [`${event.name}: scan problem outs and shelf label issues`, 'Use photos and task notes to point the team to exact aisles.', 'leader']
  ];
}

async function handlePhotoUpload(event) {
  event.preventDefault();
  if (!canUseManagerTools()) return alert('Only manager access can upload photos.');
  const files = [...document.querySelector('#photoInput').files];
  if (!files.length) return;

  const category = document.querySelector('#photoCategory').value;
  const owner = document.querySelector('#photoOwner').value;
  const instruction = document.querySelector('#photoInstruction').value.trim() || 'Review this photo and follow up with the team.';
  const shouldCreateTask = document.querySelector('#photoCreateTask').checked;

  for (const file of files) {
    const photo = {
      id: crypto.randomUUID(),
      name: file.name,
      category,
      owner,
      instruction,
      createdAt: new Date().toISOString(),
      dataUrl: await resizeImageFile(file)
    };
    state.photos.unshift(photo);

    if (shouldCreateTask) {
      state.tasks.unshift({
        id: crypto.randomUUID(),
        title: category === 'schedule' ? 'Schedule photo follow-up' : `Photo follow-up: ${capitalize(category)}`,
        category: category === 'compass' ? 'compliance' : category,
        priority: ['compliance', 'planogram', 'truck', 'schedule'].includes(category) ? 'high' : 'medium',
        owner,
        due: isoToday,
        notes: category === 'schedule'
          ? `${instruction} Schedule photos are saved as references; roster updates from shifts entered on the Schedule tab.`
          : instruction,
        photoId: photo.id,
        done: false
      });

      state.messages.unshift({
        id: crypto.randomUUID(),
        from: 'Chris C.',
        body: category === 'schedule'
          ? `${owner}: ${instruction} Add or update shifts on the Schedule tab so the roster refreshes.`
          : `${owner}: ${instruction}`,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        photoId: photo.id
      });
    }
  }

  document.querySelector('#photoForm').reset();
  saveState();
  render();
}

function showScheduleWeek(week) {
  activeScheduleWeek = week;
  const starts = ops.scheduleWeekStarts(state.scheduleWeeks, ops.dateKey());
  document.querySelector('#scheduleImportStart').value = starts[week];
  document.querySelector('#scheduleGrid').scrollLeft = 0;
  renderSchedule();
  renderSchedulePdfs();
}

function importStatus(message) {
  document.querySelector('#scheduleImportStatus').textContent = message;
}

async function extractSchedulePdf(file) {
  // Loaded only on demand from the same CDN StoreFlow already uses. The file is parsed on the device.
  const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/';
  const pdfjs = await import(base + 'pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  try {
    const lines = [];
    for (let page = 1; page <= Math.min(document.numPages, 30); page++) {
      const content = await (await document.getPage(page)).getTextContent();
      let line = '', lastY;
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        const y = item.transform?.[5];
        if (line && Number.isFinite(y) && Number.isFinite(lastY) && Math.abs(y - lastY) > 2) {
          lines.push(line); line = '';
        }
        line += (line ? ' ' : '') + item.str.trim();
        lastY = y;
        if (item.hasEOL) { lines.push(line); line = ''; }
      }
      if (line) lines.push(line);
    }
    return lines.join('\n');
  } finally {
    await document.destroy();
  }
}

function scheduleImportRoster() {
  return getRosterFromSchedule().filter((member) => !ops.inactiveStaff(member.name));
}

async function readScheduleImport() {
  if (!canUseManagerTools()) return;
  const file = document.querySelector('#schedulePdfInput').files[0];
  if (!file) return importStatus('Choose a published PDF or CSV first.');
  if (file.size > 10000000) return importStatus('This file exceeds 10 MB. Use a smaller export or paste the verified shifts.');
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const token = ++importReadToken;
  const rowsBox = document.querySelector('#scheduleImportRows');
  const previousRows = rowsBox.value;
  importDraft = null;
  importStatus('Reading schedule…');
  try {
    const [source, dataUrl] = await Promise.all([
      isPdf ? extractSchedulePdf(file).catch(() => '') : file.text(),
      isPdf && file.size <= 2000000 ? readFileAsDataUrl(file).catch(() => '') : ''
    ]);
    if (token !== importReadToken) return;
    importDraft = { file, isPdf, dataUrl, fileId: crypto.randomUUID() };
    if (rowsBox.value !== previousRows) return importStatus('Kept the shifts you entered while the file was being read.');
    if (!isPdf) {
      rowsBox.value = source;
      importStatus('CSV loaded. Review the rows and set the first date from the schedule, then apply this week.');
      return;
    }
    const { rows } = ops.readShiftRows(source, scheduleImportRoster(), { strict: false });
    if (rows.length) {
      rowsBox.value = rows.map((row) => [row.date, row.name, row.start, row.end].join(', ')).join('\n');
      importStatus('Found ' + rows.length + ' dated shift rows. Check every shift against the PDF before applying.');
    } else {
      importStatus('No reliable dated rows found. Grid and image PDFs may need a CSV export or verified shifts pasted below.');
    }
  } catch {
    if (token === importReadToken) importStatus('Could not read this file. Try a CSV export or paste verified shift rows.');
  }
}

function applyScheduleImport(event) {
  event.preventDefault();
  if (!canUseManagerTools()) return;
  const start = document.querySelector('#scheduleImportStart').value;
  if (!ops.validDate(start)) return importStatus('Enter the first date shown on the published week.');
  const week = Number(document.querySelector('#schedulePdfWeek').value);
  const end = ops.shiftDate(start, 6);
  const startOther = state.scheduleWeeks.find((entry) => entry.week !== week)?.start;
  if (startOther && Math.abs(Date.parse(startOther) - Date.parse(start)) < 7 * 86400000) {
    return importStatus('This overlaps the other imported week. Select the correct week tab or check the first date.');
  }
  const { rows: allRows, problems } = ops.readShiftRows(document.querySelector('#scheduleImportRows').value, scheduleImportRoster());
  const rows = allRows.filter((row) => row.date >= start && row.date <= end);
  if (problems.length) return importStatus(problems.slice(0, 4).join(' '));
  if (!rows.length) return importStatus('No verified shifts fall within this week. Check the first date or select the other week.');
  const oldSchedule = state.schedule;
  const oldWeeks = state.scheduleWeeks;
  const oldPdfs = state.schedulePdfs;
  const previousWeek = oldWeeks.find((entry) => entry.week === week);
  if (previousWeek && !confirm('Replace the previously applied shifts for Week ' + (week + 1) + '?')) return;
  const owner = document.querySelector('#schedulePdfOwner').value || getLeadershipOwner();
  const notes = document.querySelector('#schedulePdfNotes').value.trim();
  const selectedFile = document.querySelector('#schedulePdfInput').files[0];
  if (selectedFile && selectedFile !== importDraft?.file) return importStatus('Read the selected file first, or clear it to use only the entered shifts.');
  const file = importDraft?.file;
  state.schedule = oldSchedule.filter((shift) => (shift.date < start || shift.date > end) && shift.importWeek !== week)
    .concat(rows.map((shift) => ({ ...shift, importWeek: week })));
  state.scheduleWeeks = oldWeeks.filter((entry) => entry.week !== week).concat({
    id: 'week-' + week, week, start, source: file?.name || 'Verified shift rows'
  });
  if (file) {
    const sharedFile = oldPdfs.find((pdf) => pdf.fileId === importDraft.fileId && pdf.dataUrl);
    state.schedulePdfs = [{ id: crypto.randomUUID(), name: file.name, size: file.size, week, start, owner, notes,
      createdAt: new Date().toISOString(), dataUrl: sharedFile ? '' : importDraft.dataUrl,
      fileId: importDraft.fileId, referenceId: sharedFile?.id, referenceType: importDraft.isPdf ? 'PDF' : 'CSV' }, ...oldPdfs];
  }
  if (!saveState()) {
    Object.assign(state, { schedule: oldSchedule, scheduleWeeks: oldWeeks, schedulePdfs: oldPdfs });
    return importStatus('Not saved: device storage is full. Apply the shift rows without attaching the file.');
  }
  activeScheduleWeek = week;
  if (allRows.length === rows.length) {
    importDraft = null;
    document.querySelector('#schedulePdfInput').value = '';
    document.querySelector('#scheduleImportRows').value = '';
  }
  render();
  importStatus('Week ' + (week + 1) + ' updated with ' + rows.length + ' verified shifts.' +
    (allRows.length > rows.length ? ' Other dates were left in the editor for the other week.' : ''));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function render() {
  applyAccessControls();
  document.querySelector('#enableAlerts').textContent = alertsEnabled ? 'Disable alerts' : 'Enable alerts';
  renderMetrics();
  renderTasks();
  renderInventory();
  renderSuggestions();
  renderAssistantPlan();
  renderAssistantDecision();
  renderSchedule();
  renderSchedulePdfs();
  renderCompass();
  renderPhotos();
  renderMessages();
  renderRoster();
  renderDailyBrief();
  refreshOperations();
  populatePhotoOwners();
  populateSchedulePdfOwners();
}

function renderDailyBrief() {
  const todayWorkflow = getWorkflowForToday();
  const event = getPlanningEvent();
  const daysLeft = getDaysUntilEvent(event);
  const dueToday = state.tasks.filter((task) => task.due <= isoToday && !task.done);
  const high = dueToday.filter((task) => task.priority === 'high');
  const brief = high.length
    ? `${high.length} high-priority item${high.length === 1 ? '' : 's'} need attention today. ${event.name} is ${daysLeft} day${daysLeft === 1 ? '' : 's'} away on ${formatDateLong(event.date)}. Today's workflow is ${todayWorkflow.code}: ${todayWorkflow.workflow}`
    : `${event.name} is ${daysLeft} day${daysLeft === 1 ? '' : 's'} away on ${formatDateLong(event.date)}. Today's workflow is ${todayWorkflow.code}: ${todayWorkflow.workflow} Keep the team moving through prep, recovery, and customer coverage.`;
  document.querySelector('#dailyBrief').textContent = brief;
  document.querySelector('#storeHealthPill').textContent = high.length > 2 ? 'At Risk' : 'On Track';
}

function renderMetrics() {
  const event = getPlanningEvent();
  const total = state.tasks.length;
  const done = state.tasks.filter((task) => task.done).length;
  const dueToday = state.tasks.filter((task) => task.due <= isoToday && !task.done).length;
  const eventOpen = getEventTasks(event).filter((task) => !task.done).length;

  const metrics = [
    [`${event.name} In`, `${getDaysUntilEvent(event)} days`],
    ['Due Today', dueToday],
    ['Event Open', eventOpen],
    ['Productive Time', formatMinutes(getTotalMinutes())]
  ];

  document.querySelector('#metricGrid').innerHTML = metrics
    .map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  const board = document.querySelector('#taskBoard');
  const scroll = board.scrollLeft;
  const sorted = [...visibleTasks].sort((a, b) => {
    const priorityScore = { high: 0, medium: 1, low: 2 };
    return priorityScore[a.priority] - priorityScore[b.priority] || a.due.localeCompare(b.due);
  });

  const filtered = activeFilter === 'completed' ? sorted.filter((task) => task.done) :
    sorted.filter((task) => !task.done && (activeFilter === 'all' || task.category === activeFilter));
  board.innerHTML = filtered.length
    ? filtered.map(taskTemplate).join('')
    : `<div class="empty-state">${isAssociateAccess() ? 'No tasks assigned to this team member yet.' : 'No tasks match this filter.'}</div>`;
  board.scrollLeft = scroll;
  document.querySelector('#priorityTaskList').innerHTML = sorted.filter((task) => !task.done).slice(0, 4).map(taskTemplate).join('');
  bindTaskControls(document.querySelector('#tasksView'));
  bindTaskControls(document.querySelector('#dashboardView'));
}

function bindTaskControls(scope) {
  scope.querySelectorAll('[data-task-toggle]').forEach((button) => {
    button.addEventListener('click', () => setTaskCompleted(button.dataset.taskToggle));
  });
  scope.querySelectorAll('[data-timer-task]').forEach((button) => {
    button.addEventListener('click', () => toggleTaskTimer(button.dataset.timerTask));
  });
  scope.querySelectorAll('[data-reassign-task]').forEach((select) => {
    select.addEventListener('change', () => {
      const task = state.tasks.find((item) => item.id === select.dataset.reassignTask);
      if (!task || !canUseManagerTools() || !select.value) return;
      task.owner = select.value;
      saveState();
      render();
    });
  });
  scope.querySelectorAll('[data-add-time]').forEach((button) => {
    button.addEventListener('click', () => addManualTime(button.dataset.addTime));
  });
}

function setTaskCompleted(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || !canWorkTask(task)) return;
  task.done = !task.done;
  if (task.done && state.activeTimer?.taskId === id) finishTaskTimer('finished');
  saveState();
  render();
}

function taskTemplate(task) {
  const photo = findPhoto(task.photoId);
  const timer = state.activeTimer?.taskId === task.id ? state.activeTimer : null;
  const label = timer ? (timer.startedAt ? 'Pause' : 'Resume') : 'Start';
  const ownerRole = getRoleForName(task.owner);
  const reassign = !task.done && canUseManagerTools() && ops.inactiveStaff(task.owner)
    ? `<label>Reassign from former staff <select data-reassign-task="${escapeHtml(task.id)}"><option value="">Choose owner</option>${state.team
      .map((person) => `<option value="${escapeHtml(person.name)}">${escapeHtml(person.name)}</option>`).join('')}</select></label>` : '';
  return `
    <article class="task-card ${task.done ? 'done' : ''}">
      <div>
        <p class="task-title">${escapeHtml(task.title)}</p>
        <div class="task-meta">${escapeHtml(capitalize(task.category))} - ${escapeHtml(task.owner)}${ownerRole ? ` - ${escapeHtml(ownerRole)}` : ''} - due ${formatDue(task.due)} ${escapeHtml(task.dueTime || '')}</div>
        <div class="subtle">${escapeHtml(task.notes || 'No notes added.')}</div>
        ${photo ? photoThumb(photo) : ''}
        ${reassign}
        <div class="task-actions">
          <span class="time-chip"${timer ? ' data-running-clock' : ''}>${timer ? timerLabel(timer) : formatMinutes(getTaskMinutes(task.id)) + ' logged'}</span>
          ${task.done ? '' : `<button class="secondary-button small-button" data-timer-task="${escapeHtml(task.id)}" type="button">${label}</button>`}
          <button class="secondary-button small-button" data-task-toggle="${escapeHtml(task.id)}" type="button">${task.done ? 'Reopen' : 'Complete'}</button>
          ${canUseManagerTools() ? `<button class="text-button small-button" data-add-time="${escapeHtml(task.id)}" type="button">Adjust time</button>` : ''}
        </div>
      </div>
      <span class="badge ${escapeHtml(task.priority)}">${escapeHtml(capitalize(task.priority))}</span>
    </article>
  `;
}

function timerLabel(timer) {
  const seconds = Math.floor(ops.timerElapsed(timer) / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + (timer.startedAt ? ' running' : ' paused');
}

function toggleTaskTimer(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.done || !canWorkTask(task)) return;
  const timer = state.activeTimer;
  if (timer?.taskId === id && timer.startedAt) {
    pauseTaskTimer('paused');
  } else {
    if (timer && timer.taskId !== id) finishTaskTimer('changed task');
    state.activeTimer = { id: crypto.randomUUID(), ...state.activeTimer, taskId: id, startedAt: new Date().toISOString(), elapsedMs: state.activeTimer?.elapsedMs || 0 };
  }
  saveState();
  render();
}

function pauseTaskTimer(reason) {
  if (!state.activeTimer?.startedAt) return;
  state.activeTimer.elapsedMs = ops.timerElapsed(state.activeTimer);
  state.activeTimer.startedAt = null;
  state.activeTimer.reason = reason;
}

function finishTaskTimer(reason) {
  const timer = state.activeTimer;
  if (!timer) return;
  const task = state.tasks.find((item) => item.id === timer.taskId);
  const seconds = Math.floor(ops.timerElapsed(timer) / 1000);
  if (seconds > 0) state.timeEntries.unshift({
    id: crypto.randomUUID(), taskId: timer.taskId, taskTitle: task?.title || 'Unknown task',
    owner: task?.owner || 'Unassigned', category: task?.category || 'general',
    minutes: seconds / 60, reason: timer.reason ? reason + ' · ' + timer.reason : reason, createdAt: new Date().toISOString()
  });
  state.activeTimer = null;
}

function addManualTime(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !canUseManagerTools()) return;
  const raw = prompt('Minutes to add or subtract for ' + task.owner + ':');
  if (raw === null) return;
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > 480 || getTaskMinutes(taskId) + minutes < 0) {
    return alert('Enter whole minutes between -480 and 480 without making the task time negative.');
  }
  const reason = prompt('Reason for the time adjustment:')?.trim();
  if (!reason) return;
  state.timeEntries.unshift({
    id: crypto.randomUUID(), taskId, taskTitle: task.title, owner: task.owner, category: task.category,
    minutes, reason, createdAt: new Date().toISOString()
  });
  saveState();
  render();
}

function handleWorkVisibility() {
  if (document.visibilityState === 'hidden') {
    hiddenSince = Date.now();
    return;
  }
  const timer = state.activeTimer;
  const dialog = document.querySelector('#workCheckDialog');
  if (timer?.startedAt && hiddenSince && Date.now() - Math.max(hiddenSince, Date.parse(timer.startedAt)) >= 15 * 60000 && !dialog.open) {
    checkTaskId = timer.taskId;
    dialog.returnValue = '';
    dialog.showModal();
  }
  hiddenSince = 0;
  refreshOperations();
}

function handleWorkCheck(event) {
  const action = event.target.returnValue;
  if (state.activeTimer?.taskId !== checkTaskId) return;
  if (action === 'finished') return setTaskCompleted(checkTaskId);
  if (action === 'changed') finishTaskTimer('changed task');
  else if (action === 'break' || action === 'interrupted') pauseTaskTimer(action);
  else if (!action) {
    pauseTaskTimer('Follow-up Opportunity: work context not confirmed');
    postOperationsAlert('Follow-up Opportunity', 'Timer paused until the work context is confirmed.', false);
  } else return;
  saveState();
  render();
}

function unlockAlertAudio() {
  if (!alertsEnabled) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    alertAudio ||= new Context();
    if (alertAudio.state === 'suspended') alertAudio.resume().catch(() => {});
  } catch {}
}

function playAlertSound() {
  if (alertAudio?.state !== 'running') return;
  const oscillator = alertAudio.createOscillator();
  const gain = alertAudio.createGain();
  const now = alertAudio.currentTime;
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  oscillator.connect(gain).connect(alertAudio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.4);
}

function postOperationsAlert(title, detail, notify = true) {
  const banner = document.querySelector('#operationsAlert');
  banner.textContent = title + ': ' + detail;
  banner.hidden = false;
  window.clearTimeout(dismissedAlertTimer);
  dismissedAlertTimer = window.setTimeout(() => { banner.hidden = true; }, 18000);
  if (notify) playAlertSound();
  if (notify && window.Notification?.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistration().then((registration) =>
      registration?.showNotification('StoreFlow', { body: title, tag: 'storeflow-operations' })
    ).catch(() => {});
  }
}

async function toggleOperationsAlerts() {
  alertsEnabled = !alertsEnabled;
  localStorage.setItem(alertSettingsKey, alertsEnabled ? 'on' : 'off');
  document.querySelector('#enableAlerts').textContent = alertsEnabled ? 'Disable alerts' : 'Enable alerts';
  if (!alertsEnabled) return postOperationsAlert('Alerts off', 'Due and timer alerts are off on this device.', false);
  unlockAlertAudio();
  if (window.Notification?.permission === 'default') {
    try { await window.Notification.requestPermission(); } catch {}
  }
  postOperationsAlert('Alerts on', 'StoreFlow checks due work and timer alarms while open.', false);
  refreshOperations();
}

function refreshOperations() {
  const timer = state.activeTimer;
  document.querySelectorAll('[data-running-clock]').forEach((clock) => {
    if (timer) clock.textContent = timerLabel(timer);
  });
  const now = new Date();
  const date = ops.dateKey(now);
  const phase = ops.recoveryAt(now);
  const recovery = document.querySelector('#recoveryPhase');
  if (recovery) recovery.textContent = phase.join(' — ');
  if (!alertsEnabled) return;
  const ring = (id, title, detail) => {
    if (firedAlerts.has(id)) return;
    firedAlerts.add(id);
    postOperationsAlert(title, detail);
  };
  for (const task of getVisibleTasks()) {
    if (task.done) continue;
    if (task.id === timer?.taskId && task.alarmMinutes > 0 && ops.timerElapsed(timer) >= task.alarmMinutes * 60000) {
      ring('timer:' + (timer.id || task.id), 'Task timer', task.title + ' reached ' + task.alarmMinutes + ' minutes.');
    }
    if (task.due === date && task.dueTime && Date.parse(date + 'T' + task.dueTime) <= now.getTime()) {
      ring('due:' + task.id + ':' + date, 'Task due', task.title);
    }
  }
  for (const reminder of state.reminders) {
    if (!reminder.done && reminder.due === date && (!isAssociateAccess() || reminder.owner === currentAccess.member)) {
      ring('reminder:' + reminder.id + ':' + date, 'Reminder due', reminder.title);
    }
  }
}

function renderSuggestions() {
  const todayWorkflow = getWorkflowForToday();
  const event = getPlanningEvent();
  const open = state.tasks.filter((task) => !task.done);
  const highDue = open.filter((task) => task.priority === 'high' && task.due <= isoToday);
  const planograms = open.filter((task) => ['planogram', 'reset'].includes(task.category));
  const training = open.filter((task) => task.category === 'training');
  const eventTasks = getEventTasks(event).filter((task) => !task.done);

  const suggestions = [
    highDue.length
      ? `Move ${highDue[0].owner} to "${highDue[0].title}" first and check back within 60 minutes.`
      : 'Use the first hour to verify compliance logs before the store gets busy.',
    planograms.length
      ? `Stage labels and discontinued product for ${planograms[0].owner} before the reset starts.`
      : 'Use recovery time to scan for missing labels, empty pegs, and damaged product.',
    training.length
      ? `Protect a quiet block for ${training[0].owner} to finish training without register interruptions.`
      : 'Ask each shift lead for one blocker before shift change and turn it into a task.',
    eventTasks.length
      ? `${event.name} is ${getDaysUntilEvent(event)} days away. Put tracked time on "${eventTasks[0].title}" today.`
      : 'Start a task timer when prep work begins so the next shift can see the time logged.',
    `Today is ${todayWorkflow.day} ${todayWorkflow.code}: ${todayWorkflow.workflow}`
  ];

  document.querySelector('#suggestionList').innerHTML = suggestions
    .map((text) => `<article class="suggestion">${escapeHtml(text)}</article>`)
    .join('');
}

function renderAssistantPlan() {
  const plan = buildDailyAssistantPlan();
  document.querySelector('#assistantPlan').innerHTML = plan
    .map(
      (item) => `
        <article class="assistant-step">
          <span class="assistant-time">${escapeHtml(item.time)}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p class="subtle">${escapeHtml(item.detail)}</p>
          </div>
        </article>
      `
    )
    .join('');
}

function previewCourseAction() {
  if (!canUseManagerTools()) return alert('Only manager access can rewrite the course of action.');
  const update = document.querySelector('#managerUpdateInput').value.trim();
  state.assistantDecision = buildCourseAction(update);
  saveState();
  renderAssistantDecision();
}

function applyCourseAction(event) {
  event.preventDefault();
  if (!canUseManagerTools()) return alert('Only manager access can send manager course actions.');
  const update = document.querySelector('#managerUpdateInput').value.trim();
  const decision = buildCourseAction(update);
  const result = applyAssistantDecision(decision);
  state.assistantDecision = { ...decision, appliedAt: new Date().toISOString(), result };
  document.querySelector('#managerUpdateInput').value = '';
  saveState();
  render();
  alert(`${result.tasks} task${result.tasks === 1 ? '' : 's'} created and ${result.messages} team message${result.messages === 1 ? '' : 's'} posted.`);
}

function renderAssistantDecision() {
  const container = document.querySelector('#assistantDecision');
  if (!state.assistantDecision) {
    container.innerHTML = '<div class="empty-state small-empty">Type a manager update, then rewrite the course of action or send tasks out.</div>';
    return;
  }

  const decision = state.assistantDecision;
  container.innerHTML = `
    <article class="course-card">
      <div class="workflow-title">
        <strong>${escapeHtml(decision.headline)}</strong>
        <span class="badge ${escapeHtml(decision.risk)}">${capitalize(decision.risk)}</span>
      </div>
      <p class="subtle">${escapeHtml(decision.summary)}</p>
      <div class="course-list">
        ${decision.actions
          .map(
            (action) => `
              <div class="course-action">
                <span class="assistant-time">${escapeHtml(action.when)}</span>
                <div>
                  <strong>${escapeHtml(action.owner)}: ${escapeHtml(action.title)}</strong>
                  <p class="subtle">${escapeHtml(action.notes)}</p>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
      ${
        decision.result
          ? `<p class="subtle">Last sent: ${decision.result.tasks} tasks and ${decision.result.messages} messages.</p>`
          : ''
      }
    </article>
  `;
}

function buildCourseAction(updateText) {
  const update = updateText || 'No new update entered. Build the plan from current tasks, schedule, Compass notes, and workflow.';
  const lower = update.toLowerCase();
  const todayWorkflow = getWorkflowForToday();
  const event = getPlanningEvent();
  const shifts = getTodayShifts();
  const open = state.tasks.filter((task) => !task.done);
  const overdue = open.filter((task) => task.due < isoToday);
  const highDue = open.filter((task) => task.priority === 'high' && task.due <= isoToday);
  const manager = getLeadershipOwner();
  const associate = findScheduledOwner(['Sales Associate']) || manager;
  const closer = [...shifts].reverse().find((shift) => timeToMinutes(shift.end) >= 17 * 60)?.name || associate;
  const signals = getCourseSignals(lower);
  const risk = signals.coverage || overdue.length || highDue.length > 2 ? 'high' : signals.compliance || signals.truck ? 'medium' : 'low';

  const actions = [];
  const addAction = (when, title, category, priority, owner, notes) => {
    const qualifiedOwner = requiresLeadership(`${category} ${title}`) && !isLeadershipRole(getRoleForName(owner)) ? getLeadershipOwner() : owner;
    actions.push({ when, title, category, priority, owner: qualifiedOwner, role: getRoleForName(qualifiedOwner), notes });
  };

  if (signals.coverage) {
    addAction('Now', 'Reset coverage and protect register/customer flow', 'schedule', 'high', manager, 'Reassign breaks, register coverage, and task owners based on who is actually present.');
  }

  if (signals.compliance || highDue.some((task) => task.category === 'compliance')) {
    addAction('First', 'Clear compliance before project work', 'compliance', 'high', manager, 'Complete safety walk, required logs, Compass action items, and anything due today before resets or freight.');
  }

  if (signals.truck || todayWorkflow.workflow.toLowerCase().includes('truck')) {
    addAction('Next', 'Stabilize truck and receiving room flow', 'truck', 'high', associate, `${todayWorkflow.workflow}. Stage freight, separate urgent totes, and keep one person accountable for progress updates.`);
  }

  if (signals.inventory || signals.clearance || getDaysUntilEvent(event) <= 2) {
    addAction('Today', `Protect ${event.name} readiness`, 'inventory', 'high', manager, getEventReadinessNote(event));
  }

  if (signals.planogram || open.some((task) => ['planogram', 'reset'].includes(task.category))) {
    addAction('Block', 'Assign one focused planogram/reset block', 'planogram', 'medium', associate, 'Only start the reset if coverage is stable. Stage labels, discontinued product, and needed fixtures first.');
  }

  if (signals.training || open.some((task) => task.category === 'training')) {
    addAction('Window', 'Protect a training window', 'training', 'medium', associate, 'Use the quietest coverage window. Do not pull the trainee back unless customer coverage breaks.');
  }

  getTriggeredStandards(lower).slice(0, 3).forEach((standard) => {
    const owner = requiresLeadership(standard.area) || standard.ownerLevel.toLowerCase().includes('manager') ? manager : associate;
    addAction('Standard', `Verify ${standard.area}`, getStandardCategory(standard), 'medium', owner, standard.checks[0]);
  });

  addAction('Close', 'Finish with recovery and progress check', 'reset', 'medium', closer, 'Before shift change, update incomplete tasks, log time, and recover front end plus first 30 feet.');

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input: update,
    risk,
    headline: risk === 'high' ? 'Course correction needed' : risk === 'medium' ? 'Adjusted plan' : 'Stay the course',
    summary: buildCourseSummary(update, todayWorkflow, shifts, highDue, overdue, signals),
    actions: actions.slice(0, 7)
  };
}

function getCourseSignals(lower) {
  const hasAny = (words) => words.some((word) => lower.includes(word));
  return {
    coverage: hasAny(['call out', 'called out', 'short', 'coverage', 'late', 'no show', 'alone', 'break']),
    compliance: hasAny(['compliance', 'safety', 'temperature', 'temp', 'rotation', 'damages', 'hht', 'price change', 'compass']),
    truck: hasAny(['truck', 'freight', 'rolltainer', 'tote', 'toppers', 'receiving', 'backstock']),
    inventory: hasAny(['inventory', 'count', 'nones', 'tons', 'dry damages', 'backroom']),
    clearance: hasAny(['clearance', 'markdown', 'sale event', 'event table', 'clearance event']),
    planogram: hasAny(['planogram', 'pog', 'reset', 'sky shelf', 'endcap', 'mag']),
    training: hasAny(['training', 'cbl', 'learn', 'module']),
    recovery: hasAny(['recovery', 'recover', 'facing', 'front end', 'first 30']),
    standards: getTriggeredStandards(lower).length > 0
  };
}

function getTriggeredStandards(lower) {
  if (!lower) return [];
  return companyStandards.filter((standard) => standard.triggers.some((trigger) => lower.includes(trigger)));
}

function getStandardCategory(standard) {
  const area = standard.area.toLowerCase();
  if (area.includes('respond') || area.includes('compliance') || area.includes('observation') || area.includes('override')) return 'compliance';
  if (area.includes('mag') || area.includes('pog')) return 'planogram';
  if (area.includes('truck') || area.includes('stocking') || area.includes('scanning')) return 'truck';
  if (area.includes('department') || area.includes('mm')) return 'inventory';
  return 'compliance';
}

function buildCourseSummary(update, workflow, shifts, highDue, overdue, signals) {
  const event = getPlanningEvent();
  const signalText = Object.entries(signals)
    .filter(([, active]) => active)
    .map(([name]) => name)
    .join(', ') || 'current app data';
  return `Input considered: ${update} Today is ${workflow.day} ${workflow.code}. Scheduled today: ${shifts.length}. High due: ${highDue.length}. Overdue: ${overdue.length}. ${event.name}: ${getDaysUntilEvent(event)} days out. Main signal: ${signalText}.`;
}

function applyAssistantDecision(decision) {
  let tasks = 0;
  let messages = 0;

  decision.actions.forEach((action) => {
    const title = `Assistant: ${action.title}`;
    const exists = state.tasks.some((task) => task.title === title && task.owner === action.owner && task.due === isoToday);
    if (!exists) {
      state.tasks.unshift({
        id: crypto.randomUUID(),
        title,
        category: action.category,
        priority: action.priority,
        owner: action.owner,
        due: isoToday,
        notes: `${action.when}: ${action.notes}`,
        done: false
      });
      tasks += 1;
    }

    state.messages.unshift({
      id: crypto.randomUUID(),
      from: 'StoreFlow Assistant',
      body: `${action.owner}: ${action.title}. ${action.notes}`,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    });
    messages += 1;
  });

  return { tasks, messages };
}

function buildDailyAssistantPlan() {
  const todayWorkflow = getWorkflowForToday();
  const shifts = getTodayShifts();
  const open = state.tasks.filter((task) => !task.done);
  const dueNow = open.filter((task) => task.due <= isoToday);
  const highDue = dueNow.filter((task) => task.priority === 'high');
  const coverageLead = shifts[0]?.name || getFallbackOwner().name;
  const complianceOwner = getLeadershipOwner();
  const floorOwner = findScheduledOwner(['Sales Associate']) || coverageLead;
  const nextPriority = highDue[0] || dueNow[0] || open[0];
  const compassSignal = state.compassNotes[0]?.body || 'No Compass note entered yet. Add the key update, then create routine checks.';
  const pdfSignal = state.schedulePdfs.length
    ? `${state.schedulePdfs.length} schedule PDF reference${state.schedulePdfs.length === 1 ? '' : 's'} uploaded.`
    : 'No schedule PDF reference uploaded yet.';

  return [
    {
      time: 'Start',
      title: 'Read Compass, then lock the first priority',
      detail: nextPriority
        ? `${complianceOwner} should start with "${nextPriority.title}". Compass signal: ${compassSignal}`
        : `${complianceOwner} should review Compass and create the first task before the store gets busy.`
    },
    {
      time: 'Coverage',
      title: 'Use the schedule to assign work',
      detail: shifts.length
        ? `${shifts.length} person${shifts.length === 1 ? '' : 's'} scheduled today. First coverage: ${shifts
            .slice(0, 3)
            .map((shift) => `${shift.name} ${formatTimeRange(shift)}`)
            .join(', ')}.`
        : 'No shifts are entered for today yet. Add the schedule so the app can assign work to people who are actually here.'
    },
    {
      time: 'Workflow',
      title: `${todayWorkflow.day} ${todayWorkflow.code}`,
      detail: `${todayWorkflow.workflow}${todayWorkflow.weekly ? ` Weekly duty: ${todayWorkflow.weekly}` : ''}`
    },
    {
      time: 'Routine',
      title: 'Create daily checks instead of remembering them',
      detail: `Use Create routine checks to add compliance, recovery, perishable, and workflow tasks for ${floorOwner}. ${pdfSignal}`
    },
    {
      time: 'Close',
      title: 'Check progress before shift change',
      detail: `Open items due today: ${dueNow.length}. High priority: ${highDue.length}. Log time on active work so you can see where the day went.`
    }
  ];
}

function buildRoutineChecks() {
  if (!canUseManagerTools()) return alert('Only manager access can create routine checks.');
  const todayWorkflow = getWorkflowForToday();
  const tasksToCreate = [
    {
      title: `Compass review and daily direction: ${todayWorkflow.code}`,
      category: 'compliance',
      priority: 'high',
      owner: getLeadershipOwner(),
      notes: `Review Compass, confirm today's workflow, and post direction for each scheduled person. Workflow: ${todayWorkflow.workflow}`
    },
    ...dailyActivities.map((activity) => ({
      title: `Daily check: ${activity.replace(/\.$/, '')}`,
      category: activity.toLowerCase().includes('recovery') ? 'reset' : 'compliance',
      priority: activity.toLowerCase().includes('perishable') || activity.toLowerCase().includes('balance impulse') ? 'high' : 'medium',
      owner: chooseRoutineOwner(activity),
      notes: activity
    }))
  ];

  if (todayWorkflow.weekly) {
    tasksToCreate.push({
      title: `Weekly workflow: ${todayWorkflow.weekly.replace(/\.$/, '')}`,
      category: 'compliance',
      priority: 'high',
      owner: getLeadershipOwner(),
      notes: todayWorkflow.weekly
    });
  }

  if (todayWorkflow.freshTruck) {
    tasksToCreate.push({
      title: `Fresh truck routine: ${todayWorkflow.code}`,
      category: 'truck',
      priority: 'high',
      owner: chooseRoutineOwner(todayWorkflow.freshTruck),
      notes: todayWorkflow.freshTruck
    });
  }

  if (todayWorkflow.day === 'Tuesday') {
    complianceTuesdayTasks.forEach((task) => {
      tasksToCreate.push({
        title: `Compliance Tuesday: ${task.replace(/\.$/, '')}`,
        category: 'compliance',
        priority: 'high',
        owner: getLeadershipOwner(),
        notes: task
      });
    });
  }

  let added = 0;
  tasksToCreate.forEach((task) => {
    const exists = state.tasks.some((existing) => existing.title === task.title && existing.due === isoToday);
    if (exists) return;
    state.tasks.unshift({
      id: crypto.randomUUID(),
      ...task,
      due: isoToday,
      done: false
    });
    added += 1;
  });

  saveState();
  render();
  alert(added ? `${added} routine check${added === 1 ? '' : 's'} added for today.` : "Routine checks are already on today's task board.");
}

function getTodayShifts() {
  return state.schedule
    .filter((shift) => shift.date === isoToday && !ops.inactiveStaff(shift.name))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function findScheduledOwner(roleKeywords) {
  const shifts = getTodayShifts();
  const match = shifts.find((shift) => roleKeywords.some((keyword) => shift.position.toLowerCase().includes(keyword.toLowerCase())));
  return match?.name || '';
}

function chooseRoutineOwner(text) {
  const lower = text.toLowerCase();
  if (lower.includes('register') || lower.includes('front') || lower.includes('balance impulse')) {
    return findScheduledOwner(['Sales Associate']) || getFallbackOwner().name;
  }
  if (lower.includes('recovery') || lower.includes('stock') || lower.includes('receiving')) {
    return findScheduledOwner(['Sales Associate']) || findScheduledOwner(['Assistant Store Manager']) || getFallbackOwner().name;
  }
  return getLeadershipOwner();
}

function getWorkflowForToday() {
  return sevenDayWorkflow.find((item) => item.day === dayNames[today.getDay()]) || sevenDayWorkflow[0];
}

function renderInventory() {
  const event = getPlanningEvent();
  const daysLeft = getDaysUntilEvent(event);
  document.querySelector('#eventPlannerTitle').textContent = `${event.name} Planner`;
  document.querySelector('#eventNameInput').value = event.name;
  document.querySelector('#eventDateInput').value = event.date;
  document.querySelector('#eventFocusInput').value = event.focus;

  const eventTasks = getEventTasks(event).filter((task) => !task.done)
    .sort((a, b) => a.due.localeCompare(b.due));
  const openEventTasks = eventTasks.filter((task) => !task.done).length;
  const dueReminders = state.reminders.filter((reminder) => isCurrentEventItem(reminder, event) && reminder.due <= isoToday && !reminder.done).length;

  document.querySelector('#inventorySummary').innerHTML = `
    <article class="inventory-countdown">
      <span class="store-label">${escapeHtml(capitalize(event.focus))} date</span>
      <strong>${escapeHtml(formatDateLong(event.date))}</strong>
      <p>${daysLeft} day${daysLeft === 1 ? '' : 's'} left. ${openEventTasks} ${escapeHtml(event.name.toLowerCase())} prep task${openEventTasks === 1 ? '' : 's'} still open. ${dueReminders} reminder${dueReminders === 1 ? '' : 's'} due now.</p>
    </article>
  `;

  document.querySelector('#inventoryTaskList').innerHTML = eventTasks.length
    ? eventTasks.map(taskTemplate).join('')
    : `<div class="empty-state">No ${escapeHtml(event.name.toLowerCase())} prep tasks yet. Add a prep plan to start tracking readiness.</div>`;

  document.querySelector('#reminderList').innerHTML = state.reminders
    .filter((reminder) => isCurrentEventItem(reminder, event))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due))
    .map((reminder) => `
      <article class="reminder ${reminder.done ? 'done' : ''}">
        <input type="checkbox" ${reminder.done ? 'checked' : ''} data-reminder-toggle="${reminder.id}" aria-label="Complete ${escapeHtml(reminder.title)}">
        <div>
          <strong>${escapeHtml(reminder.title)}</strong>
          <div class="task-meta">${escapeHtml(reminder.owner)} · due ${formatDue(reminder.due)}</div>
          <p class="subtle">${escapeHtml(reminder.notes)}</p>
        </div>
      </article>
    `)
    .join('');

  document.querySelectorAll('[data-reminder-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const reminder = state.reminders.find((item) => item.id === checkbox.dataset.reminderToggle);
      reminder.done = checkbox.checked;
      saveState();
      renderInventory();
    });
  });

  bindTaskControls(document.querySelector('#inventoryView'));
  renderTimeSummary();
}

function renderTimeSummary() {
  const categoryTotals = getMinutesBy('category');
  const ownerTotals = getMinutesBy('owner');
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const topOwners = Object.entries(ownerTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  document.querySelector('#timeSummary').innerHTML = `
    <div class="time-stat"><span>Total logged</span><strong>${formatMinutes(getTotalMinutes())}</strong></div>
    <div class="time-stat"><span>Event prep</span><strong>${formatMinutes(categoryTotals.inventory || 0)}</strong></div>
    <div class="time-stat"><span>Active timer</span><strong>${state.activeTimer ? (state.activeTimer.startedAt ? 'Running' : 'Paused') : 'None'}</strong></div>
    <div class="time-breakdown">
      <strong>By category</strong>
      ${topCategories.map(([label, minutes]) => `<p>${escapeHtml(capitalize(label))}: ${formatMinutes(minutes)}</p>`).join('') || '<p>No time logged yet.</p>'}
    </div>
    <div class="time-breakdown">
      <strong>By person</strong>
      ${topOwners.map(([label, minutes]) => `<p>${escapeHtml(label)}: ${formatMinutes(minutes)}</p>`).join('') || '<p>No time logged yet.</p>'}
    </div>
  `;

  document.querySelector('#timeLog').innerHTML = state.timeEntries.slice(0, 8)
    .map((entry) => `
      <article class="time-entry">
        <strong>${escapeHtml(entry.taskTitle)}</strong>
        <div class="task-meta">${escapeHtml(entry.owner)} · ${escapeHtml(capitalize(entry.category))} · ${formatMinutes(entry.minutes)}</div>
      </article>
    `)
    .join('');
}

function renderPhotos() {
  const container = document.querySelector('#photoGrid');
  if (!state.photos.length) {
    container.innerHTML = '<div class="empty-state">Upload Compass screenshots, planogram photos, compliance notes, backroom issues, or recovery photos to coordinate follow-up.</div>';
    return;
  }

  container.innerHTML = state.photos
    .map((photo) => `
      <article class="photo-card">
        <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}">
        <div class="photo-body">
          <div class="photo-title">
            <strong>${escapeHtml(capitalize(photo.category))}</strong>
            <span class="badge medium">${escapeHtml(photo.owner)}</span>
          </div>
          <p class="subtle">${escapeHtml(photo.instruction)}</p>
          <div class="photo-actions">
            <button class="secondary-button" data-photo-task="${photo.id}" type="button">Task</button>
            <button class="secondary-button" data-photo-message="${photo.id}" type="button">Message</button>
          </div>
        </div>
      </article>
    `)
    .join('');

  document.querySelectorAll('[data-photo-task]').forEach((button) => {
    button.addEventListener('click', () => createTaskFromPhoto(button.dataset.photoTask));
  });

  document.querySelectorAll('[data-photo-message]').forEach((button) => {
    button.addEventListener('click', () => createMessageFromPhoto(button.dataset.photoMessage));
  });
}

function renderSchedulePdfs() {
  const container = document.querySelector('#schedulePdfList');
  const references = state.schedulePdfs.filter((pdf) => pdf.week === activeScheduleWeek);
  if (!references.length) {
    container.innerHTML = '<div class="empty-state">No schedule references for this week.</div>';
    return;
  }

  container.innerHTML = references
    .map((pdf) => {
      const dataUrl = pdf.dataUrl || state.schedulePdfs.find((source) => source.id === pdf.referenceId)?.dataUrl;
      const safePdf = /^data:application\/pdf;base64,[\w+/=]+$/.test(dataUrl || '') ? dataUrl : '';
      return `
      <article class="schedule-pdf-card">
        <div class="pdf-title">
          <div>
            <strong>${escapeHtml(pdf.name)}</strong>
            <div class="task-meta">Week ${pdf.week + 1} · ${escapeHtml(pdf.owner)} · ${formatFileSize(pdf.size)}</div>
          </div>
          <span class="badge ${safePdf ? 'low' : 'medium'}">${safePdf ? 'Saved' : 'Reference details'}</span>
        </div>
        <p class="subtle">${escapeHtml(pdf.notes)}</p>
        ${
          safePdf
            ? `<object class="pdf-preview" data="${safePdf}" type="application/pdf"><a href="${safePdf}" download="${escapeHtml(pdf.name)}">Open PDF</a></object>`
            : '<div class="empty-state small-empty">Keep the original file for reference.</div>'
        }
        ${
          pdf.extractedText
            ? `<details class="pdf-text"><summary>Possible extracted text</summary><p>${escapeHtml(pdf.extractedText)}</p></details>`
            : ''
        }
      </article>
    `;
    })
    .join('');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getDaysUntilInventory() {
  const target = new Date(`${inventoryDate}T12:00:00`);
  const current = new Date(`${isoToday}T12:00:00`);
  return Math.max(0, Math.ceil((target - current) / 86400000));
}

function getPlanningEvent() {
  return normalizePlanningEvent(state.planningEvent);
}

function normalizePlanningEvent(event) {
  return {
    ...defaultPlanningEvent,
    ...(event || {}),
    name: event?.name || defaultPlanningEvent.name,
    date: event?.date || defaultPlanningEvent.date,
    focus: event?.focus || defaultPlanningEvent.focus,
    id: event?.id || `${event?.focus || defaultPlanningEvent.focus}-${event?.date || defaultPlanningEvent.date}`
  };
}

function getDaysUntilEvent(event = getPlanningEvent()) {
  const target = new Date(`${event.date}T12:00:00`);
  const current = new Date(`${isoToday}T12:00:00`);
  return Math.max(0, Math.ceil((target - current) / 86400000));
}

function getEventTasks(event = getPlanningEvent()) {
  return state.tasks.filter((task) => isCurrentEventItem(task, event));
}

function isCurrentEventItem(item, event = getPlanningEvent()) {
  if (item.eventId) return item.eventId === event.id;
  return event.focus === 'inventory' && item.category === 'inventory';
}

function getEventReadinessNote(event = getPlanningEvent()) {
  if (event.focus === 'clearance') {
    return 'Focus on clearance signs, markdown labels, event tables, seasonal/clearance sections, damaged items, and final manager walk before the event date.';
  }
  if (event.focus === 'reset') {
    return 'Focus on planogram materials, labels, discontinued product, fixture needs, set completion, and final recovery.';
  }
  if (event.focus === 'seasonal') {
    return 'Focus on seasonal fill, event product, MAG/endcap execution, signing, and customer-ready recovery.';
  }
  return 'Focus on backroom organization, nones/tons, damages, first 30 feet recovery, and anything that could slow counting.';
}

function getTaskMinutes(taskId) {
  const logged = state.timeEntries
    .filter((entry) => entry.taskId === taskId)
    .reduce((sum, entry) => sum + entry.minutes, 0);
  if (state.activeTimer?.taskId !== taskId) return logged;
  const running = ops.timerElapsed(state.activeTimer) / 60000;
  return logged + running;
}

function getTotalMinutes() {
  return state.tasks.reduce((sum, task) => sum + getTaskMinutes(task.id), 0);
}

function getMinutesBy(field) {
  return state.timeEntries.reduce((totals, entry) => {
    const key = entry[field] || 'unknown';
    totals[key] = (totals[key] || 0) + entry.minutes;
    return totals;
  }, {});
}

function formatMinutes(minutes) {
  minutes = Math.max(0, Math.floor(minutes || 0));
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function createTaskFromPhoto(photoId) {
  const photo = findPhoto(photoId);
  if (!photo) return;
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title: photo.category === 'schedule' ? 'Schedule photo follow-up' : `Photo follow-up: ${capitalize(photo.category)}`,
    category: photo.category === 'compass' ? 'compliance' : photo.category,
    priority: ['compliance', 'planogram', 'truck', 'schedule'].includes(photo.category) ? 'high' : 'medium',
    owner: photo.owner,
    due: isoToday,
    notes: photo.category === 'schedule'
      ? `${photo.instruction} Schedule photos are saved as references; roster updates from shifts entered on the Schedule tab.`
      : photo.instruction,
    photoId: photo.id,
    done: false
  });
  saveState();
  render();
  setView('tasks');
}

function createMessageFromPhoto(photoId) {
  const photo = findPhoto(photoId);
  if (!photo) return;
  state.messages.unshift({
    id: crypto.randomUUID(),
    from: 'Chris C.',
    body: photo.category === 'schedule'
      ? `${photo.owner}: ${photo.instruction} Add or update shifts on the Schedule tab so the roster refreshes.`
      : `${photo.owner}: ${photo.instruction}`,
    time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    photoId: photo.id
  });
  saveState();
  render();
  setView('team');
}

function findPhoto(photoId) {
  if (!photoId) return null;
  return state.photos.find((photo) => photo.id === photoId) || null;
}

function photoThumb(photo) {
  return `<img class="inline-photo" src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}">`;
}

function renderSchedule() {
  document.querySelectorAll('[data-schedule-week]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.scheduleWeek) === activeScheduleWeek);
  });

  const weekDates = getScheduleWeekDates(activeScheduleWeek);
  const imported = state.scheduleWeeks.find((entry) => entry.week === activeScheduleWeek);
  const source = document.querySelector('#scheduleWeekSource');
  if (source) source.textContent = imported ? 'Published source: ' + imported.source : 'No published schedule has been applied for this week.';
  const select = document.querySelector('#schedulePdfWeek');
  select.value = String(activeScheduleWeek);
  if (!document.querySelector('#scheduleImportStart').value) document.querySelector('#scheduleImportStart').value = weekDates[0];
  const weekShifts = state.schedule.filter((shift) => weekDates.includes(shift.date));
  const totalHours = weekShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
  const people = new Set(weekShifts.map((shift) => shift.name)).size;

  document.querySelector('#scheduleStats').innerHTML = `
    <article class="schedule-stat"><span>Week</span><strong>${formatDateShort(weekDates[0])} - ${formatDateShort(weekDates[6])}</strong></article>
    <article class="schedule-stat"><span>Scheduled</span><strong>${totalHours.toFixed(2)} hrs</strong></article>
    <article class="schedule-stat"><span>Team Members</span><strong>${people}</strong></article>
  `;

  document.querySelector('#scheduleGrid').innerHTML = weekDates
    .map((date) => {
      const shifts = state.schedule
        .filter((shift) => shift.date === date)
        .sort((a, b) => a.start.localeCompare(b.start));
      const dayHours = shifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
      return `
        <article class="schedule-day ${date === isoToday ? 'today' : ''}">
          <div class="schedule-day-head">
            <strong>${dayNames[new Date(`${date}T12:00:00`).getDay()]}</strong>
            <span>${formatDateShort(date)}</span>
            <small>${dayHours.toFixed(2)} hrs · ${shifts.length} TM${shifts.length === 1 ? '' : 's'}</small>
          </div>
          <div class="schedule-shifts">
            ${
              shifts.length
                ? shifts.map(scheduleShiftTemplate).join('')
                : '<div class="empty-state small-empty">No shifts</div>'
            }
          </div>
        </article>
      `;
    })
    .join('');

  const todayShifts = getTodayShifts();

  document.querySelector('#scheduleList').innerHTML = todayShifts.length
    ? todayShifts.map((shift) => `
        <article class="shift">
          <div>
            <strong>${escapeHtml(shift.name)}</strong>
            <div class="task-meta">${escapeHtml(shift.position)} · ${formatTimeRange(shift)}</div>
            <div class="subtle">${escapeHtml(shift.direction)}</div>
          </div>
          <span class="badge low">${getShiftHours(shift).toFixed(1)}h</span>
        </article>
      `).join('')
    : '<div class="empty-state">No shifts are scheduled for today.</div>';

  const todayDirection = todayShifts;
  document.querySelector('#positionList').innerHTML = todayDirection.length
    ? todayDirection
    .map((shift) => `
      <article class="position-card">
        <strong>${escapeHtml(shift.position)}</strong>
        <p class="subtle">${escapeHtml(shift.name)}: ${escapeHtml(shift.direction)}</p>
      </article>
    `)
    .join('')
    : '<div class="empty-state">No position direction is scheduled for today.</div>';
}

function scheduleShiftTemplate(shift) {
  const initials = shift.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return `
    <div class="schedule-shift">
      <span class="avatar">${escapeHtml(initials)}</span>
      <div>
        <strong>${escapeHtml(shift.name)}</strong>
        <span>${formatTimeRange(shift)}</span>
        <small>${escapeHtml(shift.position)}</small>
      </div>
    </div>
  `;
}

function getScheduleWeekDates(offset) {
  const start = ops.scheduleWeekStarts(state.scheduleWeeks, ops.dateKey())[offset];
  return Array.from({ length: 7 }, (_, index) => ops.shiftDate(start, index));
}

function getShiftHours(shift) {
  const start = timeToMinutes(shift.start);
  let end = timeToMinutes(shift.end);
  if (end <= start) end += 1440;
  return (end - start) / 60;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTimeRange(shift) {
  return `${formatTime(shift.start)} - ${formatTime(shift.end)}`;
}

function formatTime(value) {
  const [hourValue, minute] = value.split(':').map(Number);
  const marker = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${marker}`;
}

function formatDateShort(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateLong(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderCompass() {
  document.querySelector('#compassNotes').innerHTML = state.compassNotes
    .map((note) => `
      <article class="note">
        <strong>${escapeHtml(note.title)}</strong>
        <p class="subtle">${escapeHtml(note.body)}</p>
      </article>
    `)
    .join('');

  document.querySelector('#workflowList').innerHTML = sevenDayWorkflow
    .map((item) => `
      <article class="workflow-day">
        <div class="workflow-title">
          <strong>${escapeHtml(item.day)}</strong>
          <span class="badge medium">${escapeHtml(item.code)}</span>
        </div>
        ${workflowLine('Weekly', item.weekly)}
        ${workflowLine('7-Day', item.workflow)}
        ${workflowLine('Fresh Truck', item.freshTruck)}
        ${workflowLine('Nightly', item.nightly)}
      </article>
    `)
    .join('') + `
      <article class="workflow-day">
        <div class="workflow-title">
          <strong>Compliance Tuesday</strong>
          <span class="badge high">Required</span>
        </div>
        <ul>${complianceTuesdayTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join('')}</ul>
      </article>
      <article class="workflow-day">
        <div class="workflow-title">
          <strong>Daily Activities</strong>
          <span class="badge low">Every Day</span>
        </div>
        <ul>${dailyActivities.map((task) => `<li>${escapeHtml(task)}</li>`).join('')}</ul>
      </article>
    `;

  document.querySelector('#standardsList').innerHTML = companyStandards
    .map(
      (standard) => `
        <article class="standard-card">
          <div class="workflow-title">
            <strong>${escapeHtml(standard.area)}</strong>
            <span class="badge medium">${escapeHtml(standard.ownerLevel)}</span>
          </div>
          <ul>${standard.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join('')}</ul>
        </article>
      `
    )
    .join('');
}

function workflowLine(label, value) {
  if (!value) return '';
  return `
    <div class="workflow-line">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value)}</p>
    </div>
  `;
}

function renderMessages() {
  document.querySelector('#messageList').innerHTML = state.messages
    .map((message) => {
      const photo = findPhoto(message.photoId);
      return `
        <article class="message">
          <strong>${escapeHtml(message.from)}</strong>
          <span class="task-meta">${escapeHtml(message.time)}</span>
          <p class="subtle">${escapeHtml(message.body)}</p>
          ${photo ? photoThumb(photo) : ''}
        </article>
      `;
    })
    .join('');
}

function renderRoster() {
  const roster = getRosterFromSchedule();
  document.querySelector('#rosterList').innerHTML = roster.length
    ? roster
    .map((member) => `
      <article class="person">
        <div class="person-heading">
          <span class="avatar">${escapeHtml(member.initials)}</span>
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <div class="task-meta">${escapeHtml(member.role)}</div>
          </div>
        </div>
        <div class="roster-stats">
          <span>${member.shiftCount} shift${member.shiftCount === 1 ? '' : 's'}</span>
          <span>${member.hours.toFixed(1)} hrs</span>
          <span>${member.worksToday ? 'Works today' : 'Next shift'}</span>
        </div>
        <div class="subtle">${member.nextShift ? `${formatDateShort(member.nextShift.date)} · ${formatTimeRange(member.nextShift)} · ${member.nextShift.direction}` : 'No upcoming shift scheduled.'}</div>
      </article>
    `)
    .join('')
    : '<div class="empty-state">No scheduled team members yet. Add shifts on the Schedule tab and the roster will update automatically.</div>';
}

function getRosterFromSchedule() {
  const teamByName = new Map(state.team.map((member) => [member.name, member]));
  const upcoming = state.schedule
    .filter((shift) => shift.date >= isoToday)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const rosterMap = new Map(state.team.map((person) => [person.name, {
    name: person.name, role: person.role, initials: getInitials(person.name),
    shiftCount: 0, hours: 0, worksToday: false, nextShift: null
  }]));

  state.schedule.forEach((shift) => {
    if (ops.inactiveStaff(shift.name)) return;
    const existing = rosterMap.get(shift.name);
    const base = teamByName.get(shift.name);
    const nextShift = upcoming.find((item) => item.name === shift.name) || null;
    const current = existing || {
      name: shift.name,
      role: base?.role || shift.position,
      initials: getInitials(shift.name),
      shiftCount: 0,
      hours: 0,
      worksToday: false,
      nextShift
    };

    current.role = base?.role || getPrimaryRole(current.role, shift.position);
    current.shiftCount += 1;
    current.hours += getShiftHours(shift);
    current.worksToday = current.worksToday || shift.date === isoToday;
    current.nextShift = current.nextShift || nextShift;
    rosterMap.set(shift.name, current);
  });

  return [...rosterMap.values()].sort((a, b) => {
    if (a.worksToday !== b.worksToday) return a.worksToday ? -1 : 1;
    if (a.nextShift && b.nextShift) return a.nextShift.date.localeCompare(b.nextShift.date) || a.name.localeCompare(b.name);
    if (a.nextShift) return -1;
    if (b.nextShift) return 1;
    return a.name.localeCompare(b.name);
  });
}

function getLeadershipRoster() {
  const leaders = getRosterFromSchedule().filter((member) => isLeadershipRole(member.role));
  return leaders.length ? leaders : [sampleState.team[0]];
}

function getLeadershipOwner() {
  const todayLeader = getTodayShifts()
    .map((shift) => ({ name: shift.name, role: getPrimaryRole(getRoleForName(shift.name), shift.position) }))
    .find((member) => isLeadershipRole(member.role));
  return todayLeader?.name || getLeadershipRoster()[0]?.name || getFallbackOwner().name;
}

function getRoleForName(name) {
  if (!name) return '';
  return getRosterFromSchedule().find((member) => member.name === name)?.role || state.team.find((member) => member.name === name)?.role || '';
}

function isLeadershipRole(role = '') {
  const normalized = role.toLowerCase();
  return ['store manager', 'assistant store manager', 'assistant manager', 'asm', 'key holder', 'keyholder', 'lead sales associate'].some((keyword) =>
    normalized.includes(keyword)
  );
}

function requiresLeadership(taskOrCategory) {
  const value = String(taskOrCategory || '').toLowerCase();
  return ['schedule', 'compliance', 'compass', 'safety', 'course correction', 'daily direction'].some((keyword) => value.includes(keyword));
}

function getFallbackOwner() {
  return getRosterFromSchedule()[0] || sampleState.team[0] || { name: 'Team Member' };
}

function getRotatingOwner() {
  const roster = getRosterFromSchedule();
  return roster[state.tasks.length % Math.max(roster.length, 1)] || getFallbackOwner();
}

function getPrimaryRole(currentRole, nextRole) {
  const currentLevel = getRoleLevel(currentRole);
  const nextLevel = getRoleLevel(nextRole);
  if (nextLevel > currentLevel) return nextRole;
  return currentRole || nextRole;
}

function getRoleLevel(role = '') {
  const normalized = role.toLowerCase();
  if (normalized.includes('store manager')) return 5;
  if (normalized.includes('assistant store manager') || normalized.includes('assistant manager') || normalized.includes('asm')) return 4;
  if (normalized.includes('key holder') || normalized.includes('keyholder') || normalized.includes('lead sales associate')) return 3;
  if (normalized.includes('sales associate') || normalized.includes('associate')) return 1;
  return 0;
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDue(value) {
  if (value === isoToday) return 'today';
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
