import React, { useState, useEffect, useRef } from 'react';

export default function Ribbon({ sessionUser, onLogout, onSync }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
      <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className='bx bx-hive' style={{ color: 'var(--accent-blue)' }}></i>
        Liveroute Replicon Analytics V2.0
      </h1>
      
      <div className="user-controls">
        <button className="btn-ghost" onClick={onSync}>
          <i className='bx bx-cloud-download'></i> Sync Data
        </button>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
        
        <div className="user-profile" ref={dropdownRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="user-avatar">{userInitial}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">Executive</span>
          </div>
          <i className='bx bx-chevron-down'></i>
          
          {dropdownOpen && (
            <div className="dropdown-menu" style={{ display: 'flex' }}>
              <a href="#profile" onClick={(e) => e.preventDefault()}><i className='bx bx-user'></i> Profile</a>
              <div className="dropdown-divider"></div>
              <a href="#logout" onClick={(e) => { e.preventDefault(); onLogout(); }} className="text-danger">
                <i className='bx bx-power-off'></i> Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}