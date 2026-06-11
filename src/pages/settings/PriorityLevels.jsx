import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS = [
  { key: 'name',  label: 'Name',           required: true },
  { key: 'level', label: 'Level (0=low)',  type: 'number', min: 0 },
  { key: 'color', label: 'Color',          type: 'color' },
];

const COLUMNS = [
  { key: 'name',  label: 'Priority' },
  { key: 'level', label: 'Level' },
  { key: 'color', label: 'Color', render: v => <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{ background: v }} /><span>{v}</span></div> },
];

export default function PriorityLevels() {
  const { items, loading, create, update, remove } = useCrud('priority-levels');
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({});
  const [busy,  setBusy]  = useState(false);

  function openAdd()   { setForm({ color: '#60a5fa', level: 0 }); setModal('add'); }
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
    <SettingsLayout title="Priority Levels" subtitle="Define task and project priority levels" accent="#fbbf24">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal === 'add' ? 'Add Priority' : 'Edit Priority'} fields={FIELDS} values={form}
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={submit} onClose={() => setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
