import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';

const PROGRAM_ICONS = {
  'Deployment Projects':                  'bx-rocket',
  'Service Level Agreements':             'bx-shield-quarter',
  'Post Implementation Support':          'bx-wrench',
  'Copilot':                              'bx-chip',
  'Customer Facing Workshops':            'bx-group',
  'Application Modernization Assessment': 'bx-search-alt',
  'Proof of Concept':                     'bx-test-tube',
  'Managed Services (On-Site)':           'bx-buildings',
  'Managed Services (Remote)':            'bx-wifi',
  'DC Migration Assessment':              'bx-server',
  'Certification/Training':               'bx-certification',
  'Customer/Vendor Meetings':             'bx-conversation',
  'Proposals Preparation':                'bx-file',
  'Internal':                             'bx-home-circle',
};

// Estimated rendered width of a pill: ~7.5px per char + 24px padding + 6px gap
function pillEstW(name) { return Math.ceil(name.length * 7.5 + 24) + 6; }
const MORE_W = 72; // "+999 more" badge

function ProgramRow({ program, isAdmin, onEdit, onDelete }) {
  const navigate  = useNavigate();
  const pillsRef  = useRef(null);
  const [pillsW, setPillsW] = useState(() => Math.max(0, window.innerWidth - 580));

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setPillsW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const icon = PROGRAM_ICONS[program.name] || 'bx-collection';

  // Greedily fit pills within measured width, always reserve space for "+N more" badge
  let used = 0;
  const visible = [];
  for (const proj of program.projects) {
    const pw = pillEstW(proj.name);
    const remaining = program.projects.length - visible.length - 1;
    const badgeRoom = remaining > 0 ? MORE_W : 0;
    if (used + pw + badgeRoom <= pillsW) {
      visible.push(proj);
      used += pw;
    } else {
      break;
    }
  }
  const hidden = program.projects.length - visible.length;

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 20px rgba(0,0,0,0.25)',
        borderRadius: '14px', padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: '16px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.28)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(139,92,246,0.07)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Icon */}
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(59,130,246,0.15))',
        border: '1px solid rgba(139,92,246,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`bx ${icon}`} style={{ fontSize: '1.1rem', color: '#a78bfa' }} />
      </div>

      {/* Name + description */}
      <div style={{ minWidth: '160px', maxWidth: '240px', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {program.name}
        </div>
        {program.description && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {program.description}
          </div>
        )}
      </div>

      {/* Project pills */}
      <div ref={pillsRef} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flexWrap: 'nowrap' }}>
        {program.projectCount === 0 ? (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>No projects</span>
        ) : (
          <>
            {visible.map(proj => (
              <span
                key={proj.id}
                onClick={e => { e.stopPropagation(); navigate(`/projects-admin/${proj.id}`, { state: { from: '/programs', fromLabel: 'Programs' } }); }}
                style={{
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '20px', padding: '3px 11px', fontSize: '12px', fontWeight: 500,
                  color: '#c4b5fd', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)';  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; }}
                title={proj.name}
              >
                {proj.name}
              </span>
            ))}
            {hidden > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                +{hidden} more
              </span>
            )}
          </>
        )}
      </div>

      {/* Admin buttons */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={() => onEdit(program)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '5px 7px', borderRadius: '7px', transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'none'; }}
            title="Edit"
          >
            <i className="bx bx-edit" />
          </button>
          <button
            onClick={() => onDelete(program)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '5px 7px', borderRadius: '7px', transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'none'; }}
            title="Delete"
          >
            <i className="bx bx-trash" />
          </button>
        </div>
      )}
    </div>
  );
}

function ProgramModal({ program, onClose, onSave }) {
  const [name, setName] = useState(program?.name || '');
  const [desc, setDesc] = useState(program?.description || '');
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return setErr('Name is required');
    setBusy(true); setErr('');
    try {
      const url    = program ? `/api/v1/programs/${program.id}` : '/api/v1/programs';
      const method = program ? 'PUT' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc }) });
      const data = await r.json();
      if (!r.ok) return setErr(data.error || 'Failed');
      onSave(data.program || { ...program, name, description: desc });
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: '480px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-body">
          <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {program ? 'Edit Program' : 'Add Program'}
          </h2>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Program Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Deployment Projects" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Optional description…" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {err && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '8px' }}>{err}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={save} disabled={busy} style={saveBtn}>{busy ? 'Saving…' : (program ? 'Save Changes' : 'Add Program')}</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' };
const cancelBtn  = { padding: '9px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' };
const saveBtn    = { padding: '9px 20px', borderRadius: '10px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

export default function Programs() {
  const { isAdmin } = usePermissions();
  const [programs,   setPrograms]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(null);
  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/programs', { credentials: 'include' });
      const data = await r.json();
      setPrograms(data.programs || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = (saved) => {
    setPrograms(prev => {
      const idx = prev.findIndex(p => p.id === saved?.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], ...saved }; return next; }
      return [...prev, { ...saved, projectCount: 0, projects: [] }];
    });
    setModal(null);
    load();
  };

  const handleDelete = async (program) => {
    if (!confirm(`Delete program "${program.name}"? Projects will be unlinked.`)) return;
    await fetch(`/api/v1/programs/${program.id}`, { method: 'DELETE', credentials: 'include' });
    setPrograms(prev => prev.filter(p => p.id !== program.id));
  };

  const handleImport = async (file) => {
    setImporting(true); setImportMsg('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r    = await fetch('/api/v1/programs/import-csv', { method: 'POST', credentials: 'include', body: fd });
      const data = await r.json();
      if (!r.ok) return setImportMsg(`Error: ${data.error}`);
      setImportMsg(`Done — ${data.programsCreated} programs created, ${data.projectsLinked} projects linked.`);
      load();
    } finally { setImporting(false); }
  };

  const filtered = programs.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 32px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Programs</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Service delivery programs — each groups multiple client projects.
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              style={{ ...cancelBtn, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
              <i className="bx bx-upload" /> {importing ? 'Importing…' : 'Link from CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) { handleImport(e.target.files[0]); e.target.value = ''; } }} />
            <button onClick={() => setModal('add')}
              style={{ ...saveBtn, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
              <i className="bx bx-plus" /> Add Program
            </button>
          </div>
        )}
      </div>

      {importMsg && (
        <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {importMsg}
          <button onClick={() => setImportMsg('')} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Search + summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '0 0 300px' }}>
          <i className="bx bx-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '1rem', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search programs…" style={{ ...inputStyle, paddingLeft: '36px' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Programs', value: programs.length, icon: 'bx-collection' },
            { label: 'Total Projects', value: programs.reduce((s, p) => s + p.projectCount, 0), icon: 'bx-folder-open' },
            { label: 'With Projects', value: programs.filter(p => p.projectCount > 0).length, icon: 'bx-check-circle' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={`bx ${s.icon}`} style={{ fontSize: '0.95rem', color: '#a78bfa' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Program rows */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <i className="bx bx-loader-alt bx-spin" style={{ fontSize: '2rem' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          {search ? 'No programs match your search.' : 'No programs found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(prog => (
            <ProgramRow
              key={prog.id}
              program={prog}
              isAdmin={isAdmin}
              onEdit={p => setModal({ program: p })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modal === 'add' && <ProgramModal onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.program && <ProgramModal program={modal.program} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  );
}
