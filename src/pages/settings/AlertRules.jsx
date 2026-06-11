import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const TRIGGERS = [
  { value:'budget_pct',        label:'Budget % used' },
  { value:'deadline_days',     label:'Days until deadline' },
  { value:'hours_overtime',    label:'Hours in overtime' },
  { value:'timesheet_missing', label:'Missing timesheet submission' },
];

const FIELDS = [
  { key:'name',      label:'Rule Name', required:true },
  { key:'trigger',   label:'Trigger',   type:'select', options:TRIGGERS },
  { key:'threshold', label:'Threshold Value', type:'number', step:0.1 },
  { key:'active',    label:'Active',    type:'checkbox', checkLabel:'Enabled' },
];

const COLUMNS = [
  { key:'name',      label:'Rule' },
  { key:'trigger',   label:'Trigger', render: v => TRIGGERS.find(t=>t.value===v)?.label||v },
  { key:'threshold', label:'Threshold', render: v => v??'—' },
  { key:'active',    label:'Status', render: v => <span style={S.badge(v)}>{v?'Active':'Off'}</span> },
];

export default function AlertRules() {
  const { items, loading, create, update, remove } = useCrud('alert-rules');
  const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [busy,setBusy]=useState(false);
  function openAdd()   { setForm({trigger:TRIGGERS[0].value,active:true}); setModal('add'); }
  function openEdit(i) { setForm({...i,active:!!i.active}); setModal(i.id); }
  async function submit() { setBusy(true); try { if(modal==='add') await create(form); else await update(modal,form); setModal(null); } finally { setBusy(false); } }
  return (
    <SettingsLayout title="Alert Rules" subtitle="Configure automatic system alerts and notifications" accent="#fb923c">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal==='add'?'Add Alert Rule':'Edit Alert Rule'} fields={FIELDS} values={form}
        onChange={(k,v)=>setForm(p=>({...p,[k]:v}))} onSubmit={submit} onClose={()=>setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
