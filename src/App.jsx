import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

// Global UI Components
import Navbar from './components/Navbar';
import LoadingOverlay from './components/LoadingOverlay';
import LoginModal from './components/LoginModal';

// Pages
import Dashboard from './pages/Dashboard';
import Employee from './pages/Employee';
import ProjectDeepDive from './pages/ProjectDeepDive';
import TimesheetOps from './pages/TimesheetOps';
import SmartInitiator from './pages/SmartInitiator';

// Data Engine
import { useRepliconData } from './hooks/useRepliconData';

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

  // 4. Main Application Render
  return (
    <div className="app-container">
      {/* 1. If not logged in, show login - NO ROUTER HOOKS USED HERE */}
      {!sessionUser && <LoginModal onSuccess={(user) => setSessionUser(user)} />}

      {/* 2. Only render the Router block when logged in */}
      {sessionUser && (
        <>
          {loading && <LoadingOverlay text={statusText} />}
          <Navbar />
          <main className="dashboard-container">
            <Routes>
              <Route path="/" element={<Dashboard dataMatrix={dataMatrix} />} />
              <Route path="/employee" element={<Employee dataMatrix={dataMatrix} sessionUser={sessionUser} />} />
              <Route path="/projects" element={<ProjectDeepDive dataMatrix={dataMatrix} />} />
              <Route path="/timesheets" element={<TimesheetOps dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
              <Route path="/new-project" element={<SmartInitiator dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
            </Routes>
          </main>
        </>
      )}
    </div>
  );
}