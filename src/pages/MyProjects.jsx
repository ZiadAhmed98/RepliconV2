import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Read-only view of the projects a user is assigned to. Always accessible — no
// permission required — so people without the admin "Projects" grant can still
// see and explore their own work. All mutating actions live on the admin pages.

const STATUS_META = {
  tentative:   { label: 'Tentative',   color: '#fbbf24' },
  in_progress: { label: 'In Progress', color: '#60a5fa' },
  completed:   { label: 'Completed',   color: '#34d399' },
  on_hold:     { label: 'On Hold',     color: '#f59e0b' },
  archived:    { label: 'Archived',    color: '#6b7280' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444' },
};

const TASK_COLS = [
  { key: 'open',        label: 'To Do',       color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)' },
  { key: 'in_progress', label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' },
  { key: 'done',        label: 'Done',        color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.22)' },
];
const taskCol = (s) => (s === 'completed' || s === 'closed') ? 'done' : (s === 'in_progress' ? 'in_progress' : 'open');

function StatusPill({ status }) {
  const m = STATUS_META[status] || { label: status || 'Unknown', color: '#9ca3af' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {m.label}
    </span>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: '110px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px' }}>
      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || 'var(--text-main)' }}>{value}</div>
    </div>
  );
}

export default function MyProjects() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects,  setProjects]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [selectedId, setSelectedId] = useState(params.get('p') || null);

  const [detail,    setDetail]    = useState(null);
  const [tasks,     setTasks]     = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load my projects
  useEffect(() => {
    fetch('/api/v1/psa/projects?mine=true', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => (p.name || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
  }, [projects, search]);

  const effectiveId = (selectedId && projects.some(p => p.id === selectedId)) ? selectedId : (filtered[0]?.id || projects[0]?.id);

  // Load selected project detail + tasks
  useEffect(() => {
    if (!effectiveId) { setDetail(null); setTasks([]); return; }
    setDetailLoading(true);
    Promise.all([
      fetch(`/api/v1/psa/projects/${effectiveId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/psa/projects/${effectiveId}/tasks`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ])
      .then(([pd, td]) => { setDetail(pd?.project || null); setTasks(td?.tasks || []); })
      .catch(() => { setDetail(null); setTasks([]); })
      .finally(() => setDetailLoading(false));
  }, [effectiveId]);

  const selectProject = (id) => { setSelectedId(id); setParams(id ? { p: id } : {}, { replace: true }); };

  const byCol = useMemo(() => ({
    open:        tasks.filter(t => taskCol(t.status) === 'open'),
    in_progress: tasks.filter(t => taskCol(t.status) === 'in_progress'),
    done:        tasks.filter(t => taskCol(t.status) === 'done'),
  }), [tasks]);

  const burn = detail && detail.budgetHours > 0 ? Math.round((detail.actualHours / detail.budgetHours) * 100) : null;

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
        <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
          <i className='bx bx-folder' style={{ color: '#818cf8', marginRight: '10px' }} />My Projects
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          The projects you're assigned to — read-only overview of scope, progress, and tasks.
        </p>
      </div>

      {projects.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <i className='bx bx-folder-open' style={{ fontSize: '34px', display: 'block', marginBottom: '10px', opacity: 0.3 }} />
          You're not assigned to any projects yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px', alignItems: 'start' }}>

          {/* Left: project list */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'relative' }}>
                <i className='bx bx-search' style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '15px' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '6px' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem' }}>No matches</div>
              )}
              {filtered.map(p => {
                const active = p.id === effectiveId;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProject(p.id)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px',
                      padding: '10px 12px', borderRadius: '10px', marginBottom: '3px', cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(37,99,235,0.12))' : 'transparent',
                      border: `1px solid ${active ? 'rgba(139,92,246,0.35)' : 'transparent'}`,
                      transition: 'all 0.14s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: active ? '#fff' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>{p.clientName || 'No client'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: selected project detail */}
          <div>
            {detailLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '24px' }} />
              </div>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Project header card */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{detail.name}</h2>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>
                        {detail.code ? `${detail.code} · ` : ''}{detail.clientName || 'No client'}{detail.projectManagerName ? ` · PM: ${detail.projectManagerName}` : ''}
                      </div>
                    </div>
                    <StatusPill status={detail.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Stat label="Budget Hours"  value={Math.round(detail.budgetHours || 0)} />
                    <Stat label="Actual Hours"  value={Math.round(detail.actualHours || 0)} color="#818cf8" />
                    <Stat label="Burn"          value={burn != null ? `${burn}%` : '—'} color={burn >= 100 ? '#ef4444' : burn >= 85 ? '#f59e0b' : '#34d399'} />
                    <Stat label="Tasks"         value={tasks.length} />
                  </div>
                </div>

                {/* Read-only task board */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className='bx bx-list-check' style={{ color: '#a78bfa', fontSize: '16px' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Tasks</span>
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>No tasks on this project yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                      {TASK_COLS.map((col, ci) => (
                        <div key={col.key} style={{ padding: '12px 14px', borderRight: ci < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.color, boxShadow: `0 0 8px ${col.color}` }} />
                            <span style={{ fontSize: '0.67rem', fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                            {byCol[col.key].length > 0 && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: '10px', padding: '0 6px', lineHeight: '16px' }}>{byCol[col.key].length}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {byCol[col.key].length === 0 ? (
                              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.13)', fontStyle: 'italic' }}>—</div>
                            ) : byCol[col.key].map(t => (
                              <div key={t.id} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: '8px', padding: '8px 10px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                                  {t.estimatedHours > 0 && <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.3)' }}>{t.estimatedHours}h est.</span>}
                                  {(t.resources || []).length > 0 && (
                                    <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.3)' }}>
                                      <i className='bx bx-user' style={{ fontSize: '11px', verticalAlign: 'middle' }} /> {t.resources.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                Select a project to view its details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
