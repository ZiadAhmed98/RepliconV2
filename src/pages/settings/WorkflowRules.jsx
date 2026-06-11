import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS = [
  { key: 'name',       label: 'Rule Name',    required: true },
  { key: 'entity',     label: 'Entity',       type: 'select', options: [{ value: 'task', label: 'Task' }, { value: 'project', label: 'Project' }, { value: 'timesheet', label: 'Timesheet' }] },
  { key: 'fromStatus', label: 'From Status',  required: true },
  { key: 'toStatus',   label: 'To Status',    required: true },
  { key: 'condition',  label: 'Condition (optional)' },
  { key: 'action',     label: 'Action (optional)' },
  { key: 'active',     label: 'Active',       type: 'checkbox', checkLabel: 'Enabled' },
];

const COLUMNS = [
  { key: 'name',       label: 'Rule' },
  { key: 'entity',     label: 'Entity' },
  { key: 'fromStatus', label: 'From' },
  { key: 'toStatus',   label: 'To' },
  { key: 'active',     label: 'Active', render: v => <span className={`text-xs px-2 py-0.5 rounded-full ${v ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}>{v ? 'Yes' : 'No'}</span> },
];

export default function WorkflowRules() {
  const { items, loading, create, update, remove } = useCrud('workflow-rules');
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({});
  const [busy,  setBusy]  = useState(false);

  function openAdd()   { setForm({ entity: 'task', active: true }); setModal('add'); }
  function openEdit(i) { setForm({ ...i, active: !!i.active }); setModal(i.id); }

  async function submit() {
    setBusy(true);
    try {
      if (modal === 'add') await create(form);
      else await update(modal, form);
      setModal(null);
    } finally { setBusy(false); }
  }

  return (
    <SettingsLayout title="Workflow Rules" subtitle="Automate status transitions and actions" accent="#fbbf24">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal === 'add' ? 'Add Rule' : 'Edit Rule'} fields={FIELDS} values={form}
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={submit} onClose={() => setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
