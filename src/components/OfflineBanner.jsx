import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      padding: '8px 16px',
      background: 'linear-gradient(90deg, #b45309, #d97706)',
      color: '#fff', fontSize: '13px', fontWeight: 600,
      boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
    }}>
      <i className="bx bx-wifi-off" style={{ fontSize: '15px' }} />
      You’re offline — changes may not be saved until your connection returns.
    </div>
  );
}
