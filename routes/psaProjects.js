import { Router } from 'express';
import { z }      from 'zod';
import crypto     from 'crypto';
import { requireAuth }  from '../lib/auth.js';
import { auditLog }     from '../lib/helpers.js';
import db               from '../lib/db.js';

const router = Router();

const psaProjectSchema = z.object({
  clientId:          z.string().nullable().optional(),
  programId:         z.string().nullable().optional(),
  name:              z.string().min(1),
  code:              z.string().max(30).nullable().optional(),
  status:            z.enum(['tentative','in_progress','completed','deferred','cancelled','archived']).default('in_progress'),
  projectManagerId:  z.string().nullable().optional(),
  startDate:         z.string().nullable().optional(),
  endDate:           z.string().nullable().optional(),
  budgetHours:       z.number().min(0).default(0),
  billingType:       z.enum(['time_material','fixed_bid','non_billable','adoption_tm','sla_retainer','staff_aug']).default('time_material'),
  quotedHours:       z.number().min(0).default(0),
  ticketAllocation:  z.number().min(0).default(0),
  monthlyAllocation: z.number().min(0).default(0),
  notes:             z.string().nullable().optional(),
});

router.get('/api/v1/psa/projects', requireAuth, (req, res) => {
  const { status, clientId, pmId, search, mine } = req.query;
  let q = `
    SELECT p.*, c.name AS clientName, e.firstName || ' ' || e.lastName AS projectManagerName,
           pr.name AS programName
    FROM projects p
    LEFT JOIN clients   c  ON c.id  = p.clientId
    LEFT JOIN employees e  ON e.id  = p.projectManagerId
    LEFT JOIN programs  pr ON pr.id = p.programId
    WHERE 1=1
  `;
  const params = [];
  if (status)   { q += ' AND p.status = ?';           params.push(status); }
  if (clientId) { q += ' AND p.clientId = ?';         params.push(clientId); }
  if (pmId)     { q += ' AND p.projectManagerId = ?'; params.push(pmId); }
  if (search)   { q += ' AND (p.name LIKE ? OR p.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (mine === 'true') {
    const emp = db.prepare('SELECT id FROM employees WHERE userId=?').get(req.user.id);
    if (emp) {
      q += ` AND (p.projectManagerId = ? OR EXISTS (
        SELECT 1 FROM project_resources pr WHERE pr.projectId = p.id AND pr.employeeId = ?
      ))`;
      params.push(emp.id, emp.id);
    }
  }
  q += ' ORDER BY p.createdAt DESC';
  res.json({ projects: db.prepare(q).all(...params) });
});

router.get('/api/v1/psa/projects/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT p.*, c.name AS clientName, e.firstName || ' ' || e.lastName AS projectManagerName,
           pr.name AS programName
    FROM projects p
    LEFT JOIN clients   c  ON c.id  = p.clientId
    LEFT JOIN employees e  ON e.id  = p.projectManagerId
    LEFT JOIN programs  pr ON pr.id = p.programId
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  res.json({ project: row });
});

