import { Router } from 'express';
import { z }      from 'zod';
import crypto     from 'crypto';
import { requireAuth }                from '../lib/auth.js';
import { auditLog }                   from '../lib/helpers.js';
import { parseTasksXml }             from '../lib/xml.js';
import db                             from '../lib/db.js';

const router = Router();

const psaTaskSchema = z.object({
  parentTaskId:   z.string().nullable().optional(),
  name:           z.string().min(1),
  code:           z.string().nullable().optional(),
  description:    z.string().nullable().optional(),
  startDate:      z.string().nullable().optional(),
  endDate:        z.string().nullable().optional(),
  status:         z.enum(['open','in_progress','completed','closed']).default('open'),
  estimatedHours: z.number().min(0).default(0),
  sortOrder:      z.number().int().default(0),
});

router.post('/api/v1/psa/parse-xml', requireAuth, (req, res) => {
  const { xml } = req.body;
  if (!xml || typeof xml !== 'string') return res.status(400).json({ error: 'xml string required' });
  try {
    const tasks = parseTasksXml(xml);
    if (tasks.length === 0) return res.status(400).json({ error: 'No tasks found in XML. Supported formats: MS Project XML or simple <task name="..." estimatedHours="..."> format.' });
    res.json({ tasks });
  } catch (e) {
    res.status(400).json({ error: e.message || 'XML parse error' });
  }
});

router.get('/api/v1/psa/tasks', requireAuth, (req, res) => {
  const { projectId, mine } = req.query;
  let q = `
    SELECT t.*, p.name AS projectName, p.clientId, c.name AS clientName
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.projectId
    LEFT JOIN clients  c ON c.id = p.clientId
    WHERE 1=1
  `;
  const params = [];
  if (projectId) { q += ' AND t.projectId = ?'; params.push(projectId); }
  if (mine === 'true') {
    const emp = db.prepare('SELECT id FROM employees WHERE userId=?').get(req.user.id);
    if (!emp) return res.json({ tasks: [] });
    q += ' AND EXISTS (SELECT 1 FROM task_resources tr WHERE tr.taskId = t.id AND tr.employeeId = ?)';
    params.push(emp.id);
  }
  q += ' ORDER BY t.sortOrder ASC, t.name ASC';
  res.json({ tasks: db.prepare(q).all(...params) });
});

router.get('/api/v1/psa/projects/:projectId/tasks', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.name AS parentTaskName
    FROM tasks t LEFT JOIN tasks p ON p.id = t.parentTaskId
    WHERE t.projectId = ?
    ORDER BY t.sortOrder ASC, t.createdAt ASC
  `).all(req.params.projectId);

  // Fetch all task resources for this project in one query
  const resources = db.prepare(`
    SELECT tr.taskId, e.id, e.firstName, e.lastName, e.displayName, e.role
    FROM task_resources tr
    JOIN employees e ON e.id = tr.employeeId
    WHERE tr.taskId IN (SELECT id FROM tasks WHERE projectId = ?)
    ORDER BY e.lastName, e.firstName
  `).all(req.params.projectId);

  const resourcesByTask = {};
  resources.forEach(r => {
    if (!resourcesByTask[r.taskId]) resourcesByTask[r.taskId] = [];
    resourcesByTask[r.taskId].push({ id: r.id, firstName: r.firstName, lastName: r.lastName, displayName: r.displayName, role: r.role });
  });

  res.json({ tasks: rows.map(t => ({ ...t, resources: resourcesByTask[t.id] || [] })) });
});

router.post('/api/v1/psa/projects/:projectId/tasks', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const project = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const parsed = psaTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO tasks (id,projectId,parentTaskId,name,code,description,startDate,endDate,status,estimatedHours,sortOrder,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.params.projectId, d.parentTaskId||null, d.name, d.code||null, d.description||null,
         d.startDate||null, d.endDate||null, d.status, d.estimatedHours, d.sortOrder, now, now);
  auditLog(req.user.id, 'TASK_CREATE', { id, name: d.name, projectId: req.params.projectId });
  const row = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  res.status(201).json({ task: row });
});

router.post('/api/v1/psa/projects/:projectId/tasks/bulk', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const project = db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const { tasks: incoming } = req.body;
  if (!Array.isArray(incoming) || incoming.length === 0) return res.status(400).json({ error: 'tasks array required' });
  const now    = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO tasks (id,projectId,parentTaskId,name,code,description,startDate,endDate,status,estimatedHours,sortOrder,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const idMap = {};
  db.transaction((rows) => {
    rows.forEach((t, idx) => {
      const id       = crypto.randomUUID();
      idMap[t._tempId] = id;
      const parentId = t._parentTempId ? (idMap[t._parentTempId] || null) : null;
      insert.run(id, req.params.projectId, parentId, t.name, t.code||null, t.description||null,
                 t.startDate||null, t.endDate||null, t.status||'open', t.estimatedHours||0, idx, now, now);
    });
  })(incoming);
  auditLog(req.user.id, 'TASKS_BULK_IMPORT', { projectId: req.params.projectId, count: incoming.length });
  const rows = db.prepare('SELECT * FROM tasks WHERE projectId=? ORDER BY sortOrder ASC').all(req.params.projectId);
  res.status(201).json({ tasks: rows, imported: incoming.length });
});

router.put('/api/v1/psa/tasks/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const parsed = psaTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks SET parentTaskId=?,name=?,code=?,description=?,startDate=?,endDate=?,status=?,estimatedHours=?,sortOrder=?,updatedAt=?
    WHERE id=?
  `).run(d.parentTaskId||null, d.name, d.code||null, d.description||null,
         d.startDate||null, d.endDate||null, d.status, d.estimatedHours, d.sortOrder, now, req.params.id);
  auditLog(req.user.id, 'TASK_UPDATE', { id: req.params.id });
  const row = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  res.json({ task: row });
});

