import React, { useState, useMemo } from 'react';
import Chart from 'react-apexcharts';
import * as XLSX from 'xlsx';
import styles from './TimesheetOps.module.css';
import EmptyState from '../components/EmptyState';
import { useToast } from '../context/ToastContext';
import { baseChartOptions, fmtInt } from '../utils/chartTheme';
import { CHART_COLORS } from '../constants/index.js';

export default function TimesheetOps({ dataMatrix, syncMatrixData }) {
  const { toast } = useToast();
  const [activeTab,       setActiveTab]       = useState('pending');
  const [selectedPeriod,  setSelectedPeriod]  = useState('ALL');
  const [selectedEmp,     setSelectedEmp]     = useState('ALL');
  const [selectedURIs,    setSelectedURIs]    = useState(new Set());
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [modalDetails,    setModalDetails]    = useState(null);

  const namesMatch = (a, b) => (a||'').trim().toLowerCase() === (b||'').trim().toLowerCase();

  const getLastSunday = () => {
    const d=new Date(), day=d.getDay(), diff=day===0?7:day;
    d.setDate(d.getDate()-diff); d.setHours(23,59,59,999);
    return d.getTime();
  };

  const dropdowns = useMemo(() => {
    if (!dataMatrix) return { periods:[], engineers:[] };
    const { timesheets=[], roster=[] } = dataMatrix;
    const lastSunday = getLastSunday();
    const periods = [...new Set(timesheets.map(t=>t.period).filter(Boolean))].filter(p => {
      if (!p?.includes('-')) return false;
      return new Date(p.split('-')[0].trim()).getTime() <= lastSunday;
    }).sort((a,b)=>new Date(b.split('-')[0].trim())-new Date(a.split('-')[0].trim()));
    const engineers = roster.filter(e=>e.status==='Enabled').sort((a,b)=>a.name.localeCompare(b.name));
    return { periods, engineers };
  }, [dataMatrix]);

  // Approval funnel data
  const funnelData = useMemo(() => {
    if (!dataMatrix) return [];
    const { timesheets=[], roster=[], drafts=[] } = dataMatrix;
    const activeNames = roster.filter(r=>r.status==='Enabled').map(r=>r.name.trim().toLowerCase());
    const total    = roster.filter(r=>r.status==='Enabled').length;
    const submitted= [...new Set(timesheets.filter(t=>activeNames.includes((t.user||'').trim().toLowerCase())).map(t=>t.user))].length;
    const pending  = [...new Set(timesheets.filter(t=>activeNames.includes((t.user||'').trim().toLowerCase())&&(t.status||'').toLowerCase().includes('waiting')).map(t=>t.user))].length;
    const approved = [...new Set(timesheets.filter(t=>activeNames.includes((t.user||'').trim().toLowerCase())&&(t.status||'').toLowerCase().includes('approved')).map(t=>t.user))].length;
    return [
      { x:'Active Engineers', y:total },
      { x:'Submitted',        y:submitted },
      { x:'Pending Approval', y:pending },
      { x:'Approved',         y:approved },
    ];
  }, [dataMatrix]);

  const tableData = useMemo(() => {
    if (!dataMatrix) return [];
    const { drafts=[], timesheets=[], tsDetails=[], roster=[], factTable=[], dimensionTable={} } = dataMatrix;
    const lastSunday  = getLastSunday();
    const activeNames = roster.filter(r=>r.status==='Enabled').map(r=>r.name.trim().toLowerCase());
    let display = [];

    if (activeTab === 'drafts') {
      const grouped = {};
      drafts.forEach(d => {
        const u=(d.user||'').trim();
        if (!activeNames.includes(u.toLowerCase())) return;
        if (selectedEmp !== 'ALL' && !namesMatch(d.user, selectedEmp)) return;
        if (d.date > lastSunday) return;
        const key = `draft_${u}_${d.date}`;
        if (!grouped[key]) grouped[key] = { id:key, user:d.user, periodStr:new Date(d.date).toLocaleDateString(), hours:0, proj:'N/A (Draft)', uri:'draft', entries:[], ts:d.date, isDraft:true };
        grouped[key].hours += d.act;
        grouped[key].entries.push({ dateStr:new Date(d.date).toLocaleDateString(), client:'-', project:'Unsubmitted Draft', task:'-', comments:'Draft mode hours', hours:d.act });
      });
      display = Object.values(grouped);
    } else {
      timesheets.filter(t => {
        const u=(t.user||'').trim();
        if (!activeNames.includes(u.toLowerCase())) return false;
        const s=(t.status||'').toLowerCase();
        if (activeTab==='pending'     && !s.includes('waiting'))       return false;
        if (activeTab==='approved'    && !s.includes('approved'))      return false;
        if (activeTab==='notsubmitted'&&!s.includes('not submitted')&&!s.includes('never')) return false;
        return true;
      }).forEach(t => {
        if (selectedEmp !== 'ALL' && !namesMatch(t.user, selectedEmp)) return;
        if (selectedPeriod !== 'ALL' && t.period !== selectedPeriod) return;
        let sTs=0, eTs=Infinity;
        if (t.period?.includes('-')) {
          const [p1,p2]=t.period.split('-');
          const d1=new Date(p1.trim()), d2=new Date(p2.trim());
          if (!isNaN(d1)) sTs=d1.setHours(0,0,0,0);
          if (!isNaN(d2)) eTs=d2.setHours(23,59,59,999);
        }
        if (sTs > lastSunday) return;
        let entries = tsDetails.filter(d=>namesMatch(d.user,t.user)&&d.period===t.period);
        if (!entries.length) {
          entries = factTable.filter(f=>namesMatch(f.user,t.user)&&f.date>=sTs&&f.date<=eTs).map(f=>({
            dateStr:f.dateStr||new Date(f.date).toLocaleDateString(), client:f.client||'-', project:f.project, task:f.program||'General Task', comments:'Logged via Data Cube', hours:f.act,
          }));
        }
        const projMap={};
        entries.forEach(e=>{projMap[e.project]=(projMap[e.project]||0)+e.hours;});
        const primaryProj = Object.keys(projMap).sort((a,b)=>projMap[b]-projMap[a])[0]||'Standard Entry';
        display.push({
          id:`${t.uri}_${sTs}`, user:t.user, ts:sTs, periodStr:t.period, hours:t.hours, proj:primaryProj, uri:t.uri, isDraft:false,
          entries:entries.map(e=>({...e, client:dimensionTable[e.project]?.client||e.client||'-'})),
        });
      });
    }
    return display.sort((a,b)=>b.ts-a.ts);
  }, [dataMatrix, activeTab, selectedPeriod, selectedEmp]);

  const handleTabChange = (tab) => { setActiveTab(tab); setSelectedURIs(new Set()); };

  const handleBulkAction = async (action) => {
    if (selectedURIs.size === 0) return toast.warning('Select at least one timesheet.');
    const uris = Array.from(selectedURIs);
    setIsProcessing(true);
    try {
      const res = await fetch('/api/v1/timesheets/action', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,uris}),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        setSelectedURIs(new Set());
        syncMatrixData?.(true);
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch { toast.error('Network error communicating with the backend.'); }
    finally { setIsProcessing(false); }
  };

  // Excel export
  const handleExcelExport = () => {
    if (tableData.length === 0) { toast.warning('No data to export.'); return; }
    const rows = tableData.map(r => ({ Engineer:r.user, Period:r.periodStr, 'Total Hours':r.hours, Status:activeTab, 'Primary Project':r.proj }));
    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheets');
    XLSX.writeFile(wb, `Timesheets_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel file downloaded');
  };

  const badgeClass = { pending:'bgPending', approved:'bgApproved', drafts:'bgDraft', notsubmitted:'bgNotSubmitted' };
  const badgeText  = { pending:'Pending Approval', approved:'Approved', drafts:'Unsubmitted Draft', notsubmitted:'Not Submitted' };

  return (
    <div>
      <div className={styles.headerArea}>
        <div className={styles.titleArea}>
          <h2>Timesheet Operations</h2>
          <p>Review, audit, and approve historical hour logs.</p>
        </div>
        <button onClick={handleExcelExport} style={{display:'flex',alignItems:'center',gap:'8px',background:'rgba(48,209,88,0.1)',border:'1px solid rgba(48,209,88,0.25)',borderRadius:'10px',padding:'9px 18px',color:'#30d158',cursor:'pointer',fontFamily:'inherit',fontWeight:600,fontSize:'0.85rem',transition:'all 0.2s'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(48,209,88,0.18)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(48,209,88,0.1)'}>
          <i className='bx bx-spreadsheet' /> Export Excel
        </button>
      </div>

      {/* Approval Funnel Chart */}
      <div className="chart-card" style={{marginBottom:'20px'}}>
        <h4 style={{marginBottom:'16px'}}><i className='bx bx-filter' style={{color:'var(--accent-blue)'}} /> Approval Pipeline Funnel</h4>
        <Chart type="bar" width="100%" height={120}
          series={[{name:'Count',data:funnelData.map(d=>d.y)}]}
          options={baseChartOptions({
            chart:{id:'funnelChart',background:'transparent',toolbar:{show:false},sparkline:{enabled:false}},
            colors:['#32ade6','#a855f7','#ffd60a','#30d158'],
            plotOptions:{bar:{horizontal:true,borderRadius:6,distributed:true,barHeight:'65%'}},
            dataLabels:{enabled:true,textAnchor:'start',formatter:(v,opts)=>`${funnelData[opts.dataPointIndex]?.x}: ${v}`,style:{colors:['#fff'],fontSize:'12px',fontWeight:600}},
            xaxis:{categories:funnelData.map(d=>d.x),labels:{show:false}},
            yaxis:{labels:{show:false}},
            grid:{show:false},
            legend:{show:false},
            tooltip:{theme:'dark',y:{formatter:v=>`${v} engineers`}},
          })} />
      </div>

      {/* Tabs & Controls */}
      <div className={styles.opsRibbon}>
        <div className={styles.tabContainer}>
          {['pending','notsubmitted','drafts','approved'].map(tab => (
            <button key={tab} className={`${styles.tab} ${activeTab===tab?styles.active:''}`} onClick={()=>handleTabChange(tab)}>
              {tab==='pending'?'Pending Approvals':tab==='notsubmitted'?'Not Submitted':tab==='drafts'?'Daily Drafts':'Approved'}
              {tab==='pending' && funnelData[2]?.y > 0 && (
                <span style={{marginLeft:'6px',background:'#ff3b30',color:'#fff',borderRadius:'10px',padding:'1px 7px',fontSize:'0.68rem',fontWeight:700}}>{funnelData[2]?.y}</span>
              )}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          <div className={styles.filters}>
            <select className={styles.filterSelect} value={selectedEmp} onChange={e=>setSelectedEmp(e.target.value)}>
              <option value="ALL">All Engineers</option>
              {dropdowns.engineers.map(e=><option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
            <select className={styles.filterSelect} value={selectedPeriod} onChange={e=>setSelectedPeriod(e.target.value)}>
              <option value="ALL">All Valid Periods</option>
              {dropdowns.periods.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {activeTab === 'pending' && (
            <div className={styles.actionButtons}>
              <button className={styles.btnDanger} disabled={isProcessing||selectedURIs.size===0} onClick={()=>handleBulkAction('reject')}>
                <i className='bx bx-x-circle' /> Reject Selected
              </button>
              <button className={styles.btnPrimary} disabled={isProcessing||selectedURIs.size===0} onClick={()=>handleBulkAction('approve')}>
                {isProcessing?<><i className='bx bx-loader-alt bx-spin' /> Processing…</>:<><i className='bx bx-check-circle' /> Approve Selected</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.premiumTable}>
          <thead>
            <tr>
              <th style={{width:'40px'}}>
                <input type="checkbox" className={styles.chkBox} disabled={activeTab!=='pending'}
                  checked={tableData.length>0&&selectedURIs.size===tableData.length&&activeTab==='pending'}
                  onChange={e=>{if(e.target.checked)setSelectedURIs(new Set(tableData.filter(r=>!r.isDraft&&r.uri!=='draft').map(r=>r.uri)));else setSelectedURIs(new Set());}} />
              </th>
              <th>Engineer</th><th>Period</th><th>Total Hours</th><th>Status</th><th>Primary Project Focus</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr><td colSpan="6"><EmptyState preset={activeTab==='pending'?'noPending':'noData'} style={{padding:'40px'}} /></td></tr>
            ) : tableData.map(row => {
              const bc = styles[badgeClass[activeTab]] || styles.bgPending;
              return (
                <tr key={row.id} onClick={()=>setModalDetails(row)}>
                  <td onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" className={styles.chkBox} checked={selectedURIs.has(row.uri)}
                      onChange={e=>{e.stopPropagation();const s=new Set(selectedURIs);s.has(row.uri)?s.delete(row.uri):s.add(row.uri);setSelectedURIs(s);}}
                      disabled={activeTab!=='pending'} />
                  </td>
                  <td><div className={styles.userCell}><div className={styles.avatarSm}>{row.user.charAt(0)}</div>{row.user}</div></td>
                  <td>{row.periodStr}</td>
                  <td style={{fontWeight:600,color:'#fff'}}>{fmtInt(row.hours)} hrs</td>
                  <td><span className={`${styles.statusBadge} ${bc}`}>{badgeText[activeTab]}</span></td>
                  <td style={{color:'var(--text-muted)'}}>{row.proj}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {modalDetails && (
        <div className={styles.modalOverlay} onClick={()=>setModalDetails(null)}>
          <div className={styles.modalContent} onClick={e=>e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                <div className={styles.avatarSm} style={{width:'40px',height:'40px',fontSize:'1.2rem',background:'var(--accent-blue)'}}>{modalDetails.user.charAt(0)}</div>
                <div>
                  <div style={{color:'var(--text-main)',fontSize:'1.1rem',fontWeight:600}}>{modalDetails.user}</div>
                  <span style={{color:'var(--text-muted)',fontSize:'0.82rem',fontWeight:400}}>{modalDetails.periodStr}</span>
                </div>
              </h3>
              <i className='bx bx-x' style={{fontSize:'1.5rem',cursor:'pointer',color:'var(--text-muted)'}} onClick={()=>setModalDetails(null)} />
            </div>
            <div className={styles.modalBody}>
              <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--accent-blue)',textTransform:'uppercase',padding:'12px 24px 8px',borderBottom:'1px solid var(--border-color)'}}>Time Entry Details</div>
              <table className={styles.detailTable}>
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Project › Task</th><th>Comments</th><th style={{textAlign:'right'}}>Hours</th></tr>
                </thead>
                <tbody>
                  {modalDetails.entries.length === 0 ? (
                    <tr><td colSpan="5"><EmptyState preset="noData" title="No time entries synced" sub="Try re-syncing data." style={{padding:'24px'}} /></td></tr>
                  ) : modalDetails.entries.map((e,idx)=>(
                    <tr key={idx}>
                      <td style={{whiteSpace:'nowrap'}}>{e.dateStr}</td>
                      <td>{e.client}</td>
                      <td><b>{e.project}</b><br/><span className={styles.cellDim}>↳ {e.task}</span></td>
                      <td style={{whiteSpace:'normal',lineHeight:1.4}}>{e.comments}</td>
                      <td style={{textAlign:'right',fontWeight:600,color:'var(--text-main)'}}>{e.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <div style={{marginRight:'auto',color:'var(--text-muted)',fontSize:'0.9rem',fontWeight:500}}>
                Total: <span style={{color:'var(--accent-blue)',fontWeight:700}}>{fmtInt(modalDetails.hours)}</span> hrs
              </div>
              <button className={styles.btnGhost} onClick={()=>setModalDetails(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
