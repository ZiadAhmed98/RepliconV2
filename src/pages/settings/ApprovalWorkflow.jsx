import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function ApprovalWorkflow() {
  const { settings, loading, saving, dirty, update, save } = useSettings('approval');

  if (loading) return <SettingsLayout title="Approval Workflow" accent="#60a5fa"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Approval Workflow" subtitle="Timesheet and expense approval chain configuration" accent="#60a5fa">
      <div style={S.card}>
        <p style={S.cardTitle}>Approval Chain</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Approval Mode</label>
            <select style={S.select} value={settings.mode ?? 'single'} onChange={e => update('mode', e.target.value)}>
              <option value="single">Single Approver</option>
              <option value="sequential">Sequential (multi-level)</option>
              <option value="auto">Auto-approve</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Auto-approve after (hours)</label>
            <input style={S.input} type="number" min={0} value={settings.autoApproveHours ?? 0} onChange={e => update('autoApproveHours', Number(e.target.value))} />
            <p style={S.muted}>Set to 0 to disable.</p>
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[['notifyOnSubmit','Notify approver on timesheet submission'],['notifyOnApprove','Notify employee on approval/rejection']].map(([k,l]) => (
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
