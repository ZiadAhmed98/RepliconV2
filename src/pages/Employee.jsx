import React, { useState, useMemo, useEffect, useRef } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Ensures the bundler securely exposes this to the window for the fallback
import html2canvas from 'html2canvas';
window.html2canvas = html2canvas;

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
    let projMap = {}, progMap = {}, trendMap = {}, clientMap = {};

    // Map all timesheets for this specific employee
    myFacts.forEach(r => {
      totalHrs += r.act;
      if ((r.program || "").toLowerCase().includes("internal")) overhead += r.act; 
      else billable += r.act;
      
      if (r.project !== "Unknown") projMap[r.project] = (projMap[r.project] || 0) + r.act;
      if (r.program !== "Unknown" && r.program !== "Unassigned") progMap[r.program] = (progMap[r.program] || 0) + r.act;
      
      // NEW: Client mapping for dependency chart
      let pData = dataMatrix.dimensionTable[r.project];
      let cName = pData ? pData.client : "Unknown";
      if (cName !== "Unknown") clientMap[cName] = (clientMap[cName] || 0) + r.act;

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
    
    // NEW KPI: Billable Percentage
    let billablePct = totalHrs > 0 ? Math.round((billable / totalHrs) * 100) : 0;

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

    // NEW: Client Pie Mapping
    let clientKeys = Object.keys(clientMap).sort((a, b) => clientMap[b] - clientMap[a]).slice(0, 6);
    let clientVals = clientKeys.map(k => Math.round(clientMap[k]));

    // Compliance
    let compRecord = dataMatrix.compliance?.dailyList?.find(c => c.name === emp.name);

    return {
      emp, utilPct, capacity, totalHrs, activeProjCount, billablePct, avg: Math.round(totalHrs / monthsActive),
      billable: Math.round(billable), overhead: Math.round(overhead),
      trend: { labels: niceLabels, act: tData, cap: tCapData },
      radar: { labels: pKeys.length ? pKeys : ['No Data'], series: pVals.length ? pVals : [0] },
      projects: { labels: projKeys.length ? projKeys : ['No Data'], series: projVals.length ? projVals : [0] },
      clients: { labels: clientKeys.length ? clientKeys : ['No Data'], series: clientVals.length ? clientVals : [1] },
      tableMap: projMap, compRecord
    };
  }, [selectedEmpName, dataMatrix, sortedRoster]);

  if (!empData) return null; // Wait for initial load

  // =========================================================================
  // 4. THE BULLETPROOF PDF EXPORTER
  // =========================================================================
  const exportChartToPDF = async (chartId, title, tableHeaders, tableRows) => {
    try {
      let imgURI = null;
      try {
        const response = await ApexCharts.exec(chartId, 'dataURI');
        if (response && response.imgURI) imgURI = response.imgURI;
      } catch (err) {
        console.warn(`Native export for ${chartId} bypassed, utilizing DOM capture fallback.`);
      }

      if (!imgURI) {
        const chartNode = document.getElementById(`wrap-${chartId}`);
        if (chartNode) {
          const canvas = await window.html2canvas(chartNode, {
            backgroundColor: '#141419', 
            scale: 2, 
            logging: false
          });
          imgURI = canvas.toDataURL('image/png');
        }
      }

      if (!imgURI) return alert("The chart is hidden or still animating. Please wait a second and try again.");

      const doc = new jsPDF('p', 'pt', 'a4');
      
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(title, 40, 45);
      
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 40, 60);

      doc.setFillColor(20, 20, 25);
      doc.rect(40, 80, 515, 230, 'F');
      doc.addImage(imgURI, 'PNG', 40, 80, 515, 230);

      autoTable(doc, {
        startY: 330,
        head: [tableHeaders],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [168, 85, 247], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: 50 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 40, right: 40 }
      });

      doc.save(`${title.replace(/\s+/g, '_')}_Executive_Report.pdf`);
    } catch (err) {
      console.error("PDF Generation Error: ", err);
      alert("Failed to export PDF. Please check the console for details.");
    }
  };

  const PdfButton = ({ onClick }) => (
    <button 
      style={{ 
        padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', 
        border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)',
        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', color: '#ff3b30'
      }} 
      onClick={onClick}
      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.15)'}
      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.05)'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline><path d="M9 15v-6h3a2 2 0 0 1 0 4H9"></path>
      </svg>
      <span style={{ fontWeight: 600 }}>PDF Report</span>
    </button>
  );

  const getChartOptions = (id, customOptions = {}) => {
    return {
      chart: { id: id, background: 'transparent', toolbar: { show: true }, ...(customOptions.chart || {}) },
      theme: { mode: 'dark' },
      grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
      tooltip: { theme: 'dark' }, 
      ...customOptions
    };
  };

  // =========================================================================
  // 5. UI RENDER
  // =========================================================================
  return (
    <div>
      <style>{`.apexcharts-svg, .apexcharts-canvas { background: transparent !important; }`}</style>

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

      {/* NEW: KPI Grid with Capacity & Billable % */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>All-Time Utilization</p><h3 style={{ color: 'var(--accent-yellow)' }}>{empData.utilPct}%</h3></div></div>
        <div className="kpi-card"><div><p>Total Capacity (Since Hire)</p><h3>{fmtInt(empData.capacity)}h</h3></div></div>
        <div className="kpi-card"><div><p>Total Hours Logged</p><h3>{fmtInt(empData.totalHrs)}</h3></div></div>
        <div className="kpi-card"><div><p>Revenue Generating</p><h3 style={{ color: 'var(--accent-green)' }}>{empData.billablePct}%</h3></div></div>
        <div className="kpi-card"><div><p>Projects Touched</p><h3>{empData.activeProjCount}</h3></div></div>
        <div className="kpi-card"><div><p>Monthly Average</p><h3>{empData.avg}h</h3></div></div>
      </div>

      {/* Chart Row 1: Trends & Distribution */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-trending-up' style={{ color: 'var(--accent-blue)' }}></i> Historical Utilization Trend</h4>
            <PdfButton onClick={() => exportChartToPDF('empTrendChart', `${empData.emp.name} - Burn Trend`, ['Month', 'Capacity', 'Actual Logged'], empData.trend.labels.map((lbl, i) => [lbl, empData.trend.cap[i], empData.trend.act[i]]))} />
          </div>
          <div className={styles.chartWrapper} id="wrap-empTrendChart">
            <Chart type="line" width="100%" height={320}
              series={[ { name: 'Capacity Baseline', type: 'line', data: empData.trend.cap }, { name: 'Hours Logged', type: 'area', data: empData.trend.act } ]}
              options={getChartOptions('empTrendChart', { 
                colors: ['#a1a1aa', '#3b82f6'], stroke: { curve: 'smooth', width: [3, 2] },
                fill: { type: ['solid', 'gradient'], gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.0, stops: [0, 100] } },
                xaxis: { categories: empData.trend.labels, labels: { style: { colors: '#a1a1aa' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { formatter: (v) => fmtInt(v), style: { colors: '#a1a1aa' } } },
                grid: { borderColor: '#27272a', strokeDashArray: 4 }, legend: { position: 'top', labels: { colors: '#a1a1aa' } }
              })} />
          </div>
        </div>

        {/* NEW: Client Dependency Chart */}
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-briefcase' style={{ color: 'var(--accent-purple)' }}></i> Client Portfolio Dependency</h4>
            <PdfButton onClick={() => exportChartToPDF('empClientChart', `${empData.emp.name} - Client Portfolio`, ['Client Name', 'Total Hours Logged'], empData.clients.labels.map((lbl, i) => [lbl, empData.clients.series[i]]))} />
          </div>
          <div className={styles.chartWrapper} id="wrap-empClientChart">
            <Chart type="donut" width="100%" height={320}
              series={empData.clients.series}
              options={getChartOptions('empClientChart', { 
                labels: empData.clients.labels,
                colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#64748b'],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '75%' } } },
                dataLabels: { enabled: false },
                legend: { position: 'bottom', labels: { colors: '#a1a1aa' } }
              })} />
          </div>
        </div>
      </div>

      {/* Chart Row 2: Skills & Ratios */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-radar' style={{ color: 'var(--accent-purple)' }}></i> Skill & Program Matrix</h4>
            <PdfButton onClick={() => exportChartToPDF('empRadarChart', `${empData.emp.name} - Program Matrix`, ['Program Classification', 'Hours Contributed'], empData.radar.labels.map((lbl, i) => [lbl, empData.radar.series[i]]))} />
          </div>
          <div className={styles.chartWrapper} id="wrap-empRadarChart">
            <Chart type="radar" width="100%" height={350}
              series={[{ name: 'Hours', data: empData.radar.series }]}
              options={getChartOptions('empRadarChart', { 
                labels: empData.radar.labels, colors: ['#8b5cf6'], stroke: { width: 2 }, fill: { opacity: 0.2 },
                plotOptions: { radar: { size: 125, polygons: { strokeColors: '#27272a', connectorColors: '#27272a' } } },
                markers: { size: 4, colors: ['#fff'], strokeColors: '#8b5cf6', strokeWidth: 2 },
                yaxis: { show: false }, xaxis: { labels: { style: { colors: '#a1a1aa', fontSize: '11px', fontWeight: 600 } } }
              })} />
          </div>
        </div>
        
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-pie-chart-alt-2' style={{ color: 'var(--accent-coral)' }}></i> Top Project Effort</h4>
            <PdfButton onClick={() => exportChartToPDF('empTopProjectsChart', `${empData.emp.name} - Top Projects`, ['Project Name', 'Hours Contributed'], empData.projects.labels.map((lbl, i) => [lbl, empData.projects.series[i]]))} />
          </div>
          <div className={styles.chartWrapper} id="wrap-empTopProjectsChart">
            <Chart type="bar" width="100%" height={320}
              series={[{ name: 'Hours', data: empData.projects.series }]}
              options={getChartOptions('empTopProjectsChart', { 
                colors: ['#f43f5e'], plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
                dataLabels: { enabled: true, textAnchor: 'start', style: { colors: ['#fff'] }, formatter: (val) => fmtInt(val) + "h", offsetX: 0 },
                xaxis: { categories: empData.projects.labels, labels: { style: { colors: '#a1a1aa' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 200 } }, grid: { show: false }
              })} />
          </div>
        </div>
      </div>

      {/* Detailed Table (NOW SCROLLABLE) */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-list-ul' style={{ color: 'var(--text-main)' }}></i> Detailed Project Portfolio</h4>
          {/* FIX: This specific div wraps the table and makes it scroll vertically! */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '400px', paddingRight: '10px' }}>
            <table className={styles.premiumTable} style={{ minWidth: '1000px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
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