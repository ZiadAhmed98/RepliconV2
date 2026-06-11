import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

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
import MyTimesheet     from './pages/MyTimesheet';
import Employees       from './pages/Employees';
import Clients         from './pages/Clients';
import Profile         from './pages/Profile';
import ProjectsAdmin      from './pages/ProjectsAdmin';
import ProjectDetail      from './pages/ProjectDetail';
import TimesheetApproval  from './pages/TimesheetApproval';
import Administration    from './pages/Administration';
import AuditLog         from './pages/AuditLog';
import Migration        from './pages/Migration';
import Home            from './pages/Home';
import Templates       from './pages/Templates';
import AccountManagers       from './pages/AccountManagers';
import AccountManagerDetail  from './pages/AccountManagerDetail';
import Programs              from './pages/Programs';

// Settings pages
import GeneralSettings      from './pages/settings/GeneralSettings';
import Branding             from './pages/settings/Branding';
import Localization         from './pages/settings/Localization';
import BackupRestore        from './pages/settings/BackupRestore';
import ProjectSettings      from './pages/settings/ProjectSettings';
import ProjectCategories    from './pages/settings/ProjectCategories';
import ProjectTemplates     from './pages/settings/ProjectTemplates';
import BillingSettings      from './pages/settings/BillingSettings';
import ClientSettings       from './pages/settings/ClientSettings';
import ClientTiers          from './pages/settings/ClientTiers';
import SLAConfiguration     from './pages/settings/SLAConfiguration';
import ContractTemplates    from './pages/settings/ContractTemplates';
import TaskSettings         from './pages/settings/TaskSettings';
import TaskCategories       from './pages/settings/TaskCategories';
import PriorityLevels       from './pages/settings/PriorityLevels';
import WorkflowRules        from './pages/settings/WorkflowRules';
import TimesheetPeriods     from './pages/settings/TimesheetPeriods';
import ApprovalWorkflow     from './pages/settings/ApprovalWorkflow';
import OvertimeRules        from './pages/settings/OvertimeRules';
import HolidayCalendar      from './pages/settings/HolidayCalendar';
import BillingRates         from './pages/settings/BillingRates';
import CurrencySettings     from './pages/settings/CurrencySettings';
import InvoiceTemplates     from './pages/settings/InvoiceTemplates';
import CostCenters          from './pages/settings/CostCenters';
import RolesPermissions     from './pages/settings/RolesPermissions';
import TeamHierarchy        from './pages/settings/TeamHierarchy';
import EmailTemplates       from './pages/settings/EmailTemplates';
import AlertRules           from './pages/settings/AlertRules';
import NotificationPreferences from './pages/settings/NotificationPreferences';
import CalendarIntegration  from './pages/settings/CalendarIntegration';
import APIKeys              from './pages/settings/APIKeys';
import Webhooks             from './pages/settings/Webhooks';

import { ADMIN_PATH }         from './config/adminRoutes';
import { useRepliconData }    from './hooks/useRepliconData';
import { repliconApi }        from './api/replicon';
import { ThemeProvider }      from './context/ThemeContext';
import { ToastProvider }      from './context/ToastContext';
import { PermissionProvider, useCan } from './context/PermissionContext';

const SIDEBAR_COLLAPSED_KEY = 'mds_sidebar_collapsed';

