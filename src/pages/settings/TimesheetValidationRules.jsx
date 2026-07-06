import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

const ACCENT = '#60a5fa';

// The rule library — keys match the server-side validator in psaTimesheets.js.
const RULES = [
  { key: 'activityProjectRequired', label: 'Project required on every entry', desc: 'Every timesheet row must have a project selected.' },
  { key: 'noEmptyRows',             label: 'No empty rows',                   desc: 'Rows with zero hours must be removed before submitting.' },
  { key: 'minWeeklyHours',          label: 'Minimum weekly hours',            desc: 'Block submission when the week total is below this.', param: true, unit: 'h', def: 40 },
  { key: 'maxWeeklyHours',          label: 'Maximum weekly hours',            desc: 'Block submission when the week total exceeds this.', param: true, unit: 'h', def: 60 },
  { key: 'maxDailyHours',           label: 'Maximum daily hours',             desc: 'No single day may exceed this number of hours.',     param: true, unit: 'h', def: 12 },
  { key: 'noFutureDates',           label: 'No future-dated time',            desc: 'Time cannot be logged on dates in the future.' },
  { key: 'billingRateRequired',     label: 'Billing rate required',           desc: "The submitter's role must have a billing rate configured." },
];

function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? ACCENT : 'rgba(255,255,255,0.14)', position: 'relative', transition: 'background 0.18s', padding: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.18s' }} />
    </button>
  );
}

export default function TimesheetValidationRules() {
  const { settings, loading, saving, dirty, update, save } = useSettings('validation');
  if (loading) return <SettingsLayout title="Timesheet Validation Rules" accent={ACCENT}><p style={S.muted}>Loading…</p></SettingsLayout>;

  const rules = settings.rules && typeof settings.rules === 'object' ? settings.rules : {};
  const setRule = (key, patch) => update('rules', { ...rules, [key]: { ...rules[key], ...patch } });
  const enabledCount = RULES.filter(r => rules[r.key]?.enabled).length;

  return (
    <SettingsLayout title="Timesheet Validation Rules" subtitle="Rules enforced when a timesheet is submitted" accent={ACCENT}>
      <div style={S.card}>
        <p style={S.cardTitle}>Rule Library · {enabledCount} enabled</p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {RULES.map(rule => {
            const cfg = rules[rule.key] || {};
            const on  = !!cfg.enabled;
            return (
              <div key={rule.key} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: on ? '#fff' : 'rgba(255,255,255,0.7)' }}>{rule.label}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: 1.45 }}>{rule.desc}</div>
                </div>
                {rule.param && on && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <input type="number" min={0} step={1} value={cfg.value ?? rule.def}
                      onChange={e => setRule(rule.key, { value: Number(e.target.value) })}
                      style={{ ...S.input, width: '80px', padding: '6px 8px' }} />
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{rule.unit}</span>
                  </div>
                )}
                <Toggle on={on} onChange={v => setRule(rule.key, { enabled: v })} />
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ ...S.muted, marginTop: '4px' }}>
        Enabled rules are checked when an employee submits a timesheet; a failing rule blocks the submission with an explanation.
      </p>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty || saving} style={{ ...S.saveBtn, opacity: (!dirty || saving) ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
