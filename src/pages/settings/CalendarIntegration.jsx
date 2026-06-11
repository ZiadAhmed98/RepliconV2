import { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import SettingsLayout  from '../../components/settings/SettingsLayout';
import { S }           from '../../components/settings/styles';

function Toggle({ checked, onChange }) {
  return (
    <label style={{ position:'relative', display:'inline-flex', alignItems:'center', cursor:'pointer' }}>
      <input type="checkbox" style={{ position:'absolute', opacity:0, width:0, height:0 }} checked={checked} onChange={onChange} />
      <div style={{ width:'36px', height:'20px', borderRadius:'10px', background:checked?'#6366f1':'rgba(255,255,255,0.1)', transition:'background 0.2s', position:'relative' }}>
        <div style={{ position:'absolute', top:'3px', left:checked?'19px':'3px', width:'14px', height:'14px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
      </div>
    </label>
  );
}

export default function CalendarIntegration() {
  const { settings, loading, saving, dirty, update, save } = useSettings('calendar');
  const [copied, setCopied] = useState(false);

  function copyFeed() {
    navigator.clipboard.writeText(window.location.origin + '/api/v1/calendar/feed.ics');
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  if (loading) return <SettingsLayout title="Calendar Integration" accent="#2dd4bf"><p style={S.muted}>Loading…</p></SettingsLayout>;

  const gEnabled  = settings.googleEnabled  === 'true' || settings.googleEnabled  === true;
  const msEnabled = settings.outlookEnabled === 'true' || settings.outlookEnabled === true;

  return (
    <SettingsLayout title="Calendar Integration" subtitle="Connect external calendar systems" accent="#2dd4bf">

      <div style={S.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: gEnabled ? '16px' : 0 }}>
          <div>
            <p style={{ margin:'0 0 2px', fontSize:'14px', fontWeight:700, color:'#fff' }}>Google Calendar</p>
            <p style={{ margin:0, fontSize:'12px', color:'rgba(255,255,255,0.35)' }}>Sync project deadlines and milestones</p>
          </div>
          <Toggle checked={gEnabled} onChange={e=>update('googleEnabled', e.target.checked?'true':'false')} />
        </div>
        {gEnabled && (
          <div>
            <label style={S.label}>Google Calendar ID</label>
            <input style={S.input} type="text" value={settings.googleCalendarId||''} onChange={e=>update('googleCalendarId',e.target.value)}
              placeholder="primary or calendar@group.calendar.google.com" />
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: msEnabled ? '16px' : 0 }}>
          <div>
            <p style={{ margin:'0 0 2px', fontSize:'14px', fontWeight:700, color:'#fff' }}>Microsoft Outlook</p>
            <p style={{ margin:0, fontSize:'12px', color:'rgba(255,255,255,0.35)' }}>Sync via Microsoft Graph API</p>
          </div>
          <Toggle checked={msEnabled} onChange={e=>update('outlookEnabled', e.target.checked?'true':'false')} />
        </div>
        {msEnabled && (
          <div>
            <label style={S.label}>Tenant ID</label>
            <input style={S.input} type="text" value={settings.outlookTenantId||''} onChange={e=>update('outlookTenantId',e.target.value)} />
          </div>
        )}
      </div>

      <div style={S.card}>
        <p style={{ margin:'0 0 4px', fontSize:'14px', fontWeight:700, color:'#fff' }}>iCal Feed</p>
        <p style={{ ...S.muted, marginBottom:'12px' }}>Subscribe to project deadlines via iCal URL</p>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', padding:'10px 14px' }}>
          <i className="bx bx-link" style={{ color:'rgba(255,255,255,0.3)', fontSize:'16px' }} />
          <span style={{ flex:1, fontSize:'12px', fontFamily:'monospace', color:'rgba(255,255,255,0.45)' }}>/api/v1/calendar/feed.ics</span>
          <button onClick={copyFeed} style={{ ...S.iconBtn, color: copied ? '#34d399' : 'rgba(255,255,255,0.3)', fontSize:'14px' }}>
            <i className={`bx ${copied?'bx-check':'bx-copy'}`} />
          </button>
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
