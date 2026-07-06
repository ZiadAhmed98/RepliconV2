import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

const ACCENT = '#94a3b8';

function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? '#6366f1' : 'rgba(255,255,255,0.14)', position: 'relative', transition: 'background 0.18s', padding: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.18s' }} />
    </button>
  );
}
function Row({ label, hint, on, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{label}</div>
        {hint && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{hint}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export default function SecuritySettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('security');
  if (loading) return <SettingsLayout title="Security Settings" accent={ACCENT}><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Security Settings" subtitle="Password policy and session controls" accent={ACCENT}>
      <div style={S.card}>
        <p style={S.cardTitle}>Password Policy · enforced when creating or changing passwords</p>
        <div style={{ maxWidth: '260px', marginBottom: '8px' }}>
          <label style={S.label}>Minimum Length</label>
          <input style={S.input} type="number" min={6} max={64} value={settings.minPasswordLength ?? 10} onChange={e => update('minPasswordLength', Number(e.target.value))} />
        </div>
        <Row label="Require an uppercase letter" on={!!settings.requireUppercase} onChange={v => update('requireUppercase', v)} />
        <Row label="Require a number"            on={!!settings.requireNumber}    onChange={v => update('requireNumber', v)} />
        <Row label="Require a symbol"            on={!!settings.requireSymbol}    onChange={v => update('requireSymbol', v)} />
      </div>

      <div style={S.card}>
        <p style={S.cardTitle}>Sessions</p>
        <div style={{ maxWidth: '260px' }}>
          <label style={S.label}>Session Timeout (minutes of inactivity)</label>
          <input style={S.input} type="number" min={5} max={480} value={settings.sessionTimeoutMinutes ?? 60} onChange={e => update('sessionTimeoutMinutes', Number(e.target.value))} />
          <div style={{ ...S.muted, marginTop: '5px' }}>Users are signed out after this long without activity.</div>
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
