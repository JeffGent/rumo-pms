// ── Guest Portal — Standalone page, no PMS layout ──────────────────────────
// Rendered outside the normal app when URL hash starts with #/go
// No login required. Mobile-first, guest-facing design.

const GuestPortal = () => {
  const [portalCode, setPortalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [portalData, setPortalData] = useState(null); // { reservation, room, roomIndex, hotelBranding? }

  // Extract code from URL hash if present: #/go?code=XX-0000
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/code=([A-Z0-9-]+)/i);
    if (match) {
      const code = match[1].toUpperCase();
      setPortalCode(code);
      if (code.length >= 7) validateCode(code);
    }
  }, []);

  // Use branding from Supabase lookup (multi-tenant) or fall back to local hotelSettings
  const hs = portalData?.hotelBranding || hotelSettings;
  const eb = hs.emailBranding || {};
  const pc = eb.primaryColor || '#171717';

  // Sanitize logo URL — only allow http(s) and data URIs
  const safeLogo = (url) => {
    if (!url) return null;
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/')) return url;
    return null;
  };

  const autoFormatCode = (val) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length > 2) clean = clean.slice(0, 2) + '-' + clean.slice(2);
    if (clean.length > 7) clean = clean.slice(0, 7);
    return clean;
  };

  const validateCode = async (code) => {
    if (attempts >= 5) {
      setError('Too many attempts. Please try again later.');
      return;
    }
    setLoading(true);
    setError('');
    setAttempts(prev => prev + 1);

    // Check localStorage first
    let found = null;
    let supabaseFailed = false;
    const now = new Date();
    for (const res of reservations) {
      for (let ri = 0; ri < (res.rooms || []).length; ri++) {
        const room = res.rooms[ri];
        if (room.guestPortalCode === code) {
          const validFrom = room.portalCodeValidFrom ? new Date(room.portalCodeValidFrom) : null;
          const validUntil = room.portalCodeValidUntil ? new Date(room.portalCodeValidUntil) : null;
          if (validFrom && validFrom > now) continue;
          if (validUntil && validUntil < now) continue;
          found = { reservation: res, room, roomIndex: ri };
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      // Try Supabase lookup
      try {
        const result = await lookupPortalCode(code);
        if (result && result.reservation) {
          const resData = result.reservation;
          const room = (resData.rooms || [])[result.room_index || 0];
          if (room) found = { reservation: resData, room, roomIndex: result.room_index || 0, hotelBranding: result.hotelBranding };
        }
      } catch (e) {
        console.warn('[Portal] Supabase lookup failed:', e);
        supabaseFailed = true;
      }
    }

    setLoading(false);
    if (found) {
      setPortalData(found);
    } else {
      setError(supabaseFailed
        ? 'Could not verify your code. Please check your internet connection and try again.'
        : 'Invalid or expired code. Please check and try again.');
    }
  };

  // Determine stay status
  const getStayStatus = (room) => {
    const now = new Date();
    const ci = new Date(room.checkin);
    const co = new Date(room.checkout);
    const todayStr = now.toDateString();
    if (room.status === 'checked-out') return { label: 'Checked Out', color: '#737373', bg: '#f5f5f5' };
    if (room.status === 'checked-in') return { label: 'In-house', color: '#059669', bg: '#ecfdf5' };
    if (ci.toDateString() === todayStr) return { label: 'Today', color: '#d97706', bg: '#fffbeb' };
    if (ci > now) return { label: 'Upcoming', color: '#2563eb', bg: '#eff6ff' };
    return { label: 'Past', color: '#737373', bg: '#f5f5f5' };
  };

  const numNights = (room) => {
    if (!room.checkin || !room.checkout) return 0;
    return Math.max(1, Math.round((new Date(room.checkout) - new Date(room.checkin)) / 86400000));
  };

  const logo = safeLogo(eb.logoUrl);

  // ── Code Entry Screen ─────────────────────────────────────────────────
  if (!portalData) {
    return (
      <div style={{minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif'}}>
        <div style={{background: '#fff', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center'}}>
          {logo && <img src={logo} alt="" style={{maxHeight: 56, maxWidth: 180, margin: '0 auto 16px'}} />}
          <h1 style={{fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 'bold', color: '#111', margin: '0 0 4px'}}>{hs.hotelName || 'Welcome'}</h1>
          <p style={{color: '#999', fontSize: 14, margin: '0 0 32px'}}>Enter your access code</p>

          <form onSubmit={e => { e.preventDefault(); if (portalCode.length >= 7) validateCode(portalCode); }}>
            <input id="portal-code-input" value={portalCode} onChange={e => setPortalCode(autoFormatCode(e.target.value))}
              placeholder="e.g. MK-4829"
              autoComplete="off"
              disabled={attempts >= 5}
              style={{width: '100%', padding: '14px 16px', fontSize: 20, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 4, border: '2px solid #e5e5e5', borderRadius: 12, outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms'}}
              onFocus={e => e.target.style.borderColor = pc}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'} />

            {error && <p style={{color: '#ef4444', fontSize: 13, marginTop: 12}}>{error}</p>}

            <button type="submit" disabled={portalCode.length < 7 || loading || attempts >= 5}
              style={{width: '100%', padding: '14px', marginTop: 16, background: pc, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (portalCode.length < 7 || loading || attempts >= 5) ? 0.4 : 1, transition: 'opacity 200ms'}}>
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>

          <p style={{color: '#ccc', fontSize: 11, marginTop: 32}}>Powered by Rumo</p>
        </div>
      </div>
    );
  }

  // ── Portal Dashboard ──────────────────────────────────────────────────
  const { reservation: res, room } = portalData;
  const status = getStayStatus(room);
  const booker = res.booker || {};
  const guestName = room.guests?.[0]?.firstName || booker.firstName || 'Guest';

  return (
    <div style={{minHeight: '100vh', background: '#fafafa', fontFamily: 'system-ui, -apple-system, sans-serif'}}>
      {/* Header */}
      <div style={{background: pc, padding: '20px 24px', textAlign: 'center', position: 'relative'}}>
        {logo && <img src={logo} alt="" style={{maxHeight: 40, maxWidth: 140, margin: '0 auto 8px', display: 'block'}} />}
        <div style={{color: '#fff', fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 'bold'}}>{hs.hotelName || 'Hotel'}</div>
        <button onClick={() => { setPortalData(null); setPortalCode(''); setError(''); setAttempts(0); }}
          style={{position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
            padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer'}}
          title="Use a different code">
          ✕
        </button>
      </div>

      <div style={{maxWidth: 480, margin: '0 auto', padding: '24px 16px'}}>
        {/* Greeting */}
        <h2 style={{fontFamily: 'Georgia, serif', fontSize: 22, color: '#111', margin: '0 0 4px'}}>Welcome, {guestName}</h2>
        <div style={{display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: status.color, background: status.bg, marginBottom: 20}}>
          {status.label}
        </div>

        {/* Reservation Card */}
        <div style={{background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: 24, marginBottom: 16}}>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
            <div>
              <div style={{fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4}}>Check-in</div>
              <div style={{fontSize: 15, fontWeight: 600, color: '#111'}}>{room.checkin ? new Date(room.checkin).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'}) : '—'}</div>
            </div>
            <div>
              <div style={{fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4}}>Check-out</div>
              <div style={{fontSize: 15, fontWeight: 600, color: '#111'}}>{room.checkout ? new Date(room.checkout).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'}) : '—'}</div>
            </div>
            <div>
              <div style={{fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4}}>Room</div>
              <div style={{fontSize: 15, fontWeight: 600, color: '#111'}}>{room.roomType || getRoomTypeName(room.roomNumber) || room.roomNumber}</div>
              <div style={{fontSize: 12, color: '#999'}}>Room {room.roomNumber}</div>
            </div>
            <div>
              <div style={{fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4}}>Nights</div>
              <div style={{fontSize: 15, fontWeight: 600, color: '#111'}}>{numNights(room)}</div>
            </div>
          </div>

          {/* Guests */}
          {room.guests && room.guests.length > 0 && (
            <div style={{marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0'}}>
              <div style={{fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8}}>Guests</div>
              {room.guests.filter(g => g.firstName || g.lastName).map((g, i) => (
                <div key={i} style={{fontSize: 14, color: '#333', marginBottom: 2}}>{g.firstName} {g.lastName}</div>
              ))}
            </div>
          )}

          {/* Extras */}
          {res.extras && res.extras.length > 0 && (
            <div style={{marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0'}}>
              <div style={{fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8}}>Extras</div>
              {res.extras.map((ex, i) => (
                <div key={i} style={{display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 4}}>
                  <span>{ex.name} x{ex.quantity}</span>
                  <span>{hs.currency || 'EUR'} {(ex.quantity * ex.unitPrice).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coming Soon Cards */}
        {[
          { title: 'Online Check-in', desc: 'Complete your check-in before arrival', icon: '📋' },
          { title: 'Payment', desc: 'View and pay your bill online', icon: '💳' },
          { title: 'Digital Key', desc: 'Unlock your room with your phone', icon: '🔑' },
          { title: 'Local Tips', desc: 'Discover restaurants, shops and attractions nearby', icon: '📍' },
        ].map((item, i) => (
          <div key={i} style={{background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16, opacity: 0.5, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'}}>
            <span style={{fontSize: 24}}>{item.icon}</span>
            <div style={{flex: 1}}>
              <div style={{fontSize: 14, fontWeight: 600, color: '#333'}}>{item.title}</div>
              <div style={{fontSize: 12, color: '#999'}}>{item.desc}</div>
            </div>
            <span style={{fontSize: 10, fontWeight: 600, color: '#999', background: '#f5f5f5', padding: '3px 8px', borderRadius: 8}}>Coming soon</span>
          </div>
        ))}

        {/* Footer */}
        <div style={{textAlign: 'center', padding: '32px 0 16px', fontSize: 12, color: '#ccc'}}>
          <div style={{marginBottom: 4}}>{hs.hotelName} · {hs.hotelPhone}</div>
          <div>{hs.hotelEmail}</div>
          <div style={{marginTop: 12, fontSize: 10, color: '#ddd'}}>Powered by Rumo</div>
        </div>
      </div>
    </div>
  );
};
