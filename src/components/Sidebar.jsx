import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';

// ── Navigation structure ───────────────────────────────────────────────────
const NAV = [
  { to: '/',           icon: 'bx-line-chart',   label: 'Dashboard',  perm: 'dashboard'  },
  { to: '/employee',   icon: 'bx-user-pin',      label: 'Employees',  perm: 'employees'  },
  { to: '/timesheets', icon: 'bx-time-five',     label: 'Timesheets', perm: 'timesheets', badge: true },
  {
    label: 'Projects', icon: 'bx-folder', group: true, perm: 'projects',
    children: [
      { to: '/projects',      icon: 'bx-bar-chart-alt-2', label: 'Analytics'    },
      { to: '/new-project',   icon: 'bx-plus-circle',     label: 'Add Project'  },
      { to: '/projects/edit', icon: 'bx-edit',            label: 'Edit Project' },
    ],
  },
  {
    label: 'Clients', icon: 'bx-briefcase', group: true, perm: 'clients',
    children: [
      { to: '/clients/create', icon: 'bx-plus-circle', label: 'Create Client' },
      { to: '/clients/edit',   icon: 'bx-edit',        label: 'Edit Client'   },
    ],
  },
  { to: '/ai-insights',   icon: 'bx-brain',      label: 'AI Insights', perm: 'aiInsights',   glow: true },
  { to: '/my-timesheet', icon: 'bx-calendar-check', label: 'My Time',    perm: 'myTimesheet'  },
  { to: '/settings',     icon: 'bx-cog',       label: 'Settings',    perm: 'settings'   },
];

// ── Inline style helpers ───────────────────────────────────────────────────
const S = {
  sidebar: (w) => ({
    width: w, minHeight: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 1100,
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
  nav: { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', overflowX: 'hidden' },
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
  icon: (isActive) => ({
    fontSize: '1.1rem', color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.4)',
    flexShrink: 0, transition: 'color 0.18s, filter 0.18s',
    filter: isActive ? 'drop-shadow(0 0 5px rgba(167,139,250,0.7))' : 'none',
  }),
  label: (isActive) => ({
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
    overflow: 'hidden', maxHeight: open ? '300px' : '0px',
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
  const location    = useLocation();
  const { permissions, isAdmin } = usePermissions();
  const sidebarW    = collapsed ? 'var(--sidebar-wc, 72px)' : 'var(--sidebar-w, 240px)';
  const userName    = sessionUser?.name || 'User';

  const canSee = (perm) => {
    if (!perm) return true;
    if (perm === 'settings') return isAdmin;
    return isAdmin || permissions[perm] === true;
  };

  const visibleNav = NAV.filter(item => canSee(item.perm));

  // Track which groups are open — default open if current route is inside
  const groupPaths = { Projects: ['/projects', '/new-project', '/projects/edit'], Clients: ['/clients/create', '/clients/edit'] };
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {};
    Object.entries(groupPaths).forEach(([g, paths]) => {
      init[g] = paths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    });
    return init;
  });

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  const isGroupActive = (item) => item.children?.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/')) ?? false;

  return (
    <aside style={S.sidebar(sidebarW)}>
      {/* Logo */}
      <div style={S.logoWrap(collapsed)}>
        <div style={S.logoIcon}>
          <img src="/logo.png" alt="Liveroute" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'contain', display: 'block' }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#fafafa', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Liveroute Replicon</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '1px' }}>Analytics V2</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {visibleNav.map((item) => {
          if (item.group) {
            const anyActive = isGroupActive(item);
            const open = openGroups[item.label];
            if (collapsed) {
              // Collapsed: show first active child or group icon only
              const activeChild = item.children.find(c => location.pathname === c.to);
              return (
                <div key={item.label} style={{ position: 'relative' }}>
                  <button
                    title={item.label}
                    onClick={() => toggleGroup(item.label)}
                    style={{ ...S.groupBtn(anyActive), padding: '11px 18px', justifyContent: 'center' }}
                  >
                    <i className={`bx ${item.icon}`} style={S.icon(anyActive)} />
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
                  <i className={`bx ${item.icon}`} style={S.icon(anyActive)} />
                  <span style={S.label(anyActive)}>{item.label}</span>
                  <i className='bx bx-chevron-right' style={S.chevron(open)} />
                </button>
                <div style={S.subGroup(open)}>
                  {item.children.map(child => (
                    <NavLink
                      key={child.to} to={child.to} end={child.to === '/projects'}
                      style={({ isActive }) => S.subLink(isActive)}
                      onMouseEnter={e => { if (!e.currentTarget.style.background.includes('rgba(139')) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!e.currentTarget.style.background.includes('rgba(139')) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {({ isActive }) => (
                        <>
                          <i className={`bx ${child.icon}`} style={{ fontSize: '0.95rem', color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.35)', flexShrink: 0, filter: isActive ? 'drop-shadow(0 0 4px rgba(167,139,250,0.6))' : 'none' }} />
                          <span style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400 }}>{child.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          }

          // Regular link
          return (
            <NavLink
              key={item.to} to={item.to} end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({ ...S.link(isActive, collapsed), ...(item.glow && isActive ? { boxShadow: '0 0 16px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' } : {}) })}
              onMouseEnter={e => { const el = e.currentTarget; if (!el.style.background.includes('rgba(124')) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'rgba(255,255,255,0.7)'; } }}
              onMouseLeave={e => { const el = e.currentTarget; if (!el.style.background.includes('rgba(124')) { el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.45)'; } }}
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${item.icon}`} style={{ ...S.icon(isActive), ...(item.glow ? { color: isActive ? '#a78bfa' : 'rgba(139,92,246,0.7)' } : {}) }} />
                  {!collapsed && <span style={S.label(isActive)}>{item.label}</span>}
                  {item.badge && pendingCount > 0 && (
                    <span style={{ ...S.badge, marginLeft: collapsed ? 'unset' : 'auto', position: collapsed ? 'absolute' : 'static', top: collapsed ? '5px' : 'auto', right: collapsed ? '5px' : 'auto', minWidth: collapsed ? '16px' : '18px', height: collapsed ? '16px' : '18px', fontSize: '9px' }}>
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                  {item.glow && !collapsed && <i className='bx bx-sparkles' style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(139,92,246,0.6)', flexShrink: 0 }} />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={S.bottom}>
        <button
          style={{ ...S.collapseBtn, justifyContent: collapsed ? 'center' : 'flex-start' }}
          onClick={onToggle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <i className={`bx ${collapsed ? 'bx-chevrons-right' : 'bx-chevrons-left'}`} style={{ fontSize: '1rem' }} />
          {!collapsed && <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'inherit' }}>Collapse</span>}
        </button>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: collapsed ? '10px 18px' : '10px 12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
          onClick={onLogout}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title={collapsed ? `${userName} — logout` : undefined}
        >
          <div style={S.avatar}>{userName.charAt(0).toUpperCase()}</div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>Click to logout</div>
              </div>
              <i className='bx bx-log-out' style={{ color: 'rgba(239,68,68,0.6)', fontSize: '14px', flexShrink: 0 }} />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
