import React, { useState } from 'react';
import { repliconApi } from '../api/replicon';
import styles from './Login.module.css';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [isLoading,setIsLoading]= useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Cookie is set server-side (httpOnly); we just read the display name from the response
      const data = await repliconApi.login(username, password);
      if (data.success) {
        let finalName = data.displayName;
        if (!finalName || finalName === 'undefined') {
          finalName = username.charAt(0).toUpperCase() + username.slice(1);
        }
        // No more localStorage session — the httpOnly cookie handles auth.
        // We pass the user object up so App.jsx knows who's logged in UI-side.
        onLoginSuccess({ name: finalName, uri: data.uri });
      } else {
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Network error. Server may be offline.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <div className={styles.logoWrap}>
          <i className='bx bx-hive' style={{ fontSize: '3rem', color: 'var(--accent-primary)' }} />
        </div>
        <h2 className={styles.title}>Liveroute Analytics</h2>
        <p className={styles.subtitle}>Enter your credentials to continue.</p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            className={styles.inputField}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="submit" className={styles.loginBtn} disabled={isLoading || !username || !password}>
            {isLoading
              ? <><i className='bx bx-loader-alt bx-spin' /> Authenticating…</>
              : 'Secure Login'}
          </button>
        </form>

        {error && <div className={styles.errorMsg}>{error}</div>}
      </div>
    </div>
  );
}
