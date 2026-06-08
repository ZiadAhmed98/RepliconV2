import { Router } from 'express';
import crypto     from 'crypto';
import { requireAuth, requireAdmin, requirePM } from '../lib/auth.js';
import { auditLog }                         from '../lib/helpers.js';
import db, { buildTimesheetRows,
             buildSingleRow }               from '../lib/db.js';

const router = Router();

// ── Admin/PM: list timesheets ─────────────────────────────────────────────────
// Admins see all; PMs see only timesheets that contain rows from their projects
router.get('/api/v1/admin/psa/timesheets', requirePM, (req, res) => {
  const { status, userId } = req.query;
  // userId is optional but must be a non-empty string of safe characters if provided
  if (userId && !/^[\w-]{1,128}$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });
  let q = `
    SELECT ts.*,
           COALESCE(e.displayName, e.firstName || ' ' || e.lastName, ts.userId) AS employeeName
    FROM psa_timesheets ts
    LEFT JOIN employees e ON e.userId = ts.userId
    WHERE 1=1
  `;
  const params = [];
  if (status && status !== 'all') { q += ' AND ts.status = ?'; params.push(status); }
  if (userId)                     { q += ' AND ts.userId = ?'; params.push(userId); }

  // PMs: restrict to timesheets that have at least one row in a project they manage
  if (!req.user.isAdmin && req.user.role === 'pm') {
    const pmEmp = db.prepare('SELECT id FROM employees WHERE userId=?').get(req.user.id);
    if (pmEmp) {
      q += `
        AND EXISTS (
          SELECT 1 FROM psa_timesheet_rows r
          JOIN projects p ON p.id = r.projectId
          WHERE r.timesheetId = ts.id
            AND (p.projectManagerId = ?
              OR EXISTS (SELECT 1 FROM project_resources pr WHERE pr.projectId = p.id AND pr.employeeId = ?))
        )`;
      params.push(pmEmp.id, pmEmp.id);
    } else {
      return res.json({ timesheets: [] });
    }
  }

  q += ' ORDER BY ts.weekStart DESC, employeeName ASC';
  const rows = db.prepare(q).all(...params);
  const timesheets = rows.map(ts => {
    const rows2 = buildTimesheetRows(ts.id);
    const totalHours = rows2.reduce((sum, r) => sum + Object.values(r.hours || {}).reduce((s, h) => s + h, 0), 0);
    return { ...ts, rows: rows2, totalHours: Math.round(totalHours * 4) / 4 };
  });
  res.json({ timesheets });
});

