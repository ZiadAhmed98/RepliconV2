import { useState, useEffect, useCallback } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { S }          from '../../components/settings/styles';
import { APP_PAGES, APP_PAGE_GROUPS } from '../../config/pages';

const ACCENT = '#a78bfa';

// Granular capability matrix (module × actions) — Replicon-style. Stored on the
// set as { 'timesheets.approve': true, ... }. Page access is enforced today via
// apply-to-users; capability flags are captured for progressive enforcement.
const CAP_MODULES = [
  { key: 'timesheets', label: 'Timesheets', actions: ['view', 'edit', 'submit', 'approve', 'reject', 'forceApprove'] },
  { key: 'projects',   label: 'Projects',   actions: ['view', 'create', 'edit', 'archive'] },
  { key: 'clients',    label: 'Clients',    actions: ['view', 'create', 'edit'] },
  { key: 'billing',    label: 'Billing',    actions: ['view', 'manageRates', 'manageInvoices'] },
  { key: 'employees',  label: 'Employees',  actions: ['view', 'manage', 'manageAccess'] },
];
const ACTION_LABEL = {
  view: 'View', edit: 'Edit', create: 'Create', archive: 'Archive', submit: 'Submit',
  approve: 'Approve', reject: 'Reject', forceApprove: 'Force Approve',
  manageRates: 'Manage Rates', manageInvoices: 'Manage Invoices', manage: 'Manage', manageAccess: 'Manage Access',
};
const SET_TYPES = ['Administration', 'Project Management', 'Billing Management', 'Cost Management', 'User', 'Supervisor', 'Client Representative'];

const blankSet = () => ({ name: '', type: 'User', description: '', status: 'enabled', pages: [], capabilities: {} });

