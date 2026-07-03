// Single source of truth for permission-controllable pages.
//
// Add a page here (key + label) and it automatically appears in BOTH the
// Roles & Permissions page and the employee "System Access" modal, and can be
// route-guarded via <GuardedRoute page="<key>">.
//
// Access is DENY BY DEFAULT: a non-admin can reach a page only if its
// permission is explicitly `true`. Admins bypass all page checks.
//
// Not listed here on purpose:
//   - home / profile      → always accessible to any signed-in user
//   - myTimesheet         → always accessible (everyone owns their timesheet)
//   - administration      → gated by the hard isAdmin flag, not a page permission
export const APP_PAGES = [
  { key: 'dashboard',         label: 'Dashboard' },
  { key: 'employees',         label: 'Employees' },
  { key: 'projects',          label: 'Projects' },
  { key: 'clients',           label: 'Clients' },
  { key: 'programs',          label: 'Programs' },
  { key: 'accountManagers',   label: 'Account Managers' },
  { key: 'templates',         label: 'Templates' },
  { key: 'timesheets',        label: 'Timesheets (Replicon)' },
  { key: 'timesheetApproval', label: 'Timesheet Approvals' },
  { key: 'aiInsights',        label: 'AI Insights' },
];

export const APP_PAGE_KEYS = APP_PAGES.map(p => p.key);
