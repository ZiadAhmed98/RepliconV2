import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function TaskSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('tasks');

  return (
    <SettingsLayout title="Task Settings" subtitle="Defaults and rules for task management" accent="#fbbf24">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Defaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Task Status</label>
                <select value={settings.defaultStatus ?? 'open'} onChange={e => update('defaultStatus', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Default Estimated Hours</label>
                <input type="number" min={0} step={0.5} value={settings.defaultEstimatedHours ?? 8} onChange={e => update('defaultEstimatedHours', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="allowSubtasks" checked={!!settings.allowSubtasks} onChange={e => update('allowSubtasks', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="allowSubtasks" className="text-slate-300 text-sm cursor-pointer">Allow nested subtasks</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="requireAssignee" checked={!!settings.requireAssignee} onChange={e => update('requireAssignee', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="requireAssignee" className="text-slate-300 text-sm cursor-pointer">Require assignee before activating</label>
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
