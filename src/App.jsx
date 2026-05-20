import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useRepliconData } from './hooks/useRepliconData';

import Ribbon from './components/Ribbon';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import LoadingOverlay from './components/LoadingOverlay';
import SessionManager from './components/SessionManager';

// Import the new Dashboard Module
import SmartInitiator from './pages/SmartInitiator';
import Dashboard from './pages/Dashboard';
import Employee from './pages/Employee';
import ProjectDeepDive from './pages/ProjectDeepDive';
import TimesheetOps from './pages/TimesheetOps';

export default function App() {
  const [sessionUser, setSessionUser] = useState(null);

  // Check session on load
  useEffect(() => {
    const session = localStorage.getItem('mds_dashboard_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (new Date().getTime() < parsed.expiresAt) {
          setSessionUser(parsed.user);
        }
      } catch (e) { localStorage.removeItem('mds_dashboard_session'); }
    }
  }, []);

  // If NOT logged in, show the full-screen Login component
  if (!sessionUser) {
    return <Login onLoginSuccess={(user) => setSessionUser(user)} />;
  }

  return (
    <Router>
      {loading && <LoadingOverlay text="Fetching Data..." subtext={statusText} />}
      <SessionManager onLogout={logoutSession} />
      
      <Ribbon sessionUser={sessionUser} onLogout={logoutSession} onSync={syncMatrixData} />
      <Navbar />

      <main className="dashboard-container">
        <Routes>
          {/* Mount the Dashboard and pass the data matrix down */}
          <Route path="/" element={<Dashboard dataMatrix={dataMatrix} />} />
          
          <Route path="/employee" element={<Employee dataMatrix={dataMatrix} sessionUser={sessionUser} />} />
          <Route path="/projects" element={<ProjectDeepDive dataMatrix={dataMatrix} />} />
          <Route path="/capacity" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Capacity Hub Module pending...</h2></div>} />
          <Route path="/timesheets" element={<TimesheetOps dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
          <Route path="/new-project" element={<SmartInitiator dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
        </Routes>
      </main>
    </Router>
  );
}