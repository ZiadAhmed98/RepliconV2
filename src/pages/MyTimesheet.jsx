import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '../context/ToastContext';

// ── Date helpers ──────────────────────────────────────────────────────────────

function toLocalDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_STYLE = {
  not_submitted: { bg: 'rgba(234,179,8,0.1)',  color: '#fbbf24', label: 'Not Submitted' },
  submitted:     { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', label: 'Submitted'     },
  approved:      { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80', label: 'Approved'      },
  rejected:      { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', label: 'Rejected'      },
};

// ── TimesheetRow ──────────────────────────────────────────────────────────────

function TimesheetRow({ row, dayKeys, allClients, allProjects, allTasks, readOnly, todayKey, onUpdate, onDelete }) {
  const { toast } = useToast();
  const [localRow, setLocalRow] = useState(row);
  const [hours,    setHours]    = useState(() => {
    const h = {};
    dayKeys.forEach(dk => { h[dk] = row.hours?.[dk] != null ? String(row.hours[dk]) : ''; });
    return h;
  });
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  // Sync project/task/client from parent (not hours — managed locally)
  useEffect(() => {
    setLocalRow(row);
  }, [row.projectId, row.taskId, row.clientId]);

  const filteredProjects = localRow.clientId
    ? allProjects.filter(p => p.clientId === localRow.clientId)
    : allProjects;

  const filteredTasks = localRow.projectId
    ? allTasks.filter(t => t.projectId === localRow.projectId && !t.parentTaskId)
    : [];

  const subTasksOf = (parentId) =>
    allTasks.filter(t => t.projectId === localRow.projectId && t.parentTaskId === parentId);

  const handleClientChange = async (newClientId) => {
    const updated = { ...localRow, clientId: newClientId || null, projectId: null, projectName: null, taskId: null, taskName: null };
    setLocalRow(updated);
    if (localRow.projectId) {
      await fetch(`/api/v1/psa/timesheet-rows/${row.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: null, taskId: null }),
      });
      onUpdate({ ...updated, hours: getCurrentHoursObj() });
    }
  };

  const handleProjectChange = async (newProjectId) => {
    const proj  = allProjects.find(p => p.id === newProjectId);
    const cId   = proj?.clientId || localRow.clientId || null;
    const cName = allClients.find(c => c.id === cId)?.name || localRow.clientName || null;
    const optimistic = { ...localRow, projectId: newProjectId || null, projectName: proj?.name || null, clientId: cId, clientName: cName, taskId: null, taskName: null };
    setLocalRow(optimistic);
    const r = await fetch(`/api/v1/psa/timesheet-rows/${row.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: newProjectId || null, taskId: null }),
    });
    if (r.ok) {
      const d = await r.json();
      const merged = { ...d.row, hours: getCurrentHoursObj() };
      setLocalRow(merged);
      onUpdate(merged);
    }
  };

  const handleTaskChange = async (newTaskId) => {
    const tk = allTasks.find(t => t.id === newTaskId);
    setLocalRow(prev => ({ ...prev, taskId: newTaskId || null, taskName: tk?.name || null }));
    const r = await fetch(`/api/v1/psa/timesheet-rows/${row.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: localRow.projectId, taskId: newTaskId || null }),
    });
    if (r.ok) {
      const d = await r.json();
      const merged = { ...d.row, hours: getCurrentHoursObj() };
      setLocalRow(merged);
      onUpdate(merged);
    }
  };

  function getCurrentHoursObj() {
    const obj = {};
    dayKeys.forEach(dk => {
      const n = parseFloat(hours[dk]);
      if (!isNaN(n) && n > 0) obj[dk] = n;
    });
    return obj;
  }

  const saveHours = useCallback(async () => {
    if (!localRow.projectId) return; // can't save without project
    setSaving(true);
    try {
      const payload = {};
      dayKeys.forEach(dk => { payload[dk] = parseFloat(hours[dk]) || 0; });
      const r = await fetch(`/api/v1/psa/timesheet-rows/${row.id}/hours`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: payload }),
      });
      if (r.ok) {
        const d = await r.json();
        const newHours = {};
        dayKeys.forEach(dk => { newHours[dk] = d.hours[dk] != null ? String(d.hours[dk]) : ''; });
        setHours(newHours);
        onUpdate({ ...localRow, hours: d.hours });
      }
    } finally { setSaving(false); }
  }, [localRow.projectId, hours, dayKeys, row.id]);

  const handleHoursChange = (dk, val) => {
    setHours(h => ({ ...h, [dk]: val }));
  };

  const handleHoursBlur = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveHours, 300);
  };

  const rowTotal = dayKeys.reduce((s, dk) => s + (parseFloat(hours[dk]) || 0), 0);
  const hasProject = !!localRow.projectId;

  const selStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 7px', color: 'var(--text-main)', fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer' };
  const numStyle = (dk) => ({
    width: '52px', height: '34px', textAlign: 'center',
    background: dk === todayKey ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${dk === todayKey ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'inherit',
    opacity: (!hasProject || readOnly) ? 0.35 : 1,
  });

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Project / task selectors */}
      <td style={{ padding: '8px 12px', minWidth: '260px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Client */}
          <select value={localRow.clientId || ''} onChange={e => handleClientChange(e.target.value)} disabled={readOnly} style={selStyle}>
            <option value="">— Client —</option>
            {allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Project */}
          <select value={localRow.projectId || ''} onChange={e => handleProjectChange(e.target.value)} disabled={readOnly}
            style={{ ...selStyle, fontWeight: localRow.projectId ? 600 : 400, color: localRow.projectId ? 'var(--text-main)' : 'var(--text-muted)' }}>
            <option value="">— Project * —</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
          </select>
          {/* Task — only shown once project is selected */}
          {hasProject && (
            <select value={localRow.taskId || ''} onChange={e => handleTaskChange(e.target.value)} disabled={readOnly}
              style={{ ...selStyle, fontSize: '0.76rem', color: localRow.taskId ? 'var(--text-muted)' : 'rgba(255,255,255,0.25)' }}>
              <option value="">— Task (optional) —</option>
              {filteredTasks.map(t => {
                const subs = subTasksOf(t.id);
                return (
                  <React.Fragment key={t.id}>
                    <option value={t.id}>{t.name}{t.code ? ` (${t.code})` : ''}</option>
                    {subs.map(s => <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                  </React.Fragment>
                );
              })}
            </select>
          )}
        </div>
      </td>

      {/* Hours per day */}
      {dayKeys.map(dk => (
        <td key={dk} style={{ padding: '8px 4px', textAlign: 'center' }}>
          <input
            type="number" min="0" max="24" step="0.5"
            value={hours[dk]}
            onChange={e => handleHoursChange(dk, e.target.value)}
            onBlur={handleHoursBlur}
            disabled={!hasProject || readOnly}
            style={numStyle(dk)}
          />
        </td>
      ))}

      {/* Row total */}
      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: rowTotal > 0 ? '#818cf8' : 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '54px' }}>
        {rowTotal > 0 ? rowTotal.toFixed(2) : '—'}
      </td>

      {/* Delete */}
      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
        {!readOnly && (
          <button onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.45)', fontSize: '1.1rem', padding: '2px 5px', lineHeight: 1, borderRadius: '4px', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.45)'}>
            ×
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyTimesheet() {
  const { toast } = useToast();

  const [weekStart,   setWeekStart]   = useState(() => toLocalDate(getMondayOf(new Date())));
  const [timesheet,   setTimesheet]   = useState(null);
  const [allClients,  setAllClients]  = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allTasks,    setAllTasks]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [addingRow,   setAddingRow]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // Build the 7 UTC date objects for the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  }, [weekStart]);

  const dayKeys = useMemo(() => weekDays.map(d => d.toISOString().slice(0, 10)), [weekDays]);

  const todayKey = toLocalDate(new Date());

  // Week navigation helpers
  const navigate = (delta) => {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  // Week label: "Jun 1 – 7, 2026"
  const weekLabel = useMemo(() => {
    const s = weekDays[0], e = weekDays[6];
    const sm = MONTHS[s.getUTCMonth()], em = MONTHS[e.getUTCMonth()];
    const yr = s.getUTCFullYear();
    return sm === em
      ? `${sm} ${s.getUTCDate()} – ${e.getUTCDate()}, ${yr}`
      : `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}, ${yr}`;
  }, [weekDays]);

  const dueLabel = `${MONTHS[weekDays[6].getUTCMonth()]} ${weekDays[6].getUTCDate()}, ${weekDays[6].getUTCFullYear()}`;

  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const [tsR, cR, pR, tR] = await Promise.all([
        fetch(`/api/v1/psa/timesheets?weekStart=${weekStart}`, { credentials: 'include' }),
        fetch('/api/v1/clients',                               { credentials: 'include' }),
        fetch('/api/v1/psa/projects',                          { credentials: 'include' }),
        fetch('/api/v1/psa/tasks',                             { credentials: 'include' }),
      ]);
      const [tsd, cd, pd, tkd] = await Promise.all([tsR.json(), cR.json(), pR.json(), tR.json()]);
      setTimesheet(tsd.timesheet);
      setAllClients(cd.clients?.filter(c => c.status === 'active') || []);
      setAllProjects(pd.projects?.filter(p => p.status !== 'archived') || []);
      setAllTasks(tkd.tasks || []);
    } finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const handleAddRow = async () => {
    if (!timesheet || addingRow) return;
    setAddingRow(true);
    try {
      const r = await fetch('/api/v1/psa/timesheet-rows', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetId: timesheet.id }),
      });
      if (r.ok) {
        const d = await r.json();
        setTimesheet(ts => ({ ...ts, rows: [...(ts.rows || []), d.row] }));
      } else {
        const d = await r.json();
        toast.error(d.error || 'Could not add row');
      }
    } finally { setAddingRow(false); }
  };

  const handleDeleteRow = async (rowId) => {
    const r = await fetch(`/api/v1/psa/timesheet-rows/${rowId}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) {
      setTimesheet(ts => ({ ...ts, rows: ts.rows.filter(row => row.id !== rowId) }));
    }
  };

  const handleRowUpdate = useCallback((updatedRow) => {
    setTimesheet(ts => ({
      ...ts,
      rows: ts.rows.map(r => r.id === updatedRow.id ? updatedRow : r),
    }));
  }, []);

  const handleSubmit = async () => {
    if (!timesheet) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/v1/psa/timesheets/${timesheet.id}/submit`, { method: 'POST', credentials: 'include' });
      if (r.ok) {
        setTimesheet(ts => ({ ...ts, status: 'submitted' }));
        toast.success('Timesheet submitted for approval');
      } else {
        const d = await r.json();
        toast.error(d.error || 'Submit failed');
      }
    } finally { setSubmitting(false); }
  };

  // Column totals
  const colTotals = useMemo(() => {
    const t = {};
    dayKeys.forEach(dk => {
      t[dk] = (timesheet?.rows || []).reduce((s, row) => s + (parseFloat(row.hours?.[dk]) || 0), 0);
    });
    t._total = Object.values(t).reduce((s, v) => s + v, 0);
    return t;
  }, [timesheet?.rows, dayKeys]);

  const statusStyle = STATUS_STYLE[timesheet?.status] || STATUS_STYLE.not_submitted;
  const isSubmitted = timesheet?.status === 'submitted' || timesheet?.status === 'approved';

  const th = {
    padding: '10px 6px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '28px 36px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            ‹
          </button>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{weekLabel}</h2>
          <button onClick={() => navigate(1)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            ›
          </button>
          <button onClick={() => setWeekStart(toLocalDate(getMondayOf(new Date())))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(99,102,241,0.6)', fontSize: '0.78rem', fontFamily: 'inherit', textDecoration: 'underline' }}>
            This Week
          </button>
        </div>

        {/* Submit button */}
        {!isSubmitted ? (
          <button onClick={handleSubmit} disabled={submitting || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '10px 22px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: (submitting || loading) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            <i className='bx bx-send' style={{ fontSize: '1rem' }} />
            {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        ) : (
          <span style={{ fontSize: '0.85rem', color: statusStyle.color }}>
            <i className='bx bx-check-circle' style={{ marginRight: '6px' }} />Submitted
          </span>
        )}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span style={{ background: statusStyle.bg, color: statusStyle.color, borderRadius: '8px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
          {statusStyle.label}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due on {dueLabel}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Total: <strong style={{ color: colTotals._total > 0 ? '#818cf8' : 'var(--text-muted)' }}>
            {colTotals._total.toFixed(2)}h
          </strong>
        </span>
      </div>

      {/* Time Distribution table */}
      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '270px' }} />
                {dayKeys.map(dk => <col key={dk} style={{ width: '68px' }} />)}
                <col style={{ width: '62px' }} />
                <col style={{ width: '36px' }} />
              </colgroup>

              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Client</span>
                    {' / '}
                    <span style={{ color: 'var(--text-main)' }}>Project</span>
                    {' / Task'}
                  </th>
                  {weekDays.map((d, i) => (
                    <th key={dayKeys[i]} style={{ ...th, background: dayKeys[i] === todayKey ? 'rgba(99,102,241,0.06)' : 'transparent', color: dayKeys[i] === todayKey ? '#818cf8' : 'var(--text-muted)' }}>
                      {DAY_NAMES[i]}<br /><span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{d.getUTCDate()}</span>
                    </th>
                  ))}
                  <th style={{ ...th, textAlign: 'right', paddingRight: '10px' }}>Total</th>
                  <th style={th} />
                </tr>
              </thead>

              <tbody>
                {(timesheet?.rows || []).length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      <i className='bx bx-time-five' style={{ fontSize: '32px', display: 'block', marginBottom: '10px', opacity: 0.35 }} />
                      No entries yet — click <strong>"+ Add Row"</strong> to start logging time
                    </td>
                  </tr>
                )}
                {(timesheet?.rows || []).map(row => (
                  <TimesheetRow
                    key={row.id}
                    row={row}
                    dayKeys={dayKeys}
                    allClients={allClients}
                    allProjects={allProjects}
                    allTasks={allTasks}
                    readOnly={isSubmitted}
                    todayKey={todayKey}
                    onUpdate={handleRowUpdate}
                    onDelete={() => handleDeleteRow(row.id)}
                  />
                ))}

                {/* ADD ROW */}
                {!isSubmitted && (
                  <tr>
                    <td colSpan={10} style={{ padding: '0' }}>
                      <button onClick={handleAddRow} disabled={addingRow}
                        style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', color: 'rgba(99,102,241,0.7)', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; e.currentTarget.style.color = '#818cf8'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(99,102,241,0.7)'; }}>
                        <i className='bx bx-plus' style={{ fontSize: '1rem' }} />
                        {addingRow ? 'Adding…' : '+ Add Row'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.025)', borderTop: '2px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Total Hours
                  </td>
                  {dayKeys.map(dk => (
                    <td key={dk} style={{ padding: '12px 4px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: colTotals[dk] > 0 ? '#818cf8' : 'var(--text-muted)', background: dk === todayKey ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                      {colTotals[dk] > 0 ? colTotals[dk].toFixed(2) : '0.00'}
                    </td>
                  ))}
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: colTotals._total > 0 ? '#a78bfa' : 'var(--text-muted)' }}>
                    {colTotals._total.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      {!loading && (
        <div style={{ marginTop: '14px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          <span><i className='bx bx-info-circle' style={{ marginRight: '4px' }} />Select a Project first, then optionally pick a Task. Hours save automatically when you leave a cell.</span>
          {allProjects.length === 0 && <span style={{ color: '#fbbf24' }}><i className='bx bx-error' style={{ marginRight: '4px' }} />No projects found — ask your admin to add projects via Admin → Projects.</span>}
        </div>
      )}
    </div>
  );
}
