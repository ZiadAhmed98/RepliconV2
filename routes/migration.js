import { Router }    from 'express';
import axios          from 'axios';
import crypto         from 'crypto';
import { requireAdmin, hashPassword } from '../lib/auth.js';
import { wcfRequest }                 from '../lib/replicon.js';
import {
  logger, parseCSVLine, parseNumber, parseDateToTimestamp,
} from '../lib/helpers.js';
import { defaultPermissionsForRole } from '../lib/rbac.js';
import db from '../lib/db.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName  = parts.pop();
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

function tsToDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toISOString().split('T')[0];
}

function mondayOf(ts) {
  if (!ts) return null;
  const d   = new Date(ts);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const mon = new Date(ts - diff * 86400000);
  const yyyy = mon.getUTCFullYear();
  const mm   = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(mon.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const _slugExists = db.prepare('SELECT id FROM users WHERE id=?');
function makeSlug(name) {
  let base = name.toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
  let candidate = base;
  let i = 1;
  while (_slugExists.get(candidate)) { candidate = `${base}${i++}`; }
  return candidate;
}

const STATUS_MAP = {
  open: 'in_progress', 'in progress': 'in_progress', active: 'in_progress',
  closed: 'completed', complete: 'completed', completed: 'completed',
  hold: 'deferred', 'on hold': 'deferred',
  cancelled: 'cancelled', canceled: 'cancelled',
};

// ── Migration endpoint ────────────────────────────────────────────────────────

router.post('/api/v1/admin/migrate-from-replicon', requireAdmin, async (req, res) => {
  const { createAccounts = true, importTimesheets = true } = req.body || {};

  const token   = (process.env.REPLICON_TOKEN   || '').trim();
  const company = (process.env.REPLICON_COMPANY || '').trim();
  if (!token || !company) {
    return res.status(503).json({ error: 'Replicon credentials not configured in environment.' });
  }

  const headers = {
    Authorization:                `Bearer ${token}`,
    'X-Replicon-Security-Context': 'User',
    'Content-Type':                'application/json',
  };
  const reportEndpoint = `https://ap1.replicon.com/${company}/services/ReportService1.svc/GenerateReport`;
  const tenantId = '676a13c33af94d2fbb078764ac976b6e';

  const result = {
    clients:   { imported: 0, skipped: 0 },
    employees: { imported: 0, skipped: 0 },
    projects:  { imported: 0, skipped: 0 },
    tasks:     { imported: 0, skipped: 0 },
    resources: { imported: 0, skipped: 0 },
    timesheets:{ imported: 0, skipped: 0 },
    errors:    [],
  };

  try {
    logger.info({ user: req.user.name }, 'Replicon migration started');

    // ── 1. Fetch Replicon data ──────────────────────────────────────────────

    const parseReport = async (name, reportUri, headerKeyword, buildRow) => {
      try {
        const payload = {
          reportUri: `urn:replicon-tenant:${tenantId}:report:${reportUri}`,
          filterValues: [],
          outputFormatUri: 'urn:replicon:report-output-format-option:csv',
        };
        const r      = await axios.post(reportEndpoint, payload, { headers });
        const csvStr = r.data.d?.payload || r.data.payload || '';
        if (!csvStr) return [];
        const lines = csvStr.split(/\r?\n/);
        const hIdx  = lines.findIndex(l => l.toLowerCase().includes(headerKeyword.toLowerCase()));
        if (hIdx === -1) return [];
        const cols = parseCSVLine(lines[hIdx]);
        const g    = s => cols.findIndex(h => h.toLowerCase().includes(s.toLowerCase()));
        const rows = [];
        for (let j = hIdx + 1; j < lines.length; j++) {
          const line = lines[j].trim();
          if (!line || line.startsWith('Full Summary')) continue;
          const row = buildRow(parseCSVLine(line), g);
          if (row) rows.push(row);
        }
        return rows;
      } catch (e) {
        result.errors.push(`Failed to fetch ${name}: ${e.message}`);
        return [];
      }
    };

    // Fetch clients dictionary
    let repliconClients = [];
    try {
      const data = await wcfRequest('Clients',
        `https://ap1.replicon.com/${company}/services/ClientListService1.svc/GetData`,
        { page: 1, pagesize: 10000, columnUris: ['urn:replicon:client-list-column:client'], sort: [], filterExpression: null },
        headers);
      repliconClients = (data.d?.rows || data.rows || [])
        .map(r => {
          const cell = r.cells?.[0];
          return cell?.textValue && cell?.uri ? { name: cell.textValue } : null;
        })
        .filter(Boolean);
    } catch (e) {
      result.errors.push(`Failed to fetch clients list: ${e.message}`);
    }

    // Fetch roster
    const roster = await parseReport('roster', '3f1148e3-624f-4666-ba25-6a0432a883ee', 'user name', (c, g) => {
      const name = c[g('user name')];
      if (!name) return null;
      return {
        name,
        start:  parseDateToTimestamp(c[g('start date')]),
        end:    parseDateToTimestamp(c[g('end date')]),
        status: c[g('status')] || 'Disabled',
      };
    });

    // Fetch time-entry cube
    const cube = await parseReport('cube', 'c4dc8459-d888-4db8-af86-051e965912b3', 'entry date', (c, g) => {
      const pName = c[g('project name')];
      if (!pName || pName.toLowerCase() === '< none >') return null;
      return {
        dateStr:   c[g('entry date')],
        timestamp: parseDateToTimestamp(c[g('entry date')]),
        user:      c[g('user name')],
        client:    c[g('client name')],
        project:   pName,
        status:    g('project status') > -1 ? c[g('project status')] : 'Open',
        act:       parseNumber(c[g('hours')]),
        est:       parseNumber(c[g('estimated hrs')]),
        quoted:    parseNumber(c[g('quoted hours')]),
      };
    });

    logger.info({ clients: repliconClients.length, roster: roster.length, cube: cube.length }, 'Replicon data fetched');

    // ── 2. Clients ──────────────────────────────────────────────────────────

    const clientNameToId = {};

    const allClientNames = new Set([
      ...repliconClients.map(c => c.name),
      ...cube.map(e => e.client).filter(Boolean),
    ]);

    for (const name of allClientNames) {
      const existing = db.prepare('SELECT id FROM clients WHERE LOWER(name)=LOWER(?)').get(name);
      if (existing) {
        clientNameToId[name] = existing.id;
        result.clients.skipped++;
        continue;
      }
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO clients (id,name,status,createdAt,updatedAt) VALUES (?,?,?,?,?)')
        .run(id, name, 'active', now, now);
      clientNameToId[name] = id;
      result.clients.imported++;
    }

    // ── 3. Employees + optional user accounts ───────────────────────────────

    const empNameToId     = {};
    const empNameToUserId = {};

    // Collect all unique employee names (roster + cube)
    const allEmpNames = new Set([
      ...roster.map(r => r.name).filter(Boolean),
      ...cube.map(e => e.user).filter(Boolean),
    ]);

    // Pre-hash the default password once
    const defaultPwdHash = createAccounts ? await hashPassword('Welcome1!') : null;
    const insertUser = createAccounts
      ? db.prepare('INSERT OR IGNORE INTO users (id,displayName,passwordHash,isAdmin,permissions,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
      : null;

    for (const name of allEmpNames) {
      const existing = db.prepare('SELECT id, userId FROM employees WHERE LOWER(displayName)=LOWER(?)').get(name);
      if (existing) {
        empNameToId[name]     = existing.id;
        empNameToUserId[name] = existing.userId;
        result.employees.skipped++;
        continue;
      }

      const { firstName, lastName } = splitName(name);
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();

      const rosterEntry = roster.find(r => r.name.toLowerCase() === name.toLowerCase());
      const startDate   = rosterEntry?.start ? tsToDate(rosterEntry.start) : null;
      const endDate     = rosterEntry?.end   ? tsToDate(rosterEntry.end)   : null;
      const empStatus   = ['active','enabled'].includes((rosterEntry?.status || '').toLowerCase())
        ? 'active' : 'inactive';

      let userId = null;
      if (insertUser) {
        const slug = makeSlug(name);
        const r = insertUser.run(slug, name, defaultPwdHash, 0,
          JSON.stringify(defaultPermissionsForRole('resource')), now, now);
        if (r.changes > 0) {
          userId = slug;
          empNameToUserId[name] = slug;
        }
      }

      db.prepare(`
        INSERT INTO employees
          (id,userId,firstName,lastName,displayName,role,status,startDate,endDate,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, userId, firstName, lastName, name, 'resource', empStatus, startDate, endDate, now, now);

      empNameToId[name] = id;
      result.employees.imported++;
    }

    // ── 4. Projects ─────────────────────────────────────────────────────────

    const projectNameToId    = {};
    const projectNameToTaskId = {};

    // Aggregate project metadata from cube
    const projectMeta = {};
    for (const e of cube) {
      if (!e.project) continue;
      if (!projectMeta[e.project]) {
        projectMeta[e.project] = { client: e.client, status: e.status, est: 0, quoted: 0 };
      }
      const m = projectMeta[e.project];
      if (e.est    > m.est)    m.est    = e.est;
      if (e.quoted > m.quoted) m.quoted = e.quoted;
    }

    for (const [pName, meta] of Object.entries(projectMeta)) {
      const existing = db.prepare('SELECT id FROM projects WHERE LOWER(name)=LOWER(?)').get(pName);
      if (existing) {
        projectNameToId[pName] = existing.id;
        result.projects.skipped++;
        // Ensure a General task exists
        const existingTask = db.prepare("SELECT id FROM tasks WHERE projectId=? AND name='General'").get(existing.id);
        if (existingTask) {
          projectNameToTaskId[pName] = existingTask.id;
        } else {
          const taskId = crypto.randomUUID();
          const now    = new Date().toISOString();
          db.prepare('INSERT INTO tasks (id,projectId,name,status,estimatedHours,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
            .run(taskId, existing.id, 'General', 'open', meta.est, now, now);
          projectNameToTaskId[pName] = taskId;
          result.tasks.imported++;
        }
        continue;
      }

      const clientId = meta.client ? (clientNameToId[meta.client] || null) : null;
      const psaStatus = STATUS_MAP[(meta.status || '').toLowerCase()] || 'in_progress';
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO projects
          (id,clientId,name,status,billingType,budgetHours,quotedHours,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(id, clientId, pName, psaStatus, 'time_material', meta.est, meta.quoted, now, now);
      projectNameToId[pName] = id;
      result.projects.imported++;

      // Default catch-all task
      const taskId = crypto.randomUUID();
      db.prepare('INSERT INTO tasks (id,projectId,name,status,estimatedHours,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
        .run(taskId, id, 'General', 'open', meta.est, now, now);
      projectNameToTaskId[pName] = taskId;
      result.tasks.imported++;
    }

    // ── 5. Project team assignments ─────────────────────────────────────────

    const seen = new Set();
    for (const e of cube) {
      if (!e.user || !e.project || e.act <= 0) continue;
      const empId  = empNameToId[e.user];
      const projId = projectNameToId[e.project];
      if (!empId || !projId) continue;
      const key = `${projId}:${empId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const exists = db.prepare('SELECT 1 FROM project_resources WHERE projectId=? AND employeeId=?').get(projId, empId);
      if (exists) { result.resources.skipped++; continue; }
      db.prepare('INSERT OR IGNORE INTO project_resources (projectId,employeeId,assignedAt) VALUES (?,?,?)')
        .run(projId, empId, new Date().toISOString());
      result.resources.imported++;
    }

    // ── 6. Historical timesheets ────────────────────────────────────────────

    if (importTimesheets) {
      // Group: userId → weekStart → projectName → dateStr → total hours
      const grouped = {};
      for (const e of cube) {
        if (!e.user || !e.project || e.act <= 0 || !e.timestamp) continue;
        const userId = empNameToUserId[e.user];
        if (!userId) continue;
        const projId = projectNameToId[e.project];
        const taskId = projectNameToTaskId[e.project];
        if (!projId || !taskId) continue;
        const dateStr   = tsToDate(e.timestamp);
        const weekStart = mondayOf(e.timestamp);
        if (!dateStr || !weekStart) continue;

        if (!grouped[userId])                        grouped[userId] = {};
        if (!grouped[userId][weekStart])             grouped[userId][weekStart] = {};
        if (!grouped[userId][weekStart][e.project])  grouped[userId][weekStart][e.project] = {};
        grouped[userId][weekStart][e.project][dateStr] =
          (grouped[userId][weekStart][e.project][dateStr] || 0) + e.act;
      }

      // Pre-prepare statements for performance
      const stmts = {
        getTs:     db.prepare('SELECT id FROM psa_timesheets WHERE userId=? AND weekStart=?'),
        insertTs:  db.prepare('INSERT OR IGNORE INTO psa_timesheets (id,userId,weekStart,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?)'),
        getRow:    db.prepare('SELECT id FROM psa_timesheet_rows WHERE timesheetId=? AND projectId=?'),
        insertRow: db.prepare('INSERT OR IGNORE INTO psa_timesheet_rows (id,timesheetId,projectId,taskId,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'),
        upsertHrs: db.prepare('INSERT OR REPLACE INTO psa_timesheet_hours (rowId,date,hours) VALUES (?,?,?)'),
      };

      db.transaction(() => {
        for (const [userId, weeks] of Object.entries(grouped)) {
          for (const [weekStart, projects] of Object.entries(weeks)) {
            const now = new Date().toISOString();
            let ts = stmts.getTs.get(userId, weekStart);
            if (!ts) {
              const tsId = crypto.randomUUID();
              stmts.insertTs.run(tsId, userId, weekStart, 'approved', now, now);
              ts = { id: tsId };
              result.timesheets.imported++;
            } else {
              result.timesheets.skipped++;
            }

            let sortOrder = 0;
            for (const [pName, dates] of Object.entries(projects)) {
              const projId = projectNameToId[pName];
              const taskId = projectNameToTaskId[pName];
              if (!projId || !taskId) continue;

              let row = stmts.getRow.get(ts.id, projId);
              let rowId = row?.id;
              if (!rowId) {
                rowId = crypto.randomUUID();
                stmts.insertRow.run(rowId, ts.id, projId, taskId, sortOrder++, now, now);
              }

              for (const [dateStr, hours] of Object.entries(dates)) {
                stmts.upsertHrs.run(rowId, dateStr, hours);
              }
            }
          }
        }
      })();
    }

    logger.info({ result }, 'Replicon migration complete');
    res.json({ ok: true, ...result });

  } catch (err) {
    logger.error({ err }, 'Replicon migration failed');
    res.status(500).json({ error: `Migration failed: ${err.message}`, ...result });
  }
});

export default router;
