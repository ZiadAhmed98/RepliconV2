import React, { useState, useEffect, useRef } from 'react';
import { useTheme }         from '../context/ThemeContext';
import NotificationsCenter  from './NotificationsCenter';

function formatRelativeTime(ts) {
  if (!ts) return null;
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 10)  return 'just now';
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function Ribbon({ sessionUser, onLogout, onSync, onSearchOpen, lastSynced, dataMatrix }) {
  const { theme, toggleTheme } = useTheme();
  const [syncLabel,    setSyncLabel]    = useState(null);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const notifRef = useRef(null);

  // Update "X min ago" label every 30s
  useEffect(() => {
    const update = () => setSyncLabel(formatRelativeTime(lastSynced));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastSynced]);

  const handleSync = async () => {
    setIsSyncing(true);
    try { await onSync(); } finally { setIsSyncing(false); }
  };

  const notifCount = (dataMatrix?.timesheets || []).filter(t => (t.status || '').toLowerCase().includes('waiting')).length
    + (dataMatrix?.compliance?.dailyDeficits ? 1 : 0)
    + (dataMatrix?.compliance?.weeklyDeficits ? 1 : 0);

  const stale = lastSynced && (Date.now() - lastSynced) > 2 * 60 * 60 * 1000;

  return (
    <header style={{
      padding: '0 28px',
      height: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(14,14,18,0.8)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      position: 'sticky', top: 0, zIndex: 900,
      flexShrink: 0,
    }}>

      {/* Left: search trigger */}
      <button
        onClick={onSearchOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '8px 16px',
          color: '#8e8e93', cursor: 'pointer', fontSize: '0.875rem',
          fontFamily: 'inherit', transition: 'all 0.15s',
          width: '280px',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      >
        <i className='bx bx-search' />
        <span>Search projects, employees…</span>
        <kbd style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', fontSize: '0.72rem', fontFamily: 'monospace' }}>⌃K</kbd>
      </button>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>

        {/* Freshness indicator */}
        {syncLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: stale ? '#ffd60a' : '#8e8e93' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: stale ? '#ffd60a' : '#30d158' }} />
            {stale ? 'Data may be outdated' : `Synced ${syncLabel}`}
          </div>
        )}

        {/* Sync button */}
        <button
          onClick={handleSync}
          title="Sync data (Ctrl+R)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '7px 14px',
            color: '#fff', cursor: 'pointer', fontSize: '0.82rem',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <i className={`bx bx-refresh${isSyncing ? ' bx-spin' : ''}`} />
          <span style={{ display: window.innerWidth > 900 ? 'inline' : 'none' }}>Sync</span>
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.08)' }} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#8e8e93', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8e8e93'; }}
        >
          <i className={`bx ${theme === 'dark' ? 'bx-sun' : 'bx-moon'}`} />
        </button>

        {/* Notifications bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#8e8e93', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', transition: 'all 0.15s', position: 'relative',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8e8e93'; }}
          >
            <i className='bx bx-bell' />
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: '4px', right: '4px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: '#ff3b30', color: '#fff',
                fontSize: '0.6rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
          <NotificationsCenter
            dataMatrix={dataMatrix}
            isOpen={notifOpen}
            onClose={() => setNotifOpen(false)}
          />
        </div>
      </div>
    </header>
  );
}
