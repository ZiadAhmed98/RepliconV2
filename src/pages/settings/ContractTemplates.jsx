import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const TYPE_LABEL = { sow: 'Statement of Work', nda: 'NDA', msa: 'MSA', other: 'Other' };

export default function ContractTemplates() {
  const { items, loading, create, remove } = useCrud('contract-templates');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ name: '', type: 'sow', description: '' });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { await create(form); setModal(false); } finally { setBusy(false); }
  }

  if (loading) return <SettingsLayout title="Contract Templates" accent="#34d399"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Contract Templates" subtitle="Standard contract types for client engagements" accent="#34d399">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button onClick={() => { setForm({ name:'',type:'sow',description:'' }); setModal(true); }} style={S.addBtn}>
          <i className="bx bx-plus" style={{ fontSize: '14px' }} /> Add Template
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Name</th><th style={S.th}>Type</th><th style={S.th}>Description</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '32px' }}>No templates yet.</td></tr>
            ) : items.map(t => (
              <tr key={t.id}>
                <td style={S.td}>{t.name}</td>
                <td style={S.td}><span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', padding: '2px 8px', color: 'rgba(255,255,255,0.5)' }}>{TYPE_LABEL[t.type]||t.type}</span></td>
                <td style={{ ...S.td, color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{t.description||'—'}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <button onClick={() => setConfirm(t.id)} style={S.iconBtn} onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth: '340px', padding: '24px' }}>
          <p style={{ margin:'0 0 6px', fontSize:'15px', fontWeight:700, color:'#fff' }}>Delete template?</p>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'20px' }}>
            <button onClick={() => setConfirm(null)} style={S.cancelBtn}>Cancel</button>
            <button onClick={() => { remove(confirm); setConfirm(null); }} style={S.deleteBtn}>Delete</button>
          </div>
        </div></div>
      )}

      {modal && (
        <div style={S.overlay}><div style={S.modal}>
          <div style={S.modalH}><p style={S.modalT}>Add Contract Template</p><button onClick={() => setModal(false)} style={S.closeBtn}><i className="bx bx-x" /></button></div>
          <form onSubmit={submit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label style={S.label}>Name <span style={{ color:'#f87171' }}>*</span></label><input required style={S.input} type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
            <div><label style={S.label}>Type</label>
              <select style={S.select} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                <option value="sow">Statement of Work</option><option value="nda">NDA</option><option value="msa">MSA</option><option value="other">Other</option>
              </select>
            </div>
            <div><label style={S.label}>Description</label><textarea style={S.textarea} rows={3} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button type="button" onClick={() => setModal(false)} style={S.cancelBtn}>Cancel</button>
              <button type="submit" disabled={busy} style={{ ...S.saveBtn, opacity: busy?0.6:1 }}>{busy?'Saving…':'Save'}</button>
            </div>
          </form>
        </div></div>
      )}
    </SettingsLayout>
  );
}
