// Web Worker — runs processStarSchema off the main thread so the UI stays responsive.
const EXCLUDED_USERS = ['Habib Matta', 'Ziad Shafik', 'Irfan Najmi', 'Admin', 'Admin '];

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
}

function parseNumber(val) {
  return parseFloat(String(val).replace(/"/g, '').replace(/,/g, '')) || 0;
}

self.onmessage = function (e) {
  const rawData = e.data;
  try {
    const result = processStarSchema(rawData);
    self.postMessage({ ok: true, data: result });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};

function processStarSchema(rawData) {
  const dimensionTable = {};
  const factTable = [];
  const allTimeClientsMap = {};
  const userMaxTimesheetMap = {};

  const cleanRoster     = (rawData.roster     || []).filter(e => !EXCLUDED_USERS.includes((e.name || '').trim()));
  const cleanDrafts     = (rawData.drafts      || []).filter(d => !EXCLUDED_USERS.includes((d.user || '').trim()));
  const cleanTimesheets = (rawData.timesheets  || []).filter(t => !EXCLUDED_USERS.includes((t.user || '').trim()));

  (rawData.cube || []).forEach(row => {
    const cleanUser = (row.user || '').trim();
    if (EXCLUDED_USERS.includes(cleanUser)) return;

    factTable.push({
      date: row.timestamp,
      dateStr: row.dateStr,
      user: cleanUser,
      project: row.project,
      client: row.client,
      program: row.program,
      location: row.location,
      act: Math.round(row.act),
    });

    const progLower   = (row.program || '').toLowerCase();
    const clientLower = (row.client  || '').toLowerCase();
    if (!progLower.includes('internal') && !clientLower.includes('internal') && row.client && row.client !== 'Unknown' && row.act > 0) {
      allTimeClientsMap[row.client] = (allTimeClientsMap[row.client] || 0) + row.act;
    }

    userMaxTimesheetMap[cleanUser] = Math.max(userMaxTimesheetMap[cleanUser] || 0, row.timestamp);

    if (!dimensionTable[row.project]) {
      dimensionTable[row.project] = {
        client: row.client, program: row.program, location: row.location,
        start: row.timestamp, end: 0, status: row.status, est: 0, quoted: 0,
      };
    }
    dimensionTable[row.project].est    = Math.max(dimensionTable[row.project].est,    Math.round(row.est));
    dimensionTable[row.project].quoted = Math.max(dimensionTable[row.project].quoted, Math.round(row.quoted));
    dimensionTable[row.project].end    = Math.max(dimensionTable[row.project].end,    row.timestamp);
  });

  const topClients = Object.keys(allTimeClientsMap)
    .map(c => ({ name: c, val: Math.round(allTimeClientsMap[c]) }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);

  cleanRoster.forEach(emp => {
    if (emp.status === 'Disabled' && emp.end === 0) emp.end = userMaxTimesheetMap[emp.name] || Date.now();
    if (emp.status === 'Enabled'  && emp.end === 0) emp.end = Infinity;
  });

  // Compliance engine
  const now              = new Date();
  const checkDate        = new Date(); checkDate.setHours(0, 0, 0, 0);
  do { checkDate.setDate(checkDate.getDate() - 1); } while (checkDate.getDay() === 0 || checkDate.getDay() === 6);
  const lastWorkingDayTs = checkDate.getTime();
  const lastWeekStart    = getMonday(now) - 7 * 86400000;
  const lastWeekEnd      = getMonday(now) - 1;
  const dailyHoursMap    = {};
  const lastWeekHoursMap = {};

  factTable.forEach(row => {
    if (row.date >= lastWeekStart && row.date <= lastWeekEnd) {
      lastWeekHoursMap[row.user] = (lastWeekHoursMap[row.user] || 0) + row.act;
    }
  });

  cleanDrafts.forEach(row => {
    const d1 = new Date(row.date);
    const d2 = new Date(lastWorkingDayTs);
    const same = d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    if (same) dailyHoursMap[row.user] = (dailyHoursMap[row.user] || 0) + row.act;
  });

  const dailyList = []; const weeklyList = [];
  let dailyDeficitCount = 0; let weeklyDeficitCount = 0;

  cleanRoster.forEach(emp => {
    if (emp.status === 'Enabled' && emp.start <= now.getTime()) {
      const loggedDaily  = Math.round(dailyHoursMap[emp.name]    || 0);
      const loggedWeekly = Math.round(lastWeekHoursMap[emp.name] || 0);
      if (loggedDaily  === 0) dailyDeficitCount++;
      if (loggedWeekly === 0) weeklyDeficitCount++;
      dailyList.push({ name: emp.name, logged: loggedDaily,  isCompliant: loggedDaily  > 0 });
      weeklyList.push({ name: emp.name, logged: loggedWeekly, isCompliant: loggedWeekly > 0 });
    }
  });

  const sparkline = [];
  for (let i = 8; i >= 1; i--) {
    const wStart = getMonday(now) - i * 7 * 86400000;
    const wEnd   = wStart + 6 * 86400000 + 86399999;
    const activeInWeek = cleanRoster.filter(e => e.start <= wEnd && e.end >= wStart);
    const loggedInWeek = new Set();
    factTable.forEach(row => { if (row.date >= wStart && row.date <= wEnd && row.act > 0) loggedInWeek.add(row.user); });
    sparkline.push(Math.max(0, activeInWeek.length - loggedInWeek.size));
  }

  return {
    factTable,
    dimensionTable,
    roster: cleanRoster,
    drafts: cleanDrafts,
    timesheets: cleanTimesheets,
    topClients,
    compliance: { dailyDeficits: dailyDeficitCount, weeklyDeficits: weeklyDeficitCount, dailyList, weeklyList, sparkline },
    dictionaries: rawData.dictionaries || { departments: [], locations: [], programs: [], clients: [], users: [] },
    accountManagers: rawData.accountManagers || [],
  };
}
