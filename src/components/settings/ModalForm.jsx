const S = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modal:     { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 },
  title:     { margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' },
  closeBtn:  { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: 1 },
  body:      { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  label:     { display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  required:  { color: '#f87171', marginLeft: '2px' },
  input:     { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' },
  textarea:  { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box', resize: 'vertical' },
  select:    { background: 'rgba(30,41,59,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' },
  footer:    { display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '0 20px 20px' },
  cancelBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
  saveBtn:   { background: '#6366f1', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 },
  checkRow:  { display: 'flex', alignItems: 'center', gap: '8px' },
  checkLabel:{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' },
};

export default function ModalForm({ title, fields, values, onChange, onSubmit, onClose, submitting }) {
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <p style={S.title}>{title}</p>
          <button onClick={onClose} style={S.closeBtn}><i className="bx bx-x" /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
          <div style={S.body}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={S.label}>
                  {f.label}{f.required && <span style={S.required}>*</span>}
                </label>
                {f.type === 'select' ? (
                  <select value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)}
                    required={f.required} style={S.select}>
                    <option value="">Select…</option>
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)}
                    rows={4} required={f.required} style={S.textarea} />
                ) : f.type === 'color' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={values[f.key] ?? '#818cf8'}
                      onChange={e => onChange(f.key, e.target.value)}
                      style={{ width: '38px', height: '34px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', padding: '2px' }} />
                    <input type="text" value={values[f.key] ?? '#818cf8'}
                      onChange={e => onChange(f.key, e.target.value)}
                      style={{ ...S.input, flex: 1, width: 'auto' }} />
                  </div>
                ) : f.type === 'checkbox' ? (
                  <div style={S.checkRow}>
                    <input type="checkbox" id={`chk-${f.key}`} checked={!!values[f.key]}
                      onChange={e => onChange(f.key, e.target.checked)}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#6366f1' }} />
                    <label htmlFor={`chk-${f.key}`} style={S.checkLabel}>{f.checkLabel || 'Enabled'}</label>
                  </div>
                ) : (
                  <input type={f.type || 'text'} value={values[f.key] ?? ''}
                    onChange={e => onChange(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                    required={f.required} min={f.min} max={f.max} step={f.step}
                    placeholder={f.placeholder} style={S.input} />
                )}
              </div>
            ))}
          </div>

          <div style={S.footer}>
            <button type="button" onClick={onClose} style={S.cancelBtn}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...S.saveBtn, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
