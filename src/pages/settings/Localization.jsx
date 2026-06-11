import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function Localization() {
  const { settings, loading, saving, dirty, update, save } = useSettings('localization');

  if (loading) return <SettingsLayout title="Localization" accent="#94a3b8"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Localization" subtitle="Language, currency, and regional settings" accent="#94a3b8">
      <div style={S.card}>
        <p style={S.cardTitle}>Regional</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Language</label>
            <select style={S.select} value={settings.language ?? 'en'} onChange={e => update('language', e.target.value)}>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="fr">French</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Default Currency</label>
            <select style={S.select} value={settings.currency ?? 'USD'} onChange={e => update('currency', e.target.value)}>
              {['USD','EUR','GBP','AED','SAR','EGP'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Number Format</label>
            <select style={S.select} value={settings.numberFormat ?? '1,234.56'} onChange={e => update('numberFormat', e.target.value)}>
              <option value="1,234.56">1,234.56 (US)</option>
              <option value="1.234,56">1.234,56 (EU)</option>
            </select>
          </div>
          <div>
            <label style={S.label}>First Day of Week</label>
            <select style={S.select} value={settings.firstDayOfWeek ?? 'sunday'} onChange={e => update('firstDayOfWeek', e.target.value)}>
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
            </select>
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
