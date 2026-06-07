import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

const ST = {
  active:   { bg: 'rgba(48,209,88,0.12)',  color: '#30d158', border: 'rgba(48,209,88,0.25)'  },
  inactive: { bg: 'rgba(255,59,48,0.08)',  color: '#ff3b30', border: 'rgba(255,59,48,0.2)'   },
};

const TITLES = [
  'Account Manager', 'Senior Account Manager', 'Key Account Manager',
  'Strategic Account Manager', 'Account Executive', 'Sales Manager',
  'Business Development Manager', 'Customer Success Manager', 'Other',
];

// ── Form Modal ─────────────────────────────────────────────────────────────────

function AMModal({ am, onSave, onClose }) {
  const isEdit = !!am;
  const [form, setForm] = useState({
    firstName:   am?.firstName   || '',
    lastName:    am?.lastName    || '',
    displayName: am?.displayName || '',
    email:       am?.email       || '',
    phone:       am?.phone       || '',
    title:       am?.title       || '',
    status:      am?.status      || 'active',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill displayName when first/last changes if user hasn't manually set it
  const handleName = (k, v) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      const auto = `${updated.firstName} ${updated.lastName}`.trim();
      if (!f.displayName || f.displayName === `${f.firstName} ${f.lastName}`.trim()) {
        updated.displayName = auto;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setSaving(true);
    try {
      const url    = isEdit ? `/api/v1/account-managers/${am.id}` : '/api/v1/account-managers';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Save failed'); return; }
      toast.success(isEdit ? 'Updated' : 'Account manager added');
      onSave(d.accountManager);
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const lbl = { fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: '560px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
      <div className="modal-body">
        <h3 style={{ margin: '0 0 24px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
          <i className={`bx ${isEdit ? 'bx-edit' : 'bx-user-badge'}`} style={{ color: '#34d399', marginRight: '10px' }} />
          {isEdit ? 'Edit Account Manager' : 'Add Account Manager'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>First Name *</label>
            <input value={form.firstName} onChange={e => handleName('firstName', e.target.value)} style={inp} placeholder="Charbel" />
          </div>
          <div>
            <label style={lbl}>Last Name *</label>
            <input value={form.lastName} onChange={e => handleName('lastName', e.target.value)} style={inp} placeholder="Stephan" />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={lbl}>Display Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional override)</span></label>
          <input value={form.displayName} onChange={e => set('displayName', e.target.value)} style={inp} placeholder="Auto-filled from first + last name" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} placeholder="charbel@liveroute.com" />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} placeholder="+971 50 000 0000" />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={lbl}>Title</label>
          <select value={form.title} onChange={e => set('title', e.target.value)} style={inp}>
            <option value="">— Select title —</option>
            {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {isEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <label style={{ ...lbl, margin: 0 }}>Status</label>
            <button onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
              style={{ background: ST[form.status].bg, border: `1px solid ${ST[form.status].border}`, borderRadius: '8px', padding: '5px 14px', cursor: 'pointer', color: ST[form.status].color, fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600 }}>
              {form.status === 'active' ? '● Active' : '○ Inactive'}
            </button>
          </div>
        )}

      </div>{/* /modal-body */}
      <div className="modal-footer">
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#059669,#34d399)', border: 'none', borderRadius: '9px', padding: '9px 24px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Account Manager'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AM Card ────────────────────────────────────────────────────────────────────

function AMCard({ am, isAdmin, onEdit, onToggle }) {
  const st = ST[am.status] || ST.inactive;
  const initials = `${am.firstName?.[0] || ''}${am.lastName?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', padding: '20px',
      opacity: am.status === 'inactive' ? 0.55 : 1,
      display: 'flex', flexDirection: 'column',
      transition: 'border-color 0.2s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>{initials}</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.2 }}>{am.displayName}</div>
            <div style={{ fontSize: '0.76rem', color: 'rgba(52,211,153,0.7)', marginTop: '3px' }}>{am.title || '—'}</div>
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '6px', padding: '2px 8px', flexShrink: 0 }}>
          {am.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gap: '8px', flex: 1 }}>
        <InfoRow icon="bx-envelope" value={am.email} />
        <InfoRow icon="bx-phone"   value={am.phone} />
        <InfoRow icon="bx-briefcase" value={am.clientCount > 0 ? `${am.clientCount} active client${am.clientCount !== 1 ? 's' : ''}` : 'No active clients'} color={am.clientCount > 0 ? '#6366f1' : undefined} />
      </div>

      {/* Actions */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginTop: '14px' }}>
          <button onClick={() => onEdit(am)}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <i className='bx bx-pencil' /> Edit
          </button>
          <button onClick={() => onToggle(am)}
            style={{ flex: 1, background: am.status === 'active' ? 'rgba(255,59,48,0.07)' : 'rgba(48,209,88,0.08)', border: `1px solid ${am.status === 'active' ? 'rgba(255,59,48,0.2)' : 'rgba(48,209,88,0.2)'}`, borderRadius: '8px', padding: '7px', cursor: 'pointer', color: am.status === 'active' ? '#ff3b30' : '#30d158', fontSize: '0.82rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <i className={`bx ${am.status === 'active' ? 'bx-pause-circle' : 'bx-play-circle'}`} />
            {am.status === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: color || 'var(--text-muted)' }}>
      <i className={`bx ${icon}`} style={{ width: '14px', flexShrink: 0, opacity: 0.6 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AccountManagers({ sessionUser }) {
  const { toast } = useToast();
  const isAdmin = sessionUser?.isAdmin;

  const [ams,          setAms]          = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [modal,        setModal]        = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (search)       params.set('search', search);
      const r = await fetch(`/api/v1/account-managers?${params}`, { credentials: 'include' });
      const d = await r.json();
      setAms(d.accountManagers || []);
    } catch { toast.error('Failed to load account managers'); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (am) => {
    setAms(prev => {
      const idx = prev.findIndex(a => a.id === am.id);
      return idx >= 0 ? prev.map((a, i) => i === idx ? am : a) : [am, ...prev];
    });
    setModal(null);
  };

  const toggleStatus = async (am) => {
    const newStatus = am.status === 'active' ? 'inactive' : 'active';
    try {
      const r = await fetch(`/api/v1/account-managers/${am.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...am, status: newStatus }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      setAms(prev => prev.map(a => a.id === am.id ? { ...a, status: newStatus } : a));
      toast.success(`${am.displayName} ${newStatus === 'active' ? 'reactivated' : 'deactivated'}`);
    } catch { toast.error('Update failed'); }
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <i className='bx bx-user-badge' style={{ color: '#34d399', marginRight: '10px' }} />Account Managers
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {ams.length} {filterStatus || 'total'} account manager{ams.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal('add')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#059669,#34d399)', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
            <i className='bx bx-plus' /> Add Account Manager
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, title…"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 12px 9px 36px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 14px', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
          <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
        </div>
      ) : ams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
          <i className='bx bx-user-badge' style={{ fontSize: '52px', display: 'block', marginBottom: '14px', opacity: 0.25 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No account managers found</p>
          {isAdmin && <p style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>Click "Add Account Manager" to get started</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
          {ams.map(am => (
            <AMCard key={am.id} am={am} isAdmin={isAdmin} onEdit={a => setModal(a)} onToggle={toggleStatus} />
          ))}
        </div>
      )}

      {modal && (
        <AMModal
          am={modal === 'add' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
