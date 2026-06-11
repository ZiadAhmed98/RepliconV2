import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function BillingSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('billing');

  return (
    <SettingsLayout title="Billing Settings" subtitle="Invoice and billing defaults" accent="#818cf8">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Invoice Defaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Payment Terms (days)</label>
                <input type="number" min={0} value={settings.paymentTermsDays ?? 30} onChange={e => update('paymentTermsDays', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Tax Rate (%)</label>
                <input type="number" min={0} max={100} step={0.1} value={settings.taxRate ?? 0} onChange={e => update('taxRate', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Invoice Prefix</label>
                <input type="text" value={settings.invoicePrefix ?? 'INV-'} onChange={e => update('invoicePrefix', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Rounding</label>
                <select value={settings.rounding ?? 'nearest'} onChange={e => update('rounding', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="nearest">Nearest</option>
                  <option value="up">Always Up</option>
                  <option value="down">Always Down</option>
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
