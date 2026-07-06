import { Router } from 'express';
import crypto      from 'crypto';
import path        from 'path';
import fs          from 'fs';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import db              from '../lib/db.js';
import { DATA_DIR }    from '../lib/helpers.js';

const router = Router();
const now = () => new Date().toISOString();

// ── Key-value app settings ────────────────────────────────────────────────────

router.get('/api/v1/admin/settings', requireAdmin, (req, res) => {
  const { group } = req.query;
  const rows = group
    ? db.prepare("SELECT key, value FROM app_settings WHERE key LIKE ?").all(`${group}.%`)
    : db.prepare("SELECT key, value FROM app_settings").all();
  const settings = {};
  rows.forEach(r => {
    const k = group ? r.key.slice(group.length + 1) : r.key;
    try { settings[k] = JSON.parse(r.value); } catch { settings[k] = r.value; }
  });
  res.json({ settings });
});

// Public (any authenticated user) read of display-affecting settings only.
// Branding + localization + a small general subset drive the app shell for
// every user, so they must be readable without the admin grant. Nothing
// sensitive (api keys, webhooks, workflow internals) is exposed here.
const PUBLIC_GROUPS = ['branding', 'localization'];
const PUBLIC_GENERAL_KEYS = ['appName', 'dateFormat', 'timezone'];
router.get('/api/v1/settings/public', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const out = { branding: {}, localization: {}, general: {} };
  rows.forEach(r => {
    const dot = r.key.indexOf('.');
    if (dot < 0) return;
    const group = r.key.slice(0, dot);
    const k     = r.key.slice(dot + 1);
    let val; try { val = JSON.parse(r.value); } catch { val = r.value; }
    if (PUBLIC_GROUPS.includes(group)) out[group][k] = val;
    else if (group === 'general' && PUBLIC_GENERAL_KEYS.includes(k)) out.general[k] = val;
  });
  res.json({ settings: out });
});

// Full operational configuration for any authenticated user. app_settings
// holds only non-sensitive operational config (defaults, rules, thresholds) —
// secrets live in their own tables (api_keys, webhooks) behind requireAdmin.
// This is the backbone that makes settings dynamic: every page reads the group
// it cares about and adapts its behaviour accordingly.
router.get('/api/v1/settings/operational', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const groups = {};
  rows.forEach(r => {
    const dot   = r.key.indexOf('.');
    const group = dot < 0 ? '_root' : r.key.slice(0, dot);
    const k     = dot < 0 ? r.key   : r.key.slice(dot + 1);
    let val; try { val = JSON.parse(r.value); } catch { val = r.value; }
    (groups[group] ||= {})[k] = val;
  });
  res.json({ settings: groups });
});

router.put('/api/v1/admin/settings', requireAdmin, (req, res) => {
  const { group, updates } = req.body || {};
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'updates object required' });
  const stmt = db.prepare('INSERT INTO app_settings (key,value,updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt');
  const ts = now();
  db.transaction(() => {
    Object.entries(updates).forEach(([k, v]) => {
      const key = group ? `${group}.${k}` : k;
      stmt.run(key, JSON.stringify(v), ts);
    });
  })();
  res.json({ ok: true });
});

