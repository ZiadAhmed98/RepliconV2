import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function ApprovalWorkflow() {
  const { settings, loading, saving, dirty, update, save } = useSettings('approval');

  return (
    <SettingsLayout title="Approval Workflow" subtitle="Timesheet and expense approval chain configuration" accent="#60a5fa">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Approval Chain</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Approval Mode</label>
                <select value={settings.mode ?? 'single'} onChange={e => update('mode', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="single">Single Approver</option>
                  <option value="sequential">Sequential (multi-level)</option>
                  <option value="auto">Auto-approve</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Auto-approve after (hours)</label>
                <input type="number" min={0} value={settings.autoApproveHours ?? 0} onChange={e => update('autoApproveHours', Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                <p className="text-xs text-slate-500 mt-1">Set to 0 to disable auto-approval.</p>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="notifyOnSubmit" checked={!!settings.notifyOnSubmit} onChange={e => update('notifyOnSubmit', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="notifyOnSubmit" className="text-slate-300 text-sm cursor-pointer">Notify approver on timesheet submission</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="notifyOnApprove" checked={!!settings.notifyOnApprove} onChange={e => update('notifyOnApprove', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="notifyOnApprove" className="text-slate-300 text-sm cursor-pointer">Notify employee on approval/rejection</label>
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
