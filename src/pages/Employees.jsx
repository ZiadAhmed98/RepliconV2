import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../context/ToastContext';

const ROLES = [
  { value: 'resource',   label: 'Resource' },
  { value: 'pm',         label: 'Project Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin',      label: 'Admin' },
];

const SKILL_SUGGESTIONS = [
  'Project Management', 'Business Analysis', 'Software Development', 'DevOps',
  'Cloud Architecture', 'Data Analysis', 'UI/UX Design', 'QA Testing',
  'Cybersecurity', 'ERP Consulting', 'Network Engineering', 'Technical Writing',
];

const ROLE_COLOR = { admin: '#a855f7', pm: '#6366f1', supervisor: '#0891b2', resource: '#64748b' };
const ROLE_LABEL = { admin: 'Admin', pm: 'Project Manager', supervisor: 'Supervisor', resource: 'Resource' };

function SkillTag({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 500 }}>
      {label}
      {onRemove && <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '0 0 0 2px', fontSize: '12px', lineHeight: 1 }}>×</button>}
    </span>
  );
}

const PAGE_LABELS = {
  dashboard: 'Dashboard', employees: 'Employees', timesheets: 'Timesheets (Replicon)',
  projects: 'Projects', clients: 'Clients', aiInsights: 'AI Insights',
  chatbot: 'Chatbot', myTimesheet: 'My Timesheet', timesheetApproval: 'Approvals',
};

// ── Employee Form Modal ────────────────────────────────────────────────────────

