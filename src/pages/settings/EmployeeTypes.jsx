import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';

const FIELDS = [
  { key: 'name',        label: 'Name', required: true },
  { key: 'code',        label: 'Code' },
  { key: 'description', label: 'Description' },
];
const COLUMNS = [
  { key: 'name',        label: 'Name' },
  { key: 'code',        label: 'Code',        render: v => v || '—' },
  { key: 'description', label: 'Description', render: v => v || '—' },
];

export default function EmployeeTypes() {
  const { items, loading, create, update, remove } = useCrud('employee-types');
  const [modal, setModal] = useState(null); const [form, setForm] = useState({}); const [busy, setBusy] = useState(false);
  const openAdd  = () => { setForm({}); setModal('add'); };
  const openEdit = (i) => { setForm({ ...i }); setModal(i.id); };
  const submit   = async () => { setBusy(true); try { if (modal === 'add') await create(form); else await update(modal, form); setModal(null); } finally { setBusy(false); } };
  return (
    <SettingsLayout title="Employee Types" subtitle="Job classifications assigned to employees (e.g. GM, PM, SSA)" accent="#a78bfa">
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal === 'add' ? 'Add Employee Type' : 'Edit Employee Type'} fields={FIELDS} values={form}
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSubmit={submit} onClose={() => setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
