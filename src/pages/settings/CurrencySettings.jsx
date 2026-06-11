import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

const CURRENCIES = ['USD','EUR','GBP','AED','SAR','EGP','JPY','CAD','AUD','CHF'];

export default function CurrencySettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('currency');

  return (
    <SettingsLayout title="Currency Settings" subtitle="Multi-currency and exchange rate configuration" accent="#f472b6">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Base Currency</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Base Currency</label>
                <select value={settings.baseCurrency ?? 'USD'} onChange={e => update('baseCurrency', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Exchange Rate Source</label>
                <select value={settings.rateSource ?? 'manual'} onChange={e => update('rateSource', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="manual">Manual</option>
                  <option value="openexchangerates">Open Exchange Rates</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Decimal Places</label>
                <select value={settings.decimalPlaces ?? 2} onChange={e => update('decimalPlaces', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value={0}>0</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Currency Symbol Position</label>
                <select value={settings.symbolPosition ?? 'before'} onChange={e => update('symbolPosition', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="before">Before ($100)</option>
                  <option value="after">After (100$)</option>
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
