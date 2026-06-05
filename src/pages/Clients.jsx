import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

const INDUSTRIES = [
  'Telecommunications', 'Banking & Finance', 'Government', 'Healthcare',
  'Retail & Consumer', 'Oil & Gas', 'Education', 'Hospitality',
  'Real Estate', 'Technology', 'Manufacturing', 'Logistics', 'Other',
];

const STATUS_STYLE = {
  active:   { bg: 'rgba(48,209,88,0.12)',  color: '#30d158', border: 'rgba(48,209,88,0.25)'  },
  inactive: { bg: 'rgba(255,59,48,0.08)',  color: '#ff3b30', border: 'rgba(255,59,48,0.2)'   },
};

// ── Client Form Modal ──────────────────────────────────────────────────────────

function ClientModal({ client, employees, onSave, onClose }) {
  const isEdit = !!client;
  const [form, setForm] = useState({
    name:             client?.name             || '',
    code:             client?.code             || '',
    industry:         client?.industry         || '',
    contactName:      client?.contactName      || '',
    contactEmail:     client?.contactEmail     || '',
    contactPhone:     client?.contactPhone     || '',
    website:          client?.website          || '',
    accountManagerId: client?.accountManagerId || '',
    status:           client?.status           || 'active',
    notes:            client?.notes            || '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Client name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, accountManagerId: form.accountManagerId || null, code: form.code || undefined };
      const url    = isEdit ? `/api/v1/clients/${client.id}` : '/api/v1/clients';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Save failed'); return; }
      toast.success(isEdit ? 'Client updated' : 'Client added');
      onSave(d.client);
    } finally { setSaving(false); }
  };

  const inputStyle  = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle  = { fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' };
  const sectionStyle = { margin: '0 0 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' };

  // Account managers = employees with PM or admin role who are active
  const accountManagers = employees.filter(e => e.status === 'active' && (e.role === 'pm' || e.role === 'admin'));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '32px', width: '640px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        <h3 style={{ margin: '0 0 24px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
          <i className={`bx ${isEdit ? 'bx-edit' : 'bx-briefcase'}`} style={{ color: '#6366f1', marginRight: '10px' }} />
          {isEdit ? 'Edit Client' : 'Add Client'}
        </h3>

        {/* Basic info */}
        <p style={sectionStyle}>Client Info</p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Client Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Zain Telecom" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Code <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(short ID)</span></label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. ZAIN" maxLength={20} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>Industry</label>
            <select value={form.industry} onChange={e => set('industry', e.target.value)} style={inputStyle}>
              <option value="">— Select —</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Account Manager</label>
            <select value={form.accountManagerId} onChange={e => set('accountManagerId', e.target.value)} style={inputStyle}>
              <option value="">— Assign later —</option>
              {accountManagers.length === 0
                ? <option disabled>No PMs added yet</option>
                : accountManagers.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.displayName || `${e.firstName} ${e.lastName}`}
                    </option>
                  ))
              }
            </select>
          </div>
        </div>

        {/* Contact */}
        <p style={sectionStyle}>Contact</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div><label style={labelStyle}>Contact Name</label><input value={form.contactName} onChange={e => set('contactName', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Email</label><input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Phone</label><input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+971 …" style={inputStyle} /></div>
          <div><label style={labelStyle}>Website</label><input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://…" style={inputStyle} /></div>
        </div>

        {/* Notes */}
        <p style={sectionStyle}>Notes</p>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional context about this client…"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />

        {/* Status (edit only) */}
        {isEdit && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ ...labelStyle, margin: 0 }}>Status</label>
            <button onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
              style={{ background: STATUS_STYLE[form.status].bg, border: `1px solid ${STATUS_STYLE[form.status].border}`, borderRadius: '8px', padding: '5px 14px', cursor: 'pointer', color: STATUS_STYLE[form.status].color, fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600 }}>
              {form.status === 'active' ? '● Active' : '○ Inactive'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)', border: 'none', borderRadius: '9px', padding: '9px 24px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Client Card ────────────────────────────────────────────────────────────────

function ClientCard({ client, isAdmin, onEdit, onToggle }) {
  const st = STATUS_STYLE[client.status] || STATUS_STYLE.inactive;
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', opacity: client.status === 'inactive' ? 0.55 : 1, transition: 'border-color 0.2s, transform 0.15s', cursor: 'default' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Avatar */}
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>
              {client.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.2 }}>{client.name}</div>
            {client.code && <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderRadius: '4px', padding: '1px 6px', marginTop: '3px', display: 'inline-block' }}>{client.code}</span>}
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '6px', padding: '2px 8px', flexShrink: 0 }}>
          {client.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gap: '7px', marginBottom: '14px' }}>
        {client.industry && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <i className='bx bx-building' style={{ width: '14px', flexShrink: 0 }} />
            {client.industry}
          </div>
        )}
        {client.accountManagerName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <i className='bx bx-user-circle' style={{ width: '14px', flexShrink: 0 }} />
            AM: <span style={{ color: 'var(--text-sub)' }}>{client.accountManagerName}</span>
          </div>
        )}
        {client.contactName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <i className='bx bx-id-card' style={{ width: '14px', flexShrink: 0 }} />
            {client.contactName}
            {client.contactEmail && <span style={{ color: 'var(--text-sub)' }}>· {client.contactEmail}</span>}
          </div>
        )}
        {client.contactPhone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <i className='bx bx-phone' style={{ width: '14px', flexShrink: 0 }} />
            {client.contactPhone}
          </div>
        )}
      </div>

      {/* Notes preview */}
      {client.notes && (
        <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          {client.notes.length > 100 ? client.notes.slice(0, 100) + '…' : client.notes}
        </p>
      )}

      {/* Actions */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          <button onClick={() => onEdit(client)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <i className='bx bx-pencil' /> Edit
          </button>
          <button onClick={() => onToggle(client)}
            style={{ flex: 1, background: client.status === 'active' ? 'rgba(255,59,48,0.07)' : 'rgba(48,209,88,0.08)', border: `1px solid ${client.status === 'active' ? 'rgba(255,59,48,0.2)' : 'rgba(48,209,88,0.2)'}`, borderRadius: '8px', padding: '7px', cursor: 'pointer', color: client.status === 'active' ? '#ff3b30' : '#30d158', fontSize: '0.82rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <i className={`bx ${client.status === 'active' ? 'bx-pause-circle' : 'bx-play-circle'}`} />
            {client.status === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Clients({ sessionUser }) {
  const { toast } = useToast();
  const isAdmin = sessionUser?.isAdmin;

  const [clients,       setClients]       = useState([]);
  const [employees,     setEmployees]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('active');
  const [modal,         setModal]         = useState(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (search)       params.set('search', search);
      const r = await fetch(`/api/v1/clients?${params}`, { credentials: 'include' });
      const d = await r.json();
      setClients(d.clients || []);
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  // Load employees for the AM dropdown (only once)
  useEffect(() => {
    fetch('/api/v1/employees?status=active', { credentials: 'include' })
      .then(r => r.json()).then(d => setEmployees(d.employees || [])).catch(() => {});
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleSaved = (client) => {
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === client.id);
      return idx >= 0 ? prev.map((c, i) => i === idx ? client : c) : [client, ...prev];
    });
    setModal(null);
  };

  const toggleStatus = async (client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    try {
      const r = await fetch(`/api/v1/clients/${client.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, status: newStatus, accountManagerId: client.accountManagerId || null }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      setClients(prev => prev.map(c => c.id === client.id ? d.client : c));
      toast.success(`${client.name} ${newStatus === 'active' ? 'reactivated' : 'deactivated'}`);
    } catch { toast.error('Update failed'); }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <i className='bx bx-briefcase' style={{ color: '#6366f1', marginRight: '10px' }} />Clients
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {clients.length} {filterStatus || 'total'} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal('add')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
            <i className='bx bx-plus' /> Add Client
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 12px 9px 36px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 14px', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
          <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
        </div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
          <i className='bx bx-briefcase' style={{ fontSize: '52px', display: 'block', marginBottom: '14px', opacity: 0.25 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No clients found</p>
          {isAdmin && <p style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>Click "Add Client" to get started</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              isAdmin={isAdmin}
              onEdit={c => setModal(c)}
              onToggle={toggleStatus}
            />
          ))}
        </div>
      )}

      {modal && (
        <ClientModal
          client={modal === 'add' ? null : modal}
          employees={employees}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
