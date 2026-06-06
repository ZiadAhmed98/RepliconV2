import { Router } from 'express';
import { z }      from 'zod';
import crypto     from 'crypto';
import { requireAuth, hashPassword } from '../lib/auth.js';
import { logger, auditLog }          from '../lib/helpers.js';
import { ALL_PAGES, defaultPermissionsForRole } from '../lib/rbac.js';
import db                            from '../lib/db.js';

const router = Router();

const employeeSchema = z.object({
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  displayName:  z.string().optional(),
  email:        z.string().email().optional().or(z.literal('')),
  employeeId:   z.string().optional(),
  role:         z.enum(['admin', 'pm', 'supervisor', 'resource']).default('resource'),
  skills:       z.array(z.string()).default([]),
  supervisorId: z.string().nullable().optional(),
  startDate:    z.string().optional(),
  endDate:      z.string().nullable().optional(),
  status:       z.enum(['active', 'inactive']).default('active'),
});

router.get('/api/v1/employees', requireAuth, (req, res) => {
  const { status, role, search } = req.query;
  let query  = 'SELECT * FROM employees WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (role)   { query += ' AND role = ?';   params.push(role); }
  if (search) {
    query += ' AND (firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR employeeId LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  query += ' ORDER BY lastName, firstName';
  const rows = db.prepare(query).all(...params);
  res.json({ employees: rows.map(r => ({ ...r, skills: JSON.parse(r.skills || '[]') })) });
});

router.get('/api/v1/employees/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Employee not found' });
  res.json({ employee: { ...row, skills: JSON.parse(row.skills || '[]') } });
});

router.post('/api/v1/employees', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const now = new Date().toISOString();
  const id  = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO employees (id, firstName, lastName, displayName, email, employeeId, role, skills, supervisorId, startDate, endDate, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, d.firstName, d.lastName, d.displayName || `${d.firstName} ${d.lastName}`,
           d.email || null, d.employeeId || null, d.role, JSON.stringify(d.skills),
           d.supervisorId || null, d.startDate || null, d.endDate || null, d.status, now, now);
    auditLog(req.user.id, 'EMPLOYEE_CREATE', { id, name: `${d.firstName} ${d.lastName}` });
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    res.status(201).json({ employee: { ...row, skills: JSON.parse(row.skills) } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email or Employee ID already exists' });
    throw err;
  }
});

router.put('/api/v1/employees/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const now = new Date().toISOString();
  try {
    db.prepare(`
      UPDATE employees SET firstName=?, lastName=?, displayName=?, email=?, employeeId=?,
        role=?, skills=?, supervisorId=?, startDate=?, endDate=?, status=?, updatedAt=?
      WHERE id=?
    `).run(d.firstName, d.lastName, d.displayName || `${d.firstName} ${d.lastName}`,
           d.email || null, d.employeeId || null, d.role, JSON.stringify(d.skills),
           d.supervisorId || null, d.startDate || null, d.endDate || null, d.status, now, req.params.id);
    auditLog(req.user.id, 'EMPLOYEE_UPDATE', { id: req.params.id });
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    res.json({ employee: { ...row, skills: JSON.parse(row.skills) } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email or Employee ID already exists' });
    throw err;
  }
});

router.delete('/api/v1/employees/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  db.prepare('UPDATE employees SET status=?, updatedAt=? WHERE id=?').run('inactive', new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'EMPLOYEE_DEACTIVATE', { id: req.params.id });
  res.json({ ok: true });
});

// ── System account management (admin only) ────────────────────────────────────

router.get('/api/v1/employees/:id/account', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const emp = db.prepare('SELECT id, userId FROM employees WHERE id=?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const account = emp.userId
    ? db.prepare('SELECT id, isAdmin, permissions FROM users WHERE id=?').get(emp.userId)
    : null;
  res.json({
    userId:      emp.userId || null,
    hasAccount:  !!account,
    isAdmin:     account ? !!account.isAdmin : false,
    permissions: account ? JSON.parse(account.permissions || '{}') : {},
  });
});

