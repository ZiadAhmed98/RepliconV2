import React, { useState, useMemo } from 'react';
import styles from './TimesheetOps.module.css';

export default function TimesheetOps({ dataMatrix, syncMatrixData }) {
  // =========================================================================
  // 1. COMPONENT STATE
  // =========================================================================
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved, notsubmitted, drafts
  const [selectedPeriod, setSelectedPeriod] = useState('ALL');
  const [selectedEmp, setSelectedEmp] = useState('ALL');
  
  const [selectedURIs, setSelectedURIs] = useState(new Set()); // For bulk actions
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalDetails, setModalDetails] = useState(null); // Holds data for the detail pop-up

  // =========================================================================
  // 2. HELPER FUNCTIONS
  // =========================================================================
  const fmtInt = (num) => Math.round(num || 0).toLocaleString('en-US');

  // Calculates the timestamp for the most recent Sunday
  const getLastSunday = () => {
    let d = new Date();
    let day = d.getDay();
    let diff = day === 0 ? 7 : day;
    d.setDate(d.getDate() - diff);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };

  // =========================================================================
  // 3. DATA PREPARATION (Dropdowns)
  // =========================================================================
  const dropdowns = useMemo(() => {
    if (!dataMatrix) return { periods: [], engineers: [] };
    const { timesheets = [], roster = [] } = dataMatrix;
    const lastSundayTs = getLastSunday();

    // Valid Periods <= Last Sunday
    let uniquePeriods = [...new Set(timesheets.map(t => t.period).filter(p => p))];
    let validPeriods = uniquePeriods.filter(p => {
      if (p && p.includes('-')) {
        let startD = new Date(p.split('-')[0].trim()).getTime();
        return startD <= lastSundayTs;
      }
      return false;
    }).sort((a, b) => new Date(b.split('-')[0].trim()).getTime() - new Date(a.split('-')[0].trim()).getTime());

    // Active Roster
    let engineers = roster.filter(e => e.status === "Enabled").sort((a, b) => a.name.localeCompare(b.name));

    return { periods: validPeriods, engineers };
  }, [dataMatrix]);

  // =========================================================================
  // 4. MAIN TABLE FILTER ENGINE
  // =========================================================================
  const tableData = useMemo(() => {
    if (!dataMatrix) return [];
    const { drafts = [], timesheets = [], tsDetails = [], roster = [], dimensionTable = {} } = dataMatrix;
    
    const lastSundayTs = getLastSunday();
    const activeRosterNames = roster.filter(r => r.status === "Enabled").map(r => r.name);
    let displayData = [];

    // --- VIEW: DRAFTS ---
    if (activeTab === 'drafts') {
      let groupedDrafts = {};
      drafts.forEach(d => {
        if (!activeRosterNames.includes(d.user)) return; 
        if (selectedEmp !== "ALL" && d.user !== selectedEmp) return;
        if (d.date > lastSundayTs) return; // Ignore future drafts

        let key = `draft_${d.user}_${d.date}`;
        if (!groupedDrafts[key]) {
          groupedDrafts[key] = { id: key, user: d.user, periodStr: new Date(d.date).toLocaleDateString(), hours: 0, proj: 'N/A (Draft)', uri: 'draft', entries: [], ts: d.date, isDraft: true };
        }
        groupedDrafts[key].hours += d.act;
        groupedDrafts[key].entries.push({ dateStr: new Date(d.date).toLocaleDateString(), client: '-', project: 'Unsubmitted Draft', task: '-', comments: '-', hours: d.act });
      });
      displayData = Object.values(groupedDrafts);
    } 
    // --- VIEW: TIMESHEETS (Pending, Approved, Not Submitted) ---
    else {
      let validTimesheets = timesheets.filter(t => {
        if (!activeRosterNames.includes(t.user)) return false; 

        let s = (t.status || "").toLowerCase();
        if (activeTab === 'pending' && !s.includes('waiting')) return false;
        if (activeTab === 'approved' && !s.includes('approved')) return false;
        if (activeTab === 'notsubmitted' && !s.includes('not submitted') && !s.includes('never')) return false;

        return true;
      });
      
      validTimesheets.forEach(t => {
        if (selectedEmp !== "ALL" && t.user !== selectedEmp) return;
        if (selectedPeriod !== "ALL" && t.period !== selectedPeriod) return;

        let startTs = 0;
        if (t.period && t.period.includes('-')) {
          let d1 = new Date(t.period.split('-')[0].trim());
          if (!isNaN(d1.getTime())) startTs = d1.getTime();
        }
        if (startTs > lastSundayTs) return;

        let matchedEntries = tsDetails.filter(d => d.user === t.user && d.period === t.period);
        
        // Find Primary Project (Most Hours)
        let primaryProj = "Standard Entry";
        if (matchedEntries.length > 0) {
          let projMap = {};
          matchedEntries.forEach(e => { projMap[e.project] = (projMap[e.project] || 0) + e.hours; });
          primaryProj = Object.keys(projMap).sort((a, b) => projMap[b] - projMap[a])[0];
        }

        displayData.push({
          id: t.uri, user: t.user, ts: startTs, periodStr: t.period, hours: t.hours, proj: primaryProj, uri: t.uri, isDraft: false,
          entries: matchedEntries.map(e => ({
            dateStr: e.dateStr, client: dimensionTable[e.project]?.client || "-", project: e.project, task: e.task, comments: e.comments, hours: e.hours
          }))
        });
      });
    }

    return displayData.sort((a, b) => b.ts - a.ts);
  }, [dataMatrix, activeTab, selectedPeriod, selectedEmp]);


  // =========================================================================
  // 5. EVENT HANDLERS
  // =========================================================================
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedURIs(new Set()); // Clear selections on tab switch
  };

  const handleCheckboxToggle = (e, uri) => {
    e.stopPropagation();
    const newSet = new Set(selectedURIs);
    if (newSet.has(uri)) newSet.delete(uri);
    else newSet.add(uri);
    setSelectedURIs(newSet);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allURIs = new Set(tableData.filter(r => !r.isDraft && r.uri !== 'draft').map(r => r.uri));
      setSelectedURIs(allURIs);
    } else {
      setSelectedURIs(new Set());
    }
  };

  // The Action fetcher to your Node.js server
  const handleBulkAction = async (action) => {
    if (selectedURIs.size === 0) return alert("Please select at least one timesheet.");
    const uris = Array.from(selectedURIs);
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/timesheets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, uris })
      });
      
      const result = await response.json();
      if (response.ok) {
        alert(`SUCCESS: ${result.message}`);
        setSelectedURIs(new Set());
        // Force the parent to wipe the cache and fetch fresh data so the table updates!
        if(syncMatrixData) syncMatrixData(true); 
      } else {
        alert(`ERROR: ${result.error}`);
      }
    } catch (e) {
      alert("Network error communicating with the backend.");
    } finally {
      setIsProcessing(false);
    }
  };

  // =========================================================================
  // 6. UI RENDER
  // =========================================================================
  return (
    <div>
      <div className={styles.headerArea}>
        <div className={styles.titleArea}>
          <h2>Timesheet Operations</h2>
          <p>Review, audit, and batch process engineer submissions.</p>
        </div>
      </div>

      <div className={styles.opsRibbon}>
        <div className={styles.tabContainer}>
          <button className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`} onClick={() => handleTabChange('pending')}>Pending Approval</button>
          <button className={`${styles.tab} ${activeTab === 'notsubmitted' ? styles.active : ''}`} onClick={() => handleTabChange('notsubmitted')}>Not Submitted</button>
          <button className={`${styles.tab} ${activeTab === 'drafts' ? styles.active : ''}`} onClick={() => handleTabChange('drafts')}>Unsubmitted Drafts</button>
          <button className={`${styles.tab} ${activeTab === 'approved' ? styles.active : ''}`} onClick={() => handleTabChange('approved')}>Historically Approved</button>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filters}>
            <select className={styles.filterSelect} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
              <option value="ALL">All Valid Periods (Up to Last Sunday)</option>
              {dropdowns.periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className={styles.filterSelect} value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
              <option value="ALL">All Engineers</option>
              {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
          </div>

          {activeTab === 'pending' && (
            <div className={styles.actionButtons}>
              <button className="btn-ghost" style={{ color: 'var(--accent-red)', borderColor: 'rgba(244,63,94,0.3)' }} disabled={isProcessing || selectedURIs.size === 0} onClick={() => handleBulkAction('reject')}>
                <i className='bx bx-x-circle'></i> Reject
              </button>
              <button className="btn-primary" style={{ background: 'var(--accent-green)', color: '#fff' }} disabled={isProcessing || selectedURIs.size === 0} onClick={() => handleBulkAction('approve')}>
                {isProcessing ? <><i className='bx bx-loader-alt bx-spin'></i> Processing...</> : <><i className='bx bx-check-double'></i> Batch Approve</>}
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
                       checked={tableData.length > 0 && selectedURIs.size === tableData.length && activeTab === 'pending'} 
                       onChange={handleSelectAll} title="Select All" />
              </th>
              <th>Engineer Name</th>
              <th>Timesheet Period</th>
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

                const isChecked = selectedURIs.has(row.uri);

                return (
                  <tr key={row.id} onClick={() => setModalDetails(row)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className={styles.chkBox} value={row.uri} checked={isChecked} onChange={(e) => handleCheckboxToggle(e, row.uri)} disabled={activeTab !== 'pending'} />
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

      {/* --- DETAIL MODAL --- */}
      {modalDetails && (
        <div className={styles.modalOverlay} onClick={() => setModalDetails(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                <div className={styles.avatarSm}>{modalDetails.user.charAt(0)}</div>
                {modalDetails.user} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>| {modalDetails.periodStr}</span>
              </h3>
              <i className='bx bx-x' style={{ fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setModalDetails(null)}></i>
            </div>
            
            <div className={styles.modalBody}>
              <table className={styles.detailTable}>
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Project / Task</th><th>Comments</th><th style={{textAlign: 'right'}}>Hours</th></tr>
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
              <div style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Total Period Effort: <span style={{ color: '#fff', fontWeight: 600, marginLeft: '5px' }}>{fmtInt(modalDetails.hours)} hrs</span>
              </div>
              <button className="btn-ghost" onClick={() => setModalDetails(null)}>Close View</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}