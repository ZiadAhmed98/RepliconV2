import { useState } from 'react';

const S = {
  addBtn:    { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#6366f1', border: 'none', borderRadius: '8px', padding: '8px 18px', color: '#fff', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 },
  tableWrap: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:        { fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' },
  td:        { padding: '13px 16px', color: 'rgba(255,255,255,0.82)', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' },
  iconBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '16px', padding: '4px 6px', lineHeight: 1, borderRadius: '6px' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:     { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', width: '340px' },
  cancelBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 18px', color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 18px', color: '#f87171', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
};

export default function CrudTable({ columns, items, onAdd, onEdit, onDelete, loading }) {
  const [confirm, setConfirm] = useState(null);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'rgba(255,255,255,0.3)', fontSize: '13px', gap: '8px' }}>
      <i className="bx bx-loader-alt bx-spin" /> Loading…
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button onClick={onAdd} style={S.addBtn}>
          <i className="bx bx-plus" style={{ fontSize: '14px' }} /> Add New
        </button>
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {columns.map(c => <th key={c.key} style={S.th}>{c.label}</th>)}
              <th style={{ ...S.th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ ...S.td, textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '32px' }}>
                  No entries yet.
                </td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id} style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {columns.map(c => (
                  <td key={c.key} style={S.td}>
                    {c.render ? c.render(item[c.key], item) : (item[c.key] ?? '—')}
                  </td>
                ))}
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    {onEdit && (
                      <button onClick={() => onEdit(item)} style={S.iconBtn}
                        onMouseEnter={e => { e.currentTarget.style.color = '#818cf8'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                        title="Edit"
                      >
                        <i className="bx bx-edit-alt" />
                      </button>
                    )}
                    <button onClick={() => setConfirm(item.id)} style={S.iconBtn}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                      title="Delete"
                    >
                      <i className="bx bx-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#fff' }}>Delete entry?</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={S.cancelBtn}>Cancel</button>
              <button onClick={() => { onDelete(confirm); setConfirm(null); }} style={S.deleteBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
