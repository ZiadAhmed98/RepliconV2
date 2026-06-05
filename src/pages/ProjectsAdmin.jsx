import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const STATUS_TABS = [
  { key: '',           label: 'All'       },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'tentative',   label: 'Tentative'   },
  { key: 'completed',   label: 'Completed'   },
  { key: 'deferred',    label: 'Deferred'    },
  { key: 'cancelled',   label: 'Cancelled'   },
  { key: 'archived',    label: 'Archived'    },
];

const STATUS_COLORS = {
  in_progress: { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', label: 'In Progress' },
  tentative:   { bg: 'rgba(234,179,8,0.12)',   color: '#fbbf24', label: 'Tentative'   },
  completed:   { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', label: 'Completed'   },
  deferred:    { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: 'Deferred'    },
  cancelled:   { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', label: 'Cancelled'   },
  archived:    { bg: 'rgba(107,114,128,0.08)', color: '#6b7280', label: 'Archived'    },
};

const BILLING_LABELS = {
  time_material: 'T&M',
  fixed_bid:     'Fixed',
  non_billable:  'Non-Bill',
};

const INDUSTRIES = ['Technology','Finance','Healthcare','Government','Retail','Manufacturing','Education','Real Estate','Energy','Hospitality','Other'];

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function ProjectModal({ project, clients, employees, onSave, onClose }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    clientId:         project?.clientId         || '',
    name:             project?.name             || '',
    code:             project?.code             || '',
    status:           project?.status           || 'in_progress',
    projectManagerId: project?.projectManagerId || '',
    startDate:        project?.startDate        || '',
    endDate:          project?.endDate          || '',
    budgetHours:      project?.budgetHours      ?? 0,
    billingType:      project?.billingType      || 'time_material',
    notes:            project?.notes            || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    const payload = {
      ...form,
      clientId:         form.clientId         || null,
      projectManagerId: form.projectManagerId || null,
      startDate:        form.startDate        || null,
      endDate:          form.endDate          || null,
      code:             form.code.trim().toUpperCase() || null,
      budgetHours:      Number(form.budgetHours) || 0,
      notes:            form.notes            || null,
    };
    const url    = isEdit ? `/api/v1/psa/projects/${project.id}` : '/api/v1/psa/projects';
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Save failed'); return; }
      onSave(d.project);
    } finally { setSaving(false); }
  };

  const pms = employees.filter(e => e.status === 'active' && (e.role === 'pm' || e.role === 'admin'));

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-card, #12121f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{isEdit ? 'Edit Project' : 'Add New Project'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}>×</button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Project Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Azure Migration" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Project Code</label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. DP-ADNEC-AI" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
              <option value="tentative">Tentative</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="deferred">Deferred</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Client</label>
            <select value={form.clientId} onChange={e => set('clientId', e.target.value)} style={inputStyle}>
              <option value="">— None —</option>
              {clients.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Project Manager</label>
            <select value={form.projectManagerId} onChange={e => set('projectManagerId', e.target.value)} style={inputStyle}>
              <option value="">— Unassigned —</option>
              {pms.map(e => (
                <option key={e.id} value={e.id}>{e.displayName || `${e.firstName} ${e.lastName}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Budget Hours</label>
            <input type="number" min="0" step="0.5" value={form.budgetHours} onChange={e => set('budgetHours', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Billing Type</label>
            <select value={form.billingType} onChange={e => set('billingType', e.target.value)} style={inputStyle}>
              <option value="time_material">Time &amp; Material</option>
              <option value="fixed_bid">Fixed Bid</option>
              <option value="non_billable">Non-Billable</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Project description or notes…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '9px 24px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsAdmin({ sessionUser }) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [projects,   setProjects]   = useState([]);
  const [clients,    setClients]    = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('');
  const [search,     setSearch]     = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterPm,     setFilterPm]     = useState('');
  const [modal, setModal] = useState(null); // null | { mode:'add' } | { mode:'edit', project }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab)     params.set('status',   activeTab);
      if (filterClient)  params.set('clientId', filterClient);
      if (filterPm)      params.set('pmId',     filterPm);
      if (search)        params.set('search',   search);
      const [pRes, cRes, eRes] = await Promise.all([
        fetch(`/api/v1/psa/projects?${params}`, { credentials: 'include' }),
        fetch('/api/v1/clients',               { credentials: 'include' }),
        fetch('/api/v1/employees?status=active',{ credentials: 'include' }),
      ]);
      const [pd, cd, ed] = await Promise.all([pRes.json(), cRes.json(), eRes.json()]);
      setProjects(pd.projects || []);
      setClients(cd.clients   || []);
      setEmployees(ed.employees || []);
    } finally { setLoading(false); }
  }, [activeTab, filterClient, filterPm, search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = (saved) => {
    setModal(null);
    toast.success(modal?.mode === 'edit' ? 'Project updated' : 'Project created');
    load();
  };

  const handleArchive = async (p) => {
    if (!confirm(`Archive "${p.name}"?`)) return;
    const r = await fetch(`/api/v1/psa/projects/${p.id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { toast.success('Project archived'); load(); }
    else       { const d = await r.json(); toast.error(d.error || 'Failed'); }
  };

  const pms = employees.filter(e => e.role === 'pm' || e.role === 'admin');
  const isAdmin = sessionUser?.isAdmin;

  const th = { padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const td = { padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '28px 36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>Projects</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>Manage all client projects, budgets, and teams</p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal({ mode: 'add' })}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
            <i className='bx bx-plus' style={{ fontSize: '1rem' }} /> Add New Project
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ background: activeTab === tab.key ? 'rgba(124,58,237,0.2)' : 'transparent', border: activeTab === tab.key ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: activeTab === tab.key ? '#c4b5fd' : 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: activeTab === tab.key ? 600 : 400, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '280px' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.95rem' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code…"
            style={{ width: '100%', paddingLeft: '32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '8px 10px 8px 32px', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '8px 12px', color: filterClient ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'inherit', minWidth: '150px' }}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterPm} onChange={e => setFilterPm(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '8px 12px', color: filterPm ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'inherit', minWidth: '160px' }}>
          <option value="">All PMs</option>
          {pms.map(e => <option key={e.id} value={e.id}>{e.displayName || `${e.firstName} ${e.lastName}`}</option>)}
        </select>
        {(search || filterClient || filterPm) && (
          <button onClick={() => { setSearch(''); setFilterClient(''); setFilterPm(''); }}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '9px', padding: '8px 12px', cursor: 'pointer', color: '#f87171', fontSize: '0.82rem', fontFamily: 'inherit' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '24px' }} />
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <i className='bx bx-folder-open' style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }} />
            No projects found — {isAdmin ? 'click "Add New Project" to get started.' : 'projects will appear here once added.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Project Name</th>
                  <th style={th}>Code</th>
                  <th style={th}>Status</th>
                  <th style={th}>Client</th>
                  <th style={th}>Project Manager</th>
                  <th style={th}>Dates</th>
                  <th style={th}>Budget Hrs</th>
                  <th style={th}>Billing</th>
                  {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}
                    onClick={() => navigate(`/projects-admin/${p.id}`)}
                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                    </td>
                    <td style={td}>
                      {p.code && <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', padding: '2px 6px', color: 'var(--text-muted)' }}>{p.code}</span>}
                    </td>
                    <td style={td}><StatusBadge status={p.status} /></td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{p.clientName || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{p.projectManagerName || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {p.startDate ? p.startDate : '—'}
                      {p.endDate ? ` → ${p.endDate}` : ''}
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)', textAlign: 'right' }}>{p.budgetHours > 0 ? `${p.budgetHours}h` : '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: '5px', padding: '2px 7px' }}>
                        {BILLING_LABELS[p.billingType] || p.billingType}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModal({ mode: 'edit', project: p })}
                          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#818cf8', fontSize: '0.78rem', fontFamily: 'inherit', marginRight: '6px' }}>
                          Edit
                        </button>
                        <button onClick={() => handleArchive(p)}
                          style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#6b7280', fontSize: '0.78rem', fontFamily: 'inherit' }}>
                          Archive
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count line */}
      {!loading && projects.length > 0 && (
        <p style={{ margin: '12px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      )}

      {modal && (
        <ProjectModal
          project={modal.mode === 'edit' ? modal.project : null}
          clients={clients}
          employees={employees}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
