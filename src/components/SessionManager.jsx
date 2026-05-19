import React, { useState, useEffect, useCallback } from 'react';

export default function SessionManager({ onLogout }) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds for the warning countdown

  // 15 mins (900,000ms) until warning, 30 mins (1,800,000ms) total until force logout
  const IDLE_TIMEOUT = 900000; 
  const WARNING_DURATION = 900000; 

  const resetTimer = useCallback(() => {
    if (!showWarning) {
      localStorage.setItem('mds_last_activity', Date.now().toString());
    }
  }, [showWarning]);

  useEffect(() => {
    // 1. Listen for any user interaction to prove they are active
    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    // 2. The Engine that checks the time every second
    const interval = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('mds_last_activity') || Date.now());
      const idleTime = Date.now() - lastActivity;

      if (idleTime > IDLE_TIMEOUT && !showWarning) {
        setShowWarning(true); // Show the warning pop-up
      } else if (idleTime > (IDLE_TIMEOUT + WARNING_DURATION)) {
        onLogout(); // Force logout if they ignored the warning
      }

      if (showWarning) {
        const remaining = Math.max(0, Math.floor(((IDLE_TIMEOUT + WARNING_DURATION) - idleTime) / 1000));
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  }, [showWarning, resetTimer, onLogout]);

  if (!showWarning) return null;

  // Format time as MM:SS
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: 'var(--radius-lg)', textAlign: 'center', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
        <i className='bx bx-time-five' style={{ fontSize: '3rem', color: 'var(--accent-yellow)', marginBottom: '15px' }}></i>
        <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Session Expiring</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          You have been idle for 15 minutes. For your security, your session will automatically log out in:
        </p>
        <h1 style={{ color: 'var(--accent-coral)', fontSize: '2.5rem', margin: '0 0 25px 0' }}>
          {mins}:{secs < 10 ? '0' : ''}{secs}
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onLogout}>Log Out Now</button>
          <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setShowWarning(false); resetTimer(); }}>I'm Still Here</button>
        </div>
      </div>
    </div>
  );
}