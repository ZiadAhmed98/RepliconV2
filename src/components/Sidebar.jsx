import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/',            icon: 'bx-line-chart',   label: 'Dashboard',  shortcut: '1' },
  { to: '/employee',    icon: 'bx-user-pin',      label: 'Employees',  shortcut: '2' },
  { to: '/projects',    icon: 'bx-folder',        label: 'Projects',   shortcut: '3' },
  { to: '/timesheets',  icon: 'bx-time-five',     label: 'Timesheets', shortcut: '4', badge: true },
  { to: '/new-project', icon: 'bx-plus-circle',   label: 'Add Project',shortcut: '5' },
];

const style = {
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
  logo: (collapsed) => ({
    padding: collapsed ? '18px 16px' : '22px 20px',
    display: 'flex', alignItems: 'center', gap: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    minHeight: '68px', flexShrink: 0,
  }),
  logoIcon: {
    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
    background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 16px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  logoText: { overflow: 'hidden' },
  nav: { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '3px' },
  navLink: (isActive, collapsed) => ({
    display: 'flex', alignItems: 'center',
    gap: '11px',
    padding: collapsed ? '11px 18px' : '10px 13px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
    background: isActive
      ? 'linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(37,99,235,0.15) 100%)'
      : 'transparent',
    border: isActive
      ? '1px solid rgba(139,92,246,0.3)'
      : '1px solid transparent',
    boxShadow: isActive ? '0 0 12px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
    transition: 'all 0.18s',
    whiteSpace: 'nowrap', overflow: 'hidden',
    position: 'relative',
  }),
  icon: (isActive) => ({
    fontSize: '1.15rem',
    color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.4)',
    flexShrink: 0,
    transition: 'color 0.18s, filter 0.18s',
    filter: isActive ? 'drop-shadow(0 0 6px rgba(167,139,250,0.7))' : 'none',
  }),
  label: (isActive) => ({
    fontSize: '13px',
    fontWeight: isActive ? 600 : 500,
    letterSpacing: '-0.01em',
    transition: 'color 0.18s',
  }),
  badge: {
    marginLeft: 'auto', minWidth: '18px', height: '18px', padding: '0 5px',
    borderRadius: '9999px',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#fff', fontSize: '10px', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 0 8px rgba(239,68,68,0.5)',
  },
  bottom: { padding: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 },
  collapseBtn: (collapsed) => ({
    width: '100%', padding: '9px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: '9px', transition: 'all 0.15s', marginBottom: '6px', fontFamily: 'inherit',
  }),
  user: (collapsed) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: collapsed ? '10px 18px' : '10px 12px',
    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s',
  }),
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: '13px',
    boxShadow: '0 0 0 2px rgba(168,85,247,0.3)',
  },
};

export default function Sidebar({ sessionUser, onLogout, pendingCount = 0, collapsed, onToggle }) {
  const sidebarW = collapsed ? 'var(--sidebar-wc, 72px)' : 'var(--sidebar-w, 240px)';
  const userName = sessionUser?.name || 'User';

  return (
    <aside style={style.sidebar(sidebarW)}>
      {/* Logo */}
      <div style={style.logo(collapsed)}>
        <div style={style.logoIcon}>
          <i className='bx bx-hive' style={{ color: '#fff', fontSize: '1.2rem' }} />
        </div>
        {!collapsed && (
          <div style={style.logoText}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#fafafa', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              MDS Premium
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '1px' }}>
              Analytics V2
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={style.nav}>
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
            style={({ isActive }) => style.navLink(isActive, collapsed)}
          >
            {({ isActive }) => (
              <>
                <i className={`bx ${item.icon}`} style={style.icon(isActive)} />
                {!collapsed && <span style={style.label(isActive)}>{item.label}</span>}
                {item.badge && pendingCount > 0 && (
                  <span style={{ ...style.badge, marginLeft: collapsed ? 'unset' : 'auto',
                    position: collapsed ? 'absolute' : 'static',
                    top: collapsed ? '6px' : 'auto', right: collapsed ? '6px' : 'auto',
                    minWidth: collapsed ? '16px' : '18px', height: collapsed ? '16px' : '18px',
                    fontSize: '9px',
                  }}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={style.bottom}>
        <button style={style.collapseBtn(collapsed)} onClick={onToggle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <i className={`bx ${collapsed ? 'bx-chevrons-right' : 'bx-chevrons-left'}`} style={{ fontSize: '1rem' }} />
          {!collapsed && <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'inherit' }}>Collapse</span>}
        </button>

        <div style={style.user(collapsed)} onClick={onLogout}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title={collapsed ? `${userName} — logout` : undefined}
        >
          <div style={style.avatar}>{userName.charAt(0).toUpperCase()}</div>
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
