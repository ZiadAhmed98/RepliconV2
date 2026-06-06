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

const STATUS_COLORS = {
  in_progress: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', label: 'Active' },
  completed:   { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Done'   },
  on_hold:     { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Hold'   },
  cancelled:   { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Cancel' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function ProgramCard({ program, isAdmin, onEdit, onDelete, isExpanded, onToggle }) {
  const navigate = useNavigate();
  const icon = PROGRAM_ICONS[program.name] || 'bx-collection';

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '16px', overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(139,92,246,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Header */}
      <div
        style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        onClick={onToggle}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.15))',
          border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`bx ${icon}`} style={{ fontSize: '1.15rem', color: '#a78bfa' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {program.name}
          </div>
          {program.description && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {program.description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{
            background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
            border: '1px solid rgba(139,92,246,0.2)', borderRadius: '20px',
            padding: '2px 10px', fontSize: '12px', fontWeight: 600,
          }}>
            {program.projectCount} {program.projectCount === 1 ? 'project' : 'projects'}
          </span>

          {isAdmin && (
            <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => onEdit(program)} style={btnStyle('#a78bfa')} title="Edit"><i className="bx bx-edit" /></button>
              <button onClick={() => onDelete(program)} style={btnStyle('#f87171')} title="Delete"><i className="bx bx-trash" /></button>
            </div>
          )}

          <i className={`bx bx-chevron-${isExpanded ? 'up' : 'down'}`}
            style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', transition: 'transform 0.2s' }} />
        </div>
      </div>

      {/* Projects list */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '0 20px 16px', maxHeight: '300px', overflowY: 'auto' }}>
          {program.projects.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No projects linked to this program yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
              {program.projects.map(proj => {
                const st = STATUS_COLORS[proj.status] || STATUS_COLORS.in_progress;
                return (
                  <div key={proj.id}
                    onClick={() => navigate(`/projects-admin/${proj.id}`, { state: { from: '/programs', fromLabel: 'Programs' } })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '8px 12px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                  >
                    <i className="bx bx-folder" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {proj.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                        {proj.clientName || '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>
                      {fmtDate(proj.startDate)} – {fmtDate(proj.endDate)}
                    </div>
                    <span style={{ background: st.bg, color: st.color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function btnStyle(color) {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '4px 6px', borderRadius: '6px',
    transition: 'color 0.15s, background 0.15s',
    onMouseEnter: undefined,
  };
}

function ProgramModal({ program, onClose, onSave }) {
  const [name, setName]   = useState(program?.name || '');
  const [desc, setDesc]   = useState(program?.description || '');
  const [err,  setErr]    = useState('');
  const [busy, setBusy]   = useState(false);

  const save = async () => {
    if (!name.trim()) return setErr('Name is required');
    setBusy(true);
    setErr('');
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
      <div className="modal-panel" style={{ padding: '32px', width: '480px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
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
        {err && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
const saveBtn    = { padding: '9px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

export default function Programs() {
  const { isAdmin } = usePermissions();
  const [programs, setPrograms]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');
  const [modal,    setModal]      = useState(null); // null | 'add' | { program }
  const [importing,setImporting]  = useState(false);
  const [importMsg,setImportMsg]  = useState('');
  const fileRef = useRef(null);

  // Expanded state lifted here so sessionStorage can persist it across navigations
  const [expandedIds, setExpandedIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('programs_expanded') || '[]')); }
    catch { return new Set(); }
  });

  const toggleExpanded = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { sessionStorage.setItem('programs_expanded', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/programs', { credentials: 'include' });
      const data = await r.json();
      setPrograms(data.programs || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = (savedProgram) => {
    setPrograms(prev => {
      const idx = prev.findIndex(p => p.id === savedProgram?.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...savedProgram };
        return next;
      }
      return [...prev, { ...savedProgram, projectCount: 0, projects: [] }];
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
    setImporting(true);
    setImportMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
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
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              style={{ ...cancelBtn, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}
            >
              <i className="bx bx-upload" />
              {importing ? 'Importing…' : 'Link from CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) { handleImport(e.target.files[0]); e.target.value = ''; } }} />
            <button
              onClick={() => setModal('add')}
              style={{ ...saveBtn, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}
            >
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

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '24px', maxWidth: '360px' }}>
        <i className="bx bx-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '1rem', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search programs…"
          style={{ ...inputStyle, paddingLeft: '36px' }}
        />
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Programs', value: programs.length, icon: 'bx-collection' },
          { label: 'Total Projects', value: programs.reduce((s, p) => s + p.projectCount, 0), icon: 'bx-folder-open' },
          { label: 'With Projects', value: programs.filter(p => p.projectCount > 0).length, icon: 'bx-check-circle' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: '140px', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`bx ${s.icon}`} style={{ fontSize: '1.1rem', color: '#a78bfa' }} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Program cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <i className="bx bx-loader-alt bx-spin" style={{ fontSize: '2rem' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          {search ? 'No programs match your search.' : 'No programs found.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '14px', alignItems: 'start' }}>
          {filtered.map(prog => (
            <ProgramCard
              key={prog.id}
              program={prog}
              isAdmin={isAdmin}
              onEdit={p => setModal({ program: p })}
              onDelete={handleDelete}
              isExpanded={expandedIds.has(prog.id)}
              onToggle={() => toggleExpanded(prog.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal === 'add' && (
        <ProgramModal onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {modal?.program && (
        <ProgramModal program={modal.program} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  );
}
