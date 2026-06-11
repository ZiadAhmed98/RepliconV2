import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';

const LAYOUTS = { standard: 'Standard', compact: 'Compact', detailed: 'Detailed' };

export default function InvoiceTemplates() {
  const { items, loading, create, remove } = useCrud('invoice-templates');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ name: '', layout: 'standard', logoUrl: '' });
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try { await create(form); setModal(false); } finally { setBusy(false); }
  }

  return (
    <SettingsLayout title="Invoice Templates" subtitle="Manage invoice layout and branding templates" accent="#f472b6">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setForm({ name: '', layout: 'standard', logoUrl: '' }); setModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <i className="bx bx-plus" /> Add Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.length === 0 && <p className="text-slate-500 text-sm col-span-2 text-center py-8">No templates yet.</p>}
            {items.map(t => (
              <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start justify-between">
                <div>
                  <p className="text-white font-medium">{t.name}</p>
                  <p className="text-slate-400 text-xs mt-1">{LAYOUTS[t.layout] || t.layout} layout</p>
                </div>
                <button onClick={() => setConfirm(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><i className="bx bx-trash" /></button>
              </div>
            ))}
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
                  <h3 className="text-white font-semibold">Add Invoice Template</h3>
                  <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><i className="bx bx-x text-xl" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
                    <input required type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Layout</label>
                    <select value={form.layout} onChange={e => setForm(p => ({ ...p, layout: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                      {Object.entries(LAYOUTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Logo URL</label>
                    <input type="url" value={form.logoUrl} onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
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
