const storageKey = 'dg-storeflow-state-v1';
const appVersion = '2026.06.26.4';

const today = new Date();
const isoToday = today.toISOString().slice(0, 10);
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const inventoryDate = '2026-06-25';
const inventoryLabel = 'June 25, 2026';
const defaultPlanningEvent = {
  id: 'clearance-event',
  name: 'Clearance Event',
  date: '2026-07-15',
  focus: 'clearance'
};
const scheduleStartDate = '2026-06-13';

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

const sampleState = {
  team: [
    { id: 't1', name: 'Chris C.', role: 'Store Manager', strength: 'workflow and compliance' },
    { id: 't2', name: 'Sarah I.', role: 'Assistant Store Manager', strength: 'opening manager and compliance' },
    { id: 't3', name: 'Alicia T.', role: 'Sales Associate', strength: 'front end and customer coverage' },
    { id: 't4', name: 'Blaire M.', role: 'Sales Associate', strength: 'stocking and closing coverage' },
    { id: 't5', name: 'Elvis J.', role: 'Sales Associate', strength: 'recovery and closing' },
    { id: 't6', name: 'Louis C.', role: 'Sales Associate', strength: 'core freight and sales floor support' },
    { id: 't7', name: 'Carlton R.', role: 'Sales Associate', strength: 'recovery and planogram support' },
    { id: 't8', name: 'Jazmin G.', role: 'Sales Associate', strength: 'register and truck support' },
    { id: 't9', name: 'Jeff H.', role: 'Sales Associate', strength: 'closing coverage' },
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
      owner: 'Sarah I.',
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
      owner: 'Alicia T.',
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
  schedule: buildSampleSchedule(),
  schedulePdfs: [],
  compassNotes: [
    { id: 'c1', title: '7-day setup', body: 'T-Day is Friday. P-Day is Tuesday. Pre-open stocking is yes. Dedicated delivery store is no.' },
    { id: 'c2', title: 'Daily reminder', body: 'Assign one owner per workflow task and check progress before shift change.' }
  ],
  messages: [
    { id: 'm1', from: 'Chris C.', body: 'Morning focus: compliance first, then training, then seasonal reset progress.', time: '7:12 AM' },
    { id: 'm2', from: 'Sarah I.', body: 'Safety walk started. I will update once temperature checks are logged.', time: '8:06 AM' }
  ],
  photos: [],
  assistantDecision: null,
  planningEvent: defaultPlanningEvent,
  reminders: [
    { id: 'r1', title: 'Inventory countdown check', due: isoToday, owner: 'Chris C.', notes: 'Review open inventory prep tasks and assign each one before shift change.', done: false },
    { id: 'r2', title: 'Backroom readiness check', due: addDays(2), owner: 'Blaire M.', notes: 'Confirm rolltainers, totes, and staged freight are organized for counting.', done: false },
    { id: 'r3', title: 'Final sales floor recovery push', due: '2026-06-24', owner: 'Sarah I.', notes: 'Full store recovery before inventory day on June 25, 2026.', done: false }
  ],
  timeEntries: [],
  activeTimer: null
};

let state = loadState();
let activeFilter = 'all';
let activeScheduleWeek = getCurrentScheduleWeek();

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
  const current = new Date(`${isoToday}T12:00:00`);
  const start = new Date(`${scheduleStartDate}T12:00:00`);
  const offset = Math.floor((current - start) / (7 * 86400000));
  return Math.min(1, Math.max(0, offset));
}

