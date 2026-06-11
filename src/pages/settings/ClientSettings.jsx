import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function ClientSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('clients');

  return (
    <SettingsLayout title="Client Settings" subtitle="Defaults for client management" accent="#34d399">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Defaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Client Status</label>
                <select value={settings.defaultStatus ?? 'active'} onChange={e => update('defaultStatus', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Client Code Prefix</label>
                <input type="text" value={settings.codePrefix ?? 'CLT-'} onChange={e => update('codePrefix', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="reqContact" checked={!!settings.requireContact} onChange={e => update('requireContact', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="reqContact" className="text-slate-300 text-sm cursor-pointer">Require contact info on new clients</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="autoCode" checked={!!settings.autoGenerateCode} onChange={e => update('autoGenerateCode', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="autoCode" className="text-slate-300 text-sm cursor-pointer">Auto-generate client codes</label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={!dirty || saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
