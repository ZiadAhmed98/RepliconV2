import { Router } from 'express';
import { z }      from 'zod';
import crypto     from 'crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { auditLog }                  from '../lib/helpers.js';
import db                            from '../lib/db.js';

const router = Router();

const clientSchema = z.object({
  name:             z.string().min(1),
  code:             z.string().max(20).optional(),
  industry:         z.string().optional(),
  contactName:      z.string().optional(),
  contactEmail:     z.string().email().optional().or(z.literal('')),
  contactPhone:     z.string().optional(),
  website:          z.string().optional(),
  managerId:        z.string().nullable().optional(),   // account_managers.id
  accountManagerId: z.string().nullable().optional(),   // legacy — accepted but not used
  status:           z.enum(['active', 'inactive']).default('active'),
  notes:            z.string().optional(),
});

// ── Shared AM join fragment ───────────────────────────────────────────────────
const CLIENT_SELECT = `
  SELECT c.*,
         am.displayName AS accountManagerName,
         am.email       AS amEmail,
         am.phone       AS amPhone,
         am.title       AS amTitle
  FROM clients c
  LEFT JOIN account_managers am ON am.id = c.managerId
`;

router.get('/api/v1/clients', requireAuth, (req, res) => {
  const { status, search } = req.query;
  let query = CLIENT_SELECT + ' WHERE 1=1';
  const params = [];
  if (status) { query += ' AND c.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.contactName LIKE ? OR c.contactEmail LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  query += ' ORDER BY c.name';
  res.json({ clients: db.prepare(query).all(...params) });
});

router.get('/api/v1/clients/:id', requireAuth, (req, res) => {
  const row = db.prepare(CLIENT_SELECT + ' WHERE c.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: row });
});

router.post('/api/v1/clients', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const now = new Date().toISOString();
  const id  = crypto.randomUUID();
  const managerId = d.managerId || null;
  try {
    db.prepare(`
      INSERT INTO clients (id, name, code, industry, contactName, contactEmail, contactPhone, website, managerId, status, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, d.name, d.code || null, d.industry || null, d.contactName || null,
           d.contactEmail || null, d.contactPhone || null, d.website || null,
           managerId, d.status, d.notes || null, now, now);
    auditLog(req.user.id, 'CLIENT_CREATE', { id, name: d.name });
    const row = db.prepare(CLIENT_SELECT + ' WHERE c.id = ?').get(id);
    res.status(201).json({ client: row });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Client code already exists' });
    throw err;
  }
});

router.put('/api/v1/clients/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const now = new Date().toISOString();
  const managerId = d.managerId !== undefined ? d.managerId : null;
  try {
    db.prepare(`
      UPDATE clients SET name=?, code=?, industry=?, contactName=?, contactEmail=?,
        contactPhone=?, website=?, managerId=?, status=?, notes=?, updatedAt=?
      WHERE id=?
    `).run(d.name, d.code || null, d.industry || null, d.contactName || null,
           d.contactEmail || null, d.contactPhone || null, d.website || null,
           managerId, d.status, d.notes || null, now, req.params.id);
    auditLog(req.user.id, 'CLIENT_UPDATE', { id: req.params.id });
    const row = db.prepare(CLIENT_SELECT + ' WHERE c.id = ?').get(req.params.id);
    res.json({ client: row });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Client code already exists' });
    throw err;
  }
});

router.delete('/api/v1/clients/:id', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  db.prepare('UPDATE clients SET status=?, updatedAt=? WHERE id=?').run('inactive', new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'CLIENT_DEACTIVATE', { id: req.params.id });
  res.json({ ok: true });
});

export default router;
