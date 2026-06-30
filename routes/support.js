import { Router }                  from 'express';
import crypto                      from 'crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { appendAudit }             from '../lib/rbac.js';
import { logger }                  from '../lib/helpers.js';
import db                          from '../lib/db.js';

const router = Router();

const CATEGORIES = ['bug', 'question', 'feature', 'access', 'other'];
const SEVERITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];

const clamp = (v, n) => String(v == null ? '' : v).slice(0, n);

// ── User: create a ticket ─────────────────────────────────────────────────────
router.post('/api/v1/support/tickets', requireAuth, (req, res) => {
  const b       = req.body || {};
  const subject = clamp(b.subject, 160).trim();
  const message = clamp(b.message, 4000).trim();
  if (!subject || !message) return res.status(400).json({ error: 'Subject and description are required.' });

  const category = CATEGORIES.includes(b.category) ? b.category : 'other';
  const severity = SEVERITIES.includes(b.severity) ? b.severity : 'normal';
  const now = new Date().toISOString();
  const id  = crypto.randomUUID();

  try {
    db.prepare(`INSERT INTO support_tickets
      (id,userId,userName,category,subject,message,route,severity,status,clientError,userAgent,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, clamp(req.user.name, 100), category, subject, message,
           clamp(b.route, 200), severity, 'open',
           clamp(b.clientError, 2000) || null, clamp(req.headers['user-agent'], 300), now, now);

    appendAudit({ user: req.user.name, action: 'SUPPORT_TICKET_CREATE', target: id, category, severity });
    logger.info({ id, user: req.user.id, category, severity }, 'Support ticket created');
    res.json({ success: true, id });
  } catch (e) {
    logger.error({ err: e }, 'Support ticket create failed');
    res.status(500).json({ error: 'Could not submit your request. Please try again.' });
  }
});

// ── User: list my own tickets ─────────────────────────────────────────────────
router.get('/api/v1/support/tickets', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT id,category,subject,message,severity,status,adminNote,createdAt,updatedAt,resolvedAt
     FROM support_tickets WHERE userId=? ORDER BY createdAt DESC LIMIT 100`
  ).all(req.user.id);
  res.json({ tickets: rows });
});

// ── Admin: list all tickets (optionally ?status=) ─────────────────────────────
router.get('/api/v1/admin/support-tickets', requireAdmin, (req, res) => {
  const { status } = req.query;
  const rows = (status && STATUSES.includes(status))
    ? db.prepare('SELECT * FROM support_tickets WHERE status=? ORDER BY createdAt DESC LIMIT 500').all(status)
    : db.prepare('SELECT * FROM support_tickets ORDER BY createdAt DESC LIMIT 500').all();
  res.json({ tickets: rows });
});

// ── Admin: update status / note / severity ────────────────────────────────────
router.put('/api/v1/admin/support-tickets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM support_tickets WHERE id=?').get(id)) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  const b   = req.body || {};
  const now = new Date().toISOString();

  if (b.status && STATUSES.includes(b.status)) {
    const resolving = (b.status === 'resolved' || b.status === 'closed');
    db.prepare('UPDATE support_tickets SET status=?, resolvedBy=?, resolvedAt=?, updatedAt=? WHERE id=?')
      .run(b.status, resolving ? req.user.name : null, resolving ? now : null, now, id);
  }
  if (typeof b.adminNote === 'string') {
    db.prepare('UPDATE support_tickets SET adminNote=?, updatedAt=? WHERE id=?').run(clamp(b.adminNote, 2000), now, id);
  }
  if (b.severity && SEVERITIES.includes(b.severity)) {
    db.prepare('UPDATE support_tickets SET severity=?, updatedAt=? WHERE id=?').run(b.severity, now, id);
  }

  appendAudit({ user: req.user.name, action: 'SUPPORT_TICKET_UPDATE', target: id, changes: Object.keys(b) });
  const row = db.prepare('SELECT * FROM support_tickets WHERE id=?').get(id);
  res.json({ success: true, ticket: row });
});

// ── Admin: delete ─────────────────────────────────────────────────────────────
router.delete('/api/v1/admin/support-tickets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM support_tickets WHERE id=?').run(id);
  appendAudit({ user: req.user.name, action: 'SUPPORT_TICKET_DELETE', target: id });
  res.json({ success: true });
});

export default router;
