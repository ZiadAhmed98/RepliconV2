import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useRepliconData } from './hooks/useRepliconData';

import Ribbon from './components/Ribbon';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import LoadingOverlay from './components/LoadingOverlay';

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

  // If there is no active session, lock the screen and force login
  if (!sessionUser) {
    return <LoginModal onSuccess={(user) => {
      setSessionUser(user);
      syncMatrixData(false);
    }} />;
  }

  // The main layout composition
  return (
    <Router>
      {loading && <LoadingOverlay text="Orchestrating Matrix" subtext={statusText} />}
      
      <Ribbon 
        sessionUser={sessionUser} 
        onLogout={logoutSession} 
        onSync={syncMatrixData} 
      />
      <Navbar />

      <main className="dashboard-container">
        <Routes>
          <Route path="/" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Executive Dashboard Module pending...</h2></div>} />
          <Route path="/employee" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Employee Analytics Module pending...</h2></div>} />
          <Route path="/projects" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Project Deep Dive Module pending...</h2></div>} />
          <Route path="/capacity" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Capacity Hub Module pending...</h2></div>} />
          <Route path="/timesheets" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Timesheet Ops Module pending...</h2></div>} />
          <Route path="/new-project" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Smart Initiator Module pending...</h2></div>} />
        </Routes>
      </main>
    </Router>
  );
}