import React, { useState, useMemo, useCallback, useEffect } from 'react';
import styles from './EditPages.module.css';

const STATUS_OPTS = ['Planning', 'In Progress', 'Completed', 'Archived'];

function parseDateObj(d) {
  if (!d) return '';
  const y = d.year || d.Year, m = String(d.month || d.Month || 1).padStart(2,'0'), day = String(d.day || d.Day || 1).padStart(2,'0');
  return y ? `${y}-${m}-${day}` : '';
}

function toDateObj(str) {
  if (!str) return undefined;
  const [y, m, d] = str.split('-');
  return { year: String(y), month: String(parseInt(m)), day: String(parseInt(d)) };
}

export default function ProjectEdit({ dataMatrix }) {
  const [projects,       setProjects]       = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [loadingList,    setLoadingList]    = useState(false);
  const [selectedUri,    setSelectedUri]    = useState('');
  const [detail,         setDetail]         = useState(null);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [form,           setForm]           = useState({});
  const [pmUri,          setPmUri]          = useState('');
  const [clientUri,      setClientUri]      = useState('');
  const [programUri,     setProgramUri]     = useState('');
  const [teamUris,       setTeamUris]       = useState([]);   // current team
  const [resourcesToAdd, setResourcesToAdd] = useState([]);   // URIs to add
  const [resourcesToRem, setResourcesToRem] = useState([]);   // URIs to remove
  const [saving,         setSaving]         = useState(false);
  const [success,        setSuccess]        = useState(null);
  const [error,          setError]          = useState(null);

  const dicts = useMemo(() => {
    const get = k => dataMatrix?.dictionaries?.[k] || dataMatrix?.[k] || [];
    return {
      users:    [...get('users')].sort((a,b)=>a.name.localeCompare(b.name)),
      clients:  [...get('clients')].sort((a,b)=>a.name.localeCompare(b.name)),
      programs: [...get('programs')].sort((a,b)=>a.name.localeCompare(b.name)),
      pms:      [...get('projectManagers')].sort((a,b)=>a.name.localeCompare(b.name)),
    };
  }, [dataMatrix]);

  const [psaClients,  setPsaClients]  = useState([]);
  const [psaPrograms, setPsaPrograms] = useState([]);

  useEffect(() => {
    fetch('/api/v1/clients?status=active', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPsaClients([...(d.clients || [])].sort((a,b) => a.name.localeCompare(b.name))))
      .catch(() => {});
    fetch('/api/v1/programs', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPsaPrograms([...(d.programs || [])].sort((a,b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  const loadProjects = useCallback(async () => {
    if (projectsLoaded) return;
    setLoadingList(true);
    try {
      const r = await fetch('/api/v1/projects/search', { credentials: 'include' });
      const d = await r.json();
      setProjects(d.projects || []);
      setProjectsLoaded(true);
    } catch (e) { setError('Failed to load projects: ' + e.message); }
    finally { setLoadingList(false); }
  }, [projectsLoaded]);

  const selectProject = useCallback(async (uri) => {
    setSelectedUri(uri); setDetail(null); setForm({}); setSuccess(null); setError(null);
    setResourcesToAdd([]); setResourcesToRem([]);
    if (!uri) return;
    setLoadingDetail(true);
    try {
      const r = await fetch('/api/v1/projects/details', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectUri: uri }),
      });
      const d = await r.json();
      const det = d.detail;
      setDetail(det);
      setForm({
        name:         det?.name || '',
        code:         det?.code || '',
        description:  det?.description || '',
        status:       det?.statusLabel?.name || 'In Progress',
        startDate:    parseDateObj(det?.timeEntryDateRange?.startDate),
        endDate:      parseDateObj(det?.timeEntryDateRange?.endDate),
        estimatedHrs: det?.estimatedHours?.duration?.hours != null ? String(det.estimatedHours.duration.hours) : '',
        percentComplete: det?.percentCompleted != null ? String(Math.round(det.percentCompleted)) : '0',
      });
      setPmUri(det?.projectLeader?.uri || '');
      setClientUri(det?.clients?.[0]?.client?.uri || '');
      setProgramUri(det?.program?.uri || '');
      const team = det?.team || det?.resourceAssignments || [];
      setTeamUris(team.map(t => t?.user?.uri || t?.uri).filter(Boolean));
    } catch (e) { setError('Failed to load project details: ' + e.message); }
    finally { setLoadingDetail(false); }
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toggleRemove = (uri) => {
    setResourcesToRem(prev => prev.includes(uri) ? prev.filter(u=>u!==uri) : [...prev, uri]);
  };

  const addResource = (uri) => {
    if (!uri || resourcesToAdd.includes(uri) || teamUris.includes(uri)) return;
    setResourcesToAdd(prev => [...prev, uri]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUri) return;
    setSaving(true); setSuccess(null); setError(null);
    try {
      const modifications = {};
      if (form.name)        modifications.nameToApply         = { value: form.name };
      if (form.description) modifications.descriptionToApply  = { value: form.description };
      if (form.startDate || form.endDate) {
        modifications.startDateToApply = toDateObj(form.startDate) ? { date: toDateObj(form.startDate) } : undefined;
        modifications.endDateToApply   = toDateObj(form.endDate)   ? { date: toDateObj(form.endDate)   } : undefined;
      }
      if (form.estimatedHrs) modifications.estimatedHoursToApply = { duration: { hours: parseInt(form.estimatedHrs), minutes: 0, seconds: 0 } };
      if (form.percentComplete) modifications.percentCompletedToApply = parseInt(form.percentComplete);
      if (form.status) {
        const statusMap = {
          'Planning': 'urn:replicon:project-status-type:tentative',
          'In Progress': 'urn:replicon:project-status-type:in-progress',
          'Completed': 'urn:replicon:project-status-type:completed',
          'Archived': 'urn:replicon:project-status-type:archived',
        };
        if (statusMap[form.status]) modifications.statusToApply = { uri: statusMap[form.status] };
      }
      if (pmUri)      modifications.projectLeaderToApply = { user: { uri: pmUri } };
      if (programUri) modifications.programToApply       = { program: { uri: programUri } };
      if (clientUri)  modifications.clientAssignmentsSchedulesToApply = { clients: [{ client: { uri: clientUri } }] };

      // Team changes
      if (resourcesToAdd.length || resourcesToRem.length) {
        modifications.resourceAssignmentModifications = {};
        if (resourcesToAdd.length) modifications.resourceAssignmentModifications.resourcesToAdd = resourcesToAdd.map(u => ({ user: { uri: u } }));
        if (resourcesToRem.length) modifications.resourceAssignmentModifications.resourcesToRemove = resourcesToRem.map(u => ({ user: { uri: u } }));
      }

      const res = await fetch('/api/v1/projects/edit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectUri: selectedUri, modifications }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Edit failed');
      setSuccess(`Project "${form.name}" updated successfully.`);
      setResourcesToAdd([]); setResourcesToRem([]);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const userByUri = (uri) => dicts.users.find(u => u.uri === uri);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1><i className='bx bx-edit' style={{ marginRight: 8 }} />Edit Project</h1>
          <p>Select a project to load and modify its settings, team, and dates</p>
        </div>
      </div>

      {/* Project selector */}
      <div className={styles.selectorRibbon}>
        <label>Select Project</label>
        <select value={selectedUri} onFocus={loadProjects} onChange={e => selectProject(e.target.value)} style={{ flex: 1 }}>
          <option value="">— {loadingList ? 'Loading…' : 'Choose a project'} —</option>
          {projects.map(p => <option key={p.uri} value={p.uri}>{p.name}</option>)}
        </select>
        {loadingDetail && <span className={styles.loadingMsg}><i className='bx bx-loader-alt bx-spin' /> Loading details…</span>}
      </div>

      {success && <div className={styles.successMsg}><i className='bx bx-check-circle' />{success}</div>}
      {error   && <div className={styles.errorMsg}><i className='bx bx-error-circle' />{error}</div>}

      {detail && (
        <form onSubmit={handleSubmit}>
          {/* Core fields */}
          <div className={styles.card}>
            <div className={styles.cardHeader}><h3><i className='bx bx-folder' />Project Details</h3></div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Project Name *</label>
                  <input value={form.name} onChange={e=>set('name',e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select value={form.status} onChange={e=>set('status',e.target.value)}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>End Date</label>
                  <input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Estimated Hours</label>
                  <input type="number" min="0" value={form.estimatedHrs} onChange={e=>set('estimatedHrs',e.target.value)} placeholder="0" />
                </div>
                <div className={styles.formGroup}>
                  <label>% Complete</label>
                  <input type="number" min="0" max="100" value={form.percentComplete} onChange={e=>set('percentComplete',e.target.value)} placeholder="0" />
                </div>
                <div className={`${styles.formGroup} ${styles.spanAll}`}>
                  <label>Description</label>
                  <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Assignments */}
          <div className={styles.card} style={{ marginTop: 16 }}>
            <div className={styles.cardHeader}><h3><i className='bx bx-link' />Assignments</h3></div>
            <div className={styles.cardBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Client</label>
                  <select value={clientUri} onChange={e=>setClientUri(e.target.value)}>
                    <option value="">— None —</option>
                    {(psaClients.length > 0 ? psaClients : dicts.clients).map(c => {
                      const uri = c.uri || dicts.clients.find(r => r.name.toLowerCase() === c.name.toLowerCase())?.uri || '';
                      return <option key={c.id || c.uri || c.name} value={uri}>{c.name}</option>;
                    })}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Program</label>
                  <select value={programUri} onChange={e=>setProgramUri(e.target.value)}>
                    <option value="">— None —</option>
                    {(psaPrograms.length > 0 ? psaPrograms : dicts.programs).map(p => {
                      const uri = p.uri || dicts.programs.find(r => r.name.toLowerCase() === p.name.toLowerCase())?.uri || '';
                      return <option key={p.id || p.uri || p.name} value={uri}>{p.name}</option>;
                    })}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Project Manager</label>
                  <select value={pmUri} onChange={e=>setPmUri(e.target.value)}>
                    <option value="">— None —</option>
                    {dicts.users.map(u => <option key={u.uri} value={u.uri}>{u.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className={styles.card} style={{ marginTop: 16 }}>
            <div className={styles.cardHeader}><h3><i className='bx bx-group' />Team Members</h3></div>
            <div className={styles.cardBody}>
              {teamUris.length === 0 && <p style={{ color: 'var(--text-4)', fontSize: '0.875rem', marginBottom: 12 }}>No team members currently assigned.</p>}
              <div className={styles.teamSection}>
                {teamUris.map(uri => {
                  const u = userByUri(uri);
                  const toRemove = resourcesToRem.includes(uri);
                  return (
                    <div key={uri} className={styles.teamRow}>
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: toRemove ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${toRemove ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`, fontSize: '13px', color: toRemove ? 'var(--danger)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className='bx bx-user' style={{ color: 'rgba(255,255,255,0.3)' }} />
                        {u?.name || uri}
                        {toRemove && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--danger)', fontWeight: 600 }}>WILL REMOVE</span>}
                      </div>
                      <button type="button" className={styles.removeBtn} onClick={() => toggleRemove(uri)} title={toRemove ? 'Keep' : 'Remove'}>
                        <i className={`bx ${toRemove ? 'bx-undo' : 'bx-x'}`} />
                      </button>
                    </div>
                  );
                })}

                {/* Add new resource */}
                {resourcesToAdd.map((uri, i) => {
                  const u = userByUri(uri);
                  return (
                    <div key={uri} className={styles.teamRow}>
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className='bx bx-user-plus' />
                        {u?.name || uri}
                        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600 }}>TO ADD</span>
                      </div>
                      <button type="button" className={styles.removeBtn} onClick={() => setResourcesToAdd(prev => prev.filter(u=>u!==uri))}>
                        <i className='bx bx-x' />
                      </button>
                    </div>
                  );
                })}

                <div className={styles.teamRow}>
                  <select defaultValue="" onChange={e => { addResource(e.target.value); e.target.value = ''; }} style={{ flex: 1 }}>
                    <option value="">+ Add team member…</option>
                    {dicts.users.filter(u => !teamUris.includes(u.uri) && !resourcesToAdd.includes(u.uri)).map(u => (
                      <option key={u.uri} value={u.uri}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.submitBar}>
              <button type="button" className={styles.btnGhost} onClick={() => { setSelectedUri(''); setDetail(null); setSuccess(null); setError(null); setResourcesToAdd([]); setResourcesToRem([]); }}>
                <i className='bx bx-x' /> Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving || !form.name?.trim()}>
                {saving ? <><i className='bx bx-loader-alt bx-spin' /> Saving…</> : <><i className='bx bx-save' /> Save Changes</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {!detail && !loadingDetail && !selectedUri && (
        <div className={styles.card} style={{ padding: '48px 24px', textAlign: 'center' }}>
          <i className='bx bx-folder-open' style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.1)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-4)', fontSize: '0.875rem' }}>Select a project above to load it for editing.</p>
        </div>
      )}
    </div>
  );
}
