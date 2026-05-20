import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

// Global UI Components
import UniversalHeader from './components/UniversalHeader';
import UniversalNav from './components/UniversalNav';
import LoadingOverlay from './components/LoadingOverlay';
import Login from './components/Login';

// Pages
import Dashboard from './pages/Dashboard';
import Employee from './pages/Employee';
import ProjectDeepDive from './pages/ProjectDeepDive';
import TimesheetOps from './pages/TimesheetOps';
import SmartInitiator from './pages/SmartInitiator';

// Data Engine
import useRepliconData from './hooks/useRepliconData';

export default function App() {
  // 1. Session State
  const [sessionUser, setSessionUser] = useState(null);

  // Check local storage for an active session when the app loads
  useEffect(() => {
    const session = localStorage.getItem('mds_dashboard_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (new Date().getTime() < parsed.expiresAt) {
          setSessionUser(parsed.user);
        }
      } catch (e) { 
        localStorage.removeItem('mds_dashboard_session'); 
      }
    }
  }, []);

  // 2. The Data Engine (Only fires if we actually have a logged-in user)
  const { dataMatrix, loading, statusText, syncMatrixData } = useRepliconData(sessionUser);

  // 3. The Route Guard: If no session, strictly show the Login screen
  if (!sessionUser) {
    return <Login onLoginSuccess={(user) => setSessionUser(user)} />;
  }

  // 4. Main Application Render (Only seen if authenticated)
  return (
    <div>
      {/* Absolute Loading Overlay */}
      {loading && <LoadingOverlay text="Fetching Data..." subtext={statusText} />}

      {/* Global Navigation & Header */}
      <UniversalHeader sessionUser={sessionUser} forceSync={() => syncMatrixData(true)} />
      <UniversalNav />

      {/* Page Routing */}
      <main className="dashboard-container" style={{ display: 'block', padding: '40px', maxWidth: '1800px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Dashboard dataMatrix={dataMatrix} />} />
          <Route path="/employee" element={<Employee dataMatrix={dataMatrix} sessionUser={sessionUser} />} />
          <Route path="/projects" element={<ProjectDeepDive dataMatrix={dataMatrix} />} />
          <Route path="/timesheets" element={<TimesheetOps dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
          <Route path="/new-project" element={<SmartInitiator dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
        </Routes>
      </main>
    </div>
  );
}