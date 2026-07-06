import { Router }                               from 'express';
import { requireAuth, requireAdmin, hashPassword } from '../lib/auth.js';
import { allPermissions, loadAuditLog, appendAudit } from '../lib/rbac.js';
import db                                          from '../lib/db.js';
import { validate, z }                             from '../lib/validate.js';

const router = Router();

// ── Dynamic password policy (Security Settings) ─────────────────────────────
function securitySettings() {
  const out = {};
  db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'security.%'").all().forEach(r => {
    const k = r.key.slice('security.'.length);
    try { out[k] = JSON.parse(r.value); } catch { out[k] = r.value; }
  });
  return out;
}
function passwordPolicyError(pw) {
  const s = securitySettings();
  const min = Number(s.minPasswordLength) || 0;
  if (min && String(pw).length < min)             return `Password must be at least ${min} characters.`;
  if (s.requireUppercase && !/[A-Z]/.test(pw))     return 'Password must contain an uppercase letter.';
  if (s.requireNumber    && !/[0-9]/.test(pw))     return 'Password must contain a number.';
  if (s.requireSymbol    && !/[^A-Za-z0-9]/.test(pw)) return 'Password must contain a symbol.';
  return null;
}

// ── Validation schemas ────────────────────────────────────────────────────────
const createUserSchema = z.object({
  id:          z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(120),
  password:    z.string().min(10, 'Password must be at least 10 characters.').max(200),
  isAdmin:     z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});
const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  password:    z.string().min(10, 'Password must be at least 10 characters.').max(200).optional(),
  isAdmin:     z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});

// ── User CRUD (SQLite) ────────────────────────────────────────────────────────

router.get('/api/v1/admin/users', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, displayName, isAdmin, permissions, createdAt FROM users ORDER BY displayName').all();
  res.json({ users: rows.map(u => ({ ...u, isAdmin: !!u.isAdmin, permissions: JSON.parse(u.permissions || '{}') })) });
});

router.post('/api/v1/admin/users', requireAdmin, validate(createUserSchema), async (req, res) => {
  const { id, displayName, password, isAdmin, permissions } = req.body;
  const pErr = passwordPolicyError(password);
  if (pErr) return res.status(422).json({ error: pErr });

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

router.put('/api/v1/admin/users/:uid', requireAdmin, validate(updateUserSchema), async (req, res) => {
  const { uid } = req.params;
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(uid)) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { displayName, password, isAdmin, permissions } = req.body;
  if (password) { const pErr = passwordPolicyError(password); if (pErr) return res.status(422).json({ error: pErr }); }
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
