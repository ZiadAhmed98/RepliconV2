import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import { S }          from '../../components/settings/styles';

function Node({ node, depth=0 }) {
  const [open, setOpen] = useState(depth < 2);
  return (
    <div style={{ marginLeft: depth > 0 ? '20px' : 0, borderLeft: depth > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingLeft: depth > 0 ? '14px' : 0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'8px', transition:'background 0.1s' }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <button onClick={()=>setOpen(o=>!o)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)', cursor: node.children?.length ? 'pointer' : 'default', fontSize:'14px', padding:0, width:'16px', flexShrink:0 }}>
          {node.children?.length ? <i className={`bx ${open?'bx-chevron-down':'bx-chevron-right'}`} /> : null}
        </button>
        <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#818cf8', fontSize:'11px', fontWeight:700, flexShrink:0 }}>
          {(node.displayName||'?')[0].toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontSize:'13px', color:'#fff', fontWeight:500 }}>{node.displayName}</p>
          <p style={{ margin:0, fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>{node.jobTitle||node.role}</p>
        </div>
        {node.department && <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.05)', borderRadius:'5px', padding:'2px 8px' }}>{node.department}</span>}
      </div>
      {open && node.children?.map(c=><Node key={c.id} node={c} depth={depth+1} />)}
    </div>
  );
}

export default function TeamHierarchy() {
  const [hierarchy, setHierarchy] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    fetch('/api/v1/admin/team-hierarchy', { credentials:'include' })
      .then(r=>r.json()).then(d=>{ setHierarchy(d.hierarchy||[]); setLoading(false); })
      .catch(e=>{ setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <SettingsLayout title="Team Hierarchy" accent="#a78bfa"><p style={S.muted}>Loading…</p></SettingsLayout>;
  if (error)   return <SettingsLayout title="Team Hierarchy" accent="#a78bfa"><p style={{ color:'#f87171', fontSize:'13px' }}>{error}</p></SettingsLayout>;

  return (
    <SettingsLayout title="Team Hierarchy" subtitle="Visualize reporting structure across the organization" accent="#a78bfa">
      {hierarchy.length === 0 ? (
        <p style={{ ...S.muted, textAlign:'center', padding:'48px' }}>No employees found. Add employees to see the hierarchy.</p>
      ) : (
        <div style={S.card}>
          {hierarchy.map(node=><Node key={node.id} node={node} />)}
        </div>
      )}
    </SettingsLayout>
  );
}
