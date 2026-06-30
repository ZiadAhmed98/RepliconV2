import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const STATUS_META = {
  open:        { label: 'Open',        color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  in_progress: { label: 'In progress', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  resolved:    { label: 'Resolved',    color: '#34d399', bg: 'rgba(52,211,153,0.14)' },
  closed:      { label: 'Closed',      color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' },
};
const SEV_META = {
  low:    { label: 'Low',    color: '#94a3b8' },
  normal: { label: 'Normal', color: '#60a5fa' },
  high:   { label: 'High',   color: '#fb923c' },
  urgent: { label: 'Urgent', color: '#f87171' },
};
const CAT_LABEL = { bug: 'Bug', question: 'Question', feature: 'Feature', access: 'Access', other: 'Other' };
const FILTERS = [['all', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']];

export default function SupportTickets() {
  const { items, loading, error, update, remove } = useCrud('support-tickets');
  const [active,  setActive]  = useState(null);
  const [note,    setNote]    = useState('');
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [filter,  setFilter]  = useState('all');

  const openT  = (t) => { setActive(t); setNote(t.adminNote || ''); setConfirm(false); };
  const closeT = () => { setActive(null); setNote(''); setConfirm(false); };

  const apply = async (patch) => {
    setBusy(true);
    try { await update(active.id, patch); setActive(a => ({ ...a, ...patch })); }
    finally { setBusy(false); }
  };
  const del = async () => { await remove(active.id); closeT(); };

  const counts = items.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {});
  const list   = filter === 'all' ? items : items.filter(t => t.status === filter);

  if (loading) return <SettingsLayout title="Support Tickets" accent="#22d3ee"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Support Tickets" subtitle="Issues and requests reported by employees" accent="#22d3ee">

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {FILTERS.map(([k, lbl]) => {
          const n  = k === 'all' ? items.length : (counts[k] || 0);
          const on = filter === k;
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: on ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${on ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: on ? '#22d3ee' : 'rgba(255,255,255,0.55)',
              borderRadius: '8px', padding: '6px 12px', fontSize: '12.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{lbl} <span style={{ opacity: 0.7 }}>{n}</span></button>
          );
        })}
      </div>

      {error && <div style={{ ...S.card, color: '#f87171' }}>Failed to load tickets: {error}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Subject</th>
            <th style={S.th}>From</th>
            <th style={S.th}>Type</th>
            <th style={S.th}>Priority</th>
            <th style={S.th}>Status</th>
            <th style={S.th}>Created</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px' }}>
                {items.length === 0 ? 'No tickets yet. When an employee reports an issue, it appears here.' : 'No tickets in this view.'}
              </td></tr>
            ) : list.map(t => {
              const sm  = STATUS_META[t.status]   || STATUS_META.open;
              const sev = SEV_META[t.severity]    || SEV_META.normal;
              return (
                <tr key={t.id} onClick={() => openT(t)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...S.td, fontWeight: 600, color: '#f1f5f9' }}>{t.subject}</td>
                  <td style={{ ...S.td, color: 'rgba(255,255,255,0.6)' }}>{t.userName || t.userId}</td>
                  <td style={S.td}>{CAT_LABEL[t.category] || t.category}</td>
                  <td style={S.td}><span style={{ color: sev.color, fontWeight: 600, fontSize: '12px' }}>{sev.label}</span></td>
                  <td style={S.td}><span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '3px 9px', background: sm.bg, color: sm.color }}>{sm.label}</span></td>
                  <td style={{ ...S.td, fontSize: '11.5px', color: 'rgba(255,255,255,0.35)' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail / manage modal */}
      {active && (
        <div style={S.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) closeT(); }}>
          <div style={{ ...S.modal, maxWidth: '560px' }}>
            <div style={S.modalH}>
              <p style={S.modalT}>{active.subject}</p>
              <button onClick={closeT} style={S.closeBtn}><i className="bx bx-x" /></button>
            </div>
            <div style={{ padding: '20px 22px' }}>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                <span style={S.badge(false)}>{CAT_LABEL[active.category] || active.category}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '3px 9px', background: 'rgba(255,255,255,0.06)', color: (SEV_META[active.severity] || SEV_META.normal).color }}>
                  {(SEV_META[active.severity] || SEV_META.normal).label} priority
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>From <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{active.userName || active.userId}</strong></span>
              </div>

              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '14px' }}>{active.message}</p>

              {(active.route || active.clientError) && (
                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)', marginBottom: '16px', wordBreak: 'break-word' }}>
                  {active.route && <div>Page: {active.route}</div>}
                  {active.clientError && <div style={{ marginTop: '6px', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{active.clientError}</div>}
                </div>
              )}

              <label style={S.label}>Response / internal note <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>(visible to the employee)</span></label>
              <textarea style={{ ...S.textarea, minHeight: '72px', marginBottom: '8px' }} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note the employee will see under “My tickets”…" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
                <button onClick={() => apply({ adminNote: note })} disabled={busy} style={{ ...S.ghostBtn, opacity: busy ? 0.6 : 1 }}><i className="bx bx-save" /> Save note</button>
              </div>

              <label style={S.label}>Set status</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <button key={k} onClick={() => apply({ status: k, adminNote: note })} disabled={busy} style={{
                    background: active.status === k ? m.bg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active.status === k ? m.color : 'rgba(255,255,255,0.1)'}`,
                    color: active.status === k ? m.color : 'rgba(255,255,255,0.55)',
                    borderRadius: '8px', padding: '7px 13px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{m.label}</button>
                ))}
              </div>

              {!confirm ? (
                <button onClick={() => setConfirm(true)} style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.7)', fontSize: '12px', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <i className="bx bx-trash" /> Delete ticket
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Delete permanently?</span>
                  <button onClick={del} style={S.deleteBtn}>Delete</button>
                  <button onClick={() => setConfirm(false)} style={S.cancelBtn}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
