import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

export default function ProjectTemplates() {
  const { items, loading, create, update, remove } = useCrud('project-templates');
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ name: '', description: '', billingType: 'time_material', estimatedHours: 0, tasks: [] });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  function openAdd()  { setForm({ name: '', description: '', billingType: 'time_material', estimatedHours: 0, tasks: [] }); setEditing(null); setModal(true); }
  function openEdit(t){ setForm({ ...t }); setEditing(t.id); setModal(true); }
  function addTask()  { setForm(p => ({ ...p, tasks: [...(p.tasks||[]), { name: '', estimatedHours: 0 }] })); }
  function rmTask(i)  { setForm(p => ({ ...p, tasks: p.tasks.filter((_,idx) => idx !== i) })); }
  function updTask(i,k,v){ setForm(p => { const t=[...p.tasks]; t[i]={...t[i],[k]:v}; return {...p,tasks:t}; }); }

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { if (editing) await update(editing, form); else await create(form); setModal(false); } finally { setBusy(false); }
  }

  if (loading) return <SettingsLayout title="Project Templates" accent="#818cf8"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Project Templates" subtitle="Reusable project blueprints with predefined tasks" accent="#818cf8">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button onClick={openAdd} style={S.addBtn}><i className="bx bx-plus" style={{ fontSize: '14px' }} /> Add Template</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 && <p style={{ ...S.muted, textAlign: 'center', padding: '32px' }}>No templates yet.</p>}
        {items.map(t => (
          <div key={t.id} style={S.card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#fff' }}>{t.name}</p>
                {t.description && <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{t.description}</p>}
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                  <span>{t.billingType?.replace('_',' ')}</span>
                  <span>{t.estimatedHours}h estimated</span>
                  <span>{(t.tasks||[]).length} tasks</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                <button onClick={() => openEdit(t)} style={S.iconBtn} onMouseEnter={e => e.currentTarget.style.color='#818cf8'} onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-edit-alt" /></button>
                <button onClick={() => setConfirm(t.id)} style={S.iconBtn} onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.3)'}><i className="bx bx-trash" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirm && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: '340px', padding: '24px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#fff' }}>Delete template?</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={S.cancelBtn}>Cancel</button>
              <button onClick={() => { remove(confirm); setConfirm(null); }} style={S.deleteBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalH}>
              <p style={S.modalT}>{editing ? 'Edit Template' : 'Add Template'}</p>
              <button onClick={() => setModal(false)} style={S.closeBtn}><i className="bx bx-x" /></button>
            </div>
            <form onSubmit={submit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={S.label}>Name <span style={{ color: '#f87171' }}>*</span></label>
                <input required style={S.input} type="text" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div>
                <label style={S.label}>Description</label>
                <textarea style={S.textarea} rows={2} value={form.description??''} onChange={e => setForm(p=>({...p,description:e.target.value}))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={S.label}>Billing Type</label>
                  <select style={S.select} value={form.billingType??'time_material'} onChange={e => setForm(p=>({...p,billingType:e.target.value}))}>
                    <option value="time_material">Time & Material</option>
                    <option value="fixed_price">Fixed Price</option>
                    <option value="retainer">Retainer</option>
                    <option value="non_billable">Non-Billable</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Estimated Hours</label>
                  <input style={S.input} type="number" min={0} step={0.5} value={form.estimatedHours??0} onChange={e => setForm(p=>({...p,estimatedHours:Number(e.target.value)}))} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={S.label}>Tasks</label>
                  <button type="button" onClick={addTask} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>+ Add Task</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(form.tasks||[]).map((t,i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input style={{ ...S.input, flex: 1 }} type="text" placeholder="Task name" value={t.name} onChange={e => updTask(i,'name',e.target.value)} />
                      <input style={{ ...S.input, width: '80px' }} type="number" min={0} step={0.5} value={t.estimatedHours??0} onChange={e => updTask(i,'estimatedHours',Number(e.target.value))} />
                      <button type="button" onClick={() => rmTask(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" disabled={busy} style={{ ...S.saveBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
