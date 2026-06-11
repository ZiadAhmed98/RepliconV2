import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';

export default function ProjectTemplates() {
  const { items, loading, create, update, remove } = useCrud('project-templates');
  const [modal,  setModal]  = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,   setForm]   = useState({ name: '', description: '', billingType: 'time_material', estimatedHours: 0, tasks: [] });
  const [busy,   setBusy]   = useState(false);
  const [confirm, setConfirm] = useState(null);

  function openAdd()  { setForm({ name: '', description: '', billingType: 'time_material', estimatedHours: 0, tasks: [] }); setEditing(null); setModal(true); }
  function openEdit(t) { setForm({ ...t }); setEditing(t.id); setModal(true); }
  function addTask()  { setForm(p => ({ ...p, tasks: [...(p.tasks || []), { name: '', estimatedHours: 0 }] })); }
  function removeTask(i) { setForm(p => ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) })); }
  function updateTask(i, k, v) { setForm(p => { const t = [...p.tasks]; t[i] = { ...t[i], [k]: v }; return { ...p, tasks: t }; }); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await update(editing, form);
      else await create(form);
      setModal(false);
    } finally { setBusy(false); }
  }

  return (
    <SettingsLayout title="Project Templates" subtitle="Reusable project blueprints with predefined tasks" accent="#818cf8">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <i className="bx bx-plus" /> Add Template
            </button>
          </div>

          <div className="grid gap-4">
            {items.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No templates yet.</p>}
            {items.map(t => (
              <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">{t.name}</p>
                    {t.description && <p className="text-slate-400 text-sm mt-0.5">{t.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>{t.billingType?.replace('_', ' ')}</span>
                      <span>{t.estimatedHours}h estimated</span>
                      <span>{(t.tasks || []).length} tasks</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"><i className="bx bx-edit-alt" /></button>
                    <button onClick={() => setConfirm(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><i className="bx bx-trash" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {confirm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80">
                <p className="text-white font-semibold mb-2">Delete template?</p>
                <p className="text-slate-400 text-sm mb-4">This cannot be undone.</p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 hover:text-white rounded-lg">Cancel</button>
                  <button onClick={() => { remove(confirm); setConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg">Delete</button>
                </div>
              </div>
            </div>
          )}

          {modal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
                  <h3 className="text-white font-semibold">{editing ? 'Edit Template' : 'Add Template'}</h3>
                  <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><i className="bx bx-x text-xl" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
                    <input required type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                    <textarea rows={2} value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Billing Type</label>
                      <select value={form.billingType ?? 'time_material'} onChange={e => setForm(p => ({ ...p, billingType: e.target.value }))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                        <option value="time_material">Time & Material</option>
                        <option value="fixed_price">Fixed Price</option>
                        <option value="retainer">Retainer</option>
                        <option value="non_billable">Non-Billable</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Estimated Hours</label>
                      <input type="number" min={0} step={0.5} value={form.estimatedHours ?? 0} onChange={e => setForm(p => ({ ...p, estimatedHours: Number(e.target.value) }))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-slate-400">Tasks</label>
                      <button type="button" onClick={addTask} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add Task</button>
                    </div>
                    <div className="space-y-2">
                      {(form.tasks || []).map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="text" placeholder="Task name" value={t.name} onChange={e => updateTask(i, 'name', e.target.value)}
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                          <input type="number" min={0} step={0.5} value={t.estimatedHours ?? 0} onChange={e => updateTask(i, 'estimatedHours', Number(e.target.value))}
                            className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                          <button type="button" onClick={() => removeTask(i)} className="text-slate-400 hover:text-red-400"><i className="bx bx-x" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 hover:text-white rounded-lg">Cancel</button>
                    <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg">{busy ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </SettingsLayout>
  );
}
