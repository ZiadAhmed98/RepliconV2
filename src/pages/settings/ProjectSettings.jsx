import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function ProjectSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('projects');

  return (
    <SettingsLayout title="Project Settings" subtitle="Defaults and rules for all projects" accent="#818cf8">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Defaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Billing Type</label>
                <select value={settings.defaultBillingType ?? 'time_material'} onChange={e => update('defaultBillingType', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="time_material">Time & Material</option>
                  <option value="fixed_price">Fixed Price</option>
                  <option value="retainer">Retainer</option>
                  <option value="non_billable">Non-Billable</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Status</label>
                <select value={settings.defaultStatus ?? 'in_progress'} onChange={e => update('defaultStatus', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Budget Alert Threshold (%)</label>
                <input type="number" min={10} max={100} step={5} value={settings.budgetAlertPct ?? 80} onChange={e => update('budgetAlertPct', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input type="checkbox" id="requirePM" checked={!!settings.requireProjectManager} onChange={e => update('requireProjectManager', e.target.checked)}
                  className="w-4 h-4 rounded" />
                <label htmlFor="requirePM" className="text-slate-300 text-sm cursor-pointer">Require Project Manager on all projects</label>
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
