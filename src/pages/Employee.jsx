import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import styles from './Employee.module.css';

export default function Employee({ dataMatrix, sessionUser }) {
  // =========================================================================
  // 1. ROSTER SORTING & STATE INITIALIZATION
  // =========================================================================
  const sortedRoster = useMemo(() => {
    if (!dataMatrix || !dataMatrix.roster) return [];
    return [...dataMatrix.roster].sort((a, b) => {
      if (a.status === "Enabled" && b.status !== "Enabled") return -1;
      if (a.status !== "Enabled" && b.status === "Enabled") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [dataMatrix]);

  const [selectedEmpName, setSelectedEmpName] = useState('');

  // Auto-select the logged-in user if they exist in the roster, otherwise select the first person
  useEffect(() => {
    if (sortedRoster.length > 0 && !selectedEmpName) {
      const match = sortedRoster.find(e => sessionUser && e.name.toLowerCase().includes(sessionUser.name.toLowerCase()));
      setSelectedEmpName(match ? match.name : sortedRoster[0].name);
    }
  }, [sortedRoster, sessionUser, selectedEmpName]);

  // =========================================================================
  // 2. HELPER FUNCTIONS
  // =========================================================================
  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
  const chartDefaults = { background: 'transparent', foreColor: '#a1a1aa', toolbar: { show: false } };

  const getWorkingDays = (startDate, endDate) => {
    let days = 0;
    let cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    let end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, days);
  };

  // =========================================================================
  // 3. CORE ANALYTICS ENGINE (Runs only when the selected employee changes)
  // =========================================================================
  const empData = useMemo(() => {
    if (!selectedEmpName || !dataMatrix || !dataMatrix.factTable) return null;

    const emp = sortedRoster.find(e => e.name === selectedEmpName);
    if (!emp) return null;

    const myFacts = dataMatrix.factTable.filter(r => r.user === selectedEmpName && r.act > 0);
    let totalHrs = 0, billable = 0, overhead = 0;
    let projMap = {}, progMap = {}, trendMap = {};

    // Map all timesheets for this specific employee
    myFacts.forEach(r => {
      totalHrs += r.act;
      if ((r.program || "").toLowerCase().includes("internal")) overhead += r.act; 
      else billable += r.act;
      
      if (r.project !== "Unknown") projMap[r.project] = (projMap[r.project] || 0) + r.act;
      if (r.program !== "Unknown" && r.program !== "Unassigned") progMap[r.program] = (progMap[r.program] || 0) + r.act;
      
      if (r.date > 0) {
        let d = new Date(r.date);
        let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        trendMap[key] = (trendMap[key] || 0) + r.act;
      }
    });

    // Capacity & Utilization Math
    let nowTs = new Date().getTime();
    let effectiveEnd = Math.min(nowTs, emp.end || nowTs);
    let potentialDays = getWorkingDays(emp.start, effectiveEnd);
    let capacity = potentialDays * 8;
    let utilPct = capacity > 0 ? Math.round((totalHrs / capacity) * 100) : 0;

    // Active Projects Count
    let activeProjCount = 0;
    Object.keys(projMap).forEach(pName => {
      let pData = dataMatrix.dimensionTable[pName];
      if (pData && pData.status !== "Completed" && pData.status !== "Archived") activeProjCount++;
    });

    let monthsActive = Object.keys(trendMap).length || 1;

    // Trend Chart Mapping
    let tLabels = Object.keys(trendMap).sort();
    let tData = tLabels.map(k => Math.round(trendMap[k]));
    let tCapData = tLabels.map(k => {
      let [y, m] = k.split('-');
      let mStart = new Date(y, parseInt(m) - 1, 1).getTime();
      let mEnd = new Date(y, parseInt(m), 0).getTime();
      let overlapStart = Math.max(mStart, emp.start);
      let overlapEnd = Math.min(mEnd, emp.end || nowTs);
      return (overlapStart <= overlapEnd) ? getWorkingDays(overlapStart, overlapEnd) * 8 : 0;
    });
    let niceLabels = tLabels.map(k => {
      let [y, m] = k.split('-');
      return new Date(y, parseInt(m) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    // Program/Radar Mapping
    let pKeys = Object.keys(progMap).sort((a, b) => progMap[b] - progMap[a]).slice(0, 8);
    let pVals = pKeys.map(k => Math.round(progMap[k]));

    // Project Bar Mapping
    let projKeys = Object.keys(projMap).sort((a, b) => projMap[b] - projMap[a]).slice(0, 10);
    let projVals = projKeys.map(k => Math.round(projMap[k]));

    // Compliance
    let compRecord = dataMatrix.compliance?.dailyList?.find(c => c.name === emp.name);

    return {
      emp, utilPct, totalHrs, activeProjCount, avg: Math.round(totalHrs / monthsActive),
      billable: Math.round(billable), overhead: Math.round(overhead),
      trend: { labels: niceLabels, act: tData, cap: tCapData },
      radar: { labels: pKeys.length ? pKeys : ['No Data'], series: pVals.length ? pVals : [0] },
      projects: { labels: projKeys.length ? projKeys : ['No Data'], series: projVals.length ? projVals : [0] },
      tableMap: projMap, compRecord
    };
  }, [selectedEmpName, dataMatrix, sortedRoster]);

  if (!empData) return null; // Wait for initial load

  // =========================================================================
  // 4. UI RENDER
  // =========================================================================
  return (
    <div>
      {/* Employee Selector Ribbon */}
      <div className={styles.empSelectorRibbon}>
        <div className={styles.empSelectWrap}>
          <i className='bx bx-search' style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}></i>
          <select className={styles.empSelect} value={selectedEmpName} onChange={(e) => setSelectedEmpName(e.target.value)}>
            {sortedRoster.map(e => (
              <option key={e.name} value={e.name}>
                {e.name} {e.status !== 'Enabled' ? '(Disabled)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <i className='bx bx-info-circle'></i> Select an engineer to generate a deep-dive diagnostic profile.
        </div>
      </div>

      {/* Identity Banner */}
      <div className={styles.identityBanner}>
        <div className={styles.identityAvatar}>{empData.emp.name.charAt(0)}</div>
        <div className={styles.identityDetails}>
          <h2>{empData.emp.name}</h2>
          <div className={styles.identityTags}>
            <span className={`${styles.iTag} ${empData.emp.status === 'Enabled' ? styles.tagActive : styles.tagNoComp}`}>
              {empData.emp.status}
            </span>
            {empData.emp.status === 'Enabled' && empData.compRecord && (
              <span className={`${styles.iTag} ${empData.compRecord.isCompliant ? styles.tagComp : styles.tagNoComp}`}>
                {empData.compRecord.isCompliant ? "Timesheet Compliant" : "Deficit Warning"}
              </span>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '10px' }}>
              Joined: {new Date(empData.emp.start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>All-Time Utilization</p><h3 style={{ color: 'var(--accent-yellow)' }}>{empData.utilPct}%</h3></div></div>
        <div className="kpi-card"><div><p>Total Hours Logged</p><h3>{fmtInt(empData.totalHrs)}</h3></div></div>
        <div className="kpi-card"><div><p>Projects Touched</p><h3>{empData.activeProjCount}</h3></div></div>
        <div className="kpi-card"><div><p>Monthly Average</p><h3>{empData.avg}h</h3></div></div>
      </div>

      {/* Chart Row 1 */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-trending-up' style={{ color: 'var(--accent-blue)' }}></i> Historical Utilization Trend</h4>
          <div className={styles.chartWrapper}>
            <Chart type="line" width="100%" height={320}
              series={[ { name: 'Capacity Baseline', type: 'line', data: empData.trend.cap }, { name: 'Hours Logged', type: 'area', data: empData.trend.act } ]}
              options={{ ...chartDefaults, colors: ['#a1a1aa', '#3b82f6'], stroke: { curve: 'smooth', width: [3, 2] },
                fill: { type: ['solid', 'gradient'], gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.0, stops: [0, 100] } },
                xaxis: { categories: empData.trend.labels, labels: { style: { colors: '#a1a1aa' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { formatter: (v) => fmtInt(v), style: { colors: '#a1a1aa' } } },
                grid: { borderColor: '#27272a', strokeDashArray: 4 }, legend: { position: 'top', labels: { colors: '#a1a1aa' } }, tooltip: { theme: 'dark' }
              }} />
          </div>
        </div>
        <div className="chart-card">
          <h4><i className='bx bx-radar' style={{ color: 'var(--accent-purple)' }}></i> Skill & Program Matrix</h4>
          <div className={styles.chartWrapper}>
            <Chart type="radar" width="100%" height={350}
              series={[{ name: 'Hours', data: empData.radar.series }]}
              options={{ ...chartDefaults, labels: empData.radar.labels, colors: ['#8b5cf6'], stroke: { width: 2 }, fill: { opacity: 0.2 },
                plotOptions: { radar: { size: 125, polygons: { strokeColors: '#27272a', connectorColors: '#27272a' } } },
                markers: { size: 4, colors: ['#fff'], strokeColors: '#8b5cf6', strokeWidth: 2 },
                yaxis: { show: false }, xaxis: { labels: { style: { colors: '#a1a1aa', fontSize: '11px', fontWeight: 600 } } }, tooltip: { theme: 'dark' }
              }} />
          </div>
        </div>
      </div>

      {/* Chart Row 2 */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-pie-chart-alt-2' style={{ color: 'var(--accent-coral)' }}></i> Effort Distribution (Top Projects)</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={320}
              series={[{ name: 'Hours', data: empData.projects.series }]}
              options={{ ...chartDefaults, colors: ['#f43f5e'], plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
                dataLabels: { enabled: true, textAnchor: 'start', style: { colors: ['#fff'] }, formatter: (val) => fmtInt(val) + "h", offsetX: 0 },
                xaxis: { categories: empData.projects.labels, labels: { style: { colors: '#a1a1aa' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 200 } }, grid: { show: false }, tooltip: { theme: 'dark' }
              }} />
          </div>
        </div>
        <div className="chart-card">
          <h4><i className='bx bx-doughnut-chart' style={{ color: 'var(--accent-green)' }}></i> Billable vs Overhead Breakdown</h4>
          <div className={styles.chartWrapper}>
            <Chart type="donut" width="100%" height={320}
              series={[empData.billable, empData.overhead]}
              options={{ ...chartDefaults, labels: ['Billable', 'Overhead'], colors: ['#10b981', 'rgba(255,255,255,0.1)'], stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '75%' } } }, dataLabels: { enabled: false }, legend: { position: 'bottom', labels: { colors: '#a1a1aa' } }, tooltip: { theme: 'dark' }
              }} />
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-list-ul' style={{ color: 'var(--text-main)' }}></i> Detailed Project Portfolio</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.premiumTable}>
              <thead>
                <tr><th>Project Name</th><th>Client</th><th>Role / Program</th><th>Hours Contributed</th><th>Total Proj. Budget</th></tr>
              </thead>
              <tbody>
                {Object.keys(empData.tableMap).length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects logged.</td></tr>
                ) : (
                  Object.keys(empData.tableMap).sort((a, b) => empData.tableMap[b] - empData.tableMap[a]).map(pName => {
                    let pData = dataMatrix.dimensionTable[pName] || { client: '-', program: '-', est: 0 };
                    return (
                      <tr key={pName}>
                        <td style={{ color: '#fff', fontWeight: 500 }}>{pName}</td>
                        <td>{pData.client}</td>
                        <td><span className={styles.iTag} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>{pData.program}</span></td>
                        <td style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{fmtInt(empData.tableMap[pName])} hrs</td>
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