// ── Generic CRUD factory ──────────────────────────────────────────────────────
function crudRoutes(table, singular, extraFields = []) {
  const base = `/api/v1/admin/${table.replace(/_/g, '-')}`;

  router.get(base, requireAdmin, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY createdAt DESC`).all();
    res.json({ [table]: rows });
  });

  router.post(base, requireAdmin, (req, res) => {
    const body = req.body || {};
    const id = crypto.randomUUID();
    const ts = now();
    const fields = ['id', ...extraFields, 'createdAt'];
    const values = [id, ...extraFields.map(f => body[f] ?? null), ts];
    db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...values);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    res.status(201).json({ [singular]: row });
  });

  router.put(`${base}/:id`, requireAdmin, (req, res) => {
    const body = req.body || {};
    if (!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const sets = extraFields.filter(f => body[f] !== undefined).map(f => `${f}=?`);
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    const vals = [...extraFields.filter(f => body[f] !== undefined).map(f => body[f]), req.params.id];
    db.prepare(`UPDATE ${table} SET ${sets.join(',')} WHERE id=?`).run(...vals);
    res.json({ [singular]: db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id) });
  });

  router.delete(`${base}/:id`, requireAdmin, (req, res) => {
    if (!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(req.params.id)) return res.status(404).json({ error: 'Not found' });
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ ok: true });
  });
}

crudRoutes('project_categories', 'category',     ['name', 'color']);
crudRoutes('task_categories',    'category',     ['name', 'color']);
crudRoutes('priority_levels',    'priority',     ['name', 'level', 'color']);
crudRoutes('client_tiers',       'tier',         ['name', 'level', 'color', 'description']);
crudRoutes('billing_rates',      'rate',         ['role', 'rate', 'currency', 'effectiveDate']);
crudRoutes('cost_centers',       'costCenter',   ['name', 'code', 'description']);
crudRoutes('holidays',           'holiday',      ['name', 'date', 'recurring']);
crudRoutes('sla_tiers',          'tier',         ['name', 'priority', 'responseHours', 'resolutionHours', 'color']);
crudRoutes('workflow_rules',     'rule',         ['name', 'entity', 'fromStatus', 'toStatus', 'condition', 'action', 'active']);
crudRoutes('alert_rules',        'rule',         ['name', 'trigger', 'threshold', 'channels', 'active']);
crudRoutes('departments',        'department',   ['name', 'code', 'description']);
crudRoutes('locations',          'location',     ['name', 'code', 'description']);
crudRoutes('employee_types',     'employeeType', ['name', 'code', 'description']);

// ── Email templates ───────────────────────────────────────────────────────────
router.get('/api/v1/admin/email-templates', requireAdmin, (req, res) => {
  res.json({ templates: db.prepare('SELECT * FROM email_templates ORDER BY name').all() });
});

router.post('/api/v1/admin/email-templates', requireAdmin, (req, res) => {
  const { type, name, subject, body } = req.body || {};
  if (!type || !name) return res.status(400).json({ error: 'type and name required' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO email_templates (id,type,name,subject,body,createdAt) VALUES (?,?,?,?,?,?)').run(id, type, name, subject || '', body || '', now());
  res.status(201).json({ template: db.prepare('SELECT * FROM email_templates WHERE id=?').get(id) });
});

router.put('/api/v1/admin/email-templates/:id', requireAdmin, (req, res) => {
  const { type, name, subject, body } = req.body || {};
  if (!db.prepare('SELECT id FROM email_templates WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE email_templates SET type=?,name=?,subject=?,body=? WHERE id=?').run(type, name, subject, body, req.params.id);
  res.json({ template: db.prepare('SELECT * FROM email_templates WHERE id=?').get(req.params.id) });
});

router.delete('/api/v1/admin/email-templates/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM email_templates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Project templates ─────────────────────────────────────────────────────────
router.get('/api/v1/admin/project-templates', requireAdmin, (req, res) => {
  const templates = db.prepare('SELECT * FROM project_templates ORDER BY name').all();
  templates.forEach(t => {
    t.tasks = db.prepare('SELECT * FROM project_template_tasks WHERE templateId=? ORDER BY sortOrder').all(t.id);
  });
  res.json({ templates });
});

router.post('/api/v1/admin/project-templates', requireAdmin, (req, res) => {
  const { name, description, billingType, estimatedHours, tasks = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO project_templates (id,name,description,billingType,estimatedHours,createdAt) VALUES (?,?,?,?,?,?)').run(id, name, description || null, billingType || 'time_material', estimatedHours || 0, now());
  const taskStmt = db.prepare('INSERT INTO project_template_tasks (id,templateId,name,estimatedHours,sortOrder) VALUES (?,?,?,?,?)');
  db.transaction(() => tasks.forEach((t, i) => taskStmt.run(crypto.randomUUID(), id, t.name, t.estimatedHours || 0, i)))();
  const tmpl = db.prepare('SELECT * FROM project_templates WHERE id=?').get(id);
  tmpl.tasks = db.prepare('SELECT * FROM project_template_tasks WHERE templateId=? ORDER BY sortOrder').all(id);
  res.status(201).json({ template: tmpl });
});

router.put('/api/v1/admin/project-templates/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM project_templates WHERE id=?').get(id)) return res.status(404).json({ error: 'Not found' });
  const { name, description, billingType, estimatedHours, tasks } = req.body || {};
  db.prepare('UPDATE project_templates SET name=?,description=?,billingType=?,estimatedHours=? WHERE id=?').run(name, description || null, billingType, estimatedHours || 0, id);
  if (Array.isArray(tasks)) {
    db.prepare('DELETE FROM project_template_tasks WHERE templateId=?').run(id);
    const stmt = db.prepare('INSERT INTO project_template_tasks (id,templateId,name,estimatedHours,sortOrder) VALUES (?,?,?,?,?)');
    db.transaction(() => tasks.forEach((t, i) => stmt.run(crypto.randomUUID(), id, t.name, t.estimatedHours || 0, i)))();
  }
  const tmpl = db.prepare('SELECT * FROM project_templates WHERE id=?').get(id);
  tmpl.tasks = db.prepare('SELECT * FROM project_template_tasks WHERE templateId=? ORDER BY sortOrder').all(id);
  res.json({ template: tmpl });
});

router.delete('/api/v1/admin/project-templates/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM project_templates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API Keys ──────────────────────────────────────────────────────────────────
router.get('/api/v1/admin/api-keys', requireAdmin, (req, res) => {
  res.json({ keys: db.prepare('SELECT id, name, keyPreview, createdAt, lastUsed FROM api_keys ORDER BY createdAt DESC').all() });
});

router.post('/api/v1/admin/api-keys', requireAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const raw  = crypto.randomBytes(32).toString('base64url');
  const full = `mds_${raw}`;
  const hash = crypto.createHash('sha256').update(full).digest('hex');
  const preview = `mds_${raw.slice(0, 8)}…`;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO api_keys (id,name,keyPreview,keyHash,createdAt) VALUES (?,?,?,?,?)').run(id, name, preview, hash, now());
  res.status(201).json({ key: { id, name, keyPreview: preview, createdAt: now() }, fullKey: full });
});

router.delete('/api/v1/admin/api-keys/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
router.get('/api/v1/admin/webhooks', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM webhooks ORDER BY createdAt DESC').all();
  res.json({ webhooks: rows.map(w => ({ ...w, events: JSON.parse(w.events || '[]') })) });
});

router.post('/api/v1/admin/webhooks', requireAdmin, (req, res) => {
  const { name, url, events = [] } = req.body || {};
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  const id     = crypto.randomUUID();
  const secret = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO webhooks (id,name,url,events,active,secret,createdAt) VALUES (?,?,?,?,1,?,?)').run(id, name, url, JSON.stringify(events), secret, now());
  const row = db.prepare('SELECT * FROM webhooks WHERE id=?').get(id);
  res.status(201).json({ webhook: { ...row, events: JSON.parse(row.events) } });
});

router.put('/api/v1/admin/webhooks/:id', requireAdmin, (req, res) => {
  const { name, url, events, active } = req.body || {};
  if (!db.prepare('SELECT id FROM webhooks WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE webhooks SET name=?,url=?,events=?,active=? WHERE id=?').run(name, url, JSON.stringify(events || []), active ? 1 : 0, req.params.id);
  const row = db.prepare('SELECT * FROM webhooks WHERE id=?').get(req.params.id);
  res.json({ webhook: { ...row, events: JSON.parse(row.events) } });
});

router.delete('/api/v1/admin/webhooks/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM webhooks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Team hierarchy (read from employees) ──────────────────────────────────────
router.get('/api/v1/admin/team-hierarchy', requireAdmin, (req, res) => {
  const emps = db.prepare('SELECT id, displayName, firstName, lastName, jobTitle, department, role, supervisorId, status FROM employees WHERE status=\'active\' ORDER BY displayName').all();
  const map  = {};
  emps.forEach(e => { map[e.id] = { ...e, displayName: e.displayName || `${e.firstName} ${e.lastName}`, children: [] }; });
  const roots = [];
  emps.forEach(e => {
    if (e.supervisorId && map[e.supervisorId]) map[e.supervisorId].children.push(map[e.id]);
    else roots.push(map[e.id]);
  });
  res.json({ hierarchy: roots });
});

// ── Backup ────────────────────────────────────────────────────────────────────
router.get('/api/v1/admin/backup', requireAdmin, (req, res) => {
  const dbPath = path.join(DATA_DIR, 'mds.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database file not found' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Disposition', `attachment; filename="mds-backup-${stamp}.db"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(dbPath);
});