function buildSampleSchedule() {
  const weekOne = [
    ['2026-06-13', 'Alicia T.', 'Sales Associate', '06:00', '15:00', 'Front end, recovery, and customer coverage'],
    ['2026-06-13', 'Chris C.', 'Store Manager', '06:00', '15:00', 'Manager coverage, workflow, and truck direction'],
    ['2026-06-13', 'Elvis J.', 'Sales Associate', '06:00', '15:00', 'Stocking and recovery'],
    ['2026-06-13', 'Louis C.', 'Sales Associate', '06:00', '15:00', 'Core freight and sales floor support'],
    ['2026-06-13', 'Blaire M.', 'Sales Associate', '08:00', '16:00', 'Register, totes, and recovery'],
    ['2026-06-14', 'Blaire M.', 'Sales Associate', '06:00', '15:00', 'Front end and stocking'],
    ['2026-06-14', 'Chris C.', 'Store Manager', '06:00', '15:00', 'Manager coverage and daily planner'],
    ['2026-06-14', 'Louis C.', 'Sales Associate', '06:00', '15:00', 'Stocking support'],
    ['2026-06-14', 'Carlton R.', 'Sales Associate', '15:15', '23:15', 'Closing recovery'],
    ['2026-06-15', 'Sarah I.', 'Assistant Store Manager', '07:45', '15:15', 'Opening manager and compliance'],
    ['2026-06-15', 'Jazmin G.', 'Sales Associate', '08:00', '15:00', 'Register and recovery'],
    ['2026-06-15', 'Blaire M.', 'Sales Associate', '15:15', '23:15', 'Closing coverage'],
    ['2026-06-15', 'Chris C.', 'Store Manager', '15:15', '23:15', 'Closing manager and inventory prep'],
    ['2026-06-16', 'Sarah I.', 'Assistant Store Manager', '06:00', '14:00', 'P-Day, fresh truck, and workflow'],
    ['2026-06-16', 'Alicia T.', 'Sales Associate', '08:00', '15:00', 'Front end and Compliance Tuesday support'],
    ['2026-06-16', 'Carlton R.', 'Sales Associate', '08:00', '13:30', 'Recovery and sky shelves'],
    ['2026-06-16', 'Jazmin G.', 'Sales Associate', '08:00', '15:00', 'Register and planogram support'],
    ['2026-06-16', 'Chris C.', 'Store Manager', '13:15', '17:30', 'Inventory prep and follow-up'],
    ['2026-06-16', 'Elvis J.', 'Sales Associate', '15:15', '23:15', 'Closing recovery'],
    ['2026-06-17', 'Sarah I.', 'Assistant Store Manager', '07:45', '15:00', 'Backstock and opening direction'],
    ['2026-06-17', 'Chris C.', 'Store Manager', '08:00', '15:00', 'Inventory prep and manager coverage'],
    ['2026-06-17', 'Elvis J.', 'Sales Associate', '15:15', '23:15', 'Closing recovery'],
    ['2026-06-17', 'Blaire M.', 'Sales Associate', '15:15', '23:15', 'Closing coverage'],
    ['2026-06-18', 'Chris C.', 'Store Manager', '06:00', '15:00', 'Fresh damages, rotation, and manager coverage'],
    ['2026-06-18', 'Sarah I.', 'Assistant Store Manager', '08:00', '13:00', 'Front end and inventory prep'],
    ['2026-06-18', 'Carlton R.', 'Sales Associate', '13:15', '16:30', 'Recovery and stock support'],
    ['2026-06-18', 'Asael H.', 'Sales Associate', '15:15', '23:15', 'Closing coverage'],
    ['2026-06-18', 'Elvis J.', 'Sales Associate', '15:15', '23:15', 'Closing recovery'],
    ['2026-06-19', 'Chris C.', 'Store Manager', '07:45', '16:45', 'T-Day planning, receive truck, and toppers/totes'],
    ['2026-06-19', 'Alicia T.', 'Sales Associate', '08:00', '15:00', 'Truck and front end support'],
    ['2026-06-19', 'Jazmin G.', 'Sales Associate', '08:00', '15:00', 'Register and truck support'],
    ['2026-06-19', 'Sarah I.', 'Assistant Store Manager', '08:00', '14:00', 'Inventory prep and floor recovery'],
    ['2026-06-19', 'Carlton R.', 'Sales Associate', '15:15', '23:15', 'Closing recovery'],
    ['2026-06-19', 'Jeff H.', 'Sales Associate', '15:15', '23:15', 'Closing coverage']
  ];

  const weekTwo = weekOne.map(([date, name, position, start, end, direction], index) => [
    addDaysToDate(date, 7),
    name,
    position,
    start,
    end,
    index % 3 === 0 ? 'Inventory week prep, recovery, and count readiness' : direction
  ]);

  return [...weekOne, ...weekTwo].map(([date, name, position, start, end, direction], index) => ({
    id: `s${index + 1}`,
    date,
    name,
    position,
    start,
    end,
    direction
  }));
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
    Maya: 'Sarah I.',
    Jordan: 'Jazmin G.',
    Devin: 'Carlton R.',
    Chris: 'Chris C.'
  };

  const replaceName = (value) => replacements[value] || value;
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
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
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
          .filter((key) => key.startsWith('dg-storeflow-') && key !== 'dg-storeflow-v9')
          .map((key) => caches.delete(key))
      )
    )
    .catch(() => {});
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
      renderSchedule();
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
    createTask();
  });

  document.querySelector('#messageForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector('#messageInput');
    const body = input.value.trim();
    if (!body) return;
    state.messages.unshift({
      id: crypto.randomUUID(),
      from: 'Chris C.',
      body,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    });
    input.value = '';
    saveState();
    renderMessages();
  });

  document.querySelector('#addShift').addEventListener('click', () => {
    const roster = getRosterFromSchedule();
    const next = roster[state.schedule.length % roster.length] || getFallbackOwner();
    const date = addDaysToDate(scheduleStartDate, activeScheduleWeek * 7);
    state.schedule.push({
      id: crypto.randomUUID(),
      name: next.name,
      position: 'Assigned Coverage',
      date,
      start: '09:00',
      end: '13:00',
      direction: 'Add shift direction based on store needs.'
    });
    saveState();
    renderSchedule();
  });

  document.querySelector('#addCompassNote').addEventListener('click', () => {
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
    state.photos = [];
    saveState();
    render();
  });

  document.querySelector('#addReminder').addEventListener('click', addInventoryReminder);
  document.querySelector('#addInventoryPlan').addEventListener('click', addInventoryPrepPlan);
  document.querySelector('#eventSetupForm').addEventListener('submit', updatePlanningEvent);
  document.querySelector('#schedulePdfForm').addEventListener('submit', handleSchedulePdfUpload);
  document.querySelector('#clearSchedulePdfs').addEventListener('click', () => {
    state.schedulePdfs = [];
    saveState();
    renderSchedulePdfs();
  });
}

