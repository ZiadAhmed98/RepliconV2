import { Router }                               from 'express';
import { requireAuth, requireAdmin, hashPassword } from '../lib/auth.js';
import { loadUsers, saveUsers, allPermissions,
         loadAuditLog, appendAudit }               from '../lib/rbac.js';

const router = Router();

router.get('/api/v1/admin/users', requireAdmin, (req, res) => {
  const users = loadUsers();
  const safe  = Object.values(users).map(({ passwordHash: _p, ...u }) => u);
  res.json({ users: safe });
});

router.post('/api/v1/admin/users', requireAdmin, async (req, res) => {
  const { id, displayName, password, isAdmin, permissions } = req.body || {};
  if (!id || !displayName || !password) return res.status(400).json({ error: 'id, displayName, password required.' });

  const cleanId = String(id).toLowerCase().trim().replace(/\s+/g, '_');
  const users   = loadUsers();
  if (users[cleanId]) return res.status(409).json({ error: 'User already exists.' });

  users[cleanId] = {
    id:           cleanId,
    displayName:  String(displayName).trim(),
    passwordHash: await hashPassword(password),
    isAdmin:      isAdmin === true,
    permissions:  permissions || allPermissions(),
    createdAt:    new Date().toISOString(),
  };
  saveUsers(users);
  appendAudit({ user: req.user.name, action: 'CREATE_USER', target: cleanId });
  const { passwordHash: _p, ...safe } = users[cleanId];
  res.json({ success: true, user: safe });
});

router.put('/api/v1/admin/users/:uid', requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const users   = loadUsers();
  if (!users[uid]) return res.status(404).json({ error: 'User not found.' });

  const { displayName, password, isAdmin, permissions } = req.body || {};
  if (displayName)               users[uid].displayName  = String(displayName).trim();
  if (typeof isAdmin === 'boolean') users[uid].isAdmin  = isAdmin;
  if (permissions)               users[uid].permissions  = permissions;
  if (password)                  users[uid].passwordHash = await hashPassword(password);

  saveUsers(users);
  appendAudit({ user: req.user.name, action: 'UPDATE_USER', target: uid, changes: Object.keys(req.body || {}) });
  const { passwordHash: _p, ...safe } = users[uid];
  res.json({ success: true, user: safe });
});

router.delete('/api/v1/admin/users/:uid', requireAdmin, (req, res) => {
  const { uid } = req.params;
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account.' });
  const users = loadUsers();
  if (!users[uid]) return res.status(404).json({ error: 'User not found.' });
  delete users[uid];
  saveUsers(users);
  appendAudit({ user: req.user.name, action: 'DELETE_USER', target: uid });
  res.json({ success: true });
});

router.get('/api/v1/admin/audit', requireAdmin, (req, res) => {
  const log = loadAuditLog();
  res.json({ log: log.slice().reverse().slice(0, 500) });
});

router.post('/api/v1/audit/pageview', requireAuth, (req, res) => {
  const { page } = req.body || {};
  if (!page) return res.status(400).json({ error: 'page required.' });
  appendAudit({ user: req.user.name, action: 'PAGE_VIEW', page: String(page).slice(0, 100) });
  res.json({ ok: true });
});

export default router;
