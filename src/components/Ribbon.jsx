import React, { useState, useEffect, useRef } from 'react';
import styles from './Ribbon.module.css'; // Import the specific CSS for the ribbon

export default function Ribbon({ sessionUser, onLogout, onSync }) {
  // state controls whether the dropdown is open (true) or closed (false)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // useRef creates a "hook" to the physical HTML element so we can detect clicks outside of it
  const dropdownRef = useRef(null);

  // =========================================================================
  // CLICK-AWAY LISTENER
  // This effect runs once when the component loads. It listens for mouse clicks.
  // If a click happens OUTSIDE the dropdownRef, it forces the dropdown closed.
  // =========================================================================
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    // Attach listener to the whole document
    document.addEventListener("mousedown", handleClickOutside);
    // Cleanup function: removes listener when component is destroyed (Best Practice)
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = sessionUser?.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className={styles.topRibbon}>
      <h1 className={styles.brand}>
        <i className='bx bx-hive' style={{ color: 'var(--accent-blue)' }}></i>
        Liveroute Replicon Analytics V2.0
      </h1>
      
      <div className={styles.userControls}>
        <button className="btn-ghost" onClick={() => onSync(true)}>
          <i className='bx bx-cloud-download'></i> Sync Data
        </button>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
        
        {/* The User Profile box. Clicking it toggles the dropdownOpen state */}
        <div className={styles.userProfile} ref={dropdownRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
            {userInitial}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{userName}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Executive</span>
          </div>
          <i className='bx bx-chevron-down'></i>
          
          {/* If dropdownOpen is TRUE, render this block */}
          {dropdownOpen && (
            <div className={styles.dropdownMenu}>
              <a href="#profile" onClick={(e) => e.preventDefault()}><i className='bx bx-user'></i> Profile</a>
              <div className={styles.dropdownDivider}></div>
              <a href="#logout" onClick={(e) => { e.preventDefault(); onLogout(); }} style={{ color: 'var(--accent-red)' }}>
                <i className='bx bx-power-off'></i> Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}