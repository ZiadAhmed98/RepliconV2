import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function Branding() {
  const { settings, loading, saving, dirty, update, save } = useSettings('branding');

  if (loading) return <SettingsLayout title="Branding" accent="#94a3b8"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Branding" subtitle="Logo, colors, and visual identity" accent="#94a3b8">
      <div style={S.card}>
        <p style={S.cardTitle}>Identity</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Company Name</label>
            <input style={S.input} type="text" value={settings.companyName ?? ''} onChange={e => update('companyName', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Logo URL</label>
            <input style={S.input} type="url" value={settings.logoUrl ?? ''} onChange={e => update('logoUrl', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Primary Color</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color" value={settings.primaryColor ?? '#818cf8'} onChange={e => update('primaryColor', e.target.value)}
                style={{ width: '38px', height: '34px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', padding: '2px' }} />
              <input style={{ ...S.input, flex: 1 }} type="text" value={settings.primaryColor ?? '#818cf8'} onChange={e => update('primaryColor', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={S.label}>Favicon URL</label>
            <input style={S.input} type="url" value={settings.faviconUrl ?? ''} onChange={e => update('faviconUrl', e.target.value)} />
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
