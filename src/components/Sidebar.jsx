import React, { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';
import { canAccessPage } from '../config/pages';
import { ADMIN_PATH } from '../config/adminRoutes';

// ── Navigation structure ───────────────────────────────────────────────────
// Groups: each child has its own perm — group is visible when ≥1 child passes.
// Standalone items: use top-level perm directly.
const NAV = [
  { to: '/home',                icon: 'bx-home-smile',     label: 'Home'      },
  { to: '/my-timesheet',        icon: 'bx-calendar-check', label: 'My Time',  perm: 'myTimesheet'       },
  // Read-only project view — shown only to users WITHOUT the projects (management) grant.
  { to: '/my-projects',         icon: 'bx-folder',         label: 'My Projects', onlyIfNo: 'projects'   },
  { to: '/timesheets-approval', icon: 'bx-check-double',   label: 'Approvals',perm: 'timesheetApproval' },
  { to: '/projects-admin',      icon: 'bx-folder-open',    label: 'Projects', perm: 'projects'           },
  { to: '/clients',             icon: 'bx-briefcase',      label: 'Clients',       perm: 'clients' },
  { to: '/programs',           icon: 'bx-collection',     label: 'Programs', perm: 'programs',                     },
  { to: '/account-managers',   icon: 'bx-id-card',        label: 'Acc Mgrs', perm: 'accountManagers',                     },
  { to: '/templates',          icon: 'bx-file-blank',     label: 'Templates', perm: 'templates',                    },
  {
    label: 'Analytics', icon: 'bx-line-chart', group: true,
    children: [
      { to: '/dashboard',  icon: 'bx-grid-alt',       label: 'Dashboard', perm: 'dashboard'         },
      { to: '/employee',   icon: 'bx-group',           label: 'Employees', perm: 'employees'         },
      { to: '/projects',   icon: 'bx-bar-chart-alt-2', label: 'Projects',  perm: 'projectsAnalytics' },
    ],
  },
  {
    label: 'Replicon', icon: 'bx-sync', group: true,
    children: [
      { to: '/new-project',   icon: 'bx-plus-circle', label: 'Add Project',   perm: 'addProject'   },
      { to: '/projects/edit', icon: 'bx-edit',         label: 'Edit Projects', perm: 'editProjects' },
      { to: '/timesheets',    icon: 'bx-time-five',    label: 'Timesheets',    perm: 'timesheets', badge: true },
    ],
  },
  { to: '/ai-insights', icon: 'bx-brain', label: 'AI Insights', perm: 'aiInsights', glow: true },
];

// ── Style helpers ──────────────────────────────────────────────────────────
const S = {
  sidebar: (w) => ({
    width: w, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 1100,
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg, rgba(8,8,15,0.97) 0%, rgba(6,6,12,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(140%)',
    WebkitBackdropFilter: 'blur(40px) saturate(140%)',
    borderRight: '1px solid rgba(255,255,255,0.055)',
    boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
    transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
    overflow: 'hidden',
  }),
  logoWrap: (collapsed) => ({
    padding: collapsed ? '18px 16px' : '22px 20px',
    display: 'flex', alignItems: 'center', gap: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    minHeight: '68px', flexShrink: 0,
  }),
  logoIcon: {
    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  nav: {
    flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px',
    overflowY: 'auto', overflowX: 'hidden',
  },
  link: (isActive, collapsed) => ({
    display: 'flex', alignItems: 'center', gap: '11px',
    padding: collapsed ? '11px 18px' : '9px 12px',
    borderRadius: '11px', textDecoration: 'none',
    color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
    background: isActive ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.15))' : 'transparent',
    border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
    boxShadow: isActive ? '0 0 12px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
    transition: 'all 0.18s', whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative',
  }),
  subLink: (isActive) => ({
    display: 'flex', alignItems: 'center', gap: '9px',
    padding: '7px 10px 7px 14px', borderRadius: '9px',
    textDecoration: 'none', margin: '1px 0',
    color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.38)',
    background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
    border: isActive ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent',
    transition: 'all 0.15s', whiteSpace: 'nowrap', fontSize: '12px',
  }),
  groupBtn: (anyActive) => ({
    display: 'flex', alignItems: 'center', gap: '11px',
    padding: '9px 12px', borderRadius: '11px',
    color: anyActive ? '#fff' : 'rgba(255,255,255,0.45)',
    background: anyActive ? 'rgba(139,92,246,0.08)' : 'transparent',
    border: '1px solid transparent',
    cursor: 'pointer', transition: 'all 0.18s',
    whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', fontFamily: 'inherit',
  }),
  icon: (isActive, glow) => ({
    fontSize: '1.1rem',
    color: isActive ? (glow ? '#a78bfa' : '#a78bfa') : glow ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.4)',
    flexShrink: 0, transition: 'color 0.18s, filter 0.18s',
    filter: isActive ? 'drop-shadow(0 0 5px rgba(167,139,250,0.7))' : 'none',
  }),
  labelText: (isActive) => ({
    fontSize: '13px', fontWeight: isActive ? 600 : 500,
    letterSpacing: '-0.01em', transition: 'color 0.18s',
  }),
  badge: {
    marginLeft: 'auto', minWidth: '18px', height: '18px', padding: '0 5px',
    borderRadius: '9999px', background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#fff', fontSize: '10px', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 0 8px rgba(239,68,68,0.5)',
  },
  chevron: (open) => ({
    marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)',
    transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0,
  }),
  subGroup: (open) => ({
    overflow: 'hidden', maxHeight: open ? '400px' : '0px',
    transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1)',
    paddingLeft: '8px',
  }),
  bottom: { padding: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 },
  collapseBtn: {
    width: '100%', padding: '9px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '9px',
    transition: 'all 0.15s', marginBottom: '6px', fontFamily: 'inherit',
  },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: '13px',
    boxShadow: '0 0 0 2px rgba(168,85,247,0.3)',
  },
};

