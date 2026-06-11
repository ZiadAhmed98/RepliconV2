import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function Branding() {
  const { settings, loading, saving, dirty, update, save } = useSettings('branding');

  return (
    <SettingsLayout title="Branding" subtitle="Logo, colors, and visual identity" accent="#94a3b8">
      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Company Name</label>
                <input type="text" value={settings.companyName ?? ''} onChange={e => update('companyName', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Logo URL</label>
                <input type="url" value={settings.logoUrl ?? ''} onChange={e => update('logoUrl', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.primaryColor ?? '#818cf8'} onChange={e => update('primaryColor', e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" />
                  <input type="text" value={settings.primaryColor ?? '#818cf8'} onChange={e => update('primaryColor', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Favicon URL</label>
                <input type="url" value={settings.faviconUrl ?? ''} onChange={e => update('faviconUrl', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
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
