import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/SettingsContext';

const STATUS_COLORS = {
  in_progress: { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', label: 'In Progress' },
  tentative:   { bg: 'rgba(234,179,8,0.12)',   color: '#fbbf24', label: 'Tentative'   },
  completed:   { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', label: 'Completed'   },
  deferred:    { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: 'Deferred'    },
  cancelled:   { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', label: 'Cancelled'   },
  archived:    { bg: 'rgba(107,114,128,0.08)', color: '#6b7280', label: 'Archived'    },
};

const TASK_STATUS_COLORS = {
  open:        { bg: 'rgba(234,179,8,0.1)',   color: '#fbbf24', label: 'Open'        },
  in_progress: { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', label: 'In Progress' },
  completed:   { bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', label: 'Completed'   },
  closed:      { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af', label: 'Closed'      },
};

const BILLING_LABELS = { time_material: 'T&M', adoption_tm: 'Adoption/PS', fixed_bid: 'Fixed Bid', sla_retainer: 'SLA/Retainer', staff_aug: 'Staff Aug', non_billable: 'Non-Billable' };

function StatusBadge({ status, map }) {
  const s = (map || STATUS_COLORS)[status] || { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function TaskModal({ task, tasks, projectId, onSave, onClose }) {
  const isEdit = !!task;
  const { group } = useAppSettings();
  const ts = group('tasks');   // dynamic task settings
  const [form, setForm] = useState({
    name:           task?.name           || '',
    code:           task?.code           || '',
    parentTaskId:   task?.parentTaskId   || '',
    status:         task?.status         || ts.defaultStatus || 'open',
    estimatedHours: task?.estimatedHours ?? (isEdit ? 0 : (ts.defaultEstimatedHours ?? 0)),
    startDate:      task?.startDate      || '',
    endDate:        task?.endDate        || '',
    description:    task?.description    || '',
    sortOrder:      task?.sortOrder      ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Task name is required'); return; }
    if (ts.requireEstimate && !(Number(form.estimatedHours) > 0)) { setError('An estimate (hours) is required'); return; }
    setSaving(true); setError('');
    const payload = {
      ...form,
      parentTaskId:   form.parentTaskId   || null,
      startDate:      form.startDate      || null,
      endDate:        form.endDate        || null,
      code:           form.code.trim()    || null,
      description:    form.description    || null,
      estimatedHours: Number(form.estimatedHours) || 0,
      sortOrder:      Number(form.sortOrder) || 0,
    };
    const url    = isEdit ? `/api/v1/psa/tasks/${task.id}` : `/api/v1/psa/projects/${projectId}/tasks`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Save failed'); return; }
      onSave(d.task);
    } finally { setSaving(false); }
  };

  const parentOptions = tasks.filter(t => t.id !== task?.id);

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-card, #12121f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{isEdit ? 'Edit Task' : 'Add Task'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}>×</button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Task Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Assessment & Planning" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Code</label>
            <input value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. T001" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Parent Task</label>
            <select value={form.parentTaskId} onChange={e => set('parentTaskId', e.target.value)} style={inputStyle}>
              <option value="">— None (top-level task) —</option>
              {parentOptions.filter(t => !t.parentTaskId).map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Estimated Hours</label>
            <input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Sort Order</label>
            <input type="number" min="0" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Optional task details…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '8px 18px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '8px 22px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── XML Import Modal ──────────────────────────────────────────────────────────

const XML_FORMAT_HINT = `Supported formats:

1. MS Project XML — Export your .mpp via File > Save As > XML (*.xml)
   Duration is parsed automatically (1 day = 8 hrs). OutlineLevel builds hierarchy.

2. Simple custom XML:
<tasks>
  <task name="Phase 1: Assessment" code="T001" estimatedHours="16" startDate="2026-06-01" endDate="2026-06-15">
    <task name="Kickoff Meeting"         code="T001.1" estimatedHours="2"  />
    <task name="Requirements Gathering"  code="T001.2" estimatedHours="14" />
  </task>
  <task name="Phase 2: Implementation"  code="T002"   estimatedHours="80">
    <task name="Setup Environment"       code="T002.1" estimatedHours="8"  />
    <task name="Core Development"        code="T002.2" estimatedHours="72" />
  </task>
</tasks>`;

const TASK_STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', completed: 'Completed', closed: 'Closed' };

function XmlImportModal({ projectId, onImported, onClose }) {
  const { toast }                   = useToast();
  const fileRef                     = React.useRef(null);
  const [fileName,   setFileName]   = useState('');
  const [preview,    setPreview]    = useState(null); // parsed task array from server
  const [error,      setError]      = useState('');
  const [parsing,    setParsing]    = useState(false);
  const [importing,  setImporting]  = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(null); setError(''); setParsing(true);
    try {
      const xml = await file.text();
      const r   = await fetch('/api/v1/psa/parse-xml', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Parse failed'); return; }
      setPreview(d.tasks);
    } catch (e) { setError('Failed to read file'); }
    finally { setParsing(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setImporting(true);
    try {
      const r = await fetch(`/api/v1/psa/projects/${projectId}/tasks/bulk`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: preview }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Import failed'); return; }
      toast.success(`Imported ${d.imported} task${d.imported !== 1 ? 's' : ''}`);
      onImported(d.tasks);
    } finally { setImporting(false); }
  };

  const parentName = (t) => preview?.find(p => p._tempId === t._parentTempId)?.name;

  const th = { padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', whiteSpace: 'nowrap' };
  const td = { padding: '8px 12px', fontSize: '0.83rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-card, #12121f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '800px', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Import Tasks from XML</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Upload MS Project XML (.mpp exported as XML) or nested &lt;task&gt; format</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem', padding: '4px' }}>×</button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          onDrop={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; handleDrop(e); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', transition: 'border-color 0.15s', background: 'rgba(255,255,255,0.01)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}>
          <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
          <i className='bx bx-upload' style={{ fontSize: '2rem', color: 'rgba(139,92,246,0.6)', marginBottom: '10px', display: 'block' }} />
          {fileName
            ? <div><strong style={{ color: 'var(--text-main)' }}>{fileName}</strong><br /><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Click or drag to replace</span></div>
            : <div><strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>Click to select XML file</strong><br /><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>or drag and drop here</span></div>
          }
        </div>

        {/* Format hint */}
        <details style={{ marginBottom: '16px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)', userSelect: 'none' }}>Show expected XML format</summary>
          <pre style={{ marginTop: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', overflowX: 'auto', lineHeight: 1.5 }}>
            {XML_FORMAT_HINT}
          </pre>
        </details>

        {/* Parsing indicator */}
        {parsing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'rgba(99,102,241,0.07)', borderRadius: '10px', marginBottom: '14px', fontSize: '0.85rem', color: '#818cf8' }}>
            <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '1.1rem' }} /> Parsing XML…
          </div>
        )}

        {/* Error */}
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#f87171', fontSize: '0.83rem' }}>{error}</div>}

        {/* Preview table */}
        {preview && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ margin: 0, fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preview — {preview.length} task{preview.length !== 1 ? 's' : ''} found
              </p>
              <span style={{ fontSize: '0.75rem', color: 'rgba(34,197,94,0.7)' }}>
                <i className='bx bx-check' /> Ready to import
              </span>
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.26)', borderRadius: '12px', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'rgba(12,12,22,0.95)' }}>
                  <tr>
                    <th style={{ ...th, width: '28px' }}>#</th>
                    <th style={th}>Task Name</th>
                    <th style={th}>Code</th>
                    <th style={th}>Parent Task</th>
                    <th style={{ ...th, textAlign: 'right' }}>Est. Hours</th>
                    <th style={th}>Start</th>
                    <th style={th}>End</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((t, i) => {
                    const isChild   = !!t._parentTempId;
                    const isSummary = !!t.isSummary;
                    return (
                      <tr key={i}
                        style={{ background: isSummary ? 'rgba(99,102,241,0.04)' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = isSummary ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.background = isSummary ? 'rgba(99,102,241,0.04)' : 'transparent'}>
                        <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{i + 1}</td>
                        <td style={{ ...td, paddingLeft: isChild ? '28px' : '12px' }}>
                          {isSummary && <i className='bx bx-folder' style={{ color: '#818cf8', marginRight: '6px', fontSize: '0.85rem', verticalAlign: 'middle' }} />}
                          {!isSummary && isChild && <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>↳</span>}
                          <span style={{ fontWeight: isSummary ? 700 : isChild ? 400 : 500, color: isSummary ? '#a78bfa' : isChild ? 'var(--text-muted)' : 'var(--text-main)' }}>{t.name}</span>
                          {isSummary && <span style={{ marginLeft: '7px', fontSize: '0.68rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '4px', padding: '1px 5px' }}>phase</span>}
                        </td>
                        <td style={td}>{t.code ? <code style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 6px', fontSize: '0.76rem' }}>{t.code}</code> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{isChild ? parentName(t) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', color: t.estimatedHours > 0 ? '#818cf8' : 'var(--text-muted)', fontWeight: t.estimatedHours > 0 ? 600 : 400 }}>
                          {t.estimatedHours > 0 ? `${t.estimatedHours}h` : isSummary ? <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Σ</span> : '—'}
                        </td>
                        <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t.startDate || '—'}</td>
                        <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t.endDate   || '—'}</td>
                        <td style={td}><span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '2px 7px', color: 'var(--text-muted)' }}>{TASK_STATUS_LABELS[t.status] || t.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'inherit' }}>Cancel</button>
          {preview && (
            <button onClick={handleImport} disabled={importing}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '9px 24px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600, opacity: importing ? 0.6 : 1 }}>
              <i className='bx bx-import' style={{ fontSize: '1rem' }} />
              {importing ? 'Importing…' : `Import ${preview.length} Task${preview.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectDetail({ sessionUser }) {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { projects: projSettings } = useAppSettings();   // dynamic health thresholds

  const [project,        setProject]       = useState(null);
  const [tasks,          setTasks]         = useState([]);
  const [members,        setMembers]       = useState([]);
  const [allEmps,        setAllEmps]       = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [activeTab,      setActiveTab]     = useState('tasks');
  const [taskModal,      setTaskModal]     = useState(null);
  const [xmlModal,       setXmlModal]      = useState(false);
  const [addingMember,   setAddingMember]  = useState(null);
  const [memberSearch,   setMemberSearch]  = useState('');
  const [resourceTooltip, setResourceTooltip] = useState(null);
  const [reviewingReq,   setReviewingReq]  = useState(null); // reqId being approved/rejected

  const isAdmin = sessionUser?.isAdmin;
  const canManageTeam = isAdmin || sessionUser?.role === 'pm' || sessionUser?.role === 'supervisor';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetches = [
        fetch(`/api/v1/psa/projects/${id}`,           { credentials: 'include' }),
        fetch(`/api/v1/psa/projects/${id}/tasks`,     { credentials: 'include' }),
        fetch(`/api/v1/psa/projects/${id}/resources`, { credentials: 'include' }),
        fetch('/api/v1/employees?status=active',       { credentials: 'include' }),
      ];
      if (canManageTeam) fetches.push(fetch(`/api/v1/psa/projects/${id}/access-requests`, { credentials: 'include' }));
      const results = await Promise.all(fetches);
      const [pd, td, md, ed, rd] = await Promise.all(results.map(r => r.json()));
      if (!results[0].ok) { toast.error('Project not found'); navigate('/projects-admin'); return; }
      setProject(pd.project);
      setTasks(td.tasks || []);
      setMembers(md.members || []);
      setAllEmps((ed.employees || []).map(e => ({ ...e, skills: e.skills || [] })));
      if (rd) setAccessRequests(rd.requests || []);
    } finally { setLoading(false); }
  }, [id, canManageTeam]);

  useEffect(() => { load(); }, [load]);

  const handleTaskSave = (saved) => {
    setTaskModal(null);
    toast.success(taskModal?.mode === 'edit' ? 'Task updated' : 'Task added');
    load();
  };

  const handleXmlImported = (newTasks) => {
    setXmlModal(false);
    setTasks(newTasks);
  };

  const addMember = async (empId) => {
    setAddingMember(empId);
    const r = await fetch(`/api/v1/psa/projects/${id}/resources`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error || 'Failed to add'); }
    else {
      const msg = d.tasksAutoAssigned > 0
        ? `Added to team & auto-assigned to ${d.tasksAutoAssigned} task${d.tasksAutoAssigned !== 1 ? 's' : ''}`
        : 'Added to team';
      toast.success(msg);
      await load();
    }
    setAddingMember(null);
  };

  const removeMember = async (empId) => {
    const r = await fetch(`/api/v1/psa/projects/${id}/resources/${empId}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { setMembers(prev => prev.filter(m => m.id !== empId)); toast.success('Removed from team'); }
    else { const d = await r.json(); toast.error(d.error || 'Failed'); }
  };

  const reviewRequest = async (reqId, action) => {
    setReviewingReq(reqId);
    try {
      const r = await fetch(`/api/v1/psa/project-access-requests/${reqId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(action === 'approve' ? 'Access approved — employee added to team' : 'Request rejected');
        setAccessRequests(prev => prev.filter(req => req.id !== reqId));
        if (action === 'approve') load();
      } else { toast.error(d.error || 'Failed'); }
    } finally { setReviewingReq(null); }
  };

  const handleDeleteTask = async (t) => {
    if (!confirm(`Delete task "${t.name}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/v1/psa/tasks/${t.id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { toast.success('Task deleted'); load(); }
    else       { const d = await r.json(); toast.error(d.error || 'Failed'); }
  };

  if (loading) return (
    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '28px' }} />
    </div>
  );
  if (!project) return null;

  const statusStyle = STATUS_COLORS[project.status] || { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af', label: project.status };
  const topTasks    = tasks.filter(t => !t.parentTaskId);
  const subTasks    = (parentId) => tasks.filter(t => t.parentTaskId === parentId);
  const totalEstimated = tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);

  const th = { padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const td = { padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  function TaskRow({ task, depth = 0 }) {
    const children = subTasks(task.id);
    const [expanded, setExpanded] = useState(true);
    return (
      <>
        <tr onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <td style={{ ...td, paddingLeft: `${14 + depth * 24}px` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {children.length > 0 && (
                <button onClick={() => setExpanded(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0', flexShrink: 0, lineHeight: 1 }}>
                  <i className={`bx bx-chevron-${expanded ? 'down' : 'right'}`} />
                </button>
              )}
              {children.length === 0 && depth > 0 && <span style={{ width: '16px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>↳</span>}
              <span style={{ fontWeight: depth === 0 ? 600 : 400, color: depth === 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{task.name}</span>
              {children.length > 0 && (
                <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: '4px', padding: '1px 6px' }}>{children.length} sub</span>
              )}
            </div>
          </td>
          <td style={td}>
            {task.code && <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 6px', color: 'var(--text-muted)' }}>{task.code}</span>}
          </td>
          <td style={td}><StatusBadge status={task.status} map={TASK_STATUS_COLORS} /></td>
          <td style={{ ...td, color: task.estimatedHours > 0 ? '#818cf8' : 'var(--text-muted)', textAlign: 'right' }}>
            {task.estimatedHours > 0 ? `${task.estimatedHours}h` : '—'}
          </td>
          <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            {task.startDate || '—'}{task.endDate ? ` → ${task.endDate}` : ''}
          </td>
          <td style={td}
            onMouseEnter={e => {
              if (task.resources?.length) {
                const rect = e.currentTarget.getBoundingClientRect();
                setResourceTooltip({ resources: task.resources, x: rect.left, y: rect.bottom });
              }
            }}
            onMouseLeave={() => setResourceTooltip(null)}>
            {!task.resources?.length ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'default' }}>
                {task.resources.slice(0, 3).map(r => (
                  <div key={r.id}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>
                    {(r.firstName?.[0] || '')}{(r.lastName?.[0] || '')}
                  </div>
                ))}
                {task.resources.length > 3 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '2px' }}>+{task.resources.length - 3}</span>
                )}
              </div>
            )}
          </td>
          {isAdmin && (
            <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button onClick={() => setTaskModal({ mode: 'edit', task })}
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: '#818cf8', fontSize: '0.76rem', fontFamily: 'inherit', marginRight: '6px' }}>
                Edit
              </button>
              <button onClick={() => handleDeleteTask(task)}
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: '#f87171', fontSize: '0.76rem', fontFamily: 'inherit' }}>
                Delete
              </button>
            </td>
          )}
        </tr>
        {expanded && children.map(child => <TaskRow key={child.id} task={child} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <div style={{ padding: '28px 36px' }}>
      {/* Back */}
      <button onClick={() => navigate('/projects-admin')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'inherit', padding: '0', marginBottom: '20px', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
        <i className='bx bx-arrow-back' /> Back to Projects
      </button>

      {/* Project Header */}
      <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.26)', borderRadius: '16px', padding: '24px 28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{project.name}</h1>
              {project.code && <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', borderRadius: '7px', padding: '3px 10px', color: 'var(--text-muted)' }}>{project.code}</span>}
              <span style={{ background: statusStyle.bg, color: statusStyle.color, borderRadius: '7px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{statusStyle.label}</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              {project.clientName && (
                <span><i className='bx bx-briefcase' style={{ marginRight: '5px', fontSize: '0.9rem' }} />Client: <strong style={{ color: 'var(--text-main)' }}>{project.clientName}</strong></span>
              )}
              {project.projectManagerName && (
                <span><i className='bx bx-user' style={{ marginRight: '5px', fontSize: '0.9rem' }} />PM: <strong style={{ color: 'var(--text-main)' }}>{project.projectManagerName}</strong></span>
              )}
              {(project.startDate || project.endDate) && (
                <span><i className='bx bx-calendar' style={{ marginRight: '5px', fontSize: '0.9rem' }} />
                  {project.startDate || '?'} → {project.endDate || 'Ongoing'}
                </span>
              )}
            </div>
          </div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#818cf8' }}>{project.budgetHours || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Budget Hrs</div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4ade80' }}>{totalEstimated}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Est. Task Hrs</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>{project.actualHours || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Actual Hrs</div>
            </div>
            {project.billableValue > 0 && (
              <div style={{ background: 'rgba(244,114,182,0.07)', border: '1px solid rgba(244,114,182,0.18)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f472b6' }}>
                  {project.billableCurrency} {project.billableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Billable Value</div>
              </div>
            )}
            {project.budgetHours > 0 && (() => {
              const pct      = Math.round((project.actualHours || 0) / project.budgetHours * 100);
              const warnAt   = Number(projSettings.budgetAlertPct)    || 80;
              const critAt   = Number(projSettings.budgetCriticalPct) || 100;
              const tone     = pct >= critAt ? '#f87171' : pct >= warnAt ? '#fbbf24' : '#4ade80';
              const border   = pct >= critAt ? 'rgba(239,68,68,0.4)' : pct >= warnAt ? 'rgba(251,191,36,0.25)' : 'rgba(34,197,94,0.2)';
              return (
                <div style={{ background: 'rgba(251,191,36,0.07)', border: `1px solid ${border}`, borderRadius: '10px', padding: '12px 18px', textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: tone }}>{pct}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Burn Rate</div>
                </div>
              );
            })()}
            <div style={{ background: 'rgba(107,114,128,0.07)', border: '1px solid rgba(107,114,128,0.15)', borderRadius: '10px', padding: '12px 18px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#9ca3af' }}>{tasks.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Tasks</div>
            </div>
          </div>
        </div>

        {project.notes && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {project.notes}
          </div>
        )}

        {/* Billing + dates row */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>Billing: <strong style={{ color: 'var(--text-main)' }}>{BILLING_LABELS[project.billingType] || project.billingType}</strong></span>
          <span>Created: <strong style={{ color: 'var(--text-main)' }}>{project.createdAt?.slice(0, 10)}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {[
          { key: 'tasks', label: 'Tasks', icon: 'bx-task', badge: tasks.length },
          { key: 'team',  label: 'Team',  icon: 'bx-group', badge: members.length, alert: canManageTeam ? accessRequests.length : 0 },
          { key: 'info',  label: 'Info',  icon: 'bx-info-circle' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: activeTab === tab.key ? 'rgba(124,58,237,0.2)' : 'transparent', border: activeTab === tab.key ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', color: activeTab === tab.key ? '#c4b5fd' : 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: activeTab === tab.key ? 600 : 400, transition: 'all 0.15s' }}>
            <i className={`bx ${tab.icon}`} style={{ fontSize: '0.95rem' }} />{tab.label}
            {tab.badge > 0 && (
              <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '9px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>{tab.badge}</span>
            )}
            {tab.alert > 0 && (
              <span style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', borderRadius: '9px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>{tab.alert} pending</span>
            )}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {tasks.length === 0 ? 'No tasks yet' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalEstimated}h estimated`}
            </p>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setXmlModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '9px', padding: '8px 16px', cursor: 'pointer', color: '#818cf8', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 500 }}>
                  <i className='bx bx-code-block' style={{ fontSize: '1rem' }} /> Import XML
                </button>
                <button onClick={() => setTaskModal({ mode: 'add' })}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 600 }}>
                  <i className='bx bx-plus' style={{ fontSize: '1rem' }} /> Add Task
                </button>
              </div>
            )}
          </div>

          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.26)', borderRadius: '14px', overflow: 'hidden' }}>
            {tasks.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <i className='bx bx-task' style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }} />
                No tasks yet — add manually or import from XML
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Task Name</th>
                      <th style={th}>Code</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Est. Hours</th>
                      <th style={th}>Dates</th>
                      <th style={th}>Resources</th>
                      {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {topTasks.map(t => <TaskRow key={t.id} task={t} depth={0} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (() => {
        const assignedIds = new Set(members.map(m => m.id));
        const searchLc    = memberSearch.toLowerCase();
        const available   = allEmps.filter(e =>
          !assignedIds.has(e.id) &&
          (`${e.firstName} ${e.lastName} ${e.email || ''} ${e.employeeId || ''}`).toLowerCase().includes(searchLc)
        );
        const ROLE_C = { admin: '#a855f7', pm: '#6366f1', supervisor: '#0891b2', resource: '#64748b' };

        return (
          <div style={{ maxWidth: '700px' }}>
            {/* PM note */}
            {project.projectManagerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '18px' }}>
                <i className='bx bx-user-pin' style={{ color: '#818cf8', fontSize: '18px' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Project Manager: <strong style={{ color: '#c4b5fd' }}>{project.projectManagerName}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', marginLeft: '8px' }}>(set on project, not in team list)</span>
                </span>
              </div>
            )}

            {/* Pending access requests */}
            {canManageTeam && accessRequests.length > 0 && (
              <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className='bx bx-lock-open-alt' style={{ color: '#fbbf24', fontSize: '15px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Pending Access Requests ({accessRequests.length})
                  </span>
                </div>
                {accessRequests.map((req, i) => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < accessRequests.length - 1 ? '1px solid rgba(251,191,36,0.1)' : 'none' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `${ROLE_C[req.role] || '#64748b'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: ROLE_C[req.role] || '#64748b', flexShrink: 0 }}>
                      {req.firstName?.[0]}{req.lastName?.[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{req.displayName || `${req.firstName} ${req.lastName}`}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1px' }}>{req.email || ''} · Requested {new Date(req.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
                      <button onClick={() => reviewRequest(req.id, 'approve')} disabled={!!reviewingReq}
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '7px', padding: '5px 12px', cursor: reviewingReq ? 'not-allowed' : 'pointer', color: '#4ade80', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 600, opacity: reviewingReq === req.id ? 0.6 : 1 }}>
                        {reviewingReq === req.id ? '…' : 'Approve'}
                      </button>
                      <button onClick={() => reviewRequest(req.id, 'reject')} disabled={!!reviewingReq}
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', padding: '5px 12px', cursor: reviewingReq ? 'not-allowed' : 'pointer', color: '#f87171', fontSize: '0.78rem', fontFamily: 'inherit', opacity: reviewingReq ? 0.5 : 1 }}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current team */}
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.26)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Assigned Team Members ({members.length})
              </div>
              {members.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <i className='bx bx-user-x' style={{ fontSize: '32px', display: 'block', marginBottom: '8px', opacity: 0.3 }} />
                  No team members assigned yet
                </div>
              ) : members.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `${ROLE_C[m.role] || '#64748b'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: ROLE_C[m.role] || '#64748b', flexShrink: 0 }}>
                    {m.firstName?.[0]}{m.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.displayName || `${m.firstName} ${m.lastName}`}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{m.email || m.employeeId || ''}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: `${ROLE_C[m.role] || '#64748b'}20`, color: ROLE_C[m.role] || '#64748b', borderRadius: '5px', padding: '2px 8px', fontWeight: 600 }}>
                    {m.role === 'pm' ? 'PM' : m.role}
                  </span>
                  {canManageTeam && (
                    <button onClick={() => removeMember(m.id)}
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#f87171', fontSize: '0.75rem', fontFamily: 'inherit' }}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add member */}
            {canManageTeam && (
              <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.26)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Add Team Member</div>
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <i className='bx bx-search' style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '15px' }} />
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Filter by name or email…"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px 8px 36px', color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                  {available.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                      <i className='bx bx-user-check' style={{ fontSize: '28px', display: 'block', marginBottom: '8px', opacity: 0.3 }} />
                      {allEmps.filter(e => !assignedIds.has(e.id)).length === 0 ? 'All active employees are already on this team' : 'No employees match the filter'}
                    </div>
                  ) : available.map((e, i) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: i < available.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `${ROLE_C[e.role] || '#64748b'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', color: ROLE_C[e.role] || '#64748b', flexShrink: 0 }}>
                        {e.firstName?.[0]}{e.lastName?.[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{e.displayName || `${e.firstName} ${e.lastName}`}</div>
                        {e.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.email}</div>}
                      </div>
                      <span style={{ fontSize: '0.7rem', background: `${ROLE_C[e.role] || '#64748b'}20`, color: ROLE_C[e.role] || '#64748b', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, flexShrink: 0 }}>
                        {e.role === 'pm' ? 'PM' : e.role}
                      </span>
                      <button onClick={() => addMember(e.id)} disabled={!!addingMember}
                        style={{ background: addingMember === e.id ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '7px', padding: '5px 12px', cursor: addingMember ? 'not-allowed' : 'pointer', color: '#818cf8', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', opacity: addingMember && addingMember !== e.id ? 0.5 : 1 }}>
                        {addingMember === e.id
                          ? <><i className='bx bx-loader-alt bx-spin' style={{ fontSize: '13px' }} /> Adding…</>
                          : <><i className='bx bx-plus' style={{ fontSize: '13px' }} /> Add</>
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.26)', borderRadius: '14px', padding: '24px', maxWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            {[
              { label: 'Name',            value: project.name },
              { label: 'Code',            value: project.code || '—' },
              { label: 'Status',          value: STATUS_COLORS[project.status]?.label || project.status },
              { label: 'Billing',         value: BILLING_LABELS[project.billingType] || '—' },
              { label: 'Client',          value: project.clientName || '—' },
              { label: 'Program',         value: project.programName || '—' },
              { label: 'Project Manager', value: project.projectManagerName || '—' },
              { label: 'Start Date',      value: project.startDate || '—' },
              { label: 'End Date',        value: project.endDate   || 'Ongoing' },
              { label: 'Budget Hours',    value: project.budgetHours ? `${project.budgetHours}h` : '—' },
              { label: 'Created',         value: project.createdAt?.slice(0, 10) || '—' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{row.label}</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 500 }}>{row.value}</div>
              </div>
            ))}
            {project.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Notes</div>
                <div style={{ fontSize: '0.87rem', color: 'var(--text-main)', lineHeight: 1.6 }}>{project.notes}</div>
              </div>
            )}
          </div>
          {isAdmin && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => navigate('/projects-admin', { state: { editId: project.id } })}
                style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: '9px', padding: '9px 22px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit', fontWeight: 600 }}>
                Edit Project
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resource hover tooltip */}
      {resourceTooltip && (
        <div style={{ position: 'fixed', left: resourceTooltip.x, top: resourceTooltip.y + 4, background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', zIndex: 9999, minWidth: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Assigned Resources</div>
          {resourceTooltip.resources.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>
                {(r.firstName?.[0] || '')}{(r.lastName?.[0] || '')}
              </div>
              <span style={{ fontSize: '0.83rem', color: 'var(--text-main)' }}>{r.displayName || `${r.firstName} ${r.lastName}`}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto', paddingLeft: '8px' }}>{r.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Task Modal */}
      {taskModal && (
        <TaskModal
          task={taskModal.mode === 'edit' ? taskModal.task : null}
          tasks={tasks}
          projectId={id}
          onSave={handleTaskSave}
          onClose={() => setTaskModal(null)}
        />
      )}

      {/* XML Import Modal */}
      {xmlModal && (
        <XmlImportModal
          projectId={id}
          onImported={handleXmlImported}
          onClose={() => setXmlModal(false)}
        />
      )}
    </div>
  );
}
