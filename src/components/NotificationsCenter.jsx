import React, { useMemo, useState, useEffect, useRef } from 'react';

function buildNotifications(dataMatrix) {
  if (!dataMatrix) return [];
  const notes = [];
  const { compliance, dimensionTable, timesheets, factTable } = dataMatrix;

  if (compliance?.dailyDeficits > 0) {
    notes.push({ id: 'daily-deficit', type: 'warning', title: 'Daily Compliance Alert', body: `${compliance.dailyDeficits} engineer${compliance.dailyDeficits > 1 ? 's' : ''} haven't logged hours today.`, icon: 'bx-time-five' });
  }
  if (compliance?.weeklyDeficits > 0) {
    notes.push({ id: 'weekly-deficit', type: 'warning', title: 'Weekly Compliance Alert', body: `${compliance.weeklyDeficits} engineer${compliance.weeklyDeficits > 1 ? 's' : ''} logged zero hours last week.`, icon: 'bx-calendar-x' });
  }

  const pending = (timesheets || []).filter(t => (t.status || '').toLowerCase().includes('waiting'));
  if (pending.length > 0) {
    notes.push({ id: 'pending-ts', type: 'info', title: 'Timesheets Pending', body: `${pending.length} timesheet${pending.length > 1 ? 's' : ''} waiting for your approval.`, icon: 'bx-check-double' });
  }

  const atRisk = Object.entries(dimensionTable || {}).filter(([, d]) => {
    const prog = (d.program || '').toLowerCase();
    if (!prog.includes('deployment')) return false;
    const actual = (factTable || []).filter(r => r.project === _p).reduce((s, r) => s + r.act, 0);
    return d.est > 0 && (actual / d.est) > 0.9;
  });
  if (atRisk.length > 0) {
    notes.push({ id: 'at-risk', type: 'error', title: 'Projects At Risk', body: `${atRisk.length} deployment project${atRisk.length > 1 ? 's' : ''} at >90% budget burn.`, icon: 'bx-error-circle' });
  }

  return notes;
}

const TYPE_COLORS = {
  info:    { bg: 'rgba(50,173,230,0.1)',  border: 'rgba(50,173,230,0.2)',  text: '#32ade6' },
  warning: { bg: 'rgba(255,214,10,0.1)', border: 'rgba(255,214,10,0.2)', text: '#ffd60a' },
  error:   { bg: 'rgba(255,59,48,0.1)',  border: 'rgba(255,59,48,0.2)',  text: '#ff3b30' },
  success: { bg: 'rgba(48,209,88,0.1)',  border: 'rgba(48,209,88,0.2)',  text: '#30d158' },
};

export default function NotificationsCenter({ dataMatrix, isOpen, onClose }) {
  const panelRef = useRef(null);

  const notifications = useMemo(() => {
    if (!dataMatrix) return [];
    const notes = [];
    const { compliance, timesheets } = dataMatrix;

    if ((compliance?.dailyDeficits || 0) > 0) {
      notes.push({ id: 'daily', type: 'warning', title: 'Daily Compliance Alert', body: `${compliance.dailyDeficits} engineer${compliance.dailyDeficits > 1 ? 's' : ''} haven't logged hours today.`, icon: 'bx-time-five', time: 'Just now' });
    }
    if ((compliance?.weeklyDeficits || 0) > 0) {
      notes.push({ id: 'weekly', type: 'warning', title: 'Weekly Compliance Alert', body: `${compliance.weeklyDeficits} engineer${compliance.weeklyDeficits > 1 ? 's' : ''} had zero hours last week.`, icon: 'bx-calendar-x', time: 'This week' });
    }

    const pending = (timesheets || []).filter(t => (t.status || '').toLowerCase().includes('waiting'));
    if (pending.length > 0) {
      notes.push({ id: 'pending', type: 'info', title: 'Pending Approvals', body: `${pending.length} timesheet${pending.length > 1 ? 's' : ''} waiting for approval.`, icon: 'bx-check-double', time: 'Today' });
    }

    const atRisk = Object.entries(dataMatrix.dimensionTable || {}).filter(([pName, d]) => {
      if (!(d.program || '').toLowerCase().includes('deployment')) return false;
      const actual = (dataMatrix.factTable || []).filter(r => r.project === pName).reduce((s, r) => s + r.act, 0);
      return d.est > 0 && actual / d.est > 0.9;
    });
    if (atRisk.length > 0) {
      notes.push({ id: 'risk', type: 'error', title: 'Projects At Risk', body: `${atRisk.length} deployment project${atRisk.length > 1 ? 's are' : ' is'} above 90% budget burn.`, icon: 'bx-error-circle', time: 'Today' });
    }

    return notes;
  }, [dataMatrix]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: '12px',
        width: '360px',
        background: 'rgba(20,20,24,0.97)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(40px)', zIndex: 2000, overflow: 'hidden',
      }}
    >
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>Notifications</span>
        <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}>{notifications.length} new</span>
      </div>
      {notifications.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#8e8e93', fontSize: '0.88rem' }}>
          <i className='bx bx-bell-off' style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.5 }} />
          All clear — no notifications
        </div>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {notifications.map(n => {
            const c = TYPE_COLORS[n.type] || TYPE_COLORS.info;
            return (
              <div key={n.id} style={{
                padding: '16px 20px', display: 'flex', gap: '12px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: c.bg, border: `1px solid ${c.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`bx ${n.icon}`} style={{ color: c.text, fontSize: '1.1rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', marginBottom: '3px' }}>{n.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#8e8e93', lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>{n.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
