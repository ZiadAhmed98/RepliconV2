import React, { useState, useEffect, useCallback, useRef } from 'react';
import { repliconApi } from '../api/replicon';
import { useToast } from '../context/ToastContext';

// ── Helpers ────────────────────────────────────────────────────────────────

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtWeekRange(monday) {
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

function fmtTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getDayKey(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toISOString().split('T')[0];
}

function getDaysOfWeek(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return d;
  });
}

const SOURCE_META = {
  calendar: { icon: 'bx-calendar',      label: 'Calendar', color: '#6366f1' },
  teams:    { icon: 'bx-video',          label: 'Teams',    color: '#5b5ea6' },
  ics:      { icon: 'bx-calendar-check', label: 'ICS',      color: '#8b5cf6' },
  manual:   { icon: 'bx-pencil',         label: 'Manual',   color: '#64748b' },
};

const CATEGORIES = ['meeting', 'development', 'admin', 'training', 'travel', 'other'];

const CONFIDENCE_COLOR = (c) => c >= 0.8 ? '#30d158' : c >= 0.5 ? '#ffd60a' : '#ff9f0a';

// crypto.randomUUID is HTTPS-only; this polyfill works over HTTP too
function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Entry Card ─────────────────────────────────────────────────────────────

function EntryCard({ entry, projects, onUpdate, onDelete, onCategorize }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ project: entry.project || '', client: entry.client || '', category: entry.category || 'other', hours: entry.hours || 0, notes: entry.notes || '' });
  const [categorizing, setCategorizing] = useState(false);
  const src = SOURCE_META[entry.source] || SOURCE_META.manual;

  const handleConfirm = () => {
    onUpdate({ ...entry, status: 'confirmed', project: form.project || null, client: form.client || null, category: form.category, hours: parseFloat(form.hours) || entry.hours, notes: form.notes });
    setEditing(false);
  };

  const handleAI = async () => {
    setCategorizing(true);
    try { await onCategorize(entry, (result) => {
      setForm(f => ({ ...f, project: result.project || f.project, client: result.client || f.client, category: result.category || f.category }));
    }); } finally { setCategorizing(false); }
  };

  const isConfirmed = entry.status === 'confirmed';

  return (
    <div style={{
      background: isConfirmed ? 'rgba(48,209,88,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isConfirmed ? 'rgba(48,209,88,0.25)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: src.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          <i className={`bx ${src.icon}`} style={{ color: src.color, fontSize: '14px' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{entry.title}</span>
            <span style={{ fontSize: '0.72rem', background: src.color + '22', color: src.color, borderRadius: '4px', padding: '1px 6px' }}>{src.label}</span>
            {isConfirmed && <span style={{ fontSize: '0.72rem', background: 'rgba(48,209,88,0.15)', color: '#30d158', borderRadius: '4px', padding: '1px 6px' }}>✓ Confirmed</span>}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {entry.startTime || entry.start ? <span><i className='bx bx-time-five' /> {fmtTime(entry.start || entry.startTime)}{entry.end ? ` – ${fmtTime(entry.end)}` : ''}</span> : null}
            <span><i className='bx bx-stopwatch' /> {entry.hours}h</span>
            {entry.project && <span style={{ color: '#a855f7' }}><i className='bx bx-folder' /> {entry.project}</span>}
            {entry.category && <span style={{ color: 'var(--text-sub)' }}><i className='bx bx-tag' /> {entry.category}</span>}
          </div>

          {/* AI suggestion bar */}
          {entry.aiConfidence != null && !isConfirmed && (
            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className='bx bx-brain' style={{ color: CONFIDENCE_COLOR(entry.aiConfidence) }} />
              <span style={{ color: CONFIDENCE_COLOR(entry.aiConfidence) }}>{Math.round(entry.aiConfidence * 100)}% confidence</span>
              {entry.aiReason && <span>— {entry.aiReason}</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {!isConfirmed && (
            <button onClick={handleAI} disabled={categorizing} title="AI suggest project" style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#a855f7', fontSize: '12px', fontFamily: 'inherit' }}>
              {categorizing ? <i className='bx bx-loader-alt bx-spin' /> : <i className='bx bx-brain' />}
            </button>
          )}
          <button onClick={() => setEditing(e => !e)} title="Edit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }}>
            <i className='bx bx-pencil' />
          </button>
          {!isConfirmed ? (
            <button onClick={handleConfirm} title="Confirm entry" style={{ background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.3)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#30d158', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600 }}>
              ✓ Confirm
            </button>
          ) : (
            <button onClick={() => onUpdate({ ...entry, status: 'pending' })} title="Unconfirm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }}>
              <i className='bx bx-undo' />
            </button>
          )}
          <button onClick={() => onDelete(entry.id)} title="Remove" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#ff3b30', fontSize: '12px' }}>
            <i className='bx bx-trash' />
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Project</label>
            <input list="project-list" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text-main)', fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <datalist id="project-list">{projects.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text-main)', fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hours</label>
            <input type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text-main)', fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text-main)', fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.83rem', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleConfirm} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '7px', padding: '6px 16px', cursor: 'pointer', color: '#fff', fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600 }}>Save & Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manual Entry Modal ─────────────────────────────────────────────────────

function AddEntryModal({ weekDays, projects, onAdd, onClose }) {
  const [form, setForm] = useState({ date: weekDays[0]?.toISOString().split('T')[0] || '', title: '', hours: 1, project: '', category: 'meeting', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px', padding: '28px', width: '440px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', color: 'var(--text-main)' }}><i className='bx bx-plus-circle' style={{ color: '#a855f7', marginRight: '8px' }} />Add Manual Entry</h3>
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Date</label>
            <select value={form.date} onChange={e => set('date', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }}>
              {weekDays.map(d => { const v = d.toISOString().split('T')[0]; return <option key={v} value={v}>{fmtDate(d.toISOString())}</option>; })}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Title / Description *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Project review, Client call…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Hours *</label>
              <input type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={e => set('hours', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Project</label>
            <input list="project-list-modal" value={form.project} onChange={e => set('project', e.target.value)} placeholder="Start typing or leave blank"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <datalist id="project-list-modal">{projects.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 18px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => { if (!form.title || !form.hours) return; onAdd(form); onClose(); }}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
            Add Entry
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MyTimesheet({ dataMatrix }) {
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [monday, setMonday]         = useState(() => getMondayOf(new Date()));
  const [entries, setEntries]       = useState([]);
  const [submitted, setSubmitted]   = useState(null);
  const [graphConfig, setGraphConfig] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [categorizing, setCategorizing] = useState(false);

  const weekStart = monday.toISOString().split('T')[0];
  const weekDays  = getDaysOfWeek(monday);

  // Extract project list from Replicon data for AI categorization
  const projectList = [...new Set((dataMatrix?.factTable || []).map(r => r.project).filter(Boolean))].sort();

  // ── Load saved entries ──
  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/timesheets/week?weekStart=${weekStart}`, { credentials: 'include' });
      const d = await r.json();
      setEntries(d.entries || []);
      setSubmitted(d.submitted || null);
    } catch { toast.error('Failed to load timesheet'); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  // ── Load Graph config ──
  useEffect(() => {
    fetch('/api/v1/graph/config', { credentials: 'include' })
      .then(r => r.json()).then(setGraphConfig).catch(() => {});
  }, []);

  // ── Save/update entry ──
  const saveEntry = useCallback(async (entry) => {
    try {
      const r = await fetch('/api/v1/timesheets/entry', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, entry }),
      });
      if (!r.ok) throw new Error(await r.text());
      setEntries(prev => {
        const idx = prev.findIndex(e => e.id === entry.id);
        return idx >= 0 ? prev.map((e, i) => i === idx ? { ...e, ...entry } : e) : [...prev, entry];
      });
    } catch (err) { toast.error('Save failed: ' + err.message); }
  }, [weekStart]);

  // ── Delete entry ──
  const deleteEntry = useCallback(async (id) => {
    try {
      await fetch(`/api/v1/timesheets/entry/${id}?weekStart=${weekStart}`, { method: 'DELETE', credentials: 'include' });
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry removed');
    } catch { toast.error('Delete failed'); }
  }, [weekStart]);

  // ── AI categorize one entry ──
  const categorizeEntry = useCallback(async (entry, onResult) => {
    try {
      const r = await fetch('/api/v1/ai/categorize', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: entry.title, hours: entry.hours, attendees: entry.attendees || [], source: entry.source, projectList }),
      });
      const result = await r.json();
      if (result.error) return;
      onResult(result);
      // Auto-save AI suggestions
      await saveEntry({ ...entry, aiConfidence: result.confidence, aiReason: result.reason, project: result.project || entry.project, client: result.client || entry.client, category: result.category || entry.category });
    } catch { toast.error('AI categorization failed'); }
  }, [projectList, saveEntry]);

  // ── AI categorize ALL pending ──
  const categorizeAll = useCallback(async () => {
    const pending = entries.filter(e => e.status !== 'confirmed' && !e.aiConfidence);
    if (!pending.length) { toast.info('All entries already categorized'); return; }
    setCategorizing(true);
    toast.info(`AI categorizing ${pending.length} entries…`);
    for (const entry of pending) {
      await categorizeEntry(entry, () => {});
      await new Promise(r => setTimeout(r, 400)); // gentle rate limit
    }
    setCategorizing(false);
    await loadWeek();
    toast.success('AI categorization complete');
  }, [entries, categorizeEntry, loadWeek]);

  // ── Import from Microsoft Graph ──
  const importFromGraph = useCallback(async () => {
    setImporting(true);
    try {
      const r = await fetch(`/api/v1/graph/calendar?weekStart=${weekStart}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Graph import failed'); return; }

      let added = 0;
      for (const ev of d.events || []) {
        const alreadyExists = entries.some(e => e.calEventId === ev.id);
        if (alreadyExists || ev.hours <= 0) continue;
        const entry = {
          id: genId(), date: getDayKey(ev.start),
          title: ev.title, source: ev.source, hours: ev.hours,
          start: ev.start, end: ev.end, attendees: ev.attendees,
          status: 'pending', calEventId: ev.id,
        };
        await saveEntry(entry);
        added++;
      }
      toast.success(`Imported ${added} new calendar events`);
      loadWeek();
    } finally { setImporting(false); }
  }, [weekStart, entries, saveEntry, loadWeek]);

  // ── Import from ICS file ──
  const importFromICS = useCallback(async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      // Send without weekStart — server returns ALL events from the file
      const r = await fetch('/api/v1/timesheets/import-ics', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icsText: text }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'ICS parse failed'); return; }

      let added = 0;
      const seen = new Set(entries.map(e => e.calEventId).filter(Boolean));
      for (const ev of d.events || []) {
        if (ev.hours <= 0 || seen.has(ev.id)) continue;
        seen.add(ev.id);
        // Compute the correct week for this event and save it there
        const evMonday = getMondayOf(new Date(ev.start));
        const evWeekStart = evMonday.toISOString().split('T')[0];
        await fetch('/api/v1/timesheets/entry', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekStart: evWeekStart, entry: {
            id: genId(), date: getDayKey(ev.start), title: ev.title,
            source: 'ics', hours: ev.hours, start: ev.start, end: ev.end,
            status: 'pending', calEventId: ev.id,
          }}),
        });
        added++;
      }
      toast.success(`Imported ${added} event${added !== 1 ? 's' : ''} from ICS file`);
      loadWeek();
    } catch (err) { toast.error('ICS import failed: ' + err.message); }
    finally { setImporting(false); fileRef.current.value = ''; }
  }, [weekStart, entries, loadWeek]);

  // ── Add manual entry ──
  const addManual = useCallback(async (form) => {
    const entry = {
      id: genId(), date: form.date, title: form.title,
      source: 'manual', hours: parseFloat(form.hours) || 1,
      project: form.project || null, category: form.category, notes: form.notes,
      status: 'pending',
    };
    await saveEntry(entry);
    toast.success('Entry added');
    loadWeek();
  }, [saveEntry, loadWeek]);

  // ── Submit week ──
  const submitWeek = useCallback(async () => {
    const confirmed = entries.filter(e => e.status === 'confirmed');
    if (!confirmed.length) { toast.warning('Confirm at least one entry before submitting'); return; }
    try {
      const r = await fetch('/api/v1/timesheets/submit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(`Week submitted — ${d.totalHours}h across ${d.entryCount} entries`);
      setSubmitted({ submittedAt: new Date().toISOString(), totalHours: d.totalHours, entryCount: d.entryCount });
    } catch { toast.error('Submit failed'); }
  }, [entries, weekStart]);

  // ── Group entries by day ──
  const byDay = weekDays.map(d => {
    const key = d.toISOString().split('T')[0];
    return { date: d, key, items: entries.filter(e => e.date === key).sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0)) };
  });

  const totalHours      = entries.reduce((s, e) => s + (e.hours || 0), 0);
  const confirmedHours  = entries.filter(e => e.status === 'confirmed').reduce((s, e) => s + (e.hours || 0), 0);
  const pendingCount    = entries.filter(e => e.status !== 'confirmed').length;

  // Project breakdown
  const byProject = {};
  entries.filter(e => e.project).forEach(e => { byProject[e.project] = (byProject[e.project] || 0) + e.hours; });

  return (
    <div style={{ padding: '32px 40px', maxWidth: '980px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <i className='bx bx-time-five' style={{ color: '#a855f7', marginRight: '10px' }} />My Timesheet
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {fmtWeekRange(monday)}
            {submitted && <span style={{ marginLeft: '10px', color: '#30d158', fontWeight: 600 }}>✓ Submitted {new Date(submitted.submittedAt).toLocaleDateString()}</span>}
          </p>
        </div>

        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => { const d = new Date(monday); d.setDate(d.getDate() - 7); setMonday(d); }}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <i className='bx bx-chevron-left' />
          </button>
          <button onClick={() => setMonday(getMondayOf(new Date()))}
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#a855f7', fontSize: '0.82rem', fontFamily: 'inherit' }}>
            This Week
          </button>
          <button onClick={() => { const d = new Date(monday); d.setDate(d.getDate() + 7); setMonday(d); }}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <i className='bx bx-chevron-right' />
          </button>
        </div>
      </div>

      {/* ── Import toolbar ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* ICS upload */}
        <input ref={fileRef} type="file" accept=".ics" style={{ display: 'none' }} onChange={e => importFromICS(e.target.files[0])} />
        <button onClick={() => fileRef.current.click()} disabled={importing}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 500 }}>
          <i className='bx bx-calendar-import' style={{ color: '#6366f1' }} />
          {importing ? 'Importing…' : 'Import .ics File'}
        </button>

        {/* Graph import (if configured) */}
        {graphConfig?.ready && (
          <button onClick={importFromGraph} disabled={importing}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', color: '#818cf8', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 500 }}>
            <i className='bx bx-cloud-download' />Live Calendar
          </button>
        )}

        {/* AI categorize all */}
        {pendingCount > 0 && (
          <button onClick={categorizeAll} disabled={categorizing}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', color: '#a855f7', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 500 }}>
            {categorizing ? <i className='bx bx-loader-alt bx-spin' /> : <i className='bx bx-brain' />}
            {categorizing ? 'Categorizing…' : `AI Categorize All (${pendingCount})`}
          </button>
        )}

        {/* Add manual */}
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '0.85rem', fontFamily: 'inherit' }}>
          <i className='bx bx-plus' />Add Manually
        </button>

        {/* ICS help tip */}
        {!graphConfig?.ready && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
            <i className='bx bx-info-circle' /> Export calendar from Outlook → File → Save Calendar → .ics
          </span>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total Hours',     val: totalHours.toFixed(1) + 'h',     color: 'var(--text-main)' },
          { label: 'Confirmed',       val: confirmedHours.toFixed(1) + 'h', color: '#30d158' },
          { label: 'Needs Review',    val: pendingCount,                     color: '#ffd60a' },
          { label: 'Projects',        val: Object.keys(byProject).length,   color: '#a855f7' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.val}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Days ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '24px' }} /></div>
      ) : (
        byDay.map(({ date, key, items }) => {
          const dayHours = items.reduce((s, e) => s + (e.hours || 0), 0);
          const isToday  = key === new Date().toISOString().split('T')[0];
          return (
            <div key={key} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isToday ? '#a855f7' : 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  {isToday && <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: 'rgba(168,85,247,0.2)', color: '#a855f7', borderRadius: '4px', padding: '1px 5px' }}>Today</span>}
                </span>
                {dayHours > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px 8px' }}>{dayHours.toFixed(1)}h</span>}
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>No entries — add one manually or import from calendar</div>
              ) : (
                items.map(entry => (
                  <EntryCard key={entry.id} entry={entry} projects={projectList}
                    onUpdate={saveEntry} onDelete={deleteEntry} onCategorize={categorizeEntry} />
                ))
              )}
            </div>
          );
        })
      )}

      {/* ── Project breakdown ── */}
      {Object.keys(byProject).length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginTop: '16px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hours by Project</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([proj, hrs]) => (
              <div key={proj} style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.83rem' }}>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>{hrs.toFixed(1)}h</span>
                <span style={{ color: 'var(--text-sub)', marginLeft: '6px' }}>{proj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Submit ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {submitted ? (
          <div style={{ color: '#30d158', fontSize: '0.9rem', fontWeight: 600 }}>
            <i className='bx bx-check-circle' style={{ marginRight: '6px' }} />
            Submitted {submitted.totalHours}h on {new Date(submitted.submittedAt).toLocaleDateString()}
          </div>
        ) : (
          <>
            <button onClick={submitWeek} disabled={!confirmedHours}
              style={{ background: confirmedHours ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '10px', padding: '11px 24px', cursor: confirmedHours ? 'pointer' : 'not-allowed', color: confirmedHours ? '#fff' : 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.01em' }}>
              <i className='bx bx-send' style={{ marginRight: '7px' }} />Submit Week ({confirmedHours.toFixed(1)}h confirmed)
            </button>
            {pendingCount > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} still need review</span>}
          </>
        )}
      </div>

      {/* ── Add modal ── */}
      {showAdd && <AddEntryModal weekDays={weekDays} projects={projectList} onAdd={addManual} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