function EmployeeModal({ employee, allEmployees, onSave, onClose }) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    firstName:    employee?.firstName   || '',
    lastName:     employee?.lastName    || '',
    displayName:  employee?.displayName || '',
    email:        employee?.email       || '',
    employeeId:   employee?.employeeId  || '',
    role:         employee?.role        || 'resource',
    skills:       employee?.skills      || [],
    supervisorId: employee?.supervisorId || '',
    startDate:    employee?.startDate   || '',
    endDate:      employee?.endDate     || '',
    status:       employee?.status      || 'active',
  });
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [account, setAccount]   = useState(null); // loaded from API
  const [accForm, setAccForm]   = useState({ userId: '', isAdmin: false, permissions: {}, password: '', confirmPwd: '' });
  const [accTab,  setAccTab]    = useState(false); // show system access section
  const { toast } = useToast();

  const set    = (k, v) => setForm(f  => ({ ...f,  [k]: v }));
  const setAcc = (k, v) => setAccForm(f => ({ ...f, [k]: v }));

  // Load account info when opening an existing employee
  useEffect(() => {
    if (!isEdit || !employee?.id) return;
    fetch(`/api/v1/employees/${employee.id}/account`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setAccount(d);
        setAccForm(f => ({
          ...f,
          userId:      d.userId || '',
          isAdmin:     d.isAdmin || false,
          permissions: d.permissions || {},
        }));
      })
      .catch(() => {});
  }, [employee?.id, isEdit]);

  const saveAccount = async () => {
    if (!accForm.userId.trim()) { toast.error('Login username is required'); return; }
    if (accForm.password && accForm.password !== accForm.confirmPwd) { toast.error('Passwords do not match'); return; }
    const payload = {
      userId:      accForm.userId.trim(),
      isAdmin:     accForm.isAdmin,
      permissions: accForm.permissions,
      ...(accForm.password ? { password: accForm.password } : {}),
    };
    const r = await fetch(`/api/v1/employees/${employee.id}/account`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error || 'Failed to save account'); return; }
    setAccount({ ...account, ...d, userId: accForm.userId });
    setAccForm(f => ({ ...f, password: '', confirmPwd: '' }));
    toast.success('System access updated');
  };

  const addSkill = (skill) => {
    const s = skill.trim();
    if (!s || form.skills.includes(s)) return;
    set('skills', [...form.skills, s]);
    setSkillInput('');
  };

  const handleSkillKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); }
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('First and last name are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, supervisorId: form.supervisorId || null, endDate: form.endDate || null, email: form.email || undefined, employeeId: form.employeeId || undefined };
      const url    = employee?.id ? `/api/v1/employees/${employee.id}` : '/api/v1/employees';
      const method = employee?.id ? 'PUT' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Save failed'); return; }
      toast.success(isEdit ? 'Employee updated' : 'Employee added');
      onSave(d.employee);
    } finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' };

  const supervisorOptions = allEmployees.filter(e => e.status === 'active' && e.id !== employee?.id);

  const allPageKeys = Object.keys(PAGE_LABELS);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: '660px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
      <div className="modal-body">
        <h3 style={{ margin: '0 0 24px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
          <i className={`bx ${employee?.id ? 'bx-edit' : 'bx-user-plus'}`} style={{ color: '#a855f7', marginRight: '10px' }} />
          {employee?.id ? 'Edit Employee' : 'Add Employee'}
        </h3>

        {/* Profile section */}
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Profile</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div><label style={labelStyle}>First Name *</label><input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Last Name *</label><input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Display Name</label><input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder={`${form.firstName} ${form.lastName}`.trim() || 'Auto-filled'} style={inputStyle} /></div>
          <div><label style={labelStyle}>Employee ID</label><input value={form.employeeId} onChange={e => set('employeeId', e.target.value)} placeholder="e.g. EMP-001" style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} /></div>
        </div>

        {/* Role & Dates */}
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role & Dates</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Role *</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} style={inputStyle}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Start Date</label><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>End Date</label><input type="date" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} style={inputStyle} /></div>
        </div>

        {/* Supervisor */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Supervisor</label>
          <select value={form.supervisorId} onChange={e => set('supervisorId', e.target.value)} style={inputStyle}>
            <option value="">— None —</option>
            {supervisorOptions.map(e => <option key={e.id} value={e.id}>{e.displayName || `${e.firstName} ${e.lastName}`}</option>)}
          </select>
        </div>

        {/* Skills */}
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Skills</p>
        <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '28px' }}>
          {form.skills.map(s => <SkillTag key={s} label={s} onRemove={() => set('skills', form.skills.filter(x => x !== s))} />)}
        </div>
        <div style={{ position: 'relative', marginBottom: '6px' }}>
          <input
            value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={handleSkillKey}
            placeholder="Type a skill and press Enter…"
            list="skill-suggestions"
            style={{ ...inputStyle, paddingRight: '80px' }}
          />
          <datalist id="skill-suggestions">{SKILL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
          <button onClick={() => addSkill(skillInput)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: '#a855f7', fontSize: '0.78rem', fontFamily: 'inherit' }}>Add</button>
        </div>

        {/* Status (edit only) */}
        {employee?.id && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ ...labelStyle, margin: 0 }}>Status</label>
            <button onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
              style={{ background: form.status === 'active' ? 'rgba(48,209,88,0.12)' : 'rgba(255,59,48,0.1)', border: `1px solid ${form.status === 'active' ? 'rgba(48,209,88,0.3)' : 'rgba(255,59,48,0.25)'}`, borderRadius: '8px', padding: '5px 14px', cursor: 'pointer', color: form.status === 'active' ? '#30d158' : '#ff3b30', fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600 }}>
              {form.status === 'active' ? '● Active' : '○ Inactive'}
            </button>
          </div>
        )}

        {/* System Access (admin only, edit only) */}
        {employee?.id && (
          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px' }}>
            <button
              onClick={() => setAccTab(t => !t)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: accTab ? '#a78bfa' : 'var(--text-muted)', fontFamily: 'inherit', padding: 0, marginBottom: accTab ? '16px' : 0 }}
            >
              <i className={`bx ${accTab ? 'bx-chevron-down' : 'bx-chevron-right'}`} style={{ fontSize: '16px' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>System Access</span>
              {account?.hasAccount && <span style={{ fontSize: '0.7rem', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderRadius: '5px', padding: '1px 7px', fontWeight: 600 }}>Has Login</span>}
            </button>

            {accTab && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Login Username</label>
                    <input value={accForm.userId} onChange={e => setAcc('userId', e.target.value)} placeholder="e.g. jsmith" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                    <button
                      onClick={() => setAcc('isAdmin', !accForm.isAdmin)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: accForm.isAdmin ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${accForm.isAdmin ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: accForm.isAdmin ? '#c084fc' : 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.83rem', fontWeight: 600 }}
                    >
                      <i className={`bx ${accForm.isAdmin ? 'bxs-shield-alt-2' : 'bx-shield'}`} />
                      {accForm.isAdmin ? 'Admin' : 'Not Admin'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Page Permissions</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {allPageKeys.map(p => {
                      const on = accForm.isAdmin ? true : (accForm.permissions[p] !== false && accForm.permissions[p] !== undefined ? accForm.permissions[p] : true);
                      return (
                        <button
                          key={p}
                          disabled={accForm.isAdmin}
                          onClick={() => setAcc('permissions', { ...accForm.permissions, [p]: !on })}
                          style={{ padding: '3px 10px', borderRadius: '6px', border: `1px solid ${on ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`, background: on ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)', color: on ? '#a78bfa' : 'rgba(255,255,255,0.3)', fontSize: '0.72rem', fontWeight: 600, cursor: accForm.isAdmin ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: accForm.isAdmin ? 0.5 : 1 }}
                        >
                          {PAGE_LABELS[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>{account?.hasAccount ? 'New Password' : 'Password *'}</label>
                    <input type="password" value={accForm.password} onChange={e => setAcc('password', e.target.value)} placeholder={account?.hasAccount ? 'Leave blank to keep current' : 'Set a password'} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input type="password" value={accForm.confirmPwd} onChange={e => setAcc('confirmPwd', e.target.value)} placeholder="Repeat password" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={saveAccount} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', padding: '8px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600 }}>
                    <i className='bx bx-key' style={{ marginRight: '6px' }} />
                    {account?.hasAccount ? 'Update Account' : 'Create Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>{/* /modal-body */}
      <div className="modal-footer">
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '9px 24px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Employees({ sessionUser }) {
  const { toast } = useToast();
  const isAdmin = sessionUser?.isAdmin;

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole]     = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [modal, setModal]         = useState(null); // null | 'add' | employee object

  const PAGE_SIZE = 50;
  const buildParams = useCallback((offset) => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterRole)   params.set('role', filterRole);
    if (search)       params.set('search', search);
    params.set('limit', PAGE_SIZE);
    params.set('offset', offset);
    return params;
  }, [filterStatus, filterRole, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/employees?${buildParams(0)}`, { credentials: 'include' });
      const d = await r.json();
      setEmployees(d.employees || []);
      setTotal(d.total ?? (d.employees || []).length);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  }, [buildParams]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/v1/employees?${buildParams(employees.length)}`, { credentials: 'include' });
      const d = await r.json();
      setEmployees(prev => [...prev, ...(d.employees || [])]);
      setTotal(d.total ?? total);
    } catch { toast.error('Failed to load more'); }
    finally { setLoadingMore(false); }
  };

  useEffect(() => { load(); }, [load]);

  const handleSaved = (emp) => {
    setEmployees(prev => {
      const idx = prev.findIndex(e => e.id === emp.id);
      return idx >= 0 ? prev.map((e, i) => i === idx ? emp : e) : [emp, ...prev];
    });
    setModal(null);
  };

  const toggleStatus = async (emp) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      const r = await fetch(`/api/v1/employees/${emp.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...emp, status: newStatus }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      setEmployees(prev => prev.map(e => e.id === emp.id ? d.employee : e));
      toast.success(`${emp.firstName} ${newStatus === 'active' ? 'reactivated' : 'deactivated'}`);
    } catch { toast.error('Update failed'); }
  };

  // Supervisor lookup
  const supervisorName = (id) => {
    const s = employees.find(e => e.id === id);
    return s ? (s.displayName || `${s.firstName} ${s.lastName}`) : '—';
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <i className='bx bx-group' style={{ color: '#a855f7', marginRight: '10px' }} />Employee Directory
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {total} {filterStatus || 'total'} employee{total !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal('add')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
            <i className='bx bx-plus' /> Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, ID…"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 12px 9px 36px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 14px', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 14px', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
        </div>
      ) : employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
          <i className='bx bx-user-x' style={{ fontSize: '48px', display: 'block', marginBottom: '12px', opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No employees found</p>
          {isAdmin && <p style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>Click "Add Employee" to get started</p>}
        </div>
      ) : (
        <div className="surface" style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr 1fr 80px', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '11px 20px', background: 'rgba(255,255,255,0.03)' }}>
            {['Name', 'Role', 'Email', 'Supervisor', 'Skills', ''].map(h => (
              <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {employees.map((emp, i) => (
            <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr 1fr 80px', gap: '0', padding: '14px 20px', borderBottom: i < employees.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'center', opacity: emp.status === 'inactive' ? 0.5 : 1, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Name */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `${ROLE_COLOR[emp.role]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: ROLE_COLOR[emp.role], flexShrink: 0 }}>
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{emp.displayName || `${emp.firstName} ${emp.lastName}`}</div>
                    {emp.employeeId && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.employeeId}</div>}
                  </div>
                </div>
              </div>

              {/* Role */}
              <div>
                <span style={{ fontSize: '0.75rem', background: `${ROLE_COLOR[emp.role]}20`, color: ROLE_COLOR[emp.role], borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>
                  {ROLE_LABEL[emp.role] || emp.role}
                </span>
              </div>

              {/* Email */}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email || '—'}</div>

              {/* Supervisor */}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{emp.supervisorId ? supervisorName(emp.supervisorId) : '—'}</div>

              {/* Skills */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(emp.skills || []).slice(0, 2).map(s => <SkillTag key={s} label={s} />)}
                {(emp.skills || []).length > 2 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>+{emp.skills.length - 2}</span>}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                {isAdmin && (
                  <>
                    <button onClick={() => setModal(emp)} title="Edit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '5px 9px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <i className='bx bx-pencil' />
                    </button>
                    <button onClick={() => toggleStatus(emp)} title={emp.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      style={{ background: emp.status === 'active' ? 'rgba(255,59,48,0.08)' : 'rgba(48,209,88,0.08)', border: `1px solid ${emp.status === 'active' ? 'rgba(255,59,48,0.2)' : 'rgba(48,209,88,0.2)'}`, borderRadius: '7px', padding: '5px 9px', cursor: 'pointer', color: emp.status === 'active' ? '#ff3b30' : '#30d158', fontSize: '13px' }}>
                      <i className={`bx ${emp.status === 'active' ? 'bx-user-x' : 'bx-user-check'}`} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && employees.length < total && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={loadMore} disabled={loadingMore} className="btn-ghost">
            {loadingMore ? 'Loading…' : `Load more — showing ${employees.length} of ${total}`}
          </button>
        </div>
      )}

      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          allEmployees={employees}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
