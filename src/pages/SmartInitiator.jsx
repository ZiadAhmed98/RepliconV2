import React, { useState, useMemo, useRef } from 'react';
import styles from './SmartInitiator.module.css';

export default function SmartInitiator({ dataMatrix, syncMatrixData }) {
  // =========================================================================
  // 1. DYNAMIC DICTIONARY BINDING
  // =========================================================================
  const dictionaries = useMemo(() => {
    const getArray = (key) => {
      if (dataMatrix?.[key] && dataMatrix[key].length > 0) return dataMatrix[key];
      if (dataMatrix?.dictionaries?.[key]) return dataMatrix.dictionaries[key];
      return [];
    };

    const dicts = {
      departments: getArray('departments'),
      locations: getArray('locations'),
      programs: getArray('programs'),
      clients: getArray('clients'),
      users: getArray('users'),
      projectManagers: getArray('projectManagers'),
      employeeTypes: getArray('employeeTypes'),
      accountManagers: getArray('accountManagers')
    };

    Object.keys(dicts).forEach(key => {
      dicts[key] = [...dicts[key]].sort((a, b) => a.name.localeCompare(b.name));
    });

    return dicts;
  }, [dataMatrix]);

  // =========================================================================
  // 2. COMPONENT STATE
  // =========================================================================
  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  
  const [clientMode, setClientMode] = useState('existing'); 
  const [newClientName, setNewClientName] = useState('');

  const [formData, setFormData] = useState({
    projectName: '', projectCode: '', 
    clientName: '', programName: '', projectManagerName: '', 
    departmentName: '', employeeTypeName: '', locationName: '', 
    startDate: '', endDate: '', status: 'Planning', percentCompleted: '0',
    billingType: 'Time & Materials', allowTimeEntry: 'Yes', 
    clientBillingRateCopy: 'Keep Existing Billing Rates', timeAndExpenseEntry: 'Billable & Non-Billable',
    accountManager: '', quotedHours: ''
  });

  const [tasks, setTasks] = useState([]);

  // STRICT VALIDATION
  const isFormValid = formData.projectName.trim() !== '' &&
                      formData.projectCode.trim() !== '' &&
                      (clientMode === 'existing' ? formData.clientName !== '' : newClientName.trim() !== '') &&
                      formData.startDate !== '' &&
                      formData.endDate !== '' &&
                      tasks.length > 0;

  // =========================================================================
  // 3. XML PARSER (WITH HIERARCHY & RUNNING HOUR BALANCE)
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
        
        let runningExactHours = 0;
        let runningRoundedHours = 0;

        for (let i = 0; i < taskNodes.length; i++) {
          const t = taskNodes[i];
          
          const idNode = t.getElementsByTagName('ID')[0]?.textContent;
          if (idNode === "0") continue; 

          const nameNode = t.getElementsByTagName('Name')[0]?.textContent;
          if (!nameNode) continue; 
          
          const isSummary = t.getElementsByTagName('Summary')[0]?.textContent === "1";
          
          const outlineLevelNode = t.getElementsByTagName('OutlineLevel')[0]?.textContent;
          const outlineLevel = outlineLevelNode ? parseInt(outlineLevelNode, 10) : 1;

          const startStr = t.getElementsByTagName('Start')[0]?.textContent || '';
          const endStr = t.getElementsByTagName('Finish')[0]?.textContent || '';
          const durationNode = t.getElementsByTagName('Duration')[0]?.textContent || '';
          
          let exactHours = 0;
          const hMatch = durationNode.match(/(\d+)H/);
          const mMatch = durationNode.match(/(\d+)M/);
          
          if (hMatch) exactHours += parseInt(hMatch[1], 10);
          if (mMatch) exactHours += parseInt(mMatch[1], 10) / 60; 
          
          runningExactHours += exactHours;
          const targetTotalRounded = Math.round(runningExactHours);
          const currentRoundedHours = targetTotalRounded - runningRoundedHours;
          runningRoundedHours += currentRoundedHours;

          parsedTasks.push({
            id: `task_${idNode}`,
            name: nameNode,
            start: startStr.split('T')[0] || '-',
            end: endStr.split('T')[0] || '-',
            duration: durationNode ? `${currentRoundedHours} hrs` : '-',
            roundedHours: currentRoundedHours, 
            outlineLevel: outlineLevel,        
            isMilestone: isSummary, 
            assignees: isSummary ? [] : ['']
          });
        }
        setTasks(parsedTasks);
      } catch (error) { alert("Error parsing file."); }
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
    
    const mappedTasks = tasks.map(t => {
      const validNames = t.assignees.filter(a => a !== "");
      const assignedUserUris = validNames.map(name => {
        return dictionaries.users.find(u => u.name === name)?.uri || null;
      }).filter(uri => uri !== null);

      return { ...t, assignedUsers: assignedUserUris };
    });

    const totalAssignedInUI = tasks.reduce((sum, t) => sum + t.assignees.filter(a => a !== "").length, 0);
    const totalMappedURIs = mappedTasks.reduce((sum, t) => sum + t.assignedUsers.length, 0);

    if (totalAssignedInUI > 0 && totalMappedURIs === 0) {
        alert("CRITICAL ERROR: Failed to map user names to URIs. Check console.");
        return; 
    }

    const safeClientUri = dictionaries.clients.find(c => c.name === formData.clientName)?.uri || undefined;
    const safeProgramUri = dictionaries.programs.find(p => p.name === formData.programName)?.uri || undefined;
    const safeLocationUri = dictionaries.locations.find(l => l.name === formData.locationName)?.uri || undefined;
    const safeDepartmentUri = dictionaries.departments.find(d => d.name === formData.departmentName)?.uri || undefined;
    const safeEmployeeTypeUri = dictionaries.employeeTypes.find(e => e.name === formData.employeeTypeName)?.uri || undefined;
    const safeAccountManagerUri = dictionaries.accountManagers.find(am => am.name === formData.accountManager)?.uri || undefined;
    
    let safePmUri = dictionaries.projectManagers.find(u => u.name === formData.projectManagerName)?.uri;
    if (!safePmUri) safePmUri = dictionaries.users.find(u => u.name === formData.projectManagerName)?.uri;

    const payload = { 
      ...formData, 
      clientMode: clientMode,
      clientName: clientMode === 'new' ? newClientName : undefined,
      clientUri: safeClientUri,
      programUri: safeProgramUri,
      locationUri: safeLocationUri,
      departmentUri: safeDepartmentUri,
      employeeTypeUri: safeEmployeeTypeUri,
      accountManagerUri: safeAccountManagerUri,
      pmUri: safePmUri,
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
            projectManagerName: '', departmentName: '', employeeTypeName: '', locationName: '', 
            startDate: '', endDate: '', status: 'Planning', percentCompleted: '0', 
            billingType: 'Time & Materials', allowTimeEntry: 'Yes', 
            clientBillingRateCopy: 'Keep Existing Billing Rates', timeAndExpenseEntry: 'Billable & Non-Billable',
            accountManager: '', quotedHours: ''
        });
        syncMatrixData(true); 
      } else {
        alert(`ERROR: ${result.error}\n\nCheck Docker Terminal for exact Payload and API errors.`);
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
              <option value="">Select Client</option>
              {dictionaries.clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className={styles.formGroup}>
              <label>New Client Name *</label>
              <input type="text" className={styles.formControl} value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Type new client name..." />
            </div>
            <div className={styles.formGroup}>
              <label>Select Account Manager</label>
              <select className={styles.formControl} value={formData.accountManager} onChange={e => setFormData({...formData, accountManager: e.target.value})}>
                <option value="">Select Account Manager</option>
                {dictionaries.accountManagers?.map(am => <option key={am.name} value={am.name}>{am.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div className={styles.formGroup}>
          <label>Program Name</label>
          <select className={styles.formControl} value={formData.programName} onChange={e => setFormData({...formData, programName: e.target.value})}>
            <option value="">Select Program</option>
            {dictionaries.programs.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Project Manager *</label>
          <select className={styles.formControl} value={formData.projectManagerName} onChange={e => setFormData({...formData, projectManagerName: e.target.value})}>
            <option value="">Select Project Manager</option>
            {dictionaries.projectManagers.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Department</label>
          <select className={styles.formControl} value={formData.departmentName} onChange={e => setFormData({...formData, departmentName: e.target.value})}>
            <option value="">Select Department</option>
            {dictionaries.departments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Employee Type</label>
          <select className={styles.formControl} value={formData.employeeTypeName} onChange={e => setFormData({...formData, employeeTypeName: e.target.value})}>
            <option value="">Select Employee Type</option>
            {dictionaries.employeeTypes?.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}><label>Start Date *</label><input type="date" className={styles.formControl} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
        <div className={styles.formGroup}><label>End Date *</label><input type="date" className={styles.formControl} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
        
        <div className={styles.formGroup}>
          <label>Location</label>
          <select className={styles.formControl} value={formData.locationName} onChange={e => setFormData({...formData, locationName: e.target.value})}>
            <option value="">Select Location</option>
            {dictionaries.locations.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
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
          <label>Time Entry on Tasks</label>
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
              {dictionaries.users.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
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
                  {/* VISUAL INDENTATION BASED ON OUTLINE LEVEL */}
                  <td style={{ paddingLeft: `${Math.max(0, (task.outlineLevel - 1) * 20)}px` }}>
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
                            {dictionaries.users.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
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