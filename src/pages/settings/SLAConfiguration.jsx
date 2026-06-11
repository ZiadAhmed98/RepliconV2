import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS = [
  { key: 'name',            label: 'Tier Name',              required: true },
  { key: 'priority',        label: 'Priority Level',         type: 'number', min: 0 },
  { key: 'responseHours',   label: 'Response Time (hours)',  type: 'number', min: 0, step: 0.5 },
  { key: 'resolutionHours', label: 'Resolution Time (hours)', type: 'number', min: 0, step: 0.5 },
  { key: 'color',           label: 'Color',                  type: 'color' },
];

const COLUMNS = [
  { key: 'name',            label: 'Tier' },
  { key: 'priority',        label: 'Priority' },
  { key: 'responseHours',   label: 'Response', render: v => `${v}h` },
  { key: 'resolutionHours', label: 'Resolution', render: v => `${v}h` },
  { key: 'color', label: 'Color', render: v => (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full" style={{ background: v }} />
    </div>
  )},
];

export default function SLAConfiguration() {
  const { items, loading, create, update, remove } = useCrud('sla-tiers');
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({});
  const [busy,  setBusy]  = useState(false);

  function openAdd()   { setForm({ color: '#60a5fa', responseHours: 4, resolutionHours: 24, priority: 0 }); setModal('add'); }
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
    <SettingsLayout title="SLA Configuration" subtitle="Service Level Agreement tiers and response targets" accent="#34d399">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal === 'add' ? 'Add SLA Tier' : 'Edit SLA Tier'} fields={FIELDS} values={form}
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={submit} onClose={() => setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
