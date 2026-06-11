import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';

export default function CalendarIntegration() {
  const { settings, loading, saving, dirty, update, save } = useSettings('calendar');

  return (
    <SettingsLayout title="Calendar Integration" subtitle="Connect external calendar systems" accent="#2dd4bf">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Google Calendar</h2>
                <p className="text-slate-400 text-xs mt-0.5">Sync project deadlines and milestones</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={!!settings.googleEnabled} onChange={e => update('googleEnabled', e.target.checked)} />
                <div className="w-10 h-5 bg-slate-600 peer-checked:bg-indigo-600 rounded-full transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
            {settings.googleEnabled && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Google Calendar ID</label>
                <input type="text" value={settings.googleCalendarId ?? ''} onChange={e => update('googleCalendarId', e.target.value)}
                  placeholder="primary or calendar@group.calendar.google.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Microsoft Outlook</h2>
                <p className="text-slate-400 text-xs mt-0.5">Sync via Microsoft Graph API</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={!!settings.outlookEnabled} onChange={e => update('outlookEnabled', e.target.checked)} />
                <div className="w-10 h-5 bg-slate-600 peer-checked:bg-indigo-600 rounded-full transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
            {settings.outlookEnabled && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tenant ID</label>
                <input type="text" value={settings.outlookTenantId ?? ''} onChange={e => update('outlookTenantId', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-3">iCal Feed</h2>
            <p className="text-slate-400 text-xs mb-3">Subscribe to project deadlines via iCal URL</p>
            <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2">
              <i className="bx bx-link text-slate-400" />
              <span className="text-slate-400 text-sm font-mono">/api/v1/calendar/feed.ics</span>
              <button className="ml-auto text-xs text-indigo-400 hover:text-indigo-300">Copy</button>
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
