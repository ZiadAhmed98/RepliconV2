import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

// Admin management of dynamic job roles (custom titles like "Sr Solutions
// Architect"). Built-in roles are editable but not deletable. The "Manager"
// flag marks a role whose holders can own projects and approve timesheets.
export default function JobRoles() {
  const { toast } = useToast();
  const [roles, setRoles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | role object
  const [busy, setBusy]       = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/roles', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setRoles(d.roles || []))
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    if (!form.name.trim()) { toast.error('Role name is required'); return; }
    setBusy(true);
    try {
      const isNew = editing === 'new';
      const r = await fetch(isNew ? '/api/v1/roles' : `/api/v1/roles/${editing.id}`, {
        method: isNew ? 'POST' : 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim(), isManager: form.isManager }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Save failed'); return; }
      toast.success(isNew ? 'Role created' : 'Role updated');
      setEditing(null);
      load();
    } finally { setBusy(false); }
  };

  const remove = async (role) => {
    if (!confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;
    const r = await fetch(`/api/v1/roles/${role.id}`, { method: 'DELETE', credentials: 'include' });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error || 'Delete failed'); return; }
    toast.success('Role deleted');
    load();
  };

  return (
    <div style={{ padding: '30px 34px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '26px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
            <i className='bx bx-id-card' style={{ color: '#a78bfa', marginRight: '10px' }} />Job Roles
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Define the job titles people can hold. Mark a role as a <strong>Manager</strong> if its holders should own projects and approve timesheets.
          </p>
        </div>
        <button onClick={() => setEditing('new')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
          <i className='bx bx-plus' /> New Role
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '26px' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {roles.map(role => (
            <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '13px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`bx ${role.isManager ? 'bx-crown' : 'bx-user'}`} style={{ fontSize: '18px', color: '#a78bfa' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{role.name}</span>
                  {role.isSystem && <span style={{ fontSize: '0.62rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', borderRadius: '5px', padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Built-in</span>}
                  {role.isManager && <span style={{ fontSize: '0.62rem', fontWeight: 700, background: 'rgba(52,211,153,0.12)', color: '#34d399', borderRadius: '5px', padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manager</span>}
                </div>
                {role.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{role.description}</div>}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{role.memberCount} {role.memberCount === 1 ? 'person' : 'people'}</span>
              <button onClick={() => setEditing(role)} title="Edit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px' }}>
                <i className='bx bx-pencil' />
              </button>
              {!role.isSystem && (
                <button onClick={() => remove(role)} title="Delete" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#ff3b30', fontSize: '14px' }}>
                  <i className='bx bx-trash' />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && <RoleModal role={editing === 'new' ? null : editing} busy={busy} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoleModal({ role, busy, onSave, onClose }) {
  const [form, setForm] = useState({
    name:        role?.name        || '',
    description: role?.description || '',
    isManager:   role?.isManager   || false,
  });
  const input = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '10px 12px', color: 'var(--text-main)', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '440px', maxWidth: '100%', background: 'rgba(16,16,22,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '26px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>{role ? 'Edit Role' : 'New Role'}</h3>
        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Role name *</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sr Solutions Architect" style={{ ...input, marginBottom: '14px' }} autoFocus />
        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Description</label>
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this role does" style={{ ...input, marginBottom: '16px' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: '22px' }}>
          <input type="checkbox" checked={form.isManager} onChange={e => setForm(f => ({ ...f, isManager: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#a855f7' }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Manager role</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Can own projects and approve timesheets</div>
          </div>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '10px 18px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.86rem', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={busy} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer', color: '#fff', fontSize: '0.86rem', fontFamily: 'inherit', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving…' : role ? 'Save' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}
