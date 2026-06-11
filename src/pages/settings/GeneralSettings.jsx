import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function GeneralSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('general');

  if (loading) return <SettingsLayout title="General Settings" accent="#94a3b8"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="General Settings" subtitle="Application-wide configuration" accent="#94a3b8">
      <div style={S.card}>
        <p style={S.cardTitle}>Application</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Application Name</label>
            <input style={S.input} type="text" value={settings.appName ?? 'MDS Premium Dashboard'} onChange={e => update('appName', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Support Email</label>
            <input style={S.input} type="email" value={settings.supportEmail ?? ''} onChange={e => update('supportEmail', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Default Timezone</label>
            <select style={S.select} value={settings.timezone ?? 'UTC'} onChange={e => update('timezone', e.target.value)}>
              {['UTC','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Dubai','Asia/Singapore'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Date Format</label>
            <select style={S.select} value={settings.dateFormat ?? 'MM/DD/YYYY'} onChange={e => update('dateFormat', e.target.value)}>
              {['MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD'].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <p style={S.cardTitle}>Session</p>
        <div style={{ maxWidth: '220px' }}>
          <label style={S.label}>Session Timeout (minutes)</label>
          <input style={S.input} type="number" min={5} max={480} value={settings.sessionTimeout ?? 60} onChange={e => update('sessionTimeout', Number(e.target.value))} />
        </div>
      </div>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty || saving} style={{ ...S.saveBtn, opacity: (!dirty || saving) ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
