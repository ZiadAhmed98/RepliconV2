import { Router }                               from 'express';
import { requireAuth, requireAdmin, hashPassword } from '../lib/auth.js';
import { allPermissions, loadAuditLog, appendAudit } from '../lib/rbac.js';
import db                                          from '../lib/db.js';

const router = Router();

// ── User CRUD (SQLite) ────────────────────────────────────────────────────────

router.get('/api/v1/admin/users', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, displayName, isAdmin, permissions, createdAt FROM users ORDER BY displayName').all();
  res.json({ users: rows.map(u => ({ ...u, isAdmin: !!u.isAdmin, permissions: JSON.parse(u.permissions || '{}') })) });
});

router.post('/api/v1/admin/users', requireAdmin, async (req, res) => {
  const { id, displayName, password, isAdmin, permissions } = req.body || {};
  if (!id || !displayName || !password) return res.status(400).json({ error: 'id, displayName, password required.' });

  const cleanId = String(id).toLowerCase().trim().replace(/\s+/g, '_');
  if (db.prepare('SELECT id FROM users WHERE id=?').get(cleanId)) {
    return res.status(409).json({ error: 'User already exists.' });
  }

  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id,displayName,passwordHash,isAdmin,permissions,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'
  ).run(cleanId, String(displayName).trim(), await hashPassword(password),
        isAdmin === true ? 1 : 0, JSON.stringify(permissions || allPermissions()), now, now);

  appendAudit({ user: req.user.name, action: 'CREATE_USER', target: cleanId });
  const row = db.prepare('SELECT id,displayName,isAdmin,permissions FROM users WHERE id=?').get(cleanId);
  res.json({ success: true, user: { ...row, isAdmin: !!row.isAdmin, permissions: JSON.parse(row.permissions) } });
});

router.put('/api/v1/admin/users/:uid', requireAdmin, async (req, res) => {
  const { uid } = req.params;
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(uid)) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { displayName, password, isAdmin, permissions } = req.body || {};
  const now = new Date().toISOString();
  if (displayName)                  db.prepare('UPDATE users SET displayName=?,updatedAt=? WHERE id=?').run(String(displayName).trim(), now, uid);
  if (typeof isAdmin === 'boolean') db.prepare('UPDATE users SET isAdmin=?,updatedAt=? WHERE id=?').run(isAdmin ? 1 : 0, now, uid);
  if (permissions)                  db.prepare('UPDATE users SET permissions=?,updatedAt=? WHERE id=?').run(JSON.stringify(permissions), now, uid);
  if (password)                     db.prepare('UPDATE users SET passwordHash=?,updatedAt=? WHERE id=?').run(await hashPassword(password), now, uid);

  appendAudit({ user: req.user.name, action: 'UPDATE_USER', target: uid, changes: Object.keys(req.body || {}) });
  const row = db.prepare('SELECT id,displayName,isAdmin,permissions FROM users WHERE id=?').get(uid);
  res.json({ success: true, user: { ...row, isAdmin: !!row.isAdmin, permissions: JSON.parse(row.permissions) } });
});

router.delete('/api/v1/admin/users/:uid', requireAdmin, (req, res) => {
  const { uid } = req.params;
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account.' });
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(uid)) {
    return res.status(404).json({ error: 'User not found.' });
  }
  db.prepare('DELETE FROM users WHERE id=?').run(uid);
  db.prepare('UPDATE employees SET userId=NULL WHERE userId=?').run(uid);
  appendAudit({ user: req.user.name, action: 'DELETE_USER', target: uid });
  res.json({ success: true });
});

// ── Audit log ─────────────────────────────────────────────────────────────────

router.get('/api/v1/admin/audit', requireAdmin, (req, res) => {
  const log = loadAuditLog();
  res.json({ log: log.slice().reverse().slice(0, 500) });
});

router.post('/api/v1/audit/pageview', requireAuth, (req, res) => {
  const { page } = req.body || {};
  if (!page) return res.status(400).json({ error: 'page required.' });
  appendAudit({ user: String(req.user.name || '').slice(0, 100), action: 'PAGE_VIEW', page: String(page).slice(0, 200) });
  res.json({ ok: true });
});

export default router;
