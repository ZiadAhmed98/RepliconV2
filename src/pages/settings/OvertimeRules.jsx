import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function OvertimeRules() {
  const { settings, loading, saving, dirty, update, save } = useSettings('overtime');

  return (
    <SettingsLayout title="Overtime Rules" subtitle="Configure overtime thresholds and multipliers" accent="#60a5fa">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Thresholds</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Daily Overtime Threshold (hours)</label>
                <input type="number" min={0} max={24} step={0.5} value={settings.dailyThreshold ?? 8} onChange={e => update('dailyThreshold', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Weekly Overtime Threshold (hours)</label>
                <input type="number" min={0} max={168} step={0.5} value={settings.weeklyThreshold ?? 40} onChange={e => update('weeklyThreshold', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Overtime Rate Multiplier</label>
                <input type="number" min={1} max={5} step={0.1} value={settings.multiplier ?? 1.5} onChange={e => update('multiplier', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Double-time Multiplier</label>
                <input type="number" min={1} max={5} step={0.1} value={settings.doubleTimeMultiplier ?? 2} onChange={e => update('doubleTimeMultiplier', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="trackOT" checked={!!settings.trackOvertime} onChange={e => update('trackOvertime', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="trackOT" className="text-slate-300 text-sm cursor-pointer">Track overtime hours separately</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="reqApprove" checked={!!settings.requireApproval} onChange={e => update('requireApproval', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="reqApprove" className="text-slate-300 text-sm cursor-pointer">Require manager approval for overtime</label>
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
