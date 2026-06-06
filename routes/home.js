import { Router }    from 'express';
import { requireAuth } from '../lib/auth.js';
import { loadAuditLog } from '../lib/rbac.js';
import db from '../lib/db.js';

const router = Router();

function thisWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const d = new Date(now);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

router.get('/api/v1/home/summary', requireAuth, (req, res) => {
  const weekStart = thisWeekStart();
  const userId    = req.user.id;

  // Linked employee record
  const emp = db.prepare('SELECT * FROM employees WHERE userId=?').get(userId);

  // ── Current timesheet (this week) ────────────────────────────────────────
  const currentTs = db.prepare(`
    SELECT t.id, t.weekStart, t.status,
           COALESCE(SUM(h.hours),0) AS totalHours
    FROM psa_timesheets t
    LEFT JOIN psa_timesheet_rows r  ON r.timesheetId = t.id
    LEFT JOIN psa_timesheet_hours h ON h.rowId = r.id
    WHERE t.userId=? AND t.weekStart=?
    GROUP BY t.id
  `).get(userId, weekStart) || null;

  // ── Overdue (past weeks, not submitted/approved) ──────────────────────────
  const overdueRows = db.prepare(`
    SELECT id, weekStart, status FROM psa_timesheets
    WHERE userId=? AND weekStart<? AND status NOT IN ('approved','submitted','rejected')
    ORDER BY weekStart DESC LIMIT 6
  `).all(userId, weekStart);

  // ── Submitted + waiting approval ─────────────────────────────────────────
  const pendingRows = db.prepare(`
    SELECT id, weekStart FROM psa_timesheets WHERE userId=? AND status='submitted'
    ORDER BY weekStart DESC
  `).all(userId);

  // ── My projects with hours this week ─────────────────────────────────────
  const myProjects = emp ? db.prepare(`
    SELECT p.id, p.name, p.status, p.billingType, c.name AS clientName,
      COALESCE((
        SELECT SUM(h.hours) FROM psa_timesheet_rows r2
        JOIN psa_timesheets t2 ON t2.id=r2.timesheetId
        JOIN psa_timesheet_hours h ON h.rowId=r2.id
        WHERE r2.projectId=p.id AND t2.userId=? AND t2.weekStart=?
      ),0) AS hoursThisWeek
    FROM project_resources pr
    JOIN projects p  ON p.id=pr.projectId
    LEFT JOIN clients c ON c.id=p.clientId
    WHERE pr.employeeId=? AND p.status NOT IN ('archived','cancelled')
    ORDER BY hoursThisWeek DESC, p.name ASC LIMIT 8
  `).all(userId, weekStart, emp.id) : [];

  // ── Weekly schedule (hours per day) ──────────────────────────────────────
  const dayHours = {};
  if (currentTs) {
    db.prepare(`
      SELECT h.date, SUM(h.hours) AS hrs
      FROM psa_timesheet_hours h
      JOIN psa_timesheet_rows r ON r.id=h.rowId
      WHERE r.timesheetId=? GROUP BY h.date
    `).all(currentTs.id).forEach(r => { dayHours[r.date] = r.hrs; });
  }
  const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const todayStr = new Date().toISOString().split('T')[0];
  const schedule = dayNames.map((name, i) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { date: dateStr, dayName: name, isWeekend: i >= 5, isToday: dateStr === todayStr, hours: dayHours[dateStr] || 0 };
  });

  // ── My pending access requests ────────────────────────────────────────────
  const myAccessRequests = emp ? db.prepare(`
    SELECT r.id, r.status, r.createdAt, p.name AS projectName, p.code AS projectCode
    FROM project_access_requests r
    JOIN projects p ON p.id=r.projectId
    WHERE r.employeeId=? ORDER BY r.createdAt DESC LIMIT 5
  `).all(emp.id) : [];

  // ── My templates ──────────────────────────────────────────────────────────
  const myTemplates = db.prepare(
    'SELECT id,title,category,status,createdAt FROM templates WHERE submittedBy=? ORDER BY createdAt DESC LIMIT 5'
  ).all(userId);

  // ── Recent approved templates (for browse widget) ─────────────────────────
  const recentTemplates = db.prepare(
    "SELECT id,title,category,submitterName,documentUrl,updatedAt FROM templates WHERE status='approved' ORDER BY updatedAt DESC LIMIT 6"
  ).all();

  const result = {
    weekStart, employee: emp,
    timesheet: {
      current: currentTs,
      overdueCount: overdueRows.length,
      overdue: overdueRows,
      pendingCount: pendingRows.length,
      pending: pendingRows,
    },
    projects: myProjects,
    accessRequests: myAccessRequests,
    templates: { mine: myTemplates, recent: recentTemplates },
    schedule,
  };

  // ── Admin / PM / supervisor extras ───────────────────────────────────────
  if (req.user.isAdmin || ['pm','supervisor'].includes(req.user.role)) {
    const timesheetApprovals = db.prepare(`
      SELECT t.id, t.userId, t.weekStart, t.status,
             COALESCE(e.firstName||' '||e.lastName, t.userId) AS employeeName,
             COALESCE(SUM(h.hours),0) AS totalHours
      FROM psa_timesheets t
      LEFT JOIN employees e ON e.userId=t.userId
      LEFT JOIN psa_timesheet_rows r  ON r.timesheetId=t.id
      LEFT JOIN psa_timesheet_hours h ON h.rowId=r.id
      WHERE t.status='submitted'
      GROUP BY t.id ORDER BY t.createdAt ASC LIMIT 10
    `).all();

    const timesheetApprovalCount = db.prepare(
      "SELECT COUNT(*) AS n FROM psa_timesheets WHERE status='submitted'"
    ).get()?.n || 0;

    const projectAccessRequests = db.prepare(`
      SELECT r.id, r.createdAt,
             e.firstName||' '||e.lastName AS employeeName,
             p.name AS projectName, p.id AS projectId
      FROM project_access_requests r
      JOIN employees e ON e.id=r.employeeId
      JOIN projects  p ON p.id=r.projectId
      WHERE r.status='pending' ORDER BY r.createdAt DESC LIMIT 8
    `).all();

    const projectAccessCount = db.prepare(
      "SELECT COUNT(*) AS n FROM project_access_requests WHERE status='pending'"
    ).get()?.n || 0;

    const templateReviews = db.prepare(
      "SELECT id,title,category,submitterName,createdAt FROM templates WHERE status='pending' ORDER BY createdAt ASC LIMIT 6"
    ).all();

    const templateReviewCount = db.prepare(
      "SELECT COUNT(*) AS n FROM templates WHERE status='pending'"
    ).get()?.n || 0;

    const teamNotSubmitted = db.prepare(`
      SELECT e.id, e.firstName, e.lastName, e.displayName, e.employeeId
      FROM employees e
      WHERE e.status='active' AND e.userId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM psa_timesheets t WHERE t.userId=e.userId AND t.weekStart=?)
      ORDER BY e.lastName, e.firstName LIMIT 15
    `).all(weekStart);

    const stats = {
      activeEmployees: db.prepare("SELECT COUNT(*) AS n FROM employees WHERE status='active'").get()?.n || 0,
      activeProjects:  db.prepare("SELECT COUNT(*) AS n FROM projects  WHERE status IN ('in_progress','tentative')").get()?.n || 0,
      activeClients:   db.prepare("SELECT COUNT(*) AS n FROM clients   WHERE status='active'").get()?.n || 0,
      submittedThisWeek: db.prepare(`
        SELECT COUNT(DISTINCT userId) AS n FROM psa_timesheets WHERE weekStart=? AND status IN ('submitted','approved')
      `).get(weekStart)?.n || 0,
    };

    const recentActivity = loadAuditLog().slice(-8).reverse();

    result.admin = {
      timesheetApprovals, timesheetApprovalCount,
      projectAccessRequests, projectAccessCount,
      templateReviews, templateReviewCount,
      teamNotSubmitted, stats, recentActivity,
    };
  }

  res.json(result);
});

export default router;
