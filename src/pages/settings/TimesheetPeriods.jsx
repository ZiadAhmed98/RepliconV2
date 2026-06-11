import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function TimesheetPeriods() {
  const { settings, loading, saving, dirty, update, save } = useSettings('timesheet');

  return (
    <SettingsLayout title="Timesheet Periods" subtitle="Configure timesheet cycles and submission rules" accent="#60a5fa">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Period Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Period Type</label>
                <select value={settings.periodType ?? 'weekly'} onChange={e => update('periodType', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Submission Deadline (days after period end)</label>
                <input type="number" min={0} max={14} value={settings.submissionDeadlineDays ?? 2} onChange={e => update('submissionDeadlineDays', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Daily Hours</label>
                <input type="number" min={1} max={24} step={0.5} value={settings.maxDailyHours ?? 12} onChange={e => update('maxDailyHours', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Standard Weekly Hours</label>
                <input type="number" min={1} max={80} value={settings.standardWeeklyHours ?? 40} onChange={e => update('standardWeeklyHours', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="lockPast" checked={!!settings.lockPastPeriods} onChange={e => update('lockPastPeriods', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="lockPast" className="text-slate-300 text-sm cursor-pointer">Lock past periods after approval</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="allowFuture" checked={!!settings.allowFutureEntry} onChange={e => update('allowFutureEntry', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="allowFuture" className="text-slate-300 text-sm cursor-pointer">Allow future period entries</label>
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
