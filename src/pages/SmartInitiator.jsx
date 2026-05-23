import React, { useState, useMemo, useRef } from 'react';
import styles from './SmartInitiator.module.css';

export default function SmartInitiator({ dataMatrix, syncMatrixData }) {
  // =========================================================================
  // 1. DATA EXTRACTION
  // =========================================================================
  const dropdowns = useMemo(() => {
    let clients = new Set();
    let programs = new Set();
    let locations = new Set();
    
    // Extract from dimension table if it exists
    if (dataMatrix && dataMatrix.dimensionTable) {
      Object.values(dataMatrix.dimensionTable).forEach(p => {
        if (p.client && p.client !== "Unknown") clients.add(p.client);
        if (p.program && p.program !== "Unknown" && p.program !== "Unassigned") programs.add(p.program);
      });
    }

    // Extract locations and fallback clients/programs from the raw cube
    if (dataMatrix && dataMatrix.cube) {
        dataMatrix.cube.forEach(row => {
            if (row.client && row.client !== "Unknown") clients.add(row.client);
            if (row.program && row.program !== "Unknown" && row.program !== "Unassigned") programs.add(row.program);
            if (row.location && row.location !== "Unknown") locations.add(row.location);
        });
    }

    const roster = dataMatrix?.roster || [];
    const activeEngineers = roster.filter(e => e.status === "Enabled").sort((a,b) => a.name.localeCompare(b.name));
    const accountManagers = dataMatrix?.accountManagers || [];

    return {
      clients: Array.from(clients).sort(),
      programs: Array.from(programs).sort(),
      locations: Array.from(locations).sort(),
      engineers: activeEngineers,
      accountManagers: accountManagers
    };
  }, [dataMatrix]);

  // =========================================================================
  // 2. COMPONENT STATE (Mapped to RIA Template)
  // =========================================================================
  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  
  const [formData, setFormData] = useState({
    // Core Details
    projectName: '', 
    projectCode: '', 
    clientName: '', 
    clientRepresentative: '',
    programName: '',
    projectManager: '',
    department: '',
    location: '',
    startDate: '', 
    endDate: '',
    
    // Billing & Configuration
    status: 'In Progress', 
    percentCompleted: '0',
    billingType: 'Time & Materials',
    allowTimeEntry: 'Yes',
    clientBillingRateCopy: 'Keep Existing Billing Rates',
    timeAndExpenseEntry: 'Billable & Non-Billable',
    projectLeaderApprovalRequired: 'Yes',
    quotedHours: '',
    internalStatus: '',
    internalRemarks: ''
  });

  const [tasks, setTasks] = useState([]);

  // =========================================================================
  // 3. XML PARSER LOGIC (Unchanged)
  // =========================================================================
  const handleXMLUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(evt.target.result, "text/xml");
        
        if (xml.getElementsByTagName("parsererror").length > 0) {
          alert("Invalid XML Format. Please export a valid XML from MS Project.");
          return;
        }

        const taskNodes = xml.getElementsByTagName('Task');
        let parsedTasks = [];

        for (let i = 0; i < taskNodes.length; i++) {
          const t = taskNodes[i];
          const isSummary = t.getElementsByTagName('Summary')[0]?.textContent === "1";
          const nameNode = t.getElementsByTagName('Name')[0]?.textContent;
          
          if (!nameNode) continue; 
          
          const startStr = t.getElementsByTagName('Start')[0]?.textContent || '';
          const endStr = t.getElementsByTagName('Finish')[0]?.textContent || '';
          
          const durationNode = t.getElementsByTagName('Duration')[0]?.textContent || '';
          let hours = 0;
          
          const hMatch = durationNode.match(/(\d+)H/);
          const mMatch = durationNode.match(/(\d+)M/);
          
          if (hMatch) hours += parseInt(hMatch[1], 10);
          if (mMatch) hours += parseInt(mMatch[1], 10) / 60; 
          
          const formattedDuration = durationNode ? `${hours} hrs` : '-';
          
          parsedTasks.push({
            id: `task_${i}`,
            name: nameNode,
            start: startStr.split('T')[0] || '-',
            end: endStr.split('T')[0] || '-',
            duration: formattedDuration,
            isMilestone: isSummary, 
            assignees: isSummary ? [] : [''] 
          });
        }
        
        setTasks(parsedTasks);
      } catch (error) {
        console.error("XML Parsing Error:", error);
        alert("Error parsing file. Ensure it is a valid MS Project XML export.");
      }
    };
    reader.readAsText(file);
  };

  const handleAssigneeChange = (taskIndex, assigneeIndex, value) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].assignees[assigneeIndex] = value;
    setTasks(newTasks);
  };

  const addAssignee = (taskIndex) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].assignees.push('');
    setTasks(newTasks);
  };

  const removeAssignee = (taskIndex, assigneeIndex) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].assignees.splice(assigneeIndex, 1);
    setTasks(newTasks);
  };

  const applyBulkAssign = () => {
    if (!bulkAssignValue) return;
    const newTasks = tasks.map(task => {
      if (task.isMilestone) return task; 
      const updatedAssignees = [...task.assignees];
      updatedAssignees[0] = bulkAssignValue;
      return { ...task, assignees: updatedAssignees };
    });
    setTasks(newTasks);
  };

  // =========================================================================
  // 5. FORM SUBMISSION
  // =========================================================================
  const submitProject = async () => {
    if (!formData.projectName || !formData.projectCode) {
        return alert("Please fill in the Project Name and Code.");
    }
    if (!formData.clientName) {
        return alert("Please select a Client.");
    }

    const mappedTasks = tasks.map(t => ({
      ...t,
      assignees: t.assignees.filter(a => a !== "")
    }));

    // The payload is now perfectly mapped to the RIA expectations
    const payload = {
      ...formData,
      tasks: mappedTasks
    };

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/projects/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if(response.ok) {
        alert(`SUCCESS: ${result.message}`);
        setTasks([]); 
        // Reset form
        setFormData({
            projectName: '', projectCode: '', clientName: '', clientRepresentative: '', programName: '',
            projectManager: '', department: '', location: '', startDate: '', endDate: '',
            status: 'In Progress', percentCompleted: '0', billingType: 'Time & Materials',
            allowTimeEntry: 'Yes', clientBillingRateCopy: 'Keep Existing Billing Rates',
            timeAndExpenseEntry: 'Billable & Non-Billable', projectLeaderApprovalRequired: 'Yes',
            quotedHours: '', internalStatus: '', internalRemarks: ''
        });
        syncMatrixData(true); 
      } else {
        alert(`ERROR: ${result.error}`);
      }
    } catch (e) { 
      alert("Failed to reach server. Please check your connection."); 
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 6. RENDER UI
  // =========================================================================
  return (
    <div>
      <div className={styles.headerArea}>
        <div>
          <h2 className={styles.title}>Initiate New Project</h2>
          <p className={styles.subtitle}>Define parameters and import task hierarchy via MS Project XML.</p>
        </div>
        <div>
          <button 
            className={styles.btnPrimary} 
            disabled={tasks.length === 0 || isSubmitting} 
            onClick={submitProject}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isSubmitting ? <><i className='bx bx-loader-alt bx-spin'></i> Submitting...</> : <><i className='bx bx-save'></i> Create Project</>}
          </button>
        </div>
      </div>

      <div className={styles.chartRow}>
        
        {/* --- CORE DETAILS CARD --- */}
        <div className="chart-card">
          <h4><i className='bx bx-data' style={{ color: 'var(--accent-blue)' }}></i> Core Details</h4>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}><label>Project Name</label><input type="text" className={styles.formControl} value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} /></div>
            <div className={styles.formGroup}><label>Project Code</label><input type="text" className={styles.formControl} value={formData.projectCode} onChange={e => setFormData({...formData, projectCode: e.target.value})} /></div>
            
            <div className={styles.formGroup}>
              <label>Client Name</label>
              <select className={styles.formControl} value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})}>
                <option value="">Select a Client...</option>
                {dropdowns.clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label>Client Representative Name</label>
              <select className={styles.formControl} value={formData.clientRepresentative} onChange={e => setFormData({...formData, clientRepresentative: e.target.value})}>
                <option value="">-- Unassigned --</option>
                {dropdowns.accountManagers.map(am => <option key={am} value={am}>{am}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Program Name</label>
              <select className={styles.formControl} value={formData.programName} onChange={e => setFormData({...formData, programName: e.target.value})}>
                <option value="">Select a Program...</option>
                {dropdowns.programs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Project Manager</label>
              <select className={styles.formControl} value={formData.projectManager} onChange={e => setFormData({...formData, projectManager: e.target.value})}>
                <option value="">Select a Manager...</option>
                {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}><label>Department</label><input type="text" className={styles.formControl} placeholder="e.g., Delivery" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} /></div>
            
            <div className={styles.formGroup}>
              <label>Location</label>
              <select className={styles.formControl} value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}>
                <option value="">Select Location...</option>
                {dropdowns.locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}><label>Start Date</label><input type="date" className={styles.formControl} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
            <div className={styles.formGroup}><label>End Date</label><input type="date" className={styles.formControl} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
          </div>
        </div>

        {/* --- BILLING & CONFIGURATION CARD --- */}
        <div className="chart-card">
          <h4><i className='bx bx-cog' style={{ color: 'var(--accent-purple)' }}></i> Billing & Configuration</h4>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Status</label>
              <select className={styles.formControl} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Planning">Planning</option>
                <option value="Tentative">Tentative</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Deferred">Deferred</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            
            <div className={styles.formGroup}><label>Percent Completed</label><input type="number" min="0" max="100" className={styles.formControl} value={formData.percentCompleted} onChange={e => setFormData({...formData, percentCompleted: e.target.value})} /></div>

            <div className={styles.formGroup}>
              <label>Billing Type</label>
              <select className={styles.formControl} value={formData.billingType} onChange={e => setFormData({...formData, billingType: e.target.value})}>
                <option value="Time & Materials">Time & Materials</option>
                <option value="Fixed Bid">Fixed Bid</option>
                <option value="Non-Billable">Non-Billable</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Allow Time Entry</label>
              <select className={styles.formControl} value={formData.allowTimeEntry} onChange={e => setFormData({...formData, allowTimeEntry: e.target.value})}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Time & Expense Entry</label>
              <select className={styles.formControl} value={formData.timeAndExpenseEntry} onChange={e => setFormData({...formData, timeAndExpenseEntry: e.target.value})}>
                <option value="Billable & Non-Billable">Billable & Non-Billable</option>
                <option value="Billable Only">Billable Only</option>
                <option value="Non-Billable">Non-Billable</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Client Billing Rate Copy Option</label>
              <select className={styles.formControl} value={formData.clientBillingRateCopy} onChange={e => setFormData({...formData, clientBillingRateCopy: e.target.value})}>
                <option value="Keep Existing Billing Rates">Keep Existing Billing Rates</option>
                <option value="Update Billing Rates">Update Billing Rates</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Project Leader Approval Required</label>
              <select className={styles.formControl} value={formData.projectLeaderApprovalRequired} onChange={e => setFormData({...formData, projectLeaderApprovalRequired: e.target.value})}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className={styles.formGroup}><label>Custom Field : Quoted Hours</label><input type="number" className={styles.formControl} value={formData.quotedHours} onChange={e => setFormData({...formData, quotedHours: e.target.value})} /></div>
            
            <div className={styles.formGroup}><label>Internal: Status</label><input type="text" className={styles.formControl} value={formData.internalStatus} onChange={e => setFormData({...formData, internalStatus: e.target.value})} /></div>
            
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label>Internal: Remarks</label>
                <textarea className={styles.formControl} style={{ minHeight: '80px', resize: 'vertical' }} value={formData.internalRemarks} onChange={e => setFormData({...formData, internalRemarks: e.target.value})}></textarea>
            </div>
          </div>
        </div>

        {/* --- BOTTOM SIDE: XML TASK PARSER --- */}
        <div className="chart-card">
          <h4><i className='bx bx-code-block' style={{ color: 'var(--accent-purple)' }}></i> Task Import</h4>
          
          {tasks.length === 0 ? (
            <div className={styles.uploadZone} onClick={() => fileInputRef.current.click()}>
              <i className='bx bx-cloud-upload'></i>
              <h3>Upload MS Project XML</h3>
              <p>Click to browse files.</p>
              <input type="file" ref={fileInputRef} accept=".xml" style={{ display: 'none' }} onChange={handleXMLUpload} />
            </div>
          ) : (
            <div className={styles.previewSection}>
              <div className={styles.successBar}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600, display:'flex', alignItems:'center', gap:'5px' }}><i className='bx bx-check-circle'></i> Import Successful</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{tasks.length} Tasks Extracted</span>
              </div>
              
              <div className={styles.bulkAssignBar}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>BULK ASSIGN:</span>
                <select className={styles.formControl} style={{ padding: '8px', fontSize: '0.85rem', flexGrow: 1 }} value={bulkAssignValue} onChange={e => setBulkAssignValue(e.target.value)}>
                  <option value="">-- Unassigned --</option>
                  {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                </select>
                <button className={styles.btnGhost} onClick={applyBulkAssign}><i className='bx bx-check-double'></i> Apply to All</button>
              </div>

              <div className={styles.tasksTableWrapper}>
                <table className="premium-table">
                  <thead>
                    <tr><th style={{ width: '40%' }}>Task Name</th><th>Duration</th><th style={{ width: '40%' }}>Assigned Engineers</th></tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, tIndex) => (
                      <tr key={tIndex} className={task.isMilestone ? styles.milestoneRow : ''}>
                        <td style={{ 
                          fontWeight: task.isMilestone ? 700 : 600, 
                          color: task.isMilestone ? 'var(--accent-blue)' : '#fff',
                          paddingLeft: task.isMilestone ? '15px' : '30px' 
                        }}>
                          {task.isMilestone && <i className='bx bx-layer' style={{ marginRight: '5px' }}></i>}
                          {task.name}
                          <div className={styles.taskDetail}>{task.start} <i className='bx bx-right-arrow-alt'></i> {task.end}</div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{task.duration}</td>
                        <td>
                          {task.isMilestone ? (
                            <span className={styles.milestoneBadge}><i className='bx bx-folder'></i> Phase / Milestone</span>
                          ) : (
                            task.assignees.map((assignee, aIndex) => (
                              <div key={aIndex} className={styles.assigneeRow}>
                                <select className={styles.formControl} style={{ padding: '8px', fontSize: '0.85rem' }} value={assignee} onChange={e => handleAssigneeChange(tIndex, aIndex, e.target.value)}>
                                  <option value="">-- Unassigned --</option>
                                  {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                                </select>
                                {aIndex === 0 ? (
                                  <button className={styles.btnGhost} onClick={() => addAssignee(tIndex)} title="Add engineer"><i className='bx bx-plus'></i> Add</button>
                                ) : (
                                  <button className={styles.btnGhost} onClick={() => removeAssignee(tIndex, aIndex)} title="Remove engineer" style={{ color: 'var(--accent-coral)', borderColor: 'rgba(244, 63, 94, 0.3)' }}><i className='bx bx-x'></i></button>
                                )}
                              </div>
                            ))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}