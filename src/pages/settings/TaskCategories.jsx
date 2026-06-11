import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS  = [{ key:'name',label:'Name',required:true },{ key:'color',label:'Color',type:'color' }];
const COLUMNS = [
  { key:'name',  label:'Name' },
  { key:'color', label:'Color', render: v => (
    <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
      <div style={{ width:'14px',height:'14px',borderRadius:'50%',background:v }} />
      <span style={{ fontFamily:'monospace',fontSize:'12px' }}>{v}</span>
    </div>
  )},
];

export default function TaskCategories() {
  const { items, loading, create, update, remove } = useCrud('task-categories');
  const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [busy,setBusy]=useState(false);
  function openAdd()   { setForm({color:'#fbbf24'}); setModal('add'); }
  function openEdit(i) { setForm({...i}); setModal(i.id); }
  async function submit() { setBusy(true); try { if(modal==='add') await create(form); else await update(modal,form); setModal(null); } finally { setBusy(false); } }
  return (
    <SettingsLayout title="Task Categories" subtitle="Classify tasks by category" accent="#fbbf24">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal==='add'?'Add Category':'Edit Category'} fields={FIELDS} values={form}
        onChange={(k,v)=>setForm(p=>({...p,[k]:v}))} onSubmit={submit} onClose={()=>setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
