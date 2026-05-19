import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import styles from './Dashboard.module.css';

export default function Dashboard({ dataMatrix }) {
  // 1. Engine: Calculate KPIs instantly
  const metrics = useMemo(() => {
    let tAct = 0, tEst = 0, tQuoted = 0;
    let activeStatus = 0, compStatus = 0;
    let overburnData = [];
    let billableHrs = 0, overheadHrs = 0;

    const { factTable = [], dimensionTable = {}, topClients = [], compliance = {} } = dataMatrix || {};

    factTable.forEach(row => {
      if (row.program.toLowerCase().includes("internal")) overheadHrs += row.act;
      else billableHrs += row.act;
    });

    Object.keys(dimensionTable).forEach(pName => {
      const pData = dimensionTable[pName];
      const periodActual = factTable.filter(r => r.project === pName).reduce((s, r) => s + r.act, 0);
      
      tAct += periodActual;
      tEst += pData.est;
      tQuoted += pData.quoted;

      let statStr = (pData.status || "Unknown").toLowerCase();
      let isCompleted = statStr.includes('completed') || statStr.includes('archived');
      if (isCompleted) compStatus++; 
      else if (periodActual > 0 || pData.status === "In Progress") activeStatus++;

      if (periodActual > pData.est && pData.est > 0) {
        overburnData.push({
          name: pName,
          act: periodActual,
          est: pData.est,
          overburn: periodActual - pData.est
        });
      }
    });

    const sortedOverburn = overburnData.sort((a, b) => b.overburn - a.overburn).slice(0, 10);
    const maxBf = Math.ceil(Math.max(0, ...sortedOverburn.map(p => Math.max(p.act, p.est))) * 1.1) || 10;

    return {
      totalProjects: Object.keys(dimensionTable).length,
      activeProjects: activeStatus,
      completedProjects: compStatus,
      actual: Math.round(tAct),
      estimated: Math.round(tEst),
      quoted: Math.round(tQuoted),
      billable: Math.round(billableHrs),
      overhead: Math.round(overheadHrs),
      overburn: sortedOverburn,
      bfMax: maxBf,
      topClients,
      dailyDeficits: compliance.dailyDeficits || 0
    };
  }, [dataMatrix]);

  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
  const chartDefaults = { background: 'transparent', foreColor: '#a1a1aa', toolbar: { show: false } };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <div className={styles.titleArea}>
          <h2 className={styles.sectionTitle}>Analytics Overview</h2>
          <div className="badges-container">
            <span className="badge-base period-badge">All Time</span>
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Active Clients</p><h3>{metrics.topClients.length}</h3></div><div className="trend"><i className='bx bx-briefcase'></i> <span>Portfolio</span></div></div>
        <div className="kpi-card"><div><p>Total Projects</p><h3>{metrics.totalProjects}</h3></div><div className="trend"><i className='bx bx-folder'></i> <span>Baseline</span></div></div>
        <div className="kpi-card"><div><p>In Progress</p><h3 style={{ color: 'var(--accent-blue)' }}>{metrics.activeProjects}</h3></div><div className="trend"><i className='bx bx-pulse'></i> <span>Current</span></div></div>
        <div className="kpi-card"><div><p>Completed</p><h3 style={{ color: 'var(--accent-green)' }}>{metrics.completedProjects}</h3></div><div className="trend"><i className='bx bx-check-circle'></i> <span>Current</span></div></div>
        
        <div className="kpi-card"><div><p>Actual Hours</p><h3>{fmtInt(metrics.actual)}</h3></div><div className="trend"><i className='bx bx-time'></i> <span>Period Effort</span></div></div>
        <div className="kpi-card"><div><p>Estimated Hours</p><h3>{fmtInt(metrics.estimated)}</h3></div><div className="trend"><i className='bx bx-target-lock'></i> <span>Baseline</span></div></div>
        <div className="kpi-card"><div><p>Quoted Value</p><h3>{fmtInt(metrics.quoted)}</h3></div><div className="trend"><i className='bx bx-file'></i> <span>Contracted</span></div></div>
        
        <div className="kpi-card" style={{ cursor: 'pointer', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
          <div>
            <p>Daily Deficits</p>
            <h3 style={{ color: 'var(--accent-coral)' }}>{metrics.dailyDeficits}</h3>
          </div>
        </div>
      </div>

      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <h4><i className='bx bx-doughnut-chart' style={{ color: 'var(--accent-blue)' }}></i> Billable vs Non-Billable</h4>
          <div className={styles.chartWrapper}>
            <Chart 
              type="donut" 
              width="100%"
              height={320}
              series={[metrics.billable, metrics.overhead]} 
              options={{
                ...chartDefaults,
                labels: ['Billable', 'Non-Billable'],
                colors: ['#10b981', 'rgba(255,255,255,0.1)'],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '75%' } } },
                dataLabels: { enabled: false },
                legend: { position: 'bottom', labels: { colors: '#a1a1aa' } }
              }} 
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-error-circle' style={{ color: 'var(--accent-red)' }}></i> Revenue Leakage (Overburn)</h4>
          <div className={styles.chartWrapper}>
            <Chart 
              type="bar" 
              width="100%"
              height={320}
              series={[
                { name: 'Estimated Budget', data: metrics.overburn.map(p => -p.est) },
                { name: 'Actual Burn', data: metrics.overburn.map(p => p.act) }
              ]} 
              options={{
                ...chartDefaults,
                chart: { stacked: true },
                colors: ['#a1a1aa', '#ef4444'],
                plotOptions: { bar: { horizontal: true, borderRadius: 0 } },
                xaxis: { 
                  categories: metrics.overburn.map(p => p.name),
                  min: -metrics.bfMax, 
                  max: metrics.bfMax,
                  labels: { style: { colors: '#a1a1aa' }, formatter: (v) => Math.abs(Math.round(v)) },
                  axisBorder: { show: false }, 
                  axisTicks: { show: false }
                },
                yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 150 } },
                grid: { borderColor: '#27272a', strokeDashArray: 4 },
                dataLabels: { enabled: true, formatter: (v) => Math.abs(Math.round(v)) + "h" },
                tooltip: { theme: 'dark', y: { formatter: (v) => Math.abs(Math.round(v)) + " hrs" } },
                legend: { position: 'top', labels: { colors: '#a1a1aa' } }
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}