import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',            icon: 'bx-line-chart',    label: 'Dashboard',   shortcut: '1' },
  { to: '/employee',   icon: 'bx-user-pin',       label: 'Employees',   shortcut: '2' },
  { to: '/projects',   icon: 'bx-folder',         label: 'Projects',    shortcut: '3' },
  { to: '/timesheets', icon: 'bx-time-five',      label: 'Timesheets',  shortcut: '4', badge: true },
  { to: '/new-project',icon: 'bx-plus-circle',    label: 'Add Project', shortcut: '5' },
];

export default function Sidebar({ sessionUser, onLogout, pendingCount = 0, collapsed, onToggle }) {
  const navigate = useNavigate();
  const userName    = sessionUser?.name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside
      style={{
        width: collapsed ? '72px' : '240px',
        minHeight: '100vh',
        background: 'rgba(14,14,18,0.85)',
        backdropFilter: 'blur(40px) saturate(150%)',
        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0, top: 0,
        zIndex: 1100,
        transition: 'width 0.25s cubic-bezier(0.2,0.8,0.2,1)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: collapsed ? '20px 16px' : '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: '72px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className='bx bx-hive' style={{ color: '#fff', fontSize: '1.2rem' }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap' }}>MDS Premium</div>
            <div style={{ fontSize: '0.7rem', color: '#8e8e93', marginTop: '1px' }}>Analytics V2</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: collapsed ? '10px 16px' : '10px 14px',
              borderRadius: '12px',
              textDecoration: 'none',
              color: isActive ? '#fff' : '#8e8e93',
              background: isActive ? 'rgba(168,85,247,0.15)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(168,85,247,0.25)' : 'transparent'}`,
              transition: 'all 0.15s',
              position: 'relative',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            })}
          >
            {({ isActive }) => (
              <>
                <i className={`bx ${item.icon}`} style={{ fontSize: '1.2rem', color: isActive ? '#a855f7' : '#8e8e93', flexShrink: 0 }} />
                {!collapsed && <span style={{ fontWeight: isActive ? 600 : 500, fontSize: '0.88rem' }}>{item.label}</span>}
                {item.badge && pendingCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    minWidth: '20px', height: '20px', padding: '0 6px',
                    borderRadius: '10px', background: '#ff3b30',
                    color: '#fff', fontSize: '0.68rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%', padding: '10px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            color: '#8e8e93', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start', gap: '10px',
            transition: 'all 0.15s', marginBottom: '8px',
          }}
        >
          <i className={`bx ${collapsed ? 'bx-chevrons-right' : 'bx-chevrons-left'}`} style={{ fontSize: '1.1rem' }} />
          {!collapsed && <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>Collapse</span>}
        </button>

        {/* User */}
        <div
          onClick={onLogout}
          title={collapsed ? `${userName} — click to logout` : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: collapsed ? '10px 16px' : '10px 12px',
            borderRadius: '12px', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#d8b4fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
            {userInitial}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ fontSize: '0.68rem', color: '#8e8e93', marginTop: '1px' }}>Click to logout</div>
            </div>
          )}
          {!collapsed && <i className='bx bx-log-out' style={{ color: '#ff3b30', fontSize: '1rem', flexShrink: 0 }} />}
        </div>
      </div>
    </aside>
  );
}
