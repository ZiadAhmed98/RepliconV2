import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const STATUS_STYLE = {
  in_progress: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  completed:   { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  tentative:   { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  deferred:    { bg: 'rgba(245,158,11,0.1)',   color: '#fbbf24' },
  cancelled:   { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  archived:    { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' },
};

export default function AccountManagerDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [am,       setAm]      = useState(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/account-managers/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAm(d.accountManager))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
      <i className="bx bx-loader-alt bx-spin" style={{ fontSize: '28px' }} />
    </div>
  );

  if (!am) return (
    <div style={{ padding: '40px', color: '#f87171', fontSize: '0.9rem' }}>Account manager not found.</div>
  );

  const initials = `${am.firstName?.[0] || ''}${am.lastName?.[0] || ''}`.toUpperCase() || '?';
  const isActive = am.status === 'active';

  return (
    <div style={{ padding: '32px 40px' }}>

      {/* Back */}
      <button
        onClick={() => navigate('/account-managers')}
        style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.84rem', marginBottom: '24px', padding: 0, fontFamily: 'inherit', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
      >
        <i className="bx bx-arrow-back" style={{ fontSize: '16px' }} /> Account Managers
      </button>

      {/* Profile card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '28px 32px', marginBottom: '28px', display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ width: '68px', height: '68px', borderRadius: '18px', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {am.displayName}
            </h2>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
              background: isActive ? 'rgba(48,209,88,0.12)' : 'rgba(255,59,48,0.1)',
              color: isActive ? '#30d158' : '#ff3b30',
              border: `1px solid ${isActive ? 'rgba(48,209,88,0.25)' : 'rgba(255,59,48,0.2)'}`,
            }}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {am.title && (
            <div style={{ fontSize: '0.88rem', color: 'rgba(52,211,153,0.7)', marginBottom: '14px' }}>{am.title}</div>
          )}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {am.email && (
              <a href={`mailto:${am.email}`} style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#34d399'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
                <i className="bx bx-envelope" style={{ opacity: 0.55 }} /> {am.email}
              </a>
            )}
            {am.phone && (
              <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="bx bx-phone" style={{ opacity: 0.55 }} /> {am.phone}
              </span>
            )}
            <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="bx bx-briefcase" style={{ opacity: 0.55 }} />
              {am.clientCount ?? am.clients?.length ?? 0} active client{(am.clientCount ?? am.clients?.length ?? 0) !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="bx bx-folder-open" style={{ opacity: 0.55 }} />
              {am.projects?.length ?? 0} project{(am.projects?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Linked projects */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <i className="bx bx-folder-open" style={{ color: '#60a5fa', marginRight: '8px' }} />
            Linked Projects
          </h3>
          <span style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: 600, color: '#60a5fa' }}>
            {am.projects?.length ?? 0}
          </span>
        </div>

        {(!am.projects || am.projects.length === 0) ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.88rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <i className="bx bx-folder" style={{ fontSize: '32px', display: 'block', marginBottom: '10px', opacity: 0.3 }} />
            No projects linked to this account manager's clients.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {am.projects.map(proj => {
              const st = STATUS_STYLE[proj.status] || STATUS_STYLE.in_progress;
              return (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/projects-admin/${proj.id}`, { state: { from: `/account-managers/${id}`, fromLabel: am.displayName } })}
                  style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', flex: 1, lineHeight: 1.3 }}>{proj.name}</div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: st.bg, color: st.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {proj.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="bx bx-briefcase" style={{ fontSize: '12px', opacity: 0.5 }} />
                    {proj.clientName || '—'}
                  </div>
                  {proj.code && (
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginTop: '6px', fontFamily: 'monospace' }}>{proj.code}</div>
                  )}
                  <div style={{ position: 'absolute', right: '14px', bottom: '14px', opacity: 0 }} className="arrow-hint">
                    <i className="bx bx-right-arrow-alt" style={{ color: '#60a5fa', fontSize: '16px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
