import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { S }          from '../../components/settings/styles';
import { APP_PAGES }  from '../../config/pages';

// Permission-controllable pages come from the shared registry (src/config/pages.js).

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#84cc16',
];

function getColor(name) {
  let hash = 0;
  for (let c of (name||'')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function RolesPermissions() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  async function togglePage(userId, page, current) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const perms = { ...user.permissions, [page]: !current };
    setSaving(s => ({ ...s, [userId]: true }));
    try {
      const r = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      });
      if (r.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: perms } : u));
    } finally {
      setSaving(s => ({ ...s, [userId]: false }));
    }
  }

  const filtered = search
    ? users.filter(u => (u.displayName||u.id).toLowerCase().includes(search.toLowerCase()))
    : users;

  if (loading) return (
    <SettingsLayout title="Roles & Permissions" accent="#a78bfa">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '40px 0' }}>
        <i className="bx bx-loader-alt bx-spin" /> Loading users…
      </div>
    </SettingsLayout>
  );

  if (error) return (
    <SettingsLayout title="Roles & Permissions" accent="#a78bfa">
      <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#f87171', fontSize: '13px' }}>
        Error loading users: {error}
      </div>
    </SettingsLayout>
  );

  return (
    <SettingsLayout title="Roles & Permissions" subtitle="Manage per-user page access permissions" accent="#a78bfa">

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <i className="bx bx-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }} />
        <input
          style={{ ...S.input, paddingLeft: '36px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
          No users found.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(user => {
          const name  = user.displayName || user.id;
          const color = getColor(name);
          const isSaving = saving[user.id];

          return (
            <div key={user.id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
              {/* User header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Avatar */}
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: color + '33', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                  {name[0].toUpperCase()}
                </div>
                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>
                    {user.isAdmin ? 'Administrator' : 'Standard User'}
                  </p>
                </div>
                {isSaving && (
                  <i className="bx bx-loader-alt bx-spin" style={{ color: '#818cf8', fontSize: '16px' }} />
                )}
              </div>

              {/* Permissions grid */}
              <div style={{ padding: '14px 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                {APP_PAGES.map(({ key, label }) => {
                  const allowed = user.permissions?.[key] === true;
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isSaving ? 'wait' : 'pointer', padding: '6px 8px', borderRadius: '6px', background: allowed ? 'rgba(99,102,241,0.08)' : 'transparent', border: `1px solid ${allowed ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.15s' }}>
                      <input
                        type="checkbox"
                        checked={allowed}
                        disabled={isSaving}
                        onChange={() => togglePage(user.id, key, allowed)}
                        style={{ width: '13px', height: '13px', cursor: isSaving ? 'wait' : 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '12px', color: allowed ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', fontWeight: allowed ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsLayout>
  );
}
