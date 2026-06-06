import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  { key:'all',           label:'All',               color:'#94a3b8' },
  { key:'azure',         label:'Azure',             color:'#60a5fa' },
  { key:'m365',          label:'M365',              color:'#818cf8' },
  { key:'maf_guide',     label:'MAF Guide',         color:'#34d399' },
  { key:'security',      label:'Security',          color:'#f87171' },
  { key:'networking',    label:'Networking',        color:'#fbbf24' },
  { key:'cloud',         label:'Cloud',             color:'#a78bfa' },
  { key:'general',       label:'General',           color:'#94a3b8' },
];

const STATUS_COLOR = { pending:'#fbbf24', approved:'#34d399', rejected:'#f87171' };

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

function catMeta(key) { return CATEGORIES.find(c => c.key === key) || CATEGORIES[0]; }

// ── Submit form ───────────────────────────────────────────────────────────────

function SubmitForm({ onSubmitted }) {
  const [form, setForm]       = useState({ title:'', description:'', category:'azure', documentUrl:'' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const save = async () => {
    if (!form.title.trim()) return setError('Title is required');
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/v1/templates', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, documentUrl: form.documentUrl || null }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Submit failed');
      setForm({ title:'', description:'', category:'azure', documentUrl:'' });
      onSubmitted();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const field = (label, key, el, extra = {}) => (
    <div style={{ marginBottom:'14px' }}>
      <label style={{ display:'block', fontSize:'0.76rem', fontWeight:600, color:'rgba(255,255,255,0.5)', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
      {el === 'textarea'
        ? <textarea value={form[key]} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} {...extra}
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'9px', color:'var(--text-main)', padding:'9px 12px', fontSize:'0.83rem', fontFamily:'inherit', resize:'vertical', ...extra.style }} />
        : el === 'select'
          ? <select value={form[key]} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} {...extra}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'9px', color:'var(--text-main)', padding:'9px 12px', fontSize:'0.83rem', fontFamily:'inherit', ...extra.style }}>
              {CATEGORIES.filter(c=>c.key!=='all').map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          : <input value={form[key]} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} {...extra}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'9px', color:'var(--text-main)', padding:'9px 12px', fontSize:'0.83rem', fontFamily:'inherit', boxSizing:'border-box', ...extra.style }} />
      }
    </div>
  );

  return (
    <div style={{ background:'rgba(52,211,153,0.04)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:'14px', padding:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
        <i className='bx bx-upload' style={{ color:'#34d399', fontSize:'17px' }} />
        <span style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text-main)' }}>Submit Template</span>
      </div>
      {error && <div style={{ marginBottom:'12px', padding:'8px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', color:'#f87171', fontSize:'0.78rem' }}>{error}</div>}
      {field('Title *','title','input',{ placeholder:'e.g. Azure DevOps Onboarding SOP' })}
      {field('Category','category','select')}
      {field('Document URL','documentUrl','input',{ placeholder:'https://sharepoint.com/... or Google Drive link', type:'url' })}
      {field('Description','description','textarea',{ placeholder:'Brief description of this template and when to use it…', rows:3 })}
      <button onClick={save} disabled={saving}
        style={{ width:'100%', background:'#34d399', color:'#0f172a', border:'none', borderRadius:'9px', padding:'10px', fontWeight:700, fontSize:'0.84rem', cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
        {saving ? 'Submitting…' : 'Submit for Approval'}
      </button>
    </div>
  );
}

// ── Review modal (admin) ──────────────────────────────────────────────────────

function ReviewModal({ template, onClose, onDone }) {
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);

  const act = async (action) => {
    setSaving(true);
    await fetch(`/api/v1/templates/${template.id}`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, rejectionNote: note || null }),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#0f172a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'24px', width:'460px', maxWidth:'90vw' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <span style={{ fontSize:'0.95rem', fontWeight:700, color:'var(--text-main)' }}>Review Template</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}>&times;</button>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px' }}>
          <div style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text-main)', marginBottom:'4px' }}>{template.title}</div>
          <div style={{ fontSize:'0.76rem', color:'rgba(255,255,255,0.4)', marginBottom:'4px' }}>By {template.submitterName} · {fmt(template.createdAt)}</div>
          {template.description && <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', marginTop:'6px' }}>{template.description}</div>}
          {template.documentUrl && (
            <a href={template.documentUrl} target="_blank" rel="noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:'5px', marginTop:'8px', color:'#60a5fa', fontSize:'0.75rem', textDecoration:'none' }}>
              <i className='bx bx-link-external' style={{ fontSize:'13px' }} /> Open Document
            </a>
          )}
        </div>
        <div style={{ marginBottom:'14px' }}>
          <label style={{ display:'block', fontSize:'0.73rem', fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Note (optional, shown on rejection)
          </label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Reason for rejection or feedback…"
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'9px', color:'var(--text-main)', padding:'9px 12px', fontSize:'0.8rem', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={() => act('approve')} disabled={saving}
            style={{ flex:1, background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:'9px', color:'#34d399', padding:'10px', fontWeight:700, fontSize:'0.84rem', cursor:'pointer' }}>
            Approve
          </button>
          <button onClick={() => act('reject')} disabled={saving}
            style={{ flex:1, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'9px', color:'#f87171', padding:'10px', fontWeight:700, fontSize:'0.84rem', cursor:'pointer' }}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Templates({ sessionUser }) {
  const isAdmin = sessionUser?.isAdmin;
  const [tab, setTab]           = useState('browse');   // browse | mine | pending
  const [catFilter, setCatFilter]= useState('all');
  const [templates, setTemplates] = useState([]);
  const [mine, setMine]           = useState([]);
  const [pending, setPending]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [reviewing, setReviewing] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    const [pub, my, pend] = await Promise.all([
      fetch('/api/v1/templates', { credentials:'include' }).then(r=>r.json()).catch(()=>({templates:[]})),
      fetch('/api/v1/templates/mine', { credentials:'include' }).then(r=>r.json()).catch(()=>({templates:[]})),
      isAdmin ? fetch('/api/v1/templates?status=pending', { credentials:'include' }).then(r=>r.json()).catch(()=>({templates:[]})) : Promise.resolve({templates:[]}),
    ]);
    setTemplates(pub.templates || []);
    setMine(my.templates || []);
    setPending(pend.templates?.filter(t => t.status === 'pending') || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = tab === 'browse'
    ? templates.filter(t => t.status === 'approved' && (catFilter === 'all' || t.category === catFilter))
    : tab === 'mine' ? mine
    : pending;

  return (
    <div style={{ padding:'28px 36px', maxWidth:'1200px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'28px' }}>
        <div style={{ width:'42px', height:'42px', borderRadius:'12px', background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className='bx bx-file-blank' style={{ fontSize:'22px', color:'#34d399' }} />
        </div>
        <div>
          <h1 style={{ margin:0, fontSize:'1.55rem', fontWeight:800, color:'var(--text-main)', letterSpacing:'-0.02em' }}>Templates</h1>
          <p style={{ margin:0, fontSize:'0.84rem', color:'var(--text-muted)' }}>SOPs and reference documents for the team</p>
        </div>
      </div>

      {/* Layout: main left + submit right */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'20px', alignItems:'start' }}>

        {/* Left: tabs + list */}
        <div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'18px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'4px', border:'1px solid rgba(255,255,255,0.06)' }}>
            {[
              { key:'browse',  label:`Browse (${templates.filter(t=>t.status==='approved').length})` },
              { key:'mine',    label:`My Submissions (${mine.length})` },
              ...(isAdmin ? [{ key:'pending', label:`Pending Review (${pending.length})`, alert: pending.length > 0 }] : []),
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex:1, padding:'7px 12px', borderRadius:'7px', border:'none', fontFamily:'inherit', fontSize:'0.79rem', fontWeight: tab===t.key ? 700 : 500, cursor:'pointer', transition:'all 0.14s',
                  background: tab===t.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: tab===t.key ? 'var(--text-main)' : 'rgba(255,255,255,0.4)',
                  position:'relative',
                }}>
                {t.label}
                {t.alert && <span style={{ position:'absolute', top:'3px', right:'6px', width:'7px', height:'7px', borderRadius:'50%', background:'#ef4444' }} />}
              </button>
            ))}
          </div>

          {/* Category filter (browse only) */}
          {tab === 'browse' && (
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setCatFilter(c.key)}
                  style={{ padding:'4px 12px', borderRadius:'20px', border:`1px solid ${catFilter===c.key ? c.color+'60' : 'rgba(255,255,255,0.08)'}`, background: catFilter===c.key ? `${c.color}18` : 'transparent', color: catFilter===c.key ? c.color : 'rgba(255,255,255,0.4)', fontSize:'0.74rem', fontWeight: catFilter===c.key ? 700 : 500, cursor:'pointer', fontFamily:'inherit' }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px', color:'rgba(255,255,255,0.3)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'rgba(255,255,255,0.2)', fontSize:'0.84rem' }}>
              {tab==='browse' ? 'No approved templates in this category' : tab==='mine' ? "You haven't submitted any templates yet" : "No templates pending review"}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {filtered.map(t => {
                const cat = catMeta(t.category);
                return (
                  <div key={t.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:'14px' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'9px', background:`${cat.color}18`, border:`1px solid ${cat.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className='bx bx-file-blank' style={{ color:cat.color, fontSize:'17px' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text-main)' }}>{t.title}</span>
                        <span style={{ fontSize:'0.62rem', padding:'2px 7px', borderRadius:'5px', background:`${cat.color}18`, color:cat.color, border:`1px solid ${cat.color}30`, fontWeight:700 }}>{cat.label}</span>
                        {tab !== 'browse' && (
                          <span style={{ fontSize:'0.62rem', padding:'2px 7px', borderRadius:'5px', background:`${STATUS_COLOR[t.status]||'#94a3b8'}12`, color:STATUS_COLOR[t.status]||'#94a3b8', fontWeight:700 }}>
                            {t.status}
                          </span>
                        )}
                      </div>
                      {t.description && <div style={{ fontSize:'0.76rem', color:'rgba(255,255,255,0.45)', marginBottom:'4px', lineHeight:1.5 }}>{t.description}</div>}
                      <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.28)' }}>
                        By {t.submitterName} · {fmt(t.updatedAt || t.createdAt)}
                        {t.rejectionNote && <span style={{ color:'#f87171', marginLeft:'8px' }}>· {t.rejectionNote}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                      {t.documentUrl && (
                        <a href={t.documentUrl} target="_blank" rel="noreferrer"
                          style={{ padding:'6px 12px', borderRadius:'7px', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', color:'#60a5fa', fontSize:'0.72rem', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}>
                          <i className='bx bx-link-external' style={{ fontSize:'12px' }} /> Open
                        </a>
                      )}
                      {isAdmin && tab === 'pending' && (
                        <button onClick={() => setReviewing(t)}
                          style={{ padding:'6px 12px', borderRadius:'7px', background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.25)', color:'#818cf8', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: submit form */}
        <div>
          <SubmitForm onSubmitted={loadAll} />
        </div>
      </div>

      {reviewing && (
        <ReviewModal template={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); loadAll(); }} />
      )}
    </div>
  );
}
