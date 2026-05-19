import React, { useState } from 'react';
import { repliconApi } from '../api/replicon';

export default function LoginModal({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter both credentials.");
      return;
    }

    setIsAuthenticating(true);
    setError('');

    try {
      const data = await repliconApi.login(username, password);
      if (data.success) {
        let finalName = data.displayName;
        if (!finalName || finalName === "undefined") {
          finalName = username.split('@')[0];
          finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
        }
        
        const userObj = { name: finalName, uri: data.uri };
        localStorage.setItem('mds_dashboard_session', JSON.stringify({ 
          user: userObj, 
          expiresAt: new Date().getTime() + 3600000 
        }));
        
        onSuccess(userObj);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Network error. Replicon unavailable.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    /* FIX: position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', 
      justifyContent: 'center', alignItems: 'center' forces absolute centering 
    */
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-content" style={{ width: '420px', textAlign: 'center', backgroundColor: 'var(--bg-card)', padding: '40px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <h2 style={{ marginTop: 0, color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>MDS Premium</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px', marginBottom: '25px' }}>Enter your analytics credentials.</p>
        
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="off" style={{ width: '100%', padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.95rem', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', outline: 'none' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.95rem', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', outline: 'none' }} />
        
        <button className="btn-primary" onClick={handleLogin} disabled={isAuthenticating} style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px' }}>
          {isAuthenticating ? 'Authenticating...' : 'Secure Login'}
        </button>
        
        {error && <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '15px', fontWeight: 500 }}>{error}</div>}
      </div>
    </div>
  );
}