// -- Reservation Detail View --------------------------------------------------
const ReservationDetailView = (props) => {
  const {
    selectedReservation, setSelectedReservation, editingReservation, setEditingReservation,
    reservationTab, setReservationTab, sidebarCollapsed, setSidebarCollapsed,
    activePage, setActivePage, previousPage, setPreviousPage, setShowActionMenu,
    roomGridMode, setRoomGridMode, activeGuestTab, setActiveGuestTab,
    expandedRooms, setExpandedRooms, guestSearchActive, setGuestSearchActive,
    changeRoomTarget, setChangeRoomTarget, setPendingDateChange,
    addRoomDates, setAddRoomDates, billSelected, setBillSelected,
    billSplitMode, setBillSplitMode, billPaySelected, setBillPaySelected,
    billRecipientOverride, setBillRecipientOverride, billCustomLabels, setBillCustomLabels,
    amendingInvoice, setAmendingInvoice, amendRecipient, setAmendRecipient,
    setToastMessage, focusValRef, addRoomRef, dragPaymentRef,
    housekeepingStatus,
    showCheckoutWarning, setProfileSelectedProfile, setProfileEditingProfile,
    setProfileSourceReservation, setProfileSourceTab,
  } = props;
  const reservation = selectedReservation;
  const ed = editingReservation;
  if (!reservation || !ed) return null;
  const [pricingOpen, setPricingOpen] = React.useState({});
  const [inventoryPopup, setInventoryPopup] = React.useState(null); // { catName, nights: [{ date, label, used, limit, full }], qty, cat, ci, co }
  const [inventorySelected, setInventorySelected] = React.useState(new Set()); // selected night indices
  const inventoryPendingRef = React.useRef(false); // guard against select double-fire

  const pageLabels = { dashboard: 'Dashboard', calendar: 'Calendar', housekeeping: 'Housekeeping', fb: 'F&B', reports: 'Reports' };
  const edCheckin = ed.checkin ? new Date(ed.checkin) : reservation.checkin;
  const edCheckout = ed.checkout ? new Date(ed.checkout) : reservation.checkout;
  const nightCount = Math.ceil((edCheckout - edCheckin) / (1000 * 60 * 60 * 24));
  const roomNightCounts = (ed.rooms || []).map(r => {
    const ci = r.checkin ? new Date(r.checkin) : edCheckin;
    const co = r.checkout ? new Date(r.checkout) : edCheckout;
    return Math.ceil((co - ci) / (1000 * 60 * 60 * 24));
  });
  const minNights = Math.min(...roomNightCounts);
  const maxNights = Math.max(...roomNightCounts);
  const nightsLabel = minNights === maxNights ? `${nightCount} night${nightCount > 1 ? 's' : ''}` : `${minNights}—${maxNights} nights`;
  const roomRatePlanIds = (ed.rooms || []).map(r => r.ratePlanId).filter(Boolean);
  const allSameRatePlan = roomRatePlanIds.length > 0 && roomRatePlanIds.every(id => id === roomRatePlanIds[0]);
  const commonRatePlanName = allSameRatePlan ? (ratePlans.find(rp => rp.id === roomRatePlanIds[0])?.name || '') : '';

  const goBack = () => {
    setSelectedReservation(null);
    setReservationTab('overview');
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'room', label: 'Rooms & Guests' },
    { id: 'billing', label: 'Billing' },
  ];

  // Helper to update editingReservation fields (optional logMsg adds activity log entry)
  const updateEd = (path, value, logMsg) => {
    const next = JSON.parse(JSON.stringify(ed));
    const keys = path.split('.');
    let obj = next;
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i].match(/^\d+$/)) obj = obj[parseInt(keys[i])];
      else obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    if (logMsg) {
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: logMsg, user: 'Sophie' });
    }
    setEditingReservation(next);
  };

  // Track focus value for blur-based logging
  const onFocusTrack = (e) => { focusValRef.current = e.target.value; };
  const onBlurLog = (label) => (e) => {
    const oldVal = focusValRef.current;
    const newVal = e.target.value;
    if (oldVal !== newVal && (oldVal || newVal)) {
      addToActivityLog(`${label}: "${oldVal || '—'}" → "${newVal || '—'}"`);
    }
  };

  // Compute billing totals from editingReservation
  const roomTotal = ed.rooms.reduce((sum, rm) => {
    if (rm.priceType === 'fixed') return sum + (rm.fixedPrice || 0);
    return sum + rm.nightPrices.reduce((s, n) => s + (n.amount || 0), 0);
  }, 0);
  const extrasTotal = (ed.extras || []).reduce((sum, ex) => {
    return sum + (ex.quantity || 0) * (ex.unitPrice || 0);
  }, 0);
  const totalAmount = roomTotal + extrasTotal;
  const paidAmount = ed.payments.reduce((s, p) => s + p.amount, 0);
  const outstandingAmount = Math.max(0, totalAmount - paidAmount);

  // Action handlers
  const updateStatus = (newStatus, actionLabel) => {
    const next = JSON.parse(JSON.stringify(ed));
    next.reservationStatus = newStatus;
    // Push reservation status down to all rooms
    (next.rooms || []).forEach(r => { r.status = newStatus; });
    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: actionLabel, user: 'Sophie' });
    setEditingReservation(next);
    setShowActionMenu(false);
    if (newStatus === 'checked-out') showCheckoutWarning(next);
  };

  // Update a single room's status and derive reservation status
  const updateRoomStatus = (roomIndex, newStatus) => {
    const next = JSON.parse(JSON.stringify(ed));
    const oldStatus = next.rooms[roomIndex].status || 'confirmed';
    next.rooms[roomIndex].status = newStatus;
    const roomStatuses = next.rooms.map(r => r.status || 'confirmed');
    if (roomStatuses.length === 1) {
      next.reservationStatus = roomStatuses[0];
    } else {
      const allSame = roomStatuses.every(s => s === roomStatuses[0]);
      if (allSame) next.reservationStatus = roomStatuses[0];
    }
    if (oldStatus !== newStatus) {
      const label = { confirmed: 'Confirmed', option: 'Option', 'checked-in': 'Checked-in', 'checked-out': 'Checked-out', 'no-show': 'No-show', cancelled: 'Cancelled', blocked: 'Blocked' };
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${next.rooms[roomIndex].roomNumber}: ${label[oldStatus] || oldStatus} → ${label[newStatus] || newStatus}`, user: 'Sophie' });
    }
    setEditingReservation(next);
    if (newStatus === 'checked-out') showCheckoutWarning(next);
  };

  const addToActivityLog = (action) => {
    const next = JSON.parse(JSON.stringify(ed));
    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action, user: 'Sophie' });
    setEditingReservation(next);
  };

  // All reservation statuses
  const allStatuses = [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'option', label: 'Option' },
    { value: 'checked-in', label: 'Checked-in' },
    { value: 'checked-out', label: 'Checked-out' },
    { value: 'no-show', label: 'No-show' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'blocked', label: 'Blocked' },
  ];

  // Primary action button config

  
  return (
    <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
      <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <nav className="cal-nav">
          <a className="cal-nav-link"><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>
          <a className="cal-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>
          <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>
          <a className="cal-nav-link"><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>
          <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>
          <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>
        </nav>
        <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy;<br/>All Rights Reserved</>)}</div>
      </aside>
      <div className="p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Back button */}
          <button onClick={goBack}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 md:mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
            Back to {pageLabels[previousPage] || 'Dashboard'}
          </button>

          {/* Header */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left: Status + Refs */}
              <div className="flex flex-col gap-2 md:w-1/4">
                <div className="flex items-center gap-3">
                  <select value={ed.reservationStatus} onChange={(e) => {
                    const labels = { confirmed: 'Status → Confirmed', option: 'Status → Option', 'checked-in': 'Status → Checked-in', 'checked-out': 'Status → Checked-out', 'no-show': 'Status → No-show', cancelled: 'Status → Cancelled', blocked: 'Status → Blocked' };
                    updateStatus(e.target.value, labels[e.target.value] || 'Status changed');
                  }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-0 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                      ({ confirmed: 'bg-blue-100 text-blue-800', option: 'bg-pink-100 text-pink-800', 'checked-in': 'bg-emerald-100 text-emerald-800', 'checked-out': 'bg-neutral-200 text-neutral-600', 'no-show': 'bg-red-100 text-red-800', cancelled: 'bg-red-100 text-red-800', blocked: 'bg-slate-200 text-slate-800' })[ed.reservationStatus] || 'bg-blue-100 text-blue-800'
                    }`}>
                    {allStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-neutral-500">{reservation.bookingRef}</span>
                    {reservation.otaRef && <span className="text-xs text-neutral-400">{reservation.otaRef}</span>}
                  </div>
                </div>
                {ed.reservationStatus === 'option' && (
                  <div className="flex items-center gap-2">
                    <input type="datetime-local" value={ed.optionExpiry || ''} onChange={(e) => updateEd('optionExpiry', e.target.value)}
                      className="px-2 py-1 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all" />
                    {ed.optionExpiry && (
                      <button onClick={() => updateEd('optionExpiry', null)} className="text-pink-300 hover:text-pink-500 transition-colors" title="Clear expiry">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Center: Guest name + room info */}
              <div className="text-center md:flex-1">
                {ed.reservationStatus === 'blocked' ? (
                  <>
                    <h2 className="text-xl md:text-2xl font-light text-slate-500 font-serif">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 inline-block mr-2 -mt-1 text-slate-400"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
                      {ed.blockReason || 'Blocked'}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      Room {ed.rooms[0]?.roomNumber || reservation.room}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {nightsLabel} &middot; {formatDate(reservation.checkin)} &rarr; {formatDate(reservation.checkout)}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl md:text-2xl font-light text-neutral-900 font-serif">{ed.booker.firstName || ed.booker.name || ''} {ed.booker.lastName || ''}</h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      {ed.rooms.length === 1
                        ? <>{`Room ${ed.rooms[0]?.roomNumber}`} &middot; {ed.rooms[0]?.roomType}</>
                        : <>{ed.rooms.length} rooms &middot; {ed.rooms.map(r => r.roomNumber).join(', ')}</>
                      }
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {commonRatePlanName && <>{commonRatePlanName} &middot; </>}{nightsLabel} &middot; {formatDate(reservation.checkin)} &rarr; {formatDate(reservation.checkout)}
                    </p>
                  </>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 md:w-1/4 justify-end">
                {ed.reservationStatus !== 'blocked' && (<>
                  <button onClick={() => {
                      const bp = bookerProfiles.find(p =>
                        (p.email && p.email === ed.booker?.email) ||
                        (p.firstName === ed.booker?.firstName && p.lastName === ed.booker?.lastName)
                      );
                      if (bp) {
                        setProfileSelectedProfile(bp);
                        setProfileEditingProfile({ ...bp });
                        setProfileSourceReservation(reservation);
                        setProfileSourceTab(reservationTab);
                        setPreviousPage(activePage);
                        setSelectedReservation(null);
                        setActivePage('profiles');
                      } else {
                        setToastMessage('No booker profile found');
                      }
                    }}
                    title="Booker profile"
                    className="p-2 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors flex items-center text-neutral-500">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </button>
                  <button onClick={() => setToastMessage('Switch booker — coming soon')}
                    title="Switch booker"
                    className="p-2 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors flex items-center text-neutral-500">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                  </button>
                </>)}
              </div>
            </div>
          </div>

          {/* Blocked View — replaces tabs when status is blocked */}
          {ed.reservationStatus === 'blocked' ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-slate-500"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">Room Blocked</div>
                  <div className="text-xs text-slate-400">This room is unavailable for bookings</div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Reason</label>
                  <input value={ed.blockReason || ''} onChange={(e) => updateEd('blockReason', e.target.value)}
                    placeholder="e.g. Water damage, Renovation, Maintenance..."
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={ed.notes || ''} onChange={(e) => updateEd('notes', e.target.value)} rows="3"
                    placeholder="Additional details..."
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none" />
                </div>
              </div>
            </div>
          ) : (<>

          {/* Tabs */}
          <div className="flex items-center justify-between mb-4 border-b border-neutral-200">
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => { setReservationTab(tab.id); setAmendingInvoice(null); setAmendRecipient(null); }}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${
                    reservationTab === tab.id
                      ? 'text-neutral-900'
                      : 'text-neutral-400 hover:text-neutral-600'
                  }`}>
                  {tab.label}
                  {reservationTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />}
                </button>
              ))}
            </div>
            {reservationTab === 'room' && (
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-neutral-400">{ed.rooms.length} room{ed.rooms.length !== 1 ? 's' : ''}</span>
                <div className="flex gap-1 bg-neutral-100 rounded-lg p-0.5">
                  <button onClick={() => setRoomGridMode(false)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${!roomGridMode ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    Detail
                  </button>
                  <button onClick={() => setRoomGridMode(true)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${roomGridMode ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    Quick Edit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ===== TAB 1: OVERVIEW (+ Communication) ===== */}
          {reservationTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                {/* Context row — stay info */}
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between relative">
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <input type="date" onKeyDown={noTypeDateKey}
                      value={(() => { const ci = ed.checkin || (ed.rooms && ed.rooms.length > 0 ? ed.rooms.reduce((min, r) => { const d = new Date(r.checkin); return d < min ? d : min; }, new Date(ed.rooms[0].checkin)) : null); return ci ? (ci instanceof Date ? ci : new Date(ci)).toISOString().slice(0, 10) : ''; })()}
                      onChange={(e) => {
                        const newCheckin = new Date(e.target.value);
                        if (isNaN(newCheckin)) return;
                        const edCo = ed.checkout ? new Date(ed.checkout) : new Date(ed.rooms[0].checkout);
                        if (newCheckin >= edCo) { setToastMessage('Check-in must be before check-out'); return; }
                        const next = JSON.parse(JSON.stringify(ed));
                        next.rooms.forEach((room, ri) => {
                          const co = room.checkout ? new Date(room.checkout) : edCo;
                          if (newCheckin >= co) return;
                          next.rooms[ri].checkin = newCheckin.toISOString();
                        });
                        deriveReservationDates(next);
                        setPendingDateChange({ next, source: 'reservation' });
                      }}
                      className="font-medium text-neutral-900 bg-transparent border-0 border-b border-dashed border-neutral-300 px-0 py-0 text-xs cursor-pointer focus:outline-none focus:border-neutral-900 w-[110px]" />
                    <span className="text-neutral-400">&rarr;</span>
                    <input type="date" onKeyDown={noTypeDateKey}
                      value={(() => { const co = ed.checkout || (ed.rooms && ed.rooms.length > 0 ? ed.rooms.reduce((max, r) => { const d = new Date(r.checkout); return d > max ? d : max; }, new Date(ed.rooms[0].checkout)) : null); return co ? (co instanceof Date ? co : new Date(co)).toISOString().slice(0, 10) : ''; })()}
                      onChange={(e) => {
                        const newCheckout = new Date(e.target.value);
                        if (isNaN(newCheckout)) return;
                        const edCi = ed.checkin ? new Date(ed.checkin) : new Date(ed.rooms[0].checkin);
                        if (newCheckout <= edCi) { setToastMessage('Check-out must be after check-in'); return; }
                        const next = JSON.parse(JSON.stringify(ed));
                        next.rooms.forEach((room, ri) => {
                          const ci = room.checkin ? new Date(room.checkin) : edCi;
                          if (newCheckout <= ci) return;
                          next.rooms[ri].checkout = newCheckout.toISOString();
                        });
                        deriveReservationDates(next);
                        setPendingDateChange({ next, source: 'reservation' });
                      }}
                      className="font-medium text-neutral-900 bg-transparent border-0 border-b border-dashed border-neutral-300 px-0 py-0 text-xs cursor-pointer focus:outline-none focus:border-neutral-900 w-[110px]" />
                    <span className="text-neutral-300">·</span>
                    <span>{nightsLabel}</span>
                    <span className="text-neutral-300">·</span>
                    <span>{reservation.guestCount} guest{reservation.guestCount !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Keep prices popup is rendered globally below */}
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[
                        { key: 'breakfast', label: 'B', activeClass: 'bg-amber-100 text-amber-700 border border-amber-300', inactiveClass: 'bg-white border border-neutral-200 text-neutral-400 hover:text-amber-600 hover:border-amber-200' },
                        { key: 'lunch', label: 'L', activeClass: 'bg-orange-100 text-orange-700 border border-orange-300', inactiveClass: 'bg-white border border-neutral-200 text-neutral-400 hover:text-orange-600 hover:border-orange-200' },
                        { key: 'dinner', label: 'D', activeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-300', inactiveClass: 'bg-white border border-neutral-200 text-neutral-400 hover:text-indigo-600 hover:border-indigo-200' },
                      ].map(meal => {
                        const active = ed.meals && ed.meals[meal.key];
                        return (
                          <button key={meal.key} onClick={() => {
                            const next = JSON.parse(JSON.stringify(ed));
                            if (!next.meals) next.meals = { breakfast: false, lunch: false, dinner: false };
                            next.meals[meal.key] = !next.meals[meal.key];
                            setEditingReservation(next);
                          }}
                            className={`w-6 h-6 text-xs font-semibold rounded transition-all ${active ? meal.activeClass : meal.inactiveClass}`}
                            title={meal.key.charAt(0).toUpperCase() + meal.key.slice(1)}>
                            {meal.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-neutral-200">|</span>
                    <span className="text-xs text-neutral-400">ETA</span>
                    {ed.eta ? (
                      <div className="flex items-center gap-1">
                        <input type="time" value={ed.eta} onChange={(e) => updateEd('eta', e.target.value)}
                          className="px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                        <button onClick={() => updateEd('eta', '')} className="text-neutral-300 hover:text-neutral-500 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => updateEd('eta', '14:00')}
                        className="px-2 py-1 text-xs text-neutral-400 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:text-neutral-600 transition-all">
                        Unknown
                      </button>
                    )}
                  </div>
                </div>

                {/* Booker + Booking Details — 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
                  {/* Booker */}
                  <div className="p-4 pt-3 space-y-2">
                    <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Booker</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={ed.booker.firstName || ''} onChange={(e) => updateEd('booker.firstName', e.target.value)}
                        onFocus={onFocusTrack} onBlur={onBlurLog('Booker first name')}
                        placeholder="First name"
                        className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      <input value={ed.booker.lastName || ''} onChange={(e) => updateEd('booker.lastName', e.target.value)}
                        onFocus={onFocusTrack} onBlur={onBlurLog('Booker last name')}
                        placeholder="Last name"
                        className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    </div>
                    <input type="email" value={ed.booker.email} onChange={(e) => updateEd('booker.email', e.target.value)}
                      onFocus={onFocusTrack} onBlur={onBlurLog('Booker email')}
                      placeholder="Email"
                      className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    <div className="flex gap-1.5">
                      <input type="tel" value={ed.booker.phone} onChange={(e) => updateEd('booker.phone', e.target.value)}
                        onFocus={onFocusTrack} onBlur={onBlurLog('Booker phone')}
                        placeholder="Phone"
                        className="flex-1 px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      {ed.booker.phone && (
                        <a href={`https://wa.me/${ed.booker.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                          title="WhatsApp"
                          className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex-shrink-0">
                          <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Booker Details */}
                  <div className="p-4 pt-3 space-y-2">
                    {/* Billing Recipient */}
                    {(() => {
                      const br = ed.billingRecipient || { type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '', reference: '' };
                      const updateBR = (field, value) => {
                        const next = { ...br, [field]: value };
                        updateEd('billingRecipient', next);
                      };
                      const updateBRMulti = (fields) => {
                        const next = { ...br, ...fields };
                        updateEd('billingRecipient', next);
                      };
                      const companyQuery = br.type === 'company' ? (br.name || '') : '';
                      const companyMatches = companyQuery.length >= 1 ? companyRegistry.filter(c =>
                        c.name.toLowerCase().includes(companyQuery.toLowerCase()) && c.id !== br.companyId
                      ).slice(0, 5) : [];
                      const selectCompany = (comp) => {
                        updateEd('billingRecipient', { type: 'company', companyId: comp.id, name: comp.name, vatNumber: comp.vatNumber, peppolId: comp.peppolId, address: comp.address, zip: comp.zip, city: comp.city, country: comp.country, email: comp.email, phone: comp.phone });
                      };
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Booker Details</div>
                            <div className="flex gap-1">
                            <button onClick={() => updateEd('billingRecipient', { ...br, type: 'individual' })}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${br.type === 'individual' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                              Individual
                            </button>
                            <button onClick={() => { updateEd('billingRecipient', { ...br, type: 'company' }); if (ed.stayPurpose !== 'business') updateEd('stayPurpose', 'business'); }}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${br.type === 'company' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                              Company
                            </button>
                            </div>
                          </div>
                          {br.type === 'individual' && (
                            <div className="space-y-1.5">
                              <input value={br.address} onChange={(e) => updateBR('address', e.target.value)} placeholder="Address"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="grid grid-cols-3 gap-1.5">
                                <input value={br.zip} onChange={(e) => updateBR('zip', e.target.value)} placeholder="Zip"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.city} onChange={(e) => updateBR('city', e.target.value)} placeholder="City"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.country} onChange={(e) => updateBR('country', e.target.value)} placeholder="Country"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              </div>
                            </div>
                          )}
                          {br.type === 'company' && (
                            <div className="space-y-1.5">
                              <div className="relative">
                                <input value={br.name} onChange={(e) => { updateBRMulti(br.companyId ? { name: e.target.value, companyId: null } : { name: e.target.value }); }}
                                  placeholder="Search or type company name..."
                                  className="w-full px-2.5 py-1.5 pr-8 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                {!br.companyId && br.name && (
                                  <button onClick={() => {
                                    const newId = Math.max(0, ...companyRegistry.map(c => c.id)) + 1;
                                    companyRegistry.push({ id: newId, name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email, phone: br.phone });
                                    saveCompanyRegistry();
                                    updateBR('companyId', newId);
                                    setToastMessage(`${br.name} saved to registry`);
                                  }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-blue-600 transition-colors" title="Save to company registry">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                  </button>
                                )}
                                {br.companyId && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                )}
                                {companyMatches.length > 0 && !br.companyId && (
                                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                    {companyMatches.map(c => (
                                      <button key={c.id} onClick={() => selectCompany(c)}
                                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                        <span className="font-medium text-neutral-900">{c.name}</span>
                                        <span className="text-xs text-neutral-400">{c.vatNumber}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className="relative">
                                  <input value={br.vatNumber} onChange={(e) => {
                                      const vat = e.target.value;
                                      const digits = vat.replace(/[^0-9]/g, '');
                                      const peppolId = digits.length >= 9 ? '0208:' + digits : ((!br.peppolId || br.peppolId.startsWith('0208:')) ? '' : br.peppolId);
                                      updateBRMulti({ vatNumber: vat, peppolId, _viesValid: undefined });
                                    }}
                                    placeholder="VAT number"
                                    className="w-full px-2.5 py-1.5 pr-8 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                  {/* VIES lookup button / status */}
                                  {br.vatNumber && br.vatNumber.length >= 6 && (
                                    br._viesValid === 'loading' ? (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                                    ) : br._viesValid === true ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    ) : br._viesValid === false ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-500 absolute right-2 top-1/2 -translate-y-1/2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    ) : (
                                      <button onClick={() => {
                                        const vat = br.vatNumber || '';
                                        const countryCode = vat.slice(0, 2).toUpperCase();
                                        const vatNum = vat.slice(2).replace(/[^0-9A-Za-z]/g, '');
                                        if (!/^[A-Z]{2}$/.test(countryCode) || vatNum.length < 4) {
                                          setToastMessage('Enter VAT as: BE0123456789');
                                          return;
                                        }
                                        updateBRMulti({ _viesValid: 'loading' });
                                        fetchVIES(countryCode, vatNum)
                                          .then(data => {
                                            if (data.isValid && data.name && data.name !== '---') {
                                              const addr = data.address || '';
                                              const fields = { _viesValid: true };
                                              if (!br.name || !br.companyId) fields.name = data.name;
                                              if (addr) {
                                                const lines = addr.split('\n').map(l => l.trim()).filter(Boolean);
                                                if (lines.length >= 2) {
                                                  fields.address = lines[0];
                                                  const lastLine = lines[lines.length - 1];
                                                  const zipMatch = lastLine.match(/^(\d{4,6})\s+(.+)/);
                                                  if (zipMatch) { fields.zip = zipMatch[1]; fields.city = zipMatch[2]; }
                                                  else fields.city = lastLine;
                                                }
                                                if (!br.country) fields.country = countryCode;
                                              }
                                              updateBRMulti(fields);
                                              setToastMessage(`VIES: ${data.name}`);
                                            } else if (data.isValid === false) {
                                              updateBRMulti({ _viesValid: false });
                                              setToastMessage('VIES: VAT number not found');
                                            } else {
                                              updateBRMulti({ _viesValid: false });
                                              setToastMessage('VIES: Could not validate');
                                            }
                                          })
                                          .catch(() => {
                                            updateBRMulti({ _viesValid: false });
                                            setToastMessage('VIES: Connection failed');
                                          });
                                      }}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors rounded" title="Look up in EU VIES database">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                      </button>
                                    )
                                  )}
                                </div>
                                <input value={br.peppolId} onChange={(e) => updateBR('peppolId', e.target.value)} placeholder="Peppol ID"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              </div>
                              <input value={br.address} onChange={(e) => updateBR('address', e.target.value)} placeholder="Address"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="grid grid-cols-3 gap-1.5">
                                <input value={br.zip} onChange={(e) => updateBR('zip', e.target.value)} placeholder="Zip"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.city} onChange={(e) => updateBR('city', e.target.value)} placeholder="City"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.country} onChange={(e) => updateBR('country', e.target.value)} placeholder="Country"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              </div>
                              <input value={br.email} onChange={(e) => updateBR('email', e.target.value)} placeholder="Billing email"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="relative">
                        <select value={ed.bookedVia} onChange={(e) => { const nv = e.target.value; if (nv !== ed.bookedVia) updateEd('bookedVia', nv, `Booked via: ${ed.bookedVia} → ${nv}`); }}
                          className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                          <option value="direct">Direct</option>
                          <option value="booking.com">Booking.com</option>
                          <option value="expedia">Expedia</option>
                          <option value="phone">Phone</option>
                          <option value="email">Email</option>
                          <option value="walk-in">Walk-in</option>
                          <option value="agency">Travel Agency</option>
                        </select>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      <div className="relative">
                        <select value={ed.stayPurpose} onChange={(e) => { const nv = e.target.value; if (nv !== ed.stayPurpose) updateEd('stayPurpose', nv, `Stay purpose: ${ed.stayPurpose} → ${nv}`); }}
                          className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                          <option value="leisure">Leisure</option>
                          <option value="business">Business</option>
                          <option value="mice">MICE</option>
                        </select>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes — full width bottom */}
                <div className="px-4 py-2.5 border-t border-neutral-100">
                  <textarea value={ed.notes} onChange={(e) => updateEd('notes', e.target.value)}
                    rows="1" placeholder="Notes..."
                    className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none" />
                </div>
              </div>

              {/* Communication + Reminders + Activity Log */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Email Actions */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Communication</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { addToActivityLog('Confirmation email sent'); setToastMessage('Confirmation email sent'); }}
                      className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:border-emerald-400 transition-colors flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-600"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      <span className="text-xs font-medium text-neutral-900">Confirmation</span>
                    </button>
                    <button onClick={() => { addToActivityLog('Cancellation email sent'); setToastMessage('Cancellation email sent'); }}
                      className="p-3 bg-red-50 border border-red-200 rounded-xl hover:border-red-400 transition-colors flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-red-600"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      <span className="text-xs font-medium text-neutral-900">Cancellation</span>
                    </button>
                    <button onClick={() => {
                      const bookerEmail = ed.booker?.email;
                      if (!bookerEmail) { setToastMessage('No booker email available'); return; }
                      // Find or create booker profile
                      let bp = bookerProfiles.find(b =>
                        (b.email && b.email === bookerEmail) ||
                        (b.firstName === ed.booker?.firstName && b.lastName === ed.booker?.lastName)
                      );
                      if (bp && bp.creditCard) {
                        setToastMessage('This booker already has a credit card on file');
                        return;
                      }
                      // Mark as pending on the reservation
                      const next = JSON.parse(JSON.stringify(ed));
                      next._ccRequestSent = true;
                      next._ccRequestDate = Date.now();
                      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Credit card request sent to ${bookerEmail}`, user: 'Sophie' });
                      setEditingReservation(next);
                      setToastMessage(`Credit card request sent to ${bookerEmail}`);
                      // Simulate the guest responding after 8 seconds
                      setTimeout(() => {
                        const simCard = {
                          last4: String(1000 + Math.floor(Math.random() * 9000)),
                          expiry: `${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}/${String(26 + Math.floor(Math.random() * 4))}`,
                          cvc: String(100 + Math.floor(Math.random() * 900)),
                          holder: `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim(),
                          token: 'enc_' + btoa('4' + String(Math.random()).slice(2, 15) + String(1000 + Math.floor(Math.random() * 9000)))
                        };
                        // Add to booker profile
                        let bpNow = bookerProfiles.find(b =>
                          (b.email && b.email === bookerEmail) ||
                          (b.firstName === ed.booker?.firstName && b.lastName === ed.booker?.lastName)
                        );
                        if (!bpNow) {
                          bpNow = {
                            id: 'bp-' + Date.now() + Math.random().toString(36).slice(2,6),
                            firstName: ed.booker?.firstName || '', lastName: ed.booker?.lastName || '',
                            email: bookerEmail, phone: ed.booker?.phone || '',
                            linkedCompanyId: null, creditCard: null,
                            priceAgreement: { amount: null, percentage: null }, notes: '',
                            createdAt: Date.now(), updatedAt: Date.now()
                          };
                          bookerProfiles.push(bpNow);
                        }
                        const bpIdx = bookerProfiles.findIndex(b => b.id === bpNow.id);
                        if (bpIdx >= 0) {
                          bookerProfiles[bpIdx] = { ...bookerProfiles[bpIdx], creditCard: simCard, updatedAt: Date.now() };
                        }
                        saveBookerProfiles(); syncProfiles('booker_profiles', bookerProfiles);
                        setToastMessage(`Credit card received from ${ed.booker?.firstName || 'guest'} and saved to profile`);
                        // Update activity log on current reservation
                        const curr = reservations.find(r => r.bookingRef === ed.bookingRef);
                        if (curr) {
                          curr.activityLog = curr.activityLog || [];
                          curr.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Credit card received and saved to booker profile (•••• ${simCard.last4})`, user: 'System' });
                          saveReservations();
                        }
                      }, 8000);
                    }}
                      className={`col-span-2 p-3 border rounded-xl hover:border-blue-400 transition-colors flex items-center gap-2 ${
                        ed._ccRequestSent && !bookerProfiles.find(b => (b.email && b.email === ed.booker?.email) || (b.firstName === ed.booker?.firstName && b.lastName === ed.booker?.lastName))?.creditCard ? 'bg-blue-100 border-blue-300' : 'bg-blue-50 border-blue-200'
                      }`}>
                      <Icons.CreditCard className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-neutral-900">
                        {ed._ccRequestSent && !bookerProfiles.find(b => (b.email && b.email === ed.booker?.email) || (b.firstName === ed.booker?.firstName && b.lastName === ed.booker?.lastName))?.creditCard ? 'Card request sent — awaiting response...' : 'Request Credit Card'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Reminders */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Reminders</div>
                    <button onClick={() => {
                      const next = JSON.parse(JSON.stringify(ed));
                      if (!next._showReminderForm) next._showReminderForm = true;
                      else next._showReminderForm = false;
                      setEditingReservation(next);
                    }}
                      className="w-5 h-5 rounded-md hover:bg-neutral-100 flex items-center justify-center transition-colors text-neutral-400 hover:text-neutral-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>

                  {/* Add reminder form */}
                  {ed._showReminderForm && (
                    <div className="mb-3 p-2.5 bg-neutral-50 rounded-xl space-y-2">
                      <input id="reminderMsg" placeholder="Reminder message..." className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'Tomorrow 9:00', tomorrow9: true },
                          { label: 'Day before check-in', daysBefore: 1 },
                          { label: 'Day of check-in', daysBefore: 0 },
                          { label: '1 week before', daysBefore: 7 },
                          { label: 'Custom', custom: true }
                        ].map(opt => (
                          <button key={opt.label} onClick={() => {
                            if (opt.custom) {
                              const el = document.getElementById('reminderDateCustom');
                              if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
                              return;
                            }
                            let due;
                            if (opt.tomorrow9) {
                              due = new Date();
                              due.setDate(due.getDate() + 1);
                              due.setHours(9, 0, 0, 0);
                            } else if (opt.daysBefore !== undefined) {
                              due = new Date(ed.checkin || reservation.checkin);
                              due.setDate(due.getDate() - opt.daysBefore);
                              due.setHours(9, 0, 0, 0);
                            } else {
                              due = new Date(Date.now() + opt.mins * 60000);
                            }
                            const msg = document.getElementById('reminderMsg')?.value?.trim();
                            if (!msg) { setToastMessage('Please enter a message'); return; }
                            const isoLocal = new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            const next = JSON.parse(JSON.stringify(ed));
                            if (!next.reminders) next.reminders = [];
                            next.reminders.push({ id: Date.now(), message: msg, dueDate: isoLocal, createdAt: Date.now(), fired: false, toastShown: false });
                            next._showReminderForm = false;
                            next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Reminder set: "${msg}" (${opt.label})`, user: 'Sophie' });
                            setEditingReservation(next);
                            setToastMessage('Reminder added');
                          }}
                            className={`px-2 py-1 text-xs font-medium rounded-lg border transition-all ${opt.custom ? 'border-neutral-300 text-neutral-500 hover:bg-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-900 hover:text-neutral-900'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div id="reminderDateCustom" style={{ display: 'none' }} className="flex gap-1.5">
                        <input id="reminderDateInput" type="datetime-local" className="flex-1 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                        <button onClick={() => {
                          const msg = document.getElementById('reminderMsg')?.value?.trim();
                          const due = document.getElementById('reminderDateInput')?.value;
                          if (!msg || !due) { setToastMessage('Please fill in message and date'); return; }
                          const next = JSON.parse(JSON.stringify(ed));
                          if (!next.reminders) next.reminders = [];
                          next.reminders.push({ id: Date.now(), message: msg, dueDate: due, createdAt: Date.now(), fired: false, toastShown: false });
                          next._showReminderForm = false;
                          next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Reminder set: "${msg}"`, user: 'Sophie' });
                          setEditingReservation(next);
                          setToastMessage('Reminder added');
                        }}
                          className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors flex-shrink-0">
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reminders list */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(ed.reminders || []).length === 0 && !ed._showReminderForm && (
                      <div className="text-xs text-neutral-400 text-center py-3">No reminders</div>
                    )}
                    {[...(ed.reminders || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((rem) => {
                      const isDue = new Date(rem.dueDate) <= new Date();
                      const isPending = isDue && !rem.fired;
                      return (
                        <div key={rem.id} className={`flex items-start gap-2 p-2 rounded-lg ${rem.fired ? 'bg-neutral-50 opacity-50' : isPending ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50'}`}>
                          <div className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${rem.fired ? 'bg-neutral-300' : isPending ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs ${rem.fired ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{rem.message}</div>
                            <div className="text-xs text-neutral-400">
                              {new Date(rem.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            {isPending && (
                              <button onClick={() => {
                                const next = JSON.parse(JSON.stringify(ed));
                                const r = next.reminders.find(r => r.id === rem.id);
                                if (r) r.fired = true;
                                next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Reminder acknowledged: "${rem.message}"`, user: 'Sophie' });
                                setEditingReservation(next);
                              }}
                                title="Acknowledge"
                                className="text-amber-400 hover:text-emerald-500 transition-colors">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                            )}
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.reminders = next.reminders.filter(r => r.id !== rem.id);
                              setEditingReservation(next);
                            }}
                              className="text-neutral-300 hover:text-red-400 transition-colors">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Activity Log */}
                {(() => {
                  const sorted = [...ed.activityLog].sort((a, b) => b.timestamp - a.timestamp);
                  const collapsed = !ed._logExpanded;
                  const preview = 3;
                  const shown = collapsed ? sorted.slice(0, preview) : sorted;
                  const hasMore = sorted.length > preview;
                  return (
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Activity Log</div>
                  <div className={`space-y-2 ${!collapsed ? 'max-h-64 overflow-y-auto' : ''}`}>
                    {shown.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-neutral-300 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-neutral-900">{entry.action}</div>
                          <div className="text-xs text-neutral-400">
                            {new Date(entry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} &middot; {entry.user}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <button onClick={() => {
                      const next = JSON.parse(JSON.stringify(ed));
                      next._logExpanded = !ed._logExpanded;
                      setEditingReservation(next);
                    }}
                      className="mt-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                      {collapsed ? `Show all (${sorted.length})` : 'Show less'}
                    </button>
                  )}
                </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ===== TAB 2: ROOM & GUESTS (+ Extras) ===== */}
          {reservationTab === 'room' && (
            <div className="space-y-4">

              {/* Quick Edit Grid */}
              {roomGridMode && (() => {
                const allRoomsList = getAllRooms();
                const flatEntries = buildFlatRoomEntries(reservations);
                const getAvailableRooms = (ri) => {
                  const room = ed.rooms[ri];
                  const usedByOthers = ed.rooms.filter((_, i) => i !== ri).map(r => r.roomNumber);
                  const roomCi = room.checkin ? new Date(room.checkin) : new Date(ed.checkin || reservation.checkin);
                  const roomCo = room.checkout ? new Date(room.checkout) : new Date(ed.checkout || reservation.checkout);
                  return allRoomsList.filter(rm => {
                    if (rm === room.roomNumber) return true;
                    if (usedByOthers.includes(rm)) return false;
                    return !flatEntries.some(r => {
                      if (r.room !== rm || r.id === reservation.id) return false;
                      const st = r.reservationStatus || 'confirmed';
                      if (st === 'cancelled' || st === 'no-show') return false;
                      return new Date(r.checkin) < roomCo && new Date(r.checkout) > roomCi;
                    });
                  });
                };
                const gridTotal = ed.rooms.reduce((s, r) => s + (r.priceType === 'fixed' ? (r.fixedPrice || 0) : r.nightPrices.reduce((ns, n) => ns + (n.amount || 0), 0)), 0);
                return (
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-20">Room</th>
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-28">Status</th>
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Guest</th>
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-20">Pricing</th>
                          <th className="px-2.5 py-1.5 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider w-24">Price (€)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ed.rooms.map((room, ri) => {
                          const guestCount = room.guests ? room.guests.length : 1;
                          const availRooms = getAvailableRooms(ri);
                          return (
                          <React.Fragment key={ri}>
                            <tr className={`${guestCount === 1 ? 'border-b border-neutral-100' : ''} hover:bg-neutral-50/50`}>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                <select value={room.roomNumber} onChange={(e) => {
                                    const newRoom = e.target.value;
                                    if (newRoom === room.roomNumber) return;
                                    const next = JSON.parse(JSON.stringify(ed));
                                    const oldRoom = next.rooms[ri].roomNumber;
                                    next.rooms[ri].roomNumber = newRoom;
                                    next.rooms[ri].roomType = getRoomTypeName(newRoom);
                                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room changed: ${oldRoom} → ${newRoom}`, user: 'Sophie' });
                                    setEditingReservation(next);
                                    setToastMessage(`Room changed to ${newRoom}`);
                                  }}
                                  className="w-full px-1.5 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 appearance-none cursor-pointer">
                                  {availRooms.map(rm => <option key={rm} value={rm}>{rm}</option>)}
                                </select>
                              </td>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                <select value={room.status || 'confirmed'} onChange={(e) => updateRoomStatus(ri, e.target.value)}
                                  className={`w-full px-1.5 py-1 rounded-lg text-xs font-semibold border-0 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                                    ({ confirmed: 'bg-blue-100 text-blue-800', option: 'bg-pink-100 text-pink-800', 'checked-in': 'bg-emerald-100 text-emerald-800', 'checked-out': 'bg-neutral-200 text-neutral-600', 'no-show': 'bg-red-100 text-red-800', cancelled: 'bg-red-100 text-red-800', blocked: 'bg-slate-200 text-slate-800' })[room.status || 'confirmed'] || 'bg-blue-100 text-blue-800'
                                  }`}>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="option">Option</option>
                                  <option value="checked-in">Checked-in</option>
                                  <option value="checked-out">Checked-out</option>
                                  <option value="no-show">No-show</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="blocked">Blocked</option>
                                </select>
                              </td>
                              <td className="px-2.5 py-1">
                                <div className="flex gap-1 items-center">
                                  <input value={(room.guests && room.guests[0] ? room.guests[0].firstName : '') || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.0.firstName`, e.target.value)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest 1 first name`)}
                                    placeholder="First..."
                                    className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                  <input value={(room.guests && room.guests[0] ? room.guests[0].lastName : '') || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.0.lastName`, e.target.value)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest 1 last name`)}
                                    placeholder="Last..."
                                    className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                  <input type="email" value={(room.guests && room.guests[0] ? room.guests[0].email : '') || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.0.email`, e.target.value)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest 1 email`)}
                                    placeholder="email..."
                                    className="flex-1 px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                </div>
                              </td>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                <select value={room.priceType} onChange={(e) => { const nv = e.target.value; if (nv !== room.priceType) updateEd(`rooms.${ri}.priceType`, nv, `Room ${room.roomNumber}: pricing ${room.priceType} → ${nv}`); }}
                                  className="w-full px-1.5 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 appearance-none cursor-pointer">
                                  <option value="fixed">Fixed</option>
                                  <option value="per-night">Per Night</option>
                                </select>
                              </td>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                {room.priceType === 'fixed' ? (
                                  <input type="number" value={room.fixedPrice || ''} onChange={(e) => updateEd(`rooms.${ri}.fixedPrice`, parseFloat(e.target.value) || 0)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} price`)}
                                    className="w-full px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                ) : (
                                  <div className="text-xs text-right text-neutral-900 font-medium">
                                    €{room.nightPrices.reduce((s, n) => s + (n.amount || 0), 0)}
                                  </div>
                                )}
                              </td>
                            </tr>
                            {room.guests && room.guests.slice(1).map((guest, gi) => (
                              <tr key={`${ri}-g${gi+1}`} className={`${gi + 2 === guestCount ? 'border-b border-neutral-100' : ''} hover:bg-neutral-50/50`}>
                                <td className="px-2.5 py-1">
                                  <div className="flex gap-1 items-center">
                                    <input value={guest.firstName || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi+1}.firstName`, e.target.value)}
                                      onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+2} first name`)}
                                      placeholder="First..."
                                      className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                    <input value={guest.lastName || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi+1}.lastName`, e.target.value)}
                                      onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+2} last name`)}
                                      placeholder="Last..."
                                      className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                    <input type="email" value={guest.email || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi+1}.email`, e.target.value)}
                                      onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+2} email`)}
                                      placeholder="email..."
                                      className="flex-1 px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-neutral-50 border-t border-neutral-200">
                          <td colSpan="3" className="px-2.5 py-2 text-xs font-medium text-neutral-700">Total</td>
                          <td colSpan="2" className="px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 justify-end">
                              <input type="number" placeholder="Set all..."
                                id="quickEditBulkPrice"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) return;
                                    const next = JSON.parse(JSON.stringify(ed));
                                    next.rooms.forEach(r => { r.fixedPrice = val; r.priceType = 'fixed'; });
                                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `All rooms price set to €${val.toFixed(2)}`, user: 'Sophie' });
                                    setEditingReservation(next);
                                    setToastMessage(`All ${next.rooms.length} rooms set to €${val.toFixed(2)}`);
                                    e.target.value = '';
                                  }
                                }}
                                className="w-20 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                              <button onClick={() => {
                                  const val = parseFloat(document.getElementById('quickEditBulkPrice')?.value);
                                  if (isNaN(val)) return;
                                  const next = JSON.parse(JSON.stringify(ed));
                                  next.rooms.forEach(r => { r.fixedPrice = val; r.priceType = 'fixed'; });
                                  next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `All rooms price set to €${val.toFixed(2)}`, user: 'Sophie' });
                                  setEditingReservation(next);
                                  setToastMessage(`All ${next.rooms.length} rooms set to €${val.toFixed(2)}`);
                                  document.getElementById('quickEditBulkPrice').value = '';
                                }}
                                className="px-2 py-1 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors">Apply</button>
                              <span className="text-xs font-bold text-neutral-900 pl-1">€{gridTotal.toFixed(2)}</span>
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                );
              })()}

              {/* Detail View */}
              {!roomGridMode && (
                <div className={ed.rooms.length > 3 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                {ed.rooms.map((room, ri) => {
                  const isCollapsible = ed.rooms.length > 3;
                  const isExpanded = !isCollapsible || expandedRooms[ri];
                  const primaryGuest = room.guests && room.guests[0];
                  const guestLabel = primaryGuest && (primaryGuest.firstName || primaryGuest.lastName)
                    ? `${primaryGuest.firstName || ''} ${primaryGuest.lastName || ''}`.trim()
                    : '';
                  return (
                <div key={ri} className={`bg-white border border-neutral-200 rounded-2xl overflow-hidden border-l-4 ${
                  ({ confirmed: 'border-l-blue-400', option: 'border-l-pink-400', 'checked-in': 'border-l-emerald-400', 'checked-out': 'border-l-neutral-300', 'no-show': 'border-l-red-400', cancelled: 'border-l-red-300', blocked: 'border-l-slate-400' })[room.status || 'confirmed'] || 'border-l-blue-400'
                } ${isExpanded && isCollapsible ? 'md:col-span-2' : ''}`}>
                  {/* Room Header — click to collapse/expand */}
                  <div className={`px-4 ${isCollapsible ? 'cursor-pointer select-none' : ''}`}
                    onClick={isCollapsible ? (e) => { if (['SELECT','OPTION','BUTTON','INPUT'].includes(e.target.tagName)) return; setExpandedRooms(prev => ({ ...prev, [ri]: !prev[ri] })); } : undefined}>
                    {/* Identity row */}
                    <div className={`flex items-center gap-2 ${isExpanded ? 'pt-3 pb-2' : 'pt-3 pb-0.5'}`}>
                      <span className="text-base font-bold text-neutral-900 flex-shrink-0">{room.roomNumber}</span>
                      {(housekeepingStatus?.[reservation.id] || room.housekeeping) !== 'clean' && <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" title="Housekeeping pending" />}
                      <span className="text-[13px] text-neutral-400 font-medium flex-shrink-0">{room.roomType}</span>
                      {guestLabel && <React.Fragment><span className="text-neutral-300 flex-shrink-0">&middot;</span><span className="text-[13px] text-neutral-500 truncate min-w-0">{guestLabel}</span></React.Fragment>}
                      <div className="flex-1 min-w-0" />
                      {/* Action icons */}
                      <div className="flex items-center gap-1 flex-shrink-0 relative" data-popup onClick={(e) => e.stopPropagation()}>
                        {!room.roomLocked && (
                        <button onClick={() => setChangeRoomTarget(changeRoomTarget === ri ? null : ri)}
                          title="Change Room"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200/60 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-neutral-400"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        </button>
                        )}
                        <button onClick={() => setToastMessage('Key card issued')}
                          title="Key Card"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200/60 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-neutral-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 0-7.778 7.778 5.5 5.5 0 0 0 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                        </button>
                        <button onClick={() => {
                          const next = JSON.parse(JSON.stringify(ed));
                          const wasLocked = next.rooms[ri].roomLocked;
                          next.rooms[ri].roomLocked = !wasLocked;
                          if (wasLocked) next.rooms[ri].roomLockedReason = '';
                          next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${room.roomNumber} ${wasLocked ? 'unlocked' : 'locked'}${!wasLocked ? '' : ''}`, user: 'Sophie' });
                          setEditingReservation(next);
                          setToastMessage(`Room ${room.roomNumber} ${wasLocked ? 'unlocked' : 'locked'}`);
                        }}
                          title={room.roomLocked ? 'Unlock Room' : 'Lock Room'}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${room.roomLocked ? 'hover:bg-red-100' : 'hover:bg-neutral-200/60'}`}>
                          {room.roomLocked ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-red-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-neutral-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                          )}
                        </button>

                        {/* Change Room Popup */}
                        {changeRoomTarget === ri && (
                          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-neutral-200 py-2 z-50">
                            <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">Available Rooms</div>
                            {(() => {
                              const allRooms = getAllRooms();
                              const usedRooms = ed.rooms.map(r => r.roomNumber);
                              const roomCi = room.checkin ? new Date(room.checkin) : new Date(ed.checkin || reservation.checkin);
                              const roomCo = room.checkout ? new Date(room.checkout) : new Date(ed.checkout || reservation.checkout);
                              const flatEntries = buildFlatRoomEntries(reservations);
                              const freeRooms = allRooms.filter(rm => {
                                if (usedRooms.includes(rm)) return false;
                                return !flatEntries.some(r => {
                                  if (r.room !== rm) return false;
                                  if (r.id === reservation.id) return false;
                                  const st = r.reservationStatus || 'confirmed';
                                  if (st === 'cancelled' || st === 'no-show') return false;
                                  const rCi = new Date(r.checkin);
                                  const rCo = new Date(r.checkout);
                                  return rCi < roomCo && rCo > roomCi;
                                });
                              });
                              if (freeRooms.length === 0) return <div className="px-3 py-2 text-xs text-neutral-400">No rooms available</div>;
                              return freeRooms.map(rm => (
                                <button key={rm} onClick={() => {
                                  const next = JSON.parse(JSON.stringify(ed));
                                  const oldRoom = next.rooms[ri].roomNumber;
                                  next.rooms[ri].roomNumber = rm;
                                  next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room changed: ${oldRoom} → ${rm}`, user: 'Sophie' });
                                  setEditingReservation(next);
                                  setChangeRoomTarget(null);
                                  setToastMessage(`Room changed to ${rm}`);
                                }} className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors flex items-center justify-between">
                                  <span className="font-medium">{rm}</span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                      {isCollapsible && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 text-neutral-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}><path d="M9 18l6-6-6-6"/></svg>
                      )}
                    </div>
                    {/* Collapsed: summary line */}
                    {!isExpanded && (
                      <div className="flex items-center gap-1.5 pb-2.5">
                        {(housekeepingStatus?.[reservation.id] || room.housekeeping) !== 'clean' && <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" title="Housekeeping pending" />}
                        <span className={`text-xs font-semibold ${
                          ({ confirmed: 'text-blue-600', option: 'text-pink-600', 'checked-in': 'text-emerald-600', 'checked-out': 'text-neutral-500', 'no-show': 'text-red-600', cancelled: 'text-red-500', blocked: 'text-slate-600' })[room.status || 'confirmed'] || 'text-blue-600'
                        }`}>{({ confirmed: 'Confirmed', option: 'Option', 'checked-in': 'Checked-in', 'checked-out': 'Checked-out', 'no-show': 'No-show', cancelled: 'Cancelled', blocked: 'Blocked' })[room.status || 'confirmed']}</span>
                        <span className="text-neutral-300 text-xs">&middot;</span>
                        <span className="text-xs text-neutral-400">{ratePlans.find(rp => rp.id === room.ratePlanId)?.name || ratePlans[0]?.name}</span>
                        <span className="text-neutral-300 text-xs">&middot;</span>
                        <span className="text-xs font-medium text-neutral-500">€{room.priceType === 'fixed' ? (room.fixedPrice || 0) : (room.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0)}</span>
                        <span className="text-neutral-300 text-xs">&middot;</span>
                        <span className="text-xs text-neutral-400">{(() => { const ci = room.checkin ? new Date(room.checkin) : edCheckin; const co = room.checkout ? new Date(room.checkout) : edCheckout; return `${ci.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → ${co.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`; })()}</span>
                      </div>
                    )}
                  </div>
                  {/* Expanded: form controls grid */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-neutral-50/80 border-b border-neutral-100" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Status</div>
                          <select value={room.status || 'confirmed'} onChange={(e) => updateRoomStatus(ri, e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                              ({ confirmed: 'bg-blue-100 text-blue-800', option: 'bg-pink-100 text-pink-800', 'checked-in': 'bg-emerald-100 text-emerald-800', 'checked-out': 'bg-neutral-200 text-neutral-600', 'no-show': 'bg-red-100 text-red-800', cancelled: 'bg-red-100 text-red-800', blocked: 'bg-slate-200 text-slate-800' })[room.status || 'confirmed'] || 'bg-blue-100 text-blue-800'
                            }`}>
                            <option value="confirmed">Confirmed</option>
                            <option value="option">Option</option>
                            <option value="checked-in">Checked-in</option>
                            <option value="checked-out">Checked-out</option>
                            <option value="no-show">No-show</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="blocked">Blocked</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Rate Plan</div>
                          <div className="flex items-center gap-1.5">
                            <select value={room.ratePlanId || ratePlans[0]?.id || ''} onChange={(e) => updateEd(`rooms.${ri}.ratePlanId`, e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs font-medium bg-white border border-neutral-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900">
                              {ratePlans.map(rp => <option key={rp.id} value={rp.id}>{rp.name}</option>)}
                            </select>
                            <button onClick={() => setPricingOpen(prev => ({ ...prev, [ri]: !prev[ri] }))}
                              className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${pricingOpen[ri] ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                              title="Edit pricing">
                              €{room.priceType === 'fixed' ? (room.fixedPrice || 0) : (room.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0)}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Check-in</div>
                          <input type="date" onKeyDown={noTypeDateKey}
                            value={room.checkin ? (room.checkin instanceof Date ? room.checkin.toISOString().slice(0, 10) : new Date(room.checkin).toISOString().slice(0, 10)) : ''}
                            onChange={(e) => {
                              const newCheckin = new Date(e.target.value);
                              if (isNaN(newCheckin)) return;
                              const co = room.checkout ? new Date(room.checkout) : new Date(ed.checkout || reservation.checkout);
                              if (newCheckin >= co) { setToastMessage('Check-in must be before check-out'); return; }
                              const next = JSON.parse(JSON.stringify(ed));
                              next.rooms[ri].checkin = newCheckin.toISOString();
                              deriveReservationDates(next);
                              setPendingDateChange({ next, source: 'room', roomIndex: ri });
                            }}
                            className="w-full px-2 py-1 rounded-lg text-xs bg-white border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Check-out</div>
                          <input type="date" onKeyDown={noTypeDateKey}
                            value={room.checkout ? (room.checkout instanceof Date ? room.checkout.toISOString().slice(0, 10) : new Date(room.checkout).toISOString().slice(0, 10)) : ''}
                            onChange={(e) => {
                              const newCheckout = new Date(e.target.value);
                              if (isNaN(newCheckout)) return;
                              const ci = room.checkin ? new Date(room.checkin) : new Date(ed.checkin || reservation.checkin);
                              if (newCheckout <= ci) { setToastMessage('Check-out must be after check-in'); return; }
                              const next = JSON.parse(JSON.stringify(ed));
                              next.rooms[ri].checkout = newCheckout.toISOString();
                              deriveReservationDates(next);
                              setPendingDateChange({ next, source: 'room', roomIndex: ri });
                            }}
                            className="w-full px-2 py-1 rounded-lg text-xs bg-white border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer" />
                        </div>
                      </div>
                      {(room.status || 'confirmed') === 'option' && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Option expires</div>
                          <input type="datetime-local" value={room.optionExpiry || ''} onChange={(e) => updateEd(`rooms.${ri}.optionExpiry`, e.target.value)}
                            className="px-2 py-1 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-700 focus:outline-none focus:ring-1 focus:ring-pink-300" />
                          {room.optionExpiry && (
                            <button onClick={() => updateEd(`rooms.${ri}.optionExpiry`, null)} className="text-pink-300 hover:text-pink-500 transition-colors">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                      {/* Pricing — inline, toggled from price badge */}
                      {pricingOpen[ri] && (
                        <div className="mt-2 pt-2 border-t border-neutral-200/60">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex gap-1">
                              <button onClick={() => { if (room.priceType !== 'fixed') updateEd(`rooms.${ri}.priceType`, 'fixed', `Room ${room.roomNumber}: pricing per-night → fixed`); }}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                                  room.priceType === 'fixed' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                                }`}>Fixed</button>
                              <button onClick={() => { if (room.priceType !== 'per-night') updateEd(`rooms.${ri}.priceType`, 'per-night', `Room ${room.roomNumber}: pricing fixed → per-night`); }}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                                  room.priceType === 'per-night' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                                }`}>Per Night</button>
                            </div>
                          </div>
                          {room.priceType === 'fixed' ? (
                            <div className="relative max-w-xs">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">EUR</span>
                              <input type="number" value={room.fixedPrice || ''} onChange={(e) => updateEd(`rooms.${ri}.fixedPrice`, parseFloat(e.target.value) || 0)}
                                onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} price`)}
                                className="w-full pl-12 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            </div>
                          ) : (
                            <div className="bg-white rounded-lg overflow-hidden border border-neutral-200">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-neutral-200">
                                    <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                                    <th className="px-3 py-1.5 text-right text-xs font-medium text-neutral-500 uppercase">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {room.nightPrices.map((night, ni) => (
                                    <tr key={ni} className="border-b border-neutral-100 last:border-0">
                                      <td className="px-3 py-1 text-xs text-neutral-900">
                                        {formatDate(new Date(night.date))} <span className="text-neutral-400">{new Date(night.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                                      </td>
                                      <td className="px-3 py-1 text-right">
                                        <div className="relative inline-block">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                                          <input type="number" value={night.amount}
                                            onChange={(e) => {
                                              const next = JSON.parse(JSON.stringify(ed));
                                              next.rooms[ri].nightPrices[ni].amount = parseFloat(e.target.value) || 0;
                                              setEditingReservation(next);
                                            }}
                                            onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} night rate (${night.date})`)}
                                            className="w-24 pl-10 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-neutral-50">
                                    <td className="px-3 py-1.5 text-xs font-medium text-neutral-900">Total</td>
                                    <td className="px-3 py-1.5 text-right text-xs font-bold text-neutral-900">
                                      EUR {room.nightPrices.reduce((s, n) => s + (n.amount || 0), 0)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {room.roomLocked && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-red-400 flex-shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span className="text-xs text-red-600 font-medium flex-shrink-0">Locked</span>
                      <input type="text" value={room.roomLockedReason || ''} onChange={(e) => updateEd(`rooms.${ri}.roomLockedReason`, e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 text-xs bg-transparent border-0 text-red-700 placeholder-red-300 focus:outline-none" />
                    </div>
                  )}

                  {isExpanded && (
                  <div className="p-4 pt-3 space-y-3">
                    {/* Guests */}
                    <div>
                      {/* Guest tabs */}
                      <div className="flex items-center gap-1 mb-3">
                        {(room.guests || []).map((g, gi) => (
                          <button key={gi} onClick={() => setActiveGuestTab(prev => ({ ...prev, [ri]: gi }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                              (activeGuestTab[ri] || 0) === gi
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-500 hover:bg-neutral-100'
                            }`}>
                            {g.firstName && g.lastName ? `${g.firstName} ${g.lastName}` : g.firstName || `Guest ${gi + 1}`}
                          </button>
                        ))}
                        {(room.guests || []).length < 3 && (
                          <button onClick={() => {
                            const next = JSON.parse(JSON.stringify(ed));
                            if (!next.rooms[ri].guests) next.rooms[ri].guests = [];
                            next.rooms[ri].guests.push({ firstName: '', lastName: '', email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' });
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${room.roomNumber}: guest ${next.rooms[ri].guests.length} added`, user: 'Sophie' });
                            setEditingReservation(next);
                            setActiveGuestTab(prev => ({ ...prev, [ri]: next.rooms[ri].guests.length - 1 }));
                          }} className="w-7 h-7 rounded-lg border border-dashed border-neutral-300 hover:border-neutral-400 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M12 5v14M5 12h14"/></svg>
                          </button>
                        )}
                      </div>
                      {/* Active guest form */}
                      {(() => {
                        const gi = activeGuestTab[ri] || 0;
                        const g = (room.guests || [])[gi];
                        if (!g) return null;
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-medium text-neutral-400">Guest {gi + 1}{gi === 0 ? ' (primary)' : ''}</div>
                                {g.firstName && g.lastName && (() => {
                                  const gName = `${g.firstName} ${g.lastName}`.trim();
                                  const isSaved = guestRegistry.some(gr => gr.firstName === g.firstName && gr.lastName === g.lastName);
                                  return isSaved ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                  ) : (
                                    <button onClick={() => {
                                      const newId = Math.max(0, ...guestRegistry.map(gr => gr.id)) + 1;
                                      guestRegistry.push({ id: newId, firstName: g.firstName, lastName: g.lastName, email: g.email || '', phone: g.phone || '', nationality: g.nationality || 'NL', idType: g.idType || '', idNumber: g.idNumber || '' });
                                      saveGuestRegistry();
                                      setToastMessage(`${gName} saved to guest registry`);
                                      setEditingReservation({ ...ed }); // trigger re-render
                                    }} className="text-neutral-400 hover:text-blue-600 transition-colors" title="Save to guest registry">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                    </button>
                                  );
                                })()}
                              </div>
                              {gi > 0 && (
                                <button onClick={() => {
                                  const next = JSON.parse(JSON.stringify(ed));
                                  const removed = next.rooms[ri].guests[gi];
                                  const gName = `${removed.firstName || ''} ${removed.lastName || ''}`.trim() || `Guest ${gi+1}`;
                                  next.rooms[ri].guests.splice(gi, 1);
                                  next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${room.roomNumber}: guest removed (${gName})`, user: 'Sophie' });
                                  setEditingReservation(next);
                                  setActiveGuestTab(prev => ({ ...prev, [ri]: Math.max(0, gi - 1) }));
                                }} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                              <input value={g.firstName || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.firstName`, e.target.value)}
                                onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+1} first name`)}
                                placeholder="First name"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="relative">
                                <input value={g.lastName || ''} onChange={(e) => {
                                    updateEd(`rooms.${ri}.guests.${gi}.lastName`, e.target.value);
                                    setGuestSearchActive({ ri, gi });
                                  }}
                                  onFocus={(e) => { onFocusTrack(e); if (!g.firstName && !g.email && !g.phone) setGuestSearchActive({ ri, gi }); }}
                                  onBlur={(e) => { onBlurLog(`Room ${room.roomNumber} guest ${gi+1} last name`)(e); setTimeout(() => setGuestSearchActive(null), 200); }}
                                  placeholder="Last name"
                                  className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                {guestSearchActive && guestSearchActive.ri === ri && guestSearchActive.gi === gi && g.lastName && g.lastName.length >= 2 && (() => {
                                  const matches = guestRegistry.filter(gr =>
                                    gr.lastName.toLowerCase().includes(g.lastName.toLowerCase()) &&
                                    !(gr.firstName === g.firstName && gr.lastName === g.lastName)
                                  ).slice(0, 4);
                                  if (matches.length === 0) return null;
                                  return (
                                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                      {matches.map(gr => (
                                        <button key={gr.id} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                          const next = JSON.parse(JSON.stringify(ed));
                                          const guest = next.rooms[ri].guests[gi];
                                          guest.firstName = gr.firstName; guest.lastName = gr.lastName;
                                          guest.email = gr.email; guest.phone = gr.phone;
                                          guest.nationality = gr.nationality; guest.idType = gr.idType; guest.idNumber = gr.idNumber;
                                          setEditingReservation(next);
                                          setGuestSearchActive(null);
                                        }}
                                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                          <span className="font-medium text-neutral-900">{gr.firstName} {gr.lastName}</span>
                                          <span className="text-neutral-400">{gr.email || gr.phone || gr.nationality}</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                              <input type="email" value={g.email || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.email`, e.target.value)}
                                placeholder="Email"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="flex gap-1.5">
                                <input type="tel" value={g.phone || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.phone`, e.target.value)}
                                  placeholder="Phone"
                                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                {g.phone && (
                                  <a href={`https://wa.me/${g.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                                    title="Chat via WhatsApp"
                                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex-shrink-0">
                                    <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <select value={g.nationality || 'NL'} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.nationality`, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                                {['NL','BE','DE','FR','GB','US','IT','ES','PT','AT','CH','DK','SE','NO','PL','CZ'].map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <select value={g.idType || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.idType`, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                                <option value="">ID type...</option>
                                <option value="passport">Passport</option>
                                <option value="id-card">ID Card</option>
                                <option value="drivers-license">Driver's License</option>
                              </select>
                              <input value={g.idNumber || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.idNumber`, e.target.value)}
                                placeholder="ID number"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Housekeeping Note */}
                    <div>
                      <textarea value={room.housekeepingNote || ''} onChange={(e) => updateEd(`rooms.${ri}.housekeepingNote`, e.target.value)}
                        placeholder="Housekeeping notes..."
                        rows="1"
                        className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none" />
                    </div>

                  </div>
                  )}
                </div>
              ); })}
              </div>
              )}

              {/* Unified Extras Table (shown in both views) */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden border-l-4 border-l-neutral-300">
                <div className="px-4 pt-3 pb-2">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Extras</div>
                </div>
                <div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50/80">
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-16">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-20">Room</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-16">VAT %</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider w-28">Unit Price</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider w-28">Total</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ed.extras || []).map((extra, ei) => (
                        <tr key={extra.id} className="border-b border-neutral-100 last:border-0">
                          <td className="px-3 py-1.5">
                            <input type="number" min="1" value={extra.quantity} onChange={(e) => {
                              let newQty = parseInt(e.target.value) || 1;
                              const cat = extrasCatalog.find(c => c.name === extra.name);
                              if (cat && !cat.multipleBookable) {
                                const guests = ed.guestCount || 1;
                                const ci = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
                                const co = ed.rooms?.[0] ? new Date(ed.rooms[0].checkout) : new Date(ed.checkout);
                                const nights = Math.max(1, Math.round((co - ci) / 86400000));
                                let autoMax = 1;
                                if (cat.perPerson && cat.perNight) autoMax = guests * nights;
                                else if (cat.perPerson) autoMax = guests;
                                else if (cat.perNight) autoMax = nights;
                                newQty = Math.min(newQty, Math.max(1, autoMax));
                              }
                              const next = JSON.parse(JSON.stringify(ed));
                              next.extras[ei].quantity = newQty;
                              setEditingReservation(next);
                            }} className="w-12 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                          </td>
                          <td className="px-3 py-1.5 text-xs text-neutral-900 font-medium">{extra.name}</td>
                          <td className="px-3 py-1.5">
                            <select value={extra.room || ''} onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.extras[ei].room = e.target.value || null;
                              setEditingReservation(next);
                            }} className="w-full px-1 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent">
                              <option value="">-</option>
                              {ed.rooms.map(rm => (
                                <option key={rm.roomNumber} value={rm.roomNumber}>{rm.roomNumber}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <select value={extra.vatRate} onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.extras[ei].vatRate = parseInt(e.target.value);
                              setEditingReservation(next);
                            }} className="w-full px-1 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent">
                              {vatRates.map(vr => <option key={vr.id} value={vr.rate}>{vr.rate}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="relative inline-block">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">€</span>
                              <input type="number" step="0.01" min="0" value={extra.unitPrice} onChange={(e) => {
                                const next = JSON.parse(JSON.stringify(ed));
                                next.extras[ei].unitPrice = parseFloat(e.target.value) || 0;
                                setEditingReservation(next);
                              }} className="w-20 pl-6 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs font-medium text-neutral-900">
                            €{((extra.quantity || 0) * (extra.unitPrice || 0)).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const removed = next.extras[ei];
                              next.extras.splice(ei, 1);
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Extra removed: ${removed.name}`, user: 'Sophie' });
                              setEditingReservation(next);
                            }} className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center transition-colors">
                              <Icons.X className="w-3 h-3 text-neutral-400 hover:text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Add row */}
                      <tr className="border-t border-neutral-200 bg-white">
                        <td className="px-3 py-1.5">
                          <input type="number" min="1" value="1" id="newExtraQty" className="w-12 px-2 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                        </td>
                        <td className="px-3 py-1.5" colSpan="3">
                          <select id="newExtraName" defaultValue="" onChange={(e) => {
                            if (!e.target.value) return;
                            if (inventoryPendingRef.current) { e.target.value = ''; return; }
                            const cat = extrasCatalog.find(c => c.name === e.target.value);
                            const qtyEl = document.getElementById('newExtraQty');
                            let qty = parseInt(qtyEl?.value) || 1;

                            // Auto-calculate quantity based on catalog flags
                            if (cat) {
                              const guests = ed.guestCount || 1;
                              const ci = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
                              const co = ed.rooms?.[0] ? new Date(ed.rooms[0].checkout) : new Date(ed.checkout);
                              const nights = Math.max(1, Math.round((co - ci) / 86400000));
                              let autoQty = 1;
                              if (cat.perPerson && cat.perNight) autoQty = guests * nights;
                              else if (cat.perPerson) autoQty = guests;
                              else if (cat.perNight) autoQty = nights;
                              // Use auto-qty if user hasn't manually changed from default
                              if (qty === 1 && autoQty > 1) qty = autoQty;
                              // Cap if not multipleBookable
                              if (!cat.multipleBookable && qty > Math.max(1, autoQty)) qty = Math.max(1, autoQty);

                              // Daily inventory check — show popup if any night is full
                              if (cat.dailyInventory && cat.dailyInventoryLimit > 0) {
                                const ci2 = new Date(ci); ci2.setHours(0,0,0,0);
                                const co2 = new Date(co); co2.setHours(0,0,0,0);
                                const nightsInfo = [];
                                let hasFullNight = false;
                                for (let d = new Date(ci2); d < co2; d.setDate(d.getDate() + 1)) {
                                  let dayCount = 0;
                                  // Count extras from OTHER reservations
                                  reservations.forEach(r => {
                                    if (r.id === ed.id) return;
                                    const st = r.reservationStatus || 'confirmed';
                                    if (st === 'cancelled' || st === 'no-show' || st === 'blocked') return;
                                    const rCi = new Date(r.checkin); rCi.setHours(0,0,0,0);
                                    const rCo = new Date(r.checkout); rCo.setHours(0,0,0,0);
                                    if (d >= rCi && d < rCo) {
                                      const rNights = Math.max(1, Math.round((rCo - rCi) / 86400000));
                                      (r.extras || []).forEach(ex => {
                                        if (ex.name === cat.name) {
                                          dayCount += cat.perNight ? Math.round(ex.quantity / rNights) : ex.quantity;
                                        }
                                      });
                                    }
                                  });
                                  // Also count extras already on the CURRENT reservation
                                  const edNights = Math.max(1, Math.round((co2 - ci2) / 86400000));
                                  (ed.extras || []).forEach(ex => {
                                    if (ex.name === cat.name) {
                                      dayCount += cat.perNight ? Math.round(ex.quantity / edNights) : ex.quantity;
                                    }
                                  });
                                  const full = dayCount >= cat.dailyInventoryLimit;
                                  if (full) hasFullNight = true;
                                  nightsInfo.push({
                                    date: new Date(d).toISOString().slice(0, 10),
                                    label: new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
                                    used: dayCount,
                                    limit: cat.dailyInventoryLimit,
                                    full,
                                  });
                                }
                                if (hasFullNight) {
                                  // Show popup — pre-select only available nights
                                  inventoryPendingRef.current = true;
                                  const preSelected = new Set(nightsInfo.map((n, i) => !n.full ? i : null).filter(i => i !== null));
                                  setInventorySelected(preSelected);
                                  setInventoryPopup({ catName: cat.name, nights: nightsInfo, qty, cat, ci, co });
                                  e.target.value = '';
                                  if (qtyEl) qtyEl.value = '1';
                                  return; // Don't add yet — user decides in popup
                                }
                              }
                            }

                            // Add extra directly (no inventory issues)
                            const next = JSON.parse(JSON.stringify(ed));
                            const newId = (next.extras || []).reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
                            next.extras = next.extras || [];
                            const extraName = cat ? cat.name : e.target.value;
                            const ci = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
                            next.extras.push({
                              id: newId,
                              name: extraName,
                              quantity: qty,
                              room: null,
                              vatRate: cat ? cat.defaultVat : (vatRates[0]?.rate ?? 6),
                              unitPrice: cat ? getExtraPrice(cat, ci) : 0
                            });
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Extra added: ${extraName} x${qty}`, user: 'Sophie' });
                            setEditingReservation(next);
                            e.target.value = '';
                            if (qtyEl) qtyEl.value = '1';
                          }} className="w-full px-2 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent cursor-pointer">
                            <option value="" disabled>+ Add extra...</option>
                            {extrasCatalog.map(c => {
                              const ci = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
                              const price = getExtraPrice(c, ci);
                              return <option key={c.name} value={c.name}>{c.name} {price > 0 ? `(€${price})` : ''}</option>;
                            })}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs text-neutral-400">€</td>
                        <td className="px-3 py-1.5"></td>
                        <td className="px-2 py-1.5"></td>
                      </tr>
                    </tbody>
                    {(ed.extras || []).length > 0 && (
                      <tfoot>
                        <tr className="bg-neutral-100">
                          <td colSpan="5" className="px-3 py-1.5 text-xs font-medium text-neutral-900">Extras Total</td>
                          <td className="px-3 py-1.5 text-right text-xs font-bold text-neutral-900">
                            €{(ed.extras || []).reduce((s, ex) => s + (ex.quantity || 0) * (ex.unitPrice || 0), 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Add Room — with date pickers + availability check */}
              {(() => {
                const allRoomNumbers = getAllRooms();
                const usedRooms = ed.rooms.map(r => r.roomNumber);

                const addCi = addRoomDates.checkin ? new Date(addRoomDates.checkin) : null;
                const addCo = addRoomDates.checkout ? new Date(addRoomDates.checkout) : null;
                const validDates = addCi && addCo && addCo > addCi;

                // Check availability: not in this reservation AND not occupied by other reservations
                const flatEntries = buildFlatRoomEntries(reservations);
                const availableRooms = validDates ? allRoomNumbers.filter(rm => {
                  if (usedRooms.includes(rm)) return false;
                  return !flatEntries.some(r => {
                    if (r.room !== rm) return false;
                    if (r.id === reservation.id) return false;
                    const st = r.reservationStatus || 'confirmed';
                    if (st === 'cancelled' || st === 'no-show') return false;
                    const rCi = new Date(r.checkin);
                    const rCo = new Date(r.checkout);
                    return rCi < addCo && rCo > addCi;
                  });
                }) : [];

                return (
                  <div ref={addRoomRef} className="bg-white border border-neutral-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Add rooms</div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <input type="date" value={addRoomDates.checkin} onKeyDown={noTypeDateKey}
                          onChange={(e) => setAddRoomDates(prev => ({ ...prev, checkin: e.target.value }))}
                          className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs w-[105px] focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                        <span className="text-neutral-300">&rarr;</span>
                        <input type="date" value={addRoomDates.checkout} onKeyDown={noTypeDateKey}
                          onChange={(e) => setAddRoomDates(prev => ({ ...prev, checkout: e.target.value }))}
                          className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs w-[105px] focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!validDates ? (
                        <span className="text-xs text-neutral-400">Select valid dates</span>
                      ) : availableRooms.length === 0 ? (
                        <span className="text-xs text-neutral-400">No rooms available for these dates</span>
                      ) : availableRooms.map(rm => (
                        <button key={rm} onClick={() => {
                          const next = JSON.parse(JSON.stringify(ed));
                          const nights = [];
                          for (let d = new Date(addCi); d < addCo; d.setDate(d.getDate() + 1)) {
                            nights.push({ date: d.toISOString().slice(0, 10), amount: 0 });
                          }
                          next.rooms.push({
                            roomNumber: rm, roomType: 'Standard',
                            status: 'confirmed',
                            guests: [
                              { firstName: ed.booker.firstName || '', lastName: ed.booker.lastName || '', email: ed.booker.email || '', phone: ed.booker.phone || '', nationality: 'NL', idType: '', idNumber: '' },
                              { firstName: '', lastName: '', email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' }
                            ],
                            checkin: addCi.toISOString(),
                            checkout: addCo.toISOString(),
                            priceType: 'fixed', fixedPrice: 0,
                            nightPrices: nights,
                            housekeeping: 'clean', housekeepingNote: '', optionExpiry: null,
                            roomLocked: false, roomLockedReason: ''
                          });
                          next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${rm} added (${addRoomDates.checkin} → ${addRoomDates.checkout})`, user: 'Sophie' });
                          setEditingReservation(next);
                          setToastMessage(`Room ${rm} added`);
                          setTimeout(() => { addRoomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 50);
                        }}
                          className="px-3 py-1.5 text-xs font-medium border border-dashed border-neutral-300 rounded-lg hover:border-neutral-900 hover:bg-neutral-50 hover:text-neutral-900 text-neutral-400 transition-all">
                          + {rm}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Print invoice helper */}
          {(() => {
            window._printInvoice = (inv, ed, payments) => {
              const r = inv.recipient || {};
              const invPayments = (payments || []).filter(p => (inv.linkedPayments || []).includes(p.id));
              const invPaid = invPayments.reduce((s, p) => s + p.amount, 0);
              const isCredit = inv.type === 'credit';
              const vatGroups = {};
              (inv.items || []).forEach(item => {
                const rate = item.vatRate || 0;
                if (!vatGroups[rate]) vatGroups[rate] = { net: 0, vat: 0, gross: 0 };
                const gross = item.amount;
                const net = gross / (1 + rate / 100);
                vatGroups[rate].gross += gross;
                vatGroups[rate].net += net;
                vatGroups[rate].vat += gross - net;
              });
              const checkIn = reservation.checkin ? new Date(reservation.checkin).toLocaleDateString('en-GB') : '';
              const checkOut = reservation.checkout ? new Date(reservation.checkout).toLocaleDateString('en-GB') : '';
              const cur = hotelSettings.currency || 'EUR';
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.number}</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; max-width: 700px; margin: 0 auto; padding: 20mm; }
.header { display: flex; justify-content: space-between; margin-bottom: 40px; }
.hotel { font-size: 18pt; font-weight: 300; letter-spacing: 2px; font-family: Georgia, serif; }
.hotel-details { font-size: 8pt; color: #666; margin-top: 4px; }
.invoice-title { text-align: right; }
.invoice-title h2 { font-size: 14pt; font-weight: 600; color: ${isCredit ? '#dc2626' : '#1a1a1a'}; }
.invoice-title .inv-num { font-size: 11pt; color: #666; }
.meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
.meta-block { font-size: 9pt; }
.meta-block .label { color: #999; text-transform: uppercase; font-size: 7pt; letter-spacing: 1px; margin-bottom: 2px; }
.meta-block .value { color: #1a1a1a; }
table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
th:last-child { text-align: right; }
td { padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 9pt; }
td:last-child { text-align: right; font-weight: 500; }
.item-detail { font-size: 8pt; color: #999; }
.totals { margin-left: auto; width: 250px; }
.totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 9pt; }
.totals .row.total { border-top: 2px solid #1a1a1a; font-weight: 600; font-size: 11pt; margin-top: 4px; padding-top: 8px; }
.totals .row.vat { color: #666; font-size: 8pt; }
.payments { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; }
.payments h3 { font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
.pay-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 3px 0; }
.pay-method { color: #666; }
.due { color: #d97706; font-weight: 600; }
.footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 7pt; color: #999; padding: 10px 20mm; border-top: 1px solid #f0f0f0; }
.ref { font-size: 8pt; color: #999; margin-top: 20px; }
@media print { button { display: none !important; } }
</style></head><body>
<div class="header">
<div>
  <div class="hotel">${(hotelSettings.hotelName || 'Hotel').split(' ')[0].toUpperCase()}</div>
  <div class="hotel-details">${hotelSettings.hotelName || ''}<br>${hotelSettings.hotelAddress || ''}<br>BTW ${hotelSettings.hotelVat || ''}<br>${hotelSettings.hotelEmail || ''} · ${hotelSettings.hotelPhone || ''}</div>
</div>
<div class="invoice-title">
  <h2>${isCredit ? 'CREDIT NOTE' : inv.type === 'proforma' ? 'PROFORMA' : 'INVOICE'}</h2>
  <div class="inv-num">${inv.number}</div>
  ${inv.creditFor ? '<div style="font-size:8pt;color:#999;">Credit for ' + inv.creditFor + '</div>' : ''}
  ${inv.amendsInvoice ? '<div style="font-size:8pt;color:#999;">Amends ' + inv.amendsInvoice + '</div>' : ''}
</div>
</div>
<div class="meta">
<div class="meta-block">
  <div class="label">Bill to</div>
  <div class="value" style="font-weight:500;">${r.name || '—'}</div>
  ${r.vatNumber ? '<div class="value">' + r.vatNumber + '</div>' : ''}
  ${r.address ? '<div class="value">' + r.address + '</div>' : ''}
  ${r.zip || r.city ? '<div class="value">' + [r.zip, r.city].filter(Boolean).join(' ') + '</div>' : ''}
  ${r.country ? '<div class="value">' + r.country + '</div>' : ''}
  ${r.email ? '<div class="value" style="color:#666;">' + r.email + '</div>' : ''}
</div>
<div class="meta-block" style="text-align:right;">
  <div class="label">Date</div>
  <div class="value">${inv.date}</div>
  <div class="label" style="margin-top:8px;">Stay</div>
  <div class="value">${checkIn} — ${checkOut}</div>
  <div class="label" style="margin-top:8px;">Booking Ref</div>
  <div class="value">${ed.bookingRef || '—'}</div>
  ${inv.reference ? '<div class="label" style="margin-top:8px;">Your Reference</div><div class="value">' + inv.reference + '</div>' : ''}
</div>
</div>
<table>
<thead><tr><th>Description</th><th>VAT</th><th style="text-align:right;">Amount</th></tr></thead>
<tbody>
  ${(inv.items || []).map(item => '<tr><td>' + item.label + (item.detail ? '<div class="item-detail">' + item.detail + '</div>' : '') + '</td><td>' + (item.vatRate || 0) + '%</td><td>' + cur + ' ' + item.amount.toFixed(2) + '</td></tr>').join('')}
</tbody>
</table>
<div class="totals">
${Object.entries(vatGroups).map(([rate, g]) => '<div class="row vat"><span>Net (' + rate + '% VAT)</span><span>' + cur + ' ' + g.net.toFixed(2) + '</span></div><div class="row vat"><span>VAT ' + rate + '%</span><span>' + cur + ' ' + g.vat.toFixed(2) + '</span></div>').join('')}
<div class="row total"><span>Total</span><span>${cur} ${inv.amount.toFixed(2)}</span></div>
</div>
${invPayments.length > 0 ? '<div class="payments"><h3>Payments</h3>' + invPayments.map(p => '<div class="pay-row"><span class="pay-method">' + p.method + ' · ' + p.date + '</span><span>' + cur + ' ' + p.amount.toFixed(2) + '</span></div>').join('') + (invPaid < inv.amount && !isCredit ? '<div class="pay-row due"><span>Amount due</span><span>' + cur + ' ' + (inv.amount - invPaid).toFixed(2) + '</span></div>' : '') + '</div>' : ''}
<div class="ref">Booking ref: ${ed.bookingRef || '—'}${ed.otaRef ? ' · OTA ref: ' + ed.otaRef : ''}</div>
<div class="footer">${hotelSettings.hotelName || ''} · ${hotelSettings.hotelAddress || ''} · ${hotelSettings.hotelVat || ''}</div>
</body></html>`;
              let iframe = document.getElementById('_printFrame');
              if (!iframe) { iframe = document.createElement('iframe'); iframe.id = '_printFrame'; iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;'; document.body.appendChild(iframe); }
              iframe.contentDocument.open();
              iframe.contentDocument.write(html);
              iframe.contentDocument.close();
              setTimeout(() => iframe.contentWindow.print(), 300);
            };
            return null;
          })()}

          {/* ===== TAB 3: BILLING ===== */}
          {reservationTab === 'billing' && (() => {
            // Compute billable items from rooms + extras
            const nights = ed.rooms[0] ? ed.rooms[0].nightPrices.length : 0;
            const billableItems = [];
            ed.rooms.forEach((room, i) => {
              const amount = room.priceType === 'fixed' ? (room.fixedPrice || 0) : room.nightPrices.reduce((s, n) => s + (n.amount || 0), 0);
              const roomNights = room.nightPrices ? room.nightPrices.length : nights;
              const roomCi = room.checkin ? new Date(room.checkin) : reservation.checkin;
              const roomCo = room.checkout ? new Date(room.checkout) : reservation.checkout;
              const dateRange = roomCi && roomCo ? `${formatDate(roomCi)} → ${formatDate(roomCo)}` : '';
              billableItems.push({ key: `room-${i}`, type: 'room', label: `Room ${room.roomNumber}`, detail: `${room.roomType} · ${roomNights} night${roomNights !== 1 ? 's' : ''} · ${dateRange}`, amount, vatRate: hotelSettings.defaultRoomVat });
            });
            (ed.extras || []).forEach(ex => {
              const amount = (ex.quantity || 0) * (ex.unitPrice || 0);
              if (amount > 0) billableItems.push({ key: `extra-${ex.id}`, type: 'extra', label: ex.name, detail: `${ex.quantity} × EUR ${ex.unitPrice}${ex.room ? ` · Room ${ex.room}` : ''}`, amount, vatRate: ex.vatRate });
            });

            // Which items are on active (non-credited, non-proforma) invoices?
            const invoicedKeys = new Set();
            (ed.invoices || []).forEach(inv => {
              if (inv.status !== 'credited' && inv.type !== 'proforma' && inv.type !== 'credit' && inv.items) inv.items.forEach(item => invoicedKeys.add(item.key));
            });
            const uninvoicedItems = billableItems.filter(item => !invoicedKeys.has(item.key));

            // Selection logic: null = all selected
            const effectiveSelection = billSelected !== null
              ? billSelected.filter(k => uninvoicedItems.some(i => i.key === k))
              : uninvoicedItems.map(i => i.key);
            const selectedItems = uninvoicedItems.filter(i => effectiveSelection.includes(i.key));
            const selectedTotal = selectedItems.reduce((s, i) => s + i.amount, 0);
            const allSelected = effectiveSelection.length === uninvoicedItems.length && uninvoicedItems.length > 0;

            const activeInvoices = (ed.invoices || []).filter(inv => inv.type !== 'credit');
            const creditNotes = (ed.invoices || []).filter(inv => inv.type === 'credit');

            const toggleItem = (key) => {
              const newSel = effectiveSelection.includes(key) ? effectiveSelection.filter(k => k !== key) : [...effectiveSelection, key];
              setBillSelected(newSel);
            };
            const toggleAll = () => setBillSelected(allSelected ? [] : uninvoicedItems.map(i => i.key));

            const createInvoice = (type, quick, checkout) => {
              if (selectedItems.length === 0) return;
              const prefix = type === 'proforma' ? 'PRO' : 'INV';
              const invNum = `${prefix}-${10000000 + Math.floor(Math.random() * 9000000)}`;
              const invoiceItems = selectedItems.map(i => ({ key: i.key, label: billCustomLabels[i.key] || i.label, detail: i.detail, amount: i.amount, vatRate: i.vatRate }));
              const next = JSON.parse(JSON.stringify(ed));
              // Link payments: skip for proformas (concept, no payment linking)
              const linkedPays = [];
              if (type !== 'proforma') {
                if (quick) {
                  next.payments.forEach(p => {
                    if (p.status === 'completed' && !p.linkedInvoice) { p.linkedInvoice = invNum; linkedPays.push(p.id); }
                  });
                } else {
                  billPaySelected.forEach(payId => {
                    const p = next.payments.find(pp => pp.id === payId);
                    if (p && !p.linkedInvoice) { p.linkedInvoice = invNum; linkedPays.push(payId); }
                  });
                }
              }
              // Build recipient: use override if set, else fall back to billingRecipient
              let recipient;
              if (billRecipientOverride) {
                const o = billRecipientOverride;
                recipient = o.type === 'company'
                  ? { name: o.name, vatNumber: o.vatNumber, peppolId: o.peppolId, address: o.address, zip: o.zip, city: o.city, country: o.country, email: o.email }
                  : { name: o.name || `${next.booker?.firstName || ''} ${next.booker?.lastName || ''}`.trim(), vatNumber: '', peppolId: '', address: o.address || '', zip: o.zip || '', city: o.city || '', country: o.country || '', email: o.email || next.booker?.email || '' };
              } else {
                const br = next.billingRecipient || {};
                recipient = br.type === 'company'
                  ? { name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email }
                  : { name: `${next.booker?.firstName || ''} ${next.booker?.lastName || ''}`.trim(), vatNumber: '', peppolId: '', address: br.address || '', zip: br.zip || '', city: br.city || '', country: br.country || '', email: next.booker?.email || '' };
              }
              const invoiceRef = (next.billingRecipient?.reference || '').trim();
              next.invoices.push({ id: Date.now(), number: invNum, date: new Date().toISOString().split('T')[0], amount: selectedTotal, type, status: 'created', items: invoiceItems, linkedPayments: linkedPays, recipient, reference: invoiceRef || '' });
              next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `${type === 'proforma' ? 'Proforma' : 'Invoice'} ${invNum} created (EUR ${selectedTotal}, ${selectedItems.length} items)${linkedPays.length > 0 ? ` — ${linkedPays.length} payment(s) linked` : ''}`, user: 'Sophie' });
              // Optional: check out all rooms
              if (checkout) {
                (next.rooms || []).forEach(r => { r.status = 'checked-out'; });
                next.reservationStatus = 'checked-out';
                next.activityLog.push({ id: Date.now() + 2, timestamp: Date.now(), action: 'Checked out (via quick invoice)', user: 'Sophie' });
              }
              setEditingReservation(next);
              setBillSelected(null);
              setBillSplitMode(false);
              setBillPaySelected([]);
              setBillRecipientOverride(null);
              setBillCustomLabels({});
              setToastMessage(checkout ? `Invoice created & checked out` : `${type === 'proforma' ? 'Proforma' : 'Invoice'} created — EUR ${selectedTotal}`);
              if (checkout) showCheckoutWarning(next);
            };

            return (
            <div className="space-y-4">
              {/* Pricing Summary */}
              <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Total</span>
                    <span className="text-sm font-medium text-neutral-900">EUR {totalAmount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Paid</span>
                    <span className="text-sm font-medium text-emerald-600">EUR {paidAmount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Outstanding</span>
                    <span className="text-sm font-medium text-amber-600">EUR {outstandingAmount}</span>
                  </div>
                  {totalAmount > 0 && (
                    <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (paidAmount / totalAmount) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: Invoicing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoices</div>
                    {uninvoicedItems.length === 0 && billableItems.length > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="text-xs">All invoiced</span>
                      </div>
                    )}
                  </div>
                  {/* Uninvoiced Items */}
                  {uninvoicedItems.length > 0 && (
                    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                      {!billSplitMode ? (
                        <>
                          {/* Compact mode — summary */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Uninvoiced</div>
                            <button onClick={() => { setBillSplitMode(true); setBillSelected(null); }}
                              className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors">
                              Split items
                            </button>
                          </div>
                          <div className="text-sm text-neutral-700 mb-1">
                            {uninvoicedItems.filter(i => i.type === 'room').length > 0 && (
                              <span>{uninvoicedItems.filter(i => i.type === 'room').length} room{uninvoicedItems.filter(i => i.type === 'room').length !== 1 ? 's' : ''}</span>
                            )}
                            {uninvoicedItems.filter(i => i.type === 'extra').length > 0 && (
                              <span>{uninvoicedItems.filter(i => i.type === 'room').length > 0 ? ' · ' : ''}{uninvoicedItems.filter(i => i.type === 'extra').length} extra{uninvoicedItems.filter(i => i.type === 'extra').length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                          <div className="text-lg font-light text-neutral-900 mb-3 font-serif">EUR {selectedTotal}</div>
                          <input value={ed.billingRecipient?.reference || ''} onChange={(e) => updateEd('billingRecipient.reference', e.target.value)}
                            placeholder="Reference (PO, cost center...)"
                            className="w-full px-3 py-1.5 mb-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                          <div className="flex gap-2">
                            <button onClick={() => createInvoice('standard', true, true)}
                              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                              Quick invoice and check-out
                            </button>
                            <button onClick={() => createInvoice('proforma', true)}
                              className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                              Proforma
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Split mode — individual items */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Select Items</div>
                            <div className="flex gap-2">
                              {uninvoicedItems.length > 1 && (
                                <button onClick={toggleAll} className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors">
                                  {allSelected ? 'Deselect all' : 'Select all'}
                                </button>
                              )}
                              <button onClick={() => { setBillSplitMode(false); setBillSelected(null); setBillCustomLabels({}); setBillRecipientOverride(null); }}
                                className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors">
                                Done
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {uninvoicedItems.map(item => {
                              const customLabel = billCustomLabels[item.key];
                              const isEditing = customLabel !== undefined;
                              return (
                              <div key={item.key} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                                  effectiveSelection.includes(item.key) ? 'bg-blue-50 border border-blue-200' : 'bg-neutral-50 border border-transparent hover:bg-neutral-100'
                                }`}>
                                <div onClick={() => toggleItem(item.key)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                                  effectiveSelection.includes(item.key) ? 'bg-blue-600 border-blue-600' : 'border-neutral-300'
                                }`}>
                                  {effectiveSelection.includes(item.key) && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {isEditing ? (
                                    <input value={customLabel} onChange={(e) => setBillCustomLabels({ ...billCustomLabels, [item.key]: e.target.value })}
                                      onBlur={() => { if (customLabel === item.label || !customLabel.trim()) setBillCustomLabels(prev => { const n = { ...prev }; delete n[item.key]; return n; }); }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                      className="text-xs font-medium text-neutral-900 bg-transparent border-b border-neutral-300 focus:border-neutral-900 outline-none w-full py-0" autoFocus />
                                  ) : (
                                    <div className="text-xs font-medium text-neutral-900 cursor-text" onClick={() => setBillCustomLabels({ ...billCustomLabels, [item.key]: item.label })}>{item.label}</div>
                                  )}
                                  <div className="text-xs text-neutral-500 cursor-pointer" onClick={() => toggleItem(item.key)}>{item.detail}</div>
                                </div>
                                <div className="text-xs font-medium text-neutral-900 flex-shrink-0 cursor-pointer" onClick={() => toggleItem(item.key)}>EUR {item.amount}</div>
                              </div>
                              );
                            })}
                          </div>
                          {/* Recipient selector */}
                          {(() => {
                            const defaultBr = ed.billingRecipient || {};
                            const defaultLabel = defaultBr.type === 'company' ? defaultBr.name : `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim() || 'Booker';
                            const defaultIcon = defaultBr.type === 'company';
                            const isOverridden = !!billRecipientOverride;
                            const isOtherMode = isOverridden && billRecipientOverride._mode === 'other';
                            // Room main guests (first guest per room), excluding booker
                            const bookerName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim();
                            const roomGuests = (ed.rooms || []).map((room, ri) => {
                              const g = room.guests?.[0];
                              if (!g) return null;
                              const name = `${g.firstName || ''} ${g.lastName || ''}`.trim();
                              if (!name || name === bookerName) return null;
                              return { name, email: g.email || '', roomNumber: room.roomNumber, roomIndex: ri };
                            }).filter(Boolean);
                            // Other mode: search query + matches (companies + bookers)
                            const otherQuery = isOtherMode ? (billRecipientOverride._searchQuery || '') : '';
                            const companyMatches = otherQuery.length >= 1 ? companyRegistry.filter(c =>
                              c.name.toLowerCase().includes(otherQuery.toLowerCase())
                            ).slice(0, 4) : [];
                            const bookerMatches = otherQuery.length >= 1 ? (() => {
                              const seen = new Set();
                              return reservations.filter(r => {
                                const name = `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.trim();
                                if (!name || seen.has(name) || !name.toLowerCase().includes(otherQuery.toLowerCase())) return false;
                                seen.add(name);
                                return true;
                              }).slice(0, 3).map(r => ({ name: `${r.booker.firstName} ${r.booker.lastName}`.trim(), email: r.booker.email || '', phone: r.booker.phone || '' }));
                            })() : [];
                            const hasMatches = (companyMatches.length > 0 || bookerMatches.length > 0) && !billRecipientOverride.companyId && !billRecipientOverride._bookerId;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-100">
                                <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">Invoice to</div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* 1: Default recipient */}
                                  <button onClick={() => setBillRecipientOverride(null)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${!isOverridden ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                                    {defaultIcon ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    )}
                                    {defaultLabel}
                                  </button>
                                  {/* 2: Other (search company/individual) */}
                                  <button onClick={() => setBillRecipientOverride(isOtherMode ? null : { _mode: 'other', _searchQuery: '', type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '' })}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isOtherMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    Other
                                  </button>
                                  {/* 3: Room main guests (not booker) */}
                                  {roomGuests.map(rg => {
                                    const isActive = isOverridden && !isOtherMode && billRecipientOverride._guestRoom === rg.roomNumber;
                                    return (
                                      <button key={rg.roomNumber} onClick={() => setBillRecipientOverride({ _mode: 'guest', _guestRoom: rg.roomNumber, type: 'individual', companyId: null, name: rg.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: rg.email, phone: '' })}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        {rg.name}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Other mode: search + fields */}
                                {isOtherMode && (
                                  <div className="mt-2 space-y-1.5">
                                    <div className="relative">
                                      <input value={otherQuery} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, _searchQuery: e.target.value, name: e.target.value, companyId: null, _bookerId: null, type: 'individual' })}
                                        placeholder="Search company or person..."
                                        className="w-full px-2.5 py-1 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" autoFocus />
                                      {(billRecipientOverride.companyId || billRecipientOverride._bookerId) && (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                      )}
                                      {hasMatches && (
                                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                          {companyMatches.map(c => (
                                            <button key={`c-${c.id}`} onClick={() => setBillRecipientOverride({ _mode: 'other', _searchQuery: c.name, type: 'company', companyId: c.id, name: c.name, vatNumber: c.vatNumber, peppolId: c.peppolId, address: c.address, zip: c.zip, city: c.city, country: c.country, email: c.email, phone: c.phone })}
                                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                              <span className="flex items-center gap-1.5">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                                <span className="font-medium text-neutral-900">{c.name}</span>
                                              </span>
                                              <span className="text-neutral-400">{c.vatNumber}</span>
                                            </button>
                                          ))}
                                          {bookerMatches.map(b => (
                                            <button key={`b-${b.name}`} onClick={() => setBillRecipientOverride({ _mode: 'other', _searchQuery: b.name, _bookerId: b.name, type: 'individual', companyId: null, name: b.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: b.email, phone: b.phone })}
                                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                              <span className="flex items-center gap-1.5">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                <span className="font-medium text-neutral-900">{b.name}</span>
                                              </span>
                                              <span className="text-neutral-400">{b.email}</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* Show address fields for manual entry */}
                                    {!billRecipientOverride.companyId && !billRecipientOverride._bookerId && otherQuery && (
                                      <div className="space-y-1.5">
                                        <input value={billRecipientOverride.email} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, email: e.target.value })}
                                          placeholder="Email" className="w-full px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                        <input value={billRecipientOverride.address} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, address: e.target.value })}
                                          placeholder="Address" className="w-full px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                        <div className="grid grid-cols-3 gap-1.5">
                                          <input value={billRecipientOverride.zip} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, zip: e.target.value })}
                                            placeholder="Zip" className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                          <input value={billRecipientOverride.city} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, city: e.target.value })}
                                            placeholder="City" className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                          <input value={billRecipientOverride.country} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, country: e.target.value })}
                                            placeholder="Country" className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="mt-3 pt-3 border-t border-neutral-100">
                            <input value={ed.billingRecipient?.reference || ''} onChange={(e) => updateEd('billingRecipient.reference', e.target.value)}
                              placeholder="Reference (PO, cost center...)"
                              className="w-full px-3 py-1.5 mb-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            <div className="flex gap-2">
                              <button onClick={() => createInvoice('standard')} disabled={selectedItems.length === 0}
                                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                  selectedItems.length > 0 ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                }`}>
                                Create Invoice · EUR {selectedTotal}
                              </button>
                              <button onClick={() => createInvoice('proforma')} disabled={selectedItems.length === 0}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                  selectedItems.length > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                }`}>
                                Proforma
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Existing Invoices */}
                  {activeInvoices.map(inv => {
                    const invPayments = ed.payments.filter(p => p.linkedInvoice === inv.number);
                    const invPaid = invPayments.reduce((s, p) => s + p.amount, 0);
                    return (
                      <div key={inv.id}
                        onDragOver={inv.status !== 'credited' && inv.status !== 'finalized' ? (e) => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 0 0 2px #3b82f6'; } : undefined}
                        onDragLeave={inv.status !== 'credited' && inv.status !== 'finalized' ? (e) => { e.currentTarget.style.boxShadow = ''; } : undefined}
                        onDrop={inv.status !== 'credited' && inv.status !== 'finalized' ? (e) => {
                          e.preventDefault();
                          e.currentTarget.style.boxShadow = '';
                          const payId = dragPaymentRef.current;
                          if (!payId) return;
                          dragPaymentRef.current = null;
                          const next = JSON.parse(JSON.stringify(ed));
                          const p = next.payments.find(pp => pp.id === payId);
                          if (p && p.linkedInvoice !== inv.number) {
                            // Unlink from old invoice if reassigning
                            if (p.linkedInvoice) {
                              const oldInv = next.invoices.find(ii => ii.number === p.linkedInvoice);
                              if (oldInv && oldInv.linkedPayments) oldInv.linkedPayments = oldInv.linkedPayments.filter(id => id !== payId);
                            }
                            p.linkedInvoice = inv.number;
                            const invObj = next.invoices.find(ii => ii.id === inv.id);
                            if (invObj) { if (!invObj.linkedPayments) invObj.linkedPayments = []; invObj.linkedPayments.push(payId); }
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `EUR ${p.amount} linked to ${inv.number}`, user: 'Sophie' });
                            setEditingReservation(next);
                            setToastMessage(`EUR ${p.amount} linked to ${inv.number}`);
                          }
                        } : undefined}
                        className={`bg-white border rounded-2xl overflow-hidden transition-shadow ${inv.status === 'credited' || inv.status === 'finalized' ? 'border-neutral-200 opacity-60' : inv.type === 'proforma' ? 'border-amber-200' : 'border-neutral-200'}`}>
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${inv.type === 'proforma' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {inv.type === 'proforma' ? 'PRO' : 'INV'}
                            </span>
                            <span className="text-xs font-medium text-neutral-900">{inv.number}</span>
                            {inv.status === 'credited' && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Credited</span>}
                            {inv.status === 'finalized' && <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Finalized</span>}
                            {inv.amendsInvoice && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Amends {inv.amendsInvoice}</span>}
                            {inv.fromProforma && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">From {inv.fromProforma}</span>}
                          </div>
                          <div className="text-xs text-neutral-500">{inv.date}</div>
                        </div>
                        {/* Recipient */}
                        {inv.recipient && inv.recipient.name && (
                          <div className="px-4 py-1.5 border-t border-neutral-50 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              {inv.recipient.vatNumber ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 flex-shrink-0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 flex-shrink-0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              )}
                              <span>{inv.recipient.name}</span>
                              {inv.recipient.vatNumber && <span className="text-neutral-400">· {inv.recipient.vatNumber}</span>}
                            </div>
                          </div>
                        )}
                        {/* Items */}
                        {inv.items && inv.items.length > 0 && (
                          <div className="px-4 py-2 border-t border-neutral-50 space-y-0.5">
                            {inv.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs py-0.5">
                                <div>
                                  <span className="text-neutral-700">{item.label}</span>
                                  {item.detail && <span className="text-neutral-400 ml-1.5">{item.detail}</span>}
                                </div>
                                <span className="text-neutral-900 font-medium flex-shrink-0 ml-3">EUR {item.amount}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Total + linked payments */}
                        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100">
                          <div className="flex justify-between text-xs font-medium">
                            <span>Total</span>
                            <span>EUR {inv.amount}</span>
                          </div>
                          {invPayments.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {invPayments.map(p => (
                                <div key={p.id} className="flex justify-between text-xs text-emerald-600">
                                  <span>{p.method} · {p.date}</span>
                                  <span>EUR {p.amount}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {inv.status !== 'credited' && invPaid < inv.amount && (
                            <div className="flex justify-between text-xs text-amber-600 font-medium mt-1 pt-1 border-t border-neutral-200">
                              <span>Due</span>
                              <span>EUR {inv.amount - invPaid}</span>
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="px-4 py-2 flex flex-wrap gap-1 border-t border-neutral-100">
                          <button onClick={() => window._printInvoice(inv, ed, ed.payments)}
                            className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs hover:bg-neutral-200 transition-colors">Print</button>
                          {/* Email dropdown */}
                          {(() => {
                            const emailId = `invEmail_${inv.id}`;
                            const emails = [];
                            if (inv.recipient?.email) emails.push({ label: inv.recipient.name || 'Recipient', email: inv.recipient.email });
                            if (ed.booker?.email && !emails.some(e => e.email === ed.booker.email)) emails.push({ label: `${ed.booker.firstName || ''} ${ed.booker.lastName || ''}`.trim() || 'Booker', email: ed.booker.email });
                            (ed.rooms || []).forEach(room => {
                              const g = room.guests?.[0];
                              if (g?.email && !emails.some(e => e.email === g.email)) emails.push({ label: `${g.firstName || ''} ${g.lastName || ''}`.trim() || `Room ${room.roomNumber}`, email: g.email });
                            });
                            if (inv.recipient?.vatNumber && ed.billingRecipient?.email && !emails.some(e => e.email === ed.billingRecipient.email)) emails.push({ label: 'Billing contact', email: ed.billingRecipient.email });
                            return (
                              <div className="relative inline-flex items-center">
                                <select id={emailId} className="pl-2 pr-5 py-1 bg-neutral-100 text-neutral-600 rounded text-xs hover:bg-neutral-200 transition-colors appearance-none cursor-pointer focus:outline-none"
                                  onChange={(e) => {
                                    const email = e.target.value;
                                    if (!email) return;
                                    addToActivityLog(`${inv.number} emailed to ${email}`);
                                    setToastMessage(`${inv.number} emailed to ${email}`);
                                    e.target.selectedIndex = 0;
                                  }}>
                                  <option value="">Email</option>
                                  {emails.map((r, i) => <option key={i} value={r.email}>{r.label} ({r.email})</option>)}
                                </select>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                              </div>
                            );
                          })()}
                          {/* Peppol — only for real company invoices (not proformas) */}
                          {inv.type !== 'proforma' && inv.recipient?.vatNumber && (() => {
                            const ps = inv.peppolStatus;
                            const hasPeppol = !!inv.recipient?.peppolId;
                            const psClass = ps === 'delivered' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : ps === 'error' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200';
                            const psTitle = ps === 'delivered' ? 'Delivered via Peppol'
                              : ps === 'error' ? `Peppol delivery failed\n\nRecipient ${inv.recipient?.peppolId || '—'} could not be reached.\nThe access point did not respond or rejected the document.\n\nRetry or verify the Peppol ID.`
                              : hasPeppol ? `Send via Peppol to ${inv.recipient.peppolId}` : 'No Peppol ID — edit recipient to add one';
                            return (
                              <button onClick={() => {
                                if (ps === 'delivered') return;
                                if (!hasPeppol) { setToastMessage('No Peppol ID — edit recipient to add one'); return; }
                                const next = JSON.parse(JSON.stringify(ed));
                                const invObj = next.invoices.find(ii => ii.id === inv.id);
                                const newStatus = Math.random() < 0.7 ? 'delivered' : 'error';
                                if (invObj) invObj.peppolStatus = newStatus;
                                next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `${inv.number} sent via Peppol — ${newStatus === 'delivered' ? 'delivered' : 'delivery failed'}`, user: 'Sophie' });
                                setEditingReservation(next);
                                setToastMessage(newStatus === 'delivered' ? `Delivered via Peppol to ${inv.recipient.peppolId}` : 'Peppol delivery failed — recipient unreachable');
                              }}
                                title={psTitle}
                                className={`px-2 py-1 rounded text-xs transition-colors ${psClass}`}>
                                Peppol
                              </button>
                            );
                          })()}
                          {/* Proforma actions: Finalize + Delete */}
                          {inv.type === 'proforma' && inv.status !== 'credited' && inv.status !== 'finalized' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const invObj = next.invoices.find(ii => ii.id === inv.id);
                              if (!invObj) return;
                              // Archive the proforma
                              invObj.status = 'finalized';
                              // Create a real invoice with the same items + recipient
                              const newInvNum = `INV-${10000000 + Math.floor(Math.random() * 9000000)}`;
                              next.invoices.push({ id: Date.now(), number: newInvNum, date: new Date().toISOString().split('T')[0], amount: inv.amount, type: 'invoice', status: 'created', items: inv.items ? inv.items.map(i => ({ ...i })) : [], linkedPayments: [], recipient: inv.recipient ? { ...inv.recipient } : null, reference: inv.reference || '', fromProforma: inv.number });
                              // Unlink any payments from the proforma (user links them manually to the new invoice)
                              invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                              next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Proforma ${inv.number} finalized → invoice ${newInvNum}`, user: 'Sophie' });
                              setEditingReservation(next);
                              setBillSelected(null);
                              setToastMessage(`Proforma finalized — invoice ${newInvNum} created`);
                            }}
                              className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs hover:bg-emerald-100 transition-colors">Finalize</button>
                          )}
                          {inv.type === 'proforma' && inv.status !== 'credited' && inv.status !== 'finalized' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.invoices = next.invoices.filter(ii => ii.id !== inv.id);
                              // Unlink any payments linked to this proforma
                              invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Proforma ${inv.number} deleted`, user: 'Sophie' });
                              setEditingReservation(next);
                              setBillSelected(null);
                              setToastMessage(`Proforma ${inv.number} deleted`);
                            }}
                              className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition-colors">Delete</button>
                          )}
                          {/* Invoice actions: Credit + Amend (not for proformas) */}
                          {inv.type !== 'proforma' && inv.status !== 'credited' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const invObj = next.invoices.find(ii => ii.id === inv.id);
                              if (invObj) invObj.status = 'credited';
                              const creditNum = `CN-${10000000 + Math.floor(Math.random() * 9000000)}`;
                              next.invoices.push({ id: Date.now(), number: creditNum, date: new Date().toISOString().split('T')[0], amount: inv.amount, type: 'credit', status: 'created', items: inv.items || [], linkedPayments: [], creditFor: inv.number, recipient: inv.recipient ? { ...inv.recipient } : null, reference: inv.reference || '' });
                              // Unlink payments from credited invoice — return to unlinked pool
                              invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                              if (invObj) invObj.linkedPayments = [];
                              next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Credit note ${creditNum} for ${inv.number} — items released`, user: 'Sophie' });
                              setEditingReservation(next);
                              setBillSelected(null);
                              setToastMessage('Credit note created — items available for re-invoicing');
                            }}
                              className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition-colors">Credit</button>
                          )}
                          {inv.type !== 'proforma' && inv.status !== 'credited' && (
                            <button onClick={() => { setAmendingInvoice(amendingInvoice === inv.id ? null : inv.id); setAmendRecipient(null); }}
                              className={`px-2 py-1 rounded text-xs transition-colors ${amendingInvoice === inv.id ? 'bg-amber-200 text-amber-800' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>Amend</button>
                          )}
                        </div>
                        {/* Amend panel: recipient picker */}
                        {amendingInvoice === inv.id && (() => {
                          const currentRcpt = inv.recipient || {};
                          const defaultBr = ed.billingRecipient || {};
                          const defaultLabel = defaultBr.type === 'company' ? defaultBr.name : `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim() || 'Booker';
                          const defaultIcon = defaultBr.type === 'company';
                          const isOriginal = !amendRecipient;
                          const isOtherMode = amendRecipient && amendRecipient._mode === 'other';
                          const bookerName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim();
                          const roomGuests = (ed.rooms || []).map((room, ri) => {
                            const g = room.guests?.[0];
                            if (!g) return null;
                            const name = `${g.firstName || ''} ${g.lastName || ''}`.trim();
                            if (!name || name === bookerName) return null;
                            return { name, email: g.email || '', roomNumber: room.roomNumber, roomIndex: ri };
                          }).filter(Boolean);
                          const otherQuery = isOtherMode ? (amendRecipient._searchQuery || '') : '';
                          const companyMatches = otherQuery.length >= 1 ? companyRegistry.filter(c => c.name.toLowerCase().includes(otherQuery.toLowerCase())).slice(0, 4) : [];
                          const bookerMatches = otherQuery.length >= 1 ? (() => {
                            const seen = new Set();
                            return reservations.filter(r => {
                              const name = `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.trim();
                              if (!name || seen.has(name) || !name.toLowerCase().includes(otherQuery.toLowerCase())) return false;
                              seen.add(name); return true;
                            }).slice(0, 3).map(r => ({ name: `${r.booker.firstName} ${r.booker.lastName}`.trim(), email: r.booker.email || '', phone: r.booker.phone || '' }));
                          })() : [];
                          const hasMatches = (companyMatches.length > 0 || bookerMatches.length > 0) && amendRecipient && !amendRecipient.companyId && !amendRecipient._bookerId;

                          const doAmend = () => {
                            const next = JSON.parse(JSON.stringify(ed));
                            const invObj = next.invoices.find(ii => ii.id === inv.id);
                            if (!invObj) return;
                            // 1. Credit the original
                            invObj.status = 'credited';
                            const creditNum = `CN-${10000000 + Math.floor(Math.random() * 9000000)}`;
                            next.invoices.push({ id: Date.now(), number: creditNum, date: new Date().toISOString().split('T')[0], amount: inv.amount, type: 'credit', status: 'created', items: inv.items || [], linkedPayments: [], creditFor: inv.number, recipient: inv.recipient ? { ...inv.recipient } : null, reference: inv.reference || '' });
                            // Unlink payments from credited invoice
                            invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                            // 2. Build new recipient
                            let newRecipient;
                            if (amendRecipient) {
                              const o = amendRecipient;
                              newRecipient = o.type === 'company'
                                ? { name: o.name, vatNumber: o.vatNumber, peppolId: o.peppolId, address: o.address, zip: o.zip, city: o.city, country: o.country, email: o.email }
                                : { name: o.name || bookerName, vatNumber: '', peppolId: '', address: o.address || '', zip: o.zip || '', city: o.city || '', country: o.country || '', email: o.email || '' };
                            } else {
                              newRecipient = inv.recipient ? { ...inv.recipient } : null;
                            }
                            // 3. Create amended invoice with same items
                            const newInvNum = `INV-${10000000 + Math.floor(Math.random() * 9000000)}`;
                            next.invoices.push({ id: Date.now() + 2, number: newInvNum, date: new Date().toISOString().split('T')[0], amount: inv.amount, type: 'invoice', status: 'created', items: inv.items ? inv.items.map(i => ({ ...i })) : [], linkedPayments: [], recipient: newRecipient, reference: inv.reference || '', amendsInvoice: inv.number });
                            // Re-link payments to new invoice
                            invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = newInvNum; });
                            next.activityLog.push({ id: Date.now() + 3, timestamp: Date.now(), action: `Amended ${inv.number} → credit note ${creditNum} + new invoice ${newInvNum}${amendRecipient ? ` (recipient: ${newRecipient?.name || 'unknown'})` : ''}`, user: 'Sophie' });
                            setEditingReservation(next);
                            setAmendingInvoice(null);
                            setAmendRecipient(null);
                            setBillSelected(null);
                            setToastMessage(`Invoice amended — ${creditNum} + ${newInvNum} created`);
                          };

                          return (
                            <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                              <div className="text-xs font-medium text-amber-700 mb-2">Amend {inv.number} — select new recipient</div>
                              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                {/* Keep original */}
                                <button onClick={() => setAmendRecipient(null)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isOriginal ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                  {currentRcpt.vatNumber ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                  ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                  )}
                                  {currentRcpt.name || 'Original'}
                                </button>
                                {/* Default billing recipient (if different) */}
                                {defaultLabel !== currentRcpt.name && (
                                  <button onClick={() => {
                                    const br = ed.billingRecipient || {};
                                    setAmendRecipient(br.type === 'company'
                                      ? { _mode: 'default', type: 'company', companyId: br.companyId, name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email, phone: br.phone }
                                      : { _mode: 'default', type: 'individual', companyId: null, name: bookerName, vatNumber: '', peppolId: '', address: br.address || '', zip: br.zip || '', city: br.city || '', country: br.country || '', email: ed.booker?.email || '', phone: '' });
                                  }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${amendRecipient?._mode === 'default' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                    {defaultIcon ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    )}
                                    {defaultLabel}
                                  </button>
                                )}
                                {/* Other (search) */}
                                <button onClick={() => setAmendRecipient(isOtherMode ? null : { _mode: 'other', _searchQuery: '', type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '' })}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isOtherMode ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                  Other
                                </button>
                                {/* Room guests */}
                                {roomGuests.map(rg => {
                                  const isActive = amendRecipient && amendRecipient._mode === 'guest' && amendRecipient._guestRoom === rg.roomNumber;
                                  return (
                                    <button key={rg.roomNumber} onClick={() => setAmendRecipient({ _mode: 'guest', _guestRoom: rg.roomNumber, type: 'individual', companyId: null, name: rg.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: rg.email, phone: '' })}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                      {rg.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Other mode: search + fields */}
                              {isOtherMode && (
                                <div className="space-y-1.5 mb-2">
                                  <div className="relative">
                                    <input value={otherQuery} onChange={(e) => setAmendRecipient({ ...amendRecipient, _searchQuery: e.target.value, name: e.target.value, companyId: null, _bookerId: null, type: 'individual' })}
                                      placeholder="Search company or person..."
                                      className="w-full px-2.5 py-1 pr-7 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" autoFocus />
                                    {(amendRecipient.companyId || amendRecipient._bookerId) && (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    )}
                                    {hasMatches && (
                                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                        {companyMatches.map(c => (
                                          <button key={`c-${c.id}`} onClick={() => setAmendRecipient({ _mode: 'other', _searchQuery: c.name, type: 'company', companyId: c.id, name: c.name, vatNumber: c.vatNumber, peppolId: c.peppolId, address: c.address, zip: c.zip, city: c.city, country: c.country, email: c.email, phone: c.phone })}
                                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                              <span className="font-medium text-neutral-900">{c.name}</span>
                                            </span>
                                            <span className="text-neutral-400">{c.vatNumber}</span>
                                          </button>
                                        ))}
                                        {bookerMatches.map(b => (
                                          <button key={`b-${b.name}`} onClick={() => setAmendRecipient({ _mode: 'other', _searchQuery: b.name, _bookerId: b.name, type: 'individual', companyId: null, name: b.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: b.email, phone: b.phone })}
                                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                              <span className="font-medium text-neutral-900">{b.name}</span>
                                            </span>
                                            <span className="text-neutral-400">{b.email}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {!amendRecipient.companyId && !amendRecipient._bookerId && otherQuery && (
                                    <div className="space-y-1.5">
                                      <input value={amendRecipient.email} onChange={(e) => setAmendRecipient({ ...amendRecipient, email: e.target.value })}
                                        placeholder="Email" className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                      <input value={amendRecipient.address} onChange={(e) => setAmendRecipient({ ...amendRecipient, address: e.target.value })}
                                        placeholder="Address" className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                      <div className="grid grid-cols-3 gap-1.5">
                                        <input value={amendRecipient.zip} onChange={(e) => setAmendRecipient({ ...amendRecipient, zip: e.target.value })}
                                          placeholder="Zip" className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                        <input value={amendRecipient.city} onChange={(e) => setAmendRecipient({ ...amendRecipient, city: e.target.value })}
                                          placeholder="City" className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                        <input value={amendRecipient.country} onChange={(e) => setAmendRecipient({ ...amendRecipient, country: e.target.value })}
                                          placeholder="Country" className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button onClick={doAmend}
                                  className="flex-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
                                  {isOriginal ? 'Amend (keep recipient)' : `Amend → ${amendRecipient?.name || 'new recipient'}`}
                                </button>
                                <button onClick={() => { setAmendingInvoice(null); setAmendRecipient(null); }}
                                  className="px-3 py-1.5 bg-white text-neutral-500 rounded-lg text-xs font-medium hover:bg-neutral-100 border border-neutral-200 transition-colors">Cancel</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}

                  {/* Credit Notes */}
                  {creditNotes.length > 0 && creditNotes.map(cn => (
                    <div key={cn.id} className="bg-red-50 border border-red-200 rounded-2xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-neutral-900 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">CN</span>
                            {cn.number}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">EUR {cn.amount} · {cn.date} · Credits {cn.creditFor}</div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => window._printInvoice(cn, ed, ed.payments)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">Print</button>
                          <button onClick={() => { addToActivityLog(`${cn.number} emailed to ${cn.recipient?.email || 'booker'}`); setToastMessage(`${cn.number} emailed to ${cn.recipient?.email || 'booker'}`); }}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">Email</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* RIGHT: Payments */}
                <div className="space-y-4 md:sticky md:top-4 md:self-start">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Payments</div>
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                {/* Payments List */}
                <div className="p-4">
                  <div className="space-y-2">
                    {ed.payments.map((payment) => {
                      const canLink = payment.status === 'completed' && !payment.linkedInvoice;
                      const canReassign = payment.status === 'completed' && payment.linkedInvoice && activeInvoices.filter(inv => inv.status !== 'credited' && inv.number !== payment.linkedInvoice).length > 0;
                      const canDrag = (canLink || canReassign) && activeInvoices.some(inv => inv.status !== 'credited');
                      const canCheck = canLink && billSplitMode && uninvoicedItems.length > 0;
                      const isPayChecked = billPaySelected.includes(payment.id);
                      return (
                      <div key={payment.id}
                        draggable={(canDrag || canReassign) && !canCheck}
                        onDragStart={(canDrag || canReassign) && !canCheck ? (e) => { dragPaymentRef.current = payment.id; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.style.opacity = '0.5'; } : undefined}
                        onDragEnd={(canDrag || canReassign) && !canCheck ? (e) => { dragPaymentRef.current = null; e.currentTarget.style.opacity = '1'; } : undefined}
                        onClick={canCheck ? () => setBillPaySelected(prev => prev.includes(payment.id) ? prev.filter(id => id !== payment.id) : [...prev, payment.id]) : undefined}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                        payment.status === 'pending' ? 'bg-amber-50 border border-amber-200' :
                        payment.status === 'request-sent' ? 'bg-blue-50 border border-blue-200' :
                        isPayChecked ? 'bg-emerald-50 border border-emerald-200' : 'bg-white'
                      } ${canCheck ? 'cursor-pointer' : (canDrag || canReassign) ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                        <div className="flex items-center gap-3">
                          {canCheck ? (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isPayChecked ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-300'
                            }`}>
                              {isPayChecked && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                          ) : (canDrag || canReassign) ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-neutral-400 flex-shrink-0"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                          ) : null}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            payment.status === 'pending' ? 'bg-amber-100' :
                            payment.status === 'request-sent' ? 'bg-blue-100' : 'bg-emerald-50'
                          }`}>
                            {payment.status === 'pending' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ) : payment.status === 'request-sent' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            ) : (
                              <Icons.CreditCard className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-neutral-900">
                              {payment.method}
                              {payment.status === 'pending' && <span className="ml-1 text-amber-600">(pending)</span>}
                              {payment.status === 'request-sent' && <span className="ml-1 text-blue-600">(request sent)</span>}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {payment.date}{payment.note ? ` — ${payment.note}` : ''}
                              {payment.linkedInvoice && <span className="ml-1 text-blue-600">({payment.linkedInvoice})</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-xs font-medium ${
                            payment.status === 'pending' ? 'text-amber-700' :
                            payment.status === 'request-sent' ? 'text-blue-700' : 'text-emerald-700'
                          }`}>
                            {payment.status === 'pending' || payment.status === 'request-sent' ? '' : '+ '}EUR {payment.amount}
                          </div>
                          {payment.status === 'pending' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const p = next.payments.find(pp => pp.id === payment.id);
                              if (p) { p.status = 'completed'; }
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Terminal payment EUR ${payment.amount} confirmed`, user: 'Sophie' });
                              setEditingReservation(next);
                              setToastMessage('Payment confirmed');
                            }}
                              className="px-2 py-0.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                              Confirm
                            </button>
                          )}
                          <button onClick={() => {
                            const next = JSON.parse(JSON.stringify(ed));
                            next.payments = next.payments.filter(pp => pp.id !== payment.id);
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Payment deleted: EUR ${payment.amount} (${payment.method})`, user: 'Sophie' });
                            setEditingReservation(next);
                            setToastMessage('Payment deleted');
                          }}
                            className="w-5 h-5 rounded hover:bg-red-100 flex items-center justify-center transition-colors" title="Delete payment">
                            <Icons.X className="w-3 h-3 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                    {ed.payments.length === 0 && (
                      <div className="text-xs text-neutral-400 text-center py-3">No payments yet</div>
                    )}
                  </div>
                </div>

                {/* Add Payment */}
                <div className="p-4 border-t border-neutral-100">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Add Payment</div>
                  <div className="flex gap-1 mb-3">
                    <button onClick={() => updateEd('_paymentMode', 'terminal')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                        (ed._paymentMode || 'terminal') === 'terminal' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                      Via terminal
                    </button>
                    <button onClick={() => updateEd('_paymentMode', 'email')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                        ed._paymentMode === 'email' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Via e-mail
                    </button>
                    <button onClick={() => updateEd('_paymentMode', 'manual')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                        ed._paymentMode === 'manual' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}>Add manually</button>
                    {(() => {
                      const bookerCard = bookerProfiles.find(bp => (bp.email && bp.email === ed.booker?.email) || (bp.firstName === ed.booker?.firstName && bp.lastName === ed.booker?.lastName))?.creditCard;
                      const companyCard = ed.billingRecipient?.companyId ? companyProfiles.find(c => c.id === ed.billingRecipient.companyId)?.creditCard : null;
                      const card = bookerCard || companyCard;
                      if (!card) return null;
                      return (
                        <button onClick={() => updateEd('_paymentMode', 'creditcard')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                            ed._paymentMode === 'creditcard' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                          }`}>
                          <Icons.CreditCard className="w-3 h-3" />
                          {'•••• ' + card.last4}
                        </button>
                      );
                    })()}
                  </div>

                  {(ed._paymentMode || 'terminal') === 'terminal' && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                        <input type="number" id="terminalAmount" key={`term-${outstandingAmount}`} defaultValue={outstandingAmount}
                          className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      </div>
                      <button onClick={() => {
                        const amount = parseFloat(document.getElementById('terminalAmount').value) || 0;
                        if (amount <= 0) return;
                        const next = JSON.parse(JSON.stringify(ed));
                        next.payments.push({ id: Date.now(), date: new Date().toISOString().split('T')[0], amount, method: 'Terminal', note: 'Sent to terminal', status: 'pending', linkedInvoice: null });
                        next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Terminal payment request EUR ${amount}`, user: 'Sophie' });
                        setEditingReservation(next);
                        setToastMessage(`EUR ${amount} sent to terminal`);
                      }}
                        className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap">
                        Send
                      </button>
                    </div>
                  )}

                  {ed._paymentMode === 'email' && (() => {
                    // Collect all possible recipients with email addresses
                    const emailRecipients = [];
                    if (ed.booker?.email) {
                      emailRecipients.push({ label: `${ed.booker.firstName || ''} ${ed.booker.lastName || ''}`.trim() + ' (booker)', email: ed.booker.email });
                    }
                    ed.rooms.forEach((room) => {
                      room.guests.forEach((g) => {
                        if (g.email && g.email !== ed.booker?.email) {
                          emailRecipients.push({ label: `${g.firstName || ''} ${g.lastName || ''}`.trim() + ` (room ${room.roomNumber})`, email: g.email });
                        }
                      });
                    });
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <select id="emailRecipient" className="w-full px-2 py-1.5 pr-7 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                              {emailRecipients.length > 0 ? emailRecipients.map((r, i) => (
                                <option key={i} value={r.email}>{r.label} — {r.email}</option>
                              )) : (
                                <option value="">No email addresses available</option>
                              )}
                            </select>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                            <input type="number" id="emailAmount" key={`email-${outstandingAmount}`} defaultValue={outstandingAmount}
                              className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                          </div>
                          <button onClick={() => {
                            const amount = parseFloat(document.getElementById('emailAmount').value) || 0;
                            const recipientEl = document.getElementById('emailRecipient');
                            const recipientEmail = recipientEl?.value;
                            if (amount <= 0 || !recipientEmail) return;
                            const next = JSON.parse(JSON.stringify(ed));
                            next.payments.push({ id: Date.now(), date: new Date().toISOString().split('T')[0], amount, method: 'Email Request', note: `Sent to ${recipientEmail}`, status: 'request-sent', linkedInvoice: null });
                            // Auto-create reminder 24h from now to check payment
                            const reminderDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                            if (!next.reminders) next.reminders = [];
                            next.reminders.push({ id: Date.now() + 2, message: `Check payment EUR ${amount} (${recipientEmail})`, dueDate: reminderDue, createdAt: Date.now(), fired: false, toastShown: false });
                            next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Email payment request EUR ${amount} sent to ${recipientEmail} — reminder set for 24h`, user: 'Sophie' });
                            setEditingReservation(next);
                            setToastMessage(`EUR ${amount} request sent to ${recipientEmail}`);
                          }}
                            disabled={emailRecipients.length === 0}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${emailRecipients.length > 0 ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}>
                            Send
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {ed._paymentMode === 'creditcard' && (() => {
                    const bookerCard = bookerProfiles.find(bp => (bp.email && bp.email === ed.booker?.email) || (bp.firstName === ed.booker?.firstName && bp.lastName === ed.booker?.lastName))?.creditCard;
                    const companyCard = ed.billingRecipient?.companyId ? companyProfiles.find(c => c.id === ed.billingRecipient.companyId)?.creditCard : null;
                    const card = bookerCard || companyCard;
                    if (!card) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                          <input type="number" id="ccAmount" key={`cc-${outstandingAmount}`} defaultValue={outstandingAmount}
                            className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                        </div>
                        <button onClick={() => {
                          const amount = parseFloat(document.getElementById('ccAmount').value) || 0;
                          if (amount <= 0) return;
                          const next = JSON.parse(JSON.stringify(ed));
                          next.payments.push({ id: Date.now(), date: new Date().toISOString().split('T')[0], amount, method: `Credit Card (•••• ${card.last4})`, note: 'Charged to card on file', status: 'completed', linkedInvoice: null });
                          next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Credit card charge: EUR ${amount} (•••• ${card.last4})`, user: 'Sophie' });
                          setEditingReservation(next);
                          setToastMessage(`EUR ${amount} charged to •••• ${card.last4}`);
                        }}
                          className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap flex items-center gap-1">
                          <Icons.CreditCard className="w-3 h-3" />
                          Charge
                        </button>
                      </div>
                    );
                  })()}

                  {ed._paymentMode === 'manual' && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                        <input type="number" id="paymentAmount" placeholder="0" key={`manual-${outstandingAmount}`} defaultValue={outstandingAmount}
                          className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      </div>
                      <div className="relative">
                        <select id="paymentMethod" defaultValue="Card (PIN)"
                          className="px-2 py-1.5 pr-7 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                          {['Cash', 'Card (PIN)', 'Maestro', 'Mastercard', 'Visa', 'Bank Transfer', 'iDEAL'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      <button onClick={() => {
                        const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
                        if (amount <= 0) return;
                        const method = document.getElementById('paymentMethod').value;
                        const next = JSON.parse(JSON.stringify(ed));
                        next.payments.push({ id: Date.now(), date: new Date().toISOString().split('T')[0], amount, method, note: '', status: 'completed', linkedInvoice: null });
                        next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Payment recorded: EUR ${amount} (${method})`, user: 'Sophie' });
                        setEditingReservation(next);
                        setToastMessage(`EUR ${amount} recorded`);
                        document.getElementById('paymentAmount').value = '';
                      }}
                        className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap">
                        Add
                      </button>
                    </div>
                  )}
                </div>
                </div>
                </div>
              </div>
            </div>
            );
          })()}

          </>)}
        </div>
      </div>

      {/* Inventory Availability Popup */}
      {inventoryPopup && (() => {
        const p = inventoryPopup;
        const availableNights = p.nights.filter(n => !n.full).length;
        const totalNights = p.nights.length;
        const selectedCount = inventorySelected.size;
        // For perNight extras, qty = selected nights. Otherwise use original auto-qty.
        const selectedQty = p.cat?.perNight ? selectedCount : p.qty;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { inventoryPendingRef.current = false; setInventoryPopup(null); }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">{p.catName} — Limited Availability</h3>
                    <p className="text-xs text-neutral-500">{availableNights} of {totalNights} nights available · {selectedCount} selected</p>
                  </div>
                </div>
              </div>

              {/* Night-by-night list */}
              <div className="px-5 pb-3">
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  {p.nights.map((n, i) => {
                    const checked = inventorySelected.has(i);
                    return (
                      <label key={n.date} className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer ${i > 0 ? 'border-t border-neutral-100' : ''} ${n.full ? 'bg-red-50' : checked ? 'bg-emerald-50' : 'bg-white'} hover:bg-neutral-50 transition-colors`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={checked} onChange={() => {
                            setInventorySelected(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            });
                          }} className="rounded border-neutral-300 w-3.5 h-3.5" />
                          <span className={`font-medium ${n.full ? 'text-red-800' : 'text-neutral-700'}`}>{n.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className={`w-16 h-1.5 rounded-full overflow-hidden ${n.full ? 'bg-red-200' : 'bg-neutral-200'}`}>
                              <div className={`h-full rounded-full ${n.full ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (n.used / n.limit) * 100)}%` }} />
                            </div>
                            <span className={`tabular-nums ${n.full ? 'text-red-700 font-semibold' : 'text-neutral-500'}`}>{n.used}/{n.limit}</span>
                          </div>
                          {n.full && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold uppercase">Full</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex items-center justify-between">
                <button onClick={() => {
                  // Select all / deselect all toggle
                  if (selectedCount === totalNights) setInventorySelected(new Set());
                  else setInventorySelected(new Set(p.nights.map((_, i) => i)));
                }} className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors">
                  {selectedCount === totalNights ? 'Deselect all' : 'Select all'}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => { inventoryPendingRef.current = false; setInventoryPopup(null); }}
                    className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button disabled={selectedCount === 0} onClick={() => {
                    inventoryPendingRef.current = false;
                    const next = JSON.parse(JSON.stringify(ed));
                    const newId = (next.extras || []).reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
                    next.extras = next.extras || [];
                    const ciDate = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
                    next.extras.push({
                      id: newId,
                      name: p.catName,
                      quantity: selectedQty,
                      room: null,
                      vatRate: p.cat ? p.cat.defaultVat : (vatRates[0]?.rate ?? 6),
                      unitPrice: p.cat ? getExtraPrice(p.cat, ciDate) : 0,
                    });
                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Extra added: ${p.catName} x${selectedQty}`, user: 'Sophie' });
                    setEditingReservation(next);
                    setInventoryPopup(null);
                  }}
                    className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors ${selectedCount === 0 ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'text-white bg-neutral-900 hover:bg-neutral-800'}`}>
                    Add{selectedCount > 0 ? ` (${selectedQty} ${selectedQty === 1 ? 'night' : 'nights'})` : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};