import React, { useState } from 'react';
import { repliconApi } from '../api/replicon';
import styles from './Login.module.css';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await repliconApi.login(username, password);
      if (data.success) {
        let finalName = data.displayName;
        if (!finalName || finalName === "undefined") {
          finalName = username.split('@')[0];
          finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
        }
        
        const userData = { name: finalName, uri: data.uri };
        localStorage.setItem('mds_dashboard_session', JSON.stringify({
          user: userData,
          expiresAt: new Date().getTime() + (3600000) // 1 Hour session
        }));
        
        onLoginSuccess(userData);
      } else {
        setError(data.error || "Login failed.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Network error. Server may be offline.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <div className={styles.logoWrap}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <h2 className={styles.title}>MDS Premium Analytics</h2>
        <p className={styles.subtitle}>Enter your analytics credentials.</p>
        
        <form onSubmit={handleLogin}>
          <input 
            type="text" 
            className={styles.inputField} 
            placeholder="Username" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            className={styles.inputField} 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          
          <button type="submit" className={styles.loginBtn} disabled={isLoading || !username || !password}>
            {isLoading ? <><i className='bx bx-loader-alt bx-spin'></i> Authenticating...</> : "Secure Login"}
          </button>
        </form>
        
        {error && <div className={styles.errorMsg}>{error}</div>}
      </div>
    </div>
  );
}