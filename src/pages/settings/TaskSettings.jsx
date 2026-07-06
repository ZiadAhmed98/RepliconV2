import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

export default function TaskSettings() {
  const { settings, loading, saving, dirty, update, save } = useSettings('tasks');

  if (loading) return <SettingsLayout title="Task Settings" accent="#fbbf24"><p style={S.muted}>Loading…</p></SettingsLayout>;

  return (
    <SettingsLayout title="Task Settings" subtitle="Defaults and rules for task management" accent="#fbbf24">
      <div style={S.card}>
        <p style={S.cardTitle}>Defaults</p>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Default Task Status</label>
            <select style={S.select} value={settings.defaultStatus ?? 'open'} onChange={e => update('defaultStatus', e.target.value)}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Default Estimated Hours</label>
            <input style={S.input} type="number" min={0} step={0.5} value={settings.defaultEstimatedHours ?? 8} onChange={e => update('defaultEstimatedHours', Number(e.target.value))} />
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={S.checkRow}>
            <input type="checkbox" id="allowSub" checked={!!settings.allowSubtasks} onChange={e => update('allowSubtasks', e.target.checked)} style={{ width:'15px',height:'15px',cursor:'pointer',accentColor:'#6366f1' }} />
            <label htmlFor="allowSub" style={{ fontSize:'13px',color:'rgba(255,255,255,0.6)',cursor:'pointer' }}>Allow nested subtasks</label>
          </div>
          <div style={S.checkRow}>
            <input type="checkbox" id="reqAssign" checked={!!settings.requireAssignee} onChange={e => update('requireAssignee', e.target.checked)} style={{ width:'15px',height:'15px',cursor:'pointer',accentColor:'#6366f1' }} />
            <label htmlFor="reqAssign" style={{ fontSize:'13px',color:'rgba(255,255,255,0.6)',cursor:'pointer' }}>Require assignee before activating</label>
          </div>
          <div style={S.checkRow}>
            <input type="checkbox" id="reqEst" checked={!!settings.requireEstimate} onChange={e => update('requireEstimate', e.target.checked)} style={{ width:'15px',height:'15px',cursor:'pointer',accentColor:'#6366f1' }} />
            <label htmlFor="reqEst" style={{ fontSize:'13px',color:'rgba(255,255,255,0.6)',cursor:'pointer' }}>Require an estimate (hours) on every task</label>
          </div>
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
