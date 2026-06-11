import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS = [
  { key: 'name',      label: 'Holiday Name', required: true },
  { key: 'date',      label: 'Date',         type: 'date', required: true },
  { key: 'recurring', label: 'Recurring',    type: 'checkbox', checkLabel: 'Repeat annually' },
];

const COLUMNS = [
  { key: 'name', label: 'Holiday' },
  { key: 'date', label: 'Date' },
  { key: 'recurring', label: 'Recurring', render: v => <span className={`text-xs px-2 py-0.5 rounded-full ${v ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-600 text-slate-400'}`}>{v ? 'Annual' : 'One-time'}</span> },
];

export default function HolidayCalendar() {
  const { items, loading, create, remove } = useCrud('holidays');
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState({ recurring: false });
  const [busy,  setBusy]  = useState(false);

  async function submit() {
    setBusy(true);
    try { await create(form); setModal(false); } finally { setBusy(false); }
  }

  return (
    <SettingsLayout title="Holiday Calendar" subtitle="Define public holidays and non-working days" accent="#60a5fa">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={() => { setForm({ recurring: false }); setModal(true); }} onDelete={remove} />
      {modal && <ModalForm title="Add Holiday" fields={FIELDS} values={form}
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={submit} onClose={() => setModal(false)} submitting={busy} />}
    </SettingsLayout>
  );
}
