import { Router } from 'express';
import { z }      from 'zod';
import crypto     from 'crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { auditLog, pageArgs }        from '../lib/helpers.js';
import db                            from '../lib/db.js';

const router = Router();

// Dynamic client settings (Client Settings page). Opt-in — unset = old behaviour.
function clientSettings() {
  const out = {};
  db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'clients.%'").all().forEach(r => {
    const k = r.key.slice('clients.'.length);
    try { out[k] = JSON.parse(r.value); } catch { out[k] = r.value; }
  });
  return out;
}
function nextClientCode(cs) {
  const prefix = String(cs.codePrefix || 'CLT-').toUpperCase();
  let max = 0;
  db.prepare('SELECT code FROM clients WHERE code LIKE ?').all(`${prefix}%`).forEach(r => {
    const m = r.code && r.code.slice(prefix.length).match(/^(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return prefix + String(max + 1).padStart(4, '0');
}

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
  tierId:           z.string().nullable().optional(),   // client_tiers.id
  slaId:            z.string().nullable().optional(),   // sla_tiers.id
  status:           z.enum(['active', 'inactive']).default('active'),
  notes:            z.string().optional(),
});

// ── Shared AM join fragment ───────────────────────────────────────────────────
const CLIENT_SELECT = `
  SELECT c.*,
         am.displayName AS accountManagerName,
         am.email       AS amEmail,
         am.phone       AS amPhone,
         am.title       AS amTitle,
         ct.name        AS tierName,
         ct.color       AS tierColor,
         st.name        AS slaName,
         st.responseHours   AS slaResponseHours,
         st.resolutionHours AS slaResolutionHours
  FROM clients c
  LEFT JOIN account_managers am ON am.id = c.managerId
  LEFT JOIN client_tiers     ct ON ct.id = c.tierId
  LEFT JOIN sla_tiers        st ON st.id = c.slaId
`;

router.get('/api/v1/clients', requireAuth, (req, res) => {
  const { status, search } = req.query;
  let where = ' WHERE 1=1';
  const params = [];
  if (status) { where += ' AND c.status = ?'; params.push(status); }
  if (search) {
    where += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.contactName LIKE ? OR c.contactEmail LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const { limit, offset, paged } = pageArgs(req);
  const total = paged ? db.prepare('SELECT COUNT(*) AS n FROM clients c' + where).get(...params).n : null;
  let query = CLIENT_SELECT + where + ' ORDER BY c.name';
  if (paged) query += ' LIMIT ? OFFSET ?';
  const rows = db.prepare(query).all(...(paged ? [...params, limit, offset] : params));
  res.json({ clients: rows, total: total ?? rows.length });
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
  const cs  = clientSettings();
  if (cs.requireContact && !(d.contactName || d.contactEmail))
    return res.status(422).json({ error: 'Contact name or email is required by client settings' });
  const now = new Date().toISOString();
  const id  = crypto.randomUUID();
  const managerId = d.managerId || null;
  const code = d.code ? d.code : (cs.autoGenerateCode ? nextClientCode(cs) : null);
  try {
    db.prepare(`
      INSERT INTO clients (id, name, code, industry, contactName, contactEmail, contactPhone, website, managerId, tierId, slaId, status, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, d.name, code, d.industry || null, d.contactName || null,
           d.contactEmail || null, d.contactPhone || null, d.website || null,
           managerId, d.tierId || null, d.slaId || null, d.status, d.notes || null, now, now);
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
        contactPhone=?, website=?, managerId=?, tierId=?, slaId=?, status=?, notes=?, updatedAt=?
      WHERE id=?
    `).run(d.name, d.code || null, d.industry || null, d.contactName || null,
           d.contactEmail || null, d.contactPhone || null, d.website || null,
           managerId, d.tierId || null, d.slaId || null, d.status, d.notes || null, now, req.params.id);
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
