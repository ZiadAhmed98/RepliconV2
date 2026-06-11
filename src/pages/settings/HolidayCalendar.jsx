import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const FIELDS  = [{ key:'name',label:'Holiday Name',required:true },{ key:'date',label:'Date',type:'date',required:true },{ key:'recurring',label:'Recurring',type:'checkbox',checkLabel:'Repeat annually' }];
const COLUMNS = [
  { key:'name',  label:'Holiday' },
  { key:'date',  label:'Date' },
  { key:'recurring', label:'Type', render: v => <span style={S.badge(v)}>{v ? 'Annual' : 'One-time'}</span> },
];

export default function HolidayCalendar() {
  const { items, loading, create, remove } = useCrud('holidays');
  const [modal,setModal]=useState(false); const [form,setForm]=useState({recurring:false}); const [busy,setBusy]=useState(false);
  async function submit() { setBusy(true); try { await create(form); setModal(false); } finally { setBusy(false); } }
  return (
    <SettingsLayout title="Holiday Calendar" subtitle="Define public holidays and non-working days" accent="#60a5fa">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={() => { setForm({recurring:false}); setModal(true); }} onDelete={remove} />
      {modal && <ModalForm title="Add Holiday" fields={FIELDS} values={form}
        onChange={(k,v)=>setForm(p=>({...p,[k]:v}))} onSubmit={submit} onClose={()=>setModal(false)} submitting={busy} />}
    </SettingsLayout>
  );
}
