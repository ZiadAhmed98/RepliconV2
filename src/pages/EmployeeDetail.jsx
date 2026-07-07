import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// Read-only profile of a single employee. Reachable by clicking any employee
// name across the app. Any signed-in user can view it (the API GET is auth-only);
// editing still lives on the admin Employees page.
export default function EmployeeDetail({ sessionUser }) {
  const { id }   = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back     = location.state?.from || '/employees';
  const backLbl  = location.state?.fromLabel || 'Employees';

  const [emp, setEmp]         = useState(null);
  const [roles, setRoles]     = useState([]);
  const [team, setTeam]       = useState([]);      // full directory (for supervisor + reports)
  const [projects, setProjects] = useState([]);    // projects they manage
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/employees/${id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/roles', { credentials: 'include' }).then(r => r.ok ? r.json() : { roles: [] }),
      fetch('/api/v1/employees?status=active', { credentials: 'include' }).then(r => r.ok ? r.json() : { employees: [] }),
      fetch(`/api/v1/psa/projects?pmId=${id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { projects: [] }),
    ]).then(([e, rl, tm, pj]) => {
      if (!alive) return;
      if (!e?.employee) { setNotFound(true); return; }
      setEmp(e.employee);
      setRoles(rl.roles || []);
      setTeam(tm.employees || []);
      setProjects(pj.projects || []);
    }).catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} /></div>;
  if (notFound || !emp) return (
    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <i className='bx bx-user-x' style={{ fontSize: '34px', display: 'block', marginBottom: '10px', opacity: 0.4 }} />
      Employee not found.
      <div style={{ marginTop: '16px' }}><button onClick={() => navigate(back)} style={backBtn}>← {backLbl}</button></div>
    </div>
  );

  const roleName = roles.find(r => r.id === emp.role)?.name || emp.role;
  const supervisor = team.find(t => t.id === emp.supervisorId);
  const reports = team.filter(t => t.supervisorId === emp.id);
  const fullName = emp.displayName || `${emp.firstName} ${emp.lastName}`;
  const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();

  const goEmp = (e) => navigate(`/employees/${e.id}`, { state: { from: `/employees/${id}`, fromLabel: fullName } });

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px', margin: '0 auto' }}>
      <button onClick={() => navigate(back)} style={backBtn}><i className='bx bx-arrow-back' /> {backLbl}</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '18px 0 24px' }}>
        <div style={{ width: '68px', height: '68px', borderRadius: '18px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 0 24px rgba(124,58,237,0.35)' }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{fullName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(167,139,250,0.14)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '6px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{roleName}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.04em',
              background: emp.status === 'active' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
              color: emp.status === 'active' ? '#34d399' : '#ef4444',
              border: `1px solid ${emp.status === 'active' ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}` }}>{emp.status}</span>
            {emp.employeeId && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>· {emp.employeeId}</span>}
          </div>
        </div>
        {sessionUser?.isAdmin && (
          <button onClick={() => navigate('/employees')} style={{ ...backBtn, marginLeft: 'auto' }}><i className='bx bx-pencil' /> Manage</button>
        )}
      </div>

      {/* Facts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', marginBottom: '20px' }}>
        <Fact icon="bx-envelope"     label="Email"       value={emp.email || '—'} />
        <Fact icon="bx-briefcase-alt" label="Job Title"  value={emp.jobTitle || '—'} />
        <Fact icon="bx-buildings"    label="Department"  value={emp.department || '—'} />
        <Fact icon="bx-map-pin"      label="Location"    value={emp.officeLocation || '—'} />
        <Fact icon="bx-calendar"     label="Start Date"  value={emp.startDate || '—'} />
        <Fact icon="bx-user-voice"   label="Supervisor"  value={supervisor ? (supervisor.displayName || `${supervisor.firstName} ${supervisor.lastName}`) : '—'}
          onClick={supervisor ? () => goEmp(supervisor) : null} />
      </div>

      {/* Skills */}
      {(emp.skills || []).length > 0 && (
        <Section title="Skills" icon="bx-bulb">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {emp.skills.map(s => <span key={s} style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '6px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 500 }}>{s}</span>)}
          </div>
        </Section>
      )}

      {/* Projects they manage */}
      <Section title={`Manages ${projects.length} project${projects.length !== 1 ? 's' : ''}`} icon="bx-folder">
        {projects.length === 0 ? <Empty text="Not managing any projects" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {projects.map(p => (
              <Row key={p.id} onClick={() => navigate(`/projects-admin/${p.id}`, { state: { from: `/employees/${id}`, fromLabel: fullName } })}
                icon="bx-folder" color="#60a5fa" main={p.name} sub={p.clientName || 'No client'} tag={p.status} />
            ))}
          </div>
        )}
      </Section>

      {/* Direct reports */}
      {reports.length > 0 && (
        <Section title={`${reports.length} direct report${reports.length !== 1 ? 's' : ''}`} icon="bx-sitemap">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {reports.map(r => (
              <Row key={r.id} onClick={() => goEmp(r)} icon="bx-user" color="#a78bfa"
                main={r.displayName || `${r.firstName} ${r.lastName}`} sub={roles.find(x => x.id === r.role)?.name || r.role} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

const backBtn = { display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', padding: '7px 13px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 };

function Fact({ icon, label, value, onClick }) {
  return (
    <div onClick={onClick || undefined} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '13px 15px', cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <i className={`bx ${icon}`} style={{ fontSize: '13px' }} /> {label}
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: onClick ? '#a78bfa' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className={`bx ${icon}`} style={{ fontSize: '15px', color: '#a78bfa' }} /> {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ onClick, icon, color, main, sub, tag }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '11px', cursor: 'pointer', transition: 'all 0.14s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
      <i className={`bx ${icon}`} style={{ fontSize: '17px', color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{main}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      {tag && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'capitalize', flexShrink: 0 }}>{String(tag).replace('_', ' ')}</span>}
      <i className='bx bx-chevron-right' style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px', flexShrink: 0 }} />
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '11px', border: '1px solid rgba(255,255,255,0.05)' }}>{text}</div>;
}
