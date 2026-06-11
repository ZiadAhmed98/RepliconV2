import { useState } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { useCrud }    from '../../hooks/useSettings';

export default function APIKeys() {
  const { items, loading, remove, reload } = useCrud('api-keys');
  const [modal,   setModal]   = useState(false);
  const [name,    setName]    = useState('');
  const [busy,    setBusy]    = useState(false);
  const [newKey,  setNewKey]  = useState(null);
  const [confirm, setConfirm] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r    = await fetch('/api/v1/admin/api-keys', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name }),
      });
      const data = await r.json();
      if (data.fullKey) setNewKey(data.fullKey);
      setModal(false);
      reload();
    } finally { setBusy(false); }
  }

  return (
    <SettingsLayout title="API Keys" subtitle="Manage programmatic access credentials" accent="#2dd4bf">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setName(''); setModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <i className="bx bx-plus" /> Generate Key
            </button>
          </div>

          {newKey && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-400 text-sm font-semibold mb-2">Save this key — it won't be shown again.</p>
              <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <code className="flex-1 text-green-400 text-sm font-mono break-all">{newKey}</code>
                <button onClick={() => navigator.clipboard.writeText(newKey)} className="text-slate-400 hover:text-white ml-2">
                  <i className="bx bx-copy" />
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-slate-500 hover:text-white">Dismiss</button>
            </div>
          )}

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Key Preview</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No API keys yet.</td></tr>
                ) : items.map(k => (
                  <tr key={k.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-300">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">{k.keyPreview}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{k.createdAt?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setConfirm(k.id)} className="p-1.5 text-slate-400 hover:text-red-400">
                        <i className="bx bx-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80">
                <p className="text-white font-semibold mb-2">Revoke API key?</p>
                <p className="text-slate-400 text-sm">Any integrations using this key will stop working immediately.</p>
                <div className="flex gap-3 justify-end mt-4">
                  <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg">Cancel</button>
                  <button onClick={() => { remove(confirm); setConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Revoke</button>
                </div>
              </div>
            </div>
          )}

          {modal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                  <h3 className="text-white font-semibold">Generate API Key</h3>
                  <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><i className="bx bx-x text-xl" /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Key Name <span className="text-red-400">*</span></label>
                    <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CI Pipeline, Mobile App"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-600 text-slate-400 rounded-lg">Cancel</button>
                    <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Generating…' : 'Generate'}</button>
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
