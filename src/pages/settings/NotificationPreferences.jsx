import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

const PREFS = [
  { key: 'timesheetSubmitted',  label: 'Timesheet submitted' },
  { key: 'timesheetApproved',   label: 'Timesheet approved/rejected' },
  { key: 'projectAssigned',     label: 'Assigned to a project' },
  { key: 'taskAssigned',        label: 'Assigned to a task' },
  { key: 'budgetAlert',         label: 'Budget threshold alert' },
  { key: 'deadlineAlert',       label: 'Deadline approaching' },
  { key: 'systemAnnouncements', label: 'System announcements' },
];

export default function NotificationPreferences() {
  const { settings, loading, saving, dirty, update, save } = useSettings('notifications');

  return (
    <SettingsLayout title="Notification Preferences" subtitle="Control which events trigger notifications" accent="#fb923c">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">In-App Notifications</h2>
            <div className="space-y-3">
              {PREFS.map(p => (
                <div key={p.key} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <span className="text-slate-300 text-sm">{p.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings[p.key] !== false}
                      onChange={e => update(p.key, e.target.checked)} />
                    <div className="w-10 h-5 bg-slate-600 peer-checked:bg-indigo-600 rounded-full transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Email Digest</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Digest Frequency</label>
              <select value={settings.emailDigest ?? 'daily'} onChange={e => update('emailDigest', e.target.value)}
                className="w-48 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
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
