import { readFileSync, writeFileSync } from 'fs';
import { AUDIT_FILE }                  from './helpers.js';
import { hashPassword }                from './auth.js';
import db                              from './db.js';

export const ALL_PAGES = [
  'dashboard', 'employees', 'timesheets', 'projects',
  'clients', 'aiInsights', 'chatbot', 'myTimesheet', 'timesheetApproval',
  'administration',
];

export const ROLE_DEFAULTS = {
  admin:      Object.fromEntries(ALL_PAGES.map(p => [p, true])),
  supervisor: { dashboard: true, employees: true, projects: true, clients: true, myTimesheet: true, timesheetApproval: true, timesheets: false, aiInsights: true, chatbot: true, administration: true },
  pm:         { myTimesheet: true, timesheetApproval: true, projects: true, clients: true, dashboard: true, chatbot: true, employees: false, timesheets: false, aiInsights: false, administration: false },
  resource:   { myTimesheet: true, chatbot: true, dashboard: false, employees: false, timesheets: false, projects: false, clients: false, aiInsights: false, timesheetApproval: false, administration: false },
};

export function defaultPermissionsForRole(role) {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.resource;
}

export function allPermissions() {
  return Object.fromEntries(ALL_PAGES.map(p => [p, true]));
}

// ── Audit log (stays as flat file) ───────────────────────────────────────────

export function loadAuditLog() {
  try { return JSON.parse(readFileSync(AUDIT_FILE, 'utf8')); } catch { return []; }
}

export function appendAudit(entry) {
  const log = loadAuditLog();
  log.push({ ...entry, ts: new Date().toISOString() });
  writeFileSync(AUDIT_FILE, JSON.stringify(log.slice(-2000), null, 2), 'utf8');
}

// ── Default users — writes to SQLite ─────────────────────────────────────────

export async function ensureDefaultUsers() {
  const defaults = [
    { id: 'ziad', displayName: 'Ziad Shafik', envKey: 'AdminPWD', isAdmin: true  },
    { id: 'mod',  displayName: 'Irfan Najmi', envKey: 'ModPWD',   isAdmin: false },
    { id: 'gm',   displayName: 'Habib Matta', envKey: 'GMPWD',    isAdmin: false },
  ];
  const now = new Date().toISOString();
  for (const d of defaults) {
    const exists = db.prepare('SELECT id FROM users WHERE id=?').get(d.id);
    if (exists) continue;
    const pwd = process.env[d.envKey];
    if (!pwd) continue;
    db.prepare(
      'INSERT OR IGNORE INTO users (id,displayName,passwordHash,isAdmin,permissions,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'
    ).run(d.id, d.displayName, await hashPassword(pwd), d.isAdmin ? 1 : 0,
          JSON.stringify(d.isAdmin ? allPermissions() : Object.fromEntries(ALL_PAGES.map(p => [p, true]))),
          now, now);
  }
}
