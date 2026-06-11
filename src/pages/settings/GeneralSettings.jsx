import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function GeneralSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('general');

  return (
    <SettingsLayout title="General Settings" subtitle="Application-wide configuration" accent="#94a3b8">
      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Application</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Application Name</label>
                <input
                  type="text"
                  value={settings.appName ?? 'MDS Premium Dashboard'}
                  onChange={e => update('appName', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail ?? ''}
                  onChange={e => update('supportEmail', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Timezone</label>
                <select
                  value={settings.timezone ?? 'UTC'}
                  onChange={e => update('timezone', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  {['UTC','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Dubai','Asia/Singapore'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date Format</label>
                <select
                  value={settings.dateFormat ?? 'MM/DD/YYYY'}
                  onChange={e => update('dateFormat', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  {['MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Session</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Session Timeout (minutes)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={settings.sessionTimeout ?? 60}
                onChange={e => update('sessionTimeout', Number(e.target.value))}
                className="w-40 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