// ── Admin/PM: approve a timesheet ────────────────────────────────────────────
router.post('/api/v1/admin/psa/timesheets/:id/approve', requirePM, (req, res) => {
  const ts = db.prepare('SELECT * FROM psa_timesheets WHERE id=?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: 'Timesheet not found' });
  if (ts.status === 'approved') return res.status(409).json({ error: 'Already approved' });
  db.prepare('UPDATE psa_timesheets SET status=?,rejectedReason=NULL,updatedAt=? WHERE id=?')
    .run('approved', new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'TIMESHEET_APPROVED', { timesheetId: req.params.id, userId: ts.userId, weekStart: ts.weekStart });
  res.json({ ok: true, status: 'approved' });
});

// ── Admin/PM: reject a timesheet ─────────────────────────────────────────────
router.post('/api/v1/admin/psa/timesheets/:id/reject', requirePM, (req, res) => {
  const ts = db.prepare('SELECT * FROM psa_timesheets WHERE id=?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: 'Timesheet not found' });
  const { reason } = req.body || {};
  db.prepare('UPDATE psa_timesheets SET status=?,rejectedReason=?,updatedAt=? WHERE id=?')
    .run('rejected', reason || null, new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'TIMESHEET_REJECTED', { timesheetId: req.params.id, userId: ts.userId, weekStart: ts.weekStart, reason });
  res.json({ ok: true, status: 'rejected' });
});

router.get('/api/v1/psa/timesheets', requireAuth, (req, res) => {
  const { weekStart } = req.query;
  if (!weekStart) return res.status(400).json({ error: 'weekStart required' });
  const d = new Date(weekStart + 'T12:00:00Z');
  if (isNaN(d)) return res.status(400).json({ error: 'Invalid weekStart' });
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  const ws  = d.toISOString().slice(0, 10);
  const uid = req.user.id;
  const now = new Date().toISOString();
  let ts = db.prepare('SELECT * FROM psa_timesheets WHERE userId=? AND weekStart=?').get(uid, ws);
  if (!ts) {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO psa_timesheets (id,userId,weekStart,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(id, uid, ws, 'not_submitted', now, now);
    ts = db.prepare('SELECT * FROM psa_timesheets WHERE id=?').get(id);
  }
  res.json({ timesheet: { ...ts, rows: buildTimesheetRows(ts.id) } });
});

router.post('/api/v1/psa/timesheet-rows', requireAuth, (req, res) => {
  const { timesheetId, note, projectId, taskId } = req.body || {};
  if (!timesheetId) return res.status(400).json({ error: 'timesheetId required' });
  const ts = db.prepare('SELECT * FROM psa_timesheets WHERE id=? AND userId=?').get(timesheetId, req.user.id);
  if (!ts) return res.status(404).json({ error: 'Timesheet not found' });
  if (ts.status === 'submitted' || ts.status === 'approved') return res.status(409).json({ error: 'Cannot modify a submitted timesheet' });
  const maxOrd = db.prepare('SELECT MAX(sortOrder) AS m FROM psa_timesheet_rows WHERE timesheetId=?').get(timesheetId);
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO psa_timesheet_rows (id,timesheetId,projectId,taskId,note,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, timesheetId, projectId || null, taskId || null, note || null, (maxOrd?.m ?? -1) + 1, now, now);
  res.status(201).json({ row: buildSingleRow(id) });
});

router.put('/api/v1/psa/timesheet-rows/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT r.*, ts.userId, ts.status FROM psa_timesheet_rows r JOIN psa_timesheets ts ON ts.id=r.timesheetId WHERE r.id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Row not found' });
  if (row.userId !== req.user.id) return res.status(403).json({ error: 'Not your timesheet' });
  if (row.status === 'submitted' || row.status === 'approved') return res.status(409).json({ error: 'Timesheet already submitted' });
  const { projectId, taskId, note } = req.body || {};
  db.prepare('UPDATE psa_timesheet_rows SET projectId=?,taskId=?,note=?,updatedAt=? WHERE id=?')
    .run(projectId || null, taskId || null, note || null, new Date().toISOString(), req.params.id);
  res.json({ row: buildSingleRow(req.params.id) });
});

router.put('/api/v1/psa/timesheet-rows/:id/hours', requireAuth, (req, res) => {
  const row = db.prepare('SELECT r.*, ts.userId, ts.status, ts.id AS tsId FROM psa_timesheet_rows r JOIN psa_timesheets ts ON ts.id=r.timesheetId WHERE r.id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Row not found' });
  if (row.userId !== req.user.id) return res.status(403).json({ error: 'Not your timesheet' });
  if (row.status === 'submitted' || row.status === 'approved') return res.status(409).json({ error: 'Timesheet already submitted' });
  const { hours } = req.body || {};
  if (!hours || typeof hours !== 'object') return res.status(400).json({ error: 'hours object required' });
  const upsert = db.prepare('INSERT INTO psa_timesheet_hours (rowId,date,hours,note) VALUES (?,?,?,NULL) ON CONFLICT(rowId,date) DO UPDATE SET hours=excluded.hours');
  const del    = db.prepare('DELETE FROM psa_timesheet_hours WHERE rowId=? AND date=?');
  db.transaction(() => {
    Object.entries(hours).forEach(([date, h]) => {
      const n = parseFloat(h);
      if (!isNaN(n) && n > 0) upsert.run(req.params.id, date, n);
      else del.run(req.params.id, date);
    });
  })();
  db.prepare('UPDATE psa_timesheets SET updatedAt=? WHERE id=?').run(new Date().toISOString(), row.tsId);
  const saved = db.prepare('SELECT date, hours, note FROM psa_timesheet_hours WHERE rowId=?').all(req.params.id);
  res.json({
    hours:    Object.fromEntries(saved.map(h => [h.date, h.hours])),
    dayNotes: Object.fromEntries(saved.filter(h => h.note).map(h => [h.date, h.note])),
  });
});

