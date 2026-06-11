// Obfuscated paths for admin-only pages.
// These are the canonical client-side routes; the human-readable equivalents
// are blocked at the Express layer (server.js) with 403 Forbidden.
export const ADMIN_PATH = {
  administration: '/sys/3a7f',
  auditLog:       '/sys/8b4e',
  migration:      '/sys/5c9d',

  // Settings pages
  settings: {
    // System
    general:     '/settings/general',
    branding:    '/settings/branding',
    localization:'/settings/localization',
    backup:      '/settings/backup',
    // Projects
    projects:    '/settings/projects',
    projectCategories: '/settings/project-categories',
    projectTemplates:  '/settings/project-templates',
    billing:     '/settings/billing',
    // Clients
    clients:     '/settings/clients',
    clientTiers: '/settings/client-tiers',
    sla:         '/settings/sla',
    contracts:   '/settings/contracts',
    // Tasks
    tasks:       '/settings/tasks',
    taskCategories: '/settings/task-categories',
    priorities:  '/settings/priorities',
    workflows:   '/settings/workflows',
    // Timesheets
    timesheetPeriods: '/settings/timesheet-periods',
    approvalWorkflow: '/settings/approval-workflow',
    overtime:    '/settings/overtime',
    holidays:    '/settings/holidays',
    // Finance
    billingRates: '/settings/billing-rates',
    currency:    '/settings/currency',
    invoiceTemplates: '/settings/invoice-templates',
    costCenters: '/settings/cost-centers',
    // Users
    roles:       '/settings/roles',
    teamHierarchy:'/settings/team-hierarchy',
    // Notifications
    emailTemplates:   '/settings/email-templates',
    alertRules:       '/settings/alert-rules',
    notifPrefs:       '/settings/notification-preferences',
    // Integrations
    calendar:    '/settings/calendar',
    apiKeys:     '/settings/api-keys',
    webhooks:    '/settings/webhooks',
  },
};
