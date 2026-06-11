import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';

const ALL_PAGES = [
  'home','dashboard','projects','clients','employees','timesheets',
  'programs','templates','administration','auditLog','migration',
];

const ROLES = ['admin','manager','resource'];

export default function RolesPermissions() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});
  const [error,   setError]   = useState(null);

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
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ permissions: perms }),
      });
      if (r.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: perms } : u));
    } finally {
      setSaving(s => ({ ...s, [userId]: false }));
    }
  }

  return (
    <SettingsLayout title="Roles & Permissions" subtitle="Manage per-user page access" accent="#a78bfa">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : (
        <div className="space-y-4">
          {users.map(user => (
            <div key={user.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {(user.displayName || user.id)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{user.displayName || user.id}</p>
                  <p className="text-slate-500 text-xs">{user.isAdmin ? 'Administrator' : 'User'}</p>
                </div>
                {saving[user.id] && <i className="bx bx-loader-alt bx-spin text-indigo-400 ml-auto" />}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_PAGES.map(page => {
                  const allowed = user.permissions?.[page] !== false;
                  return (
                    <label key={page} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={allowed} onChange={() => togglePage(user.id, page, allowed)}
                        className="w-4 h-4 rounded" />
                      <span className="text-slate-300 text-xs capitalize group-hover:text-white transition-colors">{page}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsLayout>
  );
}
