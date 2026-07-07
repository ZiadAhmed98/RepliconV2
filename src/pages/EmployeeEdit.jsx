import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { APP_PAGES, APP_PAGE_GROUPS } from '../config/pages';

// Dedicated Edit Employee page — the ONE place to manage a person's profile,
// job role, login account and page access. Role drives the default access;
// admins can fine-tune below. Replaces the old edit modal + the separate
// "System Access" section + the per-user grid on Roles & Permissions.
export default function EmployeeEdit({ sessionUser }) {
  const { id }   = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const detailPath = `/employees/${id}`;
  const back = location.state?.from || detailPath;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [roles, setRoles]     = useState([]);
  const [team, setTeam]       = useState([]);
  const [skillInput, setSkillInput] = useState('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', displayName: '', email: '', employeeId: '',
    role: 'resource', skills: [], supervisorId: '', jobTitle: '', department: '',
    officeLocation: '', startDate: '', endDate: '', status: 'active',
  });
  const [acc, setAcc] = useState({ userId: '', hasAccount: false, isAdmin: false, permissions: {}, password: '', confirm: '' });

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/v1/employees/${id}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/roles', { credentials: 'include' }).then(r => r.ok ? r.json() : { roles: [] }),
      fetch('/api/v1/employees?status=active', { credentials: 'include' }).then(r => r.ok ? r.json() : { employees: [] }),
      fetch(`/api/v1/employees/${id}/account`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([e, rl, tm, ac]) => {
      if (!alive) return;
      const emp = e?.employee;
      if (emp) setForm(f => ({ ...f, ...Object.fromEntries(Object.keys(f).map(k => [k, emp[k] ?? f[k]])), skills: emp.skills || [] }));
      setRoles(rl.roles || []);
      setTeam((tm.employees || []).filter(t => t.id !== id));
      if (ac) setAcc(a => ({ ...a, userId: ac.userId || '', hasAccount: ac.hasAccount, isAdmin: ac.isAdmin, permissions: ac.permissions || {} }));
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setA   = (k, v) => setAcc(a => ({ ...a, [k]: v }));
  const togglePage = (key) => setAcc(a => ({ ...a, permissions: { ...a.permissions, [key]: !a.permissions[key] } }));

  const addSkill = (s) => { const sk = s.trim(); if (!sk || form.skills.includes(sk)) return; set('skills', [...form.skills, sk]); setSkillInput(''); };

  const applyRoleDefaults = async () => {
    try {
      const r = await fetch(`/api/v1/roles/${form.role}/effective-permissions`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Could not load role defaults'); return; }
      // Keep only the app-page keys we surface here
      const next = {};
      APP_PAGES.forEach(p => { next[p.key] = d.permissions?.[p.key] === true; });
      setAcc(a => ({ ...a, permissions: next }));
      toast.success(`Applied ${roles.find(x => x.id === form.role)?.name || form.role} access defaults`);
    } catch { toast.error('Could not load role defaults'); }
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('First and last name are required'); return; }
    if (acc.password && acc.password !== acc.confirm) { toast.error('Passwords do not match'); return; }
    if (acc.userId && !acc.hasAccount && !acc.password) { toast.error('Set a password to create the login account'); return; }
    setSaving(true);
    try {
      // 1) Profile (incl. job role)
      const pr = await fetch(`/api/v1/employees/${id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, supervisorId: form.supervisorId || null, endDate: form.endDate || null, email: form.email || undefined, employeeId: form.employeeId || undefined }),
      });
      const pd = await pr.json();
      if (!pr.ok) { toast.error(pd.error || 'Failed to save profile'); return; }

      // 2) Login account + access — only if a username is set
      if (acc.userId.trim()) {
        // Send a COMPLETE permission map so the server's "fill blanks with true"
        // never silently grants a page we intended to deny.
        const permissions = {};
        APP_PAGES.forEach(p => { permissions[p.key] = acc.isAdmin ? true : (acc.permissions[p.key] === true); });
        const ar = await fetch(`/api/v1/employees/${id}/account`, {
          method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: acc.userId.trim(), isAdmin: acc.isAdmin, permissions, ...(acc.password ? { password: acc.password } : {}) }),
        });
        const ad = await ar.json();
        if (!ar.ok) { toast.error(ad.error || 'Profile saved, but access failed'); return; }
      }
      toast.success('Employee saved');
      navigate(detailPath);
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} /></div>;

  const roleName = roles.find(r => r.id === form.role)?.name || form.role;

  return (
    <div style={{ padding: '28px 32px', maxWidth: '820px', margin: '0 auto' }}>
      <button onClick={() => navigate(back)} style={btnGhost}><i className='bx bx-arrow-back' /> Back</button>

      <h1 style={{ margin: '16px 0 4px', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
        Edit {form.firstName} {form.lastName}
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Profile, job role, login and access — all in one place.</p>

      {/* Profile */}
      <Card title="Profile" icon="bx-user">
        <Grid>
          <Field label="First Name *"><input style={inp} value={form.firstName} onChange={e => set('firstName', e.target.value)} /></Field>
          <Field label="Last Name *"><input style={inp} value={form.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
          <Field label="Display Name"><input style={inp} value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder={`${form.firstName} ${form.lastName}`.trim()} /></Field>
          <Field label="Employee ID"><input style={inp} value={form.employeeId} onChange={e => set('employeeId', e.target.value)} /></Field>
          <Field label="Email"><input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Job Title"><input style={inp} value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} /></Field>
          <Field label="Department"><input style={inp} value={form.department} onChange={e => set('department', e.target.value)} /></Field>
          <Field label="Office Location"><input style={inp} value={form.officeLocation} onChange={e => set('officeLocation', e.target.value)} /></Field>
          <Field label="Start Date"><input style={inp} type="date" value={form.startDate || ''} onChange={e => set('startDate', e.target.value)} /></Field>
          <Field label="End Date"><input style={inp} type="date" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} /></Field>
          <Field label="Supervisor">
            <select style={inp} value={form.supervisorId || ''} onChange={e => set('supervisorId', e.target.value)}>
              <option value="">— None —</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.displayName || `${t.firstName} ${t.lastName}`}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </Grid>
        <Field label="Skills">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {form.skills.map(s => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 500 }}>
                {s}<button onClick={() => set('skills', form.skills.filter(x => x !== s))} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontSize: '13px' }}>×</button>
              </span>
            ))}
          </div>
          <input style={inp} value={skillInput} onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); } }}
            placeholder="Type a skill and press Enter…" />
        </Field>
      </Card>

      {/* Role & Access */}
      <Card title="Role & Access" icon="bx-shield-quarter">
        <Grid>
          <Field label="Job Role">
            <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Login Username" hint="Leave blank for no login account">
            <input style={inp} value={acc.userId} onChange={e => setA('userId', e.target.value.toLowerCase())} placeholder="e.g. jane.doe" />
          </Field>
        </Grid>

        {acc.userId.trim() && (
          <>
            <Grid>
              <Field label={acc.hasAccount ? 'Reset Password' : 'Password *'}><input style={inp} type="password" value={acc.password} onChange={e => setA('password', e.target.value)} placeholder={acc.hasAccount ? 'Leave blank to keep current' : ''} /></Field>
              <Field label="Confirm Password"><input style={inp} type="password" value={acc.confirm} onChange={e => setA('confirm', e.target.value)} /></Field>
            </Grid>

            {/* Administrator */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px 14px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '10px', margin: '4px 0 16px' }}>
              <input type="checkbox" checked={acc.isAdmin} onChange={e => setA('isAdmin', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#a855f7' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Administrator</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Full access to every page and all settings</div>
              </div>
            </label>

            {/* Page access */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Page Access</div>
              <button onClick={applyRoleDefaults} disabled={acc.isAdmin} style={{ ...btnGhost, opacity: acc.isAdmin ? 0.4 : 1, fontSize: '0.76rem' }}>
                <i className='bx bx-reset' /> Apply {roleName} defaults
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {acc.isAdmin ? 'Administrators can access everything — individual toggles are ignored.' : `Defaults come from the ${roleName} role. Customize below for this person only.`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: acc.isAdmin ? 0.45 : 1, pointerEvents: acc.isAdmin ? 'none' : 'auto' }}>
              {APP_PAGE_GROUPS.map(group => (
                <div key={group}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{group}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '8px' }}>
                    {APP_PAGES.filter(p => (p.group || 'Other') === group).map(p => {
                      const on = acc.isAdmin || acc.permissions[p.key] === true;
                      return (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', borderRadius: '9px', cursor: acc.isAdmin ? 'default' : 'pointer',
                          background: on ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                          <input type="checkbox" checked={on} disabled={acc.isAdmin} onChange={() => togglePage(p.key)} style={{ width: '15px', height: '15px', accentColor: '#34d399' }} />
                          <span style={{ fontSize: '0.8rem', color: on ? 'var(--text-main)' : 'var(--text-muted)' }}>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
        <button onClick={() => navigate(back)} style={btnGhost}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '11px 28px', cursor: 'pointer', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Employee'}
        </button>
      </div>
    </div>
  );
}

const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600 };

function Card({ title, icon, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px 24px', marginBottom: '16px' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '9px' }}>
        <i className={`bx ${icon}`} style={{ fontSize: '17px', color: '#a78bfa' }} /> {title}
      </h2>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>{children}</div>;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 500 }}>{label}{hint && <span style={{ opacity: 0.6, fontWeight: 400 }}> · {hint}</span>}</label>
      {children}
    </div>
  );
}
