import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

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
      { label: 'Project Settings',    icon: 'bx-slider-alt',      desc: 'Default project behaviours & rules',      live: false },
      { label: 'Billing Settings',    icon: 'bx-dollar-circle',   desc: 'Configure billing models and rate cards',  live: false },
      { label: 'Project Templates',   icon: 'bx-copy',            desc: 'Reusable project structures & task sets',  live: false },
      { label: 'Project Categories',  icon: 'bx-purchase-tag',    desc: 'Classify projects by type or department',  live: false },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    icon: 'bx-briefcase',
    accent: '#34d399',
    items: [
      { label: 'Client Settings',     icon: 'bx-cog',             desc: 'Default client onboarding configuration',  live: false },
      { label: 'SLA Configuration',   icon: 'bx-time-five',       desc: 'Define service level agreement terms',     live: false },
      { label: 'Contract Templates',  icon: 'bx-file',            desc: 'Standardised contract and SOW formats',    live: false },
      { label: 'Client Tiers',        icon: 'bx-medal',           desc: 'Tier-based segmentation and priorities',   live: false },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    icon: 'bx-task',
    accent: '#fbbf24',
    items: [
      { label: 'Task Settings',       icon: 'bx-slider-alt',      desc: 'Default task behaviours and constraints',  live: false },
      { label: 'Task Categories',     icon: 'bx-purchase-tag',    desc: 'Classify tasks by discipline or phase',    live: false },
      { label: 'Priority Levels',     icon: 'bx-sort-alt-2',      desc: 'Define and order task priority tiers',     live: false },
      { label: 'Workflow Rules',      icon: 'bx-git-branch',      desc: 'Automated status-transition triggers',     live: false },
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    icon: 'bx-time-five',
    accent: '#60a5fa',
    items: [
      { label: 'Timesheet Periods',   icon: 'bx-calendar',        desc: 'Fiscal weeks, cut-offs and lock rules',    live: false },
      { label: 'Approval Workflow',   icon: 'bx-check-shield',    desc: 'Multi-step approval chains and escalation', live: false },
      { label: 'Overtime Rules',      icon: 'bx-timer',           desc: 'Thresholds, caps and OT pay settings',     live: false },
      { label: 'Holiday Calendar',    icon: 'bx-calendar-star',   desc: 'Public and company-wide holidays',         live: false },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & Billing',
    icon: 'bx-dollar',
    accent: '#f472b6',
    items: [
      { label: 'Billing Rates',       icon: 'bx-money',           desc: 'Role and employee billing rate tables',    live: false },
      { label: 'Currency Settings',   icon: 'bx-coin',            desc: 'Multi-currency support and FX rates',      live: false },
      { label: 'Invoice Templates',   icon: 'bx-receipt',         desc: 'Customise invoice layout and branding',    live: false },
      { label: 'Cost Centers',        icon: 'bx-buildings',       desc: 'Internal cost allocation and P&L mapping', live: false },
    ],
  },
  {
    id: 'access',
    title: 'Users & Access',
    icon: 'bx-shield',
    accent: '#a78bfa',
    items: [
      { label: 'Employees',           icon: 'bx-group',           desc: 'Employee records, roles and system accounts', live: true, to: '/employees'          },
      { label: 'Users',               icon: 'bx-user-pin',        desc: 'Login accounts and page-level permissions',   live: true, to: '/settings'   },
      { label: 'Audit Log',           icon: 'bx-history',         desc: 'Full trail of every system action',           live: true, to: '/audit-log'  },
      { label: 'Roles & Permissions', icon: 'bx-lock-alt',        desc: 'Define role presets and access policies',     live: false },
      { label: 'Team Hierarchy',      icon: 'bx-sitemap',         desc: 'Org chart, supervisors and reporting lines',  live: false },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'bx-bell',
    accent: '#fb923c',
    items: [
      { label: 'Email Templates',     icon: 'bx-envelope',        desc: 'Branded templates for system emails',      live: false },
      { label: 'Alert Rules',         icon: 'bx-error-circle',    desc: 'Trigger-based alerts and escalations',     live: false },
      { label: 'Notification Prefs',  icon: 'bx-toggle-right',    desc: 'Per-user delivery channel preferences',    live: false },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: 'bx-plug',
    accent: '#2dd4bf',
    items: [
      { label: 'Replicon Sync',       icon: 'bx-sync',            desc: 'Configure Replicon API data sync',         live: false },
      { label: 'Calendar',            icon: 'bx-calendar',        desc: 'Google and Outlook calendar sync',         live: false },
      { label: 'API Keys',            icon: 'bx-key',             desc: 'Manage external API credentials',          live: false },
      { label: 'Webhooks',            icon: 'bx-broadcast',       desc: 'Real-time event delivery to endpoints',    live: false },
    ],
  },
  {
    id: 'system',
    title: 'System',
    icon: 'bx-cog',
    accent: '#94a3b8',
    items: [
      { label: 'General Settings',    icon: 'bx-wrench',          desc: 'Platform-wide preferences and defaults',   live: false },
      { label: 'Branding',            icon: 'bx-palette',         desc: 'Logo, accent colours and display name',    live: false },
      { label: 'Localization',        icon: 'bx-globe',           desc: 'Language, timezone and date formats',      live: false },
      { label: 'Backup & Restore',    icon: 'bx-cloud-upload',    desc: 'Export data and restore from backup',      live: false },
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
    <div style={{ padding: '28px 36px', maxWidth: '1200px' }}>

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
