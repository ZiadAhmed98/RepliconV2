import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const TYPES = ['timesheet_submitted','timesheet_approved','timesheet_rejected','project_assigned','task_assigned','welcome','password_reset','notification'];

export default function EmailTemplates() {
  const { items, loading, create, update, remove } = useCrud('email-templates');
  const [modal,setModal]=useState(null); const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({type:TYPES[0],name:'',subject:'',body:''}); const [busy,setBusy]=useState(false); const [confirm,setConfirm]=useState(null);

  function openAdd()   { setForm({type:TYPES[0],name:'',subject:'',body:''}); setEditing(null); setModal(true); }
  function openEdit(t) { setForm({...t}); setEditing(t.id); setModal(true); }

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { if(editing) await update(editing,form); else await create(form); setModal(false); } finally { setBusy(false); }
  }

  if (loading) return <SettingsLayout title="Email Templates" accent="#fb923c"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Email Templates" subtitle="Customize system notification emails" accent="#fb923c">
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'14px' }}>
        <button onClick={openAdd} style={S.addBtn}><i className="bx bx-plus" style={{ fontSize:'14px' }} /> Add Template</button>
      </div>

      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'14px', overflow:'hidden' }}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Name</th><th style={S.th}>Type</th><th style={S.th}>Subject</th>
            <th style={{ ...S.th, textAlign:'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {items.length===0 ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', color:'rgba(255,255,255,0.2)', padding:'32px' }}>No templates yet.</td></tr>
            ) : items.map(t => (
              <tr key={t.id}>
                <td style={S.td}>{t.name}</td>
                <td style={S.td}><span style={{ fontSize:'11px', background:'rgba(255,255,255,0.06)', borderRadius:'5px', padding:'2px 8px', color:'rgba(255,255,255,0.45)' }}>{t.type}</span></td>
                <td style={{ ...S.td, color:'rgba(255,255,255,0.35)', fontSize:'12px' }}>{t.subject||'—'}</td>
                <td style={{ ...S.td, textAlign:'right' }}>
                  <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end' }}>
                    <button onClick={()=>openEdit(t)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#818cf8'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-edit-alt" /></button>
                    <button onClick={()=>setConfirm(t.id)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-trash" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth:'600px' }}>
          <div style={S.modalH}><p style={S.modalT}>{editing?'Edit Template':'Add Template'}</p><button onClick={()=>setModal(false)} style={S.closeBtn}><i className="bx bx-x" /></button></div>
          <form onSubmit={submit} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={S.label}>Name <span style={{ color:'#f87171' }}>*</span></label><input required style={S.input} type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
              <div><label style={S.label}>Type <span style={{ color:'#f87171' }}>*</span></label>
                <select required style={S.select} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div><label style={S.label}>Subject</label><input style={S.input} type="text" value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} /></div>
            <div><label style={S.label}>Body</label>
              <textarea style={{ ...S.textarea, fontFamily:'monospace', minHeight:'160px' }} value={form.body} placeholder="Use {{variable}} for dynamic values…" onChange={e=>setForm(p=>({...p,body:e.target.value}))} />
            </div>
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
