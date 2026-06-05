import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import Sidebar            from './components/Sidebar';
import Ribbon             from './components/Ribbon';
import SessionManager     from './components/SessionManager';
import LoadingScreen      from './components/LoadingScreen';
import Login              from './components/Login';
import ToastStack         from './components/Toast';
import GlobalSearch       from './components/GlobalSearch';
import KeyboardShortcuts  from './components/KeyboardShortcuts';
import ChatBot            from './components/ChatBot';

import Dashboard       from './pages/Dashboard';
import Employee        from './pages/Employee';
import ProjectDeepDive from './pages/ProjectDeepDive';
import TimesheetOps    from './pages/TimesheetOps';
import SmartInitiator  from './pages/SmartInitiator';
import ProjectEdit     from './pages/ProjectEdit';
import ClientCreate    from './pages/ClientCreate';
import ClientEdit      from './pages/ClientEdit';
import AIInsights      from './pages/AIInsights';
import Settings        from './pages/Settings';

import { useRepliconData }    from './hooks/useRepliconData';
import { repliconApi }        from './api/replicon';
import { ThemeProvider }      from './context/ThemeContext';
import { ToastProvider }      from './context/ToastContext';
import { PermissionProvider, useCan } from './context/PermissionContext';

const SIDEBAR_COLLAPSED_KEY = 'mds_sidebar_collapsed';

function GuardedRoute({ page, children }) {
  const can = useCan(page);
  if (!can) return <div style={{ padding: '60px 40px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>You don't have permission to view this page.</div>;
  return children;
}

function AppContent() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const [sessionUser,    setSessionUser]    = useState(null);
  const [isAppReady,     setIsAppReady]     = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [shortcutsOpen,  setShortcutsOpen]  = useState(false);

  // Session check: try httpOnly cookie first, fall back to legacy localStorage
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { user } = await repliconApi.me();
        setSessionUser(user);
      } catch {
        // Cookie session invalid — try legacy localStorage
        const legacy = localStorage.getItem('mds_dashboard_session');
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy);
            if (Date.now() < parsed.expiresAt) setSessionUser(parsed.user);
            else localStorage.removeItem('mds_dashboard_session');
          } catch { localStorage.removeItem('mds_dashboard_session'); }
        }
      } finally {
        setIsAppReady(true);
      }
    };
    checkSession();
  }, []);

  const handleLogout = useCallback(async () => {
    try { await repliconApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('mds_dashboard_session');
    setSessionUser(null);
  }, []);

  // Listen for unauthorized events from api layer
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener('mds:unauthorized', handler);
    return () => window.removeEventListener('mds:unauthorized', handler);
  }, [handleLogout]);

  // Audit page views
  useEffect(() => {
    if (!sessionUser) return;
    fetch('/api/v1/audit/pageview', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: location.pathname }) }).catch(() => {});
  }, [location.pathname, sessionUser]);

  const { dataMatrix, loading, statusText, syncMatrixData, lastSynced } = useRepliconData(sessionUser);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!prev));
      return !prev;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (!sessionUser) return;
      const isInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === '?' && !isInput) setShortcutsOpen(true);
      if (e.key === 'Escape') { setSearchOpen(false); setShortcutsOpen(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !isInput) { e.preventDefault(); syncMatrixData(true); }
      if (!isInput && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') navigate('/');
        if (e.key === '2') navigate('/employee');
        if (e.key === '3') navigate('/projects');
        if (e.key === '4') navigate('/timesheets');
        if (e.key === '5') navigate('/new-project');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sessionUser, navigate, syncMatrixData]);

  const sidebarWidth = sidebarCollapsed ? 72 : 240;

  const pendingCount = (dataMatrix?.timesheets || []).filter(t => (t.status||'').toLowerCase().includes('waiting')).length;

  if (!isAppReady) return null;

  if (!sessionUser) {
    return (
      <Login onLoginSuccess={async () => {
        try {
          const { user } = await repliconApi.me();
          setSessionUser(user);
        } catch { /* ignore */ }
      }} />
    );
  }

  return (
    <PermissionProvider sessionUser={sessionUser}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <Sidebar
          sessionUser={sessionUser}
          onLogout={handleLogout}
          pendingCount={pendingCount}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        <div style={{ flex: 1, marginLeft: `${sidebarWidth}px`, transition: 'margin-left 0.25s cubic-bezier(0.2,0.8,0.2,1)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <SessionManager onLogout={handleLogout} />
          <LoadingScreen isVisible={loading} statusText={statusText} />

          <Ribbon
            sessionUser={sessionUser}
            onLogout={handleLogout}
            onSync={() => syncMatrixData(true)}
            onSearchOpen={() => setSearchOpen(true)}
            lastSynced={lastSynced}
            dataMatrix={dataMatrix}
          />

          <main className="dashboard-container" style={{ flex: 1 }}>
            {dataMatrix && (
              <Routes>
                <Route path="/"               element={<GuardedRoute page="dashboard"><Dashboard       dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/employee"       element={<GuardedRoute page="employees"><Employee         dataMatrix={dataMatrix} sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/projects"       element={<GuardedRoute page="projects" ><ProjectDeepDive  dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/timesheets"     element={<GuardedRoute page="timesheets"><TimesheetOps    dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} /></GuardedRoute>} />
                <Route path="/new-project"    element={<GuardedRoute page="projects" ><SmartInitiator   dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} /></GuardedRoute>} />
                <Route path="/projects/edit"  element={<GuardedRoute page="projects" ><ProjectEdit      dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/clients/create" element={<GuardedRoute page="clients"  ><ClientCreate     dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/clients/edit"   element={<GuardedRoute page="clients"  ><ClientEdit       dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/ai-insights"    element={<GuardedRoute page="aiInsights"><AIInsights      dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/settings"       element={<GuardedRoute page="settings" ><Settings         sessionUser={sessionUser} /></GuardedRoute>} />
              </Routes>
            )}
          </main>
        </div>

        {/* Global overlays */}
        <GlobalSearch  dataMatrix={dataMatrix} isOpen={searchOpen}    onClose={() => setSearchOpen(false)} />
        <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <ToastStack />
        <ChatBot dataMatrix={dataMatrix} />
      </div>
    </PermissionProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
