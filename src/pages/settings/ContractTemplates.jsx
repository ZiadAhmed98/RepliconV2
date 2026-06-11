import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';

export default function ContractTemplates() {
  const { items, loading, create, remove } = useCrud('contract-templates');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ name: '', type: 'sow', description: '' });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try { await create(form); setModal(false); } finally { setBusy(false); }
  }

  const typeLabel = { sow: 'Statement of Work', nda: 'NDA', msa: 'MSA', other: 'Other' };

  return (
    <SettingsLayout title="Contract Templates" subtitle="Standard contract types for client engagements" accent="#34d399">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setForm({ name: '', type: 'sow', description: '' }); setModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <i className="bx bx-plus" /> Add Template
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No templates yet.</td></tr>
                ) : items.map(t => (
                  <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{t.name}</td>
                    <td className="px-4 py-3 text-slate-300">{typeLabel[t.type] || t.type}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{t.description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setConfirm(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><i className="bx bx-trash" /></button>
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
              <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                  <h3 className="text-white font-semibold">Add Contract Template</h3>
                  <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><i className="bx bx-x text-xl" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
                    <input required type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Type</label>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                      <option value="sow">Statement of Work</option>
                      <option value="nda">NDA</option>
                      <option value="msa">MSA</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                    <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
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
