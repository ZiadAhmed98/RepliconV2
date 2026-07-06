import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '../context/PermissionContext';
import { canAccessPage } from '../config/pages';

// Builds a fully dynamic, permission-aware notification feed.
//
// End users see what's relevant to THEM (their overdue timesheets, tasks due
// soon). Approvers/admins additionally see the queues they own (timesheet
// approvals, access requests, template reviews, team not submitted) and — only
// if they can actually open those analytics pages — Replicon compliance alerts.
//
// Every notification only appears if the user can reach the page it links to,
// so nobody is nagged about a screen they can't access.
export function useNotifications(dataMatrix) {
  const { permissions, isAdmin } = usePermissions();
  const [home, setHome]           = useState(null);
  const [mineTasks, setMineTasks] = useState([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/v1/home/summary', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => { if (alive) setHome(d); }).catch(() => {});
    fetch('/api/v1/psa/tasks?mine=true', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => { if (alive) setMineTasks(d?.tasks || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return useMemo(() => {
    const can   = (page) => canAccessPage(permissions, isAdmin, page);
    const notes = [];

    // ── Personal: own timesheets ─────────────────────────────────────────────
    const ts = home?.timesheet;
    if (ts) {
      if (ts.overdueCount > 0) {
        notes.push({ id: 'own-overdue', type: 'error', icon: 'bx-calendar-exclamation', title: 'Overdue Timesheets',
          body: `You have ${ts.overdueCount} overdue timesheet${ts.overdueCount > 1 ? 's' : ''}. Submit them to stay compliant.`, time: 'Action needed', to: '/my-timesheet' });
      } else if (!ts.current || (ts.current.totalHours || 0) === 0) {
        notes.push({ id: 'own-current', type: 'warning', icon: 'bx-time-five', title: 'Log This Week',
          body: "You haven't logged any hours for the current week yet.", time: 'This week', to: '/my-timesheet' });
      }
    }

    // ── Personal: task deadlines ─────────────────────────────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const soon  = new Date(today); soon.setDate(soon.getDate() + 3);
    const openMine = mineTasks.filter(t => !['completed', 'closed'].includes(t.status) && t.endDate);
    const overdueTasks = openMine.filter(t => new Date(t.endDate) < today);
    const dueSoon      = openMine.filter(t => { const d = new Date(t.endDate); return d >= today && d <= soon; });
    if (overdueTasks.length) {
      notes.push({ id: 'task-overdue', type: 'error', icon: 'bx-error-circle', title: 'Tasks Past Due',
        body: `${overdueTasks.length} of your task${overdueTasks.length > 1 ? 's are' : ' is'} past the due date.`, time: 'Overdue', to: '/my-projects' });
    }
    if (dueSoon.length) {
      notes.push({ id: 'task-soon', type: 'warning', icon: 'bx-alarm', title: 'Tasks Due Soon',
        body: `${dueSoon.length} of your task${dueSoon.length > 1 ? 's are' : ' is'} due within 3 days.`, time: 'Upcoming', to: '/my-projects' });
    }

    // ── Personal: access request outcomes ────────────────────────────────────
    const approvedAccess = (home?.accessRequests || []).filter(r => r.status === 'approved');
    if (approvedAccess.length) {
      notes.push({ id: 'access-approved', type: 'success', icon: 'bx-check-shield', title: 'Access Granted',
        body: `You've been granted access to ${approvedAccess.length} project${approvedAccess.length > 1 ? 's' : ''}.`, time: 'Recent', to: '/my-projects' });
    }

    // ── Approver / admin queues ──────────────────────────────────────────────
    const admin = home?.admin;
    if (admin) {
      if (admin.timesheetApprovalCount > 0 && can('timesheetApproval')) {
        notes.push({ id: 'appr-ts', type: 'info', icon: 'bx-check-double', title: 'Timesheets to Approve',
          body: `${admin.timesheetApprovalCount} timesheet${admin.timesheetApprovalCount > 1 ? 's are' : ' is'} waiting for your approval.`, time: 'Pending', to: '/timesheets-approval' });
      }
      if (admin.projectAccessCount > 0 && can('projects')) {
        notes.push({ id: 'appr-access', type: 'info', icon: 'bx-key', title: 'Access Requests',
          body: `${admin.projectAccessCount} project access request${admin.projectAccessCount > 1 ? 's' : ''} pending review.`, time: 'Pending', to: '/projects-admin' });
      }
      if (admin.templateReviewCount > 0 && can('templates')) {
        notes.push({ id: 'appr-tmpl', type: 'info', icon: 'bx-file', title: 'Templates to Review',
          body: `${admin.templateReviewCount} template${admin.templateReviewCount > 1 ? 's' : ''} awaiting your review.`, time: 'Pending', to: '/templates' });
      }
      if ((admin.teamNotSubmitted || []).length > 0 && can('timesheetApproval')) {
        const n = admin.teamNotSubmitted.length;
        notes.push({ id: 'team-missing', type: 'warning', icon: 'bx-user-x', title: 'Team Missing Timesheets',
          body: `${n} team member${n > 1 ? "s haven't" : " hasn't"} started this week's timesheet.`, time: 'This week', to: '/timesheets-approval' });
      }
    }

    // ── Replicon compliance (only for users who can open the analytics) ───────
    if (dataMatrix && (can('dashboard') || can('timesheets'))) {
      const c = dataMatrix.compliance || {};
      const to = can('dashboard') ? '/dashboard' : (can('timesheets') ? '/timesheets' : null);
      if ((c.dailyDeficits || 0) > 0) {
        notes.push({ id: 'daily', type: 'warning', icon: 'bx-time-five', title: 'Daily Compliance Alert',
          body: `${c.dailyDeficits} engineer${c.dailyDeficits > 1 ? 's' : ''} haven't logged hours today.`, time: 'Today', to });
      }
      if ((c.weeklyDeficits || 0) > 0) {
        notes.push({ id: 'weekly', type: 'warning', icon: 'bx-calendar-x', title: 'Weekly Compliance Alert',
          body: `${c.weeklyDeficits} engineer${c.weeklyDeficits > 1 ? 's' : ''} logged zero hours last week.`, time: 'This week', to });
      }
    }

    return notes;
  }, [home, mineTasks, dataMatrix, permissions, isAdmin]);
}
