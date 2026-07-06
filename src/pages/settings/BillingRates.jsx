import { useState, useEffect } from 'react';
import SettingsLayout from '../../components/settings/SettingsLayout';
import CrudTable      from '../../components/settings/CrudTable';
import ModalForm      from '../../components/settings/ModalForm';
import { useCrud }    from '../../hooks/useSettings';
import { S }          from '../../components/settings/styles';

const CURRENCIES = ['USD','EUR','GBP','AED','SAR','EGP'].map(c => ({ value:c, label:c }));

export default function BillingRates() {
  const { items, loading, create, update, remove } = useCrud('billing-rates');
  const [roles, setRoles] = useState([]);
  const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [busy,setBusy]=useState(false);

  useEffect(() => {
    fetch('/api/v1/roles', { credentials: 'include' }).then(r => r.json())
      .then(d => setRoles(d.roles || [])).catch(() => {});
  }, []);

  const roleName = (id) => roles.find(r => r.id === id)?.name || id;
  const roleOptions = roles.map(r => ({ value: r.id, label: r.name }));

  const FIELDS = [
    { key:'role',          label:'Role / Resource Type',  type:'select', options:roleOptions, required:true },
    { key:'rate',          label:'Hourly Rate',            type:'number', min:0, step:0.01, required:true },
    { key:'currency',      label:'Currency',               type:'select', options:CURRENCIES },
    { key:'effectiveDate', label:'Effective From',         type:'date' },
  ];
  const COLUMNS = [
    { key:'role',  label:'Role', render:(v) => roleName(v) },
    { key:'rate',  label:'Rate', render:(v,row) => `${row.currency||'USD'} ${Number(v).toFixed(2)}/hr` },
    { key:'effectiveDate', label:'Effective From', render: v => v||'—' },
  ];

  function openAdd()   { setForm({currency:'USD',rate:0}); setModal('add'); }
  function openEdit(i) { setForm({...i}); setModal(i.id); }
  async function submit() { setBusy(true); try { if(modal==='add') await create(form); else await update(modal,form); setModal(null); } finally { setBusy(false); } }

  // Newest effective rate per role — the one used for costing.
  const current = {};
  [...items].sort((a,b)=>String(a.effectiveDate||'').localeCompare(String(b.effectiveDate||''))).forEach(r=>{ current[r.role]=r; });

  return (
    <SettingsLayout title="Billing Rates" subtitle="Hourly rates by role, with effective dates — used to value logged time on projects" accent="#f472b6">
      {/* Current rate cards */}
      {Object.keys(current).length > 0 && (
        <div style={{ ...S.card }}>
          <p style={S.cardTitle}>Current Rate Card · applied to project billable value</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
            {Object.values(current).map(r => (
              <div key={r.role} style={{ background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.2)', borderRadius:'10px', padding:'10px 14px', minWidth:'150px' }}>
                <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{roleName(r.role)}</div>
                <div style={{ fontSize:'16px', fontWeight:700, color:'#f9a8d4' }}>{r.currency||'USD'} {Number(r.rate).toFixed(2)}<span style={{ fontSize:'11px', fontWeight:400, color:'rgba(255,255,255,0.4)' }}>/hr</span></div>
                {r.effectiveDate && <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>since {r.effectiveDate}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ ...S.cardTitle, marginTop:'8px' }}>All Rates &amp; History</p>
      <CrudTable columns={COLUMNS} items={items} loading={loading} onAdd={openAdd} onEdit={openEdit} onDelete={remove} />
      {modal && <ModalForm title={modal==='add'?'Add Rate':'Edit Rate'} fields={FIELDS} values={form}
        onChange={(k,v)=>setForm(p=>({...p,[k]:v}))} onSubmit={submit} onClose={()=>setModal(null)} submitting={busy} />}
    </SettingsLayout>
  );
}