function setView(viewName) {
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
    notes: document.querySelector('#taskNotes').value.trim(),
    done: false
  });
  document.querySelector('#taskForm').reset();
  document.querySelector('#taskModal').close();
  saveState();
  render();
}

function addInventoryReminder() {
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

async function handleSchedulePdfUpload(event) {
  event.preventDefault();
  const file = document.querySelector('#schedulePdfInput').files[0];
  if (!file) return;

  const selectedOwner = document.querySelector('#schedulePdfOwner').value;
  const owner = isLeadershipRole(getRoleForName(selectedOwner)) ? selectedOwner : getLeadershipOwner();
  const week = Number(document.querySelector('#schedulePdfWeek').value);
  const notes = document.querySelector('#schedulePdfNotes').value.trim() || 'Review the uploaded published schedule PDF and update shifts on the Schedule tab.';
  const dataUrl = file.size <= 3500000 ? await readFileAsDataUrl(file) : '';
  const rawText = await extractLoosePdfText(file);

  const pdf = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    week,
    owner,
    notes,
    createdAt: new Date().toISOString(),
    dataUrl,
    extractedText: rawText
  };

  state.schedulePdfs.unshift(pdf);
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title: `Review schedule PDF: Week ${week + 1}`,
    category: 'schedule',
    priority: 'high',
    owner,
    due: isoToday,
    notes: `${notes} Use the PDF reference to verify shifts, then update the Schedule tab so the roster refreshes.`,
    schedulePdfId: pdf.id,
    done: false
  });

  if (!saveState()) {
    state.schedulePdfs.shift();
    state.tasks.shift();
    alert('That PDF is too large to save in this local browser app. Try a smaller PDF, or upload it as a schedule photo/reference instead.');
    return;
  }

  document.querySelector('#schedulePdfForm').reset();
  render();
  setView('schedule');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

