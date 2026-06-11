import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function BillingSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('billing');

  if (loading) return <SettingsLayout title="Billing Settings" accent="#818cf8"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Billing Settings" subtitle="Invoice and billing defaults" accent="#818cf8">
      <div style={S.card}>
        <p style={S.cardTitle}>Invoice Defaults</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Payment Terms (days)</label>
            <input style={S.input} type="number" min={0} value={settings.paymentTermsDays ?? 30} onChange={e => update('paymentTermsDays', Number(e.target.value))} />
          </div>
          <div>
            <label style={S.label}>Default Tax Rate (%)</label>
            <input style={S.input} type="number" min={0} max={100} step={0.1} value={settings.taxRate ?? 0} onChange={e => update('taxRate', Number(e.target.value))} />
          </div>
          <div>
            <label style={S.label}>Invoice Prefix</label>
            <input style={S.input} type="text" value={settings.invoicePrefix ?? 'INV-'} onChange={e => update('invoicePrefix', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Rounding</label>
            <select style={S.select} value={settings.rounding ?? 'nearest'} onChange={e => update('rounding', e.target.value)}>
              <option value="nearest">Nearest</option>
              <option value="up">Always Up</option>
              <option value="down">Always Down</option>
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
