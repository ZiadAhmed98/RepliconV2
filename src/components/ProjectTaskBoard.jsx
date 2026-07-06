import React, { useState, useMemo } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
} from '@dnd-kit/core';

// ── Shared 3-column drag-and-drop task board for a single project ──────────────
// Used by both the home "My Work" section and the read-only-turned-interactive
// My Projects page. The parent owns the task array + persistence; this board
// only reports moves via onMove(task, newStatus).

export const COLS = [
  { key: 'open',        label: 'To Do',       color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)' },
  { key: 'in_progress', label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' },
  { key: 'done',        label: 'Done',        color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.22)' },
];
export const COL_TO_STATUS = { open: 'open', in_progress: 'in_progress', done: 'completed' };
export const statusToCol   = (s) => (s === 'completed' || s === 'closed') ? 'done' : (s === 'in_progress' ? 'in_progress' : 'open');

function fmtStamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Stamps({ task, colKey }) {
  const started   = fmtStamp(task.startedAt);
  const completed = fmtStamp(task.completedAt);
  const items = [];
  if (colKey === 'in_progress' && started)  items.push({ icon: 'bx-play-circle',  color: '#a78bfa', text: `Started ${started}` });
  if (colKey === 'done') {
    if (started)   items.push({ icon: 'bx-play-circle',  color: '#a78bfa', text: `Started ${started}` });
    if (completed) items.push({ icon: 'bx-check-circle', color: '#34d399', text: `Done ${completed}` });
  }
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
      {items.map((it, i) => (
        <span key={i} style={{ fontSize: '0.62rem', color: it.color, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <i className={`bx ${it.icon}`} style={{ fontSize: '11px' }} /> {it.text}
        </span>
      ))}
    </div>
  );
}

function TaskCard({ task, col, onAdd, adding, dragging }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  const style = {
    background: col.bg,
    border: `1px solid ${col.border}`,
    borderRadius: '9px',
    padding: '8px 10px',
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    cursor: 'grab',
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
    boxShadow: isDragging ? '0 12px 30px rgba(0,0,0,0.5)' : 'none',
    transition: dragging ? 'none' : 'box-shadow 0.15s, transform 0.18s cubic-bezier(0.2,0.8,0.2,1)',
    touchAction: 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <i className='bx bx-grid-vertical' style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px', flexShrink: 0, marginLeft: '-2px', marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.name}
        </div>
        {task.estimatedHours > 0 && (
          <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{task.estimatedHours}h est.</div>
        )}
        <Stamps task={task} colKey={col.key} />
      </div>
      {onAdd && (
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
      )}
    </div>
  );
}

function Column({ col, tasks, onAdd, addingKeys, dragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div style={{ padding: '12px', borderRight: col.key !== 'done' ? '1px solid rgba(255,255,255,0.04)' : 'none', minWidth: 0 }}>
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
          background: isOver ? col.bg : 'transparent',
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
              adding={!!addingKeys[task.id]}
              onAdd={onAdd}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ProjectTaskBoard({ tasks, onMove, onAddToTimesheet, addingKeys = {} }) {
  const [activeTask, setActiveTask] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byCol = useMemo(() => ({
    open:        tasks.filter(t => statusToCol(t.status) === 'open'),
    in_progress: tasks.filter(t => statusToCol(t.status) === 'in_progress'),
    done:        tasks.filter(t => statusToCol(t.status) === 'done'),
  }), [tasks]);

  const handleDragEnd = (e) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    if (!task) return;
    const destCol = over.id;
    if (!COL_TO_STATUS[destCol]) return;
    if (statusToCol(task.status) === destCol) return;
    onMove(task, COL_TO_STATUS[destCol]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveTask(tasks.find(t => t.id === e.active.id) || null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' }}>
        {COLS.map(col => (
          <Column
            key={col.key}
            col={col}
            tasks={byCol[col.key]}
            addingKeys={addingKeys}
            dragging={!!activeTask}
            onAdd={onAddToTimesheet ? (task) => onAddToTimesheet(task) : null}
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
  );
}
