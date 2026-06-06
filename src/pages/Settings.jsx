import React, { useState, useEffect, useCallback } from 'react';

const ALL_PAGES = [
  { key: 'dashboard',  label: 'Dashboard'    },
  { key: 'employees',  label: 'Employees'    },
  { key: 'timesheets', label: 'Timesheets'   },
  { key: 'projects',   label: 'Projects'     },
  { key: 'clients',    label: 'Clients'      },
  { key: 'aiInsights', label: 'AI Insights'  },
  { key: 'chatbot',    label: 'AI Chatbot'   },
];

const S = {
  page:   { padding: '32px', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'inherit' },
  h1:     { fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' },
  sub:    { fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px' },
  card:   { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px', marginBottom: '16px' },
  row:    { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  name:   { fontSize: '14px', fontWeight: 600, color: '#f1f5f9', minWidth: '140px' },
  badge:  (admin) => ({ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: admin ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.07)', color: admin ? '#c084fc' : 'rgba(255,255,255,0.4)', border: admin ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.08)' }),
  toggle: (on) => ({ width: '38px', height: '20px', borderRadius: '10px', background: on ? '#7c3aed' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0 }),
  thumb:  (on) => ({ position: 'absolute', top: '3px', left: on ? '20px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }),
  btn:    (v='default') => ({ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: v==='danger' ? 'rgba(239,68,68,0.15)' : v==='primary' ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'rgba(255,255,255,0.07)', color: v==='danger' ? '#f87171' : v==='primary' ? '#fff' : 'rgba(255,255,255,0.6)' }),
  input:  { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' },
  label:  { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  err:    { fontSize: '12px', color: '#f87171', marginTop: '6px' },
};

function Toggle({ value, onChange }) {
  return (
    <button style={S.toggle(value)} onClick={() => onChange(!value)} type="button">
      <span style={S.thumb(value)} />
    </button>
  );
}

function PermissionGrid({ permissions, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
      {ALL_PAGES.map(p => (
        <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Toggle value={permissions[p.key] !== false} onChange={v => !disabled && onChange({ ...permissions, [p.key]: v })} />
          <span style={{ fontSize: '12px', color: permissions[p.key] !== false ? '#e2e8f0' : 'rgba(255,255,255,0.3)' }}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function UserCard({ user, onSave, onDelete, isSelf }) {
  const [expanded,    setExpanded]  = useState(false);
  const [perms,       setPerms]     = useState(user.permissions || {});
  const [newPwd,      setNewPwd]    = useState('');
  const [displayName, setDName]     = useState(user.displayName);
  const [isAdmin,     setIsAdmin]   = useState(user.isAdmin || false);
  const [saving,      setSaving]    = useState(false);
  const [err,         setErr]       = useState('');

  const handleSave = async () => {
    setSaving(true); setErr('');
    const body = { displayName, isAdmin, permissions: perms };
    if (newPwd) body.password = newPwd;
    const ok = await onSave(user.id, body);
    if (!ok) setErr('Save failed. Try again.');
    else { setNewPwd(''); setExpanded(false); }
    setSaving(false);
  };

  return (
    <div style={S.card}>
      <div style={S.row}>
        <div style={{ ...S.name, flex: 1 }}>{user.displayName}</div>
        <span style={S.badge(user.isAdmin)}>{user.isAdmin ? 'Admin' : 'User'}</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>@{user.id}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button style={S.btn()} onClick={() => setExpanded(e => !e)}>{expanded ? 'Cancel' : 'Edit'}</button>
          {!isSelf && <button style={S.btn('danger')} onClick={() => onDelete(user.id, user.displayName)}>Delete</button>}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <div style={S.label}>Display Name</div>
              <input style={S.input} value={displayName} onChange={e => setDName(e.target.value)} />
            </div>
            <div>
              <div style={S.label}>New Password (leave blank to keep)</div>
              <input style={S.input} type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Toggle value={isAdmin} onChange={setIsAdmin} />
            <span style={{ fontSize: '13px', color: isAdmin ? '#c084fc' : 'rgba(255,255,255,0.5)' }}>Admin (full access to everything)</span>
          </div>
          <div style={S.label}>Page Permissions</div>
          <PermissionGrid permissions={perms} onChange={setPerms} disabled={isAdmin} />
          {isAdmin && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>Admins have access to all pages automatically.</div>}
          {err && <div style={S.err}>{err}</div>}
          <div style={{ marginTop: '14px' }}>
            <button style={S.btn('primary')} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddUserForm({ onAdd }) {
  const [show,      setShow]    = useState(false);
  const [id,        setId]      = useState('');
  const [displayName, setDN]   = useState('');
  const [password,  setPwd]     = useState('');
  const [isAdmin,   setIsAdmin] = useState(false);
  const [perms,     setPerms]   = useState(Object.fromEntries(ALL_PAGES.map(p => [p.key, true])));
  const [saving,    setSaving]  = useState(false);
  const [err,       setErr]     = useState('');

  const handleAdd = async () => {
    if (!id || !displayName || !password) { setErr('All fields required.'); return; }
    setSaving(true); setErr('');
    const ok = await onAdd({ id, displayName, password, isAdmin, permissions: perms });
    if (!ok) { setErr('Failed to create user. Username may already exist.'); setSaving(false); return; }
    setId(''); setDN(''); setPwd(''); setIsAdmin(false); setShow(false);
    setSaving(false);
  };

  if (!show) return (
    <button style={{ ...S.btn('primary'), marginBottom: '20px' }} onClick={() => setShow(true)}>+ Add User</button>
  );

  return (
    <div style={{ ...S.card, border: '1px solid rgba(139,92,246,0.3)', marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>New User</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div>
          <div style={S.label}>Username (login ID)</div>
          <input style={S.input} value={id} onChange={e => setId(e.target.value.toLowerCase().replace(/\s/g,'_'))} placeholder="john_doe" />
        </div>
        <div>
          <div style={S.label}>Display Name</div>
          <input style={S.input} value={displayName} onChange={e => setDN(e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <div style={S.label}>Password</div>
          <input style={S.input} type="password" value={password} onChange={e => setPwd(e.target.value)} placeholder="••••••••" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <Toggle value={isAdmin} onChange={setIsAdmin} />
        <span style={{ fontSize: '13px', color: isAdmin ? '#c084fc' : 'rgba(255,255,255,0.5)' }}>Admin</span>
      </div>
      <div style={S.label}>Page Permissions</div>
      <PermissionGrid permissions={perms} onChange={setPerms} disabled={isAdmin} />
      {err && <div style={S.err}>{err}</div>}
      <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
        <button style={S.btn('primary')} onClick={handleAdd} disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
        <button style={S.btn()} onClick={() => setShow(false)}>Cancel</button>
      </div>
    </div>
  );
}

export default function Settings({ sessionUser }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/admin/users', { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setUsers(d.users || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const handleSave = async (uid, body) => {
    try {
      const r = await fetch(`/api/v1/admin/users/${uid}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return false;
      await fetchUsers();
      return true;
    } catch { return false; }
  };

  const handleDelete = async (uid, name) => {
    if (!window.confirm(`Delete user "${name}" (@${uid})? This cannot be undone.`)) return;
    try {
      const r = await fetch(`/api/v1/admin/users/${uid}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) await fetchUsers();
    } catch { /* ignore */ }
  };

  const handleAdd = async (body) => {
    try {
      const r = await fetch('/api/v1/admin/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return false;
      await fetchUsers();
      return true;
    } catch { return false; }
  };

  return (
    <div style={S.page}>
      <div style={S.h1}>User Management</div>
      <div style={S.sub}>Login accounts and page-level permissions</div>

      {loading && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Loading...</div>}

      {!loading && (
        <div>
          <AddUserForm onAdd={handleAdd} />
          {users.map(u => (
            <UserCard
              key={u.id}
              user={u}
              onSave={handleSave}
              onDelete={handleDelete}
              isSelf={u.id === sessionUser?.id}
            />
          ))}
          {users.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}
