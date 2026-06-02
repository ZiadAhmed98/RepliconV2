import React from 'react';

export default function ComplianceModal({ isOpen, onClose, viewType, dataMatrix }) {
  if (!isOpen) return null;

  const isDaily = viewType === 'daily';
  const title = isDaily ? "Daily Deficits" : "Weekly Deficits";
  const listData = isDaily ? dataMatrix.compliance.dailyList : dataMatrix.compliance.weeklyList;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 6000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'var(--bg-card)', padding: '40px', width: '460px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginTop: 0, color: 'var(--text-main)', fontSize: '1.5rem' }}>Compliance Diagnostic</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>{title} report for active engineers.</p>
        
        <div style={{ overflowY: 'auto', margin: '20px 0', paddingRight: '10px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {listData && listData.length > 0 ? listData.map((emp, idx) => (
              <li key={idx} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{emp.name}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', color: emp.isCompliant ? 'var(--accent-green)' : 'var(--accent-red)', background: emp.isCompliant ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', border: `1px solid ${emp.isCompliant ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}` }}>
                  {Math.round(emp.logged)} hrs
                </span>
              </li>
            )) : <li style={{ color: 'var(--text-muted)' }}>All engineers compliant!</li>}
          </ul>
        </div>
        
        <button className="btn-ghost" onClick={onClose} style={{ width: '100%', padding: '12px', justifyContent: 'center' }}>Dismiss</button>
      </div>
    </div>
  );
}