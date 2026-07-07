import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/SettingsContext';

const INDUSTRIES = [
  'Telecommunications', 'Banking & Finance', 'Government', 'Healthcare',
  'Retail & Consumer', 'Oil & Gas', 'Education', 'Hospitality',
  'Real Estate', 'Technology', 'Manufacturing', 'Logistics', 'Other',
];

const STATUS_STYLE = {
  active:   { bg: 'rgba(48,209,88,0.12)',  color: '#30d158', border: 'rgba(48,209,88,0.25)'  },
  inactive: { bg: 'rgba(255,59,48,0.08)',  color: '#ff3b30', border: 'rgba(255,59,48,0.2)'   },
};

// ── Shared row helper ──────────────────────────────────────────────────────────
function Row({ icon, label, value, color, onClick }) {
  const clickable = !!onClick && !!value;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem' }}>
      <i className={`bx ${icon}`} style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '1px', flexShrink: 0, width: '14px' }} />
      <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{label}:</span>
      <span onClick={clickable ? onClick : undefined}
        style={{ color: color || 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: clickable ? 'pointer' : 'default' }}
        onMouseEnter={clickable ? (e => { e.currentTarget.style.textDecoration = 'underline'; }) : undefined}
        onMouseLeave={clickable ? (e => { e.currentTarget.style.textDecoration = 'none'; }) : undefined}>
        {value || '—'}
      </span>
    </div>
  );
}

// ── Client Form Modal ──────────────────────────────────────────────────────────

function ClientModal({ client, accountManagers, onSave, onClose }) {
  const isEdit = !!client;
  const { group } = useAppSettings();
  const cs = group('clients');   // dynamic client settings
  const [form, setForm] = useState({
    name:        client?.name        || '',
    code:        client?.code        || '',
    industry:    client?.industry    || '',
    contactName: client?.contactName || '',
    contactEmail:client?.contactEmail|| '',
    contactPhone:client?.contactPhone|| '',
    website:     client?.website     || '',
    managerId:   client?.managerId   || '',
    tierId:      client?.tierId      || '',
    slaId:       client?.slaId       || '',
    status:      client?.status      || cs.defaultStatus || 'active',
    notes:       client?.notes       || '',
  });
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers]   = useState([]);
  const [slas,  setSlas]    = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/v1/admin/client-tiers', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { client_tiers: [] })
      .then(d => setTiers(d.client_tiers || [])).catch(() => {});
    fetch('/api/v1/admin/sla-tiers', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { sla_tiers: [] })
      .then(d => setSlas(d.sla_tiers || [])).catch(() => {});
  }, []);

  const autoCode = !isEdit && !!cs.autoGenerateCode;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Client name is required'); return; }
    if (cs.requireContact && !(form.contactName.trim() || form.contactEmail.trim())) { toast.error('Contact name or email is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, managerId: form.managerId || null, code: form.code || undefined };
      const url    = isEdit ? `/api/v1/clients/${client.id}` : '/api/v1/clients';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Save failed'); return; }
      toast.success(isEdit ? 'Client updated' : 'Client added');
      onSave(d.client);
    } finally { setSaving(false); }
  };

  const inp  = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const lbl  = { fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' };
  const sec  = { margin: '0 0 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' };

  const activeAMs = accountManagers.filter(a => a.status === 'active');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: '640px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
      <div className="modal-body">
        <h3 style={{ margin: '0 0 24px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
          <i className={`bx ${isEdit ? 'bx-edit' : 'bx-briefcase'}`} style={{ color: '#6366f1', marginRight: '10px' }} />
          {isEdit ? 'Edit Client' : 'Add Client'}
        </h3>

        <p style={sec}>Client Info</p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>Client Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Zain Telecom" style={inp} />
          </div>
          <div>
            <label style={lbl}>Code <span style={{ fontWeight: 400 }}>{autoCode ? '(auto-generated if blank)' : '(short ID)'}</span></label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder={autoCode ? 'Leave blank to auto-number' : 'e.g. ZAIN'} maxLength={20} style={inp} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <div>
            <label style={lbl}>Industry</label>
            <select value={form.industry} onChange={e => set('industry', e.target.value)} style={inp}>
              <option value="">— Select —</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Account Manager</label>
            <select value={form.managerId} onChange={e => set('managerId', e.target.value)} style={inp}>
              <option value="">— Assign later —</option>
              {activeAMs.length === 0
                ? <option disabled>No account managers yet</option>
                : activeAMs.map(am => (
                    <option key={am.id} value={am.id}>
                      {am.displayName}{am.title ? ` · ${am.title}` : ''}
                    </option>
                  ))
              }
            </select>
          </div>
          <div>
            <label style={lbl}>Client Tier</label>
            <select value={form.tierId} onChange={e => set('tierId', e.target.value)} style={inp}>
              <option value="">— None —</option>
              {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>SLA</label>
            <select value={form.slaId} onChange={e => set('slaId', e.target.value)} style={inp}>
              <option value="">— None —</option>
              {slas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <p style={sec}>Contact</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div><label style={lbl}>Contact Name</label><input value={form.contactName} onChange={e => set('contactName', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Contact Email</label><input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Phone</label><input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+971 …" style={inp} /></div>
          <div><label style={lbl}>Website</label><input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://…" style={inp} /></div>
        </div>

        <p style={sec}>Notes</p>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
          placeholder="Any additional context…"
          style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />

        {isEdit && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ ...lbl, margin: 0 }}>Status</label>
            <button onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
              style={{ background: STATUS_STYLE[form.status].bg, border: `1px solid ${STATUS_STYLE[form.status].border}`, borderRadius: '8px', padding: '5px 14px', cursor: 'pointer', color: STATUS_STYLE[form.status].color, fontSize: '0.83rem', fontFamily: 'inherit', fontWeight: 600 }}>
              {form.status === 'active' ? '● Active' : '○ Inactive'}
            </button>
          </div>
        )}

      </div>{/* /modal-body */}
      <div className="modal-footer">
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)', border: 'none', borderRadius: '9px', padding: '9px 24px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Client Card — uniform height, dash for missing data ────────────────────────

function ClientCard({ client, isAdmin, onEdit, onToggle, onOpen, onOpenAM }) {
  const st = STATUS_STYLE[client.status] || STATUS_STYLE.inactive;
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.28)',
      borderRadius: '14px', padding: '20px',
      opacity: client.status === 'inactive' ? 0.6 : 1,
      display: 'flex', flexDirection: 'column',
      transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top row — name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>
              {client.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div onClick={onOpen} title="View client"
              style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#818cf8'; e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.textDecoration = 'none'; }}>
              {client.name}
            </div>
            <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderRadius: '4px', padding: '1px 6px', marginTop: '3px', display: 'inline-block' }}>
              {client.code || '—'}
            </span>
            {client.tierName && (
              <span style={{ fontSize: '0.7rem', background: `${client.tierColor || '#f59e0b'}22`, color: client.tierColor || '#f59e0b', border: `1px solid ${client.tierColor || '#f59e0b'}44`, borderRadius: '4px', padding: '1px 6px', marginTop: '3px', marginLeft: '5px', display: 'inline-block' }}>
                {client.tierName}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '6px', padding: '2px 8px', flexShrink: 0, marginLeft: '8px' }}>
          {client.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Fixed info grid — always same rows → uniform card height */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, marginBottom: '14px' }}>
        <Row icon="bx-building"     label="Industry" value={client.industry} />
        <Row icon="bx-user-badge"   label="AM"       value={client.accountManagerName} color="#34d399" onClick={client.managerId ? onOpenAM : null} />
        <Row icon="bx-envelope"     label="AM email" value={client.amEmail} />
        <Row icon="bx-phone"        label="AM phone" value={client.amPhone} />
        <Row icon="bx-id-card"      label="Contact"  value={client.contactName} />
        <Row icon="bx-at"           label="Email"    value={client.contactEmail} />
        <Row icon="bx-mobile"       label="Phone"    value={client.contactPhone} />
        {client.slaName && (
          <Row icon="bx-time-five" label="SLA" color="#60a5fa"
            value={`${client.slaName}${client.slaResponseHours ? ` · ${client.slaResponseHours}h resp` : ''}${client.slaResolutionHours ? ` / ${client.slaResolutionHours}h res` : ''}`} />
        )}
      </div>

      {/* Notes preview */}
      <div style={{ minHeight: '36px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginBottom: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {client.notes || <span style={{ color: 'rgba(255,255,255,0.2)' }}>No notes</span>}
      </div>

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
  const navigate = useNavigate();
  const isAdmin = sessionUser?.isAdmin;

  const [clients,        setClients]        = useState([]);
  const [accountManagers,setAccountManagers] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [total,          setTotal]          = useState(0);
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('active');
  const [modal,          setModal]          = useState(null);

  const PAGE_SIZE = 50;
  const buildParams = useCallback((offset) => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (search)       params.set('search', search);
    params.set('limit', PAGE_SIZE);
    params.set('offset', offset);
    return params;
  }, [filterStatus, search]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/clients?${buildParams(0)}`, { credentials: 'include' });
      const d = await r.json();
      setClients(d.clients || []);
      setTotal(d.total ?? (d.clients || []).length);
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, [buildParams]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/v1/clients?${buildParams(clients.length)}`, { credentials: 'include' });
      const d = await r.json();
      setClients(prev => [...prev, ...(d.clients || [])]);
      setTotal(d.total ?? total);
    } catch { toast.error('Failed to load more'); }
    finally { setLoadingMore(false); }
  };

  // Load account managers for the AM dropdown (once on mount)
  useEffect(() => {
    fetch('/api/v1/account-managers', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAccountManagers(d.accountManagers || []))
      .catch(() => {});
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
        body: JSON.stringify({ ...client, status: newStatus, managerId: client.managerId || null }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      setClients(prev => prev.map(c => c.id === client.id ? d.client : c));
      toast.success(`${client.name} ${newStatus === 'active' ? 'reactivated' : 'deactivated'}`);
    } catch { toast.error('Update failed'); }
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <i className='bx bx-briefcase' style={{ color: '#6366f1', marginRight: '10px' }} />Clients
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {total} {filterStatus || 'total'} client{total !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal('add')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
            <i className='bx bx-plus' /> Add Client
          </button>
        )}
      </div>

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              isAdmin={isAdmin}
              onEdit={c => setModal(c)}
              onToggle={toggleStatus}
              onOpen={() => navigate(`/clients/${client.id}`, { state: { from: '/clients', fromLabel: 'Clients' } })}
              onOpenAM={() => navigate(`/account-managers/${client.managerId}`, { state: { from: '/clients', fromLabel: 'Clients' } })}
            />
          ))}
        </div>
      )}

      {!loading && clients.length < total && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={loadMore} disabled={loadingMore} className="btn-ghost">
            {loadingMore ? 'Loading…' : `Load more — showing ${clients.length} of ${total}`}
          </button>
        </div>
      )}

      {modal && (
        <ClientModal
          client={modal === 'add' ? null : modal}
          accountManagers={accountManagers}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