function GuardedRoute({ page, children }) {
  const can = useCan(page);
  if (!can) return <Navigate to="/home" replace />;
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
    navigate('/', { replace: true });
  }, [navigate]);

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
        if (e.key === '1') navigate('/dashboard');
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
          navigate('/home');   // always land on home after login — clears any prior admin URL
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

          {/* key=sessionUser.id forces full remount of all page components on user switch */}
          <main key={sessionUser?.id || 'anon'} className="dashboard-container" style={{ flex: 1 }}>
            {dataMatrix && (
              <Routes>
                <Route path="/"               element={<Navigate to="/home" replace />} />
                <Route path="/home"           element={<Home sessionUser={sessionUser} />} />
                <Route path="/templates"      element={<Templates sessionUser={sessionUser} />} />
                <Route path="/dashboard"      element={<GuardedRoute page="dashboard"><Dashboard       dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/employee"       element={<GuardedRoute page="employees"><Employee         dataMatrix={dataMatrix} sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/projects"       element={<GuardedRoute page="projects" ><ProjectDeepDive  dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/timesheets"     element={<GuardedRoute page="timesheets"><TimesheetOps    dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} /></GuardedRoute>} />
                <Route path="/new-project"    element={<GuardedRoute page="projects" ><SmartInitiator   dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} /></GuardedRoute>} />
                <Route path="/projects/edit"  element={<GuardedRoute page="projects" ><ProjectEdit      dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/clients/create" element={<GuardedRoute page="clients"  ><ClientCreate     dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/clients/edit"   element={<GuardedRoute page="clients"  ><ClientEdit       dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/ai-insights"    element={<GuardedRoute page="aiInsights"><AIInsights      dataMatrix={dataMatrix} /></GuardedRoute>} />
                <Route path="/my-timesheet"   element={<GuardedRoute page="myTimesheet"><MyTimesheet    dataMatrix={dataMatrix} sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/employees"           element={<GuardedRoute page="employees" ><Employees       sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/clients"             element={<GuardedRoute page="clients"  ><Clients         sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/programs"            element={<Programs />} />
                <Route path="/account-managers"       element={<AccountManagers sessionUser={sessionUser} />} />
                <Route path="/account-managers/:id"  element={<AccountManagerDetail />} />
                <Route path="/projects-admin"      element={<GuardedRoute page="projects"       ><ProjectsAdmin   sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/projects-admin/:id"  element={<GuardedRoute page="projects"       ><ProjectDetail   sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path="/profile"             element={<Profile />} />
                <Route path="/timesheets-approval" element={<GuardedRoute page="timesheetApproval"><TimesheetApproval sessionUser={sessionUser} /></GuardedRoute>} />
                <Route path={ADMIN_PATH.administration} element={<GuardedRoute page="administration"><Administration /></GuardedRoute>} />
                <Route path={ADMIN_PATH.auditLog}       element={<GuardedRoute page="administration"><AuditLog /></GuardedRoute>} />
                <Route path={ADMIN_PATH.migration}      element={<GuardedRoute page="administration"><Migration /></GuardedRoute>} />

                {/* Settings routes */}
                <Route path="/settings/general"                element={<GuardedRoute page="administration"><GeneralSettings /></GuardedRoute>} />
                <Route path="/settings/branding"               element={<GuardedRoute page="administration"><Branding /></GuardedRoute>} />
                <Route path="/settings/localization"           element={<GuardedRoute page="administration"><Localization /></GuardedRoute>} />
                <Route path="/settings/backup"                 element={<GuardedRoute page="administration"><BackupRestore /></GuardedRoute>} />
                <Route path="/settings/projects"               element={<GuardedRoute page="administration"><ProjectSettings /></GuardedRoute>} />
                <Route path="/settings/project-categories"     element={<GuardedRoute page="administration"><ProjectCategories /></GuardedRoute>} />
                <Route path="/settings/project-templates"      element={<GuardedRoute page="administration"><ProjectTemplates /></GuardedRoute>} />
                <Route path="/settings/billing"                element={<GuardedRoute page="administration"><BillingSettings /></GuardedRoute>} />
                <Route path="/settings/clients"                element={<GuardedRoute page="administration"><ClientSettings /></GuardedRoute>} />
                <Route path="/settings/client-tiers"           element={<GuardedRoute page="administration"><ClientTiers /></GuardedRoute>} />
                <Route path="/settings/sla"                    element={<GuardedRoute page="administration"><SLAConfiguration /></GuardedRoute>} />
                <Route path="/settings/contracts"              element={<GuardedRoute page="administration"><ContractTemplates /></GuardedRoute>} />
                <Route path="/settings/tasks"                  element={<GuardedRoute page="administration"><TaskSettings /></GuardedRoute>} />
                <Route path="/settings/task-categories"        element={<GuardedRoute page="administration"><TaskCategories /></GuardedRoute>} />
                <Route path="/settings/priorities"             element={<GuardedRoute page="administration"><PriorityLevels /></GuardedRoute>} />
                <Route path="/settings/workflows"              element={<GuardedRoute page="administration"><WorkflowRules /></GuardedRoute>} />
                <Route path="/settings/timesheet-periods"      element={<GuardedRoute page="administration"><TimesheetPeriods /></GuardedRoute>} />
                <Route path="/settings/approval-workflow"      element={<GuardedRoute page="administration"><ApprovalWorkflow /></GuardedRoute>} />
                <Route path="/settings/overtime"               element={<GuardedRoute page="administration"><OvertimeRules /></GuardedRoute>} />
                <Route path="/settings/holidays"               element={<GuardedRoute page="administration"><HolidayCalendar /></GuardedRoute>} />
                <Route path="/settings/billing-rates"          element={<GuardedRoute page="administration"><BillingRates /></GuardedRoute>} />
                <Route path="/settings/currency"               element={<GuardedRoute page="administration"><CurrencySettings /></GuardedRoute>} />
                <Route path="/settings/invoice-templates"      element={<GuardedRoute page="administration"><InvoiceTemplates /></GuardedRoute>} />
                <Route path="/settings/cost-centers"           element={<GuardedRoute page="administration"><CostCenters /></GuardedRoute>} />
                <Route path="/settings/roles"                  element={<GuardedRoute page="administration"><RolesPermissions /></GuardedRoute>} />
                <Route path="/settings/team-hierarchy"         element={<GuardedRoute page="administration"><TeamHierarchy /></GuardedRoute>} />
                <Route path="/settings/email-templates"        element={<GuardedRoute page="administration"><EmailTemplates /></GuardedRoute>} />
                <Route path="/settings/alert-rules"            element={<GuardedRoute page="administration"><AlertRules /></GuardedRoute>} />
                <Route path="/settings/notification-preferences" element={<GuardedRoute page="administration"><NotificationPreferences /></GuardedRoute>} />
                <Route path="/settings/calendar"               element={<GuardedRoute page="administration"><CalendarIntegration /></GuardedRoute>} />
                <Route path="/settings/api-keys"               element={<GuardedRoute page="administration"><APIKeys /></GuardedRoute>} />
                <Route path="/settings/webhooks"               element={<GuardedRoute page="administration"><Webhooks /></GuardedRoute>} />

                <Route path="*" element={<Navigate to="/home" replace />} />
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
