import React from 'react';

export default function LoadingOverlay({ text, subtext }) {
  return (
    <div id="loading-overlay" style={{ display: 'flex' }}>
      <div className="loader-box">
        <div className="spinner"></div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)', display: 'block' }}>
            {text || "Fetching Data..."}
          </span>
          <span className="loading-subtext">{subtext || "Establishing connection..."}</span>
        </div>
      </div>
    </div>
  );
}