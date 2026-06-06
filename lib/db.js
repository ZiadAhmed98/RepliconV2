import Database    from 'better-sqlite3';
import path        from 'path';
import { DATA_DIR } from './helpers.js';

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

// Safe migrations
try { db.exec('ALTER TABLE employees ADD COLUMN userId TEXT'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_userId ON employees(userId) WHERE userId IS NOT NULL'); } catch {}
try { db.exec('ALTER TABLE psa_timesheet_hours ADD COLUMN note TEXT'); } catch {}
try { db.exec('ALTER TABLE psa_timesheets ADD COLUMN rejectedReason TEXT'); } catch {}

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

export default db;
