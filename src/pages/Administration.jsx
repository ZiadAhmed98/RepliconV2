import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { ADMIN_PATH } from '../config/adminRoutes';

// ── Section definitions ────────────────────────────────────────────────────
// live: true  → button is active and navigates to `to`
// live: false → placeholder, coming soon
const SECTIONS = [
  {
    id: 'projects',
    title: 'Projects',
    icon: 'bx-folder-open',
    accent: '#818cf8',
    items: [
      { label: 'Project Settings',    icon: 'bx-slider-alt',      desc: 'Default project behaviours & rules',      live: true, to: '/settings/projects' },
      { label: 'Billing Settings',    icon: 'bx-dollar-circle',   desc: 'Configure billing models and rate cards',  live: true, to: '/settings/billing' },
      { label: 'Project Templates',   icon: 'bx-copy',            desc: 'Reusable project structures & task sets',  live: true, to: '/settings/project-templates' },
      { label: 'Project Categories',  icon: 'bx-purchase-tag',    desc: 'Classify projects by type or department',  live: true, to: '/settings/project-categories' },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    icon: 'bx-briefcase',
    accent: '#34d399',
    items: [
      { label: 'Client Settings',     icon: 'bx-cog',             desc: 'Default client onboarding configuration',  live: true, to: '/settings/clients' },
      { label: 'SLA Configuration',   icon: 'bx-time-five',       desc: 'Define service level agreement terms',     live: true, to: '/settings/sla' },
      { label: 'Contract Templates',  icon: 'bx-file',            desc: 'Standardised contract and SOW formats',    live: true, to: '/settings/contracts' },
      { label: 'Client Tiers',        icon: 'bx-medal',           desc: 'Tier-based segmentation and priorities',   live: true, to: '/settings/client-tiers' },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    icon: 'bx-task',
    accent: '#fbbf24',
    items: [
      { label: 'Task Settings',       icon: 'bx-slider-alt',      desc: 'Default task behaviours and constraints',  live: true, to: '/settings/tasks' },
      { label: 'Task Categories',     icon: 'bx-purchase-tag',    desc: 'Classify tasks by discipline or phase',    live: true, to: '/settings/task-categories' },
      { label: 'Priority Levels',     icon: 'bx-sort-alt-2',      desc: 'Define and order task priority tiers',     live: true, to: '/settings/priorities' },
      { label: 'Workflow Rules',      icon: 'bx-git-branch',      desc: 'Automated status-transition triggers',     live: true, to: '/settings/workflows' },
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    icon: 'bx-time-five',
    accent: '#60a5fa',
    items: [
      { label: 'Timesheet Periods',   icon: 'bx-calendar',        desc: 'Fiscal weeks, cut-offs and lock rules',    live: true, to: '/settings/timesheet-periods' },
      { label: 'Approval Workflow',   icon: 'bx-check-shield',    desc: 'Multi-step approval chains and escalation', live: true, to: '/settings/approval-workflow' },
      { label: 'Overtime Rules',      icon: 'bx-timer',           desc: 'Thresholds, caps and OT pay settings',     live: true, to: '/settings/overtime' },
      { label: 'Holiday Calendar',    icon: 'bx-calendar-star',   desc: 'Public and company-wide holidays',         live: true, to: '/settings/holidays' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & Billing',
    icon: 'bx-dollar',
    accent: '#f472b6',
    items: [
      { label: 'Billing Rates',       icon: 'bx-money',           desc: 'Role and employee billing rate tables',    live: true, to: '/settings/billing-rates' },
      { label: 'Currency Settings',   icon: 'bx-coin',            desc: 'Multi-currency support and FX rates',      live: true, to: '/settings/currency' },
      { label: 'Invoice Templates',   icon: 'bx-receipt',         desc: 'Customise invoice layout and branding',    live: true, to: '/settings/invoice-templates' },
      { label: 'Cost Centers',        icon: 'bx-buildings',       desc: 'Internal cost allocation and P&L mapping', live: true, to: '/settings/cost-centers' },
    ],
  },
  {
    id: 'access',
    title: 'Users & Access',
    icon: 'bx-shield',
    accent: '#a78bfa',
    items: [
      { label: 'Employees & Access',   icon: 'bx-group',           desc: 'Employee records, roles, login accounts and permissions', live: true, to: '/employees' },
      { label: 'Audit Log',           icon: 'bx-history',         desc: 'Full trail of every system action',           live: true, to: ADMIN_PATH.auditLog  },
      { label: 'Job Roles',           icon: 'bx-id-card',         desc: 'Create custom job titles like Sr Solutions Architect', live: true, to: '/settings/job-roles' },
      { label: 'Permission Sets',     icon: 'bx-lock-alt',        desc: 'Reusable access templates + per-user page access', live: true, to: '/settings/roles' },
      { label: 'Team Hierarchy',      icon: 'bx-sitemap',         desc: 'Org chart, supervisors and reporting lines',  live: true, to: '/settings/team-hierarchy' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'bx-bell',
    accent: '#fb923c',
    items: [
      { label: 'Email Templates',     icon: 'bx-envelope',        desc: 'Branded templates for system emails',      live: true, to: '/settings/email-templates' },
      { label: 'Alert Rules',         icon: 'bx-error-circle',    desc: 'Trigger-based alerts and escalations',     live: true, to: '/settings/alert-rules' },
      { label: 'Notification Prefs',  icon: 'bx-toggle-right',    desc: 'Per-user delivery channel preferences',    live: true, to: '/settings/notification-preferences' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: 'bx-plug',
    accent: '#2dd4bf',
    items: [
      { label: 'Replicon Sync',       icon: 'bx-sync',            desc: 'Import all Replicon data into PSA',        live: true, to: ADMIN_PATH.migration },
      { label: 'Calendar',            icon: 'bx-calendar',        desc: 'Google and Outlook calendar sync',         live: true, to: '/settings/calendar' },
      { label: 'API Keys',            icon: 'bx-key',             desc: 'Manage external API credentials',          live: true, to: '/settings/api-keys' },
      { label: 'Webhooks',            icon: 'bx-broadcast',       desc: 'Real-time event delivery to endpoints',    live: true, to: '/settings/webhooks' },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    icon: 'bx-lifebuoy',
    accent: '#22d3ee',
    items: [
      { label: 'Support Tickets',  icon: 'bx-message-square-dots', desc: 'Employee-reported issues and requests',   live: true, to: '/settings/support' },
    ],
  },
  {
    id: 'system',
    title: 'System',
    icon: 'bx-cog',
    accent: '#94a3b8',
    items: [
      { label: 'General Settings',    icon: 'bx-wrench',          desc: 'Platform-wide preferences and defaults',   live: true, to: '/settings/general' },
      { label: 'Branding',            icon: 'bx-palette',         desc: 'Logo, accent colours and display name',    live: true, to: '/settings/branding' },
      { label: 'Localization',        icon: 'bx-globe',           desc: 'Language, timezone and date formats',      live: true, to: '/settings/localization' },
      { label: 'Backup & Restore',    icon: 'bx-cloud-upload',    desc: 'Export data and restore from backup',      live: true, to: '/settings/backup' },
    ],
  },
];

const liveTotal  = SECTIONS.reduce((n, s) => n + s.items.filter(i => i.live).length, 0);
const totalItems = SECTIONS.reduce((n, s) => n + s.items.length, 0);

// ── SettingButton ──────────────────────────────────────────────────────────
function SettingButton({ item, accent, onNavigate }) {
  if (item.live) {
    return (
      <button
        onClick={() => onNavigate(item.to)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          background: `${accent}0d`, border: `1px solid ${accent}30`,
          borderRadius: '12px', padding: '14px 16px',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background   = `${accent}18`;
          e.currentTarget.style.borderColor  = `${accent}55`;
          e.currentTarget.style.transform    = 'translateY(-1px)';
          e.currentTarget.style.boxShadow    = `0 4px 20px ${accent}15`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background   = `${accent}0d`;
          e.currentTarget.style.borderColor  = `${accent}30`;
          e.currentTarget.style.transform    = 'none';
          e.currentTarget.style.boxShadow    = 'none';
        }}
      >
        <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`bx ${item.icon}`} style={{ fontSize: '17px', color: accent }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{item.label}</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#4ade80', borderRadius: '4px', padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Live</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.45 }}>{item.desc}</p>
        </div>
        <i className='bx bx-chevron-right' style={{ color: accent, fontSize: '1.05rem', flexShrink: 0, marginTop: '7px', opacity: 0.6 }} />
      </button>
    );
  }

  return (
    <div
      title="Coming soon"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '14px 16px',
        cursor: 'not-allowed', textAlign: 'left', width: '100%',
      }}
    >
      <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className={`bx ${item.icon}`} style={{ fontSize: '17px', color: 'rgba(255,255,255,0.2)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>{item.label}</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)', borderRadius: '4px', padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Soon</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.18)', lineHeight: 1.45 }}>{item.desc}</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Administration() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '28px 36px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='bx bx-shield-alt-2' style={{ fontSize: '22px', color: '#a78bfa' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Administration</h1>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Platform configuration, user access, and system settings
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <span style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', borderRadius: '7px', padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, border: '1px solid rgba(34,197,94,0.2)' }}>
            <i className='bx bx-check-circle' style={{ marginRight: '5px', verticalAlign: 'middle' }} />
            {liveTotal} live
          </span>
          <span style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', borderRadius: '7px', padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)' }}>
            <i className='bx bx-time' style={{ marginRight: '5px', verticalAlign: 'middle' }} />
            {totalItems - liveTotal} coming soon
          </span>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {SECTIONS.map(section => (
          <section key={section.id}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `${section.accent}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`bx ${section.icon}`} style={{ fontSize: '14px', color: section.accent }} />
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: section.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {section.title}
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                {section.items.filter(i => i.live).length}/{section.items.length} live
              </span>
            </div>

            {/* Button grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {section.items.map(item => (
                <SettingButton key={item.label} item={item} accent={section.accent} onNavigate={navigate} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: '48px', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <i className='bx bx-info-circle' style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
          Settings marked <strong style={{ color: 'rgba(255,255,255,0.3)' }}>Soon</strong> are planned features. Live settings are fully functional. Only administrators can access this page.
        </p>
      </div>
    </div>
  );
}
