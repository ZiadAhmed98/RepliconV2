import Database         from 'better-sqlite3';
import crypto           from 'crypto';
import path             from 'path';
import { readFileSync } from 'fs';
import { DATA_DIR, logger } from './helpers.js';

const db = new Database(path.join(DATA_DIR, 'mds.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    userId      TEXT UNIQUE,
    id          TEXT PRIMARY KEY,
    firstName   TEXT NOT NULL,
    lastName    TEXT NOT NULL,
    displayName TEXT,
    email       TEXT UNIQUE,
    employeeId  TEXT UNIQUE,
    role        TEXT NOT NULL DEFAULT 'resource',
    skills      TEXT NOT NULL DEFAULT '[]',
    supervisorId TEXT REFERENCES employees(id) ON DELETE SET NULL,
    startDate   TEXT,
    endDate     TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    code             TEXT UNIQUE,
    industry         TEXT,
    contactName      TEXT,
    contactEmail     TEXT,
    contactPhone     TEXT,
    website          TEXT,
    accountManagerId TEXT REFERENCES employees(id) ON DELETE SET NULL,
    status           TEXT NOT NULL DEFAULT 'active',
    notes            TEXT,
    createdAt        TEXT NOT NULL,
    updatedAt        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id               TEXT PRIMARY KEY,
    clientId         TEXT REFERENCES clients(id) ON DELETE SET NULL,
    name             TEXT NOT NULL,
    code             TEXT UNIQUE,
    status           TEXT NOT NULL DEFAULT 'in_progress',
    projectManagerId TEXT REFERENCES employees(id) ON DELETE SET NULL,
    startDate        TEXT,
    endDate          TEXT,
    budgetHours      REAL DEFAULT 0,
    billingType      TEXT NOT NULL DEFAULT 'time_material',
    notes            TEXT,
    createdAt        TEXT NOT NULL,
    updatedAt        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id             TEXT PRIMARY KEY,
    projectId      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parentTaskId   TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,
    code           TEXT,
    description    TEXT,
    startDate      TEXT,
    endDate        TEXT,
    status         TEXT NOT NULL DEFAULT 'open',
    estimatedHours REAL DEFAULT 0,
    sortOrder      INTEGER DEFAULT 0,
    createdAt      TEXT NOT NULL,
    updatedAt      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS psa_timesheets (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    weekStart TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'not_submitted',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE(userId, weekStart)
  );

  CREATE TABLE IF NOT EXISTS psa_timesheet_rows (
    id          TEXT PRIMARY KEY,
    timesheetId TEXT NOT NULL REFERENCES psa_timesheets(id) ON DELETE CASCADE,
    projectId   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    taskId      TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    note        TEXT,
    sortOrder   INTEGER DEFAULT 0,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS psa_timesheet_hours (
    rowId  TEXT NOT NULL REFERENCES psa_timesheet_rows(id) ON DELETE CASCADE,
    date   TEXT NOT NULL,
    hours  REAL NOT NULL DEFAULT 0,
    note   TEXT,
    PRIMARY KEY(rowId, date)
  );

  CREATE TABLE IF NOT EXISTS project_resources (
    projectId  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    employeeId TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assignedAt TEXT NOT NULL,
    PRIMARY KEY (projectId, employeeId)
  );

  CREATE TABLE IF NOT EXISTS task_resources (
    taskId     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    employeeId TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assignedAt TEXT NOT NULL,
    PRIMARY KEY (taskId, employeeId)
  );
`);

// Account managers — first-class entity separate from employees
try {
  db.exec(`CREATE TABLE IF NOT EXISTS account_managers (
    id          TEXT PRIMARY KEY,
    firstName   TEXT NOT NULL,
    lastName    TEXT NOT NULL,
    displayName TEXT,
    email       TEXT,
    phone       TEXT,
    title       TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  )`);
} catch (e) { logger.warn({ err: e }, 'account_managers table setup failed'); }
try { db.exec('ALTER TABLE clients ADD COLUMN managerId TEXT REFERENCES account_managers(id) ON DELETE SET NULL'); } catch {}

// Auto-migrate: pull existing accountManagerId (pointing to employees) → account_managers + set managerId
try {
  const toMigrate = db.prepare(`
    SELECT c.id AS cid, e.firstName, e.lastName, e.displayName, e.email
    FROM clients c
    JOIN employees e ON e.id = c.accountManagerId
    WHERE c.accountManagerId IS NOT NULL AND c.managerId IS NULL
  `).all();
  if (toMigrate.length > 0) {
    const _now = new Date().toISOString();
    for (const row of toMigrate) {
      const name = row.displayName || `${row.firstName} ${row.lastName}`;
      let am = db.prepare('SELECT id FROM account_managers WHERE LOWER(displayName)=LOWER(?)').get(name);
      if (!am) {
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO account_managers (id,firstName,lastName,displayName,email,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
          .run(id, row.firstName, row.lastName, name, row.email || null, 'active', _now, _now);
        am = { id };
      }
      db.prepare('UPDATE clients SET managerId=? WHERE id=?').run(am.id, row.cid);
    }
  }
} catch (e) { logger.warn({ err: e }, 'Account manager auto-migration failed'); }

// Safe migrations — employee enrichment columns
try { db.exec('ALTER TABLE employees ADD COLUMN hourlyRate REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE employees ADD COLUMN jobTitle TEXT'); } catch {}
try { db.exec('ALTER TABLE employees ADD COLUMN department TEXT'); } catch {}
try { db.exec("ALTER TABLE employees ADD COLUMN officeLocation TEXT"); } catch {}
// Safe migrations — project enrichment
try { db.exec('ALTER TABLE projects ADD COLUMN programName TEXT'); } catch {}

// Programs — first-class table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS programs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  )`);
} catch {}
try { db.exec('ALTER TABLE projects ADD COLUMN programId TEXT REFERENCES programs(id) ON DELETE SET NULL'); } catch {}

// Seed the 14 known programs on first run
try {
  const _pc = db.prepare('SELECT COUNT(*) AS n FROM programs').get().n;
  if (_pc === 0) {
    const _pnames = [
      'Application Modernization Assessment', 'Certification/Training', 'Copilot',
      'Customer Facing Workshops', 'Customer/Vendor Meetings', 'DC Migration Assessment',
      'Deployment Projects', 'Internal', 'Managed Services (On-Site)',
      'Managed Services (Remote)', 'Post Implementation Support', 'Proof of Concept',
      'Proposals Preparation', 'Service Level Agreements',
    ];
    const _pnow = new Date().toISOString();
    const _pins = db.prepare('INSERT OR IGNORE INTO programs (id,name,createdAt,updatedAt) VALUES (?,?,?,?)');
    db.transaction(() => { for (const n of _pnames) _pins.run(crypto.randomUUID(), n, _pnow, _pnow); })();
  }
} catch {}

// Auto-link existing projects to programs via their programName text column
try {
  db.prepare(`
    UPDATE projects SET programId = (
      SELECT id FROM programs WHERE LOWER(name) = LOWER(projects.programName)
    ) WHERE programId IS NULL AND programName IS NOT NULL
  `).run();
} catch {}

// Safe migrations — templates
try {
  db.exec(`CREATE TABLE IF NOT EXISTS templates (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT,
    category      TEXT NOT NULL DEFAULT 'general',
    documentUrl   TEXT,
    submittedBy   TEXT NOT NULL,
    submitterName TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    reviewedBy    TEXT,
    reviewedAt    TEXT,
    rejectionNote TEXT,
    createdAt     TEXT NOT NULL,
    updatedAt     TEXT NOT NULL
  )`);
} catch {}

// Safe migrations
try { db.exec('ALTER TABLE employees ADD COLUMN userId TEXT'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_userId ON employees(userId) WHERE userId IS NOT NULL'); } catch {}
try { db.exec('ALTER TABLE psa_timesheet_hours ADD COLUMN note TEXT'); } catch {}
try { db.exec('ALTER TABLE psa_timesheets ADD COLUMN rejectedReason TEXT'); } catch {}
try { db.exec('ALTER TABLE projects ADD COLUMN quotedHours REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE projects ADD COLUMN ticketAllocation REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE projects ADD COLUMN monthlyAllocation REAL DEFAULT 0'); } catch {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS project_access_requests (
    id          TEXT PRIMARY KEY,
    projectId   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    employeeId  TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    requestedBy TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    note        TEXT,
    reviewedBy  TEXT,
    reviewedAt  TEXT,
    createdAt   TEXT NOT NULL,
    UNIQUE(projectId, employeeId)
  )`);
} catch {}

// ── Users table — replaces users.json ────────────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    displayName  TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    isAdmin      INTEGER NOT NULL DEFAULT 0,
    permissions  TEXT NOT NULL DEFAULT '{}',
    createdAt    TEXT NOT NULL,
    updatedAt    TEXT NOT NULL
  )`);
} catch {}

try { db.exec('ALTER TABLE users ADD COLUMN msEmail TEXT'); } catch {}

// Auto-migrate from users.json on first server start — one-time, fully automatic
try {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (n === 0) {
    const raw  = JSON.parse(readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8'));
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO users (id,displayName,passwordHash,isAdmin,permissions,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'
    );
    const now = new Date().toISOString();
    db.transaction(() => {
      for (const u of Object.values(raw)) {
        stmt.run(u.id, u.displayName, u.passwordHash, u.isAdmin ? 1 : 0,
                 JSON.stringify(u.permissions || {}), u.createdAt || now, now);
      }
    })();
  }
} catch { /* users.json missing or already migrated */ }

export function buildTimesheetRows(timesheetId) {
  const rows = db.prepare(`
    SELECT r.id, r.projectId, r.taskId, r.note, r.sortOrder,
           p.name  AS projectName, p.clientId,
           c.name  AS clientName,
           tk.name AS taskName
    FROM psa_timesheet_rows r
    LEFT JOIN projects p  ON p.id  = r.projectId
    LEFT JOIN clients  c  ON c.id  = p.clientId
    LEFT JOIN tasks    tk ON tk.id = r.taskId
    WHERE r.timesheetId = ?
    ORDER BY r.sortOrder ASC, r.createdAt ASC
  `).all(timesheetId);
  rows.forEach(row => {
    const hrs    = db.prepare('SELECT date, hours, note FROM psa_timesheet_hours WHERE rowId=?').all(row.id);
    row.hours    = Object.fromEntries(hrs.map(h => [h.date, h.hours]));
    row.dayNotes = Object.fromEntries(hrs.filter(h => h.note).map(h => [h.date, h.note]));
  });
  return rows;
}

export function buildSingleRow(rowId) {
  const row = db.prepare(`
    SELECT r.id, r.projectId, r.taskId, r.note, r.sortOrder,
           p.name  AS projectName, p.clientId,
           c.name  AS clientName,
           tk.name AS taskName
    FROM psa_timesheet_rows r
    LEFT JOIN projects p  ON p.id  = r.projectId
    LEFT JOIN clients  c  ON c.id  = p.clientId
    LEFT JOIN tasks    tk ON tk.id = r.taskId
    WHERE r.id = ?
  `).get(rowId);
  if (!row) return null;
  const hrs    = db.prepare('SELECT date, hours, note FROM psa_timesheet_hours WHERE rowId=?').all(rowId);
  row.hours    = Object.fromEntries(hrs.map(h => [h.date, h.hours]));
  row.dayNotes = Object.fromEntries(hrs.filter(h => h.note).map(h => [h.date, h.note]));
  return row;
}

// Sessions table for persistent login across restarts
try {
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token     TEXT PRIMARY KEY,
    user      TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  )`);
} catch {}

export default db;
