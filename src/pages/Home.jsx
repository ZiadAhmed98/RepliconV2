import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useToast }      from '../context/ToastContext';
import { ADMIN_PATH }    from '../config/adminRoutes';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_META = {
  azure:          { label: 'Azure',          color: '#60a5fa' },
  m365:           { label: 'M365',           color: '#818cf8' },
  maf_guide:      { label: 'MAF Guide',      color: '#34d399' },
  security:       { label: 'Security',       color: '#f87171' },
  networking:     { label: 'Networking',     color: '#fbbf24' },
  cloud:          { label: 'Cloud',          color: '#a78bfa' },
  general:        { label: 'General',        color: '#94a3b8' },
};

const STATUS_COLOR = {
  not_submitted: '#ef4444',
  draft:         '#fbbf24',
  submitted:     '#60a5fa',
  approved:      '#34d399',
  rejected:      '#f87171',
};

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function weekLabel(ws) {
  if (!ws) return '—';
  const d = new Date(ws + 'T00:00:00');
  const e = new Date(d); e.setDate(e.getDate() + 6);
  return `${d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} – ${e.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Shared UI pieces ─────────────────────────────────────────────────────────

function Card({ title, icon, accent = '#818cf8', count, onViewAll, to, nav, children, style = {} }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.3)',
      borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className={`bx ${icon}`} style={{ fontSize:'15px', color: accent }} />
          </div>
          <span style={{ fontSize:'0.84rem', fontWeight:700, color:'var(--text-main)' }}>{title}</span>
          {count > 0 && (
            <span style={{ minWidth:'20px', height:'20px', padding:'0 6px', borderRadius:'999px', background:`${accent}20`, color: accent, fontSize:'0.68rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${accent}30` }}>
              {count}
            </span>
          )}
        </div>
        {(to || onViewAll) && (
          <button
            onClick={() => to ? nav(to) : onViewAll()}
            style={{ background:'none', border:'none', color: accent, fontSize:'0.75rem', cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:'4px', padding:'4px 8px', borderRadius:'6px' }}
          >
            View all <i className='bx bx-chevron-right' style={{ fontSize:'14px' }} />
          </button>
        )}
      </div>
      <div style={{ flex:1 }}>
        {children}
      </div>
    </div>
  );
}

