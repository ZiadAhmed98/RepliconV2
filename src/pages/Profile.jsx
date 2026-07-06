import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

const SKILL_SUGGESTIONS = [
  'Project Management', 'Business Analysis', 'Software Development', 'DevOps',
  'Cloud Architecture', 'Data Analysis', 'UI/UX Design', 'QA Testing',
  'Cybersecurity', 'ERP Consulting', 'Network Engineering', 'Technical Writing',
];

function SkillTag({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 500 }}>
      {label}
      {onRemove && <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '0 0 0 2px', fontSize: '12px', lineHeight: 1 }}>×</button>}
    </span>
  );
}

export default function Profile() {
  const { toast } = useToast();

  const [authUser,     setAuthUser]     = useState(null);
  const [employee,     setEmployee]     = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [roles,        setRoles]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [skillInput,   setSkillInput]   = useState('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', displayName: '', email: '',
    employeeId: '', role: 'admin', skills: [],
    supervisorId: '', startDate: '', endDate: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/profile',          { credentials: 'include' }).then(r => r.json()),
      fetch('/api/v1/employees?status=active', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/v1/roles',            { credentials: 'include' }).then(r => r.ok ? r.json() : { roles: [] }),
    ]).then(([profile, emps, rolesRes]) => {
      setAuthUser(profile.user);
      setAllEmployees(emps.employees || []);
      setRoles(rolesRes.roles || []);
      if (profile.employee) {
        setEmployee(profile.employee);
        const e = profile.employee;
        setForm({
          firstName:    e.firstName    || '',
          lastName:     e.lastName     || '',
          displayName:  e.displayName  || '',
          email:        e.email        || '',
          employeeId:   e.employeeId   || '',
          role:         e.role         || 'admin',
          skills:       e.skills       || [],
          supervisorId: e.supervisorId || '',
          startDate:    e.startDate    || '',
          endDate:      e.endDate      || '',
        });
      } else if (profile.user) {
        // Pre-fill name from auth user
        const parts = (profile.user.name || '').split(' ');
        setForm(f => ({
          ...f,
          firstName: parts[0] || '',
          lastName:  parts.slice(1).join(' ') || '',
          email:     '',
          role:      profile.user.isAdmin ? 'admin' : 'resource',
        }));
      }
    }).catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addSkill = (s) => {
    const sk = s.trim();
    if (!sk || form.skills.includes(sk)) return;
    set('skills', [...form.skills, sk]);
    setSkillInput('');
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('First and last name are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, supervisorId: form.supervisorId || null, endDate: form.endDate || null, status: 'active' };
      const r = await fetch('/api/v1/profile', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Save failed'); return; }
      setEmployee(d.employee);
      toast.success('Profile saved — you now appear in all dropdowns');
    } finally { setSaving(false); }
  };

  const inputStyle  = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle  = { fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' };
  const sectionLabel = { margin: '0 0 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' };

  const supervisors = allEmployees.filter(e => e.id !== employee?.id);

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} /></div>;

  return (
    <div className="surface fade-up" style={{ padding: '30px 34px', maxWidth: '760px', margin: '28px auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '32px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {(form.firstName[0] || authUser?.name?.[0] || '?').toUpperCase()}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : (authUser?.name || 'My Profile')}
            </h2>
            {authUser?.isAdmin && (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Sudo Admin
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {employee ? 'Your employee record is set up — you appear in all dropdowns' : 'Set up your profile to appear in supervisor, PM and resource dropdowns'}
          </p>
        </div>
      </div>

      {/* Profile section */}
      <p style={sectionLabel}>Profile</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div><label style={labelStyle}>First Name *</label><input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Last Name *</label><input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Display Name</label><input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder={`${form.firstName} ${form.lastName}`.trim() || 'Auto-filled'} style={inputStyle} /></div>
        <div><label style={labelStyle}>Employee ID</label><input value={form.employeeId} onChange={e => set('employeeId', e.target.value)} placeholder="e.g. EMP-001" style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} /></div>
      </div>

      {/* Role & dates */}
      <p style={sectionLabel}>Role & Dates</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div>
          <label style={labelStyle}>Role {!authUser?.isAdmin && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(set by admin)</span>}</label>
          {authUser?.isAdmin ? (
            <select value={form.role} onChange={e => set('role', e.target.value)} style={inputStyle}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ) : (
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.75 }}>
              <i className='bx bx-lock-alt' style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }} />
              {(roles.find(r => r.id === form.role)?.name) || form.role}
            </div>
          )}
        </div>
        <div><label style={labelStyle}>Start Date</label><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>End Date</label><input type="date" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} style={inputStyle} /></div>
      </div>

      {/* Supervisor */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Supervisor</label>
        <select value={form.supervisorId} onChange={e => set('supervisorId', e.target.value)} style={inputStyle}>
          <option value="">— None —</option>
          {supervisors.map(e => (
            <option key={e.id} value={e.id}>{e.displayName || `${e.firstName} ${e.lastName}`}</option>
          ))}
        </select>
      </div>

      {/* Skills */}
      <p style={sectionLabel}>Skills</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '28px', marginBottom: '8px' }}>
        {form.skills.map(s => <SkillTag key={s} label={s} onRemove={() => set('skills', form.skills.filter(x => x !== s))} />)}
        {form.skills.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>No skills added yet</span>}
      </div>
      <div style={{ position: 'relative', marginBottom: '28px' }}>
        <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); } }}
          placeholder="Type a skill and press Enter…" list="skill-suggestions-profile"
          style={{ ...inputStyle, paddingRight: '80px' }} />
        <datalist id="skill-suggestions-profile">{SKILL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
        <button onClick={() => addSkill(skillInput)}
          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: '#a855f7', fontSize: '0.78rem', fontFamily: 'inherit' }}>
          Add
        </button>
      </div>

      {/* Status note for admin */}
      {authUser?.isAdmin && (
        <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className='bx bx-lock-alt' style={{ color: '#a855f7', fontSize: '16px' }} />
          As the sudo admin your account is always active and cannot be deactivated.
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '11px 28px', cursor: 'pointer', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : employee ? 'Save Changes' : 'Set Up My Profile'}
      </button>
    </div>
  );
}
