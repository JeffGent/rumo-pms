// ── Dashboard View (includes StatusIndicator + RoomCard) ─────────────────────
const DashboardView = (props) => {
  const { selectedDate, setSelectedDate, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, activeFilter, setActiveFilter, checkedInRooms, totalRooms, setSelectedReservation, setPreviousPage, setNewReservationOpen, quickView, mounted, housekeepingStatus, toggleCheckInOut } = props;

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

    const paymentLabel = reservation.guest && reservation.paidPercentage !== undefined
      ? (reservation.paidPercentage >= 1 ? 'Paid' : reservation.paidPercentage === 0 ? 'Unpaid' : 'Partial')
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
                  <div className="text-[0.9rem] font-medium text-neutral-900 leading-tight">{reservation.guest}</div>
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
                      if (canCheckIn) return (
                        <button onClick={(e) => { e.stopPropagation(); toggleCheckInOut(reservation.id, false); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all" title="Check in">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>IN
                        </button>
                      );
                      if (canCheckOut) return (
                        <button onClick={(e) => { e.stopPropagation(); toggleCheckInOut(reservation.id, true); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-all" title="Check out">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>OUT
                        </button>
                      );
                      if (isCheckedIn) return (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"/></svg>IN
                        </span>
                      );
                      if (isCheckedOut) return (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-400 border border-neutral-200">
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
  const getReservationsForDate = (date) => {
    const selectedDateMidnight = new Date(date);
    selectedDateMidnight.setHours(0, 0, 0, 0);

    const allRooms = getAllRooms();
    const flatEntries = buildFlatRoomEntries(reservations);

    return allRooms.map(room => {
      const reservation = flatEntries.find(r => {
        if (r.room !== room) return false;
        const checkinMidnight = new Date(r.checkin);
        checkinMidnight.setHours(0, 0, 0, 0);
        const checkoutMidnight = new Date(r.checkout);
        checkoutMidnight.setHours(0, 0, 0, 0);
        return checkinMidnight <= selectedDateMidnight && checkoutMidnight >= selectedDateMidnight;
      });

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
          const checkedIn = manualToggle !== undefined ? !!manualToggle : reservation.isCheckedIn;
          visualStatus = checkedIn ? 'checked-in' : 'reserved';
        } else if (status === 'in-house') visualStatus = 'checked-in';
        else if (status === 'departing') {
          const checkedOut = manualToggle !== undefined ? manualToggle : reservation.isCheckedOut;
          visualStatus = checkedOut ? 'checked-out' : 'checked-in';
        } else visualStatus = 'available';

        const resolvedCheckedInTime = (typeof manualToggle === 'string') ? manualToggle : reservation.checkedInTime;
        return { ...reservation, status, visualStatus, resolvedCheckedInTime };
      } else {
        return { id: `empty-${room}`, room, type: getRoomTypeName(room), guest: null, status: 'available', housekeeping: 'clean' };
      }
    });
  };

  const roomsForDate = getReservationsForDate(selectedDate);

  const occupiedRooms = roomsForDate.filter(r => r.status !== 'available');
  const revenueRooms = occupiedRooms.filter(r => r.visualStatus !== 'blocked');
  const occupancy = (occupiedRooms.length / totalRooms) * 100;
  const revenue = revenueRooms.reduce((sum, r) => sum + (r.price || 0), 0);
  const avgRate = revenueRooms.length > 0 ? Math.round(revenue / revenueRooms.length) : 0;
  const revPar = Math.round(revenue / totalRooms);
  const checkIns = roomsForDate.filter(r => r.status === 'arriving' && r.visualStatus !== 'blocked' && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'no-show').length;
  const checkOuts = roomsForDate.filter(r => r.status === 'departing' && r.visualStatus !== 'blocked' && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'no-show').length;

  const filteredRooms = roomsForDate.filter(room => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'available') return room.status === 'available';
    if (activeFilter === 'in-house') return room.status === 'in-house';
    if (activeFilter === 'arriving') return room.status === 'arriving' && room.visualStatus !== 'blocked' && room.reservationStatus !== 'cancelled' && room.reservationStatus !== 'no-show';
    if (activeFilter === 'departing') return room.status === 'departing' && room.visualStatus !== 'blocked' && room.reservationStatus !== 'cancelled' && room.reservationStatus !== 'no-show';
    if (activeFilter === 'blocked') return room.visualStatus === 'blocked';
    return true;
  });

  const blockedCount = roomsForDate.filter(r => r.visualStatus === 'blocked').length;
  const filterCounts = {
    all: roomsForDate.length,
    available: roomsForDate.filter(r => r.status === 'available').length,
    'in-house': roomsForDate.filter(r => r.status === 'in-house').length,
    arriving: roomsForDate.filter(r => r.status === 'arriving' && r.visualStatus !== 'blocked' && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'no-show').length,
    departing: roomsForDate.filter(r => r.status === 'departing' && r.visualStatus !== 'blocked' && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'no-show').length,
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
        <a className="cal-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>
        <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>
        <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>
        <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>
        <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>
      </nav>
      <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo ©<br/>All Rights Reserved</>)}</div>
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
        <h2 className="font-light text-neutral-900 font-serif text-xl">Room Status</h2>
        <div data-tour="room-filters" className="flex flex-wrap gap-2 md:gap-4">
          {[
            { id: 'all', label: 'All Rooms' },
            { id: 'available', label: 'Available' },
            { id: 'in-house', label: 'In-house' },
            { id: 'arriving', label: 'Arriving' },
            { id: 'departing', label: 'Leaving' },
            ...(blockedCount > 0 ? [{ id: 'blocked', label: 'Blocked' }] : []),
          ].map((filter) => (
            <button key={filter.id} onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-xl transition-all duration-200 ${
                activeFilter === filter.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}>
              {filter.label} <span className={`ml-1 ${activeFilter === filter.id ? 'text-white/70' : 'text-neutral-400'}`}>({filterCounts[filter.id]})</span>
            </button>
          ))}
        </div>
      </div>

      <div data-tour="room-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {filteredRooms.map(reservation => (
          <RoomCard key={reservation.id} reservation={reservation} />
        ))}
      </div>
    </div>
  </div>
</div>
  );
};
