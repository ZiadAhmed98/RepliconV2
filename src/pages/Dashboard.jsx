import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import styles from './Dashboard.module.css';

export default function Dashboard({ dataMatrix }) {
  // =========================================================================
  // THE CALCULATION ENGINE
  // useMemo runs ONLY when dataMatrix changes. It prevents the app from 
  // recalculating thousands of rows every time you scroll or click.
  // =========================================================================
  const metrics = useMemo(() => {
    // 1. Initialize empty counters and arrays for our charts
    let tAct = 0, tEst = 0, tQuoted = 0;
    let activeStatus = 0, compStatus = 0;
    let billableHrs = 0, overheadHrs = 0;
    
    let overburnData = [];
    let atRiskData = [];
    let statusCounts = {};
    let empHoursMap = {};
    let locMap = {};

    // Safely extract tables from the dataMatrix (Fallback to empty arrays if null)
    const factTable = dataMatrix?.factTable || [];
    const dimensionTable = dataMatrix?.dimensionTable || {};
    const topClients = dataMatrix?.topClients || [];
    const compliance = dataMatrix?.compliance || { dailyDeficits: 0 };

    // 2. Loop through the Fact Table (Every single timesheet entry)
    factTable.forEach(row => {
      // Billable vs Overhead pie chart logic
      if ((row.program || "").toLowerCase().includes("internal")) overheadHrs += row.act;
      else billableHrs += row.act;

      // Track hours per employee for the "Top Employees" list
      if (row.user && row.user !== "Unknown") {
        empHoursMap[row.user] = (empHoursMap[row.user] || 0) + row.act;
      }

      // Track hours per location for the "Locations Overview" progress bars
      if (row.location && row.location !== "Unknown") {
        locMap[row.location] = (locMap[row.location] || 0) + row.act;
      }
    });

    // 3. Loop through the Dimension Table (Projects) for effort and status charts
    let projLabels = [], projAct = [], projEst = [], projQuoted = [];
    
    Object.keys(dimensionTable).forEach(pName => {
      const pData = dimensionTable[pName];
      // Sum all actual hours for this specific project
      const periodActual = factTable.filter(r => r.project === pName).reduce((s, r) => s + r.act, 0);
      
      // Add to our grand totals
      tAct += periodActual;
      tEst += pData.est;
      tQuoted += pData.quoted;

      // Feed data to the "Deep Project Delivery Analysis" (The huge stacked bar chart)
      projLabels.push(pName);
      projAct.push(Math.round(periodActual));
      projEst.push(Math.round(pData.est));
      projQuoted.push(Math.round(pData.quoted));

      // Calculate Statuses
      let statStr = (pData.status || "Unknown").toLowerCase();
      let isCompleted = statStr.includes('completed') || statStr.includes('archived');
      let isActive = statStr.includes('in progress') || statStr.includes('active');
      
      if (periodActual > 0 && !isCompleted) isActive = true; // Auto-active if hours exist
      if (isCompleted) compStatus++; else if (isActive) activeStatus++;

      // Feed the "Active Projects by Status" donut chart
      if (periodActual > 0 || pData.est > 0) {
        statusCounts[pData.status || "Unknown"] = (statusCounts[pData.status || "Unknown"] || 0) + 1;
      }

      // Feed the "At-Risk Projects" (Burn %) horizontal bar chart
      if (isActive && pData.est > 0 && (pData.program || "").toLowerCase().includes("deployment")) {
        atRiskData.push({ name: pName, burn: Math.round((periodActual / pData.est) * 100) });
      }

      // Feed the "Revenue Leakage (Overburn)" butterfly chart
      if (periodActual > pData.est && pData.est > 0) {
        overburnData.push({ name: pName, act: periodActual, est: pData.est, overburn: periodActual - pData.est });
      }
    });

    // 4. Sort and format the extracted arrays so they look perfect in the UI
    const sortedOverburn = overburnData.sort((a, b) => b.overburn - a.overburn).slice(0, 10);
    const maxBf = Math.ceil(Math.max(0, ...sortedOverburn.map(p => Math.max(p.act, p.est))) * 1.1) || 10;
    
    const topEmployees = Object.keys(empHoursMap)
      .map(e => ({ name: e, val: empHoursMap[e] }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 5); // Get top 5 only

    const sortedLocations = Object.keys(locMap)
      .map(l => ({ name: l, val: locMap[l] }))
      .sort((a, b) => b.val - a.val);

    const sortedAtRisk = atRiskData.sort((a, b) => b.burn - a.burn).slice(0, 5);

    // 5. Return everything as a neat object to the render layer below
    return {
      kpis: {
        totalProjects: Object.keys(dimensionTable).length,
        activeProjects: activeStatus,
        completedProjects: compStatus,
        actual: Math.round(tAct),
        estimated: Math.round(tEst),
        quoted: Math.round(tQuoted),
      },
      billable: Math.round(billableHrs),
      overhead: Math.round(overheadHrs),
      overburn: sortedOverburn,
      bfMax: maxBf,
      topClients,
      topEmployees,
      locations: sortedLocations,
      atRisk: sortedAtRisk,
      statusLabels: Object.keys(statusCounts),
      statusData: Object.values(statusCounts),
      deepEffort: { labels: projLabels, act: projAct, est: projEst, quoted: projQuoted },
      dailyDeficits: compliance.dailyDeficits || 0
    };
  }, [dataMatrix]);

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================
  // Formats numbers with commas (e.g. 1000 -> 1,000)
  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
  
  // Standardizes the look of all charts so we don't have to repeat this code
  const chartDefaults = { background: 'transparent', foreColor: '#a1a1aa', toolbar: { show: false } };

  // =========================================================================
  // RENDER UI
  // =========================================================================
  return (
    <div>
      {/* --- HEADER --- */}
      <div className={styles.sectionHeader}>
        <div className={styles.titleArea}>
          <h2 className={styles.sectionTitle}>Analytics Overview</h2>
          <div className="badges-container">
            <span className="badge-base period-badge">All Time</span>
          </div>
        </div>
      </div>

      {/* --- ROW 1: KPI CARDS --- */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Active Clients</p><h3>{metrics.topClients.length}</h3></div><div className="trend"><i className='bx bx-briefcase'></i> <span>Portfolio</span></div></div>
        <div className="kpi-card"><div><p>Total Projects</p><h3>{metrics.kpis.totalProjects}</h3></div><div className="trend"><i className='bx bx-folder'></i> <span>Baseline</span></div></div>
        <div className="kpi-card"><div><p>In Progress</p><h3 style={{ color: 'var(--accent-blue)' }}>{metrics.kpis.activeProjects}</h3></div><div className="trend"><i className='bx bx-pulse'></i> <span>Current</span></div></div>
        <div className="kpi-card"><div><p>Completed</p><h3 style={{ color: 'var(--accent-green)' }}>{metrics.kpis.completedProjects}</h3></div><div className="trend"><i className='bx bx-check-circle'></i> <span>Current</span></div></div>
        <div className="kpi-card"><div><p>Actual Hours</p><h3>{fmtInt(metrics.kpis.actual)}</h3></div><div className="trend"><i className='bx bx-time'></i> <span>Period Effort</span></div></div>
        <div className="kpi-card"><div><p>Estimated Hours</p><h3>{fmtInt(metrics.kpis.estimated)}</h3></div><div className="trend"><i className='bx bx-target-lock'></i> <span>Baseline</span></div></div>
        <div className="kpi-card"><div><p>Quoted Value</p><h3>{fmtInt(metrics.kpis.quoted)}</h3></div><div className="trend"><i className='bx bx-file'></i> <span>Contracted</span></div></div>
        <div className="kpi-card" style={{ cursor: 'pointer', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
          <div><p>Daily Deficits</p><h3 style={{ color: 'var(--accent-coral)' }}>{metrics.dailyDeficits}</h3></div>
        </div>
      </div>

      {/* --- ROW 2: TOP CLIENTS & EMPLOYEES --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <h4><i className='bx bx-bar-chart-alt-2' style={{ color: 'var(--accent-green)' }}></i> All-Time Top Clients</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={320}
              series={[{ name: 'Hours', data: metrics.topClients.map(c => Math.round(c.val)) }]}
              options={{ ...chartDefaults, colors: ['#10b981'],
                plotOptions: { bar: { horizontal: false, borderRadius: 4, distributed: true, columnWidth: '40%' } },
                dataLabels: { enabled: false },
                xaxis: { categories: metrics.topClients.map(c => c.name), labels: { style: { colors: '#a1a1aa' }, rotate: -45, trim: true } },
                grid: { borderColor: '#27272a', strokeDashArray: 4 }, legend: { show: false }
              }}
            />
          </div>
        </div>

        <div className="chart-card">
          <h4><i className='bx bx-trophy' style={{ color: 'var(--accent-yellow)' }}></i> Top Employees</h4>
          <div className={styles.chartWrapper}>
            <ul className={styles.insightList}>
              {metrics.topEmployees.map((emp, idx) => (
                <li key={idx} className={styles.insightItem}>
                  <div className={styles.insightInfo}>
                    <div className={styles.insightRank}>{idx + 1}</div>
                    <span className={styles.insightName}>{emp.name}</span>
                  </div>
                  <span className={styles.insightVal}>{fmtInt(emp.val)} hrs</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* --- ROW 3: BILLABLE & OVERBURN --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <h4><i className='bx bx-error-circle' style={{ color: 'var(--accent-red)' }}></i> Revenue Leakage (Overburn)</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={320}
              series={[ { name: 'Estimated Budget', data: metrics.overburn.map(p => -p.est) }, { name: 'Actual Burn', data: metrics.overburn.map(p => p.act) } ]} 
              options={{ ...chartDefaults, chart: { stacked: true }, colors: ['#a1a1aa', '#ef4444'],
                plotOptions: { bar: { horizontal: true, borderRadius: 0 } },
                xaxis: { categories: metrics.overburn.map(p => p.name), min: -metrics.bfMax, max: metrics.bfMax, labels: { style: { colors: '#a1a1aa' }, formatter: (v) => Math.abs(Math.round(v)) } },
                yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 150 } },
                grid: { borderColor: '#27272a', strokeDashArray: 4 }, dataLabels: { enabled: true, formatter: (v) => Math.abs(Math.round(v)) + "h" },
                tooltip: { theme: 'dark', y: { formatter: (v) => Math.abs(Math.round(v)) + " hrs" } }, legend: { position: 'top', labels: { colors: '#a1a1aa' } }
              }} 
            />
          </div>
        </div>

        <div className="chart-card">
          <h4><i className='bx bx-doughnut-chart' style={{ color: 'var(--accent-blue)' }}></i> Billable vs Non-Billable</h4>
          <div className={styles.chartWrapper}>
            <Chart type="donut" width="100%" height={320}
              series={[metrics.billable, metrics.overhead]} 
              options={{ ...chartDefaults, labels: ['Billable', 'Non-Billable'], colors: ['#10b981', 'rgba(255,255,255,0.1)'], stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '75%' } } }, dataLabels: { enabled: false }, legend: { position: 'bottom', labels: { colors: '#a1a1aa' } }
              }} 
            />
          </div>
        </div>
      </div>

      {/* --- ROW 4: STATUS, RISKS & LOCATIONS --- */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-radar' style={{ color: 'var(--accent-coral)' }}></i> At-Risk Projects (Burn %)</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={300}
              series={[{ name: 'Burn %', data: metrics.atRisk.map(r => r.burn) }]}
              options={{ ...chartDefaults, colors: ['#f43f5e'],
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
                dataLabels: { enabled: true, formatter: (val) => Math.round(val) + "%", textAnchor: 'start', style: { colors: ['#fff'] } },
                xaxis: { categories: metrics.atRisk.map(r => r.name), max: 100, labels: { style: { colors: '#a1a1aa' } } },
                yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 150 } }, grid: { show: false }
              }}
            />
          </div>
        </div>

        <div className="chart-card">
          <h4><i className='bx bx-task' style={{ color: 'var(--accent-green)' }}></i> Active Projects by Status</h4>
          <div className={styles.chartWrapper}>
            <Chart type="donut" width="100%" height={300}
              series={metrics.statusData.length ? metrics.statusData : [1]} 
              options={{ ...chartDefaults, labels: metrics.statusLabels.length ? metrics.statusLabels : ['No Data'],
                colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'], stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '75%' } } }, dataLabels: { enabled: false }, legend: { position: 'bottom', labels: { colors: '#a1a1aa' } }
              }} 
            />
          </div>
        </div>

        <div className="chart-card">
          <h4><i className='bx bx-map' style={{ color: 'var(--accent-blue)' }}></i> Locations Overview</h4>
          <div className={styles.chartWrapper} style={{ overflowY: 'auto' }}>
            <div className={styles.locationList}>
              {metrics.locations.map((loc, idx) => {
                const maxLoc = metrics.locations[0]?.val || 1;
                return (
                  <div key={idx} className={styles.locItem}>
                    <div className={styles.locHeader}><span>{loc.name}</span><span className={styles.locVal}>{fmtInt(loc.val)} hrs</span></div>
                    <div className={styles.progress}><div className={styles.progressBar} style={{ width: `${(loc.val / maxLoc) * 100}%` }}></div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- ROW 5: DEEP EFFORT ANALYSIS (The Logarithmic Chart) --- */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-bar-chart-square' style={{ color: 'var(--text-main)' }}></i> Deep Project Delivery Analysis</h4>
          
          {/* Scroll wrapper is critical here because this chart can get extremely wide */}
          <div className={styles.scrollWrapper}>
            <div style={{ width: Math.max(1200, metrics.deepEffort.labels.length * 80) + 'px' }}>
              <Chart type="bar" width="100%" height={450}
                series={[ 
                  { name: 'Actual', data: metrics.deepEffort.act.map(v => v <= 0 ? 0.1 : v) }, 
                  { name: 'Estimated', data: metrics.deepEffort.est.map(v => v <= 0 ? 0.1 : v) }, 
                  { name: 'Quoted', data: metrics.deepEffort.quoted.map(v => v <= 0 ? 0.1 : v) } 
                ]}
                options={{ ...chartDefaults, chart: { stacked: true, animations: { enabled: false } },
                  colors: ['#3b82f6', 'rgba(255,255,255,0.1)', '#f59e0b'],
                  plotOptions: { bar: { horizontal: false, columnWidth: '45%', borderRadius: 0 } },
                  xaxis: { categories: metrics.deepEffort.labels, labels: { style: { colors: '#a1a1aa' }, rotate: -45, trim: true, maxHeight: 160 } },
                  yaxis: { logarithmic: true, labels: { style: { colors: '#a1a1aa' }, formatter: (val) => val <= 0.1 ? "0" : fmtInt(val) } },
                  grid: { borderColor: '#27272a', strokeDashArray: 4 }, legend: { position: 'top', horizontalAlign: 'left', labels: { colors: '#fff' } }
                }} 
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}