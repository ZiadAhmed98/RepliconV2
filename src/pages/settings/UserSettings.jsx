import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';
import { applyNameFormula, DEFAULT_LOGIN_FORMULA, DEFAULT_EMAIL_FORMULA } from '../../utils/formula';

const ACCENT = '#a78bfa';
const TOKENS = ['$FNameLower', '$LNameLower', '$FName', '$LName', '$FInitial', '$LInitial'];
const TIMEZONES = ['UTC','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Dubai','Asia/Singapore'];

export default function UserSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('user');
  if (loading) return <SettingsLayout title="User Settings" accent={ACCENT}><p style={S.muted}>Loading…</p></SettingsLayout>;

  const loginF = settings.loginFormula ?? DEFAULT_LOGIN_FORMULA;
  const emailF = settings.emailFormula ?? DEFAULT_EMAIL_FORMULA;

  return (
    <SettingsLayout title="User Settings" subtitle="Defaults applied when adding new users" accent={ACCENT}>

      <div style={S.card}>
        <p style={S.cardTitle}>New User Defaults</p>

        <div style={{ marginBottom: '16px' }}>
          <label style={S.label}>Login Name Formula</label>
          <input style={{ ...S.input, fontFamily: 'monospace' }} value={loginF} onChange={e => update('loginFormula', e.target.value)} />
          <div style={{ ...S.muted, marginTop: '5px' }}>Preview for “John Doe”: <span style={{ color: ACCENT, fontFamily: 'monospace' }}>{applyNameFormula(loginF, 'John', 'Doe') || '—'}</span></div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={S.label}>Email Formula</label>
          <input style={{ ...S.input, fontFamily: 'monospace' }} value={emailF} onChange={e => update('emailFormula', e.target.value)} />
          <div style={{ ...S.muted, marginTop: '5px' }}>Preview for “John Doe”: <span style={{ color: ACCENT, fontFamily: 'monospace' }}>{applyNameFormula(emailF, 'John', 'Doe') || '—'}</span></div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
          {TOKENS.map(t => (
            <span key={t} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 7px' }}>{t}</span>
          ))}
        </div>
        <div style={S.muted}>Use these tokens in the formulas above. Anything else (like <code>@liveroute.com</code>) is kept literally.</div>
      </div>

      <div style={S.card}>
        <p style={S.cardTitle}>Defaults</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Default Time Zone</label>
            <select style={S.select} value={settings.timezone ?? 'Asia/Dubai'} onChange={e => update('timezone', e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Default Work Week</label>
            <select style={S.select} value={settings.workWeek ?? 'mon-fri'} onChange={e => update('workWeek', e.target.value)}>
              <option value="mon-fri">Monday to Friday</option>
              <option value="sun-thu">Sunday to Thursday</option>
              <option value="mon-sat">Monday to Saturday</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
          <input type="checkbox" id="mfa" checked={!!settings.requireMfa} onChange={e => update('requireMfa', e.target.checked)} style={{ width: '15px', height: '15px', accentColor: ACCENT, cursor: 'pointer' }} />
          <label htmlFor="mfa" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>Require Multi-Factor Authentication for new users</label>
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
