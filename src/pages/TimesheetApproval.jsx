import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../context/ToastContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_CFG = {
  not_submitted: { bg: 'rgba(234,179,8,0.12)',  color: '#fbbf24', label: 'Draft'     },
  submitted:     { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Submitted' },
  approved:      { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', label: 'Approved'  },
  rejected:      { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', label: 'Rejected'  },
};

const TABS = [
  { key: 'submitted', label: 'Awaiting Approval', color: '#818cf8' },
  { key: 'approved',  label: 'Approved',           color: '#4ade80' },
  { key: 'rejected',  label: 'Rejected',           color: '#f87171' },
  { key: 'all',       label: 'All',                color: 'rgba(255,255,255,0.4)' },
];

// ── Week display helper ────────────────────────────────────────────────────────

function fmtWeek(weekStart) {
  const d = new Date(weekStart + 'T12:00:00Z');
  const sun = new Date(d); sun.setUTCDate(d.getUTCDate() + 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} – ${sun.getUTCDate()} ${months[sun.getUTCMonth()]} ${sun.getUTCFullYear()}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Timesheet detail grid (read-only) ─────────────────────────────────────────

function TimesheetDetail({ ts }) {
  if (!ts.rows || ts.rows.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '12px 0' }}>No rows in this timesheet.</p>;
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ts.weekStart + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const colTotals = days.map(date =>
    ts.rows.reduce((s, r) => s + (r.hours?.[date] || 0), 0)
  );
  const grandTotal = colTotals.reduce((s, h) => s + h, 0);

  const cellStyle = { padding: '6px 8px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.5)', borderRight: '1px solid rgba(255,255,255,0.05)' };
  const hrStyle   = (h) => ({ ...cellStyle, color: h > 0 ? '#e2e8f0' : 'rgba(255,255,255,0.2)', fontWeight: h > 0 ? 600 : 400 });
  const thStyle   = { ...cellStyle, color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 600, background: 'rgba(255,255,255,0.02)', paddingTop: '10px', paddingBottom: '10px' };

  return (
    <div style={{ overflowX: 'auto' }}>
      {ts.rejectedReason && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
          <i className='bx bx-x-circle' style={{ color: '#f87171', fontSize: '15px', marginTop: '1px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#f87171', marginBottom: '2px' }}>Rejection Reason</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{ts.rejectedReason}</div>
          </div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <th style={{ ...thStyle, textAlign: 'left', width: '220px', paddingLeft: '12px' }}>Project / Task</th>
            {days.map((date, i) => (
              <th key={date} style={{ ...thStyle, minWidth: '52px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{DAY_NAMES[i]}</div>
                <div style={{ fontSize: '11px' }}>{date.slice(8)}</div>
              </th>
            ))}
            <th style={{ ...thStyle, color: '#c4b5fd', minWidth: '52px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {ts.rows.map((row, ri) => {
            const rowTotal = days.reduce((s, date) => s + (row.hours?.[date] || 0), 0);
            return (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={{ padding: '8px 12px', minWidth: '220px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {row.projectName || <span style={{ color: 'rgba(255,255,255,0.25)' }}>— No project —</span>}
                  </div>
                  {row.taskName && (
                    <div style={{ fontSize: '11px', color: 'rgba(167,139,250,0.7)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {row.taskName}
                    </div>
                  )}
                  {row.clientName && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>{row.clientName}</div>
                  )}
                </td>
                {days.map(date => {
                  const h    = row.hours?.[date] || 0;
                  const note = row.dayNotes?.[date];
                  return (
                    <td key={date} style={hrStyle(h)} title={note || undefined}>
                      {h > 0 ? h : '—'}
                      {note && <span style={{ display: 'block', fontSize: '8px', color: '#fbbf24', lineHeight: 1 }}>✎</span>}
                    </td>
                  );
                })}
                <td style={{ ...hrStyle(rowTotal), color: rowTotal > 0 ? '#c4b5fd' : 'rgba(255,255,255,0.15)', fontWeight: 700 }}>
                  {rowTotal > 0 ? rowTotal : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid rgba(255,255,255,0.08)' }}>
            <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Total</td>
            {colTotals.map((h, i) => (
              <td key={i} style={{ ...hrStyle(h), color: h > 0 ? '#a78bfa' : 'rgba(255,255,255,0.2)', fontWeight: 700, background: 'rgba(139,92,246,0.05)' }}>
                {h > 0 ? h : '—'}
              </td>
            ))}
            <td style={{ ...hrStyle(grandTotal), color: '#a78bfa', fontWeight: 800, background: 'rgba(139,92,246,0.08)' }}>
              {Math.round(grandTotal * 4) / 4}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Reject modal ──────────────────────────────────────────────────────────────

function RejectModal({ ts, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    await onConfirm(ts.id, reason.trim());
    setBusy(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'linear-gradient(160deg, rgba(18,18,28,0.98), rgba(12,12,20,0.99))', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='bx bx-x-circle' style={{ fontSize: '18px', color: '#f87171' }} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fafafa' }}>Reject Timesheet</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              {ts.employeeName} · {fmtWeek(ts.weekStart)}
            </div>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
          Reason for rejection <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Hours don't match project scope, please re-submit…"
          autoFocus
          rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={busy} style={{ padding: '8px 20px', borderRadius: '8px', background: busy ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimesheetApproval() {
  const { toast } = useToast();

  const [timesheets,  setTimesheets]  = useState([]);
  const [chain,       setChain]       = useState([]);   // configured sequential approval steps
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('submitted');
  const [empFilter,   setEmpFilter]   = useState('ALL');
  const [expandedId,  setExpandedId]  = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // ts object
  const [busy,        setBusy]        = useState({});   // { [id]: true }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/admin/psa/timesheets?status=all', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load timesheets');
      const { timesheets: data, approvalChain } = await r.json();
      setTimesheets(data || []);
      setChain(Array.isArray(approvalChain) ? approvalChain : []);
    } catch (e) {
      toast('error', e.message || 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Summary counts
  const counts = useMemo(() => ({
    submitted: timesheets.filter(t => t.status === 'submitted').length,
    approved:  timesheets.filter(t => t.status === 'approved').length,
    rejected:  timesheets.filter(t => t.status === 'rejected').length,
  }), [timesheets]);

  // Employee list for filter
  const employees = useMemo(() => {
    const names = [...new Set(timesheets.map(t => t.employeeName))].sort();
    return names;
  }, [timesheets]);

  // Filtered list
  const filtered = useMemo(() => {
    return timesheets.filter(ts => {
      if (activeTab !== 'all' && ts.status !== activeTab) return false;
      if (empFilter !== 'ALL' && ts.employeeName !== empFilter) return false;
      return true;
    });
  }, [timesheets, activeTab, empFilter]);

  // Actions
  const handleApprove = async (id) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const r = await fetch(`/api/v1/admin/psa/timesheets/${id}/approve`, { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      // In a sequential chain an approve may only advance a step, not finalise.
      setTimesheets(prev => prev.map(ts => ts.id === id
        ? { ...ts, status: d.status || 'approved', approvalStep: d.approvalStep ?? ts.approvalStep, rejectedReason: null, updatedAt: new Date().toISOString() }
        : ts));
      toast('success', d.status === 'approved' ? 'Timesheet approved' : `Step approved — moved to step ${(d.approvalStep ?? 0) + 1}`);
    } catch (e) {
      toast('error', e.message);
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  const handleRejectConfirm = async (id, reason) => {
    try {
      const r = await fetch(`/api/v1/admin/psa/timesheets/${id}/reject`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      setTimesheets(prev => prev.map(ts => ts.id === id ? { ...ts, status: 'rejected', rejectedReason: reason || null, updatedAt: new Date().toISOString() } : ts));
      setRejectModal(null);
      toast('success', 'Timesheet rejected');
    } catch (e) {
      toast('error', e.message);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='bx bx-check-double' style={{ fontSize: '20px', color: '#a78bfa' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fafafa', letterSpacing: '-0.02em' }}>Timesheet Approval</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Review and approve team timesheet submissions</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Awaiting Approval', value: counts.submitted, color: '#818cf8', icon: 'bx-time-five',     bg: 'rgba(99,102,241,0.08)'  },
          { label: 'Approved',          value: counts.approved,  color: '#4ade80', icon: 'bx-check-circle',  bg: 'rgba(34,197,94,0.08)'   },
          { label: 'Rejected',          value: counts.rejected,  color: '#f87171', icon: 'bx-x-circle',      bg: 'rgba(239,68,68,0.08)'   },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`bx ${card.icon}`} style={{ fontSize: '20px', color: card.color }} />
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            const cnt = tab.key === 'all' ? timesheets.length : counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '12px', fontWeight: active ? 700 : 500,
                  background: active ? `${tab.color}20` : 'transparent',
                  color: active ? tab.color : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {tab.label}
                <span style={{ background: active ? `${tab.color}30` : 'rgba(255,255,255,0.08)', color: active ? tab.color : 'rgba(255,255,255,0.3)', borderRadius: '999px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Employee filter */}
        <select
          value={empFilter}
          onChange={e => setEmpFilter(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', padding: '7px 12px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <option value="ALL">All Employees</option>
          {employees.map(name => <option key={name} value={name}>{name}</option>)}
        </select>

        <button
          onClick={fetchAll}
          style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className='bx bx-refresh' style={{ fontSize: '14px' }} />
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
          <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px', display: 'block', marginBottom: '10px' }} />
          Loading timesheets…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.25)' }}>
          <i className='bx bx-calendar-x' style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }} />
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No timesheets found</div>
          <div style={{ fontSize: '13px' }}>Try a different tab or employee filter</div>
        </div>
      ) : (
        <div className="surface" style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 80px 90px 130px 130px', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', background: 'rgba(255,255,255,0.02)' }}>
            {['Employee', 'Week', 'Hours', 'Status', 'Submitted', 'Actions'].map(h => (
              <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Hours' || h === 'Actions' ? 'center' : 'left' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map(ts => {
            const expanded = expandedId === ts.id;
            const cfg      = STATUS_CFG[ts.status] || STATUS_CFG.not_submitted;
            const isBusy   = !!busy[ts.id];

            return (
              <div key={ts.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Main row */}
                <div
                  onClick={() => setExpandedId(expanded ? null : ts.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 180px 80px 90px 130px 130px', gap: 0, padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s', background: expanded ? 'rgba(139,92,246,0.05)' : 'transparent' }}
                  onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Employee */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                      {(ts.employeeName || ts.userId || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{ts.employeeName || ts.userId}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{ts.rows?.length || 0} row{ts.rows?.length !== 1 ? 's' : ''}</div>
                    </div>
                    <i className={`bx bx-chevron-${expanded ? 'up' : 'down'}`} style={{ fontSize: '16px', color: 'rgba(255,255,255,0.25)', marginLeft: '6px' }} />
                  </div>

                  {/* Week */}
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}>{fmtWeek(ts.weekStart)}</div>

                  {/* Hours (with overtime split when the Overtime Rules setting flags OT) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2 }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#c4b5fd' }}>{ts.totalHours}</span>
                    {ts.overtimeHours > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#fbbf24', marginTop: '2px' }} title="Overtime beyond the weekly threshold">
                        +{ts.overtimeHours} OT
                      </span>
                    )}
                  </div>

                  {/* Status (+ sequential chain progress when applicable) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: '6px', padding: '3px 9px', fontSize: '11px', fontWeight: 600 }}>{cfg.label}</span>
                    {chain.length > 0 && ts.status === 'submitted' && (
                      <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600 }} title="Sequential approval progress">
                        Step {Math.min((ts.approvalStep || 0) + 1, chain.length)}/{chain.length}
                        {chain[Math.min(ts.approvalStep || 0, chain.length - 1)]?.label ? ` · ${chain[Math.min(ts.approvalStep || 0, chain.length - 1)].label}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Submitted date */}
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>
                    {ts.status !== 'not_submitted' ? fmtDate(ts.updatedAt) : '—'}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    {ts.status === 'submitted' && (
                      <>
                        <button
                          onClick={() => handleApprove(ts.id)}
                          disabled={isBusy}
                          title="Approve"
                          style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: isBusy ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '12px', fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background 0.15s' }}
                          onMouseEnter={e => { if (!isBusy) e.currentTarget.style.background = 'rgba(34,197,94,0.35)'; }}
                          onMouseLeave={e => { if (!isBusy) e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; }}
                        >
                          <i className='bx bx-check' style={{ fontSize: '14px' }} />
                          {isBusy ? '…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setRejectModal(ts)}
                          disabled={isBusy}
                          title="Reject"
                          style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background 0.15s' }}
                          onMouseEnter={e => { if (!isBusy) e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                          onMouseLeave={e => { if (!isBusy) e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                        >
                          <i className='bx bx-x' style={{ fontSize: '14px' }} />
                          Reject
                        </button>
                      </>
                    )}
                    {ts.status === 'approved' && (
                      <span style={{ fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className='bx bxs-check-circle' style={{ fontSize: '14px' }} /> Approved
                      </span>
                    )}
                    {ts.status === 'rejected' && (
                      <button
                        onClick={() => handleApprove(ts.id)}
                        disabled={isBusy}
                        title="Override — approve anyway"
                        style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(34,197,94,0.2)', background: 'transparent', color: 'rgba(74,222,128,0.6)', fontSize: '11px', fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                      >
                        {isBusy ? '…' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ padding: '0 16px 20px', background: 'rgba(139,92,246,0.03)', borderTop: '1px solid rgba(139,92,246,0.1)' }}>
                    <div style={{ paddingTop: '16px' }}>
                      <TimesheetDetail ts={ts} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <RejectModal
          ts={rejectModal}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectModal(null)}
        />
      )}
    </div>
  );
}