router.post('/api/v1/psa/projects', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const parsed = psaProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d    = parsed.data;
  const id   = crypto.randomUUID();
  const now  = new Date().toISOString();
  const code = d.code ? d.code.toUpperCase() : null;
  try {
    db.prepare(`
      INSERT INTO projects (id,clientId,programId,name,code,status,projectManagerId,startDate,endDate,budgetHours,billingType,quotedHours,ticketAllocation,monthlyAllocation,notes,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, d.clientId||null, d.programId||null, d.name, code, d.status, d.projectManagerId||null,
           d.startDate||null, d.endDate||null, d.budgetHours, d.billingType,
           d.quotedHours||0, d.ticketAllocation||0, d.monthlyAllocation||0,
           d.notes||null, now, now);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Project code already exists' });
    throw e;
  }
  auditLog(req.user.id, 'PROJECT_CREATE', { id, name: d.name });
  const row = db.prepare('SELECT * FROM projects WHERE id=?').get(id);
  res.status(201).json({ project: row });
});

router.put('/api/v1/psa/projects/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  const parsed = psaProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d    = parsed.data;
  const now  = new Date().toISOString();
  const code = d.code ? d.code.toUpperCase() : null;
  try {
    db.prepare(`
      UPDATE projects SET clientId=?,programId=?,name=?,code=?,status=?,projectManagerId=?,
        startDate=?,endDate=?,budgetHours=?,billingType=?,quotedHours=?,ticketAllocation=?,monthlyAllocation=?,notes=?,updatedAt=?
      WHERE id=?
    `).run(d.clientId||null, d.programId||null, d.name, code, d.status, d.projectManagerId||null,
           d.startDate||null, d.endDate||null, d.budgetHours, d.billingType,
           d.quotedHours||0, d.ticketAllocation||0, d.monthlyAllocation||0,
           d.notes||null, now, req.params.id);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Project code already exists' });
    throw e;
  }
  auditLog(req.user.id, 'PROJECT_UPDATE', { id: req.params.id });
  const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  res.json({ project: row });
});

router.delete('/api/v1/psa/projects/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  db.prepare('UPDATE projects SET status=?,updatedAt=? WHERE id=?').run('archived', new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'PROJECT_ARCHIVE', { id: req.params.id });
  res.json({ ok: true });
});

// ── Project resource (team) assignment ────────────────────────────────────────

router.get('/api/v1/psa/projects/:id/resources', requireAuth, (req, res) => {
  const members = db.prepare(`
    SELECT e.id, e.firstName, e.lastName, e.displayName, e.email, e.role, e.employeeId,
           pr.assignedAt
    FROM project_resources pr
    JOIN employees e ON e.id = pr.employeeId
    WHERE pr.projectId = ?
    ORDER BY e.lastName, e.firstName
  `).all(req.params.id);
  res.json({ members });
});

router.post('/api/v1/psa/projects/:id/resources', requireAuth, (req, res) => {
  if (!req.user.isAdmin && req.user.role !== 'pm') return res.status(403).json({ error: 'Admin or PM only' });
  const { employeeId } = req.body || {};
  if (!employeeId) return res.status(400).json({ error: 'employeeId required' });
  const proj = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const emp = db.prepare('SELECT id FROM employees WHERE id=?').get(employeeId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT INTO project_resources (projectId, employeeId, assignedAt) VALUES (?,?,?)')
      .run(req.params.id, employeeId, now);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Already assigned' });
    throw e;
  }
  // Auto-assign to all existing tasks in this project
  const projectTasks = db.prepare('SELECT id FROM tasks WHERE projectId=?').all(req.params.id);
  if (projectTasks.length > 0) {
    const taskInsert = db.prepare('INSERT OR IGNORE INTO task_resources (taskId, employeeId, assignedAt) VALUES (?,?,?)');
    db.transaction(() => { projectTasks.forEach(t => taskInsert.run(t.id, employeeId, now)); })();
  }
  auditLog(req.user.id, 'PROJECT_RESOURCE_ADD', { projectId: req.params.id, employeeId, tasksAutoAssigned: projectTasks.length });
  res.status(201).json({ ok: true, tasksAutoAssigned: projectTasks.length });
});

router.delete('/api/v1/psa/projects/:id/resources/:employeeId', requireAuth, (req, res) => {
  if (!req.user.isAdmin && req.user.role !== 'pm') return res.status(403).json({ error: 'Admin or PM only' });
  db.prepare('DELETE FROM project_resources WHERE projectId=? AND employeeId=?')
    .run(req.params.id, req.params.employeeId);
  auditLog(req.user.id, 'PROJECT_RESOURCE_REMOVE', { projectId: req.params.id, employeeId: req.params.employeeId });
  res.json({ ok: true });
});

// ── Project access requests ───────────────────────────────────────────────────

router.post('/api/v1/psa/projects/:id/request-access', requireAuth, (req, res) => {
  const proj = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const emp = db.prepare('SELECT id FROM employees WHERE userId=?').get(req.user.id);
  if (!emp) return res.status(400).json({ error: 'No employee record linked to your account' });
  // Check if already assigned
  const assigned = db.prepare('SELECT 1 FROM project_resources WHERE projectId=? AND employeeId=?').get(req.params.id, emp.id);
  if (assigned) return res.status(409).json({ error: 'Already assigned to this project' });
  const id = crypto.randomUUID();
  try {
    db.prepare(`INSERT INTO project_access_requests (id,projectId,employeeId,requestedBy,status,createdAt) VALUES (?,?,?,?,'pending',?)`)
      .run(id, req.params.id, emp.id, req.user.id, new Date().toISOString());
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Request already submitted' });
    throw e;
  }
  auditLog(req.user.id, 'ACCESS_REQUEST', { projectId: req.params.id });
  res.status(201).json({ ok: true, requestId: id });
});

router.get('/api/v1/psa/projects/:id/access-requests', requireAuth, (req, res) => {
  if (!req.user.isAdmin && req.user.role !== 'pm' && req.user.role !== 'supervisor') return res.status(403).json({ error: 'Admin or PM only' });
  const rows = db.prepare(`
    SELECT r.id, r.status, r.createdAt, r.note,
           e.id AS employeeId, e.firstName, e.lastName, e.displayName, e.email, e.role
    FROM project_access_requests r
    JOIN employees e ON e.id = r.employeeId
    WHERE r.projectId = ? AND r.status = 'pending'
    ORDER BY r.createdAt DESC
  `).all(req.params.id);
  res.json({ requests: rows });
});

router.patch('/api/v1/psa/project-access-requests/:reqId', requireAuth, (req, res) => {
  if (!req.user.isAdmin && req.user.role !== 'pm' && req.user.role !== 'supervisor') return res.status(403).json({ error: 'Admin or PM only' });
  const { action } = req.body || {};
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });
  const row = db.prepare('SELECT * FROM project_access_requests WHERE id=?').get(req.params.reqId);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  const now = new Date().toISOString();
  db.prepare('UPDATE project_access_requests SET status=?,reviewedBy=?,reviewedAt=? WHERE id=?')
    .run(action === 'approve' ? 'approved' : 'rejected', req.user.id, now, req.params.reqId);
  if (action === 'approve') {
    try {
      db.prepare('INSERT INTO project_resources (projectId,employeeId,assignedAt) VALUES (?,?,?)')
        .run(row.projectId, row.employeeId, now);
      // Auto-assign to all existing tasks
      const projectTasks = db.prepare('SELECT id FROM tasks WHERE projectId=?').all(row.projectId);
      if (projectTasks.length > 0) {
        const taskInsert = db.prepare('INSERT OR IGNORE INTO task_resources (taskId,employeeId,assignedAt) VALUES (?,?,?)');
        db.transaction(() => { projectTasks.forEach(t => taskInsert.run(t.id, row.employeeId, now)); })();
      }
    } catch { /* already assigned, ignore */ }
    auditLog(req.user.id, 'ACCESS_REQUEST_APPROVED', { requestId: req.params.reqId, projectId: row.projectId, employeeId: row.employeeId });
  } else {
    auditLog(req.user.id, 'ACCESS_REQUEST_REJECTED', { requestId: req.params.reqId, projectId: row.projectId });
  }
  res.json({ ok: true });
});

router.get('/api/v1/psa/my-access-requests', requireAuth, (req, res) => {
  const emp = db.prepare('SELECT id FROM employees WHERE userId=?').get(req.user.id);
  if (!emp) return res.json({ requests: [] });
  const rows = db.prepare(`
    SELECT r.id, r.status, r.createdAt, r.projectId,
           p.name AS projectName, p.code AS projectCode
    FROM project_access_requests r
    JOIN projects p ON p.id = r.projectId
    WHERE r.employeeId = ?
    ORDER BY r.createdAt DESC
  `).all(emp.id);
  res.json({ requests: rows });
});

export default router;
