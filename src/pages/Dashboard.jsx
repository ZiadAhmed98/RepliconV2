import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Chart    from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import jsPDF    from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
window.html2canvas = html2canvas;

import styles        from './Dashboard.module.css';
import ComplianceModal from '../components/ComplianceModal';
import ErrorBoundary from '../components/ErrorBoundary';
import EmptyState    from '../components/EmptyState';
import { SkeletonChart } from '../components/Skeleton';
import { useToast }  from '../context/ToastContext';
import { baseChartOptions, fmtK, fmtInt } from '../utils/chartTheme';
import { CHART_COLORS, CHART_PALETTE, AT_RISK_THRESHOLD } from '../constants/index.js';

// ── Visibility customisation keys ─────────────────────────────────────────
const VISIBILITY_KEY = 'mds_dashboard_visibility';
const DEFAULT_VISIBILITY = {
  portfolioBurn: true, topClients: true, topEmployees: true,
  burnCapacity: true, billable: true,
  leakage: true, atRisk: true, activeProjects: true,
  gantt: true, heatmap: true, waterfall: true, treemap: true,
  forecast: true, clientQuadrant: true, complianceTrend: true,
  skillsGap: true, riskMatrix: true, rolloffs: true, locations: true, deepEffort: true,
};

// ── Lazy chart wrapper ─────────────────────────────────────────────────────
function LazyChart({ children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: '200px' });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ minHeight: '200px' }}>{visible ? children : <SkeletonChart height="260px" />}</div>;
}

// ── PDF export button ──────────────────────────────────────────────────────
function PdfButton({ onClick }) {
  return (
    <button onClick={onClick} className={styles.pdfBtn}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M9 15v-6h3a2 2 0 0 1 0 4H9"/>
      </svg>
      PDF
    </button>
  );
}

// ── Shared chart theme ─────────────────────────────────────────────────────
const getOpts = (id, custom = {}) => baseChartOptions({
  chart: { id, background: 'transparent', toolbar: { show: true }, ...(custom.chart || {}) },
  colors: CHART_PALETTE,
  ...custom,
});

