import React from 'react';

export default function LoadingOverlay({ text, subtext }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(5px)' }}>
      <div style={{ background: 'var(--bg-card)', padding: '40px 50px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        
        {/* CSS Spinner inline for strict portability */}
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}>
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)', display: 'block' }}>
            {text || "Fetching Data..."}
          </span>
          {/* This is the realistic engine status text */}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
            {subtext}
          </span>
        </div>
      </div>
    </div>
  );
}