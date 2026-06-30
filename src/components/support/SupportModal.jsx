import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { S } from '../settings/styles';

const CATEGORIES = [
  { v: 'bug',      label: 'Bug / something broke' },
  { v: 'question', label: 'Question / how do I…' },
  { v: 'feature',  label: 'Feature request' },
  { v: 'access',   label: 'Access / permissions' },
  { v: 'other',    label: 'Something else' },
];
const SEVERITIES = [
  { v: 'low',    label: 'Low' },
  { v: 'normal', label: 'Normal' },
  { v: 'high',   label: 'High' },
  { v: 'urgent', label: 'Urgent — blocking my work' },
];
const STATUS_META = {
  open:        { label: 'Open',        color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  in_progress: { label: 'In progress', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  resolved:    { label: 'Resolved',    color: '#34d399', bg: 'rgba(52,211,153,0.14)' },
  closed:      { label: 'Closed',      color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' },
};

export default function SupportModal({ prefill, onClose }) {
  const ctx   = useToast();
  const toast = ctx?.toast || { success: () => {}, error: () => {} };

  const [tab,      setTab]      = useState('new');         // 'new' | 'mine'
  const [category, setCategory] = useState(prefill?.category || 'bug');
  const [severity, setSeverity] = useState(prefill?.severity || 'normal');
  const [subject,  setSubject]  = useState(prefill?.subject || '');
  const [message,  setMessage]  = useState(prefill?.message || '');
  const [showTech, setShowTech] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [mine,     setMine]     = useState(null);          // null = loading

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
      <div className="modal-panel" style={{ width: '100%', maxWidth: '540px' }} role="dialog" aria-modal="true" aria-label="Help and support">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bx bx-lifebuoy" style={{ fontSize: '18px', color: '#a78bfa' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>Help &amp; Support</h3>
              <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Report a problem or ask a question</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>
            <i className="bx bx-x" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '8px 24px 0' }}>
          {[['new', 'New request'], ['mine', 'My tickets']].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '13px', fontWeight: 600, padding: '8px 2px', marginRight: '20px',
              color: tab === k ? '#fff' : 'rgba(255,255,255,0.4)',
              borderBottom: tab === k ? '2px solid #8b5cf6' : '2px solid transparent',
            }}>{lbl}</button>
          ))}
        </div>

        {tab === 'new' ? (
          <form onSubmit={submit} style={{ padding: '18px 24px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={S.label}>Type</label>
                <select style={S.select} value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Priority</label>
                <select style={S.select} value={severity} onChange={e => setSeverity(e.target.value)}>
                  {SEVERITIES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={S.label}>Subject <span style={{ color: '#f87171' }}>*</span></label>
              <input style={S.input} value={subject} maxLength={160} onChange={e => setSubject(e.target.value)} placeholder="Short summary of the issue" autoFocus />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={S.label}>Description <span style={{ color: '#f87171' }}>*</span></label>
              <textarea style={{ ...S.textarea, minHeight: '120px' }} value={message} maxLength={4000} onChange={e => setMessage(e.target.value)} placeholder="What happened? What did you expect to happen? Steps to reproduce help us fix it faster." />
            </div>

            <button type="button" onClick={() => setShowTech(s => !s)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
              <i className={`bx ${showTech ? 'bx-chevron-down' : 'bx-chevron-right'}`} /> Technical details attached automatically
            </button>
            {showTech && (
              <div style={{ marginTop: '6px', padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                <div>Page: {route || '—'}</div>
                {clientError && <div style={{ marginTop: '6px', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{clientError.slice(0, 600)}</div>}
              </div>
            )}

            {error && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#f87171', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <i className="bx bx-error-circle" /> {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button type="button" onClick={onClose} style={S.cancelBtn}>Cancel</button>
              <button type="submit" disabled={busy} style={{ ...S.saveBtn, opacity: busy ? 0.6 : 1 }}>
                {busy ? <><i className="bx bx-loader-alt bx-spin" /> Submitting…</> : <><i className="bx bx-send" /> Submit request</>}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '16px 24px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
            {mine === null ? (
              <p style={{ ...S.muted, textAlign: 'center', padding: '24px' }}><i className="bx bx-loader-alt bx-spin" /> Loading your tickets…</p>
            ) : mine.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.4)' }}>
                <i className="bx bx-message-square-detail" style={{ fontSize: '30px', opacity: 0.4, display: 'block', marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>You haven’t submitted any tickets yet.</p>
              </div>
            ) : mine.map(t => {
              const m = STATUS_META[t.status] || STATUS_META.open;
              return (
                <div key={t.id} style={{ padding: '13px 14px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{t.subject}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '2px 9px', background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    {t.message.slice(0, 160)}{t.message.length > 160 ? '…' : ''}
                  </p>
                  {t.adminNote && (
                    <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(52,211,153,0.07)', borderLeft: '2px solid #34d399', borderRadius: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      <strong style={{ color: '#34d399' }}>Response:</strong> {t.adminNote}
                    </div>
                  )}
                  <div style={{ marginTop: '7px', fontSize: '10.5px', color: 'rgba(255,255,255,0.3)' }}>{new Date(t.createdAt).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
