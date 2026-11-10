(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StoreFlowOperations = factory();
})(typeof self === 'undefined' ? this : self, function () {
  const DAY = 86400000;

  function dateKey(date = new Date()) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
  }

  function shiftDate(value, days = 0) {
    return new Date(Date.parse(value + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
  }

  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && shiftDate(value) === value;
  }

  function weekStart(value) {
    const day = new Date(value + 'T00:00:00Z').getUTCDay();
    return shiftDate(value, -((day + 1) % 7));
  }

  function scheduleWeekStarts(weeks, today) {
    const starts = [0, 1].map((week) => weeks.find((entry) => entry.week === week && validDate(entry.start))?.start);
    return [starts[0] || (starts[1] ? shiftDate(starts[1], -7) : weekStart(today)),
      starts[1] || shiftDate(starts[0] || weekStart(today), 7)];
  }

  function inactiveStaff(name) {
    return /^(alicia|jeff)(?:\s|$)/i.test(String(name).trim());
  }

  function staffName(name) {
    const clean = String(name || '').trim();
    if (/^(marge|margaret|margarette)(?:\s|$)/i.test(clean)) return 'Margarette L.';
    if (/^(nate|nathan)(?:\s|$)/i.test(clean)) return 'Nathan H.';
    if (/^dominic(?:\s|$)/i.test(clean)) return 'Dominic S.';
    if (/^blaire(?:\s|$)/i.test(clean)) return 'Blaire M.';
    return clean;
  }

  function timeKey(value) {
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return '';
    let hour = Number(match[1]);
    if (Number(match[2]) > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return '';
    if (match[3]) hour = (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return String(hour).padStart(2, '0') + ':' + match[2];
  }

  function readShiftRows(text, roster, { strict = true } = {}) {
    const rows = [], problems = [];
    const split = (line) => (line.includes('\t') ? line.split('\t') :
      (line.match(/"(?:[^"]|"")*"|[^,]+|(?<=,)(?=,)/g) || []))
      .map((cell) => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    const linePattern = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(\d{1,2}:\d{2}\s*(?:[AP]M)?)\s*(?:[-–—]|\bto\b|\s)\s*(\d{1,2}:\d{2}\s*(?:[AP]M)?)\s*$/i;
    const seen = new Set();
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim() || /^date[,\t]/i.test(line.trim())) continue;
      const cells = split(line);
      const fields = cells.length >= 4 ? cells : (line.trim().match(linePattern) || []).slice(1);
      let [date, name, start, end, direction] = fields;
      const slash = date?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (slash) date = slash[3] + '-' + slash[1].padStart(2, '0') + '-' + slash[2].padStart(2, '0');
      const person = roster.find((member) => member.name.toLowerCase() === staffName(name).toLowerCase() ||
        member.name.split(' ')[0].toLowerCase() === staffName(name).toLowerCase());
      start = timeKey(start);
      end = timeKey(end);
      if (!date || !validDate(date) || !person || !start || !end || start === end) {
        if (strict) problems.push('Line ' + (index + 1) + ': check the date, roster name, and shift times.');
        continue;
      }
      const id = [date, person.name, start, end].join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({ id: 'import:' + id, date, name: person.name, start, end, position: person.role,
        direction: direction || 'Follow the published schedule and shift direction.' });
    }
    return { rows, problems };
  }

  function recoveryAt(date) {
    const minute = date.getHours() * 60 + date.getMinutes();
    if (minute < 1020) return ['Before 5 PM', 'Assign front and floor coverage. Plan the back-to-front sweep.'];
    if (minute < 1110) return ['5–6:30 PM · Zone C', 'Floor starts in back and works forward. Cashier keeps the front reset.'];
    if (minute < 1230) return ['6:30–8:30 PM · Zone B', 'Prioritize the middle of the store. Cashier checks the front every 15–20 minutes as coverage permits.'];
    if (minute < 1275) return ['8:30–9:15 PM · Zone A', 'Both focus on the front as coverage permits.'];
    return ['9:15 PM–close · Zone A', 'Fix visible gaps and finish the final front check.'];
  }

  function timerElapsed(timer, now = Date.now()) {
    const began = Date.parse(timer.startedAt);
    return Math.max(0, timer.elapsedMs || 0) + (Number.isFinite(began) ? Math.max(0, now - began) : 0);
  }

  return { dateKey, shiftDate, validDate, weekStart, scheduleWeekStarts, inactiveStaff, staffName, readShiftRows, recoveryAt, timerElapsed };
});
