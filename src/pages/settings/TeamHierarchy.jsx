import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';

function HierarchyNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  return (
    <div className={`${depth > 0 ? 'ml-6 border-l border-slate-700 pl-4' : ''} mt-2`}>
      <div className="flex items-center gap-3 py-2 hover:bg-slate-700/30 px-2 rounded-lg transition-colors">
        {node.children?.length > 0 ? (
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-white">
            <i className={`bx ${open ? 'bx-chevron-down' : 'bx-chevron-right'}`} />
          </button>
        ) : <span className="w-4" />}
        <div className="w-7 h-7 rounded-full bg-indigo-600/50 flex items-center justify-center text-white text-xs font-bold">
          {(node.displayName || '?')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{node.displayName}</p>
          <p className="text-slate-500 text-xs">{node.jobTitle || node.role}</p>
        </div>
        {node.department && <span className="ml-auto text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{node.department}</span>}
      </div>
      {open && node.children?.map(child => <HierarchyNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  );
}

export default function TeamHierarchy() {
  const [hierarchy, setHierarchy] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    fetch('/api/v1/admin/team-hierarchy', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setHierarchy(d.hierarchy || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <SettingsLayout title="Team Hierarchy" subtitle="Visualize reporting structure across the organization" accent="#a78bfa">
      {loading ? <div className="text-slate-500 text-sm">Loading…</div> : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : hierarchy.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-12">No employees found. Add employees to see the hierarchy.</div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          {hierarchy.map(node => <HierarchyNode key={node.id} node={node} />)}
        </div>
      )}
    </SettingsLayout>
  );
}
