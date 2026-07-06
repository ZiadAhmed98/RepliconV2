// Single source of truth for permission-controllable pages.
//
// Add a page here (key + label) and it automatically appears in BOTH the
// Roles & Permissions page and the employee "System Access" modal, and can be
// route-guarded via <GuardedRoute page="<key>">.
//
// Access is DENY BY DEFAULT: a non-admin can reach a page only if its
// permission is explicitly `true`. Admins bypass all page checks.
//
// Grouping (`group`) is cosmetic — it only clusters the toggles in the admin
// UIs so the many project-related surfaces read clearly.
//
// Not listed here on purpose:
//   - home / profile      → always accessible to any signed-in user
//   - myTimesheet         → always accessible (everyone owns their timesheet)
//   - myProjects          → always accessible (read-only view of own projects)
//   - administration      → gated by the hard isAdmin flag, not a page permission
export const APP_PAGES = [
  // ── Analytics (read-only insight pages) ──────────────────────────────────
  { key: 'dashboard',         label: 'Dashboard',            group: 'Analytics' },
  { key: 'employees',         label: 'Employee Analytics',   group: 'Analytics' },
  { key: 'projectsAnalytics', label: 'Project Analytics',    group: 'Analytics' },
  { key: 'aiInsights',        label: 'AI Insights',          group: 'Analytics' },
  { key: 'chatbot',           label: 'AI Chatbot',           group: 'Analytics' },
  // ── Management (PSA — create/edit real records) ──────────────────────────
  { key: 'projects',          label: 'Projects (Manage)',    group: 'Management' },
  { key: 'clients',           label: 'Clients',              group: 'Management' },
  { key: 'programs',          label: 'Programs',             group: 'Management' },
  { key: 'accountManagers',   label: 'Account Managers',     group: 'Management' },
  { key: 'templates',         label: 'Templates',            group: 'Management' },
  { key: 'timesheetApproval', label: 'Timesheet Approvals',  group: 'Management' },
  // ── Replicon (push to the live Replicon tenant) ──────────────────────────
  { key: 'addProject',        label: 'Add Project',          group: 'Replicon' },
  { key: 'editProjects',      label: 'Edit Projects',        group: 'Replicon' },
  { key: 'timesheets',        label: 'Timesheets',           group: 'Replicon' },
];

export const APP_PAGE_KEYS = APP_PAGES.map(p => p.key);

// Ordered, de-duplicated group labels for rendering the toggles in sections.
export const APP_PAGE_GROUPS = APP_PAGES.reduce((acc, p) => {
  const g = p.group || 'Other';
  if (!acc.includes(g)) acc.push(g);
  return acc;
}, []);

// Legacy `projects` grant used to cover every project-related surface. These
// child keys fall back to the legacy grant when they were never explicitly set,
// so upgrading the app never silently locks anyone out.
export const PROJECT_CHILD_KEYS = ['projectsAnalytics', 'addProject', 'editProjects'];

// Always-accessible page keys (no permission required for a signed-in user).
export const ALWAYS_ALLOWED = ['home', 'profile', 'myTimesheet', 'myProjects'];

// The canonical access check — shared by the route guard (useCan) and Sidebar
// so both stay perfectly in sync.
export function canAccessPage(permissions = {}, isAdmin = false, page) {
  if (page === 'settings' || page === 'administration') return isAdmin;
  if (!page || ALWAYS_ALLOWED.includes(page)) return true;
  if (isAdmin) return true;
  if (permissions[page] === true) return true;
  // Backward-compat: a legacy single `projects` grant covers the split project
  // pages, unless that child key was explicitly toggled off.
  if (PROJECT_CHILD_KEYS.includes(page) && permissions[page] === undefined && permissions.projects === true) {
    return true;
  }
  return false;
}
