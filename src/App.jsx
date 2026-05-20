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

export default function App() {
  const { 
    loading, 
    statusText, 
    sessionUser, 
    dataMatrix, 
    syncMatrixData, 
    logoutSession, 
    setSessionUser 
  } = useRepliconData();

  if (!sessionUser) {
    return <LoginModal onSuccess={(user) => { setSessionUser(user); syncMatrixData(false); }} />;
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
          <Route path="/projects" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Project Deep Dive Module pending...</h2></div>} />
          <Route path="/capacity" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Capacity Hub Module pending...</h2></div>} />
          <Route path="/timesheets" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Timesheet Ops Module pending...</h2></div>} />
          <Route path="/new-project" element={<SmartInitiator dataMatrix={dataMatrix} syncMatrixData={syncMatrixData} />} />
        </Routes>
      </main>
    </Router>
  );
}