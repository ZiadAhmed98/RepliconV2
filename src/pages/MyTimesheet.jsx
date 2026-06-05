import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_STYLE = {
  not_submitted: { bg: 'rgba(234,179,8,0.1)',  color: '#fbbf24', label: 'Not Submitted' },
  submitted:     { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', label: 'Submitted'     },
  approved:      { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80', label: 'Approved'      },
  rejected:      { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', label: 'Rejected'      },
};

// ── ICS Parser ────────────────────────────────────────────────────────────────

function parseICS(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events   = [];
  const re       = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(unfolded)) !== null) {
    const block = m[1];
    const get = (key) => {
      const match = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'm'));
      return match ? match[1].trim() : null;
    };
    const rawStart = get('DTSTART');
    const rawEnd   = get('DTEND');
    const summary  = (get('SUMMARY') || 'Untitled').replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\\/g,'');
    if (!rawStart) continue;

    const parsedt = (s) => {
      if (!s) return null;
      if (/^\d{8}$/.test(s)) return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00`);
      const y=s.slice(0,4),mo=s.slice(4,6),d=s.slice(6,8),h=s.slice(9,11)||'00',mi=s.slice(11,13)||'00',sc=s.slice(13,15)||'00';
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sc}${s.endsWith('Z')?'Z':''}`);
    };
    const start = parsedt(rawStart);
    const end   = parsedt(rawEnd);
    if (!start || isNaN(start)) continue;
    const durMs  = end ? Math.max(0, end - start) : 3600000;
    const durH   = Math.max(0.5, Math.min(24, Math.round(durMs / 1800000) * 0.5));
    events.push({
      id:            `ics-${Math.random().toString(36).slice(2)}`,
      title:         summary,
      start,
      date:          toLocalDate(start),
      durationHours: durH,
      added:         false,
    });
  }
  return events;
}

// ── AI fuzzy match: event title → best task ───────────────────────────────────

function aiMatch(title, allProjects, allTasks) {
  const lower = title.toLowerCase();
  const words = lower.split(/[\s\-_/]+/).filter(w => w.length > 3);

  let bestTask = null, bestScore = 0;
  for (const t of allTasks) {
    const taskWords = t.name.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length > 2);
    const hits = taskWords.filter(w => lower.includes(w)).length;
    const score = hits / Math.max(taskWords.length, 1);
    if (score > bestScore) { bestScore = score; bestTask = t; }
  }
  if (bestTask && bestScore >= 0.4) {
    const proj = allProjects.find(p => p.id === bestTask.projectId);
    return { task: bestTask, project: proj, confidence: bestScore };
  }

  let bestProj = null, bestProjScore = 0;
  for (const p of allProjects) {
    const projWords = p.name.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length > 2);
    const hits = projWords.filter(w => lower.includes(w)).length;
    const score = hits / Math.max(projWords.length, 1);
    if (score > bestProjScore) { bestProjScore = score; bestProj = p; }
  }
  if (bestProj && bestProjScore >= 0.5) {
    const tasks = allTasks.filter(t => t.projectId === bestProj.id);
    return { task: tasks[0] || null, project: bestProj, confidence: 0.35 };
  }
  return null;
}

// ── TaskPicker ────────────────────────────────────────────────────────────────
// Single cascading client → project → task dropdown.
// Rendered via portal so it escapes overflow:auto table wrappers.