export default function RolesPermissions() {
  const [tab, setTab] = useState('sets');
  return (
    <SettingsLayout title="Permission Sets" subtitle="Named access templates and per-user page access" accent={ACCENT}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {[['sets', 'Permission Sets'], ['users', 'Per-User Access']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background: tab === k ? ACCENT : 'transparent', color: tab === k ? '#fff' : 'rgba(255,255,255,0.55)', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'sets' ? <PermissionSetsTab /> : <PerUserTab />}
    </SettingsLayout>
  );
}

// ── Permission Sets tab ──────────────────────────────────────────────────────
function PermissionSetsTab() {
  const [sets,    setSets]    = useState([]);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel,     setSel]     = useState(null);   // set being edited (with _isNew)
  const [saving,  setSaving]  = useState(false);
  const [applyIds, setApplyIds] = useState([]);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, uRes] = await Promise.all([
      fetch('/api/v1/admin/permission-sets', { credentials: 'include' }),
      fetch('/api/v1/admin/users',           { credentials: 'include' }),
    ]);
    const sd = await sRes.json(); const ud = await uRes.json();
    setSets(sd.sets || []); setUsers(ud.users || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const edit = (s) => { setSel(JSON.parse(JSON.stringify(s))); setApplyIds([]); setMsg(''); };
  const create = () => { setSel({ ...blankSet(), _isNew: true }); setApplyIds([]); setMsg(''); };

  const patch = (p) => setSel(s => ({ ...s, ...p }));
  const togglePage = (key) => setSel(s => ({ ...s, pages: s.pages.includes(key) ? s.pages.filter(k => k !== key) : [...s.pages, key] }));
  const toggleCap  = (id)  => setSel(s => ({ ...s, capabilities: { ...s.capabilities, [id]: !s.capabilities[id] } }));

  const save = async () => {
    if (!sel.name.trim()) { setMsg('Name is required'); return; }
    setSaving(true); setMsg('');
    const isNew = sel._isNew;
    const url = isNew ? '/api/v1/admin/permission-sets' : `/api/v1/admin/permission-sets/${sel.id}`;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sel) });
    setSaving(false);
    if (!r.ok) { setMsg((await r.json()).error || 'Save failed'); return; }
    const { set } = await r.json();
    await load(); setSel(set); setMsg('Saved');
  };

  const remove = async (s) => {
    if (!confirm(`Delete permission set "${s.name}"?`)) return;
    await fetch(`/api/v1/admin/permission-sets/${s.id}`, { method: 'DELETE', credentials: 'include' });
    if (sel?.id === s.id) setSel(null);
    load();
  };

  const applyToUsers = async () => {
    if (!applyIds.length) { setMsg('Select at least one user'); return; }
    const r = await fetch(`/api/v1/admin/permission-sets/${sel.id}/apply`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: applyIds }),
    });
    const d = await r.json();
    setMsg(r.ok ? `Applied to ${d.applied} user${d.applied !== 1 ? 's' : ''}` : (d.error || 'Apply failed'));
    if (r.ok) setApplyIds([]);
  };

  if (loading) return <p style={S.muted}>Loading…</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: sel ? 'minmax(0,260px) minmax(0,1fr)' : '1fr', gap: '16px', alignItems: 'start' }}>

      {/* List */}
      <div style={{ ...S.card, padding: '12px' }}>
        <button style={{ ...S.addBtn, width: '100%', justifyContent: 'center', marginBottom: '10px' }} onClick={create}>
          <i className="bx bx-plus" /> Add Permission Set
        </button>
        {sets.length === 0 && <p style={{ ...S.muted, padding: '8px' }}>No permission sets yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sets.map(s => (
            <button key={s.id} onClick={() => edit(s)}
              style={{ textAlign: 'left', background: sel?.id === s.id ? `${ACCENT}22` : 'transparent', border: `1px solid ${sel?.id === s.id ? `${ACCENT}55` : 'transparent'}`, borderRadius: '8px', padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{s.type || '—'} · {s.pages.length} pages</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      {sel && (
        <div style={{ ...S.card, padding: '0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{sel._isNew ? 'New Permission Set' : sel.name}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {msg && <span style={{ fontSize: '12px', color: msg.includes('fail') || msg.includes('required') || msg.includes('Select') ? '#f87171' : '#34d399' }}>{msg}</span>}
              {!sel._isNew && <button style={S.deleteBtn} onClick={() => remove(sel)}>Delete</button>}
              <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>

          <div style={{ padding: '18px 20px' }}>
            {/* Identity */}
            <div style={{ ...S.grid2, marginBottom: '18px' }}>
              <div><label style={S.label}>Name</label><input style={S.input} value={sel.name} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Billing Manager" /></div>
              <div><label style={S.label}>Type</label><select style={S.select} value={sel.type || ''} onChange={e => patch({ type: e.target.value })}>{SET_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label style={S.label}>Status</label><select style={S.select} value={sel.status} onChange={e => patch({ status: e.target.value })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>Description</label><input style={S.input} value={sel.description || ''} onChange={e => patch({ description: e.target.value })} placeholder="What this set is for" /></div>
            </div>

            {/* Page access */}
            <p style={S.cardTitle}>Page Access</p>
            {APP_PAGE_GROUPS.map(group => (
              <div key={group} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
                  {APP_PAGES.filter(p => (p.group || 'Other') === group).map(p => {
                    const on = sel.pages.includes(p.key);
                    return (
                      <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: on ? `${ACCENT}12` : 'transparent', border: `1px solid ${on ? `${ACCENT}30` : 'rgba(255,255,255,0.06)'}` }}>
                        <input type="checkbox" checked={on} onChange={() => togglePage(p.key)} style={{ accentColor: ACCENT }} />
                        <span style={{ fontSize: '12px', color: on ? '#fff' : 'rgba(255,255,255,0.5)' }}>{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Capability matrix */}
            <p style={{ ...S.cardTitle, marginTop: '20px' }}>Module Capabilities</p>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <tbody>
                  {CAP_MODULES.map(m => (
                    <tr key={m.key}>
                      <td style={{ ...S.td, fontWeight: 600, color: '#fff', width: '130px', verticalAlign: 'top' }}>{m.label}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {m.actions.map(a => {
                            const id = `${m.key}.${a}`;
                            const on = !!sel.capabilities[id];
                            return (
                              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={on} onChange={() => toggleCap(id)} style={{ accentColor: ACCENT }} />
                                <span style={{ fontSize: '12px', color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)' }}>{ACTION_LABEL[a] || a}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Apply to users */}
            {!sel._isNew && (
              <>
                <p style={{ ...S.cardTitle, marginTop: '20px' }}>Apply to Users · grants these pages to selected users</p>
                <div style={{ ...S.tableWrap, maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={S.table}>
                    <tbody>
                      {users.map(u => {
                        const on = applyIds.includes(u.id);
                        return (
                          <tr key={u.id} onClick={() => setApplyIds(prev => on ? prev.filter(x => x !== u.id) : [...prev, u.id])} style={{ cursor: 'pointer' }}>
                            <td style={{ ...S.td, width: '36px' }}><input type="checkbox" checked={on} readOnly style={{ accentColor: ACCENT }} /></td>
                            <td style={S.td}>{u.displayName || u.id}</td>
                            <td style={{ ...S.td, color: 'rgba(255,255,255,0.4)' }}>{u.isAdmin ? 'Administrator' : 'Standard User'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button style={{ ...S.addBtn, opacity: applyIds.length ? 1 : 0.5 }} onClick={applyToUsers} disabled={!applyIds.length}>
                    <i className="bx bx-user-check" /> Apply to {applyIds.length || 0} user{applyIds.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-User Access tab (the original page-permission grid) ──────────────────
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16'];
function getColor(name) { let h = 0; for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

function PerUserTab() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState({});
  const [search, setSearch]   = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/users', { credentials: 'include' }).then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function togglePage(userId, page, current) {
    const user = users.find(u => u.id === userId); if (!user) return;
    const perms = { ...user.permissions, [page]: !current };
    setSaving(s => ({ ...s, [userId]: true }));
    try {
      const r = await fetch(`/api/v1/admin/users/${userId}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: perms }) });
      if (r.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: perms } : u));
    } finally { setSaving(s => ({ ...s, [userId]: false })); }
  }

  const filtered = search ? users.filter(u => (u.displayName || u.id).toLowerCase().includes(search.toLowerCase())) : users;
  if (loading) return <p style={S.muted}>Loading users…</p>;

  return (
    <>
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <i className="bx bx-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }} />
        <input style={{ ...S.input, paddingLeft: '36px' }} placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(user => {
          const name = user.displayName || user.id; const color = getColor(name);
          return (
            <div key={user.id} style={{ ...S.card, padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: color + '33', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: '14px' }}>{name[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>{name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>{user.isAdmin ? 'Administrator' : 'Standard User'}</p>
                </div>
                {saving[user.id] && <i className="bx bx-loader-alt bx-spin" style={{ color: ACCENT }} />}
              </div>
              <div style={{ padding: '12px 18px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                {APP_PAGES.map(({ key, label }) => {
                  const allowed = user.permissions?.[key] === true;
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', background: allowed ? `${ACCENT}12` : 'transparent', border: `1px solid ${allowed ? `${ACCENT}30` : 'rgba(255,255,255,0.05)'}` }}>
                      <input type="checkbox" checked={allowed} disabled={saving[user.id]} onChange={() => togglePage(user.id, key, allowed)} style={{ accentColor: ACCENT }} />
                      <span style={{ fontSize: '12px', color: allowed ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)' }}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
