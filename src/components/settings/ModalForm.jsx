export default function ModalForm({ title, fields, values, onChange, onSubmit, onClose, submitting }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="px-6 py-4 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-slate-400 mb-1">{f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}</label>
              {f.type === 'select' ? (
                <select
                  value={values[f.key] ?? ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  required={f.required}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select…</option>
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={values[f.key] ?? ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  rows={4}
                  required={f.required}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              ) : f.type === 'color' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={values[f.key] ?? '#818cf8'}
                    onChange={e => onChange(f.key, e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={values[f.key] ?? '#818cf8'}
                    onChange={e => onChange(f.key, e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!values[f.key]}
                    onChange={e => onChange(f.key, e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-slate-300 text-sm">{f.checkLabel || 'Enabled'}</span>
                </label>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={values[f.key] ?? ''}
                  onChange={e => onChange(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
          ))}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors">
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
