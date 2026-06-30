import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import SupportModal from '../components/support/SupportModal';

const SupportContext = createContext(null);

// Most recent client-side error, kept for "technical details" prefill (never auto-opens).
let lastClientError = '';
export function getLastClientError() { return lastClientError; }

export function SupportProvider({ children }) {
  const [open,    setOpen]    = useState(false);
  const [prefill, setPrefill] = useState(null);

  const openTicket = useCallback((pre = {}) => {
    setPrefill({ ...pre, clientError: pre.clientError || lastClientError });
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onError = (e) => {
      const msg = e?.error?.stack || e?.message || '';
      if (msg) lastClientError = String(msg).slice(0, 2000);
    };
    const onRejection = (e) => {
      const msg = e?.reason?.stack || e?.reason?.message || String(e?.reason || '');
      if (msg) lastClientError = String(msg).slice(0, 2000);
    };
    const onReport = (e) => openTicket(e.detail || {});   // fired by ErrorBoundary etc.

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('mds:report-issue', onReport);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('mds:report-issue', onReport);
    };
  }, [openTicket]);

  return (
    <SupportContext.Provider value={{ openTicket }}>
      {children}
      {open && <SupportModal prefill={prefill} onClose={close} />}
    </SupportContext.Provider>
  );
}

// Safe fallback so callers never crash if used outside the provider.
export const useSupport = () => useContext(SupportContext) || { openTicket: () => {} };
