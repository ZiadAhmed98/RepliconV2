import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import styles from './ProjectDeepDive.module.css';

export default function ProjectDeepDive({ dataMatrix }) {
  // =========================================================================
  // 1. DATA INITIALIZATION & DROPDOWN STATE
  // =========================================================================
  const validProjects = useMemo(() => {
    if (!dataMatrix || !dataMatrix.dimensionTable) return [];
    // Only grab projects that are NOT archived, sorted alphabetically
    return Object.keys(dataMatrix.dimensionTable)
      .filter(k => dataMatrix.dimensionTable[k].status !== "Archived")
      .sort();
  }, [dataMatrix]);

  const [selectedProject, setSelectedProject] = useState('');

  // Auto-select the first available project on initial load
  useEffect(() => {
    if (validProjects.length > 0 && !selectedProject) {
      setSelectedProject(validProjects[0]);
    }
  }, [validProjects, selectedProject]);

  // =========================================================================
  // 2. HELPER FUNCTIONS
  // =========================================================================
  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
  const chartDefaults = { background: 'transparent', foreColor: '#a1a1aa', toolbar: { show: false } };

  // =========================================================================
  // 3. CORE ANALYTICS ENGINE (Runs only when selected project changes)
  // =========================================================================
  const pData = useMemo(() => {
    if (!selectedProject || !dataMatrix) return null;

    const dimData = dataMatrix.dimensionTable[selectedProject];
    if (!dimData) return null;

    // Filter fact table for this specific project
    const pFacts = dataMatrix.factTable.filter(r => r.project === selectedProject && r.act > 0);
    const actualHrs = pFacts.reduce((sum, r) => sum + r.act, 0);

    // Resource Allocation (Team Map)
    let teamMap = {};
    pFacts.forEach(r => { teamMap[r.user] = (teamMap[r.user] || 0) + r.act; });
    const teamCount = Object.keys(teamMap).length;

    // Variance Math: ((Est - Actual) / Est) * 100
    const variance = dimData.est > 0 ? ((dimData.est - actualHrs) / dimData.est) * 100 : 0;

    // Burn-Down Timeline (Cumulative area chart)
    let tMap = {};
    pFacts.forEach(r => { tMap[r.dateStr] = (tMap[r.dateStr] || 0) + r.act; });
    let dates = Object.keys(tMap).sort();
    
    let cumulative = [];
    let sum = 0;
    dates.forEach(d => {
      sum += tMap[d];
      cumulative.push(Math.round(sum)); // Rounding to keep chart clean
    });

    // Resource Bar Chart (Top 10 Contributors)
    let teamKeys = Object.keys(teamMap).sort((a, b) => teamMap[b] - teamMap[a]).slice(0, 10);
    let teamVals = teamKeys.map(k => Math.round(teamMap[k]));

    // Profitability Scatter (Compare against ALL projects in the same program)
    let scatterData = [];
    Object.keys(dataMatrix.dimensionTable).forEach(k => {
      let d = dataMatrix.dimensionTable[k];
      // Only plot projects in the same program that actually have an estimated budget
      if (d.program === dimData.program && d.est > 0) {
        let acts = dataMatrix.factTable.filter(r => r.project === k).reduce((s, r) => s + r.act, 0);
        scatterData.push({ x: Math.round(d.est), y: Math.round(acts), name: k });
      }
    });

    return {
      name: selectedProject,
      client: dimData.client,
      status: dimData.status,
      program: dimData.program,
      start: dimData.start,
      end: dimData.end,
      est: dimData.est,
      actualHrs: Math.round(actualHrs),
      variance,
      teamCount,
      burn: { dates, cumulative },
      team: { labels: teamKeys.length ? teamKeys : ['No Data'], series: teamVals.length ? teamVals : [0] },
      scatter: scatterData
    };
  }, [selectedProject, dataMatrix]);

  if (!pData) return null; // Wait for initial render to grab the first project

  // =========================================================================
  // 4. UI RENDER
  // =========================================================================
  return (
    <div>
      {/* Selector Ribbon */}
      <div className={styles.selectorRibbon}>
        <div className={styles.selectWrap}>
          <i className='bx bx-search' style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}></i>
          <select className={styles.selectControl} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            {validProjects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Identity Banner */}
      <div className={styles.identityBanner}>
        <div className={styles.identityAvatar}><i className='bx bx-folder-open'></i></div>
        <div className={styles.identityDetails}>
          <h2>{pData.name}</h2>
          <div className={styles.tagGroup}>
            <span className={`${styles.iTag} ${styles.tagClient}`}>{pData.client}</span>
            <span className={`${styles.iTag} ${styles.tagStatus}`}>{pData.status}</span>
            <span className={styles.dateText}>
              Timeline: {pData.start > 0 ? `${new Date(pData.start).toLocaleDateString()} - ${new Date(pData.end).toLocaleDateString()}` : "Dates TBD"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Actual Hours</p><h3>{fmtInt(pData.actualHrs)}</h3></div></div>
        <div className="kpi-card"><div><p>Estimated Budget</p><h3>{fmtInt(pData.est)}</h3></div></div>
        <div className="kpi-card">
          <div>
            <p>Variance</p>
            <h3 style={{ color: pData.variance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {pData.variance > 0 ? '+' : ''}{Math.round(pData.variance)}%
            </h3>
          </div>
        </div>
        <div className="kpi-card"><div><p>Contributors</p><h3>{pData.teamCount}</h3></div></div>
      </div>

      {/* Top Charts */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-line-chart-down' style={{ color: 'var(--accent-blue)' }}></i> Burn-Down Timeline</h4>
          <div className={styles.chartWrapper}>
            <Chart type="line" width="100%" height={320}
              series={[{ name: 'Cumulative Actual Burn', type: 'area', data: pData.burn.cumulative }]}
              options={{ ...chartDefaults, colors: ['#3b82f6'], stroke: { curve: 'stepline', width: 3 },
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.0 } },
                xaxis: { categories: pData.burn.dates, labels: { show: false } },
                yaxis: { labels: { style: { colors: '#a1a1aa' } } }, tooltip: { theme: 'dark' }
              }} />
          </div>
        </div>
        <div className="chart-card">
          <h4><i className='bx bx-group' style={{ color: 'var(--accent-purple)' }}></i> Resource Allocation</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={320}
              series={[{ name: 'Hours', data: pData.team.series }]}
              options={{ ...chartDefaults, colors: ['#8b5cf6'], plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
                dataLabels: { enabled: true, textAnchor: 'start', style: { colors: ['#fff'] }, formatter: (v) => fmtInt(v) + "h" },
                xaxis: { categories: pData.team.labels, labels: { show: false } },
                yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 150 } }, tooltip: { theme: 'dark' }
              }} />
          </div>
        </div>
      </div>

      {/* Bottom Scatter Chart */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-scatter-chart' style={{ color: 'var(--accent-coral)' }}></i> Profitability Scatter ({pData.program} Benchmark)</h4>
          <p className={styles.scatterSubtitle}>
            Comparing this project against all other projects in the {pData.program} category. Above the diagonal line indicates overburn.
          </p>
          <div className={styles.chartWrapper}>
            <Chart type="scatter" width="100%" height={350}
              series={[{ name: pData.program, data: pData.scatter }]}
              options={{ ...chartDefaults, colors: ['#f43f5e'],
                xaxis: { title: { text: 'Estimated Hours', style: { color: '#a1a1aa' } }, labels: { style: { colors: '#a1a1aa' } } },
                yaxis: { title: { text: 'Actual Hours', style: { color: '#a1a1aa' } }, labels: { style: { colors: '#a1a1aa' } } },
                // Custom tooltip to show the specific project name embedded in the data object
                tooltip: {
                  theme: 'dark',
                  custom: function({ seriesIndex, dataPointIndex, w }) {
                    const data = w.config.series[seriesIndex].data[dataPointIndex];
                    return `<div style="padding:10px; background:var(--bg-card); border: 1px solid var(--border-color); border-radius:8px;">
                              <b style="color:var(--text-main);">${data.name}</b><br/>
                              <span style="color:var(--text-muted); font-size:0.85rem;">Est: ${data.x} | Act: ${data.y}</span>
                            </div>`;
                  }
                }
              }} />
          </div>
        </div>
      </div>

    </div>
  );
}