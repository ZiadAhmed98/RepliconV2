import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

const CURRENCIES = ['USD','EUR','GBP','AED','SAR','EGP','JPY','CAD','AUD','CHF'];

export default function CurrencySettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('currency');

  if (loading) return <SettingsLayout title="Currency Settings" accent="#f472b6"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Currency Settings" subtitle="Multi-currency and exchange rate configuration" accent="#f472b6">
      <div style={S.card}>
        <p style={S.cardTitle}>Base Currency</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Base Currency</label>
            <select style={S.select} value={settings.baseCurrency??'USD'} onChange={e=>update('baseCurrency',e.target.value)}>
              {CURRENCIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Exchange Rate Source</label>
            <select style={S.select} value={settings.rateSource??'manual'} onChange={e=>update('rateSource',e.target.value)}>
              <option value="manual">Manual</option>
              <option value="openexchangerates">Open Exchange Rates</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Decimal Places</label>
            <select style={S.select} value={settings.decimalPlaces??2} onChange={e=>update('decimalPlaces',Number(e.target.value))}>
              <option value={0}>0</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Symbol Position</label>
            <select style={S.select} value={settings.symbolPosition??'before'} onChange={e=>update('symbolPosition',e.target.value)}>
              <option value="before">Before ($100)</option>
              <option value="after">After (100$)</option>
            </select>
          </div>
        </div>
      </div>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty||saving} style={{ ...S.saveBtn, opacity:(!dirty||saving)?0.5:1 }}>
          {saving?'Saving…':'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
