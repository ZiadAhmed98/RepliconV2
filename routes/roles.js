import { Router } from 'express';
import crypto     from 'crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { auditLog }                  from '../lib/helpers.js';
import db                            from '../lib/db.js';

const router = Router();

function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'role';
}

function shapeRole(r) {
  return { ...r, isManager: !!r.isManager, isSystem: !!r.isSystem, permissions: JSON.parse(r.permissions || '{}') };
}

// List roles (any signed-in user — needed to populate dropdowns) + member counts
router.get('/api/v1/roles', requireAuth, (req, res) => {
  const roles  = db.prepare('SELECT * FROM roles ORDER BY sortOrder ASC, name ASC').all().map(shapeRole);
  const counts = db.prepare('SELECT role, COUNT(*) AS n FROM employees GROUP BY role').all();
  const cmap   = Object.fromEntries(counts.map(c => [c.role, c.n]));
  roles.forEach(r => { r.memberCount = cmap[r.id] || 0; });
  res.json({ roles });
});

// Create a custom role
router.post('/api/v1/roles', requireAdmin, (req, res) => {
  const { name, description, isManager } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Role name is required' });

  let id = slugify(name);
  if (db.prepare('SELECT 1 FROM roles WHERE id=?').get(id)) id = `${id}-${crypto.randomBytes(2).toString('hex')}`;

  const now      = new Date().toISOString();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sortOrder),0)+1 AS n FROM roles').get().n;
  try {
    db.prepare('INSERT INTO roles (id,name,description,isManager,isSystem,permissions,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,0,?,?,?,?)')
      .run(id, String(name).trim(), description || null, isManager ? 1 : 0, '{}', maxOrder, now, now);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'A role with that name already exists' });
    throw e;
  }
  auditLog(req.user.id, 'ROLE_CREATE', { id, name });
  res.status(201).json({ role: { ...shapeRole(db.prepare('SELECT * FROM roles WHERE id=?').get(id)), memberCount: 0 } });
});

// Edit a role (name/description/isManager). System roles stay editable except deletion.
router.put('/api/v1/roles/:id', requireAdmin, (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE id=?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  const { name, description, isManager } = req.body || {};
  const now = new Date().toISOString();
  try {
    db.prepare('UPDATE roles SET name=?, description=?, isManager=?, updatedAt=? WHERE id=?')
      .run(
        (name && String(name).trim()) ? String(name).trim() : role.name,
        description !== undefined ? (description || null) : role.description,
        isManager !== undefined ? (isManager ? 1 : 0) : role.isManager,
        now, req.params.id,
      );
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'A role with that name already exists' });
    throw e;
  }
  auditLog(req.user.id, 'ROLE_UPDATE', { id: req.params.id });
  const counts = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE role=?').get(req.params.id).n;
  res.json({ role: { ...shapeRole(db.prepare('SELECT * FROM roles WHERE id=?').get(req.params.id)), memberCount: counts } });
});

// Delete a custom role (blocked for system roles and roles still in use)
router.delete('/api/v1/roles/:id', requireAdmin, (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE id=?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.isSystem) return res.status(400).json({ error: 'Built-in roles cannot be deleted' });
  const n = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE role=?').get(req.params.id).n;
  if (n > 0) return res.status(409).json({ error: `${n} employee(s) still use this role — reassign them first` });
  db.prepare('DELETE FROM roles WHERE id=?').run(req.params.id);
  auditLog(req.user.id, 'ROLE_DELETE', { id: req.params.id, name: role.name });
  res.json({ ok: true });
});

export default router;