router.put('/api/v1/employees/:id/account', requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const emp = db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { userId, isAdmin, permissions, password } = req.body || {};
  const uId = (userId !== undefined ? userId : emp.userId)?.toLowerCase().trim() || null;

  if (userId !== undefined) {
    db.prepare('UPDATE employees SET userId=?, updatedAt=? WHERE id=?')
      .run(uId, new Date().toISOString(), req.params.id);
  }

  if (!uId) return res.json({ ok: true, hasAccount: false });

  const displayName = emp.displayName || `${emp.firstName} ${emp.lastName}`;
  const now         = new Date().toISOString();
  const existing    = db.prepare('SELECT id, permissions FROM users WHERE id=?').get(uId);

  if (!existing) {
    if (!password) return res.status(400).json({ error: 'Password required to create a new account' });
    const perms = permissions || defaultPermissionsForRole(emp.role);
    ALL_PAGES.forEach(p => { if (perms[p] === undefined) perms[p] = true; });
    db.prepare(
      'INSERT INTO users (id,displayName,passwordHash,isAdmin,permissions,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'
    ).run(uId, displayName, await hashPassword(password), isAdmin ? 1 : 0, JSON.stringify(perms), now, now);
  } else {
    const perms = permissions !== undefined ? permissions : JSON.parse(existing.permissions || '{}');
    ALL_PAGES.forEach(p => { if (perms[p] === undefined) perms[p] = true; });
    db.prepare('UPDATE users SET displayName=?,updatedAt=? WHERE id=?').run(displayName, now, uId);
    if (isAdmin     !== undefined) db.prepare('UPDATE users SET isAdmin=?,updatedAt=? WHERE id=?').run(isAdmin ? 1 : 0, now, uId);
    db.prepare('UPDATE users SET permissions=?,updatedAt=? WHERE id=?').run(JSON.stringify(perms), now, uId);
    if (password) db.prepare('UPDATE users SET passwordHash=?,updatedAt=? WHERE id=?').run(await hashPassword(password), now, uId);
  }

  auditLog(req.user.id, 'EMPLOYEE_ACCOUNT_UPDATE', { employeeId: req.params.id, userId: uId });
  const saved = db.prepare('SELECT isAdmin FROM users WHERE id=?').get(uId);
  res.json({ ok: true, hasAccount: true, isAdmin: !!saved?.isAdmin });
});

// ── Profile ───────────────────────────────────────────────────────────────────

router.get('/api/v1/profile', requireAuth, (req, res) => {
  const emp  = db.prepare(`
    SELECT e.*, sup.firstName || ' ' || sup.lastName AS supervisorName
    FROM employees e LEFT JOIN employees sup ON e.supervisorId = sup.id
    WHERE e.userId = ?
  `).get(req.user.id);
  const user = db.prepare('SELECT id, displayName, isAdmin FROM users WHERE id=?').get(req.user.id) || {};
  res.json({
    employee: emp ? { ...emp, skills: JSON.parse(emp.skills || '[]') } : null,
    user: { id: req.user.id, name: user.displayName, isAdmin: !!user.isAdmin },
  });
});

router.put('/api/v1/profile', requireAuth, (req, res) => {
  const profileSchema = employeeSchema.extend({ status: z.enum(['active']).default('active') });
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d        = parsed.data;
  const now      = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM employees WHERE userId = ?').get(req.user.id);

  if (existing) {
    db.prepare(`
      UPDATE employees SET firstName=?, lastName=?, displayName=?, email=?, employeeId=?,
        role=?, skills=?, supervisorId=?, startDate=?, endDate=?, status='active', updatedAt=?
      WHERE userId=?
    `).run(d.firstName, d.lastName, d.displayName || `${d.firstName} ${d.lastName}`,
           d.email || null, d.employeeId || null, d.role, JSON.stringify(d.skills),
           d.supervisorId || null, d.startDate || null, d.endDate || null, now, req.user.id);
  } else {
    const id = crypto.randomUUID();
    try {
      db.prepare(`
        INSERT INTO employees (id, userId, firstName, lastName, displayName, email, employeeId, role, skills, supervisorId, startDate, endDate, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(id, req.user.id, d.firstName, d.lastName, d.displayName || `${d.firstName} ${d.lastName}`,
             d.email || null, d.employeeId || null, d.role, JSON.stringify(d.skills),
             d.supervisorId || null, d.startDate || null, d.endDate || null, now, now);
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email or Employee ID already used by another employee' });
      throw err;
    }
  }

  const row = db.prepare(`
    SELECT e.*, sup.firstName || ' ' || sup.lastName AS supervisorName
    FROM employees e LEFT JOIN employees sup ON e.supervisorId = sup.id
    WHERE e.userId = ?
  `).get(req.user.id);
  auditLog(req.user.id, 'PROFILE_UPDATE', { name: `${d.firstName} ${d.lastName}` });
  res.json({ employee: { ...row, skills: JSON.parse(row.skills || '[]') } });
});

export default router;
