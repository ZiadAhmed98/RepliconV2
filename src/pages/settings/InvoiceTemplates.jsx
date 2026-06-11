import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const LAYOUTS = { standard:'Standard', compact:'Compact', detailed:'Detailed' };

export default function InvoiceTemplates() {
  const { items, loading, create, remove } = useCrud('invoice-templates');
  const [modal,setModal]=useState(false); const [form,setForm]=useState({name:'',layout:'standard',logoUrl:''}); const [busy,setBusy]=useState(false); const [confirm,setConfirm]=useState(null);
  async function submit(e) { e.preventDefault(); setBusy(true); try { await create(form); setModal(false); } finally { setBusy(false); } }

  if (loading) return <SettingsLayout title="Invoice Templates" accent="#f472b6"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Invoice Templates" subtitle="Manage invoice layout and branding templates" accent="#f472b6">
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'14px' }}>
        <button onClick={() => { setForm({name:'',layout:'standard',logoUrl:''}); setModal(true); }} style={S.addBtn}><i className="bx bx-plus" style={{ fontSize:'14px' }} /> Add Template</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'12px' }}>
        {items.length===0 && <p style={{ ...S.muted, textAlign:'center', gridColumn:'1/-1', padding:'32px' }}>No templates yet.</p>}
        {items.map(t => (
          <div key={t.id} style={{ ...S.card, display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <p style={{ margin:'0 0 4px', fontSize:'14px', fontWeight:700, color:'#fff' }}>{t.name}</p>
              <p style={{ margin:0, fontSize:'12px', color:'rgba(255,255,255,0.35)' }}>{LAYOUTS[t.layout]||t.layout} layout</p>
            </div>
            <button onClick={() => setConfirm(t.id)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-trash" /></button>
          </div>
        ))}
      </div>

      {confirm && (
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth:'340px', padding:'24px' }}>
          <p style={{ margin:'0 0 6px', fontSize:'15px', fontWeight:700, color:'#fff' }}>Delete template?</p>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'20px' }}>
            <button onClick={()=>setConfirm(null)} style={S.cancelBtn}>Cancel</button>
            <button onClick={()=>{ remove(confirm); setConfirm(null); }} style={S.deleteBtn}>Delete</button>
          </div>
        </div></div>
      )}

      {modal && (
        <div style={S.overlay}><div style={S.modal}>
          <div style={S.modalH}><p style={S.modalT}>Add Invoice Template</p><button onClick={()=>setModal(false)} style={S.closeBtn}><i className="bx bx-x" /></button></div>
          <form onSubmit={submit} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div><label style={S.label}>Name <span style={{ color:'#f87171' }}>*</span></label><input required style={S.input} type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
            <div><label style={S.label}>Layout</label>
              <select style={S.select} value={form.layout} onChange={e=>setForm(p=>({...p,layout:e.target.value}))}>
                {Object.entries(LAYOUTS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Logo URL</label><input style={S.input} type="url" value={form.logoUrl} onChange={e=>setForm(p=>({...p,logoUrl:e.target.value}))} /></div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button type="button" onClick={()=>setModal(false)} style={S.cancelBtn}>Cancel</button>
              <button type="submit" disabled={busy} style={{ ...S.saveBtn, opacity:busy?0.6:1 }}>{busy?'Saving…':'Save'}</button>
            </div>
          </form>
        </div></div>
      )}
    </SettingsLayout>
  );
}
