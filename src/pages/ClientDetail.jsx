import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// Read-only detail of a single client — reachable by clicking a client name
// anywhere. Editing stays on the admin Clients page.
export default function ClientDetail({ sessionUser }) {
  const { id }   = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back     = location.state?.from || '/clients';
  const backLbl  = location.state?.fromLabel || 'Clients';

  const [client, setClient]     = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/clients/${id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/psa/projects?clientId=${id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { projects: [] }),
    ]).then(([c, pj]) => {
      if (!alive) return;
      const cl = c?.client || c?.data || (c && c.id ? c : null);
      if (!cl) { setNotFound(true); return; }
      setClient(cl);
      setProjects(pj.projects || []);
    }).catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} /></div>;
  if (notFound || !client) return (
    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <i className='bx bx-buildings' style={{ fontSize: '34px', display: 'block', marginBottom: '10px', opacity: 0.4 }} />
      Client not found.
      <div style={{ marginTop: '16px' }}><button onClick={() => navigate(back)} style={backBtn}>← {backLbl}</button></div>
    </div>
  );

  const active   = (client.status || 'active') === 'active';
  const activeCount = projects.filter(p => !['archived', 'cancelled', 'completed'].includes(p.status)).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px', margin: '0 auto' }}>
      <button onClick={() => navigate(back)} style={backBtn}><i className='bx bx-arrow-back' /> {backLbl}</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '18px 0 24px' }}>
        <div style={{ width: '68px', height: '68px', borderRadius: '18px', background: 'linear-gradient(135deg,#0891b2,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', color: '#fff', flexShrink: 0, boxShadow: '0 0 24px rgba(6,182,212,0.3)' }}>
          <i className='bx bx-buildings' />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{client.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.04em',
              background: active ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)', color: active ? '#34d399' : '#ef4444',
              border: `1px solid ${active ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}` }}>{client.status || 'active'}</span>
            {client.code && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>· {client.code}</span>}
            {(client.tierName || client.tier) && <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(167,139,250,0.14)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '6px', padding: '3px 10px' }}>{client.tierName || client.tier}</span>}
          </div>
        </div>
        {sessionUser?.isAdmin && (
          <button onClick={() => navigate('/clients')} style={{ ...backBtn, marginLeft: 'auto' }}><i className='bx bx-pencil' /> Manage</button>
        )}
      </div>

      {/* Facts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', marginBottom: '4px' }}>
        <Fact icon="bx-id-card"  label="Account Manager" value={client.accountManagerName || '—'}
          onClick={client.managerId ? () => navigate(`/account-managers/${client.managerId}`, { state: { from: `/clients/${id}`, fromLabel: client.name } }) : null} />
        <Fact icon="bx-user"     label="Contact"  value={client.contactName || '—'} />
        <Fact icon="bx-envelope" label="Email"    value={client.contactEmail || client.email || '—'} />
        <Fact icon="bx-phone"    label="Phone"    value={client.contactPhone || client.phone || '—'} />
      </div>

      {/* Projects */}
      <Section title={`${projects.length} project${projects.length !== 1 ? 's' : ''} · ${activeCount} active`} icon="bx-folder">
        {projects.length === 0 ? <Empty text="No projects for this client yet" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {projects.map(p => (
              <Row key={p.id} onClick={() => navigate(`/projects-admin/${p.id}`, { state: { from: `/clients/${id}`, fromLabel: client.name } })}
                icon="bx-folder" color="#60a5fa" main={p.name} sub={p.projectManagerName || 'No PM'} tag={p.status} />
            ))}
          </div>
        )}
      </Section>
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
        <i className={`bx ${icon}`} style={{ fontSize: '15px', color: '#06b6d4' }} /> {title}
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
