import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function Localization() {
  const { settings, loading, saving, dirty, update, save } = useSettings('localization');

  return (
    <SettingsLayout title="Localization" subtitle="Language, currency, and regional settings" accent="#94a3b8">
      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Regional</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Language</label>
                <select value={settings.language ?? 'en'} onChange={e => update('language', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Currency</label>
                <select value={settings.currency ?? 'USD'} onChange={e => update('currency', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {['USD','EUR','GBP','AED','SAR','EGP'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Number Format</label>
                <select value={settings.numberFormat ?? '1,234.56'} onChange={e => update('numberFormat', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="1,234.56">1,234.56 (US)</option>
                  <option value="1.234,56">1.234,56 (EU)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">First Day of Week</label>
                <select value={settings.firstDayOfWeek ?? 'sunday'} onChange={e => update('firstDayOfWeek', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                </select>
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
