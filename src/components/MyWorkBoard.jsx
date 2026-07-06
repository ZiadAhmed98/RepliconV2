import React, { useState, useMemo, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
} from '@dnd-kit/core';
import { useToast } from '../context/ToastContext';

// ── Column model ──────────────────────────────────────────────────────────────
const COLS = [
  { key: 'open',        label: 'To Do',       color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)' },
  { key: 'in_progress', label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' },
  { key: 'done',        label: 'Done',        color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.22)' },
];
// Column → persisted DB status, and DB status → column bucket.
const COL_TO_STATUS = { open: 'open', in_progress: 'in_progress', done: 'completed' };
const statusToCol   = (s) => (s === 'completed' || s === 'closed') ? 'done' : (s === 'in_progress' ? 'in_progress' : 'open');

// ── One draggable task card ─────────────────────────────────────────────────────
function TaskCard({ task, col, onAdd, adding, dragging }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id, data: { task },
  });
  const style = {
    background: col.bg,
    border: `1px solid ${col.border}`,
    borderRadius: '9px',
    padding: '8px 10px',
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: 'grab',
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
    boxShadow: isDragging ? '0 12px 30px rgba(0,0,0,0.5)' : 'none',
    transition: dragging ? 'none' : 'box-shadow 0.15s, transform 0.18s cubic-bezier(0.2,0.8,0.2,1)',
    touchAction: 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <i className='bx bx-grid-vertical' style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px', flexShrink: 0, marginLeft: '-2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.name}
        </div>
        {task.estimatedHours > 0 && (
          <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{task.estimatedHours}h est.</div>
        )}
      </div>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onAdd(task)}
        disabled={adding}
        title="Add to this week's timesheet"
        style={{
          flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px',
          background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
          color: '#a78bfa', cursor: adding ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          transition: 'all 0.15s', opacity: adding ? 0.5 : 1,
        }}
        onMouseEnter={e => { if (!adding) { e.currentTarget.style.background = 'rgba(167,139,250,0.3)'; e.currentTarget.style.transform = 'scale(1.1)'; } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.15)'; e.currentTarget.style.transform = 'none'; }}
      >
        <i className={`bx ${adding ? 'bx-loader-alt bx-spin' : 'bx-plus'}`} style={{ fontSize: '12px' }} />
      </button>
    </div>
  );
}

// ── One droppable column ────────────────────────────────────────────────────────
function Column({ col, tasks, onAdd, addingKeys, projId, dragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div style={{ padding: '12px 12px', borderRight: col.key !== 'done' ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.color, boxShadow: `0 0 8px ${col.color}` }} />
        <span style={{ fontSize: '0.67rem', fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
        {tasks.length > 0 && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: '10px', padding: '0 6px', lineHeight: '16px' }}>
            {tasks.length}
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          minHeight: '60px', borderRadius: '10px', padding: '4px',
          background: isOver ? `${col.bg}` : 'transparent',
          outline: isOver ? `1px dashed ${col.border}` : '1px dashed transparent',
          transition: 'background 0.15s, outline 0.15s',
        }}
      >
        {tasks.length === 0 ? (
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.15)', fontStyle: 'italic', padding: '8px 4px', textAlign: 'center' }}>
            {isOver ? 'Drop here' : '—'}
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              col={col}
              dragging={dragging}
              adding={!!addingKeys[`${projId}-${task.id}`]}
              onAdd={onAdd}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main board ──────────────────────────────────────────────────────────────────
export default function MyWorkBoard({ tasks, setTasks, onAddToTimesheet, addingKeys, nav }) {
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState(null);
  const [search, setSearch]         = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const revertRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  // Keep a valid selection
  const effectiveId = (selectedId && projects.some(p => p.id === selectedId)) ? selectedId : projects[0]?.id;

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q));
  }, [projects, search]);

  const selectedProject = projects.find(p => p.id === effectiveId);
  const projTasks = useMemo(() => tasks.filter(t => t.projectId === effectiveId), [tasks, effectiveId]);
  const byCol = useMemo(() => ({
    open:        projTasks.filter(t => statusToCol(t.status) === 'open'),
    in_progress: projTasks.filter(t => statusToCol(t.status) === 'in_progress'),
    done:        projTasks.filter(t => statusToCol(t.status) === 'done'),
  }), [projTasks]);

  const handleDragStart = (e) => {
    const t = tasks.find(x => x.id === e.active.id);
    setActiveTask(t || null);
  };

  const handleDragEnd = (e) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    if (!task) return;
    const destCol = over.id;                       // droppable id === column key
    if (!COL_TO_STATUS[destCol]) return;
    if (statusToCol(task.status) === destCol) return;   // no-op within same column

    const newStatus = COL_TO_STATUS[destCol];
    const prevStatus = task.status;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    fetch(`/api/v1/psa/tasks/${task.id}/status`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Update failed'); }
        const label = COLS.find(c => c.key === destCol)?.label;
        toast.success(`"${task.name}" moved to ${label}`);
      })
      .catch(err => {
        // Revert on failure
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
      {/* Project selector — pills (+ search when many) kill the infinite scroll */}
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
                color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit',
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

      {/* Selected project's board */}
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {COLS.map(col => (
                <Column
                  key={col.key}
                  col={col}
                  tasks={byCol[col.key]}
                  projId={selectedProject.id}
                  addingKeys={addingKeys}
                  dragging={!!activeTask}
                  onAdd={(task) => onAddToTimesheet(selectedProject.id, task.id, task.name)}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2,0.8,0.2,1)' }}>
              {activeTask ? (
                <div style={{
                  background: 'rgba(20,20,28,0.98)', border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: '9px', padding: '8px 10px', minWidth: '160px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 20px rgba(139,92,246,0.25)',
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'grabbing',
                }}>
                  <i className='bx bx-grid-vertical' style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{activeTask.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}