// ── Contract/Invoice template stubs (stored in app_settings) ─────────────────
router.get('/api/v1/admin/contract-templates', requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'contract_template.%'").all();
  const templates = rows.map(r => { try { return JSON.parse(r.value); } catch { return null; } }).filter(Boolean);
  res.json({ templates });
});

router.post('/api/v1/admin/contract-templates', requireAdmin, (req, res) => {
  const { name, type, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id  = crypto.randomUUID();
  const obj = { id, name, type: type || 'sow', description: description || '', createdAt: now() };
  db.prepare('INSERT INTO app_settings (key,value,updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt').run(`contract_template.${id}`, JSON.stringify(obj), now());
  res.status(201).json({ template: obj });
});

router.delete('/api/v1/admin/contract-templates/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM app_settings WHERE key=?").run(`contract_template.${req.params.id}`);
  res.json({ ok: true });
});

router.get('/api/v1/admin/invoice-templates', requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'invoice_template.%'").all();
  const templates = rows.map(r => { try { return JSON.parse(r.value); } catch { return null; } }).filter(Boolean);
  res.json({ templates });
});

router.post('/api/v1/admin/invoice-templates', requireAdmin, (req, res) => {
  const { name, layout, logoUrl } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id  = crypto.randomUUID();
  const obj = { id, name, layout: layout || 'standard', logoUrl: logoUrl || '', createdAt: now() };
  db.prepare('INSERT INTO app_settings (key,value,updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt').run(`invoice_template.${id}`, JSON.stringify(obj), now());
  res.status(201).json({ template: obj });
});

router.delete('/api/v1/admin/invoice-templates/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM app_settings WHERE key=?").run(`invoice_template.${req.params.id}`);
  res.json({ ok: true });
});

export default router;
