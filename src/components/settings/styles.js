// Shared inline-style tokens for all settings pages
export const S = {
  // Page wrapper
  page: { padding: '32px', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'inherit', maxWidth: '920px' },

  // Cards — solid visible background (was rgba(255,255,255,0.03) which was invisible)
  card:      { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '22px 24px', marginBottom: '16px' },
  cardTitle: { margin: '0 0 14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' },

  // Form controls — darker so they contrast against the card background
  label:    { display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '5px', fontWeight: 500 },
  input:    { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' },
  select:   { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' },
  textarea: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box', resize: 'vertical' },

  // Layout helpers
  grid2:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  saveRow: { display: 'flex', justifyContent: 'flex-end', marginTop: '24px' },

  // Buttons
  saveBtn:   { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#6366f1', border: 'none', borderRadius: '8px', padding: '9px 22px', color: '#fff', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 },
  addBtn:    { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#6366f1', border: 'none', borderRadius: '8px', padding: '8px 18px', color: '#fff', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 },
  ghostBtn:  { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
  cancelBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 18px', color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 18px', color: '#f87171', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },

  // Table — wrapper has solid background so rows are visible
  tableWrap: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:        { fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' },
  td:        { padding: '13px 16px', color: 'rgba(255,255,255,0.82)', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' },
  iconBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '16px', padding: '4px 6px', lineHeight: 1, borderRadius: '6px' },

  // Modal
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' },
  modal:    { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' },
  modalH:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 },
  modalT:   { margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1 },

  // Misc
  badge:    (on) => ({ fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '3px 9px', display: 'inline-block', background: on ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.07)', color: on ? '#34d399' : 'rgba(255,255,255,0.4)' }),
  checkRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  divider:  { borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '16px 0' },
  muted:    { fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' },
};
