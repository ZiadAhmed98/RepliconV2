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
  const { projectId } = req.query;
  let q = `
    SELECT t.*, p.name AS projectName, p.clientId
    FROM tasks t LEFT JOIN projects p ON p.id = t.projectId
    WHERE 1=1
  `;
  const params = [];
  if (projectId) { q += ' AND t.projectId = ?'; params.push(projectId); }
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
  res.json({ tasks: rows });
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

router.delete('/api/v1/psa/tasks/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  auditLog(req.user.id, 'TASK_DELETE', { id: req.params.id });
  res.json({ ok: true });
});

export default router;
