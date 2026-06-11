import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function TimesheetPeriods() {
  const { settings, loading, saving, dirty, update, save } = useSettings('timesheet');

  if (loading) return <SettingsLayout title="Timesheet Periods" accent="#60a5fa"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Timesheet Periods" subtitle="Configure timesheet cycles and submission rules" accent="#60a5fa">
      <div style={S.card}>
        <p style={S.cardTitle}>Period Configuration</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Period Type</label>
            <select style={S.select} value={settings.periodType ?? 'weekly'} onChange={e => update('periodType', e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Submission Deadline (days after period end)</label>
            <input style={S.input} type="number" min={0} max={14} value={settings.submissionDeadlineDays ?? 2} onChange={e => update('submissionDeadlineDays', Number(e.target.value))} />
          </div>
          <div>
            <label style={S.label}>Max Daily Hours</label>
            <input style={S.input} type="number" min={1} max={24} step={0.5} value={settings.maxDailyHours ?? 12} onChange={e => update('maxDailyHours', Number(e.target.value))} />
          </div>
          <div>
            <label style={S.label}>Standard Weekly Hours</label>
            <input style={S.input} type="number" min={1} max={80} value={settings.standardWeeklyHours ?? 40} onChange={e => update('standardWeeklyHours', Number(e.target.value))} />
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[['lockPastPeriods','Lock past periods after approval'],['allowFutureEntry','Allow future period entries']].map(([k,l]) => (
            <div key={k} style={S.checkRow}>
              <input type="checkbox" id={k} checked={!!settings[k]} onChange={e => update(k, e.target.checked)} style={{ width:'15px',height:'15px',cursor:'pointer',accentColor:'#6366f1' }} />
              <label htmlFor={k} style={{ fontSize:'13px',color:'rgba(255,255,255,0.6)',cursor:'pointer' }}>{l}</label>
            </div>
          ))}
        </div>
      </div>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty || saving} style={{ ...S.saveBtn, opacity: (!dirty||saving)?0.5:1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
