// ── Login Screen ────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [shake, setShake] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const pinRef = React.useRef(null);
  const searchRef = React.useRef(null);
  const wrapperRef = React.useRef(null);

  const activeUsers = hotelUsers.filter(u => u.active);
  const filteredUsers = search.trim()
    ? activeUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  React.useEffect(() => {
    if (selectedUser && pinRef.current) pinRef.current.focus();
  }, [selectedUser]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handlePinSubmit = () => {
    const user = hotelUsers.find(u => u.id === selectedUser && u.active);
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
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">

      {/* Logo + hotel name */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-white text-lg font-bold">R</span>
        </div>
        <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{hotelSettings.hotelName || 'Rumo PMS'}</h1>
        <p className="text-xs text-neutral-400 mt-1">
          {time.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span className="mx-1.5 text-neutral-300">·</span>
          {time.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">

        {!selectedUser ? (
          <>
            {/* Search input */}
            <div className="relative" ref={wrapperRef}>
              <div className={`flex items-center gap-3 px-4 py-3.5${dropdownOpen ? ' border-b border-neutral-100' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-neutral-400 flex-shrink-0">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Who's working?"
                  className="flex-1 text-sm outline-none bg-transparent text-neutral-900 placeholder-neutral-400"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setDropdownOpen(e.target.value.trim().length > 0); }}
                />
              </div>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="login-dropdown-enter max-h-64 overflow-y-auto overscroll-contain">
                  {filteredUsers.length > 0 ? (
                    <div className="py-1">
                      {filteredUsers.map((user, idx) => (
                        <button key={user.id}
                          className="login-item-enter w-full px-4 py-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                          style={{ animationDelay: `${idx * 40}ms` }}
                          onClick={() => selectUser(user)}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                            style={{ backgroundColor: user.color }}>
                            {initials(user.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-neutral-900 truncate">{user.name}</div>
                            <div className="text-[11px] text-neutral-400">{roleLabels[user.role] || user.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="login-item-enter px-4 py-6 text-sm text-neutral-400 text-center">No staff found</div>
                  )}
                </div>
              )}
            </div>

          </>
        ) : (
          <>
            {(() => {
              const user = hotelUsers.find(u => u.id === selectedUser);
              if (!user) return null;
              return (
                <div className="p-6 flex flex-col items-center">
                  {/* Back */}
                  <button onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
                    className="self-start flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors mb-5 -mt-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                  </button>

                  {/* Avatar + name */}
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold mb-3"
                    style={{ backgroundColor: user.color }}>
                    {initials(user.name)}
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900">{user.name}</h3>
                  <span className="text-[11px] text-neutral-400 mb-6">{roleLabels[user.role] || user.role}</span>

                  {/* PIN input */}
                  <div className={`w-full max-w-[200px] ${shake ? 'animate-shake' : ''}`}>
                    <input
                      ref={pinRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="PIN"
                      className="w-full text-center text-2xl tracking-[0.5em] py-3 bg-neutral-100 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                    />
                    {error && <p className="text-xs text-red-500 text-center mt-2">{error}</p>}
                  </div>

                  <button onClick={handlePinSubmit} disabled={pin.length < 4}
                    className={`mt-4 w-full max-w-[200px] py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      pin.length >= 4
                        ? 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm'
                        : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    }`}>
                    Sign in
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-neutral-300 mt-6">Rumo PMS</p>
    </div>
  );
};
