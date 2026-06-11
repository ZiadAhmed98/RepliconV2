import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function ClientSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('clients');

  if (loading) return <SettingsLayout title="Client Settings" accent="#34d399"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Client Settings" subtitle="Defaults for client management" accent="#34d399">
      <div style={S.card}>
        <p style={S.cardTitle}>Defaults</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Default Status</label>
            <select style={S.select} value={settings.defaultStatus ?? 'active'} onChange={e => update('defaultStatus', e.target.value)}>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Client Code Prefix</label>
            <input style={S.input} type="text" value={settings.codePrefix ?? 'CLT-'} onChange={e => update('codePrefix', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={S.checkRow}>
            <input type="checkbox" id="reqContact" checked={!!settings.requireContact} onChange={e => update('requireContact', e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#6366f1' }} />
            <label htmlFor="reqContact" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Require contact info on new clients</label>
          </div>
          <div style={S.checkRow}>
            <input type="checkbox" id="autoCode" checked={!!settings.autoGenerateCode} onChange={e => update('autoGenerateCode', e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#6366f1' }} />
            <label htmlFor="autoCode" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Auto-generate client codes</label>
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
