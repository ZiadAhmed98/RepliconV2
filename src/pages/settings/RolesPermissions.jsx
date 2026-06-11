import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { S }          from '../../components/settings/styles';

const ALL_PAGES = ['home','dashboard','projects','clients','employees','timesheets','programs','templates','administration','auditLog','migration'];

export default function RolesPermissions() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch('/api/v1/admin/users', { credentials:'include' })
      .then(r=>r.json()).then(d=>{ setUsers(d.users||[]); setLoading(false); })
      .catch(e=>{ setError(e.message); setLoading(false); });
  }, []);

  async function togglePage(userId, page, current) {
    const user = users.find(u=>u.id===userId); if (!user) return;
    const perms = { ...user.permissions, [page]: !current };
    setSaving(s=>({...s,[userId]:true}));
    try {
      const r = await fetch(`/api/v1/admin/users/${userId}`, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ permissions:perms }) });
      if (r.ok) setUsers(prev=>prev.map(u=>u.id===userId?{...u,permissions:perms}:u));
    } finally { setSaving(s=>({...s,[userId]:false})); }
  }

  if (loading) return <SettingsLayout title="Roles & Permissions" accent="#a78bfa"><p style={S.muted}>Loading…</p></SettingsLayout>;
  if (error)   return <SettingsLayout title="Roles & Permissions" accent="#a78bfa"><p style={{ color:'#f87171', fontSize:'13px' }}>{error}</p></SettingsLayout>;

  return (
    <SettingsLayout title="Roles & Permissions" subtitle="Manage per-user page access" accent="#a78bfa">
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {users.map(user => (
          <div key={user.id} style={S.card}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'rgba(99,102,241,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#818cf8', fontWeight:700, fontSize:'13px', flexShrink:0 }}>
                {(user.displayName||user.id)[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:'13px', fontWeight:600, color:'#fff' }}>{user.displayName||user.id}</p>
                <p style={{ margin:0, fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>{user.isAdmin?'Administrator':'User'}</p>
              </div>
              {saving[user.id] && <i className="bx bx-loader-alt bx-spin" style={{ color:'#818cf8', marginLeft:'auto' }} />}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'8px' }}>
              {ALL_PAGES.map(page => {
                const allowed = user.permissions?.[page] !== false;
                return (
                  <label key={page} style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer' }}>
                    <input type="checkbox" checked={allowed} onChange={() => togglePage(user.id, page, allowed)}
                      style={{ width:'13px', height:'13px', cursor:'pointer', accentColor:'#6366f1' }} />
                    <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.55)', textTransform:'capitalize' }}>{page}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SettingsLayout>
  );
}
