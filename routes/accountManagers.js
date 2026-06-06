import { Router } from 'express';
import crypto     from 'crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { auditLog }                  from '../lib/helpers.js';
import db                            from '../lib/db.js';

const router = Router();

router.get('/api/v1/account-managers', requireAuth, (req, res) => {
  const { status, search } = req.query;
  let q = 'SELECT * FROM account_managers WHERE 1=1';
  const params = [];
  if (status) { q += ' AND status=?'; params.push(status); }
  if (search) {
    q += ' AND (displayName LIKE ? OR firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR title LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }
  q += ' ORDER BY displayName, firstName, lastName';
  const rows = db.prepare(q).all(...params);
  const countStmt = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE managerId=? AND status=?');
  const result = rows.map(r => ({
    ...r,
    clientCount: countStmt.get(r.id, 'active')?.n ?? 0,
  }));
  res.json({ accountManagers: result });
});

router.get('/api/v1/account-managers/:id', requireAuth, (req, res) => {
  const am = db.prepare('SELECT * FROM account_managers WHERE id=?').get(req.params.id);
  if (!am) return res.status(404).json({ error: 'Account manager not found' });
  const clients = db.prepare('SELECT id, name, status FROM clients WHERE managerId=? ORDER BY name').all(req.params.id);
  res.json({ accountManager: { ...am, clients } });
});

router.post('/api/v1/account-managers', requireAdmin, (req, res) => {
  const { firstName, lastName, displayName, email, phone, title } = req.body || {};
  if (!firstName?.trim() || !lastName?.trim()) return res.status(400).json({ error: 'firstName and lastName required' });
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = displayName?.trim() || `${firstName.trim()} ${lastName.trim()}`;
  db.prepare(`INSERT INTO account_managers (id,firstName,lastName,displayName,email,phone,title,status,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, firstName.trim(), lastName.trim(), name, email || null, phone || null, title || null, 'active', now, now);
  auditLog(req.user.id, 'AM_CREATE', { id, name });
  res.status(201).json({ accountManager: db.prepare('SELECT * FROM account_managers WHERE id=?').get(id) });
});

router.put('/api/v1/account-managers/:id', requireAdmin, (req, res) => {
  const am = db.prepare('SELECT * FROM account_managers WHERE id=?').get(req.params.id);
  if (!am) return res.status(404).json({ error: 'Account manager not found' });
  const { firstName, lastName, displayName, email, phone, title, status } = req.body || {};
  const fn   = firstName?.trim()  || am.firstName;
  const ln   = lastName?.trim()   || am.lastName;
  const name = displayName?.trim() || `${fn} ${ln}`;
  const now  = new Date().toISOString();
  db.prepare(`UPDATE account_managers SET firstName=?,lastName=?,displayName=?,email=?,phone=?,title=?,status=?,updatedAt=? WHERE id=?`)
    .run(fn, ln, name, email !== undefined ? (email || null) : am.email,
         phone !== undefined ? (phone || null) : am.phone,
         title !== undefined ? (title || null) : am.title,
         status || am.status, now, req.params.id);
  auditLog(req.user.id, 'AM_UPDATE', { id: req.params.id });
  res.json({ accountManager: db.prepare('SELECT * FROM account_managers WHERE id=?').get(req.params.id) });
});

router.delete('/api/v1/account-managers/:id', requireAdmin, (req, res) => {
  const am = db.prepare('SELECT * FROM account_managers WHERE id=?').get(req.params.id);
  if (!am) return res.status(404).json({ error: 'Account manager not found' });
  db.prepare('UPDATE account_managers SET status=?,updatedAt=? WHERE id=?')
    .run('inactive', new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'AM_DEACTIVATE', { id: req.params.id });
  res.json({ ok: true });
});

export default router;
