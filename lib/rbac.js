import { readFileSync, writeFileSync } from 'fs';
import { USERS_FILE, AUDIT_FILE }      from './helpers.js';
import { hashPassword }                from './auth.js';

export const ALL_PAGES = [
  'dashboard', 'employees', 'timesheets', 'projects',
  'clients', 'aiInsights', 'chatbot', 'myTimesheet', 'timesheetApproval',
];

export function allPermissions() {
  return Object.fromEntries(ALL_PAGES.map(p => [p, true]));
}

export function loadUsers() {
  try { return JSON.parse(readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}

export function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

export function loadAuditLog() {
  try { return JSON.parse(readFileSync(AUDIT_FILE, 'utf8')); } catch { return []; }
}

export function appendAudit(entry) {
  const log = loadAuditLog();
  log.push({ ...entry, ts: new Date().toISOString() });
  const trimmed = log.slice(-2000);
  writeFileSync(AUDIT_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
}

export async function ensureDefaultUsers() {
  const users = loadUsers();
  let changed = false;

  const defaults = [
    { id: 'ziad', displayName: 'Ziad Shafik', envKey: 'AdminPWD', isAdmin: true  },
    { id: 'mod',  displayName: 'Irfan Najmi', envKey: 'ModPWD',   isAdmin: false },
    { id: 'gm',   displayName: 'Habib Matta', envKey: 'GMPWD',    isAdmin: false },
  ];

  for (const d of defaults) {
    if (!users[d.id]) {
      const pwd = process.env[d.envKey];
      if (!pwd) continue;
      users[d.id] = {
        id:           d.id,
        displayName:  d.displayName,
        passwordHash: await hashPassword(pwd),
        isAdmin:      d.isAdmin,
        permissions:  d.isAdmin ? allPermissions() : Object.fromEntries(ALL_PAGES.map(p => [p, true])),
        createdAt:    new Date().toISOString(),
      };
      changed = true;
    }
  }
  if (changed) saveUsers(users);
}
