import React, { useState, useRef, useCallback } from 'react';
import { repliconApi } from '../api/replicon';
import { useCardTilt } from '../hooks/useCardTilt';
import styles from './Login.module.css';

const APP_VERSION = 'v2.0';

export default function Login({ onLoginSuccess }) {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [capsOn,    setCapsOn]    = useState(false);
  const [error,     setError]     = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Subtle real-time 3D tilt on the sign-in card
  const tilt = useCardTilt({ max: 6, scale: 1.008 });

  // Mouse-parallax for the brand scene — sets --mx/--my that child layers read
  const sceneRef = useRef(null);
  const handleParallax = useCallback((e) => {
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width  - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top)  / r.height - 0.5).toFixed(3));
  }, []);

  const detectCaps = (e) => {
    if (typeof e.getModifierState === 'function') setCapsOn(e.getModifierState('CapsLock'));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Cookie is set server-side (httpOnly); we just read the display name from the response
      const data = await repliconApi.login(username.trim(), password);
      if (data.success) {
        let finalName = data.displayName;
        if (!finalName || finalName === 'undefined') {
          finalName = username.charAt(0).toUpperCase() + username.slice(1);
        }
        onLoginSuccess({ name: finalName });
      } else {
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Network error. The server may be offline.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page} ref={sceneRef} onMouseMove={handleParallax}>

      {/* ── Brand hero (left) ─────────────────────────────────────────── */}
      <aside className={styles.brand}>
        <div className={styles.scene} aria-hidden="true">
          <span className={`${styles.orb} ${styles.orb1}`} />
          <span className={`${styles.orb} ${styles.orb2}`} />
          <span className={`${styles.orb} ${styles.orb3}`} />
          <div className={styles.gridFloor} />
          <div className={`${styles.glass} ${styles.glassA}`} />
          <div className={`${styles.glass} ${styles.glassB}`} />
          <div className={`${styles.glass} ${styles.glassC}`} />
        </div>

        <div className={styles.brandInner}>
          <div className={styles.brandMark}>
            <img src="/logo.png" alt="" className={styles.brandLogo} />
            <span className={styles.brandName}>Liveroute</span>
          </div>

          <h1 className={styles.headline}>
            Project intelligence,
            <span className={styles.headlineAccent}> beautifully unified.</span>
          </h1>
          <p className={styles.lede}>
            Timesheets, projects, clients and analytics — one secure workspace for the entire team.
          </p>

          <ul className={styles.features}>
            <li><i className="bx bx-bar-chart-alt-2" /> Live delivery &amp; utilization analytics</li>
            <li><i className="bx bx-shield-quarter" /> Role-based access, encrypted end-to-end</li>
            <li><i className="bx bx-check-double" /> Approvals and timesheets in one place</li>
          </ul>
        </div>
      </aside>

      {/* ── Sign-in (right) ───────────────────────────────────────────── */}
      <main className={styles.formCol}>
        <form
          className={styles.card}
          onSubmit={handleLogin}
          ref={tilt.ref}
          onMouseMove={tilt.onMouseMove}
          onMouseEnter={tilt.onMouseEnter}
          onMouseLeave={tilt.onMouseLeave}
        >
          <div className={styles.cardGlow} aria-hidden="true" />

          <div className={styles.logoBadge}>
            <img src="/logo.png" alt="Liveroute" />
          </div>

          <h2 className={styles.title}>Welcome back</h2>
          <p className={styles.subtitle}>Sign in to your workspace to continue.</p>

          <label className={styles.label} htmlFor="login-user">Username</label>
          <div className={styles.field}>
            <i className={`bx bx-user ${styles.fieldIcon}`} />
            <input
              id="login-user"
              type="text"
              className={styles.input}
              placeholder="your.username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyUp={detectCaps}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <label className={styles.label} htmlFor="login-pass">Password</label>
          <div className={styles.field}>
            <i className={`bx bx-lock-alt ${styles.fieldIcon}`} />
            <input
              id="login-pass"
              type={showPwd ? 'text' : 'password'}
              className={styles.input}
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyUp={detectCaps}
              onKeyDown={detectCaps}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setShowPwd(s => !s)}
              tabIndex={-1}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              <i className={`bx ${showPwd ? 'bx-hide' : 'bx-show'}`} />
            </button>
          </div>

          {capsOn && (
            <div className={styles.capsHint}>
              <i className="bx bx-up-arrow-alt" /> Caps Lock is on
            </div>
          )}

          <button
            type="submit"
            className={styles.submit}
            disabled={isLoading || !username || !password}
          >
            {isLoading
              ? <><i className="bx bx-loader-alt bx-spin" /> Signing in…</>
              : <>Sign in <i className="bx bx-right-arrow-alt" /></>}
          </button>

          {error && (
            <div className={styles.error} role="alert">
              <i className="bx bx-error-circle" />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.cardFooter}>
            <span><i className="bx bx-lock-alt" /> Secured with encryption</span>
            <span>Need access? Contact your administrator.</span>
          </div>
        </form>

        <p className={styles.version}>Liveroute Analytics · {APP_VERSION}</p>
      </main>
    </div>
  );
}
