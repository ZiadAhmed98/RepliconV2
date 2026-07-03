import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

const CATEGORIES = [
  { v: 'bug',      label: 'Bug',     icon: 'bx-bug' },
  { v: 'question', label: 'Question', icon: 'bx-help-circle' },
  { v: 'feature',  label: 'Feature',  icon: 'bx-bulb' },
  { v: 'access',   label: 'Access',   icon: 'bx-lock-open-alt' },
  { v: 'other',    label: 'Other',    icon: 'bx-dots-horizontal-rounded' },
];
const SEVERITIES = [
  { v: 'low',    label: 'Low',    color: '#94a3b8' },
  { v: 'normal', label: 'Normal', color: '#60a5fa' },
  { v: 'high',   label: 'High',   color: '#fb923c' },
  { v: 'urgent', label: 'Urgent', color: '#f87171' },
];
const STATUS_META = {
  open:        { label: 'Open',        color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  in_progress: { label: 'In progress', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  resolved:    { label: 'Resolved',    color: '#34d399', bg: 'rgba(52,211,153,0.14)' },
  closed:      { label: 'Closed',      color: '#94a3b8', bg: 'rgba(255,255,255,0.08)' },
};

const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '7px', letterSpacing: '0.01em' };

export default function SupportModal({ prefill, onClose }) {
  const ctx   = useToast();
  const toast = ctx?.toast || { success: () => {}, error: () => {} };

  const [tab,      setTab]      = useState('new');
  const [category, setCategory] = useState(prefill?.category || 'bug');
  const [severity, setSeverity] = useState(prefill?.severity || 'normal');
  const [subject,  setSubject]  = useState(prefill?.subject || '');
  const [message,  setMessage]  = useState(prefill?.message || '');
  const [showTech, setShowTech] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [mine,     setMine]     = useState(null);

  const route       = typeof window !== 'undefined' ? window.location.pathname : '';
  const clientError = prefill?.clientError || '';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadMine = useCallback(async () => {
    setMine(null);
    try {
      const r = await fetch('/api/v1/support/tickets', { credentials: 'include' });
      const d = await r.json();
      setMine(d.tickets || []);
    } catch { setMine([]); }
  }, []);

  useEffect(() => { if (tab === 'mine' && mine === null) loadMine(); }, [tab, mine, loadMine]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!subject.trim() || !message.trim()) { setError('Please add a subject and a description.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/v1/support/tickets', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, severity, subject: subject.trim(), message: message.trim(), route, clientError }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || 'Submission failed.');
      toast.success('Thanks — your request was submitted. An administrator has been notified.');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ width: '100%', maxWidth: '520px' }} role="dialog" aria-modal="true" aria-label="Help and support">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(37,99,235,0.2))', border: '1px solid rgba(139,92,246,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124,58,237,0.25)' }}>
              <i className="bx bx-lifebuoy" style={{ fontSize: '20px', color: '#c4b5fd' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Help &amp; Support</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>Report a problem or ask a question</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="iconbtn"><i className="bx bx-x" style={{ fontSize: '20px' }} /></button>
        </div>

        {/* Segmented tabs */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
            {[['new', 'New request', 'bx-edit'], ['mine', 'My tickets', 'bx-list-ul']].map(([k, label, icon]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: '8px',
                background: tab === k ? 'rgba(139,92,246,0.2)' : 'transparent',
                color: tab === k ? '#c4b5fd' : 'var(--text-muted)',
                boxShadow: tab === k ? 'inset 0 0 0 1px rgba(139,92,246,0.3)' : 'none',
                transition: 'all 0.15s',
              }}><i className={`bx ${icon}`} /> {label}</button>
            ))}
          </div>
        </div>

        {tab === 'new' ? (
          <form onSubmit={submit} style={{ padding: '18px 24px 24px', maxHeight: '64vh', overflowY: 'auto' }}>

            {/* Category chips */}
            <label style={lbl}>What's this about?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
              {CATEGORIES.map(c => {
                const on = category === c.v;
                return (
                  <button type="button" key={c.v} onClick={() => setCategory(c.v)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '8px 13px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.8rem', fontWeight: 600,
                    background: on ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? 'rgba(139,92,246,0.42)' : 'var(--border)'}`,
                    color: on ? '#c4b5fd' : 'var(--text-muted)', transition: 'all 0.15s',
                  }}>
                    <i className={`bx ${c.icon}`} style={{ fontSize: '15px' }} /> {c.label}
                  </button>
                );
              })}
            </div>

            {/* Priority segmented */}
            <label style={lbl}>Priority</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
              {SEVERITIES.map(s => {
                const on = severity === s.v;
                return (
                  <button type="button" key={s.v} onClick={() => setSeverity(s.v)} style={{
                    flex: 1, minWidth: '70px', padding: '8px 6px', borderRadius: '9px', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.78rem', fontWeight: 700,
                    background: on ? `${s.color}1f` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? s.color : 'var(--border)'}`,
                    color: on ? s.color : 'var(--text-muted)', transition: 'all 0.15s',
                  }}>{s.label}</button>
                );
              })}
            </div>

            <label style={lbl}>Subject <span style={{ color: '#f87171' }}>*</span></label>
            <input value={subject} maxLength={160} onChange={e => setSubject(e.target.value)} placeholder="Short summary of the issue" autoFocus style={{ marginBottom: '16px' }} />

            <label style={lbl}>Description <span style={{ color: '#f87171' }}>*</span></label>
            <textarea value={message} maxLength={4000} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder="What happened? What did you expect? Steps to reproduce help us fix it faster." style={{ resize: 'vertical', marginBottom: '12px' }} />

            <button type="button" onClick={() => setShowTech(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.76rem', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
              <i className={`bx ${showTech ? 'bx-chevron-down' : 'bx-chevron-right'}`} /> Technical details attached automatically
            </button>
            {showTech && (
              <div style={{ marginTop: '8px', padding: '11px 13px', background: 'rgba(0,0,0,0.3)', borderRadius: '9px', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-word', border: '1px solid var(--border)' }}>
                <div><span style={{ color: 'var(--text-faint)' }}>Page:</span> {route || '—'}</div>
                {clientError && <div style={{ marginTop: '6px', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{clientError.slice(0, 600)}</div>}
              </div>
            )}

            {error && (
              <div style={{ marginTop: '14px', padding: '11px 13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '9px', color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <i className="bx bx-error-circle" /> {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary" style={{ opacity: busy ? 0.6 : 1 }}>
                {busy ? <><i className="bx bx-loader-alt bx-spin" /> Submitting…</> : <><i className="bx bx-send" /> Submit request</>}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '18px 24px 24px', maxHeight: '64vh', overflowY: 'auto' }}>
            {mine === null ? (
              <p style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><i className="bx bx-loader-alt bx-spin" /> Loading your tickets…</p>
            ) : mine.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <i className="bx bx-message-square-detail" style={{ fontSize: '34px', opacity: 0.4, display: 'block', marginBottom: '10px' }} />
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-2)' }}>No tickets yet</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Anything you report will show up here with its status.</p>
              </div>
            ) : mine.map(t => {
              const m = STATUS_META[t.status] || STATUS_META.open;
              return (
                <div key={t.id} className="surface-sub" style={{ padding: '14px 15px', marginBottom: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>{t.subject}</span>
                    <span className="tag" style={{ background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                  </div>
                  <p style={{ margin: '7px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {t.message.slice(0, 160)}{t.message.length > 160 ? '…' : ''}
                  </p>
                  {t.adminNote && (
                    <div style={{ marginTop: '9px', padding: '9px 11px', background: 'rgba(52,211,153,0.07)', borderLeft: '2px solid #34d399', borderRadius: '5px', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                      <strong style={{ color: '#34d399' }}>Response:</strong> {t.adminNote}
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-faint)' }}>{new Date(t.createdAt).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
