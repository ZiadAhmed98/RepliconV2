import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS  = [{ key:'name',label:'Name',required:true },{ key:'code',label:'Code' },{ key:'description',label:'Description' }];
const COLUMNS = [
  { key:'name',        label:'Name' },
  { key:'code',        label:'Code',        render: v=>v||'—' },
  { key:'description', label:'Description', render: v=>v||'—' },
];

export default function CostCenters() {
  const { items, loading, create, update, remove } = useCrud('cost-centers');
  const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [busy,setBusy]=useState(false);
  function openAdd()   { setForm({}); setModal('add'); }
  function openEdit(i) { setForm({...i}); setModal(i.id); }
  async function submit() { setBusy(true); try { if(modal==='add') await create(form); else await update(modal,form); setModal(null); } finally { setBusy(false); } }
  return (
    <SettingsLayout title="Cost Centers" subtitle="Organizational cost centers for financial tracking" accent="#f472b6">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal==='add'?'Add Cost Center':'Edit Cost Center'} fields={FIELDS} values={form}
        onChange={(k,v)=>setForm(p=>({...p,[k]:v}))} onSubmit={submit} onClose={()=>setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
