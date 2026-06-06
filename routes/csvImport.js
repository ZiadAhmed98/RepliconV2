import { Router }  from 'express';
import crypto      from 'crypto';
import { requireAdmin, hashPassword } from '../lib/auth.js';
import { parseCSVLine, auditLog, logger } from '../lib/helpers.js';
import { loadUsers, saveUsers, defaultPermissionsForRole } from '../lib/rbac.js';
import db from '../lib/db.js';

const router = Router();

// ── helpers ─────────────────────────────────────────────────────────────────

function parseCSVRows(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (vals[idx] ?? '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function parseDate(str) {
  if (!str || str === '') return null;
  const d = new Date(str.replace(/"/g, '').trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Map Replicon employee types to PSA roles
const ROLE_MAP = {
  'general manager': 'supervisor',
  'senior project manager': 'pm',
  'project manager': 'pm',
};
function mapRole(empType) {
  return ROLE_MAP[(empType || '').toLowerCase().trim()] || 'resource';
}

// Map program names to billing types
const PROGRAM_BILLING = {
  'service level agreements': 'sla_retainer',
  'managed services (remote)': 'staff_aug',
  'managed services (on-site)': 'staff_aug',
  'staff augmentation': 'staff_aug',
};
function mapBilling(prog) {
  return PROGRAM_BILLING[(prog || '').toLowerCase().trim()] || 'time_material';
}

// Parse AED-prefixed number strings: "AED151.00" → 151
function parseRate(str) {
  return parseFloat((str || '0').replace(/[^0-9.]/g, '')) || 0;
}

// ── POST /api/v1/admin/import-csv ────────────────────────────────────────────

router.post('/api/v1/admin/import-csv', requireAdmin, async (req, res) => {
  const {
    usersCSV,
    accountManagersCSV,
    projectTasksCSV,
    createAccounts = true,
  } = req.body || {};

  const result = {
    employees: { imported: 0, updated: 0 },
    clients:   { updated: 0 },
    projects:  { imported: 0, updated: 0 },
    tasks:     { imported: 0 },
    resources: { projectLinks: 0, taskLinks: 0 },
    errors:    [],
  };

  try {
    const now = new Date().toISOString();

    // ── PHASE 1: Users CSV (File 3 — employee roster) ───────────────────────
    if (usersCSV) {
      const allRows = parseCSVRows(usersCSV);

      // Deduplicate — one row per user (CSV has duplicate login-session rows)
      const seenKeys = new Set();
      const uniqueRows = [];
      for (const row of allRows) {
        const key = (row['User Email'] || row['User Name'] || '').toLowerCase();
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        uniqueRows.push(row);
      }

      let defaultPwdHash = null;
      if (createAccounts) {
        defaultPwdHash = await hashPassword('Welcome1!');
      }
      const users = createAccounts ? loadUsers() : null;
      let usersChanged = false;

      for (const row of uniqueRows) {
        const name = (row['User Name'] || '').trim();
        if (!name) continue;

        const firstName  = row['User First Name'] || name.split(' ')[0] || '';
        const lastName   = row['User Last Name']  || name.split(' ').slice(1).join(' ') || '';
        const email      = row['User Email']      || null;
        const status     = (row['User Status'] || '').toLowerCase() === 'enabled' ? 'active' : 'inactive';
        const startDate  = parseDate(row['User Start Date']);
        const endDate    = parseDate(row['User End Date']);
        const loginName  = (row['Login Name'] || '').trim() || null;
        const empType    = row['Employee Type (Current)'] || '';
        const role       = mapRole(empType);
        const jobTitle   = empType || null;
        const department = row['Department (Current)'] || null;
        // "Abu Dhabi / UAE" → "Abu Dhabi"
        const rawLoc     = row['Location (Current)'] || '';
        const location   = rawLoc ? rawLoc.split('/')[0].trim() : null;
        const hourlyRate = parseRate(row['Current Hourly Cost']);

        // Find existing employee by email or display name
        const existing = email
          ? db.prepare('SELECT id, userId FROM employees WHERE LOWER(email)=LOWER(?) OR LOWER(displayName)=LOWER(?)').get(email, name)
          : db.prepare('SELECT id, userId FROM employees WHERE LOWER(displayName)=LOWER(?)').get(name);

        if (existing) {
          // Update fields that came from Replicon roster
          db.prepare(`
            UPDATE employees SET
              firstName    = CASE WHEN ? != '' THEN ? ELSE firstName END,
              lastName     = CASE WHEN ? != '' THEN ? ELSE lastName  END,
              email        = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE email END,
              status       = ?,
              role         = ?,
              jobTitle     = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE jobTitle END,
              department   = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE department END,
              officeLocation = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE officeLocation END,
              hourlyRate   = CASE WHEN ? > 0 THEN ? ELSE hourlyRate END,
              startDate    = CASE WHEN ? IS NOT NULL AND startDate IS NULL THEN ? ELSE startDate END,
              endDate      = CASE WHEN ? IS NOT NULL AND endDate   IS NULL THEN ? ELSE endDate   END,
              updatedAt    = ?
            WHERE id = ?
          `).run(
            firstName, firstName,
            lastName,  lastName,
            email, email, email,
            status, role,
            jobTitle, jobTitle, jobTitle,
            department, department, department,
            location, location, location,
            hourlyRate, hourlyRate,
            startDate, startDate,
            endDate,   endDate,
            now, existing.id
          );

          // Create user account if we can and don't have one yet
          if (createAccounts && users && loginName && !existing.userId && !users[loginName]) {
            users[loginName] = {
              id: loginName, displayName: name,
              passwordHash: defaultPwdHash,
              isAdmin: false,
              permissions: defaultPermissionsForRole(role),
              createdAt: now,
            };
            db.prepare('UPDATE employees SET userId=? WHERE id=?').run(loginName, existing.id);
            usersChanged = true;
          }

          result.employees.updated++;
        } else {
          // Create new employee
          const id = crypto.randomUUID();
          let userId = null;

          if (createAccounts && users && loginName && !users[loginName]) {
            users[loginName] = {
              id: loginName, displayName: name,
              passwordHash: defaultPwdHash,
              isAdmin: false,
              permissions: defaultPermissionsForRole(role),
              createdAt: now,
            };
            usersChanged = true;
            userId = loginName;
          }

          db.prepare(`
            INSERT INTO employees
              (id, userId, firstName, lastName, displayName, email, role, status,
               jobTitle, department, officeLocation, hourlyRate, startDate, endDate, createdAt, updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(id, userId, firstName, lastName, name, email, role, status,
                 jobTitle, department, location, hourlyRate, startDate, endDate, now, now);

          result.employees.imported++;
        }
      }

      if (usersChanged && users) saveUsers(users);

      // Second pass: link supervisors (both supervisor + employee must exist now)
      for (const row of uniqueRows) {
        const empName = (row['User Name'] || '').trim();
        const supName = (row['User Supervisor Name (Current)'] || '').trim();
        if (!empName || !supName) continue;
        const emp = db.prepare('SELECT id FROM employees WHERE LOWER(displayName)=LOWER(?)').get(empName);
        const sup = db.prepare('SELECT id FROM employees WHERE LOWER(displayName)=LOWER(?)').get(supName);
        if (emp && sup && emp.id !== sup.id) {
          db.prepare('UPDATE employees SET supervisorId=? WHERE id=? AND supervisorId IS NULL').run(sup.id, emp.id);
        }
      }
    }

    // ── PHASE 2: Account Managers CSV (File 1) ──────────────────────────────
    if (accountManagersCSV) {
      const amRows = parseCSVRows(accountManagersCSV);

      for (const row of amRows) {
        const clientName = (row['Client Name'] || '').trim();
        const amName     = (row['Account Manager'] || '').trim();
        if (!clientName || !amName || amName.toLowerCase() === 'n/a') continue;

        const client = db.prepare('SELECT id FROM clients WHERE LOWER(name)=LOWER(?)').get(clientName);
        if (!client) continue;

        // Find AM employee — create a stub if they're not in the system
        let amEmp = db.prepare('SELECT id FROM employees WHERE LOWER(displayName)=LOWER(?)').get(amName);
        if (!amEmp) {
          const parts = amName.split(' ');
          const id = crypto.randomUUID();
          db.prepare(`INSERT INTO employees (id,firstName,lastName,displayName,role,status,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?)`)
            .run(id, parts[0], parts.slice(1).join(' '), amName, 'resource', 'active', now, now);
          amEmp = { id };
        }

        db.prepare('UPDATE clients SET accountManagerId=?, updatedAt=? WHERE id=?')
          .run(amEmp.id, now, client.id);
        result.clients.updated++;
      }
    }

    // ── PHASE 3: Project/Task CSV (File 2) ──────────────────────────────────
    if (projectTasksCSV) {
      const ptRows = parseCSVRows(projectTasksCSV);

      // Build in-memory project map: projectName → { clientName, program, startDate, endDate, tasks }
      const projectMap = new Map();

      for (const row of ptRows) {
        const pName = (row['Project Name'] || '').trim();
        const tName = (row['Task Name']    || '').trim();
        const cName = (row['Client Name']  || '').trim();
        const uName = (row['User Name']    || '').trim();
        const prog  = (row['Program Name'] || '').trim();
        const sDate = parseDate(row['Project Start Date']);
        const eDate = parseDate(row['Project End Date']);

        if (!pName) continue;

        if (!projectMap.has(pName)) {
          projectMap.set(pName, { clientName: cName, program: prog, startDate: sDate, endDate: eDate, tasks: new Map() });
        }

        const proj = projectMap.get(pName);

        // Extend date range if needed
        if (sDate && (!proj.startDate || sDate < proj.startDate)) proj.startDate = sDate;
        if (eDate && (!proj.endDate   || eDate > proj.endDate))   proj.endDate   = eDate;

        if (tName) {
          if (!proj.tasks.has(tName)) proj.tasks.set(tName, new Set());
          if (uName) proj.tasks.get(tName).add(uName);
        }
      }

      for (const [pName, pData] of projectMap) {
        // Find or create project
        let proj = db.prepare('SELECT id FROM projects WHERE LOWER(name)=LOWER(?)').get(pName);

        if (!proj) {
          const clientId = pData.clientName
            ? db.prepare('SELECT id FROM clients WHERE LOWER(name)=LOWER(?)').get(pData.clientName)?.id ?? null
            : null;
          const billing = mapBilling(pData.program);
          const id = crypto.randomUUID();
          // Default past projects to 'completed', active ones to 'in_progress'
          const today = new Date().toISOString().split('T')[0];
          const pStatus = pData.endDate && pData.endDate < today ? 'completed' : 'in_progress';
          db.prepare(`
            INSERT INTO projects (id,clientId,name,status,billingType,programName,startDate,endDate,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?)
          `).run(id, clientId, pName, pStatus, billing, pData.program || null,
                 pData.startDate || null, pData.endDate || null, now, now);
          proj = { id };
          result.projects.imported++;
        } else {
          // Update what we now know: dates and program name
          db.prepare(`
            UPDATE projects SET
              startDate   = CASE WHEN startDate   IS NULL AND ? IS NOT NULL THEN ? ELSE startDate   END,
              endDate     = CASE WHEN endDate     IS NULL AND ? IS NOT NULL THEN ? ELSE endDate     END,
              programName = CASE WHEN programName IS NULL AND ? IS NOT NULL THEN ? ELSE programName END,
              updatedAt   = ?
            WHERE id = ?
          `).run(pData.startDate, pData.startDate,
                 pData.endDate,   pData.endDate,
                 pData.program,   pData.program,
                 now, proj.id);
          result.projects.updated++;
        }

        // Create tasks + assignments
        for (const [tName, assignedUsers] of pData.tasks) {
          let task = db.prepare('SELECT id FROM tasks WHERE projectId=? AND LOWER(name)=LOWER(?)').get(proj.id, tName);

          if (!task) {
            const taskId = crypto.randomUUID();
            db.prepare('INSERT INTO tasks (id,projectId,name,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?)')
              .run(taskId, proj.id, tName, 'open', now, now);
            task = { id: taskId };
            result.tasks.imported++;
          }

          for (const uName of assignedUsers) {
            const emp = db.prepare('SELECT id FROM employees WHERE LOWER(displayName)=LOWER(?)').get(uName);
            if (!emp) continue;

            // Project assignment
            const pr = db.prepare('INSERT OR IGNORE INTO project_resources (projectId,employeeId,assignedAt) VALUES (?,?,?)')
              .run(proj.id, emp.id, now);
            if (pr.changes > 0) result.resources.projectLinks++;

            // Task assignment
            const tr = db.prepare('INSERT OR IGNORE INTO task_resources (taskId,employeeId,assignedAt) VALUES (?,?,?)')
              .run(task.id, emp.id, now);
            if (tr.changes > 0) result.resources.taskLinks++;
          }
        }
      }
    }

    auditLog(req.user, 'csv_import', { employees: result.employees, projects: result.projects });
    logger.info({ result }, 'CSV import complete');
    res.json({ ok: true, ...result });

  } catch (err) {
    logger.error({ err }, 'CSV import failed');
    result.errors.push(err.message);
    res.status(500).json({ ok: false, error: `Import failed: ${err.message}`, ...result });
  }
});

export default router;