async function extractLoosePdfText(file) {
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const text = new TextDecoder('latin1').decode(buffer);
    const pieces = [...text.matchAll(/\(([^()]{3,120})\)/g)]
      .map((match) => match[1])
      .filter((value) => /[A-Za-z]/.test(value))
      .slice(0, 80);
    return [...new Set(pieces)].join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  } catch {
    return '';
  }
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
  const sorted = [...state.tasks].sort((a, b) => {
    const priorityScore = { high: 0, medium: 1, low: 2 };
    return priorityScore[a.priority] - priorityScore[b.priority] || a.due.localeCompare(b.due);
  });

  const filtered = activeFilter === 'all' ? sorted : sorted.filter((task) => task.category === activeFilter);
  document.querySelector('#taskBoard').innerHTML = filtered.map(taskTemplate).join('');
  document.querySelector('#priorityTaskList').innerHTML = sorted.filter((task) => !task.done).slice(0, 4).map(taskTemplate).join('');
  bindTaskControls(document.querySelector('#tasksView'));
  bindTaskControls(document.querySelector('#dashboardView'));
}

function bindTaskControls(scope) {
  scope.querySelectorAll('[data-task-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const task = state.tasks.find((item) => item.id === checkbox.dataset.taskToggle);
      task.done = checkbox.checked;
      if (task.done && state.activeTimer?.taskId === task.id) {
        stopTimer();
      }
      saveState();
      render();
    });
  });

  scope.querySelectorAll('[data-start-timer]').forEach((button) => {
    button.addEventListener('click', () => startTimer(button.dataset.startTimer));
  });

  scope.querySelectorAll('[data-stop-timer]').forEach((button) => {
    button.addEventListener('click', stopTimer);
  });

  scope.querySelectorAll('[data-add-time]').forEach((button) => {
    button.addEventListener('click', () => addManualTime(button.dataset.addTime, 15));
  });
}

function taskTemplate(task) {
  const photo = findPhoto(task.photoId);
  const minutes = getTaskMinutes(task.id);
  const isActive = state.activeTimer?.taskId === task.id;
  const ownerRole = getRoleForName(task.owner);
  return `
    <article class="task-card ${task.done ? 'done' : ''}">
      <input type="checkbox" ${task.done ? 'checked' : ''} data-task-toggle="${task.id}" aria-label="Complete ${escapeHtml(task.title)}">
      <div>
        <p class="task-title">${escapeHtml(task.title)}</p>
        <div class="task-meta">${capitalize(task.category)} - ${escapeHtml(task.owner)}${ownerRole ? ` - ${escapeHtml(ownerRole)}` : ''} - due ${formatDue(task.due)}</div>
        <div class="subtle">${escapeHtml(task.notes || 'No notes added.')}</div>
        ${photo ? photoThumb(photo) : ''}
        <div class="task-actions">
          <span class="time-chip">${formatMinutes(minutes)} logged</span>
          ${
            isActive
              ? `<button class="secondary-button small-button" data-stop-timer="${task.id}" type="button">Stop</button>`
              : `<button class="secondary-button small-button" data-start-timer="${task.id}" type="button">Start</button>`
          }
          <button class="secondary-button small-button" data-add-time="${task.id}" type="button">+15 min</button>
        </div>
      </div>
      <span class="badge ${task.priority}">${capitalize(task.priority)}</span>
    </article>
  `;
}