router.put('/api/v1/psa/timesheet-rows/:id/day-notes', requireAuth, (req, res) => {
  const row = db.prepare('SELECT r.*, ts.userId, ts.status FROM psa_timesheet_rows r JOIN psa_timesheets ts ON ts.id=r.timesheetId WHERE r.id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Row not found' });
  if (row.userId !== req.user.id) return res.status(403).json({ error: 'Not your timesheet' });
  if (row.status === 'submitted' || row.status === 'approved') return res.status(409).json({ error: 'Timesheet already submitted' });
  const { date, note } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date required' });
  db.prepare('UPDATE psa_timesheet_hours SET note=? WHERE rowId=? AND date=?').run(note || null, req.params.id, date);
  res.json({ ok: true });
});

router.delete('/api/v1/psa/timesheet-rows/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT r.*, ts.userId, ts.status FROM psa_timesheet_rows r JOIN psa_timesheets ts ON ts.id=r.timesheetId WHERE r.id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Row not found' });
  if (row.userId !== req.user.id) return res.status(403).json({ error: 'Not your timesheet' });
  if (row.status === 'submitted' || row.status === 'approved') return res.status(409).json({ error: 'Timesheet already submitted' });
  db.prepare('DELETE FROM psa_timesheet_rows WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/api/v1/psa/timesheets/:id/submit', requireAuth, (req, res) => {
  const ts = db.prepare('SELECT * FROM psa_timesheets WHERE id=? AND userId=?').get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: 'Timesheet not found' });
  if (ts.status === 'approved') return res.status(409).json({ error: 'Already approved' });
  db.prepare('UPDATE psa_timesheets SET status=?,updatedAt=? WHERE id=?').run('submitted', new Date().toISOString(), req.params.id);
  auditLog(req.user.id, 'TIMESHEET_SUBMIT', { timesheetId: req.params.id, weekStart: ts.weekStart });
  res.json({ ok: true, status: 'submitted' });
});

// Copy rows from previous week into current timesheet (no hours copied, just project/task structure)
router.post('/api/v1/psa/timesheets/:id/copy-last-week', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM psa_timesheets WHERE id=? AND userId=?').get(req.params.id, req.user.id);
  if (!current) return res.status(404).json({ error: 'Timesheet not found' });
  if (current.status === 'submitted' || current.status === 'approved') {
    return res.status(409).json({ error: 'Cannot modify a submitted or approved timesheet' });
  }

  const d = new Date(current.weekStart + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  const prevWeekStart = d.toISOString().slice(0, 10);

  const prev = db.prepare('SELECT * FROM psa_timesheets WHERE userId=? AND weekStart=?').get(req.user.id, prevWeekStart);
  if (!prev) return res.status(404).json({ error: 'No timesheet found for the previous week' });

  const prevRows = db.prepare('SELECT * FROM psa_timesheet_rows WHERE timesheetId=? ORDER BY sortOrder ASC').all(prev.id);
  if (!prevRows.length) return res.status(404).json({ error: 'Previous week has no rows to copy' });

  // Only copy rows whose projects aren't already in the current timesheet
  const existingProjectIds = new Set(
    db.prepare('SELECT projectId FROM psa_timesheet_rows WHERE timesheetId=?').all(current.id).map(r => r.projectId)
  );

  const now = new Date().toISOString();
  const newRows = [];
  db.transaction(() => {
    for (const row of prevRows) {
      if (row.projectId && existingProjectIds.has(row.projectId)) continue;
      const newId = crypto.randomUUID();
      db.prepare(`INSERT INTO psa_timesheet_rows (id,timesheetId,projectId,taskId,note,sortOrder,createdAt,updatedAt)
                  VALUES (?,?,?,?,?,?,?,?)`)
        .run(newId, current.id, row.projectId, row.taskId, row.note, row.sortOrder, now, now);
      const built = buildSingleRow(newId);
      if (built) newRows.push({ ...built, hours: {}, dayNotes: {} });
    }
  })();

  res.json({ ok: true, rows: newRows, copied: newRows.length });
});

export default router;