function StatChip({ label, value, color, onClick, urgent }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:'8px',
        padding:'8px 14px', borderRadius:'10px', cursor: onClick ? 'pointer' : 'default',
        background: urgent && value > 0 ? `${color}14` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${urgent && value > 0 ? `${color}35` : 'rgba(255,255,255,0.08)'}`,
        fontFamily:'inherit', transition:'all 0.15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = `${color}1c`)}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = urgent && value > 0 ? `${color}14` : 'rgba(255,255,255,0.04)')}
    >
      <span style={{ fontSize:'1.1rem', fontWeight:800, color: value > 0 ? color : 'rgba(255,255,255,0.3)' }}>{value}</span>
      <span style={{ fontSize:'0.76rem', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap' }}>{label}</span>
    </button>
  );
}

function EmptyRow({ text }) {
  return (
    <div style={{ padding:'20px 18px', textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'0.78rem' }}>{text}</div>
  );
}

// ── Resource view ─────────────────────────────────────────────────────────────

const TASK_STATUS_COLS = [
  { key: 'open',        label: 'To Do',       color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)'  },
  { key: 'in_progress', label: 'In Progress',  color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
  { key: 'done',        label: 'Done',         color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
];

function getWeekMonday() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function ResourceHome({ summary, sessionUser, nav, onRefresh }) {
  const { timesheet, projects, schedule, accessRequests, templates } = summary;
  const name = sessionUser?.displayName || sessionUser?.name || 'there';
  const { toast } = useToast();
  const [myTasks,     setMyTasks]     = useState([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [adding,      setAdding]      = useState({});

  useEffect(() => {
    fetch('/api/v1/psa/tasks?mine=true', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setMyTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setTaskLoading(false));
  }, []);

  const myTaskProjects = React.useMemo(() =>
    Object.values(myTasks.reduce((acc, t) => {
      if (t.projectId && !acc[t.projectId])
        acc[t.projectId] = { id: t.projectId, name: t.projectName || 'Unknown Project', clientName: t.clientName };
      return acc;
    }, {})),
  [myTasks]);

  const addToTimesheet = async (projectId, taskId, taskName) => {
    const key = `${projectId}-${taskId}`;
    if (adding[key]) return;
    setAdding(p => ({ ...p, [key]: true }));
    try {
      const weekStart = getWeekMonday();
      const tsRes = await fetch(`/api/v1/psa/timesheets?weekStart=${weekStart}`, { credentials: 'include' });
      const { timesheet: ts } = await tsRes.json();
      if (ts.status === 'submitted' || ts.status === 'approved') {
        toast.warning('This week is already submitted or approved');
        return;
      }
      const r = await fetch('/api/v1/psa/timesheet-rows', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetId: ts.id, projectId, taskId }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Failed to add'); return; }
      toast.success(`"${taskName}" added to your timesheet`);
    } catch { toast.error('Failed to add to timesheet'); }
    finally { setAdding(p => { const n = { ...p }; delete n[key]; return n; }); }
  };

  return (
    <div style={{ padding:'28px 32px' }}>

      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ margin:0, fontSize:'1.6rem', fontWeight:800, color:'var(--text-main)', letterSpacing:'-0.03em' }}>
          {greet()}, {name.split(' ')[0]}
        </h1>
        <p style={{ margin:'4px 0 0', fontSize:'0.83rem', color:'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      {/* Stat chips */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'24px' }}>
        <StatChip label="Overdue Timesheets" value={timesheet.overdueCount} color="#ef4444" urgent
          onClick={() => nav('/my-timesheet')} />
        <StatChip label="Pending Approval" value={timesheet.pendingCount} color="#60a5fa"
          onClick={() => nav('/my-timesheet')} />
        <StatChip label="My Projects" value={projects.length} color="#818cf8"
          onClick={() => nav('/projects-admin')} />
        <StatChip label="Access Requests" value={accessRequests.filter(r=>r.status==='pending').length} color="#fbbf24"
          onClick={() => nav('/projects-admin')} />
        <StatChip label="My Templates" value={templates.mine.length} color="#34d399"
          onClick={() => nav('/templates')} />
      </div>

      {/* Row 1: Timesheet | Projects | Schedule */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>

        {/* My Timesheet */}
        <Card title="My Timesheet" icon="bx-time-five" accent="#60a5fa"
          count={timesheet.overdueCount} to="/my-timesheet" nav={nav}>
          <div style={{ padding:'14px 16px 4px' }}>
            {/* Current week */}
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'6px' }}>Current Week</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-main)' }}>{weekLabel(summary.weekStart)}</div>
                  <div style={{ fontSize:'0.74rem', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>
                    {timesheet.current ? `${timesheet.current.totalHours}h logged` : 'No entries yet'}
                  </div>
                </div>
                {timesheet.current && (
                  <span style={{ padding:'3px 10px', borderRadius:'6px', fontSize:'0.68rem', fontWeight:700, background:`${STATUS_COLOR[timesheet.current.status]}18`, color:STATUS_COLOR[timesheet.current.status], border:`1px solid ${STATUS_COLOR[timesheet.current.status]}30`, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    {timesheet.current.status.replace('_',' ')}
                  </span>
                )}
                {!timesheet.current && (
                  <span style={{ padding:'3px 10px', borderRadius:'6px', fontSize:'0.68rem', fontWeight:700, background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)' }}>Not Started</span>
                )}
              </div>
            </div>

            {/* Overdue */}
            {timesheet.overdue.length > 0 && (
              <div>
                <div style={{ fontSize:'0.68rem', color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'6px' }}>
                  {timesheet.overdueCount} Overdue
                </div>
                {timesheet.overdue.slice(0,3).map(ts => (
                  <div key={ts.id} onClick={() => nav('/my-timesheet')}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:'7px', marginBottom:'3px', background:'rgba(239,68,68,0.06)', cursor:'pointer', border:'1px solid rgba(239,68,68,0.12)' }}>
                    <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.6)' }}>{weekLabel(ts.weekStart)}</span>
                    <span style={{ fontSize:'0.65rem', color:'#ef4444', fontWeight:600 }}>OVERDUE</span>
                  </div>
                ))}
              </div>
            )}
            {timesheet.overdue.length === 0 && (
              <div style={{ padding:'8px', textAlign:'center', color:'#34d399', fontSize:'0.78rem', background:'rgba(52,211,153,0.06)', borderRadius:'8px', border:'1px solid rgba(52,211,153,0.15)' }}>
                <i className='bx bx-check-circle' style={{ marginRight:'6px', verticalAlign:'middle' }} />
                All timesheets up to date
              </div>
            )}
          </div>
          <div style={{ padding:'10px 16px 14px' }}>
            <button onClick={() => nav('/my-timesheet')}
              style={{ width:'100%', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'8px', color:'#60a5fa', padding:'8px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
              Open My Timesheet →
            </button>
          </div>
        </Card>

        {/* My Projects */}
        <Card title="My Projects" icon="bx-folder-open" accent="#818cf8"
          count={projects.length} to="/projects-admin" nav={nav}>
          <div style={{ padding:'8px 6px' }}>
            {projects.length === 0 && <EmptyRow text="Not assigned to any projects yet" />}
            {projects.slice(0,5).map(p => (
              <div key={p.id} onClick={() => nav(`/projects-admin/${p.id}`)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', margin:'2px 0', transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-main)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>{p.clientName || 'No client'}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:'8px' }}>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color: p.hoursThisWeek > 0 ? '#818cf8' : 'rgba(255,255,255,0.2)' }}>
                    {p.hoursThisWeek > 0 ? `${p.hoursThisWeek}h` : '—'}
                  </div>
                  <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.25)' }}>this week</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* My Schedule */}
        <Card title="My Schedule" icon="bx-calendar-week" accent="#2dd4bf" to="/my-timesheet" nav={nav}>
          <div style={{ padding:'10px 14px' }}>
            {schedule.map(day => (
              <div key={day.date} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'7px 8px', borderRadius:'8px', marginBottom:'3px',
                background: day.isToday ? 'rgba(45,212,191,0.08)' : 'transparent',
                border: day.isToday ? '1px solid rgba(45,212,191,0.2)' : '1px solid transparent',
              }}>
                <div>
                  <div style={{ fontSize:'0.78rem', fontWeight: day.isToday ? 700 : 500, color: day.isWeekend ? 'rgba(255,255,255,0.2)' : day.isToday ? '#2dd4bf' : 'var(--text-main)' }}>
                    {day.dayName}
                  </div>
                  <div style={{ fontSize:'0.66rem', color:'rgba(255,255,255,0.25)' }}>
                    {new Date(day.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
                  </div>
                </div>
                {day.isWeekend ? (
                  <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.18)' }}>Not working</span>
                ) : day.hours > 0 ? (
                  <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#2dd4bf' }}>{day.hours}h</span>
                ) : (
                  <span style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.25)' }}>—</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2: Templates | Access Requests */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:'14px' }}>

        {/* Templates */}
        <Card title="Templates" icon="bx-file-blank" accent="#34d399" to="/templates" nav={nav}>
          <div style={{ padding:'14px 16px' }}>
            {/* My submissions */}
            {templates.mine.length > 0 && (
              <div style={{ marginBottom:'14px' }}>
                <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'8px' }}>My Submissions</div>
                {templates.mine.slice(0,3).map(t => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                    <span style={{ fontSize:'0.79rem', color:'var(--text-main)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0, marginLeft:'8px' }}>
                      <span style={{ fontSize:'0.62rem', padding:'2px 7px', borderRadius:'5px', background:`${CATEGORY_META[t.category]?.color || '#94a3b8'}18`, color:CATEGORY_META[t.category]?.color || '#94a3b8', border:`1px solid ${CATEGORY_META[t.category]?.color || '#94a3b8'}30` }}>
                        {CATEGORY_META[t.category]?.label || t.category}
                      </span>
                      <span style={{ fontSize:'0.62rem', padding:'2px 7px', borderRadius:'5px', background:`${STATUS_COLOR[t.status] || '#94a3b8'}15`, color:STATUS_COLOR[t.status] || '#94a3b8' }}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Browse recent approved */}
            <div>
              <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'8px' }}>Recently Approved</div>
              {templates.recent.length === 0 && <EmptyRow text="No approved templates yet" />}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                {templates.recent.slice(0,4).map(t => (
                  <div key={t.id}
                    style={{ flex:'1 1 calc(50% - 4px)', minWidth:'140px', padding:'10px 12px', borderRadius:'9px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', cursor: t.documentUrl ? 'pointer' : 'default' }}
                    onClick={() => t.documentUrl && window.open(t.documentUrl,'_blank')}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'0.6rem', padding:'1px 6px', borderRadius:'4px', background:`${CATEGORY_META[t.category]?.color || '#94a3b8'}18`, color:CATEGORY_META[t.category]?.color || '#94a3b8', fontWeight:700 }}>
                        {CATEGORY_META[t.category]?.label || t.category}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-main)', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                    <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.28)' }}>{t.submitterName}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => nav('/templates')}
              style={{ marginTop:'12px', width:'100%', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:'8px', color:'#34d399', padding:'8px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
              Browse & Submit Templates →
            </button>
          </div>
        </Card>

        {/* Access Requests */}
        <Card title="Project Requests" icon="bx-git-branch" accent="#fbbf24"
          count={accessRequests.filter(r=>r.status==='pending').length}>
          <div style={{ padding:'8px 6px' }}>
            {accessRequests.length === 0 && <EmptyRow text="No access requests yet" />}
            {accessRequests.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'8px', marginBottom:'3px' }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:'0.79rem', fontWeight:600, color:'var(--text-main)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.projectName}</div>
                  <div style={{ fontSize:'0.66rem', color:'rgba(255,255,255,0.3)' }}>{fmt(r.createdAt)}</div>
                </div>
                <span style={{ flexShrink:0, marginLeft:'8px', fontSize:'0.65rem', padding:'2px 8px', borderRadius:'6px', fontWeight:700,
                  background: r.status==='pending' ? 'rgba(250,191,36,0.12)' : r.status==='approved' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                  color: r.status==='pending' ? '#fbbf24' : r.status==='approved' ? '#34d399' : '#ef4444',
                }}>
                  {r.status}
                </span>
              </div>
            ))}
            <div style={{ padding:'10px 12px 4px' }}>
              <button onClick={() => nav('/projects-admin')}
                style={{ width:'100%', background:'rgba(250,191,36,0.08)', border:'1px solid rgba(250,191,36,0.2)', borderRadius:'8px', color:'#fbbf24', padding:'8px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                Browse Projects →
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* ── My Work ─────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
              <i className='bx bx-task' style={{ color: '#a78bfa', marginRight: '8px' }} />My Work
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Your assigned tasks — click + to add directly to this week's timesheet
            </p>
          </div>
          <button onClick={() => nav('/my-timesheet')}
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '9px', color: '#a78bfa', padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
            Open Timesheet →
          </button>
        </div>

        {taskLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.25)' }}>
            <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '24px' }} />
          </div>
        ) : myTasks.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <i className='bx bx-task' style={{ fontSize: '28px', display: 'block', marginBottom: '8px', opacity: 0.3 }} />
            No tasks assigned to you yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {myTaskProjects.map(proj => {
              const projTasks = myTasks.filter(t => t.projectId === proj.id);
              const byStatus  = {
                open:        projTasks.filter(t => t.status === 'open'),
                in_progress: projTasks.filter(t => t.status === 'in_progress'),
                done:        projTasks.filter(t => t.status === 'completed' || t.status === 'closed'),
              };
              return (
                <div key={proj.id} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
                  {/* Project header row */}
                  <div
                    style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                    onClick={() => nav(`/projects-admin/${proj.id}`)}
                  >
                    <i className='bx bx-folder' style={{ color: '#60a5fa', fontSize: '16px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{proj.name}</span>
                      {proj.clientName && <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>{proj.clientName}</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>{projTasks.length} task{projTasks.length !== 1 ? 's' : ''}</span>
                    <i className='bx bx-right-arrow-alt' style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }} />
                  </div>

                  {/* Kanban columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                    {TASK_STATUS_COLS.map((col, ci) => {
                      const colTasks = byStatus[col.key] || [];
                      return (
                        <div key={col.key} style={{ padding: '12px 14px', borderRight: ci < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.67rem', fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                            {colTasks.length > 0 && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: '10px', padding: '0 6px', lineHeight: '16px' }}>
                                {colTasks.length}
                              </span>
                            )}
                          </div>
                          {colTasks.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.13)', fontStyle: 'italic' }}>—</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {colTasks.map(task => {
                                const addKey   = `${proj.id}-${task.id}`;
                                const isAdding = !!adding[addKey];
                                return (
                                  <div key={task.id} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: '8px', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.name}
                                      </div>
                                      {task.estimatedHours > 0 && (
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>{task.estimatedHours}h est.</div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => addToTimesheet(proj.id, task.id, task.name)}
                                      disabled={isAdding}
                                      title="Add to this week's timesheet"
                                      style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', cursor: isAdding ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'all 0.15s', opacity: isAdding ? 0.5 : 1 }}
                                      onMouseEnter={e => { if (!isAdding) { e.currentTarget.style.background = 'rgba(167,139,250,0.3)'; e.currentTarget.style.transform = 'scale(1.1)'; } }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.15)'; e.currentTarget.style.transform = 'none'; }}
                                    >
                                      <i className={`bx ${isAdding ? 'bx-loader-alt bx-spin' : 'bx-plus'}`} style={{ fontSize: '12px' }} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {projTasks.length === 0 && (
                    <div style={{ padding: '6px 18px 14px', fontSize: '0.74rem', color: 'rgba(255,255,255,0.18)' }}>
                      No tasks assigned to you in this project yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────

function AdminHome({ summary, sessionUser, nav, onRefresh }) {
  const { admin, weekStart } = summary;
  const name = sessionUser?.displayName || sessionUser?.name || 'Admin';
  const [localRequests, setLocalRequests] = useState(admin?.projectAccessRequests || []);

  const reviewAccess = async (reqId, action) => {
    await fetch(`/api/v1/psa/project-access-requests/${reqId}`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action }),
    });
    setLocalRequests(prev => prev.filter(r => r.id !== reqId));
  };

  return (
    <div style={{ padding:'28px 32px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <h1 style={{ margin:0, fontSize:'1.6rem', fontWeight:800, color:'var(--text-main)', letterSpacing:'-0.03em' }}>
              {greet()}, {name.split(' ')[0]}
            </h1>
            <span style={{ padding:'3px 10px', borderRadius:'6px', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', color:'#a78bfa', fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>
              Admin
            </span>
          </div>
          <p style={{ margin:'4px 0 0', fontSize:'0.83rem', color:'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <button onClick={onRefresh}
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'9px', color:'rgba(255,255,255,0.5)', padding:'8px 14px', fontSize:'0.78rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
          <i className='bx bx-refresh' style={{ fontSize:'15px' }} />
          Refresh
        </button>
      </div>

      {/* Stat chips */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'24px' }}>
        <StatChip label="Pending Approvals" value={admin.timesheetApprovalCount} color="#ef4444" urgent onClick={() => nav('/timesheets-approval')} />
        <StatChip label="Project Requests"  value={admin.projectAccessCount}     color="#fbbf24" urgent onClick={() => nav('/projects-admin')} />
        <StatChip label="Template Reviews"  value={admin.templateReviewCount}    color="#818cf8" urgent onClick={() => nav('/templates')} />
        <StatChip label="Not Submitted"     value={admin.teamNotSubmitted.length} color="#f87171" urgent />
        <StatChip label="Active Employees"  value={admin.stats.activeEmployees}  color="#34d399" onClick={() => nav('/employees')} />
        <StatChip label="Active Projects"   value={admin.stats.activeProjects}   color="#60a5fa" onClick={() => nav('/projects-admin')} />
        <StatChip label="Active Clients"    value={admin.stats.activeClients}    color="#a78bfa" onClick={() => nav('/clients')} />
        <StatChip label="Submitted This Week" value={admin.stats.submittedThisWeek} color="#2dd4bf" />
      </div>

      {/* Row 1: Timesheet Approvals | Project Requests | Team Pulse */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>

        {/* Timesheet Approvals */}
        <Card title="Timesheet Approvals" icon="bx-check-double" accent="#ef4444"
          count={admin.timesheetApprovalCount} to="/timesheets-approval" nav={nav}>
          <div style={{ padding:'6px 0' }}>
            {admin.timesheetApprovals.length === 0 && <EmptyRow text="No timesheets waiting approval" />}
            {admin.timesheetApprovals.slice(0,6).map(ts => (
              <div key={ts.id} onClick={() => nav('/timesheets-approval')}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', cursor:'pointer', transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:'0.79rem', fontWeight:600, color:'var(--text-main)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ts.employeeName || ts.userId}
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>{weekLabel(ts.weekStart)}</div>
                </div>
                <div style={{ flexShrink:0, textAlign:'right', marginLeft:'8px' }}>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#60a5fa' }}>{ts.totalHours}h</div>
                  <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.25)' }}>logged</div>
                </div>
              </div>
            ))}
            {admin.timesheetApprovalCount > 6 && (
              <div style={{ padding:'8px 16px', fontSize:'0.74rem', color:'rgba(255,255,255,0.3)' }}>
                +{admin.timesheetApprovalCount - 6} more waiting
              </div>
            )}
          </div>
          <div style={{ padding:'10px 16px 14px' }}>
            <button onClick={() => nav('/timesheets-approval')}
              style={{ width:'100%', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', color:'#ef4444', padding:'8px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
              Review All Timesheets →
            </button>
          </div>
        </Card>

        {/* Project Access Requests */}
        <Card title="Project Access Requests" icon="bx-git-branch" accent="#fbbf24"
          count={localRequests.length}>
          <div style={{ padding:'6px 0' }}>
            {localRequests.length === 0 && <EmptyRow text="No pending access requests" />}
            {localRequests.slice(0,5).map(r => (
              <div key={r.id} style={{ padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-main)' }}>{r.employeeName}</div>
                    <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', marginTop:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>→ {r.projectName}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={() => reviewAccess(r.id,'approve')}
                    style={{ flex:1, padding:'5px', borderRadius:'6px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', color:'#34d399', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => reviewAccess(r.id,'reject')}
                    style={{ flex:1, padding:'5px', borderRadius:'6px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Team Pulse */}
        <Card title="Team Pulse" icon="bx-pulse" accent="#f87171"
          count={admin.teamNotSubmitted.length}>
          <div style={{ padding:'6px 0 4px' }}>
            <div style={{ padding:'8px 16px 6px', fontSize:'0.68rem', color:'rgba(255,255,255,0.35)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              Not submitted for {weekLabel(weekStart)}
            </div>
            {admin.teamNotSubmitted.length === 0 && (
              <div style={{ padding:'20px', textAlign:'center' }}>
                <i className='bx bx-check-circle' style={{ fontSize:'24px', color:'#34d399', display:'block', marginBottom:'6px' }} />
                <span style={{ fontSize:'0.78rem', color:'#34d399' }}>Everyone submitted this week!</span>
              </div>
            )}
            {admin.teamNotSubmitted.slice(0,8).map(e => (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 16px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'#f87171', flexShrink:0 }}>
                  {(e.firstName?.[0]||'?')}
                </div>
                <div>
                  <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-main)' }}>{e.displayName || `${e.firstName} ${e.lastName}`}</div>
                  {e.employeeId && <div style={{ fontSize:'0.64rem', color:'rgba(255,255,255,0.28)' }}>ID: {e.employeeId}</div>}
                </div>
              </div>
            ))}
            {admin.teamNotSubmitted.length > 8 && (
              <div style={{ padding:'6px 16px', fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>
                +{admin.teamNotSubmitted.length - 8} more
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Template Reviews | Activity | Quick Actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px' }}>

        {/* Template Reviews */}
        <Card title="Template Reviews" icon="bx-file-blank" accent="#818cf8"
          count={admin.templateReviewCount} to="/templates" nav={nav}>
          <div style={{ padding:'6px 0' }}>
            {admin.templateReviews.length === 0 && <EmptyRow text="No templates pending review" />}
            {admin.templateReviews.slice(0,4).map(t => (
              <div key={t.id} onClick={() => nav('/templates')}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', cursor:'pointer', transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:'0.79rem', fontWeight:600, color:'var(--text-main)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize:'0.66rem', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>by {t.submitterName} · {fmt(t.createdAt)}</div>
                </div>
                <span style={{ flexShrink:0, marginLeft:'8px', fontSize:'0.62rem', padding:'2px 7px', borderRadius:'5px', background:`${CATEGORY_META[t.category]?.color || '#94a3b8'}18`, color:CATEGORY_META[t.category]?.color || '#94a3b8', border:`1px solid ${CATEGORY_META[t.category]?.color || '#94a3b8'}30`, fontWeight:700 }}>
                  {CATEGORY_META[t.category]?.label || t.category}
                </span>
              </div>
            ))}
          </div>
          <div style={{ padding:'10px 16px 14px' }}>
            <button onClick={() => nav('/templates')}
              style={{ width:'100%', background:'rgba(129,140,248,0.08)', border:'1px solid rgba(129,140,248,0.2)', borderRadius:'8px', color:'#818cf8', padding:'8px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
              Review Templates →
            </button>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" icon="bx-history" accent="#2dd4bf">
          <div style={{ padding:'6px 0' }}>
            {admin.recentActivity.length === 0 && <EmptyRow text="No recent activity" />}
            {admin.recentActivity.slice(0,6).map((a,i) => (
              <div key={i} style={{ display:'flex', gap:'10px', padding:'7px 16px', alignItems:'flex-start' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#2dd4bf', marginTop:'5px', flexShrink:0, opacity:0.6 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'0.76rem', color:'rgba(255,255,255,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <strong style={{ color:'rgba(255,255,255,0.85)' }}>{a.user}</strong> {a.action?.toLowerCase()?.replace(/_/g,' ')}
                  </div>
                  <div style={{ fontSize:'0.63rem', color:'rgba(255,255,255,0.25)', marginTop:'1px' }}>
                    {a.ts ? new Date(a.ts).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions" icon="bx-zap" accent="#a78bfa">
          <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {[
              { label:'Create Project',    icon:'bx-folder-plus',  color:'#818cf8', to:'/projects-admin'   },
              { label:'Add Client',        icon:'bx-building-house',color:'#34d399', to:'/clients'         },
              { label:'Manage Employees',  icon:'bx-group',         color:'#60a5fa', to:'/employees'        },
              { label:'Timesheet Approvals',icon:'bx-check-double', color:'#ef4444', to:'/timesheets-approval'},
              { label:'Audit Log',         icon:'bx-history',       color:'#2dd4bf', to: ADMIN_PATH.auditLog       },
              { label:'Replicon Migration',icon:'bx-cloud-download',color:'#fbbf24', to: ADMIN_PATH.migration      },
              { label:'Administration',    icon:'bx-shield-alt-2',  color:'#a78bfa', to: ADMIN_PATH.administration },
            ].map(a => (
              <button key={a.label} onClick={() => nav(a.to)}
                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'9px', background:`${a.color}0c`, border:`1px solid ${a.color}20`, cursor:'pointer', fontFamily:'inherit', transition:'all 0.14s', textAlign:'left', width:'100%' }}
                onMouseEnter={e => { e.currentTarget.style.background=`${a.color}18`; e.currentTarget.style.borderColor=`${a.color}40`; }}
                onMouseLeave={e => { e.currentTarget.style.background=`${a.color}0c`; e.currentTarget.style.borderColor=`${a.color}20`; }}
              >
                <i className={`bx ${a.icon}`} style={{ fontSize:'15px', color:a.color, flexShrink:0 }} />
                <span style={{ fontSize:'0.79rem', fontWeight:600, color:'var(--text-main)' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Home({ sessionUser }) {
  const nav = useNavigate();
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/v1/home/summary', { credentials:'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSummary(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'14px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <i className='bx bx-loader-alt' style={{ fontSize:'32px', color:'#818cf8', animation:'spin 0.9s linear infinite' }} />
      <span style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.84rem' }}>Loading your workspace…</span>
    </div>
  );

  if (error) return (
    <div style={{ padding:'40px', color:'#f87171', fontSize:'0.84rem' }}>
      Failed to load home summary: {error}
    </div>
  );

  const isAdmin = sessionUser?.isAdmin || ['pm','supervisor'].includes(sessionUser?.role);

  return isAdmin
    ? <AdminHome  summary={summary} sessionUser={sessionUser} nav={nav} onRefresh={load} />
    : <ResourceHome summary={summary} sessionUser={sessionUser} nav={nav} onRefresh={load} />;
}