function TaskPicker({ value, allClients, allProjects, allTasks, onChange, disabled }) {
  const [open,    setOpen]    = useState(false);
  const [step,    setStep]    = useState('client'); // 'client' | 'project' | 'task'
  const [search,  setSearch]  = useState('');
  const [tempCli, setTempCli] = useState(null);
  const [tempPrj, setTempPrj] = useState(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    // Clamp so dropdown never overflows the right edge of the viewport
    const left = Math.min(r.left, window.innerWidth - 308);
    setDropPos({ top: r.bottom + 4, left: Math.max(4, left) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleClose = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  const openPicker = () => {
    if (disabled) return;
    if (value.clientId) {
      setTempCli({ id: value.clientId, name: value.clientName });
      if (value.projectId) {
        setTempPrj({ id: value.projectId, name: value.projectName });
        setStep('task');
      } else {
        setTempPrj(null);
        setStep('project');
      }
    } else {
      setTempCli(null); setTempPrj(null); setStep('client');
    }
    setSearch('');
    setOpen(true);
  };

  const pickClient  = (c) => { setTempCli(c); setTempPrj(null); setStep('project'); setSearch(''); };
  const pickProject = (p) => { setTempPrj(p); setStep('task'); setSearch(''); };
  const pickTask    = (t) => {
    onChange({
      clientId:    tempCli?.id   || null,
      clientName:  tempCli?.name || null,
      projectId:   tempPrj?.id   || null,
      projectName: tempPrj?.name || null,
      taskId:      t.id,
      taskName:    t.name,
    });
    setOpen(false);
  };
  const clearAll = (e) => {
    e.stopPropagation();
    onChange({ clientId: null, clientName: null, projectId: null, projectName: null, taskId: null, taskName: null });
  };

  const filt = (arr, key) => search
    ? arr.filter(x => (x[key] || '').toLowerCase().includes(search.toLowerCase()))
    : arr;

  const projList = filt(tempCli ? allProjects.filter(p => p.clientId === tempCli.id) : allProjects, 'name');

  // For the task step: exclude milestones entirely, keep summary tasks but make them non-clickable headers
  const rawTaskList = tempPrj ? allTasks.filter(t => t.projectId === tempPrj.id) : [];
  const taskList    = filt(rawTaskList.filter(t => t.description !== 'Milestone'), 'name');
  const isSummary   = (t) => t.description === 'Phase / Summary';

  const hasValue = !!value.projectId;

  // ── Dropdown content (shared between portal and inline) ───────────────────
  const dropdownContent = (
    <div ref={dropRef} style={{
      position: 'fixed',
      top:  `${dropPos.top}px`,
      left: `${dropPos.left}px`,
      zIndex: 9999,
      background: '#0d0d1a',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      width: '304px',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '400px',
    }}>
      {/* Breadcrumb + step label */}
      <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        {step !== 'client' && tempCli && (
          <button onClick={() => { setStep('client'); setTempPrj(null); setSearch(''); }}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '5px', padding: '2px 7px', cursor: 'pointer', color: '#818cf8', fontSize: '0.72rem', fontFamily: 'inherit' }}>
            {tempCli.name} ×
          </button>
        )}
        {step === 'task' && tempPrj && (
          <button onClick={() => { setStep('project'); setSearch(''); }}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '5px', padding: '2px 7px', cursor: 'pointer', color: '#818cf8', fontSize: '0.72rem', fontFamily: 'inherit' }}>
            {tempPrj.name} ×
          </button>
        )}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {step === 'client' ? '1. Client' : step === 'project' ? '2. Project' : '3. Task *'}
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '7px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${step}…`}
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 9px', color: 'var(--text-main)', fontSize: '0.8rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
      </div>

      {/* Scrollable items — fixed height, overflow: auto so it never grows the dropdown */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {step === 'client' && (
          <>
            {filt(allClients, 'name').map(c => (
              <div key={c.id} onClick={() => pickClient(c)}
                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {c.name}
              </div>
            ))}
            {filt(allClients, 'name').length === 0 && (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No clients</div>
            )}
          </>
        )}

        {step === 'project' && (
          <>
            {projList.map(p => (
              <div key={p.id} onClick={() => pickProject(p)}
                style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>{p.name}</div>
                {p.code && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.code}</div>}
              </div>
            ))}
            {projList.length === 0 && (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                No projects{tempCli ? ` for ${tempCli.name}` : ''}
              </div>
            )}
          </>
        )}

        {step === 'task' && (
          <>
            {/* Render tasks: summary tasks are non-clickable phase headers; milestones are already filtered out */}
            {taskList.filter(t => !t.parentTaskId).map(parent => {
              const subs = taskList.filter(t => t.parentTaskId === parent.id);
              if (isSummary(parent)) {
                // Phase/summary row — non-clickable header, children are the real tasks
                return (
                  <React.Fragment key={parent.id}>
                    <div style={{
                      padding: '6px 12px', background: 'rgba(99,102,241,0.06)',
                      fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      userSelect: 'none', borderBottom: '1px solid rgba(99,102,241,0.1)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <i className='bx bx-folder' style={{ fontSize: '0.85rem' }} />
                      {parent.name}
                    </div>
                    {subs.filter(s => !isSummary(s)).map(s => (
                      <div key={s.id} onClick={() => pickTask(s)}
                        style={{ padding: '8px 12px 8px 28px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>↳ {s.name}</span>
                        {s.estimatedHours > 0 && <span style={{ fontSize: '0.7rem', color: '#818cf8', flexShrink: 0, marginLeft: '8px' }}>{s.estimatedHours}h</span>}
                      </div>
                    ))}
                  </React.Fragment>
                );
              }
              // Regular top-level task — clickable, with any direct child tasks below it
              return (
                <React.Fragment key={parent.id}>
                  <div onClick={() => pickTask(parent)}
                    style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>{parent.name}</span>
                    {parent.estimatedHours > 0 && <span style={{ fontSize: '0.7rem', color: '#818cf8', flexShrink: 0, marginLeft: '8px' }}>{parent.estimatedHours}h</span>}
                  </div>
                  {subs.filter(s => !isSummary(s)).map(s => (
                    <div key={s.id} onClick={() => pickTask(s)}
                      style={{ padding: '7px 12px 7px 28px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>↳ {s.name}</span>
                      {s.estimatedHours > 0 && <span style={{ fontSize: '0.7rem', color: '#818cf8', flexShrink: 0, marginLeft: '8px' }}>{s.estimatedHours}h</span>}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
            {taskList.length === 0 && (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                {tempPrj ? `No tasks for ${tempPrj.name}` : 'No tasks'}<br />
                <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Add tasks in Admin → Projects</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} style={{ minWidth: 0 }}>
      {/* Trigger cell */}
      <div onClick={openPicker} style={{
        background: open ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${open ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '8px', padding: '7px 10px', cursor: disabled ? 'default' : 'pointer',
        minHeight: '64px', display: 'flex', flexDirection: 'column', gap: '2px',
        justifyContent: 'center', opacity: disabled ? 0.6 : 1, position: 'relative',
        transition: 'border-color 0.15s',
      }}>
        {hasValue ? (
          <>
            {value.clientName && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{value.clientName}</span>}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3 }}>{value.projectName}</span>
            {value.taskName
              ? <span style={{ fontSize: '0.75rem', color: '#818cf8', lineHeight: 1.2 }}>↳ {value.taskName}</span>
              : <span style={{ fontSize: '0.73rem', color: '#fbbf24', fontStyle: 'italic', lineHeight: 1.2 }}>Select a task…</span>
            }
            {!disabled && (
              <button onClick={clearAll}
                style={{ position: 'absolute', top: '4px', right: '5px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', padding: '1px 3px', lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>×</button>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            {disabled ? '—' : 'Select Client → Project → Task'}
          </span>
        )}
      </div>

      {/* Dropdown via portal — escapes overflow:auto table wrapper */}
      {open && createPortal(dropdownContent, document.body)}
    </div>
  );
}

// ── TimesheetRow ──────────────────────────────────────────────────────────────

// ── NoteCell — inline expandable "what I worked on" field ────────────────────
function NoteCell({ rowId, projectId, taskId, initialNote, readOnly }) {
  const [note,     setNote]     = useState(initialNote || '');
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const textareaRef = useRef(null);
  const saveTimer   = useRef(null);

  // Auto-resize textarea height to fit content
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [editing, note]);

  const saveNote = async (val) => {
    setSaving(true);
    try {
      await fetch(`/api/v1/psa/timesheet-rows/${rowId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, taskId, note: val }),
      });
    } finally { setSaving(false); }
  };

  const handleBlur = () => {
    setEditing(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(note), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setEditing(false); }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBlur(); }
  };

  if (readOnly) {
    return note ? (
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', padding: '4px 6px', lineHeight: 1.4, maxWidth: '140px', wordBreak: 'break-word' }}>
        "{note}"
      </div>
    ) : null;
  }

  if (editing) {
    return (
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          rows={2}
          style={{
            width: '140px', minHeight: '52px', resize: 'none', overflowY: 'hidden',
            background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.25)',
            borderRadius: '8px', padding: '6px 8px', color: 'var(--text-main)',
            fontSize: '0.78rem', fontFamily: 'inherit', lineHeight: 1.45,
            boxSizing: 'border-box', outline: 'none', display: 'block',
          }}
        />
        {saving && <span style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '0.62rem', color: 'rgba(250,204,21,0.5)' }}>saving…</span>}
      </div>
    );
  }

  // Collapsed state
  return note ? (
    <div onClick={() => setEditing(true)}
      title="Click to edit note"
      style={{
        cursor: 'pointer', maxWidth: '140px', padding: '4px 8px',
        background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.12)',
        borderRadius: '7px', display: 'flex', alignItems: 'flex-start', gap: '5px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(250,204,21,0.1)'; e.currentTarget.style.borderColor = 'rgba(250,204,21,0.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(250,204,21,0.05)'; e.currentTarget.style.borderColor = 'rgba(250,204,21,0.12)'; }}>
      <i className='bx bx-comment-detail' style={{ color: 'rgba(250,204,21,0.5)', fontSize: '0.8rem', marginTop: '1px', flexShrink: 0 }} />
      <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontStyle: 'italic' }}>
        {note}
      </span>
    </div>
  ) : (
    <button onClick={() => setEditing(true)}
      style={{
        background: 'none', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '7px',
        padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.18)',
        fontSize: '0.73rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(250,204,21,0.25)'; e.currentTarget.style.color = 'rgba(250,204,21,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.18)'; }}>
      <i className='bx bx-plus' style={{ fontSize: '0.8rem' }} /> note
    </button>
  );
}

// ── TimesheetRow ──────────────────────────────────────────────────────────────

function TimesheetRow({ row, dayKeys, allClients, allProjects, allTasks, readOnly, todayKey, onUpdate, onDelete }) {
  const [sel, setSel] = useState({
    clientId:    row.clientId    || null,
    clientName:  row.clientName  || null,
    projectId:   row.projectId   || null,
    projectName: row.projectName || null,
    taskId:      row.taskId      || null,
    taskName:    row.taskName    || null,
  });
  const [hours, setHours] = useState(() => {
    const h = {};
    dayKeys.forEach(dk => { h[dk] = row.hours?.[dk] != null ? String(row.hours[dk]) : ''; });
    return h;
  });
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  // Re-sync when row gets updated from parent (e.g. after addEventAsRow)
  useEffect(() => {
    setSel({
      clientId: row.clientId || null, clientName: row.clientName || null,
      projectId: row.projectId || null, projectName: row.projectName || null,
      taskId: row.taskId || null, taskName: row.taskName || null,
    });
    const h = {};
    dayKeys.forEach(dk => { h[dk] = row.hours?.[dk] != null ? String(row.hours[dk]) : ''; });
    setHours(h);
  }, [row.id]);

  const handlePickerChange = async (newSel) => {
    setSel(newSel);
    const r = await fetch(`/api/v1/psa/timesheet-rows/${row.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: newSel.projectId, taskId: newSel.taskId }),
    });
    if (r.ok) {
      const d = await r.json();
      const merged = { ...d.row, hours: getCurrentHoursObj() };
      onUpdate(merged);
    }
  };

  const getCurrentHoursObj = () => {
    const obj = {};
    dayKeys.forEach(dk => { const n = parseFloat(hours[dk]); if (!isNaN(n) && n > 0) obj[dk] = n; });
    return obj;
  };

  const saveHours = useCallback(async () => {
    if (!sel.projectId) return;
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
        const newH = {};
        dayKeys.forEach(dk => { newH[dk] = d.hours[dk] != null ? String(d.hours[dk]) : ''; });
        setHours(newH);
        onUpdate({ ...sel, id: row.id, hours: d.hours });
      }
    } finally { setSaving(false); }
  }, [sel.projectId, hours, dayKeys, row.id]);

  const handleHoursBlur = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveHours, 250);
  };

  const rowTotal = dayKeys.reduce((s, dk) => s + (parseFloat(hours[dk]) || 0), 0);

  const numStyle = (dk) => ({
    width: '52px', height: '34px', textAlign: 'center',
    background: dk === todayKey ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${dk === todayKey ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
    borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'inherit',
    opacity: (!sel.projectId || readOnly) ? 0.3 : 1,
  });

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '6px 8px' }}>
        <TaskPicker value={sel} allClients={allClients} allProjects={allProjects} allTasks={allTasks} onChange={handlePickerChange} disabled={readOnly} />
      </td>
      {/* Note cell */}
      <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
        <NoteCell rowId={row.id} projectId={sel.projectId} taskId={sel.taskId} initialNote={row.note || ''} readOnly={readOnly} />
      </td>
      {dayKeys.map(dk => (
        <td key={dk} style={{ padding: '6px 3px', textAlign: 'center', background: dk === todayKey ? 'rgba(99,102,241,0.03)' : 'transparent' }}>
          <input type="number" min="0" max="24" step="0.5"
            value={hours[dk]}
            onChange={e => setHours(h => ({ ...h, [dk]: e.target.value }))}
            onBlur={handleHoursBlur}
            disabled={!sel.projectId || readOnly}
            style={numStyle(dk)} />
        </td>
      ))}
      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: rowTotal > 0 ? '#818cf8' : 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '50px' }}>
        {rowTotal > 0 ? rowTotal.toFixed(2) : '—'}
      </td>
      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
        {!readOnly && (
          <button onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.4)', fontSize: '1.1rem', padding: '2px 5px', lineHeight: 1, borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.4)'}>×</button>
        )}
      </td>
    </tr>
  );
}

// ── Calendar Panel ────────────────────────────────────────────────────────────

function CalendarPanel({ dayKeys, weekDays, allProjects, allTasks, timesheet, onAddRow }) {
  const [events, setEvents]         = useState([]);
  const [calOpen, setCalOpen]       = useState(true);
  const [linkingId, setLinkingId]   = useState(null); // event being linked
  const [linkSel, setLinkSel]       = useState({ clientId:null,clientName:null,projectId:null,projectName:null,taskId:null,taskName:null });
  const [adding, setAdding]         = useState(false);
  const fileRef = useRef(null);
  const allClients = useMemo(() => {
    const seen = new Set();
    return allProjects.map(p => ({ id: p.clientId, name: p.clientName })).filter(c => c.id && !seen.has(c.id) && seen.add(c.id));
  }, [allProjects]);

  const handleICSFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseICS(e.target.result);
      // Only keep events that fall in this week
      const weekSet = new Set(dayKeys);
      const filtered = parsed.filter(ev => weekSet.has(ev.date));
      // AI-match each event
      const matched = filtered.map(ev => ({
        ...ev,
        match: aiMatch(ev.title, allProjects, allTasks),
      }));
      setEvents(prev => {
        // Merge: keep added-state for existing events, add new ones
        const prevMap = Object.fromEntries(prev.map(e => [e.id, e]));
        return matched.map(ev => ({ ...ev, added: prevMap[ev.id]?.added || false }));
      });
      setCalOpen(true);
    };
    reader.readAsText(file);
  };

  const handleAddEvent = async (ev) => {
    if (adding || !timesheet) return;
    setAdding(true);
    const suggestion = ev.match;
    try {
      // Create row with suggested project/task (if any)
      const rowRes = await fetch('/api/v1/psa/timesheet-rows', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: timesheet.id,
          projectId:   suggestion?.project?.id || null,
          taskId:      suggestion?.task?.id    || null,
          note:        ev.title,
        }),
      });
      const { row } = await rowRes.json();
      // Set hours for that day
      const hoursPayload = {};
      if (dayKeys.includes(ev.date)) hoursPayload[ev.date] = ev.durationHours;
      if (Object.keys(hoursPayload).length > 0) {
        const hRes = await fetch(`/api/v1/psa/timesheet-rows/${row.id}/hours`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: hoursPayload }),
        });
        const hd = await hRes.json();
        row.hours = hd.hours;
      } else {
        row.hours = {};
      }
      onAddRow(row);
      setEvents(evs => evs.map(e => e.id === ev.id ? { ...e, added: true } : e));
    } finally { setAdding(false); }
  };

  const handleAddWithLink = async (ev) => {
    if (!linkSel.projectId) return;
    if (adding || !timesheet) return;
    setAdding(true);
    try {
      const rowRes = await fetch('/api/v1/psa/timesheet-rows', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: timesheet.id,
          projectId:   linkSel.projectId,
          taskId:      linkSel.taskId || null,
          note:        ev.title,
        }),
      });
      const { row } = await rowRes.json();
      const hoursPayload = {};
      if (dayKeys.includes(ev.date)) hoursPayload[ev.date] = ev.durationHours;
      if (Object.keys(hoursPayload).length > 0) {
        const hRes = await fetch(`/api/v1/psa/timesheet-rows/${row.id}/hours`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: hoursPayload }),
        });
        const hd = await hRes.json();
        row.hours = hd.hours;
      } else { row.hours = {}; }
      onAddRow(row);
      setEvents(evs => evs.map(e => e.id === ev.id ? { ...e, added: true } : e));
      setLinkingId(null);
      setLinkSel({ clientId:null,clientName:null,projectId:null,projectName:null,taskId:null,taskName:null });
    } finally { setAdding(false); }
  };

  // Group events by date
  const grouped = useMemo(() => {
    const g = {};
    dayKeys.forEach(dk => { g[dk] = []; });
    events.forEach(ev => { if (g[ev.date]) g[ev.date].push(ev); });
    return g;
  }, [events, dayKeys]);

  const confColor = (c) => c >= 0.8 ? '#4ade80' : c >= 0.5 ? '#fbbf24' : 'rgba(156,163,175,0.7)';

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Calendar header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <button onClick={() => setCalOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.92rem', fontWeight: 700, padding: 0 }}>
          <i className={`bx bx-chevron-${calOpen ? 'down' : 'right'}`} style={{ fontSize: '1rem', color: '#818cf8' }} />
          <i className='bx bx-calendar' style={{ color: '#818cf8', fontSize: '1rem' }} />
          Calendar Events
          {events.length > 0 && (
            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '10px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
              {events.filter(e => !e.added).length} pending
            </span>
          )}
        </button>

        <button onClick={() => fileRef.current?.click()}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#818cf8', fontSize: '0.82rem', fontFamily: 'inherit', fontWeight: 500 }}>
          <i className='bx bx-calendar-plus' style={{ fontSize: '0.95rem' }} /> Import .ics
        </button>
        <input ref={fileRef} type="file" accept=".ics,text/calendar" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) { handleICSFile(e.target.files[0]); e.target.value = ''; } }} />
      </div>

      {calOpen && (
        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          {events.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <i className='bx bx-calendar' style={{ fontSize: '32px', display: 'block', marginBottom: '8px', opacity: 0.3 }} />
              Import a .ics file from your calendar to see events here.<br />
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Events are AI-matched to your projects and tasks automatically.</span>
            </div>
          ) : (
            dayKeys.map((dk, i) => {
              const dayEvents = grouped[dk] || [];
              if (dayEvents.length === 0) return null;
              const d = weekDays[i];
              return (
                <div key={dk}>
                  {/* Day header */}
                  <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', fontWeight: 700, color: dk === toLocalDate(new Date()) ? '#818cf8' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {DAY_NAMES[i]} {d.getUTCDate()} {MONTHS[d.getUTCMonth()]}
                  </div>
                  {dayEvents.map(ev => (
                    <div key={ev.id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: ev.added ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                      {/* Event info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <i className='bx bx-calendar-event' style={{ color: '#818cf8', fontSize: '0.9rem', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: ev.added ? 'var(--text-muted)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                          <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 6px', color: 'var(--text-muted)', flexShrink: 0 }}>{ev.durationHours}h</span>
                          {ev.added && <span style={{ fontSize: '0.7rem', color: '#4ade80', flexShrink: 0 }}>✓ Added</span>}
                        </div>
                        {/* AI match */}
                        {ev.match ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                            <span style={{ color: confColor(ev.match.confidence), flexShrink: 0 }}>
                              {ev.match.confidence >= 0.7 ? '✦ AI' : ev.match.confidence >= 0.4 ? '◈ AI' : '◇ AI'}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {ev.match.project?.name}
                              {ev.match.task ? ` › ${ev.match.task.name}` : ' (pick task)'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(156,163,175,0.5)' }}>◇ No match — select task manually</span>
                        )}
                      </div>

                      {/* Action */}
                      {!ev.added && (
                        <>
                          {linkingId === ev.id ? (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flexShrink: 0, flexDirection: 'column', minWidth: '230px' }}>
                              <TaskPicker value={linkSel} allClients={allClients} allProjects={allProjects} allTasks={allTasks} onChange={setLinkSel} />
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => handleAddWithLink(ev)} disabled={!linkSel.projectId || adding}
                                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', color: '#fff', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 600, opacity: (!linkSel.projectId || adding) ? 0.5 : 1 }}>
                                  Add
                                </button>
                                <button onClick={() => setLinkingId(null)}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'inherit' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              {ev.match?.task && (
                                <button onClick={() => handleAddEvent(ev)} disabled={adding}
                                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer', color: '#4ade80', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 600, opacity: adding ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                                  <i className='bx bx-check' /> Use suggestion
                                </button>
                              )}
                              <button onClick={() => { setLinkingId(ev.id); setLinkSel({ clientId:null,clientName:null,projectId:null,projectName:null,taskId:null,taskName:null }); }}
                                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer', color: '#818cf8', fontSize: '0.78rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                {ev.match?.task ? 'Change task' : 'Select task'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  }, [weekStart]);

  const dayKeys = useMemo(() => weekDays.map(d => d.toISOString().slice(0, 10)), [weekDays]);
  const todayKey = toLocalDate(new Date());

  const navigate = (delta) => {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const weekLabel = useMemo(() => {
    const s = weekDays[0], e = weekDays[6];
    const sm = MONTHS[s.getUTCMonth()], em = MONTHS[e.getUTCMonth()];
    const yr = s.getUTCFullYear();
    return sm === em ? `${sm} ${s.getUTCDate()} – ${e.getUTCDate()}, ${yr}` : `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}, ${yr}`;
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
      setAllProjects(pd.projects?.filter(p => p.status !== 'archived').map(p => ({
        ...p,
        // include clientName from clients list
        clientName: cd.clients?.find(c => c.id === p.clientId)?.name || null,
      })) || []);
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
        d.row.hours = {};
        setTimesheet(ts => ({ ...ts, rows: [...(ts.rows || []), d.row] }));
      }
    } finally { setAddingRow(false); }
  };

  const handleDeleteRow = async (rowId) => {
    const r = await fetch(`/api/v1/psa/timesheet-rows/${rowId}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) setTimesheet(ts => ({ ...ts, rows: ts.rows.filter(row => row.id !== rowId) }));
  };

  const handleRowUpdate = useCallback((updatedRow) => {
    setTimesheet(ts => ({
      ...ts,
      rows: ts.rows.map(r => r.id === updatedRow.id ? { ...r, ...updatedRow } : r),
    }));
  }, []);

  const handleCalendarRow = useCallback((newRow) => {
    setTimesheet(ts => ({ ...ts, rows: [...(ts.rows || []), newRow] }));
  }, []);

  const handleSubmit = async () => {
    if (!timesheet) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/v1/psa/timesheets/${timesheet.id}/submit`, { method: 'POST', credentials: 'include' });
      if (r.ok) { setTimesheet(ts => ({ ...ts, status: 'submitted' })); toast.success('Timesheet submitted for approval'); }
      else { const d = await r.json(); toast.error(d.error || 'Submit failed'); }
    } finally { setSubmitting(false); }
  };

  const colTotals = useMemo(() => {
    const t = {};
    dayKeys.forEach(dk => { t[dk] = (timesheet?.rows || []).reduce((s, row) => s + (parseFloat(row.hours?.[dk]) || 0), 0); });
    t._total = Object.values(t).reduce((s, v) => s + v, 0);
    return t;
  }, [timesheet?.rows, dayKeys]);

  const statusStyle = STATUS_STYLE[timesheet?.status] || STATUS_STYLE.not_submitted;
  const isSubmitted = timesheet?.status === 'submitted' || timesheet?.status === 'approved';

  const th = {
    padding: '10px 4px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '28px 36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate(-1)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.color='var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='var(--text-muted)'; }}>‹</button>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>{weekLabel}</h2>
          <button onClick={() => navigate(1)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.color='var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='var(--text-muted)'; }}>›</button>
          <button onClick={() => setWeekStart(toLocalDate(getMondayOf(new Date())))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(99,102,241,0.6)', fontSize: '0.75rem', fontFamily: 'inherit', textDecoration: 'underline' }}>
            This Week
          </button>
        </div>
        {!isSubmitted ? (
          <button onClick={handleSubmit} disabled={submitting || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: (submitting || loading) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            <i className='bx bx-send' style={{ fontSize: '1rem' }} />{submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        ) : (
          <span style={{ fontSize: '0.85rem', color: statusStyle.color }}><i className='bx bx-check-circle' style={{ marginRight: '6px' }} />Submitted</span>
        )}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ background: statusStyle.bg, color: statusStyle.color, borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>{statusStyle.label}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Due on {dueLabel}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Total: <strong style={{ color: colTotals._total > 0 ? '#818cf8' : 'var(--text-muted)' }}>{colTotals._total.toFixed(2)}h</strong>
        </span>
      </div>

      {/* Grid */}
      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '260px' }} />
                <col style={{ width: '160px' }} />
                {dayKeys.map(dk => <col key={dk} style={{ width: '64px' }} />)}
                <col style={{ width: '56px' }} /><col style={{ width: '34px' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: '10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Client / <span style={{ color: 'var(--text-main)' }}>Project</span> / Task *
                  </th>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: '6px', color: 'rgba(250,204,21,0.4)' }}>
                    <i className='bx bx-comment-detail' style={{ marginRight: '4px' }} />Note
                  </th>
                  {weekDays.map((d, i) => (
                    <th key={dayKeys[i]} style={{ ...th, background: dayKeys[i] === todayKey ? 'rgba(99,102,241,0.06)' : 'transparent', color: dayKeys[i] === todayKey ? '#818cf8' : 'var(--text-muted)', borderRadius: 0 }}>
                      {DAY_NAMES[i]}<br /><span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{d.getUTCDate()}</span>
                    </th>
                  ))}
                  <th style={{ ...th, textAlign: 'right', paddingRight: '8px' }}>Total</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {(timesheet?.rows || []).length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <i className='bx bx-time-five' style={{ fontSize: '30px', display: 'block', marginBottom: '8px', opacity: 0.3 }} />
                    No time entries yet — click <strong>+ Add Row</strong> or import from calendar below
                  </td></tr>
                )}
                {(timesheet?.rows || []).map(row => (
                  <TimesheetRow key={row.id} row={row} dayKeys={dayKeys} allClients={allClients} allProjects={allProjects} allTasks={allTasks} readOnly={isSubmitted} todayKey={todayKey} onUpdate={handleRowUpdate} onDelete={() => handleDeleteRow(row.id)} />
                ))}
                {!isSubmitted && (
                  <tr><td colSpan={11} style={{ padding: 0 }}>
                    <button onClick={handleAddRow} disabled={addingRow}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '11px 12px', cursor: 'pointer', color: 'rgba(99,102,241,0.65)', fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '5px' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.04)'; e.currentTarget.style.color='#818cf8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='rgba(99,102,241,0.65)'; }}>
                      <i className='bx bx-plus' style={{ fontSize: '0.95rem' }} />{addingRow ? 'Adding…' : '+ Add Row'}
                    </button>
                  </td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderTop: '2px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '11px 10px', fontWeight: 700, fontSize: '0.83rem', color: 'var(--text-main)' }}>Total Hours</td>
                  <td />
                  {dayKeys.map(dk => (
                    <td key={dk} style={{ padding: '11px 4px', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', color: colTotals[dk] > 0 ? '#818cf8' : 'var(--text-muted)', background: dk === todayKey ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                      {colTotals[dk] > 0 ? colTotals[dk].toFixed(2) : '0.00'}
                    </td>
                  ))}
                  <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.92rem', color: colTotals._total > 0 ? '#a78bfa' : 'var(--text-muted)' }}>
                    {colTotals._total.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Calendar Panel */}
      {!loading && (
        <CalendarPanel
          dayKeys={dayKeys}
          weekDays={weekDays}
          allProjects={allProjects}
          allTasks={allTasks}
          timesheet={timesheet}
          onAddRow={handleCalendarRow}
        />
      )}
    </div>
  );
}
