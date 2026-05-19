import React, { useState, useEffect, useRef } from 'react';

export default function Ribbon({ sessionUser, onLogout, onSync }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = sessionUser?.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="top-ribbon">
      <h1>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        MDS Premium
      </h1>
      
      <div className="user-controls">
        <button className="btn-ghost" onClick={() => onSync(true)} title="Force a fresh data pull from Replicon">
          <i className='bx bx-cloud-download' style={{ fontSize: '1.2rem' }}></i> Sync Data
        </button>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>
        
        <div className="user-profile" ref={dropdownRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="user-avatar">{userInitial}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">Executive</span>
          </div>
          <i className='bx bx-chevron-down' style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginLeft: '4px' }}></i>
          
          {dropdownOpen && (
            <div className="dropdown-menu" style={{ display: 'block' }}>
              <a href="#profile" onClick={(e) => e.preventDefault()}><i className='bx bx-user'></i> Profile</a>
              <div className="dropdown-divider"></div>
              <a href="#logout" className="text-danger" onClick={(e) => { e.preventDefault(); onLogout(); }}>
                <i className='bx bx-power-off'></i> Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}