import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { S }          from '../../components/settings/styles';

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4'];
function getColor(name) {
  let h = 0; for (let c of (name||'')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Node({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const color = getColor(node.displayName);
  const hasKids = node.children?.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? '24px' : 0 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: hasKids ? 'pointer' : 'default', transition: 'background 0.1s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        onClick={() => hasKids && setOpen(o => !o)}
      >
        {/* Expand toggle */}
        <div style={{ width: '18px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasKids && (
            <i className={`bx ${open ? 'bx-chevron-down' : 'bx-chevron-right'}`}
               style={{ color: 'rgba(255,255,255,0.35)', fontSize: '16px' }} />
          )}
        </div>

        {/* Avatar */}
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: color + '25', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
          {(node.displayName || '?')[0].toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.displayName}</p>
          {(node.jobTitle || node.role) && (
            <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>{node.jobTitle || node.role}</p>
          )}
        </div>

        {/* Department tag */}
        {node.department && (
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', padding: '2px 8px', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{node.department}</span>
        )}

        {/* Reports badge */}
        {hasKids && (
          <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.15)', borderRadius: '5px', padding: '2px 7px', color: '#818cf8', flexShrink: 0 }}>{node.children.length}</span>
        )}
      </div>

      {/* Children with connecting line */}
      {open && hasKids && (
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', marginLeft: '19px', paddingLeft: '4px' }}>
          {node.children.map(c => <Node key={c.id} node={c} depth={depth + 1} />)}
        </div>
      )}
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

  if (loading) return (
    <SettingsLayout title="Team Hierarchy" accent="#a78bfa">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '40px 0' }}>
        <i className="bx bx-loader-alt bx-spin" /> Loading hierarchy…
      </div>
    </SettingsLayout>
  );

  if (error) return (
    <SettingsLayout title="Team Hierarchy" accent="#a78bfa">
      <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#f87171', fontSize: '13px' }}>
        Error: {error}
      </div>
    </SettingsLayout>
  );

  return (
    <SettingsLayout title="Team Hierarchy" subtitle="Visualize reporting structure across the organization" accent="#a78bfa">
      {hierarchy.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
          No employees found. Add employees to see the hierarchy.
        </div>
      ) : (
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 8px' }}>
          {hierarchy.map(node => <Node key={node.id} node={node} />)}
        </div>
      )}
    </SettingsLayout>
  );
}
