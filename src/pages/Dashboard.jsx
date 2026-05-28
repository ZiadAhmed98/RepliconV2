import React, { useState, useMemo, useRef, useEffect } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import styles from './Dashboard.module.css';
import ComplianceModal from '../components/ComplianceModal';

export default function Dashboard({ dataMatrix }) {
  // =========================================================================
  // 1. COMPONENT STATE & LOCAL CHART FILTERS
  // =========================================================================
  const [compView, setCompView] = useState('daily');
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Localized Chart Slicing (Independent of Global State)
  const [localFilters, setLocalFilters] = useState({
    trendMonths: 12, // Default to Last 12 Months
    deepEffortLimit: 20 // Default to Top 20 Projects
  });
  
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

  // =========================================================================
  // 3. THE CALCULATION ENGINE
  // =========================================================================
  const metrics = useMemo(() => {
    let tAct = 0, tEst = 0, tQuoted = 0, activeStatus = 0, compStatus = 0, billableHrs = 0, overheadHrs = 0;
    let overburnData = [], atRiskData = [], rolloffArray = [], timeTrendMap = {}, statusCounts = {};
    let empHoursMap = {}, locMap = {}, activeClientsSet = new Set(), activeProjectsSet = new Set(), activeProgramsSet = new Set();

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
      
      if (row.user && row.user !== "Unknown") empHoursMap[row.user] = (empHoursMap[row.user] || 0) + row.act;
      if (row.location && row.location !== "Unknown") locMap[row.location] = (locMap[row.location] || 0) + row.act;
      
      if (row.date > 0) {
        let d = new Date(row.date);
        let key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        timeTrendMap[key] = (timeTrendMap[key] || 0) + row.act;
      }
    });

    let projLabels = [], projAct = [], projEst = [], projQuoted = [];
    
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

      if (isActive && pData.est > 0 && (pData.program || "").toLowerCase().includes("deployment")) {
        atRiskData.push({ name: pName, burn: Math.round((periodActual / pData.est) * 100) });
      }

      if (periodActual > pData.est && pData.est > 0) {
        overburnData.push({ name: pName, act: periodActual, est: pData.est, overburn: periodActual - pData.est });
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
      atRisk: atRiskData.sort((a, b) => b.burn - a.burn).slice(0, 5),
      statusLabels: Object.keys(statusCounts), statusData: Object.values(statusCounts),
      rolloffs: rolloffArray.sort((a,b) => a.end - b.end).slice(0, 5),
      trend: { labels: trendLabels, act: trendActuals, cap: trendCapacity },
      deepEffort: { labels: projLabels, act: projAct, est: projEst, quoted: projQuoted },
      compliance: compliance, activeClientsCount: activeClientsSet.size,
      dropdowns: { clients: Array.from(allClients).sort(), projects: Array.from(allProjects).sort(), programs: Array.from(allPrograms).sort() },
      dimensionTable 
    };
  }, [dataMatrix, filters]);

  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');
  const fmtK = (num) => num > 999 ? (num/1000).toFixed(1) + 'k' : num;

  // =========================================================================
  // 4. THE EXECUTIVE PDF REPORT GENERATOR
  // =========================================================================
  const exportChartToPDF = async (chartId, title, tableHeaders, tableRows) => {
    try {
      // 1. Hook into ApexCharts API to grab a clean Base64 image
      const { imgURI } = await ApexCharts.exec(chartId, 'dataURI');
      
      // 2. Initialize PDF Document (A4 Portrait)
      const doc = new jsPDF('p', 'pt', 'a4');
      
      // 3. Document Styling & Title
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(title, 40, 45);
      
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 40, 60);

      // 4. Draw Chart Image
      if (imgURI) {
        // Black background box to make Apple Glass charts pop in the PDF
        doc.setFillColor(20, 20, 25);
        doc.rect(40, 80, 515, 230, 'F');
        doc.addImage(imgURI, 'PNG', 40, 80, 515, 230);
      }

      // 5. Draw the Dynamic Data Table underneath the image
      doc.autoTable({
        startY: 330,
        head: [tableHeaders],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [168, 85, 247], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: 50 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 40, right: 40 }
      });

      // 6. Output Download
      doc.save(`${title.replace(/\s+/g, '_')}_Executive_Report.pdf`);
    } catch (err) {
      console.error("PDF Generation Error: ", err);
      alert("Failed to export PDF. Please try again.");
    }
  };

  // =========================================================================
  // 5. APEXCHARTS CONFIGURATION FACTORY
  // =========================================================================
  const getChartOptions = (id, title, headers, dataRows, customOptions = {}) => {
    return {
      chart: {
        id: id,
        background: '#141419', // Ensures exported PNGs have a dark backing, not transparent messes
        toolbar: {
          show: true,
          tools: {
            download: true, // Native PNG, SVG, CSV
            selection: true, zoom: true, pan: true,
            // OUR CUSTOM EXECUTIVE PDF BUTTON
            customIcons: [{
              icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#98989d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
              index: 0,
              title: 'Export to Executive PDF',
              class: 'custom-icon',
              click: function () {
                exportChartToPDF(id, title, headers, dataRows);
              }
            }]
          }
        },
        ...customOptions.chart
      },
      theme: { mode: 'dark' },
      grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
      ...customOptions
    };
  };

  // Full Dashboard PDF Backup Handler
  const handlePrintFullDashboardPDF = async () => {
    if (!window.html2pdf) return alert("Full Dashboard PDF Engine loading. Try again in a moment.");
    const pdfContainer = document.getElementById('pdf-table-container');
    if (pdfContainer) pdfContainer.style.display = 'block';
    try {
      await window.html2pdf().set({ margin: 0.5, filename: `Dashboard_Export_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0a0c' }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' } }).from(dashboardRef.current).save();
    } catch (e) { alert("Failed to generate PDF."); } finally {
      if (pdfContainer) pdfContainer.style.display = 'none'; 
    }
  };

  return (
    <div ref={dashboardRef}>
      <ComplianceModal isOpen={isCompModalOpen} onClose={() => setIsCompModalOpen(false)} viewType={compView} dataMatrix={dataMatrix} />

      {/* --- HEADER & CONTROLS --- */}
      <div className={styles.sectionHeader} style={{ position: 'relative' }}>
        <div className={styles.titleArea}>
          <h2 className={styles.sectionTitle}>Analytics Overview</h2>
          <div className="badges-container">
            <span className="badge-base period-badge">{filters.timePreset}</span>
            {filters.client !== 'All' && <span className="badge-base active-filter-badge">{filters.client}</span>}
            {filters.program !== 'All' && <span className="badge-base active-filter-badge">{filters.program}</span>}
          </div>
        </div>

        <div className={styles.actionHeader}>
          <div className={styles.actionBtn} onClick={handlePrintFullDashboardPDF} title="Export Full Dashboard"><i className='bx bx-export'></i></div>
          <div className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }} title="Toggle Filters"><i className='bx bx-filter-alt'></i></div>
        </div>

        {/* --- INTERACTIVE FILTER PANEL --- */}
        {showFilters && (
          <div className={styles.filterPanel} ref={filterPanelRef}>
            <h4>Global Filters <i className='bx bx-x' style={{ cursor: 'pointer' }} onClick={() => setShowFilters(false)}></i></h4>
            
            <div className={styles.filterGroup}>
              <label>Client</label>
              <select className={styles.formControl} value={filters.client} onChange={e => setFilters({...filters, client: e.target.value})}>
                <option value="All">All Clients</option>
                {metrics.dropdowns.clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Program</label>
              <select className={styles.formControl} value={filters.program} onChange={e => setFilters({...filters, program: e.target.value})}>
                <option value="All">All Programs</option>
                {metrics.dropdowns.programs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Project</label>
              <select className={styles.formControl} value={filters.project} onChange={e => setFilters({...filters, project: e.target.value})}>
                <option value="All">All Projects</option>
                {metrics.dropdowns.projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className={styles.filterGroup} style={{ marginTop: '20px' }}>
              <label>Time Period</label>
              <select className={styles.formControl} value={filters.timePreset} onChange={handlePresetChange}>
                <option value="All Time">All Time</option>
                <option value="This Week">This Week</option>
                <option value="MTD">Month to Date (MTD)</option>
                <option value="Custom">Custom Range</option>
              </select>
            </div>

            <div className={styles.dateRangeRow}>
              <div><label>From</label><input type="date" className={styles.formControl} value={filters.dateFrom} onChange={e => setFilters({...filters, timePreset: 'Custom', dateFrom: e.target.value})} /></div>
              <div><label>To</label><input type="date" className={styles.formControl} value={filters.dateTo} onChange={e => setFilters({...filters, timePreset: 'Custom', dateTo: e.target.value})} /></div>
            </div>

            <div className={styles.filterActions}>
              <button className={styles.clearBtn} onClick={handleClearFilters}>Reset</button>
              <button className={styles.applyBtn} onClick={() => setShowFilters(false)}>Apply</button>
            </div>
          </div>
        )}
      </div>

      {/* --- TOP KPI ROW --- */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card"><div><p>Active Clients</p><h3>{metrics.activeClientsCount}</h3></div><div className="trend"><i className='bx bx-briefcase'></i> <span>Portfolio</span></div></div>
        <div className="kpi-card"><div><p>Total Projects</p><h3>{metrics.kpis.totalProjects}</h3></div><div className="trend"><i className='bx bx-folder'></i> <span>Baseline</span></div></div>
        <div className="kpi-card"><div><p>In Progress</p><h3 style={{ color: 'var(--accent-blue)' }}>{metrics.kpis.activeProjects}</h3></div><div className="trend"><i className='bx bx-pulse'></i> <span>Current</span></div></div>
        <div className="kpi-card"><div><p>Completed</p><h3 style={{ color: 'var(--accent-green)' }}>{metrics.kpis.completedProjects}</h3></div><div className="trend"><i className='bx bx-check-circle'></i> <span>Current</span></div></div>
        <div className="kpi-card"><div><p>Actual Hours</p><h3>{fmtInt(metrics.kpis.actual)}</h3></div><div className="trend"><i className='bx bx-time'></i> <span>Period Effort</span></div></div>
        <div className="kpi-card"><div><p>Estimated Hours</p><h3>{fmtInt(metrics.kpis.estimated)}</h3></div><div className="trend"><i className='bx bx-target-lock'></i> <span>Baseline</span></div></div>
        <div className="kpi-card"><div><p>Quoted Hours</p><h3>{fmtInt(metrics.kpis.quoted)}</h3></div><div className="trend"><i className='bx bx-file'></i> <span>Contracted</span></div></div>
        
        <div className={`kpi-card ${styles.complianceCard}`} onClick={() => setIsCompModalOpen(true)}>
          <div className={styles.compControls}>
            <i className='bx bx-chevron-left' onClick={(e) => { e.stopPropagation(); setCompView('daily'); }}></i>
            <i className='bx bx-chevron-right' onClick={(e) => { e.stopPropagation(); setCompView('weekly'); }}></i>
          </div>
          <div><p>{compView === 'daily' ? "Daily Deficits" : "Weekly Deficits"}</p><h3 style={{ color: 'var(--accent-coral)' }}>{compView === 'daily' ? metrics.compliance.dailyDeficits : metrics.compliance.weeklyDeficits}</h3></div>
          <div className={styles.sparklineContainer}>
            <Chart type="area" width="100%" height={35} series={[{ name: 'Deficits', data: metrics.compliance.sparkline || [] }]} options={{ chart: { sparkline: { enabled: true }, background: 'transparent' }, stroke: { curve: 'smooth', width: 2 }, colors: ['#ff3b30'], fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 100] } }, tooltip: { enabled: true, theme: 'dark', y: { title: { formatter: () => '' } } } }} />
          </div>
        </div>
      </div>

      {/* --- CHART ROW 1: PORTFOLIO & RANKINGS --- */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-pie-chart-alt-2' style={{ color: 'var(--accent-purple)' }}></i> Total Portfolio Burn</h4>
          <div className={styles.chartWrapper}>
            <Chart type="area" width="100%" height={320}
              series={[ { name: 'Quoted', data: metrics.deepEffort.quoted }, { name: 'Estimated', data: metrics.deepEffort.est }, { name: 'Actual', data: metrics.deepEffort.act } ]}
              options={getChartOptions(
                'portfolioBurnChart', 'Total Portfolio Burn', 
                ['Project Name', 'Actual Hrs', 'Est Hrs', 'Quoted Hrs'], 
                metrics.deepEffort.labels.map((lbl, i) => [lbl, metrics.deepEffort.act[i], metrics.deepEffort.est[i], metrics.deepEffort.quoted[i]]),
                {
                  chart: { stacked: true },
                  colors: ['rgba(255,255,255,0.05)', '#6366f1', '#a855f7'], 
                  stroke: { curve: 'smooth', width: [1, 2, 2] }, 
                  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.6, opacityTo: 0.1, stops: [0, 100] } },
                  dataLabels: { enabled: false }, 
                  xaxis: { categories: metrics.deepEffort.labels, labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
                  yaxis: { labels: { formatter: (v) => fmtK(v), style: { colors: '#8e8e93' } } }, 
                  legend: { position: 'top', labels: { colors: '#8e8e93' } }, 
                  tooltip: { theme: 'dark' }
                }
              )} 
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-bar-chart-alt-2' style={{ color: 'var(--accent-blue)' }}></i> All-Time Top Clients</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={320} 
              series={[{ name: 'Hours', data: metrics.topClients.map(c => Math.round(c.val)) }]} 
              options={getChartOptions(
                'topClientsChart', 'Top Clients by Volume', 
                ['Client Name', 'Total Hours'], 
                metrics.topClients.map(c => [c.name, Math.round(c.val)]),
                { 
                  colors: ['#a855f7'], 
                  plotOptions: { bar: { horizontal: false, borderRadius: 6, distributed: true, columnWidth: '45%' } }, 
                  dataLabels: { enabled: false }, 
                  xaxis: { categories: metrics.topClients.map(c => c.name), labels: { style: { colors: '#8e8e93' }, rotate: -45, trim: true } }, 
                  legend: { show: false } 
                }
              )} 
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-trophy' style={{ color: 'var(--accent-yellow)' }}></i> Top Employees</h4>
          <div className={styles.chartWrapper}>
            <ul className={styles.insightList}>
              {metrics.topEmployees.map((e, i) => <li key={i} className={styles.insightItem}><div className={styles.insightInfo}><div className={styles.insightRank}>{i + 1}</div><span className={styles.insightName}>{e.name}</span></div><span className={styles.insightVal}>{fmtInt(e.val)} hrs</span></li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* --- CHART ROW 2: TRENDS & RATIOS --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-line-chart' style={{ color: 'var(--accent-purple)' }}></i> Burn Trend vs Capacity</h4>
            {/* LOCAL FILTER: Modifies only this chart */}
            <select className={styles.formControl} style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }} value={localFilters.trendMonths} onChange={e => setLocalFilters({...localFilters, trendMonths: parseInt(e.target.value)})}>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
              <option value={999}>All Time</option>
            </select>
          </div>
          
          <div className={styles.chartWrapper}>
            <Chart type="line" width="100%" height={320} 
              series={[ 
                { name: 'Capacity', type: 'line', data: metrics.trend.cap.slice(-localFilters.trendMonths) }, 
                { name: 'Actual Burn', type: 'area', data: metrics.trend.act.slice(-localFilters.trendMonths) } 
              ]} 
              options={getChartOptions(
                'burnTrendChart', 'Historical Burn vs Capacity', 
                ['Month', 'Actual Burn', 'Team Capacity'], 
                metrics.trend.labels.slice(-localFilters.trendMonths).map((l, i) => [l, metrics.trend.act.slice(-localFilters.trendMonths)[i], metrics.trend.cap.slice(-localFilters.trendMonths)[i]]),
                { 
                  colors: ['#8e8e93', '#a855f7'], 
                  stroke: { curve: 'smooth', width: [3, 2] }, 
                  fill: { type: ['solid', 'gradient'], gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.05, stops: [0, 100] } }, 
                  xaxis: { categories: metrics.trend.labels.slice(-localFilters.trendMonths), labels: { style: { colors: '#8e8e93' } }, axisBorder: { show: false }, axisTicks: { show: false } }, 
                  yaxis: { labels: { formatter: (v) => fmtInt(v), style: { colors: '#8e8e93' } } }, 
                  legend: { position: 'top', labels: { colors: '#8e8e93' } }, 
                  tooltip: { theme: 'dark' } 
                }
              )} 
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-doughnut-chart' style={{ color: 'var(--accent-blue)' }}></i> Billable vs Non-Billable</h4>
          <div className={styles.chartWrapper}>
            <Chart type="donut" width="100%" height={320} 
              series={[metrics.billable, metrics.overhead]} 
              options={getChartOptions(
                'billableRatioChart', 'Billable vs Overhead Ratio', 
                ['Classification', 'Total Hours'], 
                [['Billable Hours', metrics.billable], ['Non-Billable (Overhead)', metrics.overhead]],
                { 
                  labels: ['Billable', 'Non-Billable'], 
                  colors: ['#a855f7', 'rgba(255,255,255,0.05)'], 
                  stroke: { width: 0 }, 
                  plotOptions: { pie: { donut: { size: '75%' } } }, 
                  dataLabels: { enabled: false }, 
                  legend: { position: 'bottom', labels: { colors: '#8e8e93' } } 
                }
              )} 
            />
          </div>
        </div>
      </div>

      {/* --- CHART ROW 3: RISKS & STATUS --- */}
      <div className={styles.chartRow}>
        <div className="chart-card">
          <h4><i className='bx bx-error-circle' style={{ color: 'var(--accent-red)' }}></i> Revenue Leakage</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={300} 
              series={[ { name: 'Est Budget', data: metrics.overburn.map(p => -p.est) }, { name: 'Act Burn', data: metrics.overburn.map(p => p.act) } ]} 
              options={getChartOptions(
                'leakageChart', 'Project Overburn & Leakage', 
                ['Project Name', 'Original Estimate', 'Actual Burn', 'Overage Hours'], 
                metrics.overburn.map(p => [p.name, p.est, p.act, p.overburn]),
                { 
                  chart: { stacked: true }, 
                  colors: ['rgba(255,255,255,0.1)', '#ff3b30'], 
                  plotOptions: { bar: { horizontal: true, borderRadius: 4 } }, 
                  xaxis: { categories: metrics.overburn.map(p => p.name), min: -metrics.bfMax, max: metrics.bfMax, labels: { style: { colors: '#8e8e93' }, formatter: (v) => fmtK(Math.abs(v)) } }, 
                  yaxis: { labels: { style: { colors: '#8e8e93' }, maxWidth: 150 } }, 
                  dataLabels: { enabled: false }, 
                  legend: { show: false }, 
                  tooltip: { theme: 'dark' } 
                }
              )} 
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-radar' style={{ color: 'var(--accent-coral)' }}></i> At-Risk Projects (Burn %)</h4>
          <div className={styles.chartWrapper}>
            <Chart type="bar" width="100%" height={300} 
              series={[{ name: 'Burn %', data: metrics.atRisk.map(r => r.burn) }]} 
              options={getChartOptions(
                'atRiskChart', 'At-Risk Projects by Burn Rate', 
                ['Project Name', 'Burn Percentage'], 
                metrics.atRisk.map(r => [r.name, r.burn + '%']),
                { 
                  colors: ['#ff3b30'], 
                  plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '40%' } }, 
                  dataLabels: { enabled: true, formatter: (val) => Math.round(val) + "%", textAnchor: 'start', style: { colors: ['#fff'] } }, 
                  xaxis: { categories: metrics.atRisk.map(r => r.name), max: 100, labels: { style: { colors: '#8e8e93' } } }, 
                  yaxis: { labels: { style: { colors: '#8e8e93' }, maxWidth: 150 } }, 
                  grid: { show: false }, 
                  tooltip: { theme: 'dark' } 
                }
              )} 
            />
          </div>
        </div>
        
        <div className="chart-card">
          <h4><i className='bx bx-task' style={{ color: 'var(--accent-green)' }}></i> Active Projects by Status</h4>
          <div className={styles.chartWrapper}>
            <Chart type="donut" width="100%" height={300} 
              series={metrics.statusData.length ? metrics.statusData : [1]} 
              options={getChartOptions(
                'statusChart', 'Project Volume by Status', 
                ['Status Stage', 'Number of Projects'], 
                metrics.statusLabels.map((s, i) => [s, metrics.statusData[i]]),
                { 
                  labels: metrics.statusLabels.length ? metrics.statusLabels : ['No Data'], 
                  colors: ['#a855f7', '#32ade6', '#34c759', '#ffcc00', '#ff3b30'], 
                  stroke: { width: 0 }, 
                  plotOptions: { pie: { donut: { size: '75%' } } }, 
                  dataLabels: { enabled: false }, 
                  legend: { position: 'bottom', labels: { colors: '#8e8e93' } } 
                }
              )} 
            />
          </div>
        </div>
      </div>

      {/* --- CHART ROW 4: FORECASTING --- */}
      <div className={styles.chartRowHalf}>
        <div className="chart-card">
          <h4><i className='bx bx-calendar-event' style={{ color: 'var(--text-main)' }}></i> Deployment Availability Forecasting</h4>
          <div className={styles.chartWrapper} style={{ overflowY: 'auto' }}>
            <table className={styles.premiumTable}>
              <thead><tr><th>Project Ending</th><th>Date</th><th>Engineers Rolling Off</th></tr></thead>
              <tbody>{metrics.rolloffs.map((r, i) => <tr key={i}><td>{r.name}</td><td>{new Date(r.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td><div className={styles.teamTags}>{r.engineers.map((e, j) => <span key={j}>{e.split(' ')[0]}</span>)}</div></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="chart-card">
          <h4><i className='bx bx-map' style={{ color: 'var(--accent-blue)' }}></i> Locations Overview</h4>
          <div className={styles.chartWrapper} style={{ overflowY: 'auto' }}>
            <div className={styles.locationList}>{metrics.locations.map((loc, idx) => { const maxLoc = metrics.locations[0]?.val || 1; return <div key={idx} className={styles.locItem}><div className={styles.locHeader}><span>{loc.name}</span><span className={styles.locVal}>{fmtInt(loc.val)} hrs</span></div><div className={styles.progress}><div className={styles.progressBar} style={{ width: `${(loc.val / maxLoc) * 100}%` }}></div></div></div> })}</div>
          </div>
        </div>
      </div>

      {/* --- FINAL ROW: DEEP EFFORT ANALYSIS --- */}
      <div className={styles.chartRow}>
        <div className={`chart-card ${styles.fullWidth}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h4 style={{ margin: 0 }}><i className='bx bx-bar-chart-square' style={{ color: 'var(--text-main)' }}></i> Deep Project Delivery Analysis</h4>
            {/* LOCAL FILTER: Limits amount of projects shown to prevent clutter */}
            <select className={styles.formControl} style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }} value={localFilters.deepEffortLimit} onChange={e => setLocalFilters({...localFilters, deepEffortLimit: parseInt(e.target.value)})}>
              <option value={10}>Top 10 Active Projects</option>
              <option value={20}>Top 20 Active Projects</option>
              <option value={50}>Top 50 Active Projects</option>
              <option value={9999}>View All Projects</option>
            </select>
          </div>
          
          <div className={styles.scrollWrapper}>
            <div style={{ width: Math.max(1200, Math.min(metrics.deepEffort.labels.length, localFilters.deepEffortLimit) * 80) + 'px' }}>
              <Chart type="bar" width="100%" height={450}
                series={[ 
                  { name: 'Actual', data: metrics.deepEffort.act.slice(0, localFilters.deepEffortLimit).map(v => Math.max(0.1, v)) }, 
                  { name: 'Estimated', data: metrics.deepEffort.est.slice(0, localFilters.deepEffortLimit).map(v => Math.max(0.1, v)) }, 
                  { name: 'Quoted', data: metrics.deepEffort.quoted.slice(0, localFilters.deepEffortLimit).map(v => Math.max(0.1, v)) } 
                ]}
                options={getChartOptions(
                  'deepEffortLogChart', 'Logarithmic Project Analysis', 
                  ['Project Name', 'Actual', 'Estimated', 'Quoted'], 
                  metrics.deepEffort.labels.slice(0, localFilters.deepEffortLimit).map((lbl, i) => [lbl, metrics.deepEffort.act[i], metrics.deepEffort.est[i], metrics.deepEffort.quoted[i]]),
                  { 
                    chart: { stacked: false, animations: { enabled: false } }, 
                    colors: ['#a855f7', '#32ade6', 'rgba(255,255,255,0.1)'], 
                    plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 4 } }, 
                    xaxis: { categories: metrics.deepEffort.labels.slice(0, localFilters.deepEffortLimit), labels: { style: { colors: '#8e8e93' }, rotate: -45, trim: true, maxHeight: 160 } },
                    yaxis: { logarithmic: true, labels: { style: { colors: '#8e8e93' }, formatter: (val) => val <= 0.1 ? "0" : fmtK(val) } },
                    dataLabels: { enabled: false },
                    legend: { position: 'top', horizontalAlign: 'left', labels: { colors: '#8e8e93' } }, 
                    tooltip: { theme: 'dark', y: { formatter: (val) => val <= 0.1 ? "0" : fmtInt(val) } }
                  }
                )} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- HIDDEN PDF EXPORT TABLE (Used only by the massive global button) --- */}
      <div id="pdf-table-container" className={styles.pdfContainer}>
        <div className={`chart-card ${styles.fullWidth}`} style={{ background: 'var(--bg-card)', border: 'none', boxShadow: 'none' }}>
          <h4 style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--accent-blue)' }}>Detailed Filtered Report</h4>
          <table className={styles.premiumTable}>
            <thead><tr><th>Project Name</th><th>Client</th><th>Status</th><th style={{textAlign:'right'}}>Actual Hrs</th><th style={{textAlign:'right'}}>Est. Hrs</th><th style={{textAlign:'right'}}>Quoted Hrs</th></tr></thead>
            <tbody>
              {Object.keys(metrics.dimensionTable).map(pName => {
                const pData = metrics.dimensionTable[pName];
                const actHrs = metrics.deepEffort.labels.includes(pName) ? metrics.deepEffort.act[metrics.deepEffort.labels.indexOf(pName)] : 0;
                if (actHrs > 0 || pData.est > 0) {
                  return (
                    <tr key={pName} style={{ breakInside: 'avoid' }}>
                      <td style={{ color: '#fff', fontWeight: 500 }}>{pName}</td>
                      <td>{pData.client}</td>
                      <td style={{ color: pData.status === 'In Progress' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>{pData.status}</td>
                      <td style={{ color: '#fff', textAlign: 'right', fontWeight: 600 }}>{fmtInt(actHrs)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtInt(pData.est)}</td>
                      <td style={{ color: 'var(--accent-yellow)', textAlign: 'right' }}>{fmtInt(pData.quoted)}</td>
                    </tr>
                  )
                }
                return null;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}