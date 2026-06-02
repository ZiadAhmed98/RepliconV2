import React, { useState, useMemo, useRef, useEffect } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
window.html2canvas = html2canvas;

import styles from './Dashboard.module.css';
import ComplianceModal from '../components/ComplianceModal';

// Enterprise color palette (Apple/Google style)
const palette = {
  primary: '#0A84FF', // Blue
  success: '#30D158', // Green
  warning: '#FF9F0A', // Orange
  danger: '#FF453A',  // Red
  muted: '#8E8E93',   // Gray
  purple: '#BF5AF2'   // Accent Purple
};

export default function Dashboard({ dataMatrix }) {
  const [compView, setCompView] = useState('daily');
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState({ trendMonths: 12, deepEffortLimit: 9999 });
  
  const dashboardRef = useRef(null); 
  const filterPanelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target)) setShowFilters(false);
    };
    if (showFilters) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  const [filters, setFilters] = useState({ 
    client: 'All', project: 'All', program: 'All', 
    timePreset: 'All Time', dateFrom: '', dateTo: '' 
  });

  const handleClearFilters = () => setFilters({ client: 'All', project: 'All', program: 'All', timePreset: 'All Time', dateFrom: '', dateTo: '' });

  const handlePresetChange = (e) => {
    const preset = e.target.value;
    let newFrom = '', newTo = '';
    if (preset === 'This Week') {
      const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      newFrom = new Date(d.setDate(diff)).toISOString().split('T')[0];
      newTo = new Date().toISOString().split('T')[0];
    } else if (preset === 'MTD') {
      newFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      newTo = new Date().toISOString().split('T')[0];
    }
    setFilters({ ...filters, timePreset: preset, dateFrom: newFrom, dateTo: newTo });
  };

  const metrics = useMemo(() => {
    let tAct = 0, tEst = 0, tQuoted = 0, activeStatus = 0, compStatus = 0, billableHrs = 0, overheadHrs = 0;
    let overburnData = [], rolloffArray = [], timeTrendMap = {}, statusCounts = {};
    let empHoursMap = {}, locMap = {}, activeClientsSet = new Set(), activeProjectsSet = new Set(), activeProgramsSet = new Set();
    let userMonthHours = {}; // For Heatmap

    const { factTable = [], dimensionTable = {}, topClients = [], compliance = {}, roster = [] } = dataMatrix || {};
    const nowTs = Date.now();

    let tsFrom = 0, tsTo = Infinity;
    if (filters.timePreset === 'This Week') {
      const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      tsFrom = new Date(d.setDate(diff)).setHours(0,0,0,0);
    } else if (filters.timePreset === 'MTD') {
      tsFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    } else if (filters.timePreset === 'Custom') {
      if (filters.dateFrom) tsFrom = new Date(filters.dateFrom).getTime();
      if (filters.dateTo) tsTo = new Date(filters.dateTo).getTime() + 86400000; 
    }

    const filteredFacts = factTable.filter(row => {
      if (row.date > 0 && (row.date < tsFrom || row.date > tsTo)) return false;
      if (filters.client !== 'All' && row.client !== filters.client) return false;
      if (filters.project !== 'All' && row.project !== filters.project) return false;
      if (filters.program !== 'All' && row.program !== filters.program) return false;
      return true;
    });

    filteredFacts.forEach(row => {
      if (row.client && row.client !== "Unknown") activeClientsSet.add(row.client);
      if (row.project && row.project !== "Unknown") activeProjectsSet.add(row.project);
      if (row.program && row.program !== "Unknown" && row.program !== "Unassigned") activeProgramsSet.add(row.program);

      if ((row.program || "").toLowerCase().includes("internal")) overheadHrs += row.act; else billableHrs += row.act;
      
      if (row.user && row.user !== "Unknown") {
          empHoursMap[row.user] = (empHoursMap[row.user] || 0) + row.act;
          if (row.date > 0) {
              let d = new Date(row.date);
              let mKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
              if (!userMonthHours[row.user]) userMonthHours[row.user] = {};
              userMonthHours[row.user][mKey] = (userMonthHours[row.user][mKey] || 0) + row.act;
          }
      }

      if (row.location && row.location !== "Unknown") locMap[row.location] = (locMap[row.location] || 0) + row.act;
      
      if (row.date > 0) {
        let d = new Date(row.date);
        let key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        timeTrendMap[key] = (timeTrendMap[key] || 0) + row.act;
      }
    });

    let projLabels = [], projAct = [], projEst = [], projQuoted = [];
    let bubbleSeriesData = [];
    
    Object.keys(dimensionTable).forEach(pName => {
      const pData = dimensionTable[pName];
      if (filters.client !== 'All' && pData.client !== filters.client) return;
      if (filters.program !== 'All' && pData.program !== filters.program) return;
      if (filters.project !== 'All' && pName !== filters.project) return;

      const periodActual = filteredFacts.filter(r => r.project === pName).reduce((s, r) => s + r.act, 0);
      
      tAct += periodActual; tEst += pData.est; tQuoted += pData.quoted;
      projLabels.push(pName); projAct.push(periodActual); projEst.push(pData.est); projQuoted.push(pData.quoted);

      let statStr = (pData.status || "Unknown").toLowerCase();
      let isCompleted = statStr.includes('completed') || statStr.includes('archived');
      let isActive = periodActual > 0 || statStr.includes('in progress') || statStr.includes('active');
      
      if (isCompleted) compStatus++; else if (isActive) activeStatus++;
      if (periodActual > 0 || pData.est > 0) statusCounts[pData.status || "Unknown"] = (statusCounts[pData.status || "Unknown"] || 0) + 1;

      if (periodActual > pData.est && pData.est > 0) {
        overburnData.push({ name: pName, act: periodActual, est: pData.est, overburn: periodActual - pData.est });
      }

      // Prepare Scatter Plot Bubble Data
      if (isActive && pData.est > 0 && periodActual > 0) {
          let burnPct = Math.round((periodActual / pData.est) * 100);
          if (burnPct > 50) { // Only show somewhat mature projects
              bubbleSeriesData.push({
                  name: pName,
                  data: [[periodActual, burnPct, pData.est]] // [x: Actual Hrs, y: Burn %, z: Est Budget Size]
              });
          }
      }

      if (isActive && (pData.program || "").toLowerCase().includes("deployment")) {
        let engs = new Set();
        filteredFacts.forEach(r => { if(r.project === pName && r.date > (nowTs - 30*86400000) && r.act > 0) engs.add(r.user); });
        if(engs.size > 0) {
          let derivedEnd = pData.end > nowTs ? pData.end : (nowTs + 30*86400000);
          rolloffArray.push({ name: pName, end: derivedEnd, engineers: Array.from(engs) });
        }
      }
    });

    let trendLabels = [], trendActuals = [], trendCapacity = [];
    Object.keys(timeTrendMap).sort().forEach(k => {
      let [year, month] = k.split('-'); let mStart = new Date(year, parseInt(month)-1, 1).getTime(); let mEnd = new Date(year, parseInt(month), 0).getTime();
      trendLabels.push(new Date(mStart).toLocaleString('default', { month: 'short', year: '2-digit' })); 
      trendActuals.push(Math.round(timeTrendMap[k]));
      
      let mCap = 0;
      roster.forEach(emp => { 
        let overlapStart = Math.max(mStart, emp.start); let overlapEnd = Math.min(mEnd, emp.end); 
        if (overlapStart <= overlapEnd) {
          let days = 0, cur = new Date(overlapStart);
          while(cur.getTime() <= overlapEnd) { if(cur.getDay() !== 0 && cur.getDay() !== 6) days++; cur.setDate(cur.getDate() + 1); }
          mCap += days * 8;
        }
      });
      trendCapacity.push(Math.round(mCap));
    });

    // Prepare Heatmap Data
    let topUsersForHeatmap = Object.keys(empHoursMap).sort((a,b) => empHoursMap[b] - empHoursMap[a]).slice(0, 8);
    let allMonthsForHeatmap = Array.from(new Set(Object.keys(timeTrendMap))).sort().slice(-6); // Last 6 months
    let heatmapSeries = topUsersForHeatmap.map(user => {
        return {
            name: user,
            data: allMonthsForHeatmap.map(m => ({
                x: new Date(m + '-01').toLocaleString('default', { month: 'short' }),
                y: Math.round(userMonthHours[user]?.[m] || 0)
            }))
        };
    });

    let allClients = new Set(), allProjects = new Set(), allPrograms = new Set();
    factTable.forEach(r => {
        if(r.client && r.client !== "Unknown") allClients.add(r.client);
        if(r.project && r.project !== "Unknown") allProjects.add(r.project);
        if(r.program && r.program !== "Unknown" && r.program !== "Unassigned") allPrograms.add(r.program);
    });

    const sortedOverburn = overburnData.sort((a, b) => b.overburn - a.overburn).slice(0, 10);
    const maxBf = Math.ceil(Math.max(0, ...sortedOverburn.map(p => Math.max(p.act, p.est))) * 1.1) || 10;
    
    return {
      kpis: { totalProjects: activeProjectsSet.size, activeProjects: activeStatus, completedProjects: compStatus, actual: Math.round(tAct), estimated: Math.round(tEst), quoted: Math.round(tQuoted) },
      billable: Math.round(billableHrs), overhead: Math.round(overheadHrs), overburn: sortedOverburn, bfMax: maxBf, topClients,
      topEmployees: Object.keys(empHoursMap).map(e => ({ name: e, val: empHoursMap[e] })).sort((a, b) => b.val - a.val).slice(0, 5),
      locations: Object.keys(locMap).map(l => ({ name: l, val: locMap[l] })).sort((a, b) => b.val - a.val),
      statusLabels: Object.keys(statusCounts), statusData: Object.values(statusCounts),
      rolloffs: rolloffArray.sort((a,b) => a.end - b.end).slice(0, 5),
      trend: { labels: trendLabels, act: trendActuals, cap: trendCapacity },
      deepEffort: { labels: projLabels, act: projAct, est: projEst, quoted: projQuoted },
      heatmapSeries, heatmapMonths: allMonthsForHeatmap.map(m => new Date(m + '-01').toLocaleString('default', { month: 'short' })),
      bubbleSeriesData: bubbleSeriesData.sort((a,b) => b.data[0][1] - a.data[0][1]).slice(0, 20), // Top 20 highest burn %
      compliance: compliance, activeClientsCount: activeClientsSet.size,
      dropdowns: { clients: Array.from(allClients).sort(), projects: Array.from(allProjects).sort(), programs: Array.from(allPrograms).sort() },
      dimensionTable 
    };
  }, [dataMatrix, filters]);

  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
  const fmtK = (num) => {
    if (!num) return 0;
    const n = Math.round(num);
    return n > 999 ? (n/1000).toFixed(1) + 'k' : n;
  };

  const getSecurityTag = (projectName) => {
    const name = (projectName || '').toLowerCase();
    if (name.includes('auth') || name.includes('sec') || name.includes('compliance')) return <span className={styles.secTagHigh}>[RESTRICTED]</span>;
    if (name.includes('internal') || name.includes('poc')) return <span className={styles.secTagLow}>[INTERNAL]</span>;
    return <span className={styles.secTagMed}>[CONFIDENTIAL]</span>;
  };

  const exportToCSV = (title, headers, rows) => {
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChartToPDF = async (chartId, title, tableHeaders, tableRows) => {
    try {
      let imgURI = null;
      try {
        const response = await ApexCharts.exec(chartId, 'dataURI');
        if (response && response.imgURI) imgURI = response.imgURI;
      } catch (err) {}

      if (!imgURI) {
        const chartNode = document.getElementById(`wrap-${chartId}`);
        if (chartNode) {
          const canvas = await window.html2canvas(chartNode, { backgroundColor: '#1C1C1E', scale: 2, logging: false });
          imgURI = canvas.toDataURL('image/png');
        }
      }
      if (!imgURI) return alert("The chart is hidden or still animating.");

      const doc = new jsPDF('p', 'pt', 'a4');
      doc.setFontSize(18); doc.setTextColor(40, 40, 40); doc.text(title, 40, 45);
      doc.setFontSize(10); doc.setTextColor(120, 120, 120); doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 60);
      doc.setFillColor(28, 28, 30); doc.rect(40, 80, 515, 230, 'F'); doc.addImage(imgURI, 'PNG', 40, 80, 515, 230);

      autoTable(doc, {
        startY: 330, head: [tableHeaders], body: tableRows, theme: 'striped',
        headStyles: { fillColor: [10, 132, 255], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: 50 }, alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 40, right: 40 }
      });
      doc.save(`${title.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (err) { alert("Failed to export PDF."); }
  };

  const ExportControls = ({ title, headers, rows, chartId }) => (
    <div className={styles.exportGroup}>
        <button className={`${styles.exportBtn} ${styles.csvBtn}`} onClick={() => exportToCSV(title, headers, rows)}>CSV</button>
        <button className={`${styles.exportBtn} ${styles.pdfBtn}`} onClick={() => exportChartToPDF(chartId, title, headers, rows)}>PDF</button>
    </div>
  );

  const handlePrintFullDashboardPDF = async () => {
    if (!window.html2pdf) return alert("Full Dashboard PDF Engine loading. Try again in a moment.");
    try {
      await window.html2pdf().set({ margin: 0.5, filename: `Dashboard_Export_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#1C1C1E' }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' } }).from(dashboardRef.current).save();
    } catch (e) { alert("Failed to generate PDF."); }
  };

  const getChartOptions = (id, customOptions = {}) => ({
    chart: { id: id, background: 'transparent', toolbar: { show: true }, ...(customOptions.chart || {}) },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
    tooltip: { theme: 'dark' }, ...customOptions
  });

  const activeLimit = Math.min(metrics.deepEffort.labels.length, localFilters.deepEffortLimit);
  const deepChartMinWidth = activeLimit > 15 ? `${activeLimit * 60}px` : '100%';

  return (
    <div ref={dashboardRef}>
      <style>{`.apexcharts-svg, .apexcharts-canvas { background: transparent !important; }`}</style>
      <ComplianceModal isOpen={isCompModalOpen} onClose={() => setIsCompModalOpen(false)} viewType={compView} dataMatrix={dataMatrix} />

      {/* --- HEADER --- */}
      <div className={styles.sectionHeader} style={{ position: 'relative' }}>
        <div className={styles.titleArea}>
          <h2 className={styles.sectionTitle}>Enterprise Analytics</h2>
          <div className="badges-container">
            <span className="badge-base period-badge">{filters.timePreset}</span>
            {filters.client !== 'All' && <span className="badge-base active-filter-badge">{filters.client}</span>}
          </div>
        </div>
        <div className={styles.actionHeader}>
          <div className={styles.actionBtn} onClick={handlePrintFullDashboardPDF} title="Export Full"><i className='bx bx-export'></i></div>
          <div className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }}><i className='bx bx-filter-alt'></i></div>
        </div>
        
        {/* --- FILTERS --- */}
        {showFilters && (
          <div className={styles.filterPanel} ref={filterPanelRef}>
            <h4>Global Filters <i className='bx bx-x' style={{ cursor: 'pointer' }} onClick={() => setShowFilters(false)}></i></h4>
            <div className={styles.filterGroup}><label>Client</label><select className={styles.formControl} value={filters.client} onChange={e => setFilters({...filters, client: e.target.value})}><option value="All">All Clients</option>{metrics.dropdowns.clients.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className={styles.filterGroup} style={{ marginTop: '20px' }}><label>Time Period</label><select className={styles.formControl} value={filters.timePreset} onChange={handlePresetChange}><option value="All Time">All Time</option><option value="This Week">This Week</option><option value="MTD">Month to Date</option><option value="Custom">Custom</option></select></div>
            <div className={styles.filterActions}><button className={styles.clearBtn} onClick={handleClearFilters}>Reset</button><button className={styles.applyBtn} onClick={() => setShowFilters(false)}>Apply</button></div>
          </div>
        )}
      </div>

      {/* --- KPI ROW --- */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Active Clients</p><h3>{metrics.activeClientsCount}</h3></div><div className="trend"><span style={{color: palette.success}}>System Healthy</span></div></div>
        <div className="kpi-card"><div><p>In Progress</p><h3 style={{ color: palette.primary }}>{metrics.kpis.activeProjects}</h3></div><div className="trend"><span style={{color: palette.muted}}>Active Portfolio</span></div></div>
        <div className="kpi-card"><div><p>Actual Hours</p><h3>{fmtInt(metrics.kpis.actual)}</h3></div><div className="trend">{metrics.kpis.actual > metrics.kpis.estimated ? <span style={{color: palette.danger}}>▲ Over Budget</span> : <span style={{color: palette.success}}>▼ Within Bounds</span>}</div></div>
        <div className="kpi-card"><div><p>Estimated Hours</p><h3>{fmtInt(metrics.kpis.estimated)}</h3></div><div className="trend"><span style={{color: palette.muted}}>Baseline Target</span></div></div>
        
        <div className={`kpi-card ${styles.complianceCard}`} onClick={() => setIsCompModalOpen(true)}>
          <div className={styles.compControls}><i className='bx bx-chevron-left' onClick={(e) => { e.stopPropagation(); setCompView('daily'); }}></i><i className='bx bx-chevron-right' onClick={(e) => { e.stopPropagation(); setCompView('weekly'); }}></i></div>
          <div><p>{compView === 'daily' ? "Daily Deficits" : "Weekly Deficits"}</p><h3 style={{ color: palette.danger }}>{compView === 'daily' ? metrics.compliance.dailyDeficits : metrics.compliance.weeklyDeficits}</h3></div>
          <div className={styles.sparklineContainer}>
            <Chart type="area" width="100%" height={35} series={[{ name: 'Deficits', data: metrics.compliance.sparkline || [] }]} options={{ chart: { sparkline: { enabled: true } }, stroke: { curve: 'smooth', width: 2 }, colors: [palette.danger], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0 } }, tooltip: { enabled: false } }} />
          </div>
        </div>
      </div>

      {/* --- CHART ROW 1: PORTFOLIO & HEATMAP --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-grid-alt' style={{ color: palette.primary }}></i> Resource Utilization Heatmap</h4>
            <ExportControls title="Resource Utilization" headers={['Resource', ...metrics.heatmapMonths]} rows={metrics.heatmapSeries.map(s => [s.name, ...s.data.map(d => d.y)])} chartId="heatmapChart" />
          </div>
          <div className={styles.chartWrapper} id="wrap-heatmapChart">
            <Chart type="heatmap" width="100%" height={320}
              series={metrics.heatmapSeries}
              options={getChartOptions('heatmapChart', {
                  colors: [palette.primary],
                  dataLabels: { enabled: true, style: { colors: ['#fff'] } },
                  xaxis: { type: 'category', labels: { style: { colors: palette.muted } } },
                  yaxis: { labels: { style: { colors: palette.muted } } },
                  plotOptions: { heatmap: { shadeIntensity: 0.5, radius: 4, useFillColorAsStroke: false, colorScale: { ranges: [{ from: 0, to: 80, color: palette.success, name: 'Optimal' }, { from: 81, to: 160, color: palette.warning, name: 'Heavy' }, { from: 161, to: 9999, color: palette.danger, name: 'Overutilized' }] } } }
              })}
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4 style={{ marginBottom: '20px' }}><i className='bx bx-trophy' style={{ color: palette.warning }}></i> Top Contributors</h4>
          <div className={styles.chartWrapper}>
            <ul className={styles.insightList}>
              {metrics.topEmployees.map((e, i) => <li key={i} className={styles.insightItem}><div className={styles.insightInfo}><div className={styles.insightRank}>{i + 1}</div><span className={styles.insightName}>{e.name}</span></div><span className={styles.insightVal}>{fmtInt(e.val)} hrs</span></li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* --- CHART ROW 2: RISKS & TRENDS --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-radar' style={{ color: palette.danger }}></i> Project Risk Matrix (Burn vs Budget)</h4>
            <ExportControls title="At Risk Matrix" headers={['Project', 'Actual', 'Burn %', 'Est Budget']} rows={metrics.bubbleSeriesData.map(s => [s.name, s.data[0][0], s.data[0][1] + '%', s.data[0][2]])} chartId="riskMatrixChart" />
          </div>
          <div className={styles.chartWrapper} id="wrap-riskMatrixChart">
            <Chart type="bubble" width="100%" height={320} 
              series={metrics.bubbleSeriesData} 
              options={getChartOptions('riskMatrixChart', { 
                  colors: [palette.danger, palette.warning, palette.primary, palette.purple], 
                  xaxis: { title: { text: 'Actual Hours', style: { color: palette.muted } }, labels: { style: { colors: palette.muted } } }, 
                  yaxis: { title: { text: 'Burn %', style: { color: palette.muted } }, labels: { style: { colors: palette.muted } } }, 
                  dataLabels: { enabled: false }, fill: { opacity: 0.8 },
                  tooltip: { y: { formatter: (val) => val + "% Burn" }, z: { formatter: (val) => val + " Hrs Est Budget" } }
              })} 
            />
          </div>
        </div>

        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-pie-chart-alt-2' style={{ color: palette.primary }}></i> Billable Ratio</h4>
            <ExportControls title="Billable Ratio" headers={['Type', 'Hours']} rows={[['Billable', metrics.billable], ['Non-Billable', metrics.overhead]]} chartId="billableRatioChart" />
          </div>
          <div className={styles.chartWrapper} id="wrap-billableRatioChart">
            <Chart type="donut" width="100%" height={300} 
              series={[metrics.billable, metrics.overhead]} 
              options={getChartOptions('billableRatioChart', { 
                  labels: ['Billable', 'Non-Billable'], colors: [palette.primary, 'rgba(255,255,255,0.05)'], 
                  stroke: { width: 0 }, plotOptions: { pie: { donut: { size: '75%' } } }, 
                  dataLabels: { enabled: false }, legend: { position: 'bottom', labels: { colors: palette.muted } } 
              })} 
            />
          </div>
        </div>
      </div>

      {/* --- CHART ROW 3: FORECASTING & SECURITY --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <h4 style={{ marginBottom: '20px' }}><i className='bx bx-shield-quarter' style={{ color: palette.muted }}></i> Secure Deployment Forecast</h4>
          <div className={styles.chartWrapper} style={{ overflowY: 'auto' }}>
            <table className={styles.premiumTable}>
              <thead><tr><th>Classification</th><th>Project Ending</th><th>Target Date</th><th>Engineers</th></tr></thead>
              <tbody>{metrics.rolloffs.map((r, i) => <tr key={i}><td>{getSecurityTag(r.name)}</td><td>{r.name}</td><td>{new Date(r.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td><div className={styles.teamTags}>{r.engineers.map((e, j) => <span key={j}>{e.split(' ')[0]}</span>)}</div></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="chart-card">
          <h4 style={{ marginBottom: '20px' }}><i className='bx bx-map' style={{ color: palette.primary }}></i> Global Access Locations</h4>
          <div className={styles.chartWrapper} style={{ overflowY: 'auto' }}>
            <div className={styles.locationList}>{metrics.locations.map((loc, idx) => { const maxLoc = metrics.locations[0]?.val || 1; return <div key={idx} className={styles.locItem}><div className={styles.locHeader}><span>{loc.name}</span><span className={styles.locVal}>{fmtInt(loc.val)} hrs</span></div><div className={styles.progress}><div className={styles.progressBar} style={{ width: `${(loc.val / maxLoc) * 100}%` }}></div></div></div> })}</div>
          </div>
        </div>
      </div>

      {/* --- FINAL ROW: DEEP EFFORT ANALYSIS --- */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-bar-chart-square' style={{ color: palette.muted }}></i> Deep Project Delivery Analysis</h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select className={styles.formControl} style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }} value={localFilters.deepEffortLimit} onChange={e => setLocalFilters({...localFilters, deepEffortLimit: parseInt(e.target.value)})}>
                <option value={10}>Top 10 Active</option><option value={20}>Top 20 Active</option><option value={9999}>View All</option>
              </select>
              <ExportControls title="Project Analysis" headers={['Project', 'Actual', 'Estimated', 'Quoted']} rows={metrics.deepEffort.labels.slice(0, localFilters.deepEffortLimit).map((lbl, i) => [lbl, metrics.deepEffort.act[i], metrics.deepEffort.est[i], metrics.deepEffort.quoted[i]])} chartId="deepEffortLogChart" />
            </div>
          </div>
          
          <div className={styles.scrollWrapper} style={{ overflowX: 'auto', width: '100%' }}>
            <div id="wrap-deepEffortLogChart" style={{ minWidth: deepChartMinWidth, width: '100%' }}>
              <Chart type="bar" width="100%" height={450}
                series={[ { name: 'Actual', data: metrics.deepEffort.act.slice(0, localFilters.deepEffortLimit).map(v => Math.max(0.1, v)) }, { name: 'Estimated', data: metrics.deepEffort.est.slice(0, localFilters.deepEffortLimit).map(v => Math.max(0.1, v)) }, { name: 'Quoted', data: metrics.deepEffort.quoted.slice(0, localFilters.deepEffortLimit).map(v => Math.max(0.1, v)) } ]}
                options={getChartOptions('deepEffortLogChart', { 
                    chart: { stacked: false, animations: { enabled: false } }, colors: [palette.primary, palette.success, 'rgba(255,255,255,0.05)'], 
                    plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 4 } }, 
                    xaxis: { categories: metrics.deepEffort.labels.slice(0, localFilters.deepEffortLimit), labels: { style: { colors: palette.muted }, rotate: -45, trim: true, maxHeight: 160 } },
                    yaxis: { logarithmic: true, labels: { style: { colors: palette.muted }, formatter: (val) => (!val || val <= 0.1) ? "0" : fmtK(val) } },
                    dataLabels: { enabled: false }, legend: { position: 'top', horizontalAlign: 'left', labels: { colors: palette.muted } }
                })} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}