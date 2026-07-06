import React, { useState, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import ProjectTaskBoard, { COLS, statusToCol } from './ProjectTaskBoard';

// Home "My Work": a project selector (kills infinite scroll) + the shared
// drag-and-drop board for the selected project.
export default function MyWorkBoard({ tasks, setTasks, onAddToTimesheet, addingKeys, nav }) {
  const { toast } = useToast();
  const [search, setSearch]         = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // Group tasks by project
  const projects = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!t.projectId) return;
      if (!map[t.projectId]) map[t.projectId] = { id: t.projectId, name: t.projectName || 'Unknown Project', clientName: t.clientName, count: 0 };
      map[t.projectId].count++;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const effectiveId = (selectedId && projects.some(p => p.id === selectedId)) ? selectedId : projects[0]?.id;

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q));
  }, [projects, search]);

  const selectedProject = projects.find(p => p.id === effectiveId);
  const projTasks = useMemo(() => tasks.filter(t => t.projectId === effectiveId), [tasks, effectiveId]);

  // Home tracks "adding to timesheet" state keyed by `${projId}-${taskId}`;
  // the board keys by task id, so remap for the selected project.
  const addingForProject = useMemo(() => {
    const m = {};
    projTasks.forEach(t => { if (addingKeys[`${effectiveId}-${t.id}`]) m[t.id] = true; });
    return m;
  }, [projTasks, addingKeys, effectiveId]);

  // Persist a status move with optimistic update + revert.
  const handleMove = (task, newStatus) => {
    const prevStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    fetch(`/api/v1/psa/tasks/${task.id}/status`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Update failed'); }
        const { task: updated } = await r.json();
        // Merge server timestamps (startedAt / completedAt) back in
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t));
        const label = COLS.find(c => c.key === statusToCol(newStatus))?.label;
        toast.success(`"${task.name}" moved to ${label || 'a new column'}`);
      })
      .catch(err => {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t));
        toast.error(err.message || 'Could not move task');
      });
  };

  if (projects.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <i className='bx bx-task' style={{ fontSize: '28px', display: 'block', marginBottom: '8px', opacity: 0.3 }} />
        No tasks assigned to you yet.
      </div>
    );
  }

  return (
    <div>
      {/* Project selector */}
      <div style={{ marginBottom: '14px' }}>
        {projects.length > 6 && (
          <div style={{ position: 'relative', marginBottom: '10px', maxWidth: '320px' }}>
            <i className='bx bx-search' style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '15px' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${projects.length} projects…`}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {filteredProjects.map(p => {
            const active = p.id === effectiveId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '7px 13px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.15))' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  transition: 'all 0.15s', whiteSpace: 'nowrap', maxWidth: '220px',
                }}
              >
                <i className='bx bx-folder' style={{ fontSize: '14px', color: active ? '#a78bfa' : 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, background: active ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)', color: active ? '#c4b5fd' : 'rgba(255,255,255,0.4)', borderRadius: '9px', padding: '1px 6px', flexShrink: 0 }}>{p.count}</span>
              </button>
            );
          })}
          {filteredProjects.length === 0 && (
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', padding: '7px 4px' }}>No projects match "{search}"</span>
          )}
        </div>
      </div>

      {/* Selected project board */}
      {selectedProject && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
          <div
            style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
            onClick={() => nav(`/my-projects?p=${selectedProject.id}`)}
          >
            <i className='bx bx-folder' style={{ color: '#60a5fa', fontSize: '16px', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{selectedProject.name}</span>
              {selectedProject.clientName && <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>{selectedProject.clientName}</span>}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className='bx bx-move' style={{ fontSize: '13px' }} /> drag to update
            </span>
            <i className='bx bx-right-arrow-alt' style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }} />
          </div>

          <ProjectTaskBoard
            tasks={projTasks}
            onMove={handleMove}
            addingKeys={addingForProject}
            onAddToTimesheet={(task) => onAddToTimesheet(selectedProject.id, task.id, task.name)}
          />
        </div>
      )}
    </div>
  );
}
