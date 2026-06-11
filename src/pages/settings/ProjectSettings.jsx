import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function ProjectSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('projects');

  if (loading) return <SettingsLayout title="Project Settings" accent="#818cf8"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Project Settings" subtitle="Defaults and rules for all projects" accent="#818cf8">
      <div style={S.card}>
        <p style={S.cardTitle}>Defaults</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Default Billing Type</label>
            <select style={S.select} value={settings.defaultBillingType ?? 'time_material'} onChange={e => update('defaultBillingType', e.target.value)}>
              <option value="time_material">Time & Material</option>
              <option value="fixed_price">Fixed Price</option>
              <option value="retainer">Retainer</option>
              <option value="non_billable">Non-Billable</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Default Status</label>
            <select style={S.select} value={settings.defaultStatus ?? 'in_progress'} onChange={e => update('defaultStatus', e.target.value)}>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Budget Alert Threshold (%)</label>
            <input style={S.input} type="number" min={10} max={100} step={5} value={settings.budgetAlertPct ?? 80} onChange={e => update('budgetAlertPct', Number(e.target.value))} />
          </div>
        </div>
        <div style={{ marginTop: '14px' }}>
          <div style={S.checkRow}>
            <input type="checkbox" id="reqPM" checked={!!settings.requireProjectManager} onChange={e => update('requireProjectManager', e.target.checked)}
              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#6366f1' }} />
            <label htmlFor="reqPM" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Require Project Manager on all projects</label>
          </div>
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
