import React, { useState, useMemo } from 'react';
import styles from './TimesheetOps.module.css';

export default function TimesheetOps({ dataMatrix, syncMatrixData }) {
  const [activeTab, setActiveTab] = useState('pending'); 
  const [selectedPeriod, setSelectedPeriod] = useState('ALL');
  const [selectedEmp, setSelectedEmp] = useState('ALL');
  
  const [selectedURIs, setSelectedURIs] = useState(new Set()); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalDetails, setModalDetails] = useState(null); 

  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');

  // Relaxes string comparisons to handle hidden spaces or case mismatches safely
  const namesMatch = (name1, name2) => {
    return (name1 || "").trim().toLowerCase() === (name2 || "").trim().toLowerCase();
  };

  const getLastSunday = () => {
    let d = new Date();
    let day = d.getDay();
    let diff = day === 0 ? 7 : day;
    d.setDate(d.getDate() - diff);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };

  const dropdowns = useMemo(() => {
    if (!dataMatrix) return { periods: [], engineers: [] };
    const { timesheets = [], roster = [] } = dataMatrix;
    const lastSundayTs = getLastSunday();

    let uniquePeriods = [...new Set(timesheets.map(t => t.period).filter(p => p))];
    let validPeriods = uniquePeriods.filter(p => {
      if (p && p.includes('-')) {
        let startD = new Date(p.split('-')[0].trim()).getTime();
        return startD <= lastSundayTs;
      }
      return false;
    }).sort((a, b) => new Date(b.split('-')[0].trim()).getTime() - new Date(a.split('-')[0].trim()).getTime());

    let engineers = roster.filter(e => e.status === "Enabled").sort((a, b) => a.name.localeCompare(b.name));

    return { periods: validPeriods, engineers };
  }, [dataMatrix]);

  const tableData = useMemo(() => {
    if (!dataMatrix) return [];
    const { drafts = [], timesheets = [], tsDetails = [], roster = [], factTable = [], dimensionTable = {} } = dataMatrix;
    
    const lastSundayTs = getLastSunday();
    const activeRosterNames = roster.filter(r => r.status === "Enabled").map(r => r.name.trim().toLowerCase());
    let displayData = [];

    if (activeTab === 'drafts') {
      let groupedDrafts = {};
      drafts.forEach(d => {
        const cleanUser = (d.user || "").trim();
        if (!activeRosterNames.includes(cleanUser.toLowerCase())) return; 
        if (selectedEmp !== "ALL" && !namesMatch(d.user, selectedEmp)) return;
        if (d.date > lastSundayTs) return; 

        let key = `draft_${cleanUser}_${d.date}`;
        if (!groupedDrafts[key]) {
          groupedDrafts[key] = { id: key, user: d.user, periodStr: new Date(d.date).toLocaleDateString(), hours: 0, proj: 'N/A (Draft)', uri: 'draft', entries: [], ts: d.date, isDraft: true };
        }
        groupedDrafts[key].hours += d.act;
        groupedDrafts[key].entries.push({ dateStr: new Date(d.date).toLocaleDateString(), client: '-', project: 'Unsubmitted Draft', task: '-', comments: 'Draft mode hours', hours: d.act });
      });
      displayData = Object.values(groupedDrafts);
    } 
    else {
      let validTimesheets = timesheets.filter(t => {
        const cleanUser = (t.user || "").trim();
        if (!activeRosterNames.includes(cleanUser.toLowerCase())) return false; 

        let s = (t.status || "").toLowerCase();
        if (activeTab === 'pending' && !s.includes('waiting')) return false;
        if (activeTab === 'approved' && !s.includes('approved')) return false;
        if (activeTab === 'notsubmitted' && !s.includes('not submitted') && !s.includes('never')) return false;

        return true;
      });
      
      validTimesheets.forEach(t => {
        if (selectedEmp !== "ALL" && !namesMatch(t.user, selectedEmp)) return;
        if (selectedPeriod !== "ALL" && t.period !== selectedPeriod) return;

        let startTs = 0, endTs = Infinity;
        if (t.period && t.period.includes('-')) {
          let parts = t.period.split('-');
          let d1 = new Date(parts[0].trim()), d2 = new Date(parts[1].trim());
          if (!isNaN(d1.getTime())) startTs = d1.setHours(0,0,0,0);
          if (!isNaN(d2.getTime())) endTs = d2.setHours(23,59,59,999);
        }
        if (startTs > lastSundayTs) return;

        // Smart Fallback Math
        let matchedEntries = tsDetails.filter(d => namesMatch(d.user, t.user) && d.period === t.period);
        if (matchedEntries.length === 0 && factTable.length > 0) {
          const rawCubeMatches = factTable.filter(f => namesMatch(f.user, t.user) && f.date >= startTs && f.date <= endTs);
          matchedEntries = rawCubeMatches.map(f => ({
            dateStr: f.dateStr || new Date(f.date).toLocaleDateString(),
            client: f.client || "-", project: f.project, task: f.program || "General Task",
            comments: "Logged via Data Cube Baseline", hours: f.act
          }));
        }
        
        let primaryProj = "Standard Entry";
        if (matchedEntries.length > 0) {
          let projMap = {};
          matchedEntries.forEach(e => { projMap[e.project] = (projMap[e.project] || 0) + e.hours; });
          primaryProj = Object.keys(projMap).sort((a, b) => projMap[b] - projMap[a])[0];
        }

        displayData.push({
          id: `${t.uri}_${startTs}`, user: t.user, ts: startTs, periodStr: t.period, hours: t.hours, proj: primaryProj, uri: t.uri, isDraft: false,
          entries: matchedEntries.map(e => ({
            dateStr: e.dateStr, client: dimensionTable[e.project]?.client || e.client || "-", project: e.project, task: e.task, comments: e.comments, hours: e.hours
          }))
        });
      });
    }

    return displayData.sort((a, b) => b.ts - a.ts);
  }, [dataMatrix, activeTab, selectedPeriod, selectedEmp]);


  const handleTabChange = (tab) => { setActiveTab(tab); setSelectedURIs(new Set()); };

  const handleCheckboxToggle = (e, uri) => {
    e.stopPropagation();
    const newSet = new Set(selectedURIs);
    if (newSet.has(uri)) newSet.delete(uri); else newSet.add(uri);
    setSelectedURIs(newSet);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedURIs(new Set(tableData.filter(r => !r.isDraft && r.uri !== 'draft').map(r => r.uri)));
    else setSelectedURIs(new Set());
  };

  const handleBulkAction = async (action) => {
    if (selectedURIs.size === 0) return alert("Please select at least one timesheet.");
    const uris = Array.from(selectedURIs);
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/timesheets/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, uris })
      });
      const result = await response.json();
      if (response.ok) {
        alert(`SUCCESS: ${result.message}`);
        setSelectedURIs(new Set());
        if (syncMatrixData) syncMatrixData(true); 
      } else alert(`ERROR: ${result.error}`);
    } catch (e) { alert("Network error communicating with the backend."); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <div className={styles.titleArea}>
          <h2>Timesheet Operations</h2>
          <p>Review, audit, and approve historical hour logs.</p>
        </div>
      </div>

      <div className={styles.opsRibbon}>
        <div className={styles.tabContainer}>
          <button className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`} onClick={() => handleTabChange('pending')}>Pending Approvals</button>
          <button className={`${styles.tab} ${activeTab === 'notsubmitted' ? styles.active : ''}`} onClick={() => handleTabChange('notsubmitted')}>Not Submitted</button>
          <button className={`${styles.tab} ${activeTab === 'drafts' ? styles.active : ''}`} onClick={() => handleTabChange('drafts')}>Daily Drafts</button>
          <button className={`${styles.tab} ${activeTab === 'approved' ? styles.active : ''}`} onClick={() => handleTabChange('approved')}>Approved</button>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filters}>
            <select className={styles.filterSelect} value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
              <option value="ALL">All Engineers</option>
              {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
            <select className={styles.filterSelect} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
              <option value="ALL">All Valid Periods (Up to Last Sunday)</option>
              {dropdowns.periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {activeTab === 'pending' && (
            <div className={styles.actionButtons}>
              <button className={styles.btnDanger} disabled={isProcessing || selectedURIs.size === 0} onClick={() => handleBulkAction('reject')}>
                <i className='bx bx-x-circle'></i> Reject Selected
              </button>
              <button className={styles.btnPrimary} disabled={isProcessing || selectedURIs.size === 0} onClick={() => handleBulkAction('approve')}>
                {isProcessing ? <><i className='bx bx-loader-alt bx-spin'></i> Processing...</> : <><i className='bx bx-check-circle'></i> Approve Selected</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.premiumTable}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" className={styles.chkBox} disabled={activeTab !== 'pending'} 
                       checked={tableData.length > 0 && selectedURIs.size === tableData.length && activeTab === 'pending'} onChange={handleSelectAll} />
              </th>
              <th>Engineer</th>
              <th>Period</th>
              <th>Total Hours</th>
              <th>Status</th>
              <th>Primary Project Focus</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No records found matching filters.</td></tr>
            ) : (
              tableData.map(row => {
                let badgeClass = styles.bgPending; let badgeText = "Pending Approval";
                if (activeTab === 'drafts') { badgeClass = styles.bgDraft; badgeText = "Unsubmitted Draft"; }
                if (activeTab === 'approved') { badgeClass = styles.bgApproved; badgeText = "Approved"; }
                if (activeTab === 'notsubmitted') { badgeClass = styles.bgNotSubmitted; badgeText = "Not Submitted"; }
                return (
                  <tr key={row.id} onClick={() => setModalDetails(row)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className={styles.chkBox} checked={selectedURIs.has(row.uri)} onChange={(e) => handleCheckboxToggle(e, row.uri)} disabled={activeTab !== 'pending'} />
                    </td>
                    <td><div className={styles.userCell}><div className={styles.avatarSm}>{row.user.charAt(0)}</div>{row.user}</div></td>
                    <td>{row.periodStr}</td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{fmtInt(row.hours)} hrs</td>
                    <td><span className={`${styles.statusBadge} ${badgeClass}`}>{badgeText}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.proj}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalDetails && (
        <div className={styles.modalOverlay} onClick={() => setModalDetails(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                <div className={styles.avatarSm} style={{ width: '40px', height: '40px', fontSize: '1.2rem', background: 'var(--accent-blue)' }}>{modalDetails.user.charAt(0)}</div>
                <div>
                  <div style={{ color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 600 }}>{modalDetails.user}</div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 400 }}>{modalDetails.periodStr}</span>
                </div>
              </h3>
              <i className='bx bx-x' style={{ fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setModalDetails(null)}></i>
            </div>
            <div className={styles.modalBody}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', padding: '15px 25px 8px 25px', borderBottom: '1px solid var(--border-color)' }}>Time Entry Details</div>
              <table className={styles.detailTable}>
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Project &gt; Task</th><th>Comments</th><th style={{textAlign: 'right'}}>Hours</th></tr>
                </thead>
                <tbody>
                  {modalDetails.entries.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--accent-coral)' }}>No detailed line items synced for this period.</td></tr>
                  ) : (
                    modalDetails.entries.map((e, idx) => (
                      <tr key={idx}>
                        <td style={{ whiteSpace: 'nowrap' }}>{e.dateStr}</td>
                        <td>{e.client}</td>
                        <td><b>{e.project}</b><br/><span className={styles.cellDim}>↳ {e.task}</span></td>
                        <td style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{e.comments}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{e.hours}h</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <div style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 500 }}>
                Total: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{fmtInt(modalDetails.hours)}</span> hrs
              </div>
              <button className={styles.btnGhost} onClick={() => setModalDetails(null)}>Close View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}