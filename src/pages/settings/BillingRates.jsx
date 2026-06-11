import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const CURRENCIES = ['USD','EUR','GBP','AED','SAR','EGP'].map(c => ({ value:c, label:c }));

const FIELDS = [
  { key:'role',          label:'Role / Resource Type',  required:true },
  { key:'rate',          label:'Hourly Rate',            type:'number', min:0, step:0.01, required:true },
  { key:'currency',      label:'Currency',               type:'select', options:CURRENCIES },
  { key:'effectiveDate', label:'Effective Date',         type:'date' },
];

const COLUMNS = [
  { key:'role',  label:'Role' },
  { key:'rate',  label:'Rate', render:(v,row) => `${row.currency||'USD'} ${Number(v).toFixed(2)}/hr` },
  { key:'effectiveDate', label:'Effective Date', render: v => v||'—' },
];

export default function BillingRates() {
  const { items, loading, create, update, remove } = useCrud('billing-rates');
  const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [busy,setBusy]=useState(false);
  function openAdd()   { setForm({currency:'USD',rate:0}); setModal('add'); }
  function openEdit(i) { setForm({...i}); setModal(i.id); }
  async function submit() { setBusy(true); try { if(modal==='add') await create(form); else await update(modal,form); setModal(null); } finally { setBusy(false); } }
  return (
    <SettingsLayout title="Billing Rates" subtitle="Set hourly rates by role or resource type" accent="#f472b6">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal==='add'?'Add Rate':'Edit Rate'} fields={FIELDS} values={form}
        onChange={(k,v)=>setForm(p=>({...p,[k]:v}))} onSubmit={submit} onClose={()=>setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