export default function Sidebar({ sessionUser, onLogout, pendingCount = 0, collapsed, onToggle }) {
  const location  = useLocation();
  const { permissions, isAdmin } = usePermissions();
  const sidebarW  = collapsed ? 'var(--sidebar-wc, 72px)' : 'var(--sidebar-w, 240px)';
  const userName  = sessionUser?.name || 'User';

  // ── Permission helper (shared canonical check) ─────────────────────────
  const canSee = (perm) => canAccessPage(permissions, isAdmin, perm);

  // ── Visible children per group ─────────────────────────────────────────
  const visibleKids = (group) => group.children.filter(c => canSee(c.perm));

  // ── Filter top-level NAV ───────────────────────────────────────────────
  const visibleNav = NAV.filter(item => {
    if (item.onlyIfNo) return !canSee(item.onlyIfNo);   // e.g. My Projects only when no management grant
    return item.group ? visibleKids(item).length > 0 : canSee(item.perm);
  });

  // ── Open-group state — auto-open if current route is inside ───────────
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {};
    NAV.filter(i => i.group).forEach(g => {
      init[g.label] = g.children.some(c =>
        location.pathname === c.to || location.pathname.startsWith(c.to + '/')
      );
    });
    return init;
  });

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  const isGroupActive = (group) =>
    group.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));

  const isAdminRouteActive = location.pathname === ADMIN_PATH.administration;

  return (
    <aside data-tour="sidebar" style={S.sidebar(sidebarW)}>

      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div style={S.logoWrap(collapsed)}>
        <div style={S.logoIcon}>
          <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'contain', display: 'block' }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#fafafa', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Liveroute Replicon</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '1px' }}>Analytics V2</div>
          </div>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav style={S.nav}>
        {visibleNav.map((item) => {

          // ── Collapsible group ──────────────────────────────────────
          if (item.group) {
            const kids      = visibleKids(item);
            const anyActive = isGroupActive(item);
            const open      = openGroups[item.label];

            if (collapsed) {
              return (
                <div key={item.label} title={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    style={{ ...S.groupBtn(anyActive), padding: '11px 18px', justifyContent: 'center' }}
                  >
                    <i className={`bx ${item.icon}`} style={S.icon(anyActive, false)} />
                  </button>
                </div>
              );
            }

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  style={S.groupBtn(anyActive)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = anyActive ? 'rgba(139,92,246,0.08)' : 'transparent'; e.currentTarget.style.color = anyActive ? '#fff' : 'rgba(255,255,255,0.45)'; }}
                >
                  <i className={`bx ${item.icon}`} style={S.icon(anyActive, false)} />
                  <span style={S.labelText(anyActive)}>{item.label}</span>
                  <i className='bx bx-chevron-right' style={S.chevron(open)} />
                </button>
                <div style={S.subGroup(open)}>
                  {kids.map(child => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.to === '/projects' || child.to === '/dashboard'}
                      style={({ isActive }) => S.subLink(isActive)}
                      onMouseEnter={e => { if (!e.currentTarget.style.background.includes('rgba(139')) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!e.currentTarget.style.background.includes('rgba(139')) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {({ isActive }) => (
                        <>
                          <i className={`bx ${child.icon}`} style={{ fontSize: '0.95rem', color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.35)', flexShrink: 0, filter: isActive ? 'drop-shadow(0 0 4px rgba(167,139,250,0.6))' : 'none' }} />
                          <span style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400, flex: 1 }}>{child.label}</span>
                          {child.badge && pendingCount > 0 && (
                            <span style={{ ...S.badge, marginLeft: 'auto', minWidth: '16px', height: '16px', fontSize: '9px' }}>
                              {pendingCount > 99 ? '99+' : pendingCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          }

          // ── Standalone link ────────────────────────────────────────
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                ...S.link(isActive, collapsed),
                ...(item.glow && isActive ? { boxShadow: '0 0 16px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' } : {}),
              })}
              onMouseEnter={e => { const el = e.currentTarget; if (!el.style.background.includes('rgba(124')) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'rgba(255,255,255,0.7)'; } }}
              onMouseLeave={e => { const el = e.currentTarget; if (!el.style.background.includes('rgba(124')) { el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.45)'; } }}
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${item.icon}`} style={S.icon(isActive, item.glow)} />
                  {!collapsed && <span style={S.labelText(isActive)}>{item.label}</span>}
                  {item.glow && !collapsed && (
                    <i className='bx bx-sparkles' style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(139,92,246,0.6)', flexShrink: 0 }} />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom section ────────────────────────────────────────────── */}
      <div style={S.bottom}>

        {/* Administration link — isAdmin flag only, no permission override */}
        {isAdmin && (
          <NavLink
            to={ADMIN_PATH.administration}
            title={collapsed ? 'Administration' : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '11px',
              padding: collapsed ? '10px 18px' : '9px 12px',
              borderRadius: '11px', textDecoration: 'none',
              color: isActive ? '#fcd34d' : 'rgba(255,255,255,0.35)',
              background: isActive ? 'rgba(251,191,36,0.08)' : 'transparent',
              border: isActive ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent',
              transition: 'all 0.18s', whiteSpace: 'nowrap', overflow: 'hidden',
              marginBottom: '4px',
            })}
            onMouseEnter={e => { if (!e.currentTarget.style.background.includes('rgba(251')) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
            onMouseLeave={e => {
              const isActive = location.pathname === ADMIN_PATH.administration;
              e.currentTarget.style.background = isActive ? 'rgba(251,191,36,0.08)' : 'transparent';
              e.currentTarget.style.color = isActive ? '#fcd34d' : 'rgba(255,255,255,0.35)';
            }}
          >
            {({ isActive }) => (
              <>
                <i className='bx bx-shield-alt-2' style={{ fontSize: '1.1rem', color: isActive ? '#fcd34d' : 'rgba(255,255,255,0.3)', flexShrink: 0, filter: isActive ? 'drop-shadow(0 0 5px rgba(251,191,36,0.5))' : 'none' }} />
                {!collapsed && <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, letterSpacing: '-0.01em' }}>Administration</span>}
              </>
            )}
          </NavLink>
        )}

        {/* Collapse toggle */}
        <button
          style={{ ...S.collapseBtn, justifyContent: collapsed ? 'center' : 'flex-start' }}
          onClick={onToggle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <i className={`bx ${collapsed ? 'bx-chevrons-right' : 'bx-chevrons-left'}`} style={{ fontSize: '1rem' }} />
          {!collapsed && <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'inherit' }}>Collapse</span>}
        </button>

        {/* User avatar + logout — row when expanded, stacked when collapsed */}
        <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', gap: collapsed ? '6px' : '6px', padding: collapsed ? '8px 6px' : '6px 8px' }}>
          <Link
            to="/profile"
            style={{ flex: collapsed ? 'none' : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 8px', borderRadius: '10px', textDecoration: 'none', transition: 'background 0.15s', minWidth: 0 }}
            title={collapsed ? `${userName} — My Profile` : undefined}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={S.avatar}>{userName.charAt(0).toUpperCase()}</div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ fontSize: '10px', color: 'rgba(168,85,247,0.5)', marginTop: '1px' }}>My Profile</div>
              </div>
            )}
          </Link>
          <button
            onClick={onLogout}
            title="Logout"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', color: 'rgba(239,68,68,0.5)', fontSize: '15px', flexShrink: 0, transition: 'all 0.15s', width: collapsed ? '100%' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(239,68,68,0.5)'; }}
          >
            <i className='bx bx-log-out' />
          </button>
        </div>
      </div>
    </aside>
  );
}
