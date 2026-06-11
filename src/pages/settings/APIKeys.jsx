import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

export default function APIKeys() {
  const { items, loading, remove, reload } = useCrud('api-keys');
  const [modal,   setModal]   = useState(false);
  const [name,    setName]    = useState('');
  const [busy,    setBusy]    = useState(false);
  const [newKey,  setNewKey]  = useState(null);
  const [confirm, setConfirm] = useState(null);

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try {
      const r    = await fetch('/api/v1/admin/api-keys', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) });
      const data = await r.json();
      if (data.fullKey) setNewKey(data.fullKey);
      setModal(false); reload();
    } finally { setBusy(false); }
  }

  if (loading) return <SettingsLayout title="API Keys" accent="#2dd4bf"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="API Keys" subtitle="Manage programmatic access credentials" accent="#2dd4bf">
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'14px' }}>
        <button onClick={()=>{ setName(''); setModal(true); }} style={S.addBtn}><i className="bx bx-plus" style={{ fontSize:'14px' }} /> Generate Key</button>
      </div>

      {newKey && (
        <div style={{ marginBottom:'16px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'12px', padding:'16px' }}>
          <p style={{ margin:'0 0 8px', fontSize:'13px', fontWeight:700, color:'#fbbf24' }}>Save this key — it won't be shown again.</p>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'rgba(0,0,0,0.3)', borderRadius:'8px', padding:'10px 14px' }}>
            <code style={{ flex:1, fontSize:'12px', fontFamily:'monospace', color:'#4ade80', wordBreak:'break-all' }}>{newKey}</code>
            <button onClick={()=>navigator.clipboard.writeText(newKey)} style={{ ...S.iconBtn, color:'rgba(255,255,255,0.4)', fontSize:'15px' }}>
              <i className="bx bx-copy" />
            </button>
          </div>
          <button onClick={()=>setNewKey(null)} style={{ marginTop:'8px', background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'12px', cursor:'pointer', padding:0 }}>Dismiss</button>
        </div>
      )}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Name</th><th style={S.th}>Key Preview</th><th style={S.th}>Created</th>
            <th style={{ ...S.th, textAlign:'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {items.length===0 ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', color:'rgba(255,255,255,0.2)', padding:'32px' }}>No API keys yet.</td></tr>
            ) : items.map(k => (
              <tr key={k.id}>
                <td style={S.td}>{k.name}</td>
                <td style={{ ...S.td, fontFamily:'monospace', fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>{k.keyPreview}</td>
                <td style={{ ...S.td, fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>{k.createdAt?.slice(0,10)}</td>
                <td style={{ ...S.td, textAlign:'right' }}>
                  <button onClick={()=>setConfirm(k.id)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth:'360px', padding:'24px' }}>
          <p style={{ margin:'0 0 6px', fontSize:'15px', fontWeight:700, color:'#fff' }}>Revoke API key?</p>
          <p style={{ ...S.muted, marginBottom:'20px' }}>Any integrations using this key will stop working immediately.</p>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={()=>setConfirm(null)} style={S.cancelBtn}>Cancel</button>
            <button onClick={()=>{ remove(confirm); setConfirm(null); }} style={S.deleteBtn}>Revoke</button>
          </div>
        </div></div>
      )}

      {modal && (
        <div style={S.overlay}><div style={S.modal}>
          <div style={S.modalH}><p style={S.modalT}>Generate API Key</p><button onClick={()=>setModal(false)} style={S.closeBtn}><i className="bx bx-x" /></button></div>
          <form onSubmit={submit} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={S.label}>Key Name <span style={{ color:'#f87171' }}>*</span></label>
              <input required type="text" style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. CI Pipeline, Mobile App" />
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button type="button" onClick={()=>setModal(false)} style={S.cancelBtn}>Cancel</button>
              <button type="submit" disabled={busy} style={{ ...S.saveBtn, opacity:busy?0.6:1 }}>{busy?'Generating…':'Generate'}</button>
            </div>
          </form>
        </div></div>
      )}
    </SettingsLayout>
  );
}