function startTimer(taskId) {
  if (state.activeTimer?.taskId === taskId) return;
  if (state.activeTimer) stopTimer();
  state.activeTimer = {
    taskId,
    startedAt: new Date().toISOString()
  };
  saveState();
  render();
}

function stopTimer() {
  if (!state.activeTimer) return;
  const task = state.tasks.find((item) => item.id === state.activeTimer.taskId);
  const started = new Date(state.activeTimer.startedAt);
  const minutes = Math.max(1, Math.round((Date.now() - started.getTime()) / 60000));
  state.timeEntries.unshift({
    id: crypto.randomUUID(),
    taskId: state.activeTimer.taskId,
    taskTitle: task?.title || 'Unknown task',
    owner: task?.owner || 'Unassigned',
    category: task?.category || 'general',
    minutes,
    createdAt: new Date().toISOString()
  });
  state.activeTimer = null;
  saveState();
  render();
}

function addManualTime(taskId, minutes) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  state.timeEntries.unshift({
    id: crypto.randomUUID(),
    taskId,
    taskTitle: task.title,
    owner: task.owner,
    category: task.category,
    minutes,
    createdAt: new Date().toISOString()
  });
  saveState();
  render();
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
      : 'Use +15 min logs on prep work so you can see where productive time is going.',
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
  const update = document.querySelector('#managerUpdateInput').value.trim();
  state.assistantDecision = buildCourseAction(update);
  saveState();
  renderAssistantDecision();
}

function applyCourseAction(event) {
  event.preventDefault();
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
    recovery: hasAny(['recovery', 'recover', 'facing', 'front end', 'first 30'])
  };
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
    .filter((shift) => shift.date === isoToday)
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

  const eventTasks = getEventTasks(event)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
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
    <div class="time-stat"><span>Active timer</span><strong>${state.activeTimer ? 'Running' : 'None'}</strong></div>
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
  if (!state.schedulePdfs.length) {
    container.innerHTML = '<div class="empty-state">Upload the published schedule PDF from email. It will be saved here as the schedule reference for review.</div>';
    return;
  }

  container.innerHTML = state.schedulePdfs
    .map((pdf) => `
      <article class="schedule-pdf-card">
        <div class="pdf-title">
          <div>
            <strong>${escapeHtml(pdf.name)}</strong>
            <div class="task-meta">Week ${pdf.week + 1} · ${escapeHtml(pdf.owner)} · ${formatFileSize(pdf.size)}</div>
          </div>
          <span class="badge ${pdf.dataUrl ? 'low' : 'medium'}">${pdf.dataUrl ? 'Saved' : 'Too large'}</span>
        </div>
        <p class="subtle">${escapeHtml(pdf.notes)}</p>
        ${
          pdf.dataUrl
            ? `<object class="pdf-preview" data="${pdf.dataUrl}" type="application/pdf"><a href="${pdf.dataUrl}" download="${escapeHtml(pdf.name)}">Open PDF</a></object>`
            : '<div class="empty-state small-empty">This PDF was too large for browser storage. Keep the email copy and use this card as the review task reference.</div>'
        }
        ${
          pdf.extractedText
            ? `<details class="pdf-text"><summary>Possible extracted text</summary><p>${escapeHtml(pdf.extractedText)}</p></details>`
            : '<p class="form-hint">No readable text was found in the raw PDF. This usually means the PDF is compressed or image-based.</p>'
        }
      </article>
    `)
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
  const running = Math.max(0, Math.floor((Date.now() - new Date(state.activeTimer.startedAt).getTime()) / 60000));
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

  const todayShifts = state.schedule
    .filter((shift) => shift.date === isoToday)
    .sort((a, b) => a.start.localeCompare(b.start));

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

  const todayDirection = state.schedule.filter((shift) => shift.date === isoToday);
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
  return Array.from({ length: 7 }, (_, index) => addDaysToDate(scheduleStartDate, offset * 7 + index));
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
  const rosterMap = new Map();

  state.schedule.forEach((shift) => {
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

    current.role = getPrimaryRole(current.role, shift.position);
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
