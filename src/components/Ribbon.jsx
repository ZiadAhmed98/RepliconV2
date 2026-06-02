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
    <header className="top-ribbon" style={{ padding: '16px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
      <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className='bx bx-hive' style={{ color: 'var(--accent-blue, #32ade6)' }}></i>
        Liveroute Replicon Analytics V2.0
      </h1>
      
      <div className="user-controls" style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
        
        {/* Sync Button */}
        <button onClick={onSync} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <i className='bx bx-cloud-download'></i> Sync Data
        </button>
        
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>
        
        {/* Profile Dropdown Area */}
        <div 
          ref={dropdownRef} 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 12px', borderRadius: '16px' }}
        >
          {/* Bulletproof Avatar Circle */}
          <div style={{ 
            width: '36px', height: '36px', borderRadius: '50%', 
            background: 'linear-gradient(135deg, #a855f7, #d8b4fe)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            color: '#fff', fontWeight: '700', fontSize: '1rem',
            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
          }}>
            {userInitial}
          </div>
          
          {/* Bulletproof User Text */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', lineHeight: '1.2' }}>{userName}</span>
            <span style={{ fontSize: '0.65rem', color: '#98989d', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, lineHeight: '1.2', marginTop: '2px' }}>Owner</span>
          </div>
          
          <i className='bx bx-chevron-down' style={{ color: '#98989d', marginLeft: '4px' }}></i>
          
          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div style={{ 
              position: 'absolute', top: '100%', right: '0', marginTop: '10px',
              background: 'rgba(30, 30, 34, 0.95)', backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', 
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)', width: '180px', 
              display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000
            }}>
              <a href="#profile" onClick={(e) => e.preventDefault()} style={{ padding: '14px 16px', color: '#98989d', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                <i className='bx bx-user'></i> Profile
              </a>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
              <a href="#logout" onClick={(e) => { e.preventDefault(); onLogout(); }} style={{ padding: '14px 16px', color: '#ff3b30', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                <i className='bx bx-power-off'></i> Logout
              </a>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}