import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme }         from '../context/ThemeContext';
import { useSupport }       from '../context/SupportContext';
import NotificationsCenter  from './NotificationsCenter';

function relativeTime(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)   return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function Ribbon({ sessionUser, onLogout, onSync, onSearchOpen, lastSynced, dataMatrix }) {
  const { theme, toggleTheme } = useTheme();
  const { openTicket }         = useSupport();
  const [syncLabel, setSyncLabel] = useState(null);
  const [syncing,   setSyncing]   = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = !!location.state?.from;
  const backLabel = location.state?.fromLabel || 'Back';
  const notifRef = useRef(null);

  useEffect(() => {
    const update = () => setSyncLabel(relativeTime(lastSynced));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastSynced]);

  useEffect(() => {
    if (!notifOpen) return;
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen]);

  const handleSync = async () => {
    setSyncing(true);
    try { await onSync(); } finally { setSyncing(false); }
  };

  const stale = lastSynced && (Date.now() - lastSynced) > 2 * 60 * 60 * 1000;
  const notifCount = (dataMatrix?.timesheets || []).filter(t => (t.status || '').toLowerCase().includes('waiting')).length
    + (dataMatrix?.compliance?.dailyDeficits ? 1 : 0)
    + (dataMatrix?.compliance?.weeklyDeficits ? 1 : 0);

  const iconBtn = (onClick, icon, title, extra = {}) => (
    <button onClick={onClick} title={title} style={{
      width: '34px', height: '34px', borderRadius: '9px',
      background: 'rgba(255,255,255,0.045)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1rem', transition: 'all 0.15s', position: 'relative',
      ...extra,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.045)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      <i className={`bx ${icon}`} />
    </button>
  );

  return (
    <header style={{
      height: 'var(--ribbon-h, 58px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
      background: 'rgba(4,4,8,0.82)',
      backdropFilter: 'blur(32px) saturate(150%)',
      WebkitBackdropFilter: 'blur(32px) saturate(150%)',
      borderBottom: '1px solid rgba(255,255,255,0.055)',
      position: 'sticky', top: 0, zIndex: 900,
      flexShrink: 0,
    }}>

      {/* Left: back + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {canGoBack && (
          <button
            onClick={() => navigate(-1)}
            title={`Back to ${backLabel}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '9px', padding: '6px 12px',
              color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '13px', fontWeight: 500,
              transition: 'all 0.18s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = '#a78bfa'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          >
            <i className='bx bx-arrow-back' style={{ fontSize: '15px' }} />
            {backLabel}
          </button>
        )}
        <button onClick={onSearchOpen} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px', padding: '7px 14px',
          color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '13px', transition: 'all 0.18s',
          width: '220px',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <i className='bx bx-search' style={{ fontSize: '14px' }} />
          <span style={{ fontWeight: 400 }}>Search anything…</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
            {['⌃', 'K'].map((k, i) => (
              <kbd key={i} style={{
                padding: '1px 5px', borderRadius: '4px', fontSize: '10px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
              }}>{k}</kbd>
            ))}
          </div>
        </button>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>

        {/* Freshness badge */}
        {syncLabel && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '20px',
            background: stale ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${stale ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
            fontSize: '11px', color: stale ? '#f59e0b' : 'rgba(255,255,255,0.35)',
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: stale ? '#f59e0b' : '#10b981',
              boxShadow: stale ? '0 0 6px #f59e0b' : '0 0 6px #10b981',
              animation: !stale ? 'pulse 2s infinite' : 'none',
            }} />
            <span>{stale ? 'Data stale' : `${syncLabel}`}</span>
          </div>
        )}

        {/* Sync */}
        <button onClick={handleSync} title="Sync data (Ctrl+R)" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '9px', padding: '6px 12px',
          color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
          fontSize: '12px', fontFamily: 'inherit', fontWeight: 500,
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = '#a78bfa'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
        >
          <i className={`bx bx-refresh${syncing ? ' bx-spin' : ''}`} style={{ fontSize: '14px' }} />
          Sync
        </button>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

        {/* Help & support */}
        {iconBtn(() => openTicket(), 'bx-lifebuoy', 'Help & support')}

        {/* Theme */}
        {iconBtn(toggleTheme, theme === 'dark' ? 'bx-sun' : 'bx-moon', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`)}

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen(o => !o)} title="Notifications" style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: notifOpen ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.045)',
            border: `1px solid ${notifOpen ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: notifOpen ? '#a78bfa' : 'rgba(255,255,255,0.55)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', position: 'relative', transition: 'all 0.15s',
          }}>
            <i className='bx bx-bell' />
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: '5px', right: '5px',
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#ef4444', boxShadow: '0 0 6px #ef4444',
                animation: 'pulse 2s infinite',
              }} />
            )}
          </button>
          <NotificationsCenter dataMatrix={dataMatrix} isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }`}</style>
      </div>
    </header>
  );
}
