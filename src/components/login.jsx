import React, { useState, useEffect, useRef } from 'react';
import globals from '../globals.js';
import { setCurrentUser } from '../data.js';

// -- Login Screen -------------------------------------------------------------
const LoginScreen = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pinRef = useRef(null);
  const searchRef = useRef(null);
  const wrapperRef = useRef(null);

  const activeUsers = globals.hotelUsers.filter(u => u.active);
  const filteredUsers = search.trim()
    ? activeUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    if (selectedUser && pinRef.current) pinRef.current.focus();
  }, [selectedUser]);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handlePinSubmit = () => {
    const user = globals.hotelUsers.find(u => u.id === selectedUser && u.active);
    if (!user) return;
    if (user.pin !== pin) {
      setError('Incorrect PIN');
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setCurrentUser(user.id);
    onLogin(user);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && pin.length >= 4) handlePinSubmit();
    if (e.key === 'Escape') { setSelectedUser(null); setPin(''); setError(''); }
  };

  const selectUser = (user) => {
    setSelectedUser(user.id);
    setPin('');
    setError('');
    setSearch('');
    setDropdownOpen(false);
  };

  const initials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase();
  const roleLabels = { admin: 'Admin', manager: 'Manager', receptionist: 'Reception', housekeeping: 'Housekeeping', fb: 'F&B' };

  // Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  const eb = (globals.hotelSettings.emailBranding || {});
  const logo = eb.logoUrl || null;

  return (
    <div style={{minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif'}}>
      <div style={{background: '#fff', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center'}}>

        {/* Logo + hotel name */}
        {logo
          ? <img src={logo} alt="" style={{maxHeight: 56, maxWidth: 180, margin: '0 auto 16px'}} />
          : <div style={{width: 48, height: 48, background: '#171717', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'}}>
              <span style={{color: '#fff', fontSize: 18, fontWeight: 700}}>R</span>
            </div>
        }
        <h1 style={{fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 'normal', color: '#111', margin: '0 0 4px'}}>{globals.hotelSettings.hotelName || 'Rumo PMS'}</h1>
        <p style={{color: '#999', fontSize: 14, margin: '0 0 32px'}}>
          {time.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span style={{margin: '0 6px', color: '#ccc'}}>·</span>
          {time.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
        </p>

        {!selectedUser ? (
          <div ref={wrapperRef} style={{position: 'relative', textAlign: 'left'}}>
            <div style={{position: 'relative'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#aaa', pointerEvents: 'none'}}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Who's working?"
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownOpen(e.target.value.trim().length > 0); }}
                onFocus={() => { if (search.trim().length > 0) setDropdownOpen(true); }}
                style={{width: '100%', padding: '14px 16px 14px 44px', fontSize: 15, border: '2px solid #e5e5e5', borderRadius: 12, outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms', background: 'transparent'}}
                onMouseOver={e => e.target.style.borderColor = '#ccc'}
                onMouseOut={e => { if (document.activeElement !== e.target) e.target.style.borderColor = '#e5e5e5'; }}
                onFocusCapture={e => e.target.style.borderColor = '#171717'}
                onBlurCapture={e => e.target.style.borderColor = '#e5e5e5'}
              />
            </div>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="login-dropdown-enter" style={{position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 8, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain', zIndex: 10}}>
                {filteredUsers.length > 0 ? (
                  <div style={{padding: '4px 0'}}>
                    {filteredUsers.map((user, idx) => (
                      <button key={user.id}
                        className="login-item-enter"
                        style={{ animationDelay: `${idx * 40}ms`, width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                        onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                        onClick={() => selectUser(user)}>
                        <div style={{width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, backgroundColor: user.color}}>
                          {initials(user.name)}
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontSize: 14, fontWeight: 500, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{user.name}</div>
                          <div style={{fontSize: 11, color: '#aaa'}}>{roleLabels[user.role] || user.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="login-item-enter" style={{padding: '24px 16px', fontSize: 14, color: '#aaa', textAlign: 'center'}}>No staff found</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {(() => {
              const user = globals.hotelUsers.find(u => u.id === selectedUser);
              if (!user) return null;
              return (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  {/* Back */}
                  <button onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
                    style={{alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, transition: 'color 150ms'}}
                    onMouseOver={e => e.currentTarget.style.color = '#666'}
                    onMouseOut={e => e.currentTarget.style.color = '#aaa'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                  </button>

                  {/* Avatar + name */}
                  <div style={{width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 12, backgroundColor: user.color}}>
                    {initials(user.name)}
                  </div>
                  <h3 style={{fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 'normal', color: '#111', margin: '0 0 2px'}}>{user.name}</h3>
                  <span style={{fontSize: 11, color: '#aaa', marginBottom: 24}}>{roleLabels[user.role] || user.role}</span>

                  {/* PIN input */}
                  <div className={shake ? 'animate-shake' : ''} style={{width: '100%', maxWidth: 220}}>
                    <input
                      ref={pinRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="PIN"
                      style={{width: '100%', padding: '14px 16px', fontSize: 22, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 8, border: '2px solid #e5e5e5', borderRadius: 12, outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms'}}
                      onFocus={e => e.target.style.borderColor = '#171717'}
                      onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                    />
                    {error && <p style={{color: '#ef4444', fontSize: 13, marginTop: 8, textAlign: 'center'}}>{error}</p>}
                  </div>

                  <button onClick={handlePinSubmit} disabled={pin.length < 4}
                    style={{width: '100%', maxWidth: 220, padding: '14px', marginTop: 16, background: '#171717', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: pin.length >= 4 ? 1 : 0.4, transition: 'opacity 200ms'}}>
                    Sign in
                  </button>
                </div>
              );
            })()}
          </>
        )}

        {/* Footer */}
        <p style={{color: '#ccc', fontSize: 11, marginTop: 32, marginBottom: 0}}>Powered by Rumo</p>
      </div>
    </div>
  );
};

export default LoginScreen;
