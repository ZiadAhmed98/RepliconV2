import { useState } from 'react';

export default function CrudTable({ columns, items, onAdd, onEdit, onDelete, loading }) {
  const [confirm, setConfirm] = useState(null);

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-slate-500">
      <i className="bx bx-loader-alt bx-spin mr-2" /> Loading…
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
          <i className="bx bx-plus" /> Add New
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {columns.map(c => (
                <th key={c.key} className="text-left px-4 py-3 text-slate-400 font-medium">{c.label}</th>
              ))}
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-8 text-slate-500">No entries yet.</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-3 text-slate-300">
                    {c.render ? c.render(item[c.key], item) : (item[c.key] ?? '—')}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && (
                      <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors">
                        <i className="bx bx-edit-alt" />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirm(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80">
            <h3 className="text-white font-semibold mb-2">Delete entry?</h3>
            <p className="text-slate-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => { onDelete(confirm); setConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