// Status-only update — allowed for admins AND for the resource assigned to the
// task (so people can move their own work across the board). Does not touch any
// other field, unlike the admin-only full PUT above.
const statusOnlySchema = z.object({ status: z.enum(['open','in_progress','completed','closed']) });

router.patch('/api/v1/psa/tasks/:id/status', requireAuth, (req, res) => {
  const parsed = statusOnlySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'status must be one of open, in_progress, completed, closed' });
  const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  let allowed = !!req.user.isAdmin;
  if (!allowed) {
    const emp = db.prepare('SELECT id FROM employees WHERE userId=?').get(req.user.id);
    if (emp) {
      const assigned = db.prepare('SELECT 1 FROM task_resources WHERE taskId=? AND employeeId=?').get(req.params.id, emp.id);
      allowed = !!assigned;
    }
  }
  if (!allowed) return res.status(403).json({ error: 'You can only change the status of tasks assigned to you.' });

  const now = new Date().toISOString();
  db.prepare('UPDATE tasks SET status=?, updatedAt=? WHERE id=?').run(parsed.data.status, now, req.params.id);
  auditLog(req.user.id, 'TASK_STATUS_UPDATE', { id: req.params.id, status: parsed.data.status });
  res.json({ task: db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id) });
});

router.delete('/api/v1/psa/tasks/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  auditLog(req.user.id, 'TASK_DELETE', { id: req.params.id });
  res.json({ ok: true });
});

// ── Task resource assignment ───────────────────────────────────────────────────

router.post('/api/v1/psa/tasks/:id/resources', requireAuth, (req, res) => {
  if (!req.user.isAdmin && req.user.role !== 'pm') return res.status(403).json({ error: 'Admin or PM only' });
  const { employeeId } = req.body || {};
  if (!employeeId) return res.status(400).json({ error: 'employeeId required' });
  const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  try {
    db.prepare('INSERT INTO task_resources (taskId, employeeId, assignedAt) VALUES (?,?,?)')
      .run(req.params.id, employeeId, new Date().toISOString());
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Already assigned' });
    throw e;
  }
  res.status(201).json({ ok: true });
});

router.delete('/api/v1/psa/tasks/:id/resources/:employeeId', requireAuth, (req, res) => {
  if (!req.user.isAdmin && req.user.role !== 'pm') return res.status(403).json({ error: 'Admin or PM only' });
  db.prepare('DELETE FROM task_resources WHERE taskId=? AND employeeId=?')
    .run(req.params.id, req.params.employeeId);
  res.json({ ok: true });
});

export default router;
