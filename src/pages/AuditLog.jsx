import React, { useState, useEffect, useCallback } from 'react';

const S = {
  page:     { padding: '32px', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'inherit' },
  h1:       { fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' },
  sub:      { fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px' },
  card:     { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '0 20px', marginBottom: '16px' },
  input:    { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' },
  auditRow: { display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' },
  auditTs:  { color: 'rgba(255,255,255,0.3)', flexShrink: 0, minWidth: '140px', fontFamily: 'monospace' },
  auditUsr: { color: '#c4b5fd', fontWeight: 600, minWidth: '110px', flexShrink: 0 },
  auditAct: { color: 'rgba(255,255,255,0.6)' },
};

const ACTION_COLORS = {
  LOGIN:        '#86efac',
  PAGE_VIEW:    '#93c5fd',
  CREATE_USER:  '#fcd34d',
  UPDATE_USER:  '#c4b5fd',
  DELETE_USER:  '#f87171',
  PROJECT_CREATE:        '#34d399',
  PROJECT_UPDATE:        '#60a5fa',
  PROJECT_ARCHIVE:       '#9ca3af',
  PROJECT_RESOURCE_ADD:  '#a78bfa',
  PROJECT_RESOURCE_REMOVE: '#f87171',
};

function formatTs(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch { return ts; }
}

export default function AuditLog() {
  const [audit,       setAudit]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [auditFilter, setAuditFilter] = useState('');

  const fetchAudit = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/admin/audit', { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setAudit((d.log || []).slice().reverse()); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAudit().finally(() => setLoading(false));
  }, [fetchAudit]);

  const filteredAudit = auditFilter
    ? audit.filter(e =>
        (e.user   || '').toLowerCase().includes(auditFilter.toLowerCase()) ||
        (e.action || '').toLowerCase().includes(auditFilter.toLowerCase()) ||
        (e.page   || '').toLowerCase().includes(auditFilter.toLowerCase()))
    : audit;

  return (
    <div style={S.page}>
      <div style={S.h1}>Audit Log</div>
      <div style={S.sub}>Full trail of every system action — newest first</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }} />
          <input
            style={{ ...S.input, paddingLeft: '32px' }}
            placeholder="Filter by user, action, or page…"
            value={auditFilter}
            onChange={e => setAuditFilter(e.target.value)}
          />
        </div>
        <button onClick={() => { setLoading(true); fetchAudit().finally(() => setLoading(false)); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontFamily: 'inherit' }}>
          <i className='bx bx-refresh' style={{ fontSize: '14px' }} /> Refresh
        </button>
        {filteredAudit.length > 0 && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
            {filteredAudit.length} entr{filteredAudit.length !== 1 ? 'ies' : 'y'}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Loading…</div>
      ) : (
        <div style={S.card}>
          {filteredAudit.length === 0 && (
            <div style={{ padding: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
              {auditFilter ? 'No entries match your filter.' : 'No audit entries yet.'}
            </div>
          )}
          {filteredAudit.map((e, i) => (
            <div key={i} style={S.auditRow}>
              <span style={S.auditTs}>{formatTs(e.ts)}</span>
              <span style={S.auditUsr}>{e.user || '—'}</span>
              <span style={{ ...S.auditAct, color: ACTION_COLORS[e.action] || 'rgba(255,255,255,0.6)', fontWeight: 600, minWidth: '130px' }}>{e.action}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                {e.page || e.target || (e.ip ? `IP: ${e.ip}` : '')}
                {e.changes ? ` [${e.changes.join(', ')}]` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
