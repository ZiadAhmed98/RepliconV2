import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';

const TYPES = [
  'timesheet_submitted','timesheet_approved','timesheet_rejected',
  'project_assigned','task_assigned','welcome','password_reset','notification',
];

export default function EmailTemplates() {
  const { items, loading, create, update, remove } = useCrud('email-templates');
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ type: TYPES[0], name: '', subject: '', body: '' });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  function openAdd()   { setForm({ type: TYPES[0], name: '', subject: '', body: '' }); setEditing(null); setModal(true); }
  function openEdit(t) { setForm({ ...t }); setEditing(t.id); setModal(true); }

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
    <SettingsLayout title="Email Templates" subtitle="Customize system notification emails" accent="#fb923c">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <i className="bx bx-plus" /> Add Template
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Subject</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No email templates yet.</td></tr>
                ) : items.map(t => (
                  <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-300">{t.name}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{t.type}</span></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{t.subject || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-400"><i className="bx bx-edit-alt" /></button>
                        <button onClick={() => setConfirm(t.id)} className="p-1.5 text-slate-400 hover:text-red-400"><i className="bx bx-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80">
                <p className="text-white font-semibold mb-2">Delete template?</p>
                <div className="flex gap-3 justify-end mt-4">
                  <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg">Cancel</button>
                  <button onClick={() => { remove(confirm); setConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>
                </div>
              </div>
            </div>
          )}

          {modal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
                  <h3 className="text-white font-semibold">{editing ? 'Edit Template' : 'Add Template'}</h3>
                  <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><i className="bx bx-x text-xl" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
                      <input required type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Type <span className="text-red-400">*</span></label>
                      <select required value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Subject</label>
                    <input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Body</label>
                    <textarea rows={8} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                      placeholder="Use {{variable}} for dynamic values…"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none font-mono" />
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
