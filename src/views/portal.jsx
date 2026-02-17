import React, { useState, useEffect } from 'react';
import globals from '../globals.js';
import { getRoomTypeName } from '../config.js';
import { lookupPortalCode } from '../supabase.js';

const GuestPortal = () => {
  const [portalCode, setPortalCode] = useState('');
  const [portalName, setPortalName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [portalData, setPortalData] = useState(null); // { reservation, room, roomIndex, hotelBranding? }
  const [roomChoices, setRoomChoices] = useState(null); // { reservation, matchingRooms: [{roomIndex, roomNumber}], hotelBranding? }

  // Extract code from URL hash if present: #/go?code=RMO-00379&name=Smith&room=404
  useEffect(() => {
    const hash = window.location.hash;
    const codeMatch = hash.match(/code=([A-Z0-9-]+)/i);
    const nameMatch = hash.match(/name=([^&]+)/i);
    const roomMatch = hash.match(/room=([^&]+)/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : '';
      const targetRoom = roomMatch ? decodeURIComponent(roomMatch[1]) : null;
      setPortalCode(code);
      if (name) setPortalName(name);
      if (code.length >= 5 && name.length >= 2) validateCode(code, name, targetRoom);
    }
  }, []);

  // Use branding from Supabase lookup (multi-tenant) or fall back to local hotelSettings
  const hs = portalData?.hotelBranding || globals.hotelSettings;
  const eb = hs.emailBranding || {};
  const pc = eb.primaryColor || '#171717';

  // Sanitize logo URL — only allow http(s) and data URIs
  const safeLogo = (url) => {
    if (!url) return null;
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/')) return url;
    return null;
  };

  const autoFormatCode = (val) => {
    // Strip everything except letters, digits, dashes — then normalize
    const alphanum = val.toUpperCase().replace(/[^A-Z0-9\-]/g, '').replace(/-/g, '');
    let clean;
    if (alphanum.length > 3) {
      clean = alphanum.slice(0, 3) + '-' + alphanum.slice(3);
    } else if (alphanum.length === 3 && val.includes('-')) {
      // User explicitly typed the dash (e.g. "RMO-") — keep it
      clean = alphanum + '-';
    } else {
      clean = alphanum;
    }
    if (clean.length > 9) clean = clean.slice(0, 9);
    return clean;
  };

  // Find all room indices where name matches a guest's first or last name (case-insensitive)
  const findMatchingRooms = (res, name) => {
    const n = name.trim().toLowerCase();
    if (!n) return [];
    const matches = [];
    (res.rooms || []).forEach((room, ri) => {
      for (const g of (room.guests || [])) {
        if ((g.lastName || '').toLowerCase() === n || (g.firstName || '').toLowerCase() === n) {
          matches.push({ roomIndex: ri, roomNumber: room.roomNumber });
          break; // one match per room is enough
        }
      }
    });
    // Also check booker name — if booker matches but no room-level guest matched, include all rooms
    if (matches.length === 0) {
      const booker = res.booker || {};
      if ((booker.lastName || '').toLowerCase() === n || (booker.firstName || '').toLowerCase() === n) {
        (res.rooms || []).forEach((room, ri) => {
          matches.push({ roomIndex: ri, roomNumber: room.roomNumber });
        });
      }
    }
    return matches;
  };

  // Resolve reservation: check expiry + name → single room, room picker, or error
  const resolveReservation = (res, name, targetRoom, hotelBranding) => {
    const now = new Date();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const lastCheckout = new Date(Math.max(...(res.rooms || []).map(r => r.checkout ? new Date(r.checkout).getTime() : 0)));
    if (lastCheckout.getTime() > 0 && now - lastCheckout > TWO_WEEKS_MS) {
      setError('This booking has expired. The portal is available until 2 weeks after checkout.');
      return;
    }

    const matchingRooms = findMatchingRooms(res, name);
    if (matchingRooms.length === 0) {
      setError('The name does not match this booking.');
      return;
    }

    // If a target room was specified (from email link), use it directly
    if (targetRoom) {
      const match = matchingRooms.find(m => String(m.roomNumber) === String(targetRoom));
      if (match) {
        setPortalData({ reservation: res, room: res.rooms[match.roomIndex], roomIndex: match.roomIndex, hotelBranding });
        return;
      }
      // Target room didn't match name — fall through to normal flow
    }

    // Single match → go directly
    if (matchingRooms.length === 1) {
      const ri = matchingRooms[0].roomIndex;
      setPortalData({ reservation: res, room: res.rooms[ri], roomIndex: ri, hotelBranding });
      return;
    }

    // Multiple matches → show room picker
    setRoomChoices({ reservation: res, matchingRooms, hotelBranding });
  };

  const validateCode = async (code, name, targetRoom) => {
    if (attempts >= 5) {
      setError('Too many attempts. Please try again later.');
      return;
    }
    setLoading(true);
    setError('');
    setRoomChoices(null);
    setAttempts(prev => prev + 1);

    // Check localStorage first — match by bookingRef
    let foundRes = null;
    let supabaseFailed = false;
    let hotelBranding = null;
    for (const res of globals.reservations) {
      if (res.bookingRef === code) {
        if (res.rooms?.length) foundRes = res;
        break;
      }
    }

    if (!foundRes) {
      // Try Supabase lookup by bookingRef
      try {
        const result = await lookupPortalCode(code);
        if (result && result.reservation && (result.reservation.rooms || []).length) {
          foundRes = result.reservation;
          hotelBranding = result.hotelBranding;
        }
      } catch (e) {
        console.warn('[Portal] Supabase lookup failed:', e);
        supabaseFailed = true;
      }
    }

    setLoading(false);
    if (foundRes) {
      resolveReservation(foundRes, name, targetRoom, hotelBranding);
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

  // ── Room Picker (ambiguous name match) ────────────────────────────────
  if (!portalData && roomChoices) {
    const rc = roomChoices;
    return (
      <div style={{minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif'}}>
        <div style={{background: '#fff', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center'}}>
          {logo && <img src={logo} alt="" style={{maxHeight: 56, maxWidth: 180, margin: '0 auto 16px'}} />}
          <h1 style={{fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 'normal', color: '#111', margin: '0 0 4px'}}>Select your room</h1>
          <p style={{color: '#999', fontSize: 14, margin: '0 0 28px'}}>Multiple rooms found for this name</p>

          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            {rc.matchingRooms.map(m => {
              const room = rc.reservation.rooms[m.roomIndex];
              const guest = room.guests?.[0];
              const guestLabel = guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : '';
              const ci = room.checkin ? new Date(room.checkin) : null;
              const co = room.checkout ? new Date(room.checkout) : null;
              const dateLabel = ci && co ? `${ci.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})} – ${co.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}` : '';
              return (
                <button key={m.roomNumber} onClick={() => {
                  setPortalData({ reservation: rc.reservation, room, roomIndex: m.roomIndex, hotelBranding: rc.hotelBranding });
                  setRoomChoices(null);
                }}
                  style={{width: '100%', padding: '16px 20px', background: '#fafafa', border: '2px solid #e5e5e5', borderRadius: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 200ms, background 200ms'}}
                  onMouseOver={e => { e.currentTarget.style.borderColor = pc; e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.background = '#fafafa'; }}>
                  <div>
                    <div style={{fontSize: 16, fontWeight: 600, color: '#111'}}>Room {m.roomNumber}</div>
                    {guestLabel && <div style={{fontSize: 13, color: '#888', marginTop: 2}}>{guestLabel}</div>}
                  </div>
                  {dateLabel && <div style={{fontSize: 12, color: '#aaa'}}>{dateLabel}</div>}
                </button>
              );
            })}
          </div>

          <button onClick={() => { setRoomChoices(null); setError(''); }}
            style={{background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', marginTop: 20, padding: '8px 0'}}>
            ← Back
          </button>

          <p style={{color: '#ccc', fontSize: 11, marginTop: 24}}>Powered by Rumo</p>
        </div>
      </div>
    );
  }

  // ── Code Entry Screen ─────────────────────────────────────────────────
  if (!portalData) {
    return (
      <div style={{minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif'}}>
        <div style={{background: '#fff', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center'}}>
          {logo && <img src={logo} alt="" style={{maxHeight: 56, maxWidth: 180, margin: '0 auto 16px'}} />}
          <h1 style={{fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 'normal', color: '#111', margin: '0 0 4px'}}>{hs.hotelName || 'Welcome'}</h1>
          <p style={{color: '#999', fontSize: 14, margin: '0 0 32px'}}>Enter your booking reference and last name</p>

          <form onSubmit={e => { e.preventDefault(); if (portalCode.length >= 5 && portalName.trim().length >= 2) validateCode(portalCode, portalName); }}>
            <input id="portal-code-input" value={portalCode} onChange={e => setPortalCode(autoFormatCode(e.target.value))}
              placeholder="e.g. RMO-00379"
              autoComplete="off"
              disabled={attempts >= 5}
              style={{width: '100%', padding: '14px 16px', fontSize: 20, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 3, border: '2px solid #e5e5e5', borderRadius: 12, outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms'}}
              onFocus={e => e.target.style.borderColor = pc}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'} />

            <input value={portalName} onChange={e => setPortalName(e.target.value)}
              placeholder="Last name"
              autoComplete="off"
              disabled={attempts >= 5}
              style={{width: '100%', padding: '14px 16px', fontSize: 16, textAlign: 'center', border: '2px solid #e5e5e5', borderRadius: 12, outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms', marginTop: 12}}
              onFocus={e => e.target.style.borderColor = pc}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'} />

            {error && <p style={{color: '#ef4444', fontSize: 13, marginTop: 12}}>{error}</p>}

            <button type="submit" disabled={portalCode.length < 5 || portalName.trim().length < 2 || loading || attempts >= 5}
              style={{width: '100%', padding: '14px', marginTop: 16, background: pc, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (portalCode.length < 5 || portalName.trim().length < 2 || loading || attempts >= 5) ? 0.4 : 1, transition: 'opacity 200ms'}}>
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
      {/* Subtle top bar with close button */}
      <div style={{padding: '12px 24px', textAlign: 'right'}}>
        <button onClick={() => { setPortalData(null); setRoomChoices(null); setPortalCode(''); setPortalName(''); setError(''); setAttempts(0); }}
          style={{background: 'none', border: '1px solid #e5e5e5', color: '#999',
            padding: '4px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer'}}
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
          { title: 'Online Check-in', desc: 'Complete your check-in before arrival', icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg> },
          { title: 'Payment', desc: 'View and pay your bill online', icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> },
          { title: 'Digital Key', desc: 'Unlock your room with your phone', icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.3 9.3"/><path d="m17 6 4-4"/><path d="m21 6-4-4"/></svg> },
          { title: 'Local Tips', desc: 'Discover restaurants, shops and attractions nearby', icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> },
        ].map((item, i) => (
          <div key={i} style={{background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16, opacity: 0.5, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'}}>
            <span style={{color: '#737373', flexShrink: 0}}>{item.icon}</span>
            <div style={{flex: 1}}>
              <div style={{fontSize: 14, fontWeight: 600, color: '#333'}}>{item.title}</div>
              <div style={{fontSize: 12, color: '#999'}}>{item.desc}</div>
            </div>
            <span style={{fontSize: 10, fontWeight: 600, color: '#999', background: '#f5f5f5', padding: '3px 8px', borderRadius: 8}}>Coming soon</span>
          </div>
        ))}

        {/* Contact section */}
        <div style={{textAlign: 'center', padding: '32px 0 0'}}>
          <div style={{borderTop: '1px solid #f0f0f0', margin: '0 0 24px'}}></div>
          <p style={{fontSize: 13, color: '#999', margin: '0 0 16px'}}>Questions? Don't hesitate to reach out.</p>
          <div style={{display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8}}>
            {hs.hotelPhone && (
              <a href={`https://wa.me/${(hs.hotelPhone || '').replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer"
                style={{display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', border: '1px solid #e5e5e5', borderRadius: 10, textDecoration: 'none', color: '#555', fontSize: 13, fontWeight: 500}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                WhatsApp
              </a>
            )}
            {hs.hotelEmail && (
              <a href={`mailto:${hs.hotelEmail}`}
                style={{display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', border: '1px solid #e5e5e5', borderRadius: 10, textDecoration: 'none', color: '#555', fontSize: 13, fontWeight: 500}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                Email
              </a>
            )}
          </div>
        </div>

        {/* Footer: maps + address */}
        <div style={{textAlign: 'center', padding: '24px 0 16px'}}>
          <div style={{borderTop: '1px solid #f0f0f0', margin: '0 0 24px'}}></div>
          {(() => {
            const addr = [hs.hotelStreet, [hs.hotelZip, hs.hotelCity].filter(Boolean).join(' '), hs.hotelCountry].filter(Boolean).join(', ');
            const mapsUrl = addr ? `https://maps.google.com/?q=${encodeURIComponent((hs.hotelName || '') + ', ' + addr)}` : '';
            return (
              <>
                {mapsUrl && (
                  <div style={{marginBottom: 16, display: 'flex', justifyContent: 'center'}}>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', border: '1px solid #e5e5e5', borderRadius: 10, textDecoration: 'none', color: '#555', fontSize: 13, fontWeight: 500}}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      View on Google Maps
                    </a>
                  </div>
                )}
                <div style={{fontFamily: 'Georgia, serif', fontSize: 14, color: '#999', marginBottom: 4}}>{hs.hotelName}</div>
                {addr && <div style={{fontSize: 12, color: '#bbb', lineHeight: 1.5}}>{addr}</div>}
              </>
            );
          })()}
          <div style={{marginTop: 16, fontSize: 10, color: '#ddd'}}>Powered by Rumo</div>
        </div>
      </div>
    </div>
  );
};

export default GuestPortal;
