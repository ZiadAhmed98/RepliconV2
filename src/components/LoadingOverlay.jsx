import React, { useState, useEffect } from 'react';

const LOADING_MESSAGES = [
  "Establishing secure connection...",
  "Gathering project reports...",
  "Calculating portfolio metrics...",
  "Structuring data matrix...",
  "Preparing your dashboard..."
];

export default function LoadingOverlay() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0); // Used to re-trigger the CSS animation

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      setFadeKey((prev) => prev + 1); // Trigger animation on change
    }, 2500); // Change text every 2.5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(5px)' }}>
      {/* Inline styles for the animation definition */}
      <style>
        {`
          @keyframes slideFadeUp {
            0% { opacity: 0; transform: translateY(15px); }
            15% { opacity: 1; transform: translateY(0); }
            85% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-15px); }
          }
          .animate-text { animation: slideFadeUp 2.5s ease-in-out forwards; }
        `}
      </style>

      <div style={{ background: 'var(--bg-card)', padding: '40px 50px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', minWidth: '300px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
        
        <div style={{ textAlign: 'center', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span key={fadeKey} className="animate-text" style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', letterSpacing: '0.5px' }}>
            {LOADING_MESSAGES[messageIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}