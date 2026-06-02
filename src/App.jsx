import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

// Global UI Components
import Ribbon from './components/Ribbon';
import Navbar from './components/Navbar';
import SessionManager from './components/SessionManager'; // NEW: Added Session Manager
import LoadingScreen from './components/LoadingScreen';   // UPGRADE: Swapped to Apple Loading Screen
import Login from './components/Login';                   // UPGRADE: Swapped to the new Login component

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
  const [isAppReady, setIsAppReady] = useState(false); // Safely holds the UI until local storage is checked

  // Check local storage for an active session when the app loads
  useEffect(() => {
    const session = localStorage.getItem('mds_dashboard_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (new Date().getTime() < parsed.expiresAt) {
          setSessionUser(parsed.user);
        } else {
          localStorage.removeItem('mds_dashboard_session');
        }
      } catch (e) { 
        // Catch corrupt JSON and wipe it to prevent crashes
        localStorage.removeItem('mds_dashboard_session'); 
      }
    }
    setIsAppReady(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('mds_dashboard_session');
    setSessionUser(null);
  };

  // 2. The Data Engine (Only fires if we actually have a logged-in user)
  // This is your North Star. We are leaving it completely untouched!
  const { dataMatrix, loading, statusText, syncMatrixData } = useRepliconData(sessionUser);

  // Prevent UI flash before storage check is complete
  if (!isAppReady) return null;

  // 4. Main Application Render
  return (
    <div className="app-container">
      {/* 1. If not logged in, show the NEW premium Login screen */}
      {!sessionUser && <Login onLoginSuccess={(user) => setSessionUser(user)} />}

      {/* 2. Only render the Router block when logged in */}
      {sessionUser && (
        <>
          {/* Security: 15-minute idle timeout warning */}
          <SessionManager onLogout={handleLogout} />
          
          {/* The Apple Vision Loading Screen tied to your original loading state */}
          <LoadingScreen isVisible={loading} />
          
          {/* THE STICKY HEADER WRAPPER (Your new Floating Glass Island) */}
          <div className="sticky-header-group">
            <Ribbon 
              sessionUser={sessionUser} 
              onLogout={handleLogout} 
              onSync={() => syncMatrixData(true)} 
            />
            <Navbar />
          </div>

          <main className="dashboard-container">
            {/* Safe rendering: Only mount routes if dataMatrix isn't null to prevent child component crashes */}
            {dataMatrix && (
              <Routes>
                <Route path="/" element={<Dashboard dataMatrix={dataMatrix} />} />
                <Route path="/employee" element={<Employee dataMatrix={dataMatrix} sessionUser={sessionUser} />} />
                <Route path="/projects" element={<ProjectDeepDive dataMatrix={dataMatrix} />} />
                <Route path="/timesheets" element={<TimesheetOps dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
                <Route path="/new-project" element={<SmartInitiator dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
              </Routes>
            )}
          </main>
        </>
      )}
    </div>
  );
}