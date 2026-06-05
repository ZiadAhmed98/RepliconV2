import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Chart from 'react-apexcharts';
import styles from './ProjectDeepDive.module.css';
import ErrorBoundary from '../components/ErrorBoundary';
import EmptyState    from '../components/EmptyState';
import { baseChartOptions, fmtInt } from '../utils/chartTheme';
import { CHART_COLORS } from '../constants/index.js';

const getOpts = (id, custom={}) => baseChartOptions({
  chart: { id, background:'transparent', toolbar:{show:true}, ...(custom.chart||{}) },
  ...custom,
});

export default function ProjectDeepDive({ dataMatrix }) {
  const [searchParams] = useSearchParams();

  const validProjects = useMemo(() => {
    if (!dataMatrix?.dimensionTable) return [];
    return Object.keys(dataMatrix.dimensionTable).filter(k=>dataMatrix.dimensionTable[k].status!=='Archived').sort();
  }, [dataMatrix]);

  const [selectedProject, setSelectedProject] = useState('');

  // If GlobalSearch navigated here with ?project=, honour it immediately
  const urlProject = searchParams.get('project');
  useEffect(() => {
    if (!validProjects.length || !urlProject) return;
    const decoded = decodeURIComponent(urlProject);
    if (validProjects.includes(decoded)) setSelectedProject(decoded);
  }, [urlProject, validProjects]);

  // Default to first project when no URL param
  useEffect(() => {
    if (validProjects.length > 0 && !selectedProject && !urlProject) setSelectedProject(validProjects[0]);
  }, [validProjects, selectedProject, urlProject]);

  const pData = useMemo(() => {
    if (!selectedProject || !dataMatrix) return null;
    const dimData = dataMatrix.dimensionTable[selectedProject];
    if (!dimData) return null;

    const pFacts    = dataMatrix.factTable.filter(r=>r.project===selectedProject&&r.act>0);
    const actualHrs = pFacts.reduce((s,r)=>s+r.act,0);
    let teamMap = {};
    pFacts.forEach(r=>{teamMap[r.user]=(teamMap[r.user]||0)+r.act;});
    const teamCount = Object.keys(teamMap).length;
    const variance  = dimData.est > 0 ? ((dimData.est - actualHrs) / dimData.est) * 100 : 0;

    // Burn-Down: cumulative actual
    let tMap = {};
    pFacts.forEach(r=>{tMap[r.dateStr]=(tMap[r.dateStr]||0)+r.act;});
    const dates = Object.keys(tMap).sort();
    let cumulative=[]; let sum=0;
    dates.forEach(d=>{sum+=tMap[d];cumulative.push(Math.round(sum));});

    // Ideal burn-down line (linear from 0 to est at end date)
    const idealLine = dates.map((_,i)=>dimData.est > 0 ? Math.round((dimData.est/Math.max(1,dates.length-1))*i) : null);

    // Forecast completion (project current trend to est)
    const avgPerDay = actualHrs / Math.max(1, dates.length);
    const daysToComplete = dimData.est > actualHrs ? Math.round((dimData.est - actualHrs) / avgPerDay) : 0;
    const forecastDates  = [...dates];
    const forecastLine   = [...Array(dates.length).fill(null)];
    if (daysToComplete > 0 && daysToComplete < 365) {
      for (let i=1; i<=Math.min(daysToComplete,30); i++) {
        const d = new Date(dates[dates.length-1]);
        d.setDate(d.getDate()+i);
        forecastDates.push(d.toISOString().split('T')[0]);
        forecastLine.push(Math.round(actualHrs + avgPerDay * i));
        cumulative.push(null);
        idealLine.push(null);
      }
    }

    // Resource bar
    const teamKeys = Object.keys(teamMap).sort((a,b)=>teamMap[b]-teamMap[a]).slice(0,10);
    const teamVals = teamKeys.map(k=>Math.round(teamMap[k]));
    const teamPcts = teamVals.map(v=>Math.round((v/Math.max(1,actualHrs))*100));

    // Profitability scatter (program peers)
    let scatterData = [];
    Object.keys(dataMatrix.dimensionTable).forEach(k=>{
      const d=dataMatrix.dimensionTable[k];
      if(d.program===dimData.program && d.est>0){
        const acts=dataMatrix.factTable.filter(r=>r.project===k).reduce((s,r)=>s+r.act,0);
        scatterData.push({x:Math.round(d.est),y:Math.round(acts),name:k});
      }
    });

    // EVM — Earned Value Management
    const now     = Date.now();
    const elapsed = Math.max(1, dates.length); // days of project elapsed
    const totalDuration = dimData.end > dimData.start ? Math.ceil((dimData.end-dimData.start)/86400000) : elapsed;
    const pctElapsed = Math.min(1, elapsed / totalDuration);
    const PV = Math.round(dimData.est * pctElapsed);           // Planned Value
    const EV = Math.round(dimData.est * (1 - (variance/100))); // Earned Value (proxy)
    const AC = Math.round(actualHrs);                           // Actual Cost
    const SPI = PV > 0 ? (EV/PV).toFixed(2) : '–';
    const CPI = AC > 0 ? (EV/AC).toFixed(2) : '–';
    const EAC = CPI !== '–' ? Math.round(dimData.est / parseFloat(CPI)) : null;

    // EVM chart data (timeline)
    const evmLabels = dates.slice(-Math.min(30,dates.length));
    const pvArr=[]; const evArr=[]; const acArr=[];
    evmLabels.forEach((_,i)=>{
      const frac = (dates.indexOf(evmLabels[i])+1) / totalDuration;
      pvArr.push(Math.round(dimData.est * Math.min(1,frac)));
      acArr.push(Math.round(actualHrs*(dates.indexOf(evmLabels[i])+1)/Math.max(1,dates.length)));
      evArr.push(Math.round(PV*(dates.indexOf(evmLabels[i])+1)/Math.max(1,evmLabels.length)));
    });

    return {
      name:selectedProject, client:dimData.client, status:dimData.status, program:dimData.program,
      start:dimData.start, end:dimData.end, est:dimData.est,
      actualHrs:Math.round(actualHrs), variance, teamCount,
      burn: { dates:forecastDates, cumulative, idealLine, forecastLine },
      team: { labels:teamKeys.length?teamKeys:['No Data'], series:teamVals.length?teamVals:[0], pcts:teamPcts },
      scatter: scatterData,
      evm: { labels:evmLabels, pv:pvArr, ev:evArr, ac:acArr, SPI, CPI, EAC },
    };
  }, [selectedProject, dataMatrix]);

  if (!pData) return null;

  return (
    <div>
      <style>{`.apexcharts-svg,.apexcharts-canvas{background:transparent!important}`}</style>

      {/* Selector */}
      <div className={styles.selectorRibbon}>
        <div className={styles.selectWrap}>
          <i className='bx bx-search' style={{fontSize:'1.2rem',color:'var(--text-muted)'}} />
          <select className={styles.selectControl} value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}>
            {validProjects.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Identity Banner */}
      <div className={styles.identityBanner}>
        <div className={styles.identityAvatar}><i className='bx bx-folder-open' /></div>
        <div className={styles.identityDetails}>
          <h2>{pData.name}</h2>
          <div className={styles.tagGroup}>
            <span className={`${styles.iTag} ${styles.tagClient}`}>{pData.client}</span>
            <span className={`${styles.iTag} ${styles.tagStatus}`}>{pData.status}</span>
            <span className={styles.dateText}>
              {pData.start > 0 ? `${new Date(pData.start).toLocaleDateString()} — ${new Date(pData.end).toLocaleDateString()}` : 'Dates TBD'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Actual Hours</p><h3>{fmtInt(pData.actualHrs)}</h3></div></div>
        <div className="kpi-card"><div><p>Estimated Budget</p><h3>{fmtInt(pData.est)}</h3></div></div>
        <div className="kpi-card">
          <div><p>Variance</p>
            <h3 style={{color:pData.variance>=0?'var(--accent-green)':'var(--accent-red)'}}>
              {pData.variance>0?'+':''}{Math.round(pData.variance)}%
            </h3>
          </div>
        </div>
        <div className="kpi-card"><div><p>Contributors</p><h3>{pData.teamCount}</h3></div></div>
      </div>

      {/* EVM Metrics strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'24px'}}>
        {[
          {label:'SPI (Schedule Performance)', val:pData.evm.SPI, desc:'≥1.0 = on schedule', color: parseFloat(pData.evm.SPI)>=1?'var(--accent-green)':'var(--accent-yellow)'},
          {label:'CPI (Cost Performance)',      val:pData.evm.CPI, desc:'≥1.0 = under budget', color: parseFloat(pData.evm.CPI)>=1?'var(--accent-green)':'var(--accent-red)'},
          {label:'EAC (Estimate at Completion)',val:pData.evm.EAC?fmtInt(pData.evm.EAC)+' hrs':'–', desc:`vs planned ${fmtInt(pData.est)} hrs`, color:'var(--accent-blue)'},
        ].map((m,i)=>(
          <div key={i} className="chart-card" style={{padding:'20px',gap:'6px'}}>
            <p style={{margin:0,fontSize:'0.72rem',color:'var(--text-muted)',textTransform:'uppercase',fontWeight:600,letterSpacing:'0.05em'}}>{m.label}</p>
            <div style={{fontSize:'1.8rem',fontWeight:700,color:m.color,letterSpacing:'-0.03em'}}>{m.val}</div>
            <p style={{margin:0,fontSize:'0.72rem',color:'var(--text-muted)'}}>{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Burn-Down + Ideal + Forecast · EVM */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-line-chart-down' style={{color:'var(--accent-blue)'}} /> Burn-Down Timeline</h4>
          <ErrorBoundary name="Burndown">
            <Chart type="line" width="100%" height={320}
              series={[
                {name:'Actual Burn',   data:pData.burn.cumulative},
                {name:'Ideal Burnup',  data:pData.burn.idealLine},
                {name:'Forecast',      data:pData.burn.forecastLine},
              ]}
              options={getOpts('burndownChart',{
                colors:['#3b82f6','rgba(255,255,255,0.25)','#ffd60a'],
                stroke:{curve:['stepline','straight','straight'],width:[3,2,2],dashArray:[0,5,8]},
                fill:{type:['gradient','solid','solid'],gradient:{shadeIntensity:1,opacityFrom:0.35,opacityTo:0,stops:[0,100]}},
                xaxis:{categories:pData.burn.dates,labels:{show:false}},
                yaxis:{labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                annotations:{yaxis:[{y:pData.est,strokeDashArray:4,borderColor:'rgba(255,255,255,0.3)',label:{text:`Budget: ${fmtInt(pData.est)}h`,style:{color:'var(--text-muted)',background:'transparent',fontSize:'11px'}}}]},
                legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
                tooltip:{theme:'dark'},
              })} />
          </ErrorBoundary>
        </div>

        <div className="chart-card">
          <h4><i className='bx bx-line-chart' style={{color:'var(--accent-purple)'}} /> Earned Value Management</h4>
          <ErrorBoundary name="EVM Chart">
            <Chart type="line" width="100%" height={320}
              series={[{name:'PV (Planned)',data:pData.evm.pv},{name:'EV (Earned)',data:pData.evm.ev},{name:'AC (Actual)',data:pData.evm.ac}]}
              options={getOpts('evmChart',{
                colors:['#8e8e93','#30d158','#ff3b30'],
                stroke:{curve:'smooth',width:[2,2,2]},
                xaxis:{categories:pData.evm.labels,labels:{show:false}},
                yaxis:{labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
                tooltip:{theme:'dark',y:{formatter:v=>fmtInt(v)+' hrs'}},
              })} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Row 2: Resource Allocation */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-group' style={{color:'var(--accent-primary)'}} /> Resource Allocation</h4>
          <ErrorBoundary name="Resource Allocation">
            <Chart type="bar" width="100%" height={320}
              series={[{name:'Hours',data:pData.team.series}]}
              options={getOpts('resourceBarChart',{
                chart:{id:'resourceBarChart',toolbar:{show:false}},
                colors:['#8b5cf6'],
                plotOptions:{bar:{horizontal:true,borderRadius:4,barHeight:'55%'}},
                dataLabels:{enabled:true,textAnchor:'start',style:{colors:['#fff'],fontSize:'11px'},formatter:(_,opts)=>{const v=opts.w.config.series[0].data[opts.dataPointIndex]; return `${fmtInt(v)}h · ${pData.team.pcts[opts.dataPointIndex]}%`;}},
                xaxis:{categories:pData.team.labels,labels:{show:false}},
                yaxis:{labels:{style:{colors:CHART_COLORS.muted},maxWidth:150}},
                grid:{show:false}, tooltip:{theme:'dark'},
              })} />
          </ErrorBoundary>
        </div>

        {/* Profitability Scatter with quadrants */}
        <div className="chart-card">
          <h4><i className='bx bx-scatter-chart' style={{color:'var(--accent-coral)'}} /> Profitability Scatter — {pData.program}</h4>
          <p style={{margin:'-12px 0 12px',fontSize:'0.78rem',color:'var(--text-muted)'}}>
            Projects in the same program. Above the diagonal = overburn.
          </p>
          <ErrorBoundary name="Profitability Scatter">
            <Chart type="scatter" width="100%" height={280}
              series={[
                {name:'Peers',     data:pData.scatter.filter(d=>d.name!==pData.name)},
                {name:'This Project',data:pData.scatter.filter(d=>d.name===pData.name)},
              ]}
              options={getOpts('profitScatterChart',{
                chart:{id:'profitScatterChart',toolbar:{show:true}},
                colors:['rgba(168,85,247,0.6)','#ffd60a'],
                markers:{size:[6,10],strokeWidth:0},
                xaxis:{title:{text:'Estimated Hours',style:{color:CHART_COLORS.muted}},labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                yaxis:{title:{text:'Actual Hours',  style:{color:CHART_COLORS.muted}},labels:{formatter:fmtInt,style:{colors:CHART_COLORS.muted}}},
                tooltip:{theme:'dark',custom:({seriesIndex,dataPointIndex,w})=>{const d=w.config.series[seriesIndex].data[dataPointIndex];return `<div style="padding:10px;background:rgba(20,20,24,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:10px"><b style="color:#fff">${d.name}</b><br/><span style="color:#8e8e93;font-size:0.8rem">Est: ${fmtInt(d.x)}h · Act: ${fmtInt(d.y)}h</span></div>`;}},
                legend:{position:'top',labels:{colors:CHART_COLORS.muted}},
              })} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
