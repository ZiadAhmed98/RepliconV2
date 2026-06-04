import React, { useEffect, useState } from 'react';

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'],   desc: 'Open global search' },
  { keys: ['?'],           desc: 'Show this keyboard shortcuts panel' },
  { keys: ['Ctrl', 'R'],   desc: 'Sync / refresh data' },
  { keys: ['Ctrl', 'E'],   desc: 'Export dashboard PDF' },
  { keys: ['1'],           desc: 'Navigate to Executive Dashboard' },
  { keys: ['2'],           desc: 'Navigate to Employee Analytics' },
  { keys: ['3'],           desc: 'Navigate to Project Deep Dive' },
  { keys: ['4'],           desc: 'Navigate to Timesheet Ops' },
  { keys: ['5'],           desc: 'Navigate to Add Project' },
  { keys: ['Esc'],         desc: 'Close any open panel or modal' },
];

export default function KeyboardShortcuts({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(24,24,27,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px', padding: '32px',
          width: '480px', maxWidth: '90vw',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem', color: '#fff' }}>
            <i className='bx bx-keyboard' style={{ marginRight: '8px', color: '#a855f7' }} />
            Keyboard Shortcuts
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '1.3rem' }}>
            <i className='bx bx-x' />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SHORTCUTS.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
              <span style={{ color: '#d4d4d8', fontSize: '0.88rem' }}>{s.desc}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {s.keys.map((k, j) => (
                  <kbd key={j} style={{
                    padding: '3px 9px', borderRadius: '6px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#e4e4e7', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600,
                  }}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
