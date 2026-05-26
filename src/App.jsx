import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SmartInitiator from './pages/SmartInitiator';
import Ribbon from './components/Ribbon';
import Navbar from './components/Navbar';
import SessionManager from './components/SessionManager';
import LoadingScreen from './components/LoadingScreen';

export default function App() {
  const [sessionUser, setSessionUser] = useState(null);
  const [dataMatrix, setDataMatrix] = useState(null); 
  const [isFetching, setIsFetching] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false); // Prevents flashing the login screen

  const performSync = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      setDataMatrix(data);
    } catch (error) {
      alert("Failed to sync data from server.");
    } finally {
      setTimeout(() => setIsFetching(false), 500); 
    }
  };

  // Check for existing session on page load
  useEffect(() => {
    const storedSession = localStorage.getItem('mds_dashboard_session');
    if (storedSession) {
      const parsed = JSON.parse(storedSession);
      if (parsed.expiresAt > Date.now()) {
        setSessionUser(parsed.user);
        performSync(); // Fetch data instantly if logged in!
      } else {
        localStorage.removeItem('mds_dashboard_session');
      }
    }
    setIsAppReady(true);
  }, []);

  const handleLoginSuccess = (userData) => {
    setSessionUser(userData);
    performSync(); // Fetch data instantly after a fresh login!
  };

  const handleLogout = () => {
    setSessionUser(null);
    setDataMatrix(null);
    localStorage.removeItem('mds_dashboard_session');
  };

  // Wait until we check local storage before rendering anything
  if (!isAppReady) return null;

  if (!sessionUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Router>
      <SessionManager onLogout={handleLogout} />
      
      {/* The Loading Screen will cover the UI while performSync is running */}
      <LoadingScreen isVisible={isFetching} />

      <div className="sticky-header-group">
        <Ribbon sessionUser={sessionUser} onLogout={handleLogout} onSync={performSync} />
        <Navbar />
      </div>

      <div className="dashboard-container">
        {/* Only render the pages once the data has successfully downloaded */}
        {dataMatrix && (
          <Routes>
            <Route path="/" element={<Dashboard dataMatrix={dataMatrix} />} />
            <Route path="/new-project" element={<SmartInitiator dataMatrix={dataMatrix} syncMatrixData={performSync} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}