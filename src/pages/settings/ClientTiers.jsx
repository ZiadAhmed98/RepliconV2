import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS = [
  { key: 'name',        label: 'Name',        required: true },
  { key: 'level',       label: 'Priority Level', type: 'number', min: 0 },
  { key: 'color',       label: 'Color',        type: 'color' },
  { key: 'description', label: 'Description' },
];

const COLUMNS = [
  { key: 'name',  label: 'Tier Name' },
  { key: 'level', label: 'Priority' },
  { key: 'color', label: 'Color', render: v => (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full" style={{ background: v }} />
      <span>{v}</span>
    </div>
  )},
  { key: 'description', label: 'Description' },
];

export default function ClientTiers() {
  const { items, loading, create, update, remove } = useCrud('client-tiers');
  const [modal,  setModal] = useState(null);
  const [form,   setForm]  = useState({});
  const [busy,   setBusy]  = useState(false);

  function openAdd()   { setForm({ color: '#34d399', level: 0 }); setModal('add'); }
  function openEdit(i) { setForm({ ...i }); setModal(i.id); }

  async function submit() {
    setBusy(true);
    try {
      if (modal === 'add') await create(form);
      else await update(modal, form);
      setModal(null);
    } finally { setBusy(false); }
  }

  return (
    <SettingsLayout title="Client Tiers" subtitle="Define client priority tiers" accent="#34d399">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal === 'add' ? 'Add Tier' : 'Edit Tier'} fields={FIELDS} values={form}
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={submit} onClose={() => setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
