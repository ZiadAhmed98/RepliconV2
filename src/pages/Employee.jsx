import React, { useState, useMemo, useEffect } from 'react';
import Chart    from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import jsPDF    from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
window.html2canvas = html2canvas;

import styles   from './Employee.module.css';
import ErrorBoundary from '../components/ErrorBoundary';
import EmptyState    from '../components/EmptyState';
import { baseChartOptions, fmtInt } from '../utils/chartTheme';
import { CHART_COLORS, CHART_PALETTE } from '../constants/index.js';

const getOpts = (id, custom={}) => baseChartOptions({
  chart: { id, background:'transparent', toolbar:{show:true}, ...(custom.chart||{}) },
  ...custom,
});

function PdfButton({ onClick }) {
  return (
    <button onClick={onClick} style={{padding:'5px 12px',fontSize:'0.78rem',borderRadius:'8px',border:'1px solid rgba(255,59,48,0.25)',background:'rgba(255,59,48,0.05)',display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',color:'#ff3b30',fontFamily:'inherit',transition:'all 0.2s'}}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,59,48,0.15)'}
      onMouseLeave={e=>e.currentTarget.style.background='rgba(255,59,48,0.05)'}
    >
      <i className='bx bxs-file-pdf' /> PDF
    </button>
  );
}

export default function Employee({ dataMatrix, sessionUser }) {
  const sortedRoster = useMemo(() => {
    if (!dataMatrix?.roster) return [];
    return [...dataMatrix.roster].sort((a,b) => {
      if (a.status==='Enabled' && b.status!=='Enabled') return -1;
      if (a.status!=='Enabled' && b.status==='Enabled') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [dataMatrix]);

  const [selectedEmpName, setSelectedEmpName] = useState('');

  useEffect(() => {
    if (sortedRoster.length > 0 && !selectedEmpName) {
      const match = sortedRoster.find(e => sessionUser && e.name.toLowerCase().includes(sessionUser.name.toLowerCase()));
      setSelectedEmpName(match ? match.name : sortedRoster[0].name);
    }
  }, [sortedRoster, sessionUser, selectedEmpName]);

  const getWorkingDays = (start, end) => {
    let days=0, cur=new Date(start); cur.setHours(0,0,0,0);
    const e=new Date(end); e.setHours(0,0,0,0);
    while(cur<=e){if(cur.getDay()!==0&&cur.getDay()!==6)days++;cur.setDate(cur.getDate()+1);}
    return Math.max(1,days);
  };

  const empData = useMemo(() => {
    if (!selectedEmpName || !dataMatrix?.factTable) return null;
    const emp = sortedRoster.find(e=>e.name===selectedEmpName);
    if (!emp) return null;

    const myFacts = dataMatrix.factTable.filter(r=>r.user===selectedEmpName&&r.act>0);
    let totalHrs=0, billable=0, overhead=0;
    let projMap={}, progMap={}, trendMap={}, clientMap={}, weeklyMap={}, dowMap={0:0,1:0,2:0,3:0,4:0};

    myFacts.forEach(r => {
      totalHrs += r.act;
      if ((r.program||'').toLowerCase().includes('internal')) overhead += r.act; else billable += r.act;
      if (r.project !== 'Unknown') projMap[r.project]  = (projMap[r.project]||0)  + r.act;
      if (r.program !== 'Unknown' && r.program !== 'Unassigned') progMap[r.program] = (progMap[r.program]||0) + r.act;
      const pData = dataMatrix.dimensionTable[r.project];
      const cName = pData?.client || 'Unknown';
      if (cName !== 'Unknown') clientMap[cName] = (clientMap[cName]||0) + r.act;

      if (r.date > 0) {
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        trendMap[key] = (trendMap[key]||0) + r.act;

        // Weekly accumulation for velocity burnup
        const getMonday = (dt) => { dt=new Date(dt); const dy=dt.getDay(); return new Date(dt.setDate(dt.getDate()-dy+(dy===0?-6:1))).setHours(0,0,0,0); };
        const wKey = getMonday(r.date);
        weeklyMap[wKey] = (weeklyMap[wKey]||0) + r.act;

        // Day of week (1=Mon…5=Fri)
        const dow = d.getDay(); // 0=Sun, 6=Sat
        if (dow >= 1 && dow <= 5) dowMap[dow] = (dowMap[dow]||0) + r.act;
      }
    });

    const nowTs = Date.now();
    const effectiveEnd = Math.min(nowTs, emp.end||nowTs);
    const capacity  = getWorkingDays(emp.start, effectiveEnd) * 8;
    const utilPct   = capacity > 0 ? Math.round((totalHrs/capacity)*100) : 0;
    const billPct   = totalHrs > 0 ? Math.round((billable/totalHrs)*100) : 0;
    let activeProjCount = 0;
    Object.keys(projMap).forEach(p => { const d=dataMatrix.dimensionTable[p]; if(d&&d.status!=='Completed'&&d.status!=='Archived')activeProjCount++; });
    const monthsActive = Object.keys(trendMap).length||1;

    // Monthly trend
    const tLabels = Object.keys(trendMap).sort();
    const tData   = tLabels.map(k=>Math.round(trendMap[k]));
    const tCapData = tLabels.map(k => {
      const [y,m]=k.split('-');
      const mS=new Date(y,parseInt(m)-1,1).getTime(), mE=new Date(y,parseInt(m),0).getTime();
      const oS=Math.max(mS,emp.start), oE=Math.min(mE,emp.end||nowTs);
      return (oS<=oE)?getWorkingDays(oS,oE)*8:0;
    });
    const niceLabels = tLabels.map(k=>{const[y,m]=k.split('-');return new Date(y,parseInt(m)-1,1).toLocaleString('default',{month:'short',year:'2-digit'});});

    // Velocity burnup (cumulative per week)
    const weekKeys  = Object.keys(weeklyMap).map(Number).sort((a,b)=>a-b);
    let cumulative=0;
    const velocityLabels = weekKeys.map(wk => new Date(wk).toLocaleDateString('en-US',{month:'short',day:'numeric'}));
    const velocityData   = weekKeys.map(wk => { cumulative += weeklyMap[wk]; return Math.round(cumulative); });
    const weeklyActual   = weekKeys.map(wk => Math.round(weeklyMap[wk]));

    // Time entry patterns (by day of week)
    const dowLabels = ['Mon','Tue','Wed','Thu','Fri'];
    const dowData   = [1,2,3,4,5].map(d=>Math.round(dowMap[d]||0));

    // Cohort (hire year distribution)
    const cohortMap = {};
    (dataMatrix.roster||[]).forEach(e => { if(e.start>0){ const yr=new Date(e.start).getFullYear(); cohortMap[yr]=(cohortMap[yr]||{active:0,inactive:0}); if(e.status==='Enabled')cohortMap[yr].active++;else cohortMap[yr].inactive++; }});
    const cohortYears = Object.keys(cohortMap).sort();
    const cohortActive   = cohortYears.map(y=>cohortMap[y].active);
    const cohortInactive = cohortYears.map(y=>cohortMap[y].inactive);

    // Program radar
    const pKeys = Object.keys(progMap).sort((a,b)=>progMap[b]-progMap[a]).slice(0,8);
    const pVals = pKeys.map(k=>Math.round(progMap[k]));

    // Project bar
    const projKeys = Object.keys(projMap).sort((a,b)=>projMap[b]-projMap[a]).slice(0,10);
    const projVals = projKeys.map(k=>Math.round(projMap[k]));

    // Client donut
    const clientKeys = Object.keys(clientMap).sort((a,b)=>clientMap[b]-clientMap[a]).slice(0,6);
    const clientVals = clientKeys.map(k=>Math.round(clientMap[k]));

    const compRecord = dataMatrix.compliance?.dailyList?.find(c=>c.name===emp.name);

    return {
      emp, utilPct, capacity, totalHrs, activeProjCount, billPct, avg: Math.round(totalHrs/monthsActive),
      billable:Math.round(billable), overhead:Math.round(overhead),
      trend:    { labels:niceLabels, act:tData, cap:tCapData },
      velocity: { labels:velocityLabels, cumulative:velocityData, weekly:weeklyActual },
      timePatterns: { labels:dowLabels, data:dowData },
      cohort:   { years:cohortYears, active:cohortActive, inactive:cohortInactive },
      radar:    { labels:pKeys.length?pKeys:['No Data'], series:pVals.length?pVals:[0] },
      projects: { labels:projKeys.length?projKeys:['No Data'], series:projVals.length?projVals:[0] },
      clients:  { labels:clientKeys.length?clientKeys:['No Data'], series:clientVals.length?clientVals:[1] },
      tableMap: projMap, compRecord,
    };
  }, [selectedEmpName, dataMatrix, sortedRoster]);

  if (!empData) return null;

  const exportChartToPDF = async (chartId, title, headers, rows) => {
    try {
      let imgURI=null;
      try{const r=await ApexCharts.exec(chartId,'dataURI');if(r?.imgURI)imgURI=r.imgURI;}catch{}
      if(!imgURI){const node=document.getElementById(`wrap-${chartId}`);if(node){const c=await window.html2canvas(node,{backgroundColor:'#141419',scale:2,logging:false});imgURI=c.toDataURL('image/png');}}
      if(!imgURI)return alert('Chart not ready. Try again.');
      const doc=new jsPDF('p','pt','a4');
      doc.setFontSize(18);doc.setTextColor(40,40,40);doc.text(title,40,45);
      doc.setFontSize(10);doc.setTextColor(120,120,120);doc.text(`Generated: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`,40,62);
      doc.setFillColor(20,20,25);doc.rect(40,80,515,230,'F');doc.addImage(imgURI,'PNG',40,80,515,230);
      autoTable(doc,{startY:330,head:[headers],body:rows,theme:'striped',headStyles:{fillColor:[168,85,247],textColor:255,fontSize:10,fontStyle:'bold'},bodyStyles:{fontSize:9,textColor:50},alternateRowStyles:{fillColor:[245,245,245]},margin:{left:40,right:40}});
      doc.save(`${title.replace(/\s+/g,'_')}_Report.pdf`);
    } catch(err){console.error(err);}
  };

  const { utilPct, totalHrs, billPct } = empData;
  const utilColor = utilPct > 100 ? 'var(--accent-red)' : utilPct > 75 ? 'var(--accent-green)' : 'var(--accent-yellow)';

  return (
    <div>
      <style>{`.apexcharts-svg,.apexcharts-canvas{background:transparent!important}`}</style>

      {/* Selector */}
      <div className={styles.empSelectorRibbon}>
        <div className={styles.empSelectWrap}>
          <i className='bx bx-search' style={{fontSize:'1.2rem',color:'var(--text-muted)'}} />
          <select className={styles.empSelect} value={selectedEmpName} onChange={e=>setSelectedEmpName(e.target.value)}>
            {sortedRoster.map(e=><option key={e.name} value={e.name}>{e.name}{e.status!=='Enabled'?' (Disabled)':''}</option>)}
          </select>
        </div>
        <span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>
          <i className='bx bx-info-circle' /> Select an engineer for a deep-dive diagnostic profile.
        </span>
      </div>

      {/* Identity Banner */}
      <div className={styles.identityBanner}>
        <div className={styles.identityAvatar}>{empData.emp.name.charAt(0)}</div>
        <div className={styles.identityDetails}>
          <h2>{empData.emp.name}</h2>
          <div className={styles.identityTags}>
            <span className={`${styles.iTag} ${empData.emp.status==='Enabled'?styles.tagActive:styles.tagNoComp}`}>{empData.emp.status}</span>
            {empData.emp.status==='Enabled' && empData.compRecord && (
              <span className={`${styles.iTag} ${empData.compRecord.isCompliant?styles.tagComp:styles.tagNoComp}`}>
                {empData.compRecord.isCompliant?'Timesheet Compliant':'Deficit Warning'}
              </span>
            )}
            <span style={{color:'var(--text-muted)',fontSize:'0.8rem',marginLeft:'10px'}}>
              Joined: {new Date(empData.emp.start).toLocaleDateString('en-US',{month:'short',year:'numeric'})}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>All-Time Utilization</p><h3 style={{color:utilColor}}>{utilPct}%</h3></div></div>
        <div className="kpi-card"><div><p>Total Capacity (Since Hire)</p><h3>{fmtInt(empData.capacity)}h</h3></div></div>
        <div className="kpi-card"><div><p>Total Hours Logged</p><h3>{fmtInt(totalHrs)}</h3></div></div>
        <div className="kpi-card"><div><p>Revenue Generating</p><h3 style={{color:'var(--accent-green)'}}>{billPct}%</h3></div></div>
        <div className="kpi-card"><div><p>Projects Touched</p><h3>{empData.activeProjCount}</h3></div></div>
        <div className="kpi-card"><div><p>Monthly Average</p><h3>{empData.avg}h</h3></div></div>
      </div>

      {/* Row 1: Utilization Trend · Client Dependency */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <h4 style={{margin:0}}><i className='bx bx-trending-up' style={{color:'var(--accent-blue)'}} /> Historical Utilization Trend</h4>
            <PdfButton onClick={()=>exportChartToPDF('empTrendChart',`${empData.emp.name} - Burn Trend`,['Month','Capacity','Actual'],empData.trend.labels.map((l,i)=>[l,empData.trend.cap[i],empData.trend.act[i]]))} />
          </div>
          <div id="wrap-empTrendChart">
            <ErrorBoundary name="Utilization Trend">
              <Chart type="line" width="100%" height={300}
                series={[{name:'Capacity',type:'line',data:empData.trend.cap},{name:'Hours Logged',type:'area',data:empData.trend.act}]}
                options={getOpts('empTrendChart',{
                  colors:['#a1a1aa','#3b82f6'], stroke:{curve:'smooth',width:[3,2]},
                  fill:{type:['solid','gradient'],gradient:{shadeIntensity:1,opacityFrom:0.45,opacityTo:0,stops:[0,100]}},
                  xaxis:{categories:empData.trend.labels,labels:{style:{colors:CHART_COLORS.muted}},axisBorder:{show:false},axisTicks:{show:false}},
                  yaxis:{labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                  annotations:{yaxis:[{y:empData.capacity/12,strokeDashArray:4,borderColor:'rgba(255,214,10,0.4)',label:{text:'Avg Capacity',style:{color:'#ffd60a',background:'transparent',fontSize:'11px'}}}]},
                  legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
                })} />
            </ErrorBoundary>
          </div>
        </div>

        <div className="chart-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <h4 style={{margin:0}}><i className='bx bx-briefcase' style={{color:'var(--accent-primary)'}} /> Client Portfolio Dependency</h4>
            <PdfButton onClick={()=>exportChartToPDF('empClientChart',`${empData.emp.name} - Clients`,['Client','Hours'],empData.clients.labels.map((l,i)=>[l,empData.clients.series[i]]))} />
          </div>
          <div id="wrap-empClientChart">
            <ErrorBoundary name="Client Dependency">
              <Chart type="donut" width="100%" height={300}
                series={empData.clients.series}
                options={getOpts('empClientChart',{
                  labels:empData.clients.labels, colors:CHART_PALETTE,
                  stroke:{width:0}, plotOptions:{pie:{donut:{size:'72%',labels:{show:true,total:{show:true,label:'Total hrs',formatter:()=>fmtInt(totalHrs)}}}}},
                  dataLabels:{enabled:false}, legend:{position:'bottom',labels:{colors:CHART_COLORS.muted}},
                })} />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Row 2: Velocity Burnup · Time Entry Patterns */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <h4 style={{margin:0}}><i className='bx bx-rocket' style={{color:'var(--accent-green)'}} /> Velocity Burnup</h4>
          </div>
          <ErrorBoundary name="Velocity Burnup">
            <Chart type="line" width="100%" height={280}
              series={[{name:'Cumulative Hours',type:'area',data:empData.velocity.cumulative},{name:'Weekly Hours',type:'bar',data:empData.velocity.weekly}]}
              options={getOpts('empVelocityChart',{
                chart:{id:'empVelocityChart',toolbar:{show:false}},
                colors:['#30d158','rgba(48,209,88,0.3)'],
                stroke:{curve:'smooth',width:[3,0]},
                fill:{type:['gradient','solid'],gradient:{shadeIntensity:1,opacityFrom:0.3,opacityTo:0.0,stops:[0,100]}},
                xaxis:{categories:empData.velocity.labels,labels:{show:false},axisBorder:{show:false}},
                yaxis:{labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
                plotOptions:{bar:{borderRadius:3}},
              })} />
          </ErrorBoundary>
        </div>

        <div className="chart-card">
          <h4 style={{marginBottom:'16px'}}><i className='bx bx-calendar-week' style={{color:'var(--accent-yellow)'}} /> Time Entry Patterns (by Day)</h4>
          <ErrorBoundary name="Time Patterns">
            <Chart type="bar" width="100%" height={280}
              series={[{name:'Avg Hours',data:empData.timePatterns.data}]}
              options={getOpts('empDowChart',{
                chart:{id:'empDowChart',toolbar:{show:false}},
                colors:CHART_PALETTE,
                plotOptions:{bar:{borderRadius:8,distributed:true,columnWidth:'55%'}},
                dataLabels:{enabled:true,formatter:v=>fmtInt(v)+'h',style:{fontSize:'12px',fontWeight:700,colors:['#fff']}},
                xaxis:{categories:empData.timePatterns.labels,labels:{style:{colors:CHART_COLORS.muted,fontSize:'13px'}}},
                yaxis:{labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                legend:{show:false},
              })} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Row 3: Skill Radar · Top Projects */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <h4 style={{margin:0}}><i className='bx bx-radar' style={{color:'var(--accent-primary)'}} /> Skill & Program Matrix</h4>
            <PdfButton onClick={()=>exportChartToPDF('empRadarChart',`${empData.emp.name} - Skill Matrix`,['Program','Hours'],empData.radar.labels.map((l,i)=>[l,empData.radar.series[i]]))} />
          </div>
          <div id="wrap-empRadarChart">
            <ErrorBoundary name="Skill Radar">
              <Chart type="radar" width="100%" height={320}
                series={[{name:'Hours',data:empData.radar.series}]}
                options={getOpts('empRadarChart',{
                  labels:empData.radar.labels, colors:['#8b5cf6'], stroke:{width:2}, fill:{opacity:0.2},
                  plotOptions:{radar:{size:120,polygons:{strokeColors:'rgba(255,255,255,0.05)',connectorColors:'rgba(255,255,255,0.05)'}}},
                  markers:{size:4,colors:['#fff'],strokeColors:'#8b5cf6',strokeWidth:2},
                  yaxis:{show:false}, xaxis:{labels:{style:{colors:CHART_COLORS.muted,fontSize:'11px',fontWeight:600}}},
                })} />
            </ErrorBoundary>
          </div>
        </div>

        <div className="chart-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <h4 style={{margin:0}}><i className='bx bx-pie-chart-alt-2' style={{color:'var(--accent-coral)'}} /> Top Project Effort</h4>
            <PdfButton onClick={()=>exportChartToPDF('empTopProjectsChart',`${empData.emp.name} - Top Projects`,['Project','Hours'],empData.projects.labels.map((l,i)=>[l,empData.projects.series[i]]))} />
          </div>
          <div id="wrap-empTopProjectsChart">
            <ErrorBoundary name="Top Projects">
              <Chart type="bar" width="100%" height={320}
                series={[{name:'Hours',data:empData.projects.series}]}
                options={getOpts('empTopProjectsChart',{
                  colors:['#f43f5e'], plotOptions:{bar:{horizontal:true,borderRadius:4,barHeight:'50%'}},
                  dataLabels:{enabled:true,textAnchor:'start',style:{colors:['#fff'],fontSize:'11px'},formatter:v=>fmtInt(v)+'h'},
                  xaxis:{categories:empData.projects.labels,labels:{style:{colors:CHART_COLORS.muted}},axisBorder:{show:false},axisTicks:{show:false}},
                  yaxis:{labels:{style:{colors:CHART_COLORS.muted},maxWidth:180}}, grid:{show:false},
                })} />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Row 4: Employee Cohort Analysis (full-width) */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-group' style={{color:'var(--accent-blue)'}} /> Team Cohort Analysis (Hire Year)</h4>
          <ErrorBoundary name="Cohort Analysis">
            <Chart type="bar" width="100%" height={280}
              series={[{name:'Active',data:empData.cohort.active},{name:'Inactive',data:empData.cohort.inactive}]}
              options={getOpts('empCohortChart',{
                chart:{id:'empCohortChart',stacked:true,toolbar:{show:false}},
                colors:['#30d158','#ff3b30'],
                plotOptions:{bar:{borderRadius:4,columnWidth:'45%'}},
                dataLabels:{enabled:false},
                xaxis:{categories:empData.cohort.years,labels:{style:{colors:CHART_COLORS.muted}}},
                yaxis:{labels:{formatter:v=>Math.round(v),style:{colors:CHART_COLORS.muted}}},
                legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
                tooltip:{theme:'dark',y:{formatter:v=>`${v} engineer${v!==1?'s':''}`}},
              })} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Detailed Project Table */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-list-ul' /> Detailed Project Portfolio</h4>
          <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'420px',paddingRight:'8px'}}>
            <table className={styles.premiumTable} style={{minWidth:'900px'}}>
              <thead style={{position:'sticky',top:0,zIndex:10,background:'var(--bg-card)'}}>
                <tr><th>Project Name</th><th>Client</th><th>Role / Program</th><th>Hours Contributed</th><th>Total Proj. Budget</th></tr>
              </thead>
              <tbody>
                {Object.keys(empData.tableMap).length===0 ? (
                  <tr><td colSpan="5"><EmptyState preset="noData" title="No projects logged" style={{padding:'32px'}} /></td></tr>
                ) : (
                  Object.keys(empData.tableMap).sort((a,b)=>empData.tableMap[b]-empData.tableMap[a]).map(pName => {
                    const pData = dataMatrix.dimensionTable[pName]||{client:'-',program:'-',est:0};
                    return (
                      <tr key={pName}>
                        <td style={{color:'#fff',fontWeight:500}}>{pName}</td>
                        <td>{pData.client}</td>
                        <td><span className={styles.iTag} style={{background:'rgba(255,255,255,0.05)',border:'1px solid var(--border-color)',color:'var(--text-muted)'}}>{pData.program}</span></td>
                        <td style={{color:'var(--accent-blue)',fontWeight:600}}>{fmtInt(empData.tableMap[pName])} hrs</td>
                        <td>{fmtInt(pData.est)} hrs</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
