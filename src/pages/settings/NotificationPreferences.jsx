import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

const PREFS = [
  { key:'timesheetSubmitted',  label:'Timesheet submitted' },
  { key:'timesheetApproved',   label:'Timesheet approved/rejected' },
  { key:'projectAssigned',     label:'Assigned to a project' },
  { key:'taskAssigned',        label:'Assigned to a task' },
  { key:'budgetAlert',         label:'Budget threshold alert' },
  { key:'deadlineAlert',       label:'Deadline approaching' },
  { key:'systemAnnouncements', label:'System announcements' },
];

export default function NotificationPreferences() {
  const { settings, loading, saving, dirty, update, save } = useSettings('notifications');
  if (loading) return <SettingsLayout title="Notification Preferences" accent="#fb923c"><p style={S.muted}>Loading…</p></SettingsLayout>;
  return (
    <SettingsLayout title="Notification Preferences" subtitle="Control which events trigger notifications" accent="#fb923c">

      <div style={S.card}>
        <p style={S.cardTitle}>In-App Notifications</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
          {PREFS.map(p => {
            const on = settings[p.key] !== false && settings[p.key] !== 'false';
            return (
              <div key={p.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)' }}>{p.label}</span>
                <label style={{ position:'relative', display:'inline-flex', alignItems:'center', cursor:'pointer' }}>
                  <input type="checkbox" style={{ position:'absolute', opacity:0, width:0, height:0 }}
                    checked={on} onChange={e=>update(p.key, e.target.checked)} />
                  <div style={{ width:'36px', height:'20px', borderRadius:'10px', background: on ? '#6366f1' : 'rgba(255,255,255,0.1)', transition:'background 0.2s', position:'relative' }}>
                    <div style={{ position:'absolute', top:'3px', left: on ? '19px' : '3px', width:'14px', height:'14px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <p style={S.cardTitle}>Email Digest</p>
        <div>
          <label style={S.label}>Digest Frequency</label>
          <select style={{ ...S.select, maxWidth:'220px' }} value={settings.emailDigest||'daily'} onChange={e=>update('emailDigest',e.target.value)}>
            <option value="never">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      <div style={S.saveRow}>
        <button onClick={save} disabled={!dirty||saving} style={{ ...S.saveBtn, opacity:(!dirty||saving)?0.6:1 }}>
          {saving?'Saving…':'Save Changes'}
        </button>
      </div>
    </SettingsLayout>
  );
}
