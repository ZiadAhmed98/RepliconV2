import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const ALL_EVENTS = [
  'timesheet.submitted','timesheet.approved','timesheet.rejected',
  'project.created','project.updated','project.deleted',
  'employee.created','employee.updated',
];

export default function Webhooks() {
  const { items, loading, create, update, remove } = useCrud('webhooks');
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ name:'', url:'', events:[], active:true });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  function openAdd()   { setForm({ name:'', url:'', events:[], active:true }); setEditing(null); setModal(true); }
  function openEdit(w) { setForm({ ...w, events: w.events||[], active:!!w.active }); setEditing(w.id); setModal(true); }
  function toggleEvent(ev) { setForm(p=>({ ...p, events: p.events.includes(ev)?p.events.filter(e=>e!==ev):[...p.events,ev] })); }

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { if(editing) await update(editing,form); else await create(form); setModal(false); } finally { setBusy(false); }
  }

  if (loading) return <SettingsLayout title="Webhooks" accent="#2dd4bf"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Webhooks" subtitle="Push real-time event notifications to external endpoints" accent="#2dd4bf">
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'14px' }}>
        <button onClick={openAdd} style={S.addBtn}><i className="bx bx-plus" style={{ fontSize:'14px' }} /> Add Webhook</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {items.length===0 && <p style={{ ...S.muted, textAlign:'center', padding:'32px' }}>No webhooks yet.</p>}
        {items.map(w => (
          <div key={w.id} style={{ ...S.card, marginBottom:0 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                  <p style={{ margin:0, fontSize:'14px', fontWeight:600, color:'#fff' }}>{w.name}</p>
                  <span style={S.badge(w.active)}>{w.active?'Active':'Paused'}</span>
                </div>
                <p style={{ margin:'0 0 8px', fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.url}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {(w.events||[]).map(ev=>(
                    <span key={ev} style={{ fontSize:'10px', background:'rgba(255,255,255,0.06)', borderRadius:'4px', padding:'2px 6px', color:'rgba(255,255,255,0.4)' }}>{ev}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                <button onClick={()=>openEdit(w)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#818cf8'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-edit-alt" /></button>
                <button onClick={()=>setConfirm(w.id)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-trash" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirm && (
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth:'340px', padding:'24px' }}>
          <p style={{ margin:'0 0 6px', fontSize:'15px', fontWeight:700, color:'#fff' }}>Delete webhook?</p>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'20px' }}>
            <button onClick={()=>setConfirm(null)} style={S.cancelBtn}>Cancel</button>
            <button onClick={()=>{ remove(confirm); setConfirm(null); }} style={S.deleteBtn}>Delete</button>
          </div>
        </div></div>
      )}

      {modal && (
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth:'520px' }}>
          <div style={S.modalH}><p style={S.modalT}>{editing?'Edit Webhook':'Add Webhook'}</p><button onClick={()=>setModal(false)} style={S.closeBtn}><i className="bx bx-x" /></button></div>
          <form onSubmit={submit} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={S.label}>Name <span style={{ color:'#f87171' }}>*</span></label>
              <input required type="text" style={S.input} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
            </div>
            <div>
              <label style={S.label}>Endpoint URL <span style={{ color:'#f87171' }}>*</span></label>
              <input required type="url" style={S.input} value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} placeholder="https://" />
            </div>
            <div>
              <label style={S.label}>Events</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                {ALL_EVENTS.map(ev => (
                  <label key={ev} style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer' }}>
                    <input type="checkbox" checked={form.events.includes(ev)} onChange={()=>toggleEvent(ev)} style={{ width:'13px', height:'13px', accentColor:'#6366f1', cursor:'pointer' }} />
                    <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.55)' }}>{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
              <input type="checkbox" id="wActive" checked={form.active} onChange={e=>setForm(p=>({...p,active:e.target.checked}))} style={{ width:'13px', height:'13px', accentColor:'#6366f1', cursor:'pointer' }} />
              <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.6)' }}>Active</span>
            </label>
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
