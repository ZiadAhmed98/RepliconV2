import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';

const ALL_EVENTS = [
  'timesheet.submitted','timesheet.approved','timesheet.rejected',
  'project.created','project.updated','project.deleted',
  'employee.created','employee.updated',
];

export default function Webhooks() {
  const { items, loading, create, update, remove } = useCrud('webhooks');
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ name: '', url: '', events: [], active: true });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  function openAdd()   { setForm({ name: '', url: '', events: [], active: true }); setEditing(null); setModal(true); }
  function openEdit(w) { setForm({ ...w, active: !!w.active }); setEditing(w.id); setModal(true); }

  function toggleEvent(ev) {
    setForm(p => ({
      ...p,
      events: p.events.includes(ev) ? p.events.filter(e => e !== ev) : [...p.events, ev],
    }));
  }

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
    <SettingsLayout title="Webhooks" subtitle="Push real-time event notifications to external endpoints" accent="#2dd4bf">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <i className="bx bx-plus" /> Add Webhook
            </button>
          </div>

          <div className="space-y-3">
            {items.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No webhooks yet.</p>}
            {items.map(w => (
              <div key={w.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{w.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${w.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}>{w.active ? 'Active' : 'Paused'}</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1 font-mono truncate">{w.url}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(w.events || []).map(ev => (
                        <span key={ev} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button onClick={() => openEdit(w)} className="p-1.5 text-slate-400 hover:text-indigo-400"><i className="bx bx-edit-alt" /></button>
                    <button onClick={() => setConfirm(w.id)} className="p-1.5 text-slate-400 hover:text-red-400"><i className="bx bx-trash" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {confirm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80">
                <p className="text-white font-semibold mb-2">Delete webhook?</p>
                <div className="flex gap-3 justify-end mt-4">
                  <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg">Cancel</button>
                  <button onClick={() => { remove(confirm); setConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>
                </div>
              </div>
            </div>
          )}

          {modal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                  <h3 className="text-white font-semibold">{editing ? 'Edit Webhook' : 'Add Webhook'}</h3>
                  <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><i className="bx bx-x text-xl" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
                    <input required type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Endpoint URL <span className="text-red-400">*</span></label>
                    <input required type="url" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Events to Subscribe</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ALL_EVENTS.map(ev => (
                        <label key={ev} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} className="w-3.5 h-3.5 rounded" />
                          <span className="text-slate-300 text-xs">{ev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="wActive" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="w-4 h-4 rounded" />
                    <label htmlFor="wActive" className="text-slate-300 text-sm cursor-pointer">Active</label>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg">Cancel</button>
                    <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
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
