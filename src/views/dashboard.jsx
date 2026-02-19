import React from 'react';
import globals from '../globals.js';
import { formatDate, addDays, buildFlatRoomEntries, getGuestName } from '../utils.js';
import { getAllRooms, getRoomTypeName, canAccessPage } from '../config.js';
import { ReservationService } from '../services.js';
import Icons from '../icons.jsx';

const DashboardView = (props) => {
  const { selectedDate, setSelectedDate, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, activeFilter, setActiveFilter, checkedInRooms, totalRooms, setSelectedReservation, setPreviousPage, setNewReservationOpen, setReservationTab, quickView, mounted, housekeepingStatus, toggleCheckInOut: rawToggleCheckInOut, cloudStatus } = props;

  // Track rooms toggled this dashboard session — they keep their original filter position.
  // Resets on unmount (navigate away), so next visit reclassifies them.
  const recentTogglesRef = React.useRef(new Set());
  const toggleCheckInOut = (resId, isDeparting) => {
    recentTogglesRef.current.add(resId);
    rawToggleCheckInOut(resId, isDeparting);
  };

  const StatusIndicator = ({ housekeeping }) => {
    if (housekeeping === 'clean') return null;
    return <div className="w-2 h-2 rounded-full bg-amber-500 shadow-amber-500/50 shadow-lg" />;
  };

  const RoomCard = ({ reservation }) => {
    const isActive = quickView === reservation.room;

    const handleClick = () => {
      if (reservation.visualStatus === 'blocked') {
        setPreviousPage(activePage);
        setSelectedReservation(reservation);
      } else if (reservation.guest) {
        setPreviousPage(activePage);
        setSelectedReservation(reservation);
      } else if (reservation.status === 'available') {
        setNewReservationOpen(reservation.room);
      }
    };

    const accentColor = reservation.visualStatus === 'checked-in' ? '#10b981' :
                        reservation.visualStatus === 'reserved' ? '#3b82f6' :
                        reservation.visualStatus === 'option' ? '#ec4899' :
                        reservation.visualStatus === 'checked-out' ? '#d1d5db' :
                        reservation.visualStatus === 'blocked' ? '#64748b' :
                        reservation.status === 'available' ? '#e5e7eb' :
                        '#e5e7eb';

    // Live payment percentage from actual payments & room prices (not stale paidPercentage field)
    const livePP = (() => {
      if (!reservation.guest) return undefined;
      const totalPaid = (reservation.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
      const roomTotal = (reservation.rooms || []).reduce((sum, rm) => {
        if (rm.priceType === 'fixed') return sum + (rm.fixedPrice || 0);
        return sum + (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0);
      }, 0);
      const extrasTotal = (reservation.extras || []).reduce((sum, ex) => sum + (ex.quantity || 0) * (ex.unitPrice || 0), 0);
      const totalPrice = roomTotal + extrasTotal;
      return totalPrice > 0 ? totalPaid / totalPrice : (totalPaid > 0 ? 1 : 0);
    })();
    const paymentLabel = livePP !== undefined
      ? (livePP >= 1 ? 'Paid' : livePP === 0 ? 'Unpaid' : 'Partial')
      : null;
    const paymentColor = paymentLabel === 'Paid' ? '#059669' : paymentLabel === 'Unpaid' ? '#dc2626' : paymentLabel === 'Partial' ? '#d97706' : null;

    return (
      <div onClick={handleClick}
        className={`relative group cursor-pointer transition-all duration-300 ${isActive ? 'scale-[1.02] z-10' : ''}`}
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transitionDelay: `${parseInt(reservation.room) * 30}ms` }}>
        <div className={`relative overflow-hidden rounded-xl p-4 md:p-5 border ${isActive ? 'shadow-lg ring-1 ring-neutral-300' : 'shadow-sm hover:shadow-md'} transition-all duration-300`}
          style={{ background: '#ffffff', borderColor: isActive ? '#d1d5db' : '#f0f0f0', borderTop: `3px solid ${accentColor}` }}>
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-baseline gap-2">
                <div className="text-xl md:text-2xl font-light tracking-tight font-serif text-neutral-900">{reservation.room}</div>
                <div className="text-[0.82rem] font-medium tracking-widest uppercase text-neutral-400">
                  {reservation.visualStatus === 'blocked' ? 'Blocked' : reservation.isOption ? 'Option' : reservation.type}
                </div>
              </div>
              <StatusIndicator housekeeping={housekeepingStatus[reservation.id] || reservation.housekeeping} />
            </div>

            {reservation.visualStatus === 'blocked' ? (
              <div className={!isActive ? 'min-h-[2rem]' : ''}>
                <div className="min-w-0">
                  <div className="text-[0.9rem] font-medium text-slate-500 leading-tight flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Blocked
                  </div>
                  {reservation.blockReason && <div className="text-[0.82rem] text-slate-400 mt-0.5 truncate">{reservation.blockReason}</div>}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[0.82rem] text-slate-400">{formatDate(reservation.checkin)} – {formatDate(reservation.checkout)}</span>
                  </div>
                </div>
              </div>
            ) : reservation.guest ? (
              <div className={!isActive ? 'min-h-[2rem]' : ''}>
                <div className="min-w-0">
                  <div className="text-[0.9rem] font-medium text-neutral-900 leading-tight">{getGuestName(reservation)}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[0.82rem] text-neutral-500">
                      {reservation.visualStatus === 'checked-out' ? `Checked out` :
                       reservation.status === 'departing' ? `Checking out today` :
                       reservation.visualStatus === 'reserved' ? `Check-in today` :
                       reservation.status === 'arriving' && reservation.resolvedCheckedInTime ? `Checked in at ${reservation.resolvedCheckedInTime}` :
                       reservation.status === 'arriving' ? `Checked in today` :
                       reservation.isOption ? `Option until ${formatDate(reservation.checkout)}` :
                       (() => { const co = new Date(reservation.checkout); const t = new Date(); co.setHours(0,0,0,0); t.setHours(0,0,0,0); return co.getTime() === t.getTime() ? 'Checking out today' : `Until ${formatDate(reservation.checkout)}`; })()}
                      {paymentLabel && paymentLabel !== 'Paid' && (
                        <span className="font-medium" style={{ color: paymentColor }}> · {paymentLabel}</span>
                      )}
                    </span>
                    {(() => {
                      const vs = reservation.visualStatus;
                      const isDeparting = reservation.status === 'departing';
                      const canCheckIn = vs === 'reserved';
                      const canCheckOut = isDeparting && vs === 'checked-in';
                      const isCheckedIn = vs === 'checked-in' && !isDeparting;
                      const isCheckedOut = vs === 'checked-out';
                      if (!canCheckIn && !canCheckOut && !isCheckedIn && !isCheckedOut) return null;
                      // Payment status coloring (use live calculation)
                      const pp = livePP !== undefined ? livePP : 0;
                      const paidStyle = 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200 hover:border-neutral-300';
                      const paidStyleStatic = 'bg-neutral-100 text-neutral-500 border-neutral-200';
                      const payBg = pp >= 1 ? paidStyle : pp > 0 ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:border-amber-300' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300';
                      const payBgStatic = pp >= 1 ? paidStyleStatic : pp > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-red-50 text-red-600 border-red-200';
                      if (canCheckIn) return (
                        <button onClick={(e) => { e.stopPropagation(); toggleCheckInOut(reservation.id, false); }}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium transition-all border ${payBg}`} title="Check in">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>IN
                        </button>
                      );
                      if (canCheckOut) return (
                        <button onClick={(e) => {
                          e.stopPropagation();
                          const billingWarning = ReservationService.validateCheckout(reservation);
                          toggleCheckInOut(reservation.id, true);
                          if (billingWarning) {
                            setPreviousPage(activePage);
                            setSelectedReservation({ ...reservation, reservationStatus: 'checked-out', isCheckedOut: true });
                            setReservationTab('billing');
                          }
                        }}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium transition-all border ${payBg}`} title="Check out">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>OUT
                        </button>
                      );
                      if (isCheckedIn) return (
                        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${payBgStatic}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"/></svg>IN
                        </span>
                      );
                      if (isCheckedOut) return (
                        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${payBgStatic}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"/></svg>OUT
                        </span>
                      );
                      return null;
                    })()}
                  </div>
                </div>
                {isActive && (
                  <div className="pt-3 mt-3 flex justify-between items-center" style={{ borderTop: '1px solid #f3f4f6' }}>
                    <span className="text-[0.82rem] text-neutral-400">{Math.ceil((reservation.checkout - reservation.checkin) / (1000 * 60 * 60 * 24))} nights</span>
                    <span className="text-base font-medium text-neutral-800">€{reservation.price}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[2rem]">
                <span className="text-[0.82rem] text-neutral-300 font-normal">
                  {reservation.status === 'maintenance' ? 'Under maintenance' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Filter en bepaal status op basis van selectedDate
  const getReservationsForDate = (date, preferDepartures = false) => {
    const selectedDateMidnight = new Date(date);
    selectedDateMidnight.setHours(0, 0, 0, 0);

    const allRooms = getAllRooms();
    const flatEntries = buildFlatRoomEntries(globals.reservations);

    return allRooms.map(room => {
      // Find all matching reservations for this room on selectedDate
      const matches = flatEntries.filter(r => {
        if (r.room !== room) return false;
        const ci = new Date(r.checkin); ci.setHours(0, 0, 0, 0);
        const co = new Date(r.checkout); co.setHours(0, 0, 0, 0);
        return ci <= selectedDateMidnight && co >= selectedDateMidnight;
      });
      // Same-day turnover: prefer departure when Leaving filter is active, otherwise prefer arrival
      const reservation = matches.length > 1
        ? (preferDepartures
            ? matches.find(r => { const co = new Date(r.checkout); co.setHours(0, 0, 0, 0); return co.getTime() === selectedDateMidnight.getTime(); }) || matches[0]
            : matches.find(r => { const ci = new Date(r.checkin); ci.setHours(0, 0, 0, 0); return ci.getTime() === selectedDateMidnight.getTime(); }) || matches[0]
          )
        : matches[0] || null;

      if (reservation) {
        const checkinMidnight = new Date(reservation.checkin);
        checkinMidnight.setHours(0, 0, 0, 0);
        const checkoutMidnight = new Date(reservation.checkout);
        checkoutMidnight.setHours(0, 0, 0, 0);

        let status;
        if (checkinMidnight.getTime() === selectedDateMidnight.getTime()) status = 'arriving';
        else if (checkoutMidnight.getTime() === selectedDateMidnight.getTime()) status = 'departing';
        else status = 'in-house';

        let visualStatus;
        const manualToggle = checkedInRooms[reservation.id];
        if (reservation.reservationStatus === 'blocked') visualStatus = 'blocked';
        else if (reservation.isOption) visualStatus = 'option';
        else if (status === 'arriving') {
          visualStatus = reservation.reservationStatus === 'checked-in' ? 'checked-in' : 'reserved';
        } else if (status === 'in-house') visualStatus = 'checked-in';
        else if (status === 'departing') {
          // Use reservation-level status, not checkedInRooms toggle (which conflates check-in/check-out)
          visualStatus = reservation.reservationStatus === 'checked-out' ? 'checked-out' : 'checked-in';
        } else visualStatus = 'available';

        const resolvedCheckedInTime = (typeof manualToggle === 'string') ? manualToggle : reservation.checkedInTime;

        // Reclassify rooms that were toggled in a previous session (not during this dashboard visit)
        const justToggled = recentTogglesRef.current.has(reservation.id);
        if (!justToggled) {
          if (status === 'arriving' && visualStatus === 'checked-in') status = 'in-house';
          if (status === 'departing' && visualStatus === 'checked-out') {
            // Checked-out room becomes available — show as empty tile (keep housekeeping status)
            return { id: `empty-${room}`, room, type: getRoomTypeName(room), guest: null, status: 'available', housekeeping: reservation.housekeeping || 'dirty' };
          }
        }

        return { ...reservation, status, visualStatus, resolvedCheckedInTime };
      } else {
        return { id: `empty-${room}`, room, type: getRoomTypeName(room), guest: null, status: 'available', housekeeping: 'clean' };
      }
    });
  };

  // Always compute stats from arrival-preferred view (stable regardless of active filter)
  const roomsForDate = getReservationsForDate(selectedDate);

  const occupiedRooms = roomsForDate.filter(r => r.status !== 'available');
  const revenueRooms = occupiedRooms.filter(r => r.visualStatus !== 'blocked');
  const occupancy = (occupiedRooms.length / totalRooms) * 100;
  const revenue = revenueRooms.reduce((sum, r) => sum + (r.price || 0), 0);
  const avgRate = revenueRooms.length > 0 ? Math.round(revenue / revenueRooms.length) : 0;
  const revPar = Math.round(revenue / totalRooms);

  // Accurate arriving/departing counts from flat entries (not limited by one-per-room)
  const dateMidnight = new Date(selectedDate); dateMidnight.setHours(0, 0, 0, 0);
  const allFlat = buildFlatRoomEntries(globals.reservations);
  const checkIns = allFlat.filter(r => {
    if (!r.guest || r.reservationStatus === 'cancelled' || r.reservationStatus === 'no-show' || r.reservationStatus === 'blocked') return false;
    const ci = new Date(r.checkin); ci.setHours(0, 0, 0, 0);
    if (ci.getTime() !== dateMidnight.getTime()) return false;
    const roomStatus = r._roomData?.status || r.reservationStatus;
    return roomStatus !== 'checked-in';
  }).length;
  const checkOuts = allFlat.filter(r => {
    if (!r.guest || r.reservationStatus === 'cancelled' || r.reservationStatus === 'no-show' || r.reservationStatus === 'blocked') return false;
    const co = new Date(r.checkout); co.setHours(0, 0, 0, 0);
    if (co.getTime() !== dateMidnight.getTime()) return false;
    const roomStatus = r._roomData?.status || r.reservationStatus;
    return roomStatus !== 'checked-out';
  }).length;

  // Departure-preferred view: for Leaving filter + billing alerts (same-day turnover shows departure)
  const departingView = getReservationsForDate(selectedDate, true);

  const filteredRooms = (() => {
    if (activeFilter === 'departing') {
      return departingView.filter(room => room.status === 'departing' && room.visualStatus !== 'blocked' && room.reservationStatus !== 'cancelled' && room.reservationStatus !== 'no-show');
    }
    return roomsForDate.filter(room => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'available') return room.status === 'available';
      if (activeFilter === 'in-house') return room.status === 'in-house';
      if (activeFilter === 'arriving') return room.status === 'arriving' && room.visualStatus !== 'blocked' && room.reservationStatus !== 'cancelled' && room.reservationStatus !== 'no-show';
      if (activeFilter === 'blocked') return room.visualStatus === 'blocked';
      return true;
    });
  })();

  const blockedCount = roomsForDate.filter(r => r.visualStatus === 'blocked').length;

  // Billing alerts: departing rooms with billing issues
  const billingAlertRooms = departingView.filter(r => {
    if (r.status !== 'departing' || !r.guest || r.visualStatus === 'blocked') return false;
    return ReservationService.validateCheckout(r) !== null;
  });
  const billingAlertCount = billingAlertRooms.length;
  const [billingAlertOpen, setBillingAlertOpen] = React.useState(false);

  const filterCounts = {
    all: roomsForDate.length,
    available: roomsForDate.filter(r => r.status === 'available').length,
    'in-house': roomsForDate.filter(r => r.status === 'in-house').length,
    arriving: checkIns,
    departing: checkOuts,
    blocked: blockedCount,
  };

  return (
  <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
    <aside data-tour="sidebar" className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <nav className="cal-nav">
        <a className="cal-nav-link active"><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>
        {canAccessPage(globals.currentUser?.role, 'channelmanager') && <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>}
        {canAccessPage(globals.currentUser?.role, 'profiles') && <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>}
        {canAccessPage(globals.currentUser?.role, 'payments') && <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>}
        {canAccessPage(globals.currentUser?.role, 'reports') && <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>}
        {canAccessPage(globals.currentUser?.role, 'settings') && <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>}
      </nav>
      <div className="cal-nav-user">
        <div className="relative">
          <button onClick={() => props.setUserMenuOpen(prev => !prev)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 hover:bg-neutral-100 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ backgroundColor: globals.currentUser?.color || '#6b7280' }}>
              {globals.currentUser?.name?.split(' ').map(n => n[0]).join('') || '?'}
            </div>
            {!sidebarCollapsed && <span className="text-xs text-neutral-600 truncate">{globals.currentUser?.name?.split(' ')[0]}</span>}
          </button>
          {props.userMenuOpen && (
            <>
              <div className="fixed inset-0 z-[49]" onClick={() => props.setUserMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-[50]">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <div className="text-sm font-medium text-neutral-900">{globals.currentUser?.name}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{globals.currentUser?.role}</div>
                </div>
                <button onClick={props.handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy; <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle ${cloudStatus === 'idle' ? 'bg-emerald-400' : cloudStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : cloudStatus === 'error' ? 'bg-red-400' : 'bg-neutral-300'}`} title={cloudStatus === 'idle' ? 'Cloud synced' : cloudStatus === 'syncing' ? 'Syncing...' : cloudStatus === 'error' ? 'Sync error' : 'Offline'} /><br/>All Rights Reserved</>)}</div>
    </aside>
    <div className="p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
        <div className="cal-title"><h2>Operations Overview</h2><p>Real-time hotel status and reservations</p></div>
        <div data-tour="date-nav" className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"><Icons.ChevronLeft className="w-5 h-5 text-neutral-600" /></button>
          <div className="px-3 py-1.5 md:px-6 md:py-2 bg-neutral-100 rounded-xl"><span className="text-sm md:text-lg font-medium text-neutral-900">{selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"><Icons.ChevronRight className="w-5 h-5 text-neutral-600" /></button>
          <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1.5 md:px-4 md:py-2 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors text-xs md:text-sm">Today</button>
        </div>
      </div>

      {/* Revenue Banner */}
      <div data-tour="revenue-banner" className="mb-6 md:mb-8 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl md:rounded-3xl p-5 md:p-8 text-white shadow-2xl shadow-neutral-900/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12">
            <div>
              <div className="text-sm text-white/60 mb-1 md:mb-2 uppercase tracking-wider">Revenue</div>
              <div className="text-3xl md:text-5xl font-light font-serif">€{revenue.toLocaleString()}</div>
            </div>
            <div className="hidden md:block h-16 w-px bg-white/20" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-8">
              <div><div className="text-xs text-white/60 mb-1">Occupancy</div><div className="text-xl md:text-2xl font-light">{Math.round(occupancy)}%</div></div>
              <div><div className="text-xs text-white/60 mb-1">Avg Rate</div><div className="text-xl md:text-2xl font-light">€{avgRate}</div></div>
              <div><div className="text-xs text-white/60 mb-1">RevPAR</div><div className="text-xl md:text-2xl font-light">€{revPar}</div></div>
              <div><div className="text-xs text-white/60 mb-1">Check-ins</div><div className="text-xl md:text-2xl font-light flex items-center gap-2">{checkIns}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-400"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></div></div>
              <div><div className="text-xs text-white/60 mb-1">Check-outs</div><div className="text-xl md:text-2xl font-light flex items-center gap-2">{checkOuts}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></div></div>
            </div>
          </div>
          <button onClick={() => { setActivePage('reports'); setSelectedReservation(null); }} className="hidden md:block px-6 py-3 bg-white text-neutral-900 rounded-xl font-medium hover:bg-neutral-100 transition-colors duration-200 shadow-lg">View Reports</button>
        </div>
      </div>

      {/* Room Grid */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-light text-neutral-900 font-serif text-xl">Room Status</h2>
          {billingAlertCount > 0 && activeFilter === 'departing' && (
            <button onClick={() => { setBillingAlertOpen(!billingAlertOpen); if (!billingAlertOpen) setActiveFilter('departing'); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${billingAlertOpen ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'}`}
              title="Departing rooms with billing issues">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {billingAlertCount}
            </button>
          )}
        </div>
        <div data-tour="room-filters" className="flex flex-wrap gap-2 md:gap-4">
          {[
            { id: 'all', label: 'All Rooms' },
            { id: 'available', label: 'Available' },
            { id: 'in-house', label: 'In-house' },
            { id: 'arriving', label: 'Arriving' },
            { id: 'departing', label: 'Leaving' },
            ...(blockedCount > 0 ? [{ id: 'blocked', label: 'Blocked' }] : []),
          ].map((filter) => (
            <button key={filter.id} onClick={() => { setActiveFilter(filter.id); setBillingAlertOpen(false); }}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-xl transition-all duration-200 ${
                activeFilter === filter.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}>
              {filter.label} <span className={`ml-1 ${activeFilter === filter.id ? 'text-white/70' : 'text-neutral-400'}`}>({filterCounts[filter.id]})</span>
            </button>
          ))}
        </div>
      </div>

      <div data-tour="room-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {(billingAlertOpen ? billingAlertRooms : filteredRooms).map(reservation => (
          <RoomCard key={reservation.id} reservation={reservation} />
        ))}
      </div>
    </div>
  </div>
</div>
  );
};

export default DashboardView;
