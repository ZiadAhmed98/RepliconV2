import { Router } from 'express';
import { z }      from 'zod';
import crypto      from 'crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { auditLog }                  from '../lib/helpers.js';
import db from '../lib/db.js';

const router = Router();

const CATEGORIES = ['azure','m365','maf_guide','security','networking','cloud','general'];

const templateSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  category:    z.enum(CATEGORIES),
  documentUrl: z.string().url().nullable().optional(),
});

// ── Get all approved templates (public), or include pending if admin ─────────
router.get('/api/v1/templates', requireAuth, (req, res) => {
  const { category, status } = req.query;
  let q = 'SELECT * FROM templates WHERE 1=1';
  const params = [];

  if (req.user.isAdmin && status) {
    q += ' AND status=?'; params.push(status);
  } else if (req.user.isAdmin) {
    // admins see all
  } else {
    q += " AND status='approved'";
  }

  if (category) { q += ' AND category=?'; params.push(category); }
  q += ' ORDER BY createdAt DESC';
  res.json({ templates: db.prepare(q).all(...params) });
});

// ── My submitted templates ────────────────────────────────────────────────────
router.get('/api/v1/templates/mine', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM templates WHERE submittedBy=? ORDER BY createdAt DESC'
  ).all(req.user.id);
  res.json({ templates: rows });
});

// ── Submit a new template ─────────────────────────────────────────────────────
router.post('/api/v1/templates', requireAuth, (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d   = parsed.data;
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO templates (id,title,description,category,documentUrl,submittedBy,submitterName,status,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(id, d.title, d.description||null, d.category, d.documentUrl||null,
         req.user.id, req.user.name || req.user.displayName, 'pending', now, now);
  auditLog(req.user.id, 'TEMPLATE_SUBMIT', { id, title: d.title });
  res.status(201).json({ template: db.prepare('SELECT * FROM templates WHERE id=?').get(id) });
});

// ── Approve or reject (admin only) ───────────────────────────────────────────
router.patch('/api/v1/templates/:id', requireAdmin, (req, res) => {
  const { action, rejectionNote } = req.body || {};
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });
  const row = db.prepare('SELECT id FROM templates WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  const now = new Date().toISOString();
  db.prepare(`UPDATE templates SET status=?,reviewedBy=?,reviewedAt=?,rejectionNote=?,updatedAt=? WHERE id=?`)
    .run(action === 'approve' ? 'approved' : 'rejected', req.user.id, now, rejectionNote||null, now, req.params.id);
  auditLog(req.user.id, action === 'approve' ? 'TEMPLATE_APPROVE' : 'TEMPLATE_REJECT', { id: req.params.id });
  res.json({ template: db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id) });
});

// ── Delete template (admin or own pending) ────────────────────────────────────
router.delete('/api/v1/templates/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  if (!req.user.isAdmin && (row.submittedBy !== req.user.id || row.status !== 'pending')) {
    return res.status(403).json({ error: 'Cannot delete this template' });
  }
  db.prepare('DELETE FROM templates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
