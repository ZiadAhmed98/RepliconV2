import React, { useState, useMemo, useRef } from 'react';
import styles from './SmartInitiator.module.css';

export default function SmartInitiator({ dataMatrix, syncMatrixData }) {
  // =========================================================================
  // 1. DATA EXTRACTION FOR DROPDOWNS
  // =========================================================================
  const dropdowns = useMemo(() => {
    let clients = new Set();
    let programs = new Set();
    
    if (dataMatrix && dataMatrix.dimensionTable) {
      Object.values(dataMatrix.dimensionTable).forEach(p => {
        if (p.client && p.client !== "Unknown") clients.add(p.client);
        if (p.program && p.program !== "Unknown" && p.program !== "Unassigned") programs.add(p.program);
      });
    }

    const roster = dataMatrix?.roster || [];
    const activeEngineers = roster.filter(e => e.status === "Enabled").sort((a,b) => a.name.localeCompare(b.name));

    return {
      clients: Array.from(clients).sort(),
      programs: Array.from(programs).sort(),
      engineers: activeEngineers
    };
  }, [dataMatrix]);

  // =========================================================================
  // 2. COMPONENT STATE
  // =========================================================================
  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  
  // New State for the Client Toggle Buttons
  const [clientMode, setClientMode] = useState('existing'); // 'existing' or 'new'
  
  const [formData, setFormData] = useState({
    name: '', code: '', client: '', newClientName: '',
    accountManager: '', start: '', end: '',
    status: 'In Progress', program: ''
  });

  const [tasks, setTasks] = useState([]);

  // =========================================================================
  // 3. XML PARSER LOGIC
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
          
          if (isSummary || !nameNode) continue;
          
          const startStr = t.getElementsByTagName('Start')[0]?.textContent || '';
          const endStr = t.getElementsByTagName('Finish')[0]?.textContent || '';
          
          // MS Project saves duration in format like: PT8H0M0S
          const durationNode = t.getElementsByTagName('Duration')[0]?.textContent || '';
          let hours = 0;
          
          // Pull out the H (hours) and M (minutes) values using regex
          const hMatch = durationNode.match(/(\d+)H/);
          const mMatch = durationNode.match(/(\d+)M/);
          
          if (hMatch) hours += parseInt(hMatch[1], 10);
          if (mMatch) hours += parseInt(mMatch[1], 10) / 60; // Convert mins to decimal hours
          
          const formattedDuration = durationNode ? `${hours} hrs` : '-';
          
          parsedTasks.push({
            id: `task_${i}`,
            name: nameNode,
            start: startStr.split('T')[0] || '-',
            end: endStr.split('T')[0] || '-',
            duration: formattedDuration,
            assignees: ['']
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

  // =========================================================================
  // 4. TASK ASSIGNMENT MANAGERS
  // =========================================================================
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
    if (!formData.name || !formData.code) return alert("Please fill in the Project Name and Code.");
    
    let finalClient = formData.client;
    
    // Check validation based on which mode the user selected
    if (clientMode === 'new') {
      finalClient = formData.newClientName.trim();
      if (!finalClient) return alert("Please enter a name for the new client.");
    } else {
      if (!finalClient) return alert("Please select an existing client.");
    }

    const mappedTasks = tasks.map(t => ({
      ...t,
      assignees: t.assignees.filter(a => a !== "")
    }));

    const payload = {
      projectName: formData.name,
      projectCode: formData.code,
      client: finalClient,
      accountManager: clientMode === 'new' ? formData.accountManager : null,
      startDate: formData.start,
      endDate: formData.end,
      status: formData.status,
      program: formData.program,
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
        setFormData({ name: '', code: '', client: '', newClientName: '', accountManager: '', start: '', end: '', status: 'In Progress', program: '' });
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
            className="btn-primary" 
            disabled={tasks.length === 0 || isSubmitting} 
            onClick={submitProject}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isSubmitting ? <><i className='bx bx-loader-alt bx-spin'></i> Submitting...</> : <><i className='bx bx-save'></i> Create Project</>}
          </button>
        </div>
      </div>

      <div className={styles.chartRow}>
        
        {/* --- TOP SIDE: CORE DETAILS FORM --- */}
        <div className="chart-card">
          <h4><i className='bx bx-data' style={{ color: 'var(--accent-blue)' }}></i> Core Details</h4>
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}><label>Project Name</label><input type="text" className={styles.formControl} placeholder="e.g., Azure Migration" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div className={styles.formGroup}><label>Project Code</label><input type="text" className={styles.formControl} placeholder="e.g., PRJ-2026-001" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} /></div>
            
            {/* New Client Toggle Area */}
            <div className={`${styles.formGroup} ${styles.fullSpan}`}>
              <label>Client Selection</label>
              <div className={styles.clientModeToggle}>
                <button 
                  className={`${styles.modeBtn} ${clientMode === 'existing' ? styles.active : ''}`} 
                  onClick={() => setClientMode('existing')}
                >
                  <i className='bx bx-list-ul'></i> Existing Client
                </button>
                <button 
                  className={`${styles.modeBtn} ${clientMode === 'new' ? styles.active : ''}`} 
                  onClick={() => setClientMode('new')}
                >
                  <i className='bx bx-plus'></i> + New Client
                </button>
              </div>

              {/* Dynamic rendering based on which button is clicked */}
              {clientMode === 'existing' ? (
                <select className={styles.formControl} value={formData.client} onChange={e => setFormData({...formData, client: e.target.value})}>
                  <option value="">Select an existing Client...</option>
                  {dropdowns.clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <div className={styles.newClientBox}>
                  <div className={styles.formGroup}>
                    <label>New Client Name</label>
                    <input type="text" className={styles.formControl} placeholder="e.g., Abu Dhabi Police" value={formData.newClientName} onChange={e => setFormData({...formData, newClientName: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Account Manager</label>
                    <select className={styles.formControl} value={formData.accountManager} onChange={e => setFormData({...formData, accountManager: e.target.value})}>
                      <option value="">-- Unassigned --</option>
                      {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.formGroup}><label>Start Date</label><input type="date" className={styles.formControl} value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} /></div>
            <div className={styles.formGroup}><label>End Date</label><input type="date" className={styles.formControl} value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} /></div>
            
            <div className={styles.formGroup}>
              <label>Status</label>
              <select className={styles.formControl} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label>Program</label>
              <select className={styles.formControl} value={formData.program} onChange={e => setFormData({...formData, program: e.target.value})}>
                <option value="">Select a Program...</option>
                {dropdowns.programs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
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
                <button className="btn-ghost" onClick={applyBulkAssign}><i className='bx bx-check-double'></i> Apply to All</button>
              </div>

              <div className={styles.tasksTableWrapper}>
                <table className="premium-table">
                  <thead>
                    <tr><th style={{ width: '30%' }}>Task Name</th><th>Duration</th><th style={{ width: '50%' }}>Assigned Engineers</th></tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, tIndex) => (
                      <tr key={tIndex}>
                        <td style={{ fontWeight: 600, color: '#fff' }}>
                          {task.name}
                          <div className={styles.taskDetail}>{task.start} <i className='bx bx-right-arrow-alt'></i> {task.end}</div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{task.duration}</td>
                        <td>
                          {task.assignees.map((assignee, aIndex) => (
                            <div key={aIndex} className={styles.assigneeRow}>
                              <select className={styles.formControl} style={{ padding: '8px', fontSize: '0.85rem' }} value={assignee} onChange={e => handleAssigneeChange(tIndex, aIndex, e.target.value)}>
                                <option value="">-- Unassigned --</option>
                                {dropdowns.engineers.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                              </select>
                              {aIndex === 0 ? (
                                <button className="btn-ghost" onClick={() => addAssignee(tIndex)} title="Add engineer"><i className='bx bx-plus'></i> Add</button>
                              ) : (
                                <button className="btn-ghost" onClick={() => removeAssignee(tIndex, aIndex)} title="Remove engineer" style={{ color: 'var(--accent-coral)', borderColor: 'rgba(244, 63, 94, 0.3)' }}><i className='bx bx-x'></i></button>
                              )}
                            </div>
                          ))}
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