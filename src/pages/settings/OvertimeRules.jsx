import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function OvertimeRules() {
  const { settings, loading, saving, dirty, update, save } = useSettings('overtime');

  if (loading) return <SettingsLayout title="Overtime Rules" accent="#60a5fa"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Overtime Rules" subtitle="Configure overtime thresholds and multipliers" accent="#60a5fa">
      <div style={S.card}>
        <p style={S.cardTitle}>Thresholds & Rates</p>
        <div style={S.grid2}>
          <div><label style={S.label}>Daily OT Threshold (hours)</label><input style={S.input} type="number" min={0} max={24} step={0.5} value={settings.dailyThreshold??8} onChange={e=>update('dailyThreshold',Number(e.target.value))} /></div>
          <div><label style={S.label}>Weekly OT Threshold (hours)</label><input style={S.input} type="number" min={0} max={168} step={0.5} value={settings.weeklyThreshold??40} onChange={e=>update('weeklyThreshold',Number(e.target.value))} /></div>
          <div><label style={S.label}>OT Rate Multiplier</label><input style={S.input} type="number" min={1} max={5} step={0.1} value={settings.multiplier??1.5} onChange={e=>update('multiplier',Number(e.target.value))} /></div>
          <div><label style={S.label}>Double-time Multiplier</label><input style={S.input} type="number" min={1} max={5} step={0.1} value={settings.doubleTimeMultiplier??2} onChange={e=>update('doubleTimeMultiplier',Number(e.target.value))} /></div>
        </div>
        <div style={{ marginTop:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
          {[['trackOvertime','Track overtime hours separately'],['requireApproval','Require manager approval for overtime']].map(([k,l]) => (
            <div key={k} style={S.checkRow}>
              <input type="checkbox" id={k} checked={!!settings[k]} onChange={e=>update(k,e.target.checked)} style={{ width:'15px',height:'15px',cursor:'pointer',accentColor:'#6366f1' }} />
              <label htmlFor={k} style={{ fontSize:'13px',color:'rgba(255,255,255,0.6)',cursor:'pointer' }}>{l}</label>
            </div>
          ))}
        </div>
      </div>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty||saving} style={{ ...S.saveBtn, opacity:(!dirty||saving)?0.5:1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