export default function Dashboard({ dataMatrix }) {
  const { toast } = useToast();

  // ── State ────────────────────────────────────────────────────────────────
  const [compView,        setCompView]        = useState('daily');
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [showFilters,     setShowFilters]     = useState(false);
  const [trendMonths,     setTrendMonths]     = useState(12);
  const [deepLimit,       setDeepLimit]       = useState(20);
  const [yAxisLog,        setYAxisLog]        = useState(true);
  const [visibility, setVisibility] = useState(() => {
    try { return { ...DEFAULT_VISIBILITY, ...JSON.parse(localStorage.getItem(VISIBILITY_KEY) || '{}') }; }
    catch { return DEFAULT_VISIBILITY; }
  });
  const [showCustomize,   setShowCustomize]   = useState(false);

  const [filters, setFilters] = useState({ client: 'All', project: 'All', program: 'All', timePreset: 'All Time', dateFrom: '', dateTo: '' });
  const filterPanelRef = useRef(null);
  const dashboardRef   = useRef(null);

  const handleClearFilters = () => setFilters({ client: 'All', project: 'All', program: 'All', timePreset: 'All Time', dateFrom: '', dateTo: '' });

  useEffect(() => {
    if (!showFilters) return;
    const h = (e) => { if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilters(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showFilters]);

  const toggleVisibility = (key) => {
    const next = { ...visibility, [key]: !visibility[key] };
    setVisibility(next);
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
  };

  // ── Metrics computation ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const { factTable = [], dimensionTable = {}, topClients = [], compliance = {}, roster = [] } = dataMatrix || {};
    const nowTs = Date.now();
    let tAct=0, tEst=0, tQuoted=0, activeStatus=0, compStatus=0, billableHrs=0, overheadHrs=0;
    let overburnData=[], atRiskData=[], rolloffArray=[], timeTrendMap={}, statusCounts={};
    let empHoursMap={}, locMap={}, activeClientsSet=new Set(), activeProjectsSet=new Set(), activeProgramsSet=new Set();

    let tsFrom=0, tsTo=Infinity;
    if (filters.timePreset === 'This Week') {
      const d=new Date(); const day=d.getDay(); const diff=d.getDate()-day+(day===0?-6:1);
      tsFrom = new Date(d.setDate(diff)).setHours(0,0,0,0);
    } else if (filters.timePreset === 'MTD') {
      tsFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    } else if (filters.timePreset === 'Custom') {
      if (filters.dateFrom) tsFrom = new Date(filters.dateFrom).getTime();
      if (filters.dateTo)   tsTo   = new Date(filters.dateTo).getTime() + 86400000;
    }

    const filteredFacts = factTable.filter(row => {
      if (row.date > 0 && (row.date < tsFrom || row.date > tsTo)) return false;
      if (filters.client  !== 'All' && row.client  !== filters.client)  return false;
      if (filters.project !== 'All' && row.project !== filters.project) return false;
      if (filters.program !== 'All' && row.program !== filters.program) return false;
      return true;
    });

    filteredFacts.forEach(row => {
      if (row.client  && row.client  !== 'Unknown') activeClientsSet.add(row.client);
      if (row.project && row.project !== 'Unknown') activeProjectsSet.add(row.project);
      if (row.program && row.program !== 'Unknown' && row.program !== 'Unassigned') activeProgramsSet.add(row.program);
      if ((row.program||'').toLowerCase().includes('internal')) overheadHrs += row.act; else billableHrs += row.act;
      if (row.user && row.user !== 'Unknown') empHoursMap[row.user] = (empHoursMap[row.user]||0) + row.act;
      if (row.location && row.location !== 'Unknown') locMap[row.location] = (locMap[row.location]||0) + row.act;
      if (row.date > 0) {
        const d = new Date(row.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        timeTrendMap[key] = (timeTrendMap[key]||0) + row.act;
      }
    });

    // Heatmap: hours per day of week × week of year (last 8 weeks)
    const heatmapData = (() => {
      const days = ['Mon','Tue','Wed','Thu','Fri'];
      const matrix = days.map(d => ({ name: d, data: [] }));
      const now = new Date(); const wks = 12;
      for (let w = wks-1; w >= 0; w--) {
        const wStart = new Date(now); wStart.setDate(now.getDate() - now.getDay() + 1 - w*7); wStart.setHours(0,0,0,0);
        const wLabel = wStart.toLocaleDateString('en-US',{month:'short',day:'numeric'});
        days.forEach((dayName, di) => {
          const dayTs = new Date(wStart); dayTs.setDate(wStart.getDate() + di);
          const ts0 = dayTs.getTime(); const ts1 = ts0 + 86399999;
          const hours = filteredFacts.filter(r => r.date >= ts0 && r.date <= ts1).reduce((s,r)=>s+r.act,0);
          matrix[di].data.push({ x: wLabel, y: Math.round(hours) });
        });
      }
      return matrix;
    })();

    // Gantt data (rangeBar)
    const ganttData = (() => {
      const items = [];
      Object.entries(dimensionTable).forEach(([pName, d]) => {
        if (filters.client !== 'All' && d.client !== filters.client) return;
        if (filters.program !== 'All' && d.program !== filters.program) return;
        const status = (d.status||'').toLowerCase();
        if (status.includes('archived')) return;
        if (d.start > 0 && d.end > 0) {
          items.push({ x: pName.length > 25 ? pName.slice(0,22)+'…' : pName, y: [d.start, Math.min(d.end, nowTs + 90*86400000)] });
        }
      });
      return [{ data: items.slice(0, 15) }];
    })();

    // Waterfall (Quoted → Estimated → Actual variance)
    const waterfallData = (() => {
      const quoted = Object.values(dimensionTable).reduce((s,d)=>s+d.quoted,0);
      const est    = Object.values(dimensionTable).reduce((s,d)=>s+d.est,0);
      const act    = filteredFacts.reduce((s,r)=>s+r.act,0);
      return [
        { x: 'Quoted Budget',    y: Math.round(quoted) },
        { x: '↕ vs Estimated',  y: Math.round(est - quoted) },
        { x: '↕ vs Actual',     y: Math.round(act - est) },
        { x: 'Actual Burn',      y: Math.round(act) },
      ];
    })();

    // Forecast (extend trend forward 3 months with linear regression)
    const forecastData = (() => {
      const allKeys = Object.keys(timeTrendMap).sort();
      if (allKeys.length < 2) return { labels: [], act: [], cap: [], forecastAct: [], forecastCap: [] };
      const n = allKeys.length;
      const xVals = allKeys.map((_, i) => i);
      const yVals = allKeys.map(k => timeTrendMap[k]);
      const xMean = xVals.reduce((s,v)=>s+v,0)/n;
      const yMean = yVals.reduce((s,v)=>s+v,0)/n;
      const slope = xVals.reduce((s,x,i)=>s+(x-xMean)*(yVals[i]-yMean),0) / xVals.reduce((s,x)=>s+(x-xMean)**2,0);
      const intercept = yMean - slope * xMean;

      const project = (i) => Math.max(0, Math.round(slope * i + intercept));
      const labels = [...allKeys];
      const actArr = allKeys.map(k => Math.round(timeTrendMap[k]));
      const capArr = allKeys.map(k => {
        const [y,m] = k.split('-');
        const mS = new Date(y,parseInt(m)-1,1).getTime(), mE = new Date(y,parseInt(m),0).getTime();
        let cap=0;
        roster.forEach(emp => {
          const oS=Math.max(mS,emp.start), oE=Math.min(mE,emp.end||nowTs);
          if (oS<=oE) { let d=0,c=new Date(oS); while(c.getTime()<=oE){if(c.getDay()!==0&&c.getDay()!==6)d++;c.setDate(c.getDate()+1);} cap+=d*8; }
        });
        return Math.round(cap);
      });

      const forecastAct=[...Array(n).fill(null)]; const forecastCap=[...Array(n).fill(null)];
      for (let i=1;i<=3;i++) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth()+i);
        labels.push(nextMonth.toLocaleString('default',{month:'short',year:'2-digit'}));
        actArr.push(null);  capArr.push(null);
        forecastAct.push(project(n-1+i));
        forecastCap.push(forecastCap[n-1] || capArr[capArr.length-1] || 0);
      }
      return { labels, act: actArr, cap: capArr, forecastAct, forecastCap };
    })();

    // Compliance trend (weekly deficits sparkline → full chart)
    const complianceTrend = (compliance.sparkline || []).map((v, i) => ({ x: `W-${8-i}`, y: v }));

    // Client profitability quadrant
    const clientQuadrant = topClients.map(c => {
      const clientFacts = filteredFacts.filter(r => r.client === c.name);
      const billable = clientFacts.filter(r => !(r.program||'').toLowerCase().includes('internal')).reduce((s,r)=>s+r.act,0);
      const billablePct = c.val > 0 ? Math.round((billable/c.val)*100) : 0;
      return { x: Math.round(c.val), y: billablePct, name: c.name };
    });

    // Skills gap radar: team capacity vs demand per program
    const skillsGap = (() => {
      const programDemand = {}; const programCapacity = {};
      filteredFacts.forEach(r => { if (r.program && r.program !== 'Unassigned') programDemand[r.program] = (programDemand[r.program]||0)+r.act; });
      const topProgs = Object.keys(programDemand).sort((a,b)=>programDemand[b]-programDemand[a]).slice(0,8);
      return {
        labels: topProgs,
        demand: topProgs.map(p => Math.round(programDemand[p]||0)),
        capacity: topProgs.map(p => Math.round((programCapacity[p]||programDemand[p]||0)*1.2)), // capacity = 120% of demand as proxy
      };
    })();

    // Risk matrix: budget risk vs schedule risk per project
    const riskMatrix = (() => {
      const items = [];
      Object.entries(dimensionTable).forEach(([pName, d]) => {
        if (d.est === 0) return;
        const actualHrs = filteredFacts.filter(r=>r.project===pName).reduce((s,r)=>s+r.act,0);
        const budgetRisk = Math.min(100, Math.round((actualHrs/d.est)*100));
        const daysLeft   = d.end > nowTs ? Math.round((d.end-nowTs)/86400000) : 0;
        const schedRisk  = daysLeft > 0 ? Math.min(100, Math.round(100 - (actualHrs/d.est)*100)) : 100;
        if (actualHrs > 0) items.push({ x: budgetRisk, y: schedRisk, name: pName.length>20?pName.slice(0,17)+'…':pName });
      });
      return items;
    })();

    // Project per-period calcs (existing)
    let projLabels=[], projAct=[], projEst=[], projQuoted=[];
    Object.keys(dimensionTable).forEach(pName => {
      const pData = dimensionTable[pName];
      if (filters.client  !== 'All' && pData.client  !== filters.client)  return;
      if (filters.program !== 'All' && pData.program !== filters.program) return;
      if (filters.project !== 'All' && pName          !== filters.project) return;
      const periodActual = filteredFacts.filter(r=>r.project===pName).reduce((s,r)=>s+r.act,0);
      tAct += periodActual; tEst += pData.est; tQuoted += pData.quoted;
      projLabels.push(pName); projAct.push(periodActual); projEst.push(pData.est); projQuoted.push(pData.quoted);
      const statStr = (pData.status||'Unknown').toLowerCase();
      const isCompleted = statStr.includes('completed')||statStr.includes('archived');
      const isActive    = periodActual>0||statStr.includes('in progress')||statStr.includes('active');
      if (isCompleted) compStatus++; else if (isActive) activeStatus++;
      if (periodActual>0||pData.est>0) statusCounts[pData.status||'Unknown'] = (statusCounts[pData.status||'Unknown']||0)+1;
      if (isActive && pData.est>0 && (pData.program||'').toLowerCase().includes('deployment'))
        atRiskData.push({ name: pName, burn: Math.round((periodActual/pData.est)*100) });
      if (periodActual>pData.est && pData.est>0)
        overburnData.push({ name:pName, act:periodActual, est:pData.est, overburn:periodActual-pData.est });
      if (isActive && (pData.program||'').toLowerCase().includes('deployment')) {
        const engs = new Set();
        filteredFacts.forEach(r=>{if(r.project===pName&&r.date>(nowTs-30*86400000)&&r.act>0)engs.add(r.user);});
        if (engs.size>0) {
          const derivedEnd = pData.end>nowTs ? pData.end : nowTs+30*86400000;
          rolloffArray.push({ name:pName, end:derivedEnd, engineers:Array.from(engs) });
        }
      }
    });

    let trendLabels=[], trendActuals=[], trendCapacity=[];
    Object.keys(timeTrendMap).sort().forEach(k => {
      const [year,month]=k.split('-');
      const mStart=new Date(year,parseInt(month)-1,1).getTime(), mEnd=new Date(year,parseInt(month),0).getTime();
      trendLabels.push(new Date(mStart).toLocaleString('default',{month:'short',year:'2-digit'}));
      trendActuals.push(Math.round(timeTrendMap[k]));
      let mCap=0;
      roster.forEach(emp=>{
        const oS=Math.max(mStart,emp.start), oE=Math.min(mEnd,emp.end||nowTs);
        if (oS<=oE){let d=0,c=new Date(oS);while(c.getTime()<=oE){if(c.getDay()!==0&&c.getDay()!==6)d++;c.setDate(c.getDate()+1);}mCap+=d*8;}
      });
      trendCapacity.push(Math.round(mCap));
    });

    const allClients=new Set(), allProjects=new Set(), allPrograms=new Set();
    factTable.forEach(r=>{
      if(r.client&&r.client!=='Unknown')allClients.add(r.client);
      if(r.project&&r.project!=='Unknown')allProjects.add(r.project);
      if(r.program&&r.program!=='Unknown'&&r.program!=='Unassigned')allPrograms.add(r.program);
    });

    const sortedOverburn = overburnData.sort((a,b)=>b.overburn-a.overburn).slice(0,10);
    const maxBf = Math.ceil(Math.max(0,...sortedOverburn.map(p=>Math.max(p.act,p.est)))*1.1)||10;

    return {
      kpis: { totalProjects: activeProjectsSet.size, activeProjects: activeStatus, completedProjects: compStatus, actual: Math.round(tAct), estimated: Math.round(tEst), quoted: Math.round(tQuoted) },
      billable: Math.round(billableHrs), overhead: Math.round(overheadHrs),
      overburn: sortedOverburn, bfMax: maxBf, topClients,
      topEmployees: Object.keys(empHoursMap).map(e=>({name:e,val:empHoursMap[e]})).sort((a,b)=>b.val-a.val).slice(0,5),
      locations: Object.keys(locMap).map(l=>({name:l,val:locMap[l]})).sort((a,b)=>b.val-a.val),
      atRisk: atRiskData.sort((a,b)=>b.burn-a.burn).slice(0,7),
      statusLabels: Object.keys(statusCounts), statusData: Object.values(statusCounts),
      rolloffs: rolloffArray.sort((a,b)=>a.end-b.end).slice(0,5),
      trend: { labels: trendLabels, act: trendActuals, cap: trendCapacity },
      deepEffort: { labels: projLabels, act: projAct, est: projEst, quoted: projQuoted },
      compliance, activeClientsCount: activeClientsSet.size,
      dropdowns: { clients: Array.from(allClients).sort(), projects: Array.from(allProjects).sort(), programs: Array.from(allPrograms).sort() },
      dimensionTable,
      // New chart data
      heatmapData, ganttData, waterfallData, forecastData, complianceTrend,
      clientQuadrant, skillsGap, riskMatrix,
    };
  }, [dataMatrix, filters]);

  // ── PDF export ───────────────────────────────────────────────────────────
  const exportChartToPDF = useCallback(async (chartId, title, tableHeaders, tableRows) => {
    try {
      let imgURI = null;
      try { const r = await ApexCharts.exec(chartId,'dataURI'); if(r?.imgURI) imgURI=r.imgURI; } catch {}
      if (!imgURI) {
        const node = document.getElementById(`wrap-${chartId}`);
        if (node) { const canvas = await window.html2canvas(node, { backgroundColor:'#141419', scale:2, logging:false }); imgURI = canvas.toDataURL('image/png'); }
      }
      if (!imgURI) { toast.warning('Chart not ready. Try again in a moment.'); return; }
      const doc = new jsPDF('p','pt','a4');
      doc.setFontSize(18); doc.setTextColor(40,40,40); doc.text(title,40,45);
      doc.setFontSize(10); doc.setTextColor(120,120,120); doc.text(`Generated: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`,40,62);
      doc.setFillColor(20,20,25); doc.rect(40,80,515,230,'F');
      doc.addImage(imgURI,'PNG',40,80,515,230);
      autoTable(doc,{ startY:330, head:[tableHeaders], body:tableRows, theme:'striped', headStyles:{fillColor:[168,85,247],textColor:255,fontSize:10,fontStyle:'bold'}, bodyStyles:{fontSize:9,textColor:50}, alternateRowStyles:{fillColor:[245,245,245]}, margin:{left:40,right:40} });
      doc.save(`${title.replace(/\s+/g,'_')}_Report.pdf`);
      toast.success('PDF exported successfully');
    } catch (err) { console.error(err); toast.error('PDF export failed. Check the console.'); }
  }, [toast]);

  const slicedTrend = (arr) => arr.slice(-trendMonths);
  const trendLabels  = slicedTrend(metrics.trend.labels);
  const trendAct     = slicedTrend(metrics.trend.act);
  const trendCap     = slicedTrend(metrics.trend.cap);
  const deepCount    = Math.min(metrics.deepEffort.labels.length, deepLimit);
  const deepMinWidth = deepCount > 15 ? `${deepCount * 60}px` : '100%';

  // At-risk colors by burn %
  const atRiskColors = metrics.atRisk.map(r => r.burn >= 100 ? '#ff3b30' : r.burn >= 85 ? '#ff9f0a' : '#ffd60a');

  return (
    <div ref={dashboardRef}>
      <style>{`.apexcharts-svg,.apexcharts-canvas{background:transparent!important}`}</style>

      <ComplianceModal isOpen={isCompModalOpen} onClose={() => setIsCompModalOpen(false)} viewType={compView} dataMatrix={dataMatrix} />

      {/* ── Header ── */}
      <div className={styles.sectionHeader} style={{ position: 'relative' }}>
        <div className={styles.titleArea}>
          <h2 className={styles.sectionTitle}>Analytics Overview</h2>
          <div className="badges-container">
            <span className="badge-base period-badge">{filters.timePreset}</span>
            {filters.client  !== 'All' && <span className="badge-base active-filter-badge">{filters.client}</span>}
            {filters.program !== 'All' && <span className="badge-base active-filter-badge">{filters.program}</span>}
          </div>
        </div>
        <div className={styles.actionHeader}>
          <button className={styles.actionBtn} title="Customize visible charts" onClick={() => setShowCustomize(v=>!v)}><i className='bx bx-layout' /></button>
          <button className={styles.actionBtn} title="Toggle Filters" onClick={() => setShowFilters(!showFilters)}><i className='bx bx-filter-alt' /></button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className={styles.filterPanel} ref={filterPanelRef}>
            <h4>Global Filters <i className='bx bx-x' style={{cursor:'pointer'}} onClick={()=>setShowFilters(false)} /></h4>
            {[['Client','client','clients'],['Program','program','programs'],['Project','project','projects']].map(([label,key,dd]) => (
              <div className={styles.filterGroup} key={key}>
                <label>{label}</label>
                <select className={styles.formControl} value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}>
                  <option value="All">All {label}s</option>
                  {metrics.dropdowns[dd].map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            ))}
            <div className={styles.filterGroup} style={{marginTop:'16px'}}>
              <label>Time Period</label>
              <select className={styles.formControl} value={filters.timePreset} onChange={e => {
                const p = e.target.value; let from='', to='';
                if(p==='This Week'){const d=new Date();const day=d.getDay();const diff=d.getDate()-day+(day===0?-6:1);from=new Date(d.setDate(diff)).toISOString().split('T')[0];to=new Date().toISOString().split('T')[0];}
                else if(p==='MTD'){from=new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split('T')[0];to=new Date().toISOString().split('T')[0];}
                setFilters({...filters,timePreset:p,dateFrom:from,dateTo:to});
              }}>
                <option>All Time</option><option>This Week</option><option>MTD</option><option>Custom</option>
              </select>
            </div>
            <div className={styles.dateRangeRow}>
              <div><label>From</label><input type="date" className={styles.formControl} value={filters.dateFrom} onChange={e=>setFilters({...filters,timePreset:'Custom',dateFrom:e.target.value})} /></div>
              <div><label>To</label>  <input type="date" className={styles.formControl} value={filters.dateTo}   onChange={e=>setFilters({...filters,timePreset:'Custom',dateTo:e.target.value})}   /></div>
            </div>
            <div className={styles.filterActions}>
              <button className={styles.clearBtn} onClick={handleClearFilters}>Reset</button>
              <button className={styles.applyBtn} onClick={()=>setShowFilters(false)}>Apply</button>
            </div>
          </div>
        )}

        {/* Customize panel */}
        {showCustomize && (
          <div className={styles.filterPanel} style={{width:'300px'}} ref={null}>
            <h4>Customize Dashboard <i className='bx bx-x' style={{cursor:'pointer'}} onClick={()=>setShowCustomize(false)} /></h4>
            {Object.keys(DEFAULT_VISIBILITY).map(key => (
              <label key={key} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',fontSize:'0.85rem',color:'var(--text-sub)'}}>
                <input type="checkbox" checked={!!visibility[key]} onChange={()=>toggleVisibility(key)} style={{accentColor:'#a855f7',width:'15px',height:'15px'}} />
                {key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI Grid (8 cards) ── */}
      <div className={styles.kpiGrid}>
        {[
          { label:'Active Clients',    val: metrics.activeClientsCount,       color: undefined,                 icon:'bx-briefcase',    sub:'Portfolio' },
          { label:'Total Projects',    val: metrics.kpis.totalProjects,        color: undefined,                 icon:'bx-folder',       sub:'Baseline' },
          { label:'In Progress',       val: metrics.kpis.activeProjects,       color:'var(--accent-blue)',        icon:'bx-pulse',        sub:'Current' },
          { label:'Completed',         val: metrics.kpis.completedProjects,    color:'var(--accent-green)',       icon:'bx-check-circle', sub:'Current' },
          { label:'Actual Hours',      val: fmtInt(metrics.kpis.actual),       color: undefined,                 icon:'bx-time',         sub:'Period' },
          { label:'Estimated Hours',   val: fmtInt(metrics.kpis.estimated),    color: undefined,                 icon:'bx-target-lock',  sub:'Baseline' },
          { label:'Quoted Hours',      val: fmtInt(metrics.kpis.quoted),       color: undefined,                 icon:'bx-file',         sub:'Contracted' },
        ].map((k,i) => (
          <div key={i} className="kpi-card">
            <div>
              <p>{k.label}</p>
              <h3 style={k.color?{color:k.color}:{}}>{k.val}</h3>
            </div>
            <div className="trend"><i className={`bx ${k.icon}`} /><span>{k.sub}</span></div>
          </div>
        ))}

        {/* Compliance card */}
        <div className={`kpi-card ${styles.complianceCard}`} onClick={()=>setIsCompModalOpen(true)}>
          <div className={styles.compControls}>
            <i className='bx bx-chevron-left' onClick={e=>{e.stopPropagation();setCompView('daily');}} />
            <i className='bx bx-chevron-right' onClick={e=>{e.stopPropagation();setCompView('weekly');}} />
          </div>
          <div>
            <p>{compView==='daily'?'Daily Deficits':'Weekly Deficits'}</p>
            <h3 style={{color:'var(--accent-coral)'}}>{compView==='daily'?metrics.compliance.dailyDeficits:metrics.compliance.weeklyDeficits}</h3>
          </div>
          <div className={styles.sparklineContainer}>
            <Chart type="area" width="100%" height={35}
              series={[{name:'Deficits',data:metrics.compliance.sparkline||[]}]}
              options={{ chart:{sparkline:{enabled:true},background:'transparent'}, stroke:{curve:'smooth',width:2}, colors:['#ff3b30'], fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.4,opacityTo:0,stops:[0,100]}}, tooltip:{enabled:true,theme:'dark',y:{title:{formatter:()=>''}}} }} />
          </div>
        </div>
      </div>

      {/* ── Row 1: Portfolio Burn · Top Clients · Top Employees ── */}
      <div className={styles.chartRow}>
        {visibility.portfolioBurn && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-pie-chart-alt-2' style={{color:'var(--accent-primary)'}} /> Total Portfolio Burn</h4>
              <PdfButton onClick={()=>exportChartToPDF('portfolioBurnChart','Total Portfolio Burn',['Project','Actual','Est','Quoted'],metrics.deepEffort.labels.map((l,i)=>[l,metrics.deepEffort.act[i],metrics.deepEffort.est[i],metrics.deepEffort.quoted[i]]))} />
            </div>
            <LazyChart>
              <div id="wrap-portfolioBurnChart">
                <Chart type="area" width="100%" height={280}
                  series={[{name:'Quoted',data:metrics.deepEffort.quoted},{name:'Estimated',data:metrics.deepEffort.est},{name:'Actual',data:metrics.deepEffort.act}]}
                  options={getOpts('portfolioBurnChart',{ chart:{stacked:true}, colors:['rgba(255,255,255,0.05)','#6366f1','#a855f7'], stroke:{curve:'smooth',width:[1,2,2]}, fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.6,opacityTo:0.1,stops:[0,100]}}, dataLabels:{enabled:false}, xaxis:{categories:metrics.deepEffort.labels,labels:{show:false},axisBorder:{show:false},axisTicks:{show:false}}, yaxis:{labels:{formatter:fmtK,style:{colors:CHART_COLORS.muted}}}, legend:{position:'top',labels:{colors:CHART_COLORS.muted}} })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.topClients && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-bar-chart-alt-2' style={{color:'var(--accent-blue)'}} /> Top Clients</h4>
              <PdfButton onClick={()=>exportChartToPDF('topClientsChart','Top Clients by Volume',['Client','Hours'],metrics.topClients.map(c=>[c.name,Math.round(c.val)]))} />
            </div>
            <LazyChart>
              <div id="wrap-topClientsChart">
                <Chart type="bar" width="100%" height={280}
                  series={[{name:'Hours',data:metrics.topClients.map(c=>Math.round(c.val))}]}
                  options={getOpts('topClientsChart',{ colors:CHART_PALETTE, plotOptions:{bar:{horizontal:false,borderRadius:6,distributed:true,columnWidth:'50%'}}, dataLabels:{enabled:false}, xaxis:{categories:metrics.topClients.map(c=>c.name),labels:{style:{colors:CHART_COLORS.muted},rotate:-35,trim:true}}, legend:{show:false} })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.topEmployees && (
          <div className="chart-card">
            <h4><i className='bx bx-trophy' style={{color:'var(--accent-yellow)'}} /> Top Employees</h4>
            {metrics.topEmployees.length === 0 ? <EmptyState preset="noEmployees" /> : (
              <ul className={styles.insightList}>
                {metrics.topEmployees.map((e,i) => (
                  <li key={i} className={styles.insightItem}>
                    <div className={styles.insightInfo}>
                      <div className={styles.insightRank}>{i+1}</div>
                      <span className={styles.insightName}>{e.name}</span>
                    </div>
                    <span className={styles.insightVal}>{fmtInt(e.val)} hrs</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Row 2: Burn vs Capacity + Forecast · Billable Donut ── */}
      <div className={styles.chartRowHalf}>
        {visibility.burnCapacity && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-line-chart' style={{color:'var(--accent-primary)'}} /> Burn vs Capacity + Forecast</h4>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <select className={styles.formControl} style={{width:'auto',padding:'4px 10px',fontSize:'0.78rem',borderRadius:'8px'}} value={trendMonths} onChange={e=>setTrendMonths(parseInt(e.target.value))}>
                  <option value={6}>Last 6 Mo</option><option value={12}>Last 12 Mo</option><option value={9999}>All Time</option>
                </select>
                <PdfButton onClick={()=>exportChartToPDF('burnTrendChart','Burn vs Capacity',['Month','Actual','Capacity'],trendLabels.map((l,i)=>[l,trendAct[i],trendCap[i]]))} />
              </div>
            </div>
            <LazyChart>
              <div id="wrap-burnTrendChart">
                <Chart type="line" width="100%" height={280}
                  series={[
                    {name:'Capacity',    type:'line', data: trendCap},
                    {name:'Actual Burn', type:'area', data: trendAct},
                    {name:'Forecast',    type:'line', data: metrics.forecastData.forecastAct.slice(-trendMonths)},
                  ]}
                  options={getOpts('burnTrendChart',{
                    chart:{toolbar:{show:true}},
                    colors:['#8e8e93','#a855f7','#ffd60a'],
                    stroke:{curve:'smooth',width:[3,2,2],dashArray:[0,0,6]},
                    fill:{type:['solid','gradient','solid'],gradient:{shadeIntensity:1,opacityFrom:0.5,opacityTo:0.05,stops:[0,100]}},
                    xaxis:{categories:trendLabels,labels:{style:{colors:CHART_COLORS.muted}},axisBorder:{show:false},axisTicks:{show:false}},
                    yaxis:{labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                    legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
                    annotations:{yaxis:[{y:0,strokeDashArray:0,borderColor:'rgba(255,255,255,0.1)'}]},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.billable && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-doughnut-chart' style={{color:'var(--accent-blue)'}} /> Billable vs Non-Billable</h4>
              <PdfButton onClick={()=>exportChartToPDF('billableRatioChart','Billable Ratio',['Type','Hours'],[['Billable',metrics.billable],['Non-Billable',metrics.overhead]])} />
            </div>
            <LazyChart>
              <div id="wrap-billableRatioChart">
                <Chart type="donut" width="100%" height={280}
                  series={[metrics.billable, metrics.overhead]}
                  options={getOpts('billableRatioChart',{
                    labels:['Billable','Non-Billable'],
                    colors:['#a855f7','rgba(255,255,255,0.08)'],
                    stroke:{width:0},
                    plotOptions:{pie:{donut:{size:'72%',labels:{show:true,total:{show:true,label:'Billable %',formatter:()=>{const t=metrics.billable+metrics.overhead;return t?`${Math.round((metrics.billable/t)*100)}%`:'0%';}}}}}},
                    dataLabels:{enabled:false},
                    legend:{position:'bottom',labels:{colors:CHART_COLORS.muted}},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}
      </div>

      {/* ── Row 3: Leakage · At-Risk · Status ── */}
      <div className={styles.chartRow}>
        {visibility.leakage && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-error-circle' style={{color:'var(--accent-red)'}} /> Revenue Leakage</h4>
              <PdfButton onClick={()=>exportChartToPDF('leakageChart','Revenue Leakage',['Project','Est Budget','Actual','Overburn'],metrics.overburn.map(p=>[p.name,p.est,p.act,p.overburn]))} />
            </div>
            {metrics.overburn.length === 0 ? <EmptyState preset="noData" title="No overburn projects" sub="All projects are within budget." /> : (
              <LazyChart>
                <div id="wrap-leakageChart">
                  <Chart type="bar" width="100%" height={280}
                    series={[{name:'Est Budget',data:metrics.overburn.map(p=>-p.est)},{name:'Act Burn',data:metrics.overburn.map(p=>p.act)}]}
                    options={getOpts('leakageChart',{ chart:{stacked:true}, colors:['rgba(255,255,255,0.08)','#ff3b30'], plotOptions:{bar:{horizontal:true,borderRadius:4}}, xaxis:{categories:metrics.overburn.map(p=>p.name),min:-metrics.bfMax,max:metrics.bfMax,labels:{style:{colors:CHART_COLORS.muted},formatter:v=>fmtK(Math.abs(v))}}, yaxis:{labels:{style:{colors:CHART_COLORS.muted},maxWidth:140}}, dataLabels:{enabled:false}, legend:{show:false} })} />
                </div>
              </LazyChart>
            )}
          </div>
        )}

        {visibility.atRisk && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-radar' style={{color:'var(--accent-coral)'}} /> At-Risk Projects</h4>
              <PdfButton onClick={()=>exportChartToPDF('atRiskChart','At-Risk Projects',['Project','Burn %'],metrics.atRisk.map(r=>[r.name,r.burn+'%']))} />
            </div>
            {metrics.atRisk.length === 0 ? <EmptyState preset="noData" title="No at-risk projects" sub="All deployment projects are within budget." /> : (
              <LazyChart>
                <div id="wrap-atRiskChart">
                  <Chart type="bar" width="100%" height={280}
                    series={[{name:'Burn %',data:metrics.atRisk.map(r=>r.burn)}]}
                    options={getOpts('atRiskChart',{
                      colors: atRiskColors,
                      plotOptions:{bar:{horizontal:true,borderRadius:6,barHeight:'40%',distributed:true}},
                      dataLabels:{enabled:true,formatter:v=>Math.round(v)+'%',textAnchor:'start',style:{colors:['#fff']}},
                      xaxis:{categories:metrics.atRisk.map(r=>r.name),max:Math.max(100,...metrics.atRisk.map(r=>r.burn)),labels:{style:{colors:CHART_COLORS.muted}}},
                      yaxis:{labels:{style:{colors:CHART_COLORS.muted},maxWidth:140}},
                      annotations:{xaxis:[{x:AT_RISK_THRESHOLD,strokeDashArray:4,borderColor:'#ff9f0a',label:{text:`${AT_RISK_THRESHOLD}% threshold`,style:{color:'#ff9f0a',background:'transparent',fontSize:'11px'}}}]},
                      legend:{show:false}, grid:{show:false},
                    })} />
                </div>
              </LazyChart>
            )}
          </div>
        )}

        {visibility.activeProjects && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-task' style={{color:'var(--accent-green)'}} /> Project Status Mix</h4>
              <PdfButton onClick={()=>exportChartToPDF('statusChart','Project Status',['Status','Count'],metrics.statusLabels.map((s,i)=>[s,metrics.statusData[i]]))} />
            </div>
            <LazyChart>
              <div id="wrap-statusChart">
                <Chart type="donut" width="100%" height={280}
                  series={metrics.statusData.length ? metrics.statusData : [1]}
                  options={getOpts('statusChart',{ labels:metrics.statusLabels.length?metrics.statusLabels:['No Data'], colors:CHART_PALETTE, stroke:{width:0}, plotOptions:{pie:{donut:{size:'72%'}}}, dataLabels:{enabled:false}, legend:{position:'bottom',labels:{colors:CHART_COLORS.muted}} })} />
              </div>
            </LazyChart>
          </div>
        )}
      </div>

      {/* ── Row 4: Gantt (full-width) ── */}
      {visibility.gantt && (
        <div className={styles.chartRow}>
          <div className={`chart-card ${styles.fullWidth}`}>
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-calendar' style={{color:'var(--accent-blue)'}} /> Project Timeline (Gantt)</h4>
            </div>
            {metrics.ganttData[0]?.data?.length === 0 ? <EmptyState preset="noProjects" /> : (
              <LazyChart>
                <div id="wrap-ganttChart">
                  <Chart type="rangeBar" width="100%" height={Math.max(200, (metrics.ganttData[0]?.data?.length||0)*36+40)}
                    series={metrics.ganttData}
                    options={getOpts('ganttChart',{
                      chart:{toolbar:{show:true}},
                      colors:['#a855f7'],
                      plotOptions:{bar:{horizontal:true,barHeight:'60%',borderRadius:4}},
                      xaxis:{type:'datetime',labels:{style:{colors:CHART_COLORS.muted}},axisBorder:{show:false}},
                      yaxis:{labels:{style:{colors:CHART_COLORS.muted},maxWidth:160}},
                      grid:{borderColor:'rgba(255,255,255,0.05)'},
                      tooltip:{theme:'dark',x:{format:'MMM dd, yyyy'}},
                      dataLabels:{enabled:false},
                      annotations:{xaxis:[{x:Date.now(),strokeDashArray:0,borderColor:'rgba(255,255,255,0.3)',label:{text:'Today',style:{color:'var(--text-main)',background:'rgba(255,255,255,0.1)',fontSize:'11px'}}}]},
                    })} />
                </div>
              </LazyChart>
            )}
          </div>
        </div>
      )}

      {/* ── Row 5: Resource Heatmap · Client Profitability Quadrant ── */}
      <div className={styles.chartRowHalf}>
        {visibility.heatmap && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-grid-alt' style={{color:'var(--accent-green)'}} /> Team Utilization Heatmap</h4>
            </div>
            <LazyChart>
              <div id="wrap-heatmapChart">
                <Chart type="heatmap" width="100%" height={220}
                  series={metrics.heatmapData}
                  options={getOpts('heatmapChart',{
                    colors:['#a855f7'], dataLabels:{enabled:false},
                    plotOptions:{heatmap:{shadeIntensity:0.7,radius:4,colorScale:{ranges:[{from:0,to:0,color:'rgba(255,255,255,0.03)',name:'No hours'},{from:1,to:20,color:'rgba(168,85,247,0.25)',name:'Light'},{from:21,to:50,color:'rgba(168,85,247,0.5)',name:'Moderate'},{from:51,to:9999,color:'#a855f7',name:'Heavy'}]}}},
                    xaxis:{labels:{style:{colors:CHART_COLORS.muted,fontSize:'10px'}}},
                    yaxis:{labels:{style:{colors:CHART_COLORS.muted,fontSize:'11px'}}},
                    tooltip:{theme:'dark',y:{formatter:v=>`${v} hrs`}},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.clientQuadrant && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-scatter-chart' style={{color:'var(--accent-yellow)'}} /> Client Profitability Matrix</h4>
            </div>
            <LazyChart>
              <div id="wrap-clientQuadrantChart">
                <Chart type="scatter" width="100%" height={220}
                  series={[{name:'Clients',data:metrics.clientQuadrant}]}
                  options={getOpts('clientQuadrantChart',{
                    colors:['#ffd60a'],
                    xaxis:{title:{text:'Total Hours',style:{color:CHART_COLORS.muted}},labels:{formatter:fmtK,style:{colors:CHART_COLORS.muted}}},
                    yaxis:{title:{text:'Billable %',style:{color:CHART_COLORS.muted}},labels:{formatter:v=>v+'%',style:{colors:CHART_COLORS.muted}},min:0,max:100},
                    tooltip:{theme:'dark',custom:({seriesIndex,dataPointIndex,w})=>{ const d=w.config.series[seriesIndex].data[dataPointIndex]; return `<div style="padding:10px;background:rgba(20,20,24,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:10px"><b style="color:#fff">${d.name}</b><br/><span style="color:#8e8e93;font-size:0.8rem">${fmtInt(d.x)} hrs · ${d.y}% billable</span></div>`;}},
                    annotations:{xaxis:[{x:metrics.topClients.reduce((s,c)=>s+c.val,0)/(metrics.topClients.length||1),strokeDashArray:4,borderColor:'rgba(255,255,255,0.2)'}],yaxis:[{y:70,strokeDashArray:4,borderColor:'rgba(255,255,255,0.2)'}]},
                    markers:{size:8,strokeWidth:0},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}
      </div>

      {/* ── Row 6: Waterfall · Treemap ── */}
      <div className={styles.chartRowHalf}>
        {visibility.waterfall && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-bar-chart' style={{color:'var(--accent-teal)'}} /> Budget Variance Waterfall</h4>
            </div>
            <LazyChart>
              <div id="wrap-waterfallChart">
                <Chart type="bar" width="100%" height={240}
                  series={[{name:'Hours',data:metrics.waterfallData}]}
                  options={getOpts('waterfallChart',{
                    colors:metrics.waterfallData.map(d=>d.y>=0?'#30d158':'#ff3b30'),
                    plotOptions:{bar:{borderRadius:6,distributed:true,columnWidth:'50%'}},
                    dataLabels:{enabled:true,formatter:v=>fmtK(Math.abs(v)),style:{colors:['#fff'],fontSize:'12px',fontWeight:600}},
                    xaxis:{categories:metrics.waterfallData.map(d=>d.x),labels:{style:{colors:CHART_COLORS.muted}}},
                    yaxis:{labels:{formatter:v=>fmtK(Math.abs(v)),style:{colors:CHART_COLORS.muted}}},
                    legend:{show:false},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.treemap && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-sitemap' style={{color:'var(--accent-indigo)'}} /> Client Portfolio Treemap</h4>
            </div>
            <LazyChart>
              <div id="wrap-treemapChart">
                <Chart type="treemap" width="100%" height={240}
                  series={[{data:metrics.topClients.map(c=>({x:c.name,y:Math.round(c.val)}))}]}
                  options={getOpts('treemapChart',{
                    colors:CHART_PALETTE,
                    plotOptions:{treemap:{distributed:true,enableShades:false}},
                    dataLabels:{enabled:true,style:{fontSize:'12px',fontWeight:600}},
                    tooltip:{theme:'dark',y:{formatter:v=>fmtInt(v)+' hrs'}},
                    legend:{show:false},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}
      </div>

      {/* ── Row 7: Compliance Trend · Skills Gap Radar ── */}
      <div className={styles.chartRowHalf}>
        {visibility.complianceTrend && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-shield-quarter' style={{color:'var(--accent-coral)'}} /> Compliance Deficit Trend</h4>
            </div>
            <LazyChart>
              <div id="wrap-complianceTrendChart">
                <Chart type="area" width="100%" height={240}
                  series={[{name:'Deficits',data:metrics.complianceTrend.map(d=>d.y)}]}
                  options={getOpts('complianceTrendChart',{
                    colors:['#ff3b30'],
                    stroke:{curve:'smooth',width:2},
                    fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.35,opacityTo:0,stops:[0,100]}},
                    xaxis:{categories:metrics.complianceTrend.map(d=>d.x),labels:{style:{colors:CHART_COLORS.muted}}},
                    yaxis:{labels:{formatter:v=>Math.round(v),style:{colors:CHART_COLORS.muted}},min:0},
                    annotations:{yaxis:[{y:0,strokeDashArray:0,borderColor:'rgba(255,255,255,0.1)',label:{text:'Target: 0',style:{color:'#30d158',background:'transparent',fontSize:'11px'}}}]},
                    dataLabels:{enabled:true,formatter:v=>v||'',style:{colors:['#ff3b30'],fontSize:'11px',fontWeight:700}},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.skillsGap && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-radar' style={{color:'var(--accent-blue)'}} /> Skills Gap Analysis</h4>
            </div>
            <LazyChart>
              <div id="wrap-skillsGapChart">
                <Chart type="radar" width="100%" height={240}
                  series={[{name:'Current Demand',data:metrics.skillsGap.demand},{name:'Available Capacity',data:metrics.skillsGap.capacity}]}
                  options={getOpts('skillsGapChart',{
                    colors:['#a855f7','#32ade6'],
                    labels:metrics.skillsGap.labels,
                    stroke:{width:2},
                    fill:{opacity:0.15},
                    plotOptions:{radar:{size:90,polygons:{strokeColors:'rgba(255,255,255,0.05)',connectorColors:'rgba(255,255,255,0.05)'}}},
                    markers:{size:4,strokeWidth:2},
                    yaxis:{show:false},
                    xaxis:{labels:{style:{colors:CHART_COLORS.muted,fontSize:'11px'}}},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}
      </div>

      {/* ── Row 8: Risk Matrix · Rolloffs ── */}
      <div className={styles.chartRowHalf}>
        {visibility.riskMatrix && (
          <div className="chart-card">
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-heatmap' style={{color:'var(--accent-red)'}} /> Project Risk Matrix</h4>
            </div>
            <LazyChart>
              <div id="wrap-riskMatrixChart">
                <Chart type="scatter" width="100%" height={280}
                  series={[{name:'Projects',data:metrics.riskMatrix}]}
                  options={getOpts('riskMatrixChart',{
                    colors:['#f43f5e'],
                    xaxis:{title:{text:'Budget Burn %',style:{color:CHART_COLORS.muted}},labels:{formatter:v=>v+'%',style:{colors:CHART_COLORS.muted}},min:0,max:100},
                    yaxis:{title:{text:'Schedule Risk %',style:{color:CHART_COLORS.muted}},labels:{formatter:v=>v+'%',style:{colors:CHART_COLORS.muted}},min:0,max:100},
                    markers:{size:7,strokeWidth:0},
                    annotations:{
                      xaxis:[{x:80,strokeDashArray:4,borderColor:'rgba(255,59,48,0.4)'},{x:50,strokeDashArray:4,borderColor:'rgba(255,214,10,0.3)'}],
                      yaxis:[{y:50,strokeDashArray:4,borderColor:'rgba(255,59,48,0.3)'}],
                    },
                    tooltip:{theme:'dark',custom:({seriesIndex,dataPointIndex,w})=>{const d=w.config.series[seriesIndex].data[dataPointIndex];return `<div style="padding:10px;background:rgba(20,20,24,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:10px"><b style="color:#fff">${d.name}</b><br/><span style="color:#8e8e93;font-size:0.8rem">Budget: ${d.x}% · Schedule Risk: ${d.y}%</span></div>`;}},
                  })} />
              </div>
            </LazyChart>
          </div>
        )}

        {visibility.rolloffs && (
          <div className="chart-card">
            <h4><i className='bx bx-calendar-event' /> Deployment Rolloffs</h4>
            {metrics.rolloffs.length === 0 ? <EmptyState preset="noData" title="No upcoming rolloffs" /> : (
              <div style={{overflowY:'auto',maxHeight:'280px'}}>
                <table className={styles.premiumTable}>
                  <thead><tr><th>Project</th><th>End Date</th><th>Engineers Rolling Off</th></tr></thead>
                  <tbody>{metrics.rolloffs.map((r,i)=>(
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{new Date(r.end).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                      <td><div className={styles.teamTags}>{r.engineers.map((e,j)=><span key={j}>{e.split(' ')[0]}</span>)}</div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Row 9: Locations ── */}
      {visibility.locations && (
        <div className={styles.chartRowHalf}>
          <div className="chart-card">
            <h4><i className='bx bx-map' style={{color:'var(--accent-blue)'}} /> Locations Overview</h4>
            <div style={{overflowY:'auto',maxHeight:'280px'}}>
              <div className={styles.locationList}>
                {metrics.locations.map((loc,idx)=>{
                  const max=metrics.locations[0]?.val||1;
                  const pct=Math.round((loc.val/max)*100);
                  return (
                    <div key={idx} className={styles.locItem}>
                      <div className={styles.locHeader}><span>{loc.name}</span><span className={styles.locVal}>{fmtInt(loc.val)} hrs · {pct}%</span></div>
                      <div className={styles.progress}><div className={styles.progressBar} style={{width:`${pct}%`}} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="chart-card" style={{display:'flex',flexDirection:'column',gap:'12px',justifyContent:'center'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              {[
                {label:'Billable Rate',  val:`${metrics.billable+metrics.overhead > 0 ? Math.round((metrics.billable/(metrics.billable+metrics.overhead))*100) : 0}%`, color:'var(--accent-green)'},
                {label:'Overburn Count', val:metrics.overburn.length, color:'var(--accent-red)'},
                {label:'Active Programs',val:Array.from(new Set((dataMatrix?.factTable||[]).filter(r=>!(r.program||'').toLowerCase().includes('internal')).map(r=>r.program).filter(Boolean))).length, color:'var(--accent-blue)'},
                {label:'At-Risk Projects',val:metrics.atRisk.filter(r=>r.burn>=AT_RISK_THRESHOLD).length, color:'var(--accent-yellow)'},
              ].map((stat,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:'0.72rem',color:'var(--text-muted)',textTransform:'uppercase',fontWeight:600,letterSpacing:'0.05em',marginBottom:'6px'}}>{stat.label}</div>
                  <div style={{fontSize:'1.6rem',fontWeight:700,color:stat.color,letterSpacing:'-0.03em'}}>{stat.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Deep Effort Chart ── */}
      {visibility.deepEffort && (
        <div className={styles.chartRow}>
          <div className={`chart-card ${styles.fullWidth}`}>
            <div className={styles.chartHeader}>
              <h4><i className='bx bx-bar-chart-square' /> Deep Project Delivery Analysis</h4>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <select className={styles.formControl} style={{width:'auto',padding:'4px 10px',fontSize:'0.78rem',borderRadius:'8px'}} value={deepLimit} onChange={e=>setDeepLimit(parseInt(e.target.value))}>
                  <option value={10}>Top 10</option><option value={20}>Top 20</option><option value={50}>Top 50</option><option value={9999}>All</option>
                </select>
                <button onClick={()=>setYAxisLog(v=>!v)} style={{padding:'4px 10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.78rem',fontFamily:'inherit'}}>
                  {yAxisLog?'Linear':'Log'}
                </button>
                <PdfButton onClick={()=>exportChartToPDF('deepEffortLogChart','Deep Project Analysis',['Project','Actual','Est','Quoted'],metrics.deepEffort.labels.slice(0,deepLimit).map((l,i)=>[l,metrics.deepEffort.act[i],metrics.deepEffort.est[i],metrics.deepEffort.quoted[i]]))} />
              </div>
            </div>
            <div style={{overflowX:'auto',width:'100%'}}>
              <div id="wrap-deepEffortLogChart" style={{minWidth:deepMinWidth,width:'100%'}}>
                <Chart type="bar" width="100%" height={450}
                  series={[{name:'Actual',data:metrics.deepEffort.act.slice(0,deepCount).map(v=>Math.max(0.1,v))},{name:'Estimated',data:metrics.deepEffort.est.slice(0,deepCount).map(v=>Math.max(0.1,v))},{name:'Quoted',data:metrics.deepEffort.quoted.slice(0,deepCount).map(v=>Math.max(0.1,v))}]}
                  options={getOpts('deepEffortLogChart',{
                    chart:{stacked:false,animations:{enabled:false}},
                    colors:['#a855f7','#32ade6','rgba(255,255,255,0.08)'],
                    plotOptions:{bar:{horizontal:false,columnWidth:'65%',borderRadius:4}},
                    xaxis:{categories:metrics.deepEffort.labels.slice(0,deepCount),labels:{style:{colors:CHART_COLORS.muted},rotate:-40,trim:true,maxHeight:150}},
                    yaxis:{logarithmic:yAxisLog,labels:{formatter:v=>(!v||v<=0.1)?'0':fmtK(v),style:{colors:CHART_COLORS.muted}}},
                    dataLabels:{enabled:false},
                    legend:{position:'top',horizontalAlign:'left',labels:{colors:CHART_COLORS.muted}},
                  })} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="pdf-table-container" style={{display:'none',padding:'20px',background:'#0a0a0c'}} />
    </div>
  );
}
