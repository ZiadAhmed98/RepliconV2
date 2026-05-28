import React, { useState, useMemo, useEffect, useRef } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    let days = 0; let cur = new Date(startDate); cur.setHours(0, 0, 0, 0);
    let end = new Date(endDate); end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, days);
  };

  // =========================================================================
  // 3. ADVANCED ANALYTICS ENGINE
  // =========================================================================
  const empData = useMemo(() => {
    if (!selectedEmpName || !dataMatrix || !dataMatrix.factTable) return null;

    const emp = sortedRoster.find(e => e.name === selectedEmpName);
    if (!emp) return null;

    const nowTs = new Date().getTime();
    const myFacts = dataMatrix.factTable.filter(r => r.user === selectedEmpName && r.act > 0);
    
    // Core Accumulators
    let totalHrs = 0, billable = 0, overhead = 0;
    let projMap = {}, progMap = {}, trendMap = {}, clientMap = {}, locMap = {};
    
    // Behavioral Accumulators
    let dailyHoursMap = {}; 
    let dailyProjectsMap = {};
    let coWorkerMap = {};

    myFacts.forEach(r => {
      totalHrs += r.act;
      if ((r.program || "").toLowerCase().includes("internal")) overhead += r.act; else billable += r.act;
      
      if (r.project !== "Unknown") projMap[r.project] = (projMap[r.project] || 0) + r.act;
      if (r.program !== "Unknown" && r.program !== "Unassigned") progMap[r.program] = (progMap[r.program] || 0) + r.act;
      if (r.location && r.location !== "Unknown") locMap[r.location] = (locMap[r.location] || 0) + r.act;

      let pData = dataMatrix.dimensionTable[r.project];
      let cName = pData ? pData.client : "Unknown";
      if (cName !== "Unknown") clientMap[cName] = (clientMap[cName] || 0) + r.act;

      if (r.date > 0) {
        let d = new Date(r.date);
        let monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let dayKey = r.dateStr || `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        
        trendMap[monthKey] = (trendMap[monthKey] || 0) + r.act;
        dailyHoursMap[dayKey] = (dailyHoursMap[dayKey] || 0) + r.act;
        
        if (!dailyProjectsMap[dayKey]) dailyProjectsMap[dayKey] = new Set();
        dailyProjectsMap[dayKey].add(r.project);
      }
    });

    // 1. Capacity & Utilization
    let effectiveEnd = Math.min(nowTs, emp.end || nowTs);
    let potentialDays = getWorkingDays(emp.start, effectiveEnd);
    let capacity = potentialDays * 8;
    let utilPct = capacity > 0 ? Math.round((totalHrs / capacity) * 100) : 0;
    let billablePct = totalHrs > 0 ? Math.round((billable / totalHrs) * 100) : 0;

    // 2. Peer Benchmarking (Company Average)
    let compTotalHrs = 0; let compTotalCap = 0;
    dataMatrix.factTable.forEach(r => { if(r.date > 0) compTotalHrs += r.act; });
    dataMatrix.roster.forEach(e => {
        let eEnd = Math.min(nowTs, e.end || nowTs);
        if(e.start <= nowTs) compTotalCap += (getWorkingDays(e.start, eEnd) * 8);
    });
    let companyAvgUtil = compTotalCap > 0 ? Math.round((compTotalHrs / compTotalCap) * 100) : 0;

    // 3. Behavioral Diagnostics
    let daysWorked = Object.keys(dailyHoursMap).length || 1;
    let maxSingleDay = 0;
    let dailyHoursArr = [];
    let totalProjectSwitches = 0;

    Object.keys(dailyHoursMap).forEach(k => {
        if (dailyHoursMap[k] > maxSingleDay) maxSingleDay = dailyHoursMap[k];
        dailyHoursArr.push(dailyHoursMap[k]);
        totalProjectSwitches += dailyProjectsMap[k].size;
    });

    let avgProjectsPerDay = (totalProjectSwitches / daysWorked).toFixed(1);
    
    // Volatility (Standard Deviation of daily hours)
    let meanDaily = totalHrs / daysWorked;
    let variance = dailyHoursArr.reduce((sum, hrs) => sum + Math.pow(hrs - meanDaily, 2), 0) / daysWorked;
    let volatility = Math.sqrt(variance).toFixed(1);

    // 4. Core Collaboration Ring
    dataMatrix.factTable.forEach(r => {
        if (r.user !== selectedEmpName && r.act > 0 && r.dateStr && dailyProjectsMap[r.dateStr] && dailyProjectsMap[r.dateStr].has(r.project)) {
            coWorkerMap[r.user] = (coWorkerMap[r.user] || 0) + 1; // Count overlap instances
        }
    });
    let topCollaborators = Object.keys(coWorkerMap).sort((a,b) => coWorkerMap[b] - coWorkerMap[a]).slice(0, 3);

    // 5. Client & Overhead Drifts
    let clientKeys = Object.keys(clientMap).sort((a, b) => clientMap[b] - clientMap[a]);
    let topClientPct = totalHrs > 0 && clientKeys.length > 0 ? Math.round((clientMap[clientKeys[0]] / totalHrs) * 100) : 0;
    let overheadPct = totalHrs > 0 ? Math.round((overhead / totalHrs) * 100) : 0;

    // 6. Automated Executive Digest Generator
    let digest = `${emp.name} is currently running at ${utilPct}% utilization (vs company average of ${companyAvgUtil}%). `;
    if (overheadPct > 20) digest += `⚠️ Overhead drift is exceptionally high (${overheadPct}% of time is non-billable). `;
    if (topClientPct > 60) digest += `⚠️ High concentration risk: ${topClientPct}% of all effort is dedicated to a single client (${clientKeys[0]}). `;
    if (avgProjectsPerDay > 2.5) digest += `⚠️ Context-switching penalty active (juggling ~${avgProjectsPerDay} projects daily). `;
    if (maxSingleDay >= 12) digest += `Spillover anomalies detected (peak log: ${Math.round(maxSingleDay)}h in one day). `;
    if (topCollaborators.length > 0) digest += `Works most closely with ${topCollaborators.join(', ')}.`;
    if (digest.indexOf('⚠️') === -1) digest += `Performance and operational metrics are stable and within optimal parameters.`;

    // Active Projects Count
    let activeProjCount = 0; let activeOverburn = 0;
    Object.keys(projMap).forEach(pName => {
      let pData = dataMatrix.dimensionTable[pName];
      if (pData && pData.status !== "Completed" && pData.status !== "Archived") {
          activeProjCount++;
          if (projMap[pName] > pData.est && pData.est > 0) activeOverburn++;
      }
    });

    let monthsActive = Object.keys(trendMap).length || 1;
    let tLabels = Object.keys(trendMap).sort();
    let tData = tLabels.map(k => Math.round(trendMap[k]));
    let tCapData = tLabels.map(k => {
      let [y, m] = k.split('-');
      let overlapStart = Math.max(new Date(y, parseInt(m) - 1, 1).getTime(), emp.start);
      let overlapEnd = Math.min(new Date(y, parseInt(m), 0).getTime(), emp.end || nowTs);
      return (overlapStart <= overlapEnd) ? getWorkingDays(overlapStart, overlapEnd) * 8 : 0;
    });

    let pKeys = Object.keys(progMap).sort((a, b) => progMap[b] - progMap[a]).slice(0, 8);
    let projKeys = Object.keys(projMap).sort((a, b) => projMap[b] - projMap[a]).slice(0, 10);
    let compRecord = dataMatrix.compliance?.dailyList?.find(c => c.name === emp.name);

    return {
      emp, utilPct, capacity, totalHrs, activeProjCount, billablePct, avg: Math.round(totalHrs / monthsActive),
      billable: Math.round(billable), overhead: Math.round(overhead),
      peerAvg: companyAvgUtil, avgProjDay: avgProjectsPerDay, maxDay: Math.round(maxSingleDay), vol: volatility,
      topCollabs: topCollaborators, topClientPct, topClient: clientKeys[0], overburnCount: activeOverburn,
      digest,
      trend: { labels: tLabels.map(k => new Date(k.split('-')[0], parseInt(k.split('-')[1]) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' })), act: tData, cap: tCapData },
      radar: { labels: pKeys.length ? pKeys : ['No Data'], series: pKeys.map(k => Math.round(progMap[k])) },
      projects: { labels: projKeys.length ? projKeys : ['No Data'], series: projKeys.map(k => Math.round(projMap[k])) },
      clients: { labels: clientKeys.slice(0,6), series: clientKeys.slice(0,6).map(k => Math.round(clientMap[k])) },
      tableMap: projMap, compRecord
    };
  }, [selectedEmpName, dataMatrix, sortedRoster]);

  if (!empData) return null;

  // =========================================================================
  // 4. PDF ENGINE & HELPERS
  // =========================================================================
  const exportChartToPDF = async (chartId, title, tableHeaders, tableRows) => {
    try {
      let imgURI = null;
      try { const r = await ApexCharts.exec(chartId, 'dataURI'); if (r && r.imgURI) imgURI = r.imgURI; } catch (err) {}
      if (!imgURI) {
        const node = document.getElementById(`wrap-${chartId}`);
        if (node) { const canvas = await window.html2canvas(node, { backgroundColor: '#141419', scale: 2, logging: false }); imgURI = canvas.toDataURL('image/png'); }
      }
      if (!imgURI) return alert("Chart is hidden/animating. Try again.");
      const doc = new jsPDF('p', 'pt', 'a4');
      doc.setFontSize(18); doc.setTextColor(40, 40, 40); doc.text(title, 40, 45);
      doc.setFontSize(10); doc.setTextColor(120, 120, 120); doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 60);
      doc.setFillColor(20, 20, 25); doc.rect(40, 80, 515, 230, 'F'); doc.addImage(imgURI, 'PNG', 40, 80, 515, 230);
      autoTable(doc, { startY: 330, head: [tableHeaders], body: tableRows, theme: 'striped', headStyles: { fillColor: [168, 85, 247] }, alternateRowStyles: { fillColor: [245, 245, 245] } });
      doc.save(`${title.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (err) { alert("Failed to export PDF."); }
  };

  const PdfButton = ({ onClick }) => (
    <button style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ff3b30' }} onClick={onClick}>
      <i className='bx bxs-file-pdf' style={{fontSize: '1.1rem'}}></i> <span style={{ fontWeight: 600 }}>PDF</span>
    </button>
  );

  const getChartOptions = (id, customOptions = {}) => ({
    chart: { id: id, background: 'transparent', toolbar: { show: true }, ...(customOptions.chart || {}) },
    theme: { mode: 'dark' }, grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 }, tooltip: { theme: 'dark' }, ...customOptions
  });

  return (
    <div>
      <style>{`.apexcharts-svg, .apexcharts-canvas { background: transparent !important; }`}</style>

      <div className={styles.empSelectorRibbon}>
        <div className={styles.empSelectWrap}>
          <i className='bx bx-search' style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}></i>
          <select className={styles.empSelect} value={selectedEmpName} onChange={(e) => setSelectedEmpName(e.target.value)}>
            {sortedRoster.map(e => <option key={e.name} value={e.name}>{e.name} {e.status !== 'Enabled' ? '(Disabled)' : ''}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.identityBanner}>
        <div className={styles.identityAvatar}>{empData.emp.name.charAt(0)}</div>
        <div className={styles.identityDetails}>
          <h2>{empData.emp.name}</h2>
          <div className={styles.identityTags}>
            <span className={`${styles.iTag} ${empData.emp.status === 'Enabled' ? styles.tagActive : styles.tagNoComp}`}>{empData.emp.status}</span>
            {empData.emp.status === 'Enabled' && empData.compRecord && <span className={`${styles.iTag} ${empData.compRecord.isCompliant ? styles.tagComp : styles.tagNoComp}`}>{empData.compRecord.isCompliant ? "Timesheet Compliant" : "Deficit Warning"}</span>}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '10px' }}>Joined: {new Date(empData.emp.start).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* --- 1. NEW: AUTOMATED EXECUTIVE DIGEST --- */}
      <div className="chart-card" style={{ marginBottom: '24px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
        <h4 style={{ color: 'var(--accent-purple)', marginBottom: '10px' }}><i className='bx bx-brain'></i> Automated Executive Digest</h4>
        <p style={{ color: 'var(--text-main)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>{empData.digest}</p>
      </div>

      {/* --- 2. NEW: EXPANDED KPI GRID --- */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Utilization (vs Peer Avg)</p><h3><span style={{color: empData.utilPct < empData.peerAvg ? 'var(--accent-coral)' : 'var(--accent-green)'}}>{empData.utilPct}%</span> <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>/ {empData.peerAvg}%</span></h3></div></div>
        <div className="kpi-card"><div><p>Total Capacity Baseline</p><h3>{fmtInt(empData.capacity)}h</h3></div></div>
        <div className="kpi-card"><div><p>Revenue Generating</p><h3 style={{ color: empData.billablePct < 60 ? 'var(--accent-coral)' : 'var(--accent-blue)' }}>{empData.billablePct}%</h3></div></div>
        <div className="kpi-card"><div><p>Context-Switching Pnlty</p><h3 style={{ color: empData.avgProjDay > 2 ? 'var(--accent-orange)' : 'var(--text-main)' }}>{empData.avgProjDay} <span style={{fontSize: '0.9rem'}}>proj/day</span></h3></div></div>
        <div className="kpi-card"><div><p>Anomalous Peak Shift</p><h3 style={{ color: empData.maxDay > 12 ? 'var(--accent-red)' : 'var(--text-main)' }}>{empData.maxDay}h</h3></div></div>
        <div className="kpi-card"><div><p>Schedule Volatility</p><h3>{empData.vol} <span style={{fontSize: '0.9rem'}}>σ</span></h3></div></div>
      </div>

      {/* --- 3. DIAGNOSTICS & COLLABORATION ROW --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <h4><i className='bx bx-network-chart' style={{ color: 'var(--accent-blue)' }}></i> Core Collaboration Network</h4>
          <div style={{ marginTop: '15px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Top engineers co-logging on the same projects & dates.</p>
            {empData.topCollabs.length === 0 ? <p style={{color: 'var(--text-muted)'}}>Insufficient co-working data.</p> : (
                <ul className={styles.insightList}>
                  {empData.topCollabs.map((c, i) => <li key={i} className={styles.insightItem}><div className={styles.insightInfo}><div className={styles.insightRank} style={{background: 'var(--accent-blue)'}}>{i+1}</div><span className={styles.insightName}>{c}</span></div></li>)}
                </ul>
            )}
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-shield-quarter' style={{ color: 'var(--accent-red)' }}></i> Risk & Alignment Guardrails</h4>
          <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-main)' }}>Client Dependency Risk</span>
                <span style={{ fontWeight: 600, color: empData.topClientPct > 60 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{empData.topClientPct}% ({empData.topClient})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-main)' }}>Overhead Drift</span>
                <span style={{ fontWeight: 600, color: (100 - empData.billablePct) > 20 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>{100 - empData.billablePct}% Non-Billable</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-main)' }}>Active Projects in Overburn</span>
                <span style={{ fontWeight: 600, color: empData.overburnCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{empData.overburnCount} Projects</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- STANDARD VISUALIZATIONS --- */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h4 style={{ margin: 0 }}><i className='bx bx-trending-up' style={{ color: 'var(--accent-blue)' }}></i> Historical Utilization Trend</h4><PdfButton onClick={() => exportChartToPDF('empTrendChart', `${empData.emp.name} - Trend`, ['Month', 'Capacity', 'Logged'], empData.trend.labels.map((lbl, i) => [lbl, empData.trend.cap[i], empData.trend.act[i]]))} /></div>
          <div className={styles.chartWrapper} id="wrap-empTrendChart"><Chart type="line" width="100%" height={320} series={[{ name: 'Capacity Baseline', type: 'line', data: empData.trend.cap }, { name: 'Hours Logged', type: 'area', data: empData.trend.act }]} options={getChartOptions('empTrendChart', { colors: ['#a1a1aa', '#3b82f6'], stroke: { curve: 'smooth', width: [3, 2] }, fill: { type: ['solid', 'gradient'], gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.0, stops: [0, 100] } }, xaxis: { categories: empData.trend.labels, labels: { style: { colors: '#a1a1aa' } } }, yaxis: { labels: { formatter: (v) => fmtInt(v), style: { colors: '#a1a1aa' } } }, legend: { position: 'top', labels: { colors: '#a1a1aa' } } })} /></div>
        </div>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h4 style={{ margin: 0 }}><i className='bx bx-briefcase' style={{ color: 'var(--accent-purple)' }}></i> Client Portfolio</h4><PdfButton onClick={() => exportChartToPDF('empClientChart', `${empData.emp.name} - Clients`, ['Client', 'Hours'], empData.clients.labels.map((lbl, i) => [lbl, empData.clients.series[i]]))} /></div>
          <div className={styles.chartWrapper} id="wrap-empClientChart"><Chart type="donut" width="100%" height={320} series={empData.clients.series.length ? empData.clients.series : [1]} options={getChartOptions('empClientChart', { labels: empData.clients.labels.length ? empData.clients.labels : ['No Data'], colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#64748b'], stroke: { width: 0 }, plotOptions: { pie: { donut: { size: '75%' } } }, dataLabels: { enabled: false }, legend: { position: 'bottom', labels: { colors: '#a1a1aa' } } })} /></div>
        </div>
      </div>

      <div className={styles.chartRow}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h4 style={{ margin: 0 }}><i className='bx bx-radar' style={{ color: 'var(--accent-purple)' }}></i> Skill & Program Matrix</h4><PdfButton onClick={() => exportChartToPDF('empRadarChart', `${empData.emp.name} - Programs`, ['Program', 'Hours'], empData.radar.labels.map((lbl, i) => [lbl, empData.radar.series[i]]))} /></div>
          <div className={styles.chartWrapper} id="wrap-empRadarChart"><Chart type="radar" width="100%" height={350} series={[{ name: 'Hours', data: empData.radar.series }]} options={getChartOptions('empRadarChart', { labels: empData.radar.labels, colors: ['#8b5cf6'], stroke: { width: 2 }, fill: { opacity: 0.2 }, plotOptions: { radar: { size: 125, polygons: { strokeColors: '#27272a', connectorColors: '#27272a' } } }, markers: { size: 4, colors: ['#fff'], strokeColors: '#8b5cf6', strokeWidth: 2 }, yaxis: { show: false }, xaxis: { labels: { style: { colors: '#a1a1aa', fontSize: '11px', fontWeight: 600 } } } })} /></div>
        </div>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h4 style={{ margin: 0 }}><i className='bx bx-pie-chart-alt-2' style={{ color: 'var(--accent-coral)' }}></i> Top Project Effort</h4><PdfButton onClick={() => exportChartToPDF('empTopProjectsChart', `${empData.emp.name} - Projects`, ['Project', 'Hours'], empData.projects.labels.map((lbl, i) => [lbl, empData.projects.series[i]]))} /></div>
          <div className={styles.chartWrapper} id="wrap-empTopProjectsChart"><Chart type="bar" width="100%" height={320} series={[{ name: 'Hours', data: empData.projects.series }]} options={getChartOptions('empTopProjectsChart', { colors: ['#f43f5e'], plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } }, dataLabels: { enabled: true, textAnchor: 'start', style: { colors: ['#fff'] }, formatter: (val) => fmtInt(val) + "h", offsetX: 0 }, xaxis: { categories: empData.projects.labels, labels: { style: { colors: '#a1a1aa' } } }, yaxis: { labels: { style: { colors: '#a1a1aa' }, maxWidth: 200 } }, grid: { show: false } })} /></div>
        </div>
      </div>

      {/* --- SCROLLABLE DETAILED TABLE --- */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <h4><i className='bx bx-list-ul' style={{ color: 'var(--text-main)' }}></i> Detailed Project Portfolio</h4>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '400px', paddingRight: '10px' }}>
            <table className={styles.premiumTable} style={{ minWidth: '1000px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
                <tr><th>Project Name</th><th>Client</th><th>Role / Program</th><th>Hours Contributed</th><th>Total Proj. Budget</th></tr>
              </thead>
              <tbody>
                {Object.keys(empData.tableMap).length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects logged.</td></tr> : (
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