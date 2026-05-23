import React, { useState, useMemo, useRef } from 'react';
import styles from './SmartInitiator.module.css';

export default function SmartInitiator({ dataMatrix, syncMatrixData }) {
  // =========================================================================
  // 1. DATA EXTRACTION & FAIL-SAFES (Restored)
  // =========================================================================
  const dropdowns = useMemo(() => {
    let clients = new Set();
    let programs = new Set();
    let locations = new Set();
    
    if (dataMatrix && dataMatrix.dimensionTable) {
      Object.values(dataMatrix.dimensionTable).forEach(p => {
        if (p.client && p.client !== "Unknown") clients.add(p.client);
        if (p.program && p.program !== "Unknown" && p.program !== "Unassigned") programs.add(p.program);
      });
    }

    if (dataMatrix && dataMatrix.factTable) {
        dataMatrix.factTable.forEach(row => {
            if (row.client && row.client !== "Unknown") clients.add(row.client);
            if (row.program && row.program !== "Unknown" && row.program !== "Unassigned") programs.add(row.program);
            if (row.location && row.location !== "Unknown" && row.location.trim() !== "") {
                locations.add(row.location);
            }
        });
    }

    const roster = dataMatrix?.roster || [];
    const activeEngineers = roster.filter(e => e.status === "Enabled").sort((a,b) => a.name.localeCompare(b.name));
    
    let ams = dataMatrix?.accountManagers || [];
    if (ams.length === 0 && activeEngineers.length > 0) {
        ams = activeEngineers.map(e => e.name);
    }

    return {
      clients: Array.from(clients).sort(),
      programs: Array.from(programs).sort(),
      locations: Array.from(locations).sort(),
      engineers: activeEngineers,
      accountManagers: ams
    };
  }, [dataMatrix]);

  // =========================================================================
  // 2. COMPONENT STATE
  // =========================================================================
  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  
  const [clientMode, setClientMode] = useState('existing'); 
  const [newClientName, setNewClientName] = useState('');

  // Reverted to using standard names
  const [formData, setFormData] = useState({
    projectName: '', projectCode: '', clientName: '', programName: '', 
    projectManager: '', department: 'Service Delivery', location: '', 
    startDate: '', endDate: '', status: 'Planning', percentCompleted: '0',
    billingType: 'Time & Materials', allowTimeEntry: 'Yes', 
    clientBillingRateCopy: 'Keep Existing Billing Rates', timeAndExpenseEntry: 'Billable & Non-Billable',
    accountManager: '', quotedHours: '', internalRemarks: ''
  });

  const [tasks, setTasks] = useState([]);

  const actualClientName = clientMode === 'existing' ? formData.clientName : newClientName;

  // STRICT VALIDATION
  const isFormValid = formData.projectName.trim() !== '' &&
                      formData.projectCode.trim() !== '' &&
                      actualClientName.trim() !== '' &&
                      formData.programName !== '' &&
                      formData.projectManager !== '' &&
                      formData.department !== '' &&
                      formData.location !== '' &&
                      formData.startDate !== '' &&
                      formData.endDate !== '' &&
                      (clientMode === 'existing' || formData.accountManager !== '') && 
                      tasks.length > 0;

  // =========================================================================
  // 3. XML PARSER & ASSIGNMENT LOGIC
  // =========================================================================
  const handleXMLUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(evt.target.result, "text/xml");
        
        if (xml.getElementsByTagName("parsererror").length > 0) return alert("Invalid XML Format.");

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
          
          parsedTasks.push({
            id: `task_${i}`,
            name: nameNode,
            start: startStr.split('T')[0] || '-',
            end: endStr.split('T')[0] || '-',
            duration: durationNode ? `${hours} hrs` : '-',
            isMilestone: isSummary, 
            assignees: isSummary ? [] : ['']
          });
        }
        setTasks(parsedTasks);
      } catch (error) {
        alert("Error parsing file.");
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
    if (!isFormValid) return; 
    
    const mappedTasks = tasks.map(t => ({
      ...t,
      assignees: t.assignees.filter(a => a !== "")
    }));

    const payload = { 
      ...formData, 
      clientName: actualClientName,
      clientMode: clientMode,
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
        setNewClientName('');
        setClientMode('existing');
        setFormData({
            projectName: '', projectCode: '', clientName: '', programName: '',
            projectManager: '', department: 'Service Delivery', location: '', startDate: '', endDate: '',
            status: 'Planning', percentCompleted: '0', billingType: 'Time & Materials',
            allowTimeEntry: 'Yes', clientBillingRateCopy: 'Keep Existing Billing Rates',
            timeAndExpenseEntry: 'Billable & Non-Billable', accountManager: '',
            quotedHours: '', internalRemarks: ''
        });
        syncMatrixData(true); 
      } else {
        alert(`ERROR: ${result.error}`);
      }
    } catch (e) { 
      alert("Failed to reach server."); 
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 6. RENDER UI
  // =========================================================================
  return (
    <div className={styles.container}>
      <div className={styles.headerArea}>
        <h2 className={styles.title}>Project Initialization</h2>
        
        <button 
          className={`${styles.btnPrimary} ${isFormValid ? styles.active : ''}`}
          disabled={!isFormValid || isSubmitting} 
          onClick={submitProject}
        >
          {isSubmitting ? 'Submitting...' : 'Add Project'}
        </button>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formGroup}><label>Project Name *</label><input type="text" className={styles.formControl} value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} /></div>
        <div className={styles.formGroup}><label>Project Code *</label><input type="text" className={styles.formControl} value={formData.projectCode} onChange={e => setFormData({...formData, projectCode: e.target.value})} /></div>
        
        <div className={`${styles.formGroup} ${styles.spanAll}`}>
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

        <div className={styles.formGroup}>
          <label>% Complete</label>
          <div className={styles.counterControl}>
            <button onClick={() => setFormData({...formData, percentCompleted: Math.max(0, parseInt(formData.percentCompleted || 0) - 1)})}>−</button>
            <input type="number" value={formData.percentCompleted} readOnly />
            <button onClick={() => setFormData({...formData, percentCompleted: Math.min(100, parseInt(formData.percentCompleted || 0) + 1)})}>+</button>
          </div>
        </div>
        <div className={styles.formGroup}></div> 

        {/* CLIENT SELECTION AREA */}
        <div className={styles.formGroup}>
          <label>Client Setup</label>
          <div className={styles.segmentControl}>
            <button className={clientMode === 'existing' ? styles.active : ''} onClick={() => setClientMode('existing')}>Existing Client</button>
            <button className={clientMode === 'new' ? styles.active : ''} onClick={() => setClientMode('new')}>New Client</button>
          </div>
        </div>
        
        {clientMode === 'existing' ? (
          <div className={styles.formGroup}>
            <label>Client Name *</label>
            <select className={styles.formControl} value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})}>
              <option value="">Select a Client...</option>
              {dropdowns.clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className={styles.formGroup}>
              <label>New Client Name *</label>
              <input type="text" className={styles.formControl} value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Type new client name..." />
            </div>
            <div className={styles.formGroup}>
              <label>Account Manager *</label>
              <select className={styles.formControl} value={formData.accountManager} onChange={e => setFormData({...formData, accountManager: e.target.value})}>
                <option value="">Select Account Manager...</option>
                {dropdowns.accountManagers.map(am => <option key={am} value={am}>{am}</option>)}
              </select>
            </div>
          </>
        )}

        <div className={styles.formGroup}>
          <label>Program Name *</label>
          <select className={styles.formControl} value={formData.programName} onChange={e => setFormData({...formData, programName: e.target.value})}>
            <option value="">Select a Program...</option>
            {dropdowns.programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Project Manager *</label>
          <select className={styles.formControl} value={formData.projectManager} onChange={e => setFormData({...formData, projectManager: e.target.value})}>
            <option value="">Select a Manager...</option>
            <option value="Ziad Shafik">Ziad Shafik</option>
            <option value="Irfan Najmi">Irfan Najmi</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Department *</label>
          <select className={styles.formControl} value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
            <option value="LiveRoute">LiveRoute</option>
            <option value="Management">Management</option>
            <option value="Pre Sales">Pre Sales</option>
            <option value="Service Delivery">Service Delivery</option>
          </select>
        </div>

        <div className={styles.formGroup}><label>Start Date *</label><input type="date" className={styles.formControl} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
        <div className={styles.formGroup}><label>End Date *</label><input type="date" className={styles.formControl} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
        
        <div className={styles.formGroup}>
          <label>Location *</label>
          <select className={styles.formControl} value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}>
            <option value="">Select Location...</option>
            {dropdowns.locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

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
          <div className={styles.segmentControl}>
            <button className={formData.allowTimeEntry === 'Yes' ? styles.active : ''} onClick={() => setFormData({...formData, allowTimeEntry: 'Yes'})}>Yes</button>
            <button className={formData.allowTimeEntry === 'No' ? styles.active : ''} onClick={() => setFormData({...formData, allowTimeEntry: 'No'})}>No</button>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Billing Rate</label>
          <select className={styles.formControl} value={formData.clientBillingRateCopy} onChange={e => setFormData({...formData, clientBillingRateCopy: e.target.value})}>
            <option value="Keep Existing Billing Rates">Keep Existing Billing Rates</option>
            <option value="Update Billing Rates">Update Billing Rates</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>T&E Entry</label>
          <select className={styles.formControl} value={formData.timeAndExpenseEntry} onChange={e => setFormData({...formData, timeAndExpenseEntry: e.target.value})}>
            <option value="Billable & Non-Billable">Billable & Non-Billable</option>
            <option value="Billable Only">Billable Only</option>
            <option value="Non-Billable">Non-Billable</option>
          </select>
        </div>

        <div className={styles.formGroup}><label>Quoted Hours</label><input type="number" className={styles.formControl} value={formData.quotedHours} onChange={e => setFormData({...formData, quotedHours: e.target.value})} /></div>
        <div className={styles.formGroup}><label>Remarks</label><input type="text" className={styles.formControl} value={formData.internalRemarks} onChange={e => setFormData({...formData, internalRemarks: e.target.value})} /></div>
      </div>

      {tasks.length === 0 ? (
        <div className={styles.uploadZone} onClick={() => fileInputRef.current.click()}>
          <h3>Click to upload MS Project XML to populate tasks</h3>
          <input type="file" ref={fileInputRef} accept=".xml" style={{ display: 'none' }} onChange={handleXMLUpload} />
        </div>
      ) : (
        <div className={styles.tasksTableWrapper}>
          
          <div className={styles.bulkAssignBar}>
            <span>BULK ASSIGN:</span>
            <select className={styles.formControl} style={{ maxWidth: '300px' }} value={bulkAssignValue} onChange={e => setBulkAssignValue(e.target.value)}>
              <option value="">-- Select Engineer for all tasks --</option>
              {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
            <button className={styles.btnPrimary} style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={applyBulkAssign}>Apply</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Task ID</th>
                <th style={{ width: '35%' }}>Task Name</th>
                <th>Category</th>
                <th>Est. Effort</th>
                <th style={{ width: '35%' }}>Assigned Engineer(s)</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, tIndex) => (
                <tr key={tIndex} className={task.isMilestone ? styles.milestoneRow : ''}>
                  <td>10{tIndex + 1}</td>
                  <td>
                    {task.isMilestone && <i className={`bx bxs-flag-alt ${styles.milestoneIcon}`}></i>}
                    {task.name}
                  </td>
                  <td style={{ textTransform: 'uppercase' }}>{task.isMilestone ? 'Milestone' : 'Task'}</td>
                  <td>{task.duration}</td>
                  <td>
                    {task.isMilestone ? (
                      <span className={styles.milestoneBadge}>Phase / Milestone</span>
                    ) : (
                      task.assignees.map((assignee, aIndex) => (
                        <div key={aIndex} className={styles.assigneeRow}>
                          <select className={styles.formControl} style={{ padding: '8px', fontSize: '0.85rem' }} value={assignee} onChange={e => handleAssigneeChange(tIndex, aIndex, e.target.value)}>
                            <option value="">-- Unassigned --</option>
                            {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                          </select>
                          {aIndex === 0 ? (
                            <button className={styles.btnIcon} onClick={() => addAssignee(tIndex)} title="Add engineer"><i className='bx bx-plus'></i></button>
                          ) : (
                            <button className={`${styles.btnIcon} ${styles.btnDanger}`} onClick={() => removeAssignee(tIndex, aIndex)} title="Remove engineer"><i className='bx bx-x'></i></button>
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
      )}
    </div>
  );
}