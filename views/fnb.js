// ── F&B View ────────────────────────────────────────────────────────────────
const FBView = (props) => {
  const { selectedDate, setSelectedDate, fbTab, setFbTab, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation, setPreviousPage } = props;

  const selectedDateMidnight = new Date(selectedDate);
  selectedDateMidnight.setHours(0, 0, 0, 0);

  // Find active reservations for selected date (per room)
  const flatEntries = buildFlatRoomEntries(reservations);
  const sortedReservations = [...flatEntries].sort((a, b) => a.checkin - b.checkin);
  const roomsMap = new Map();
  sortedReservations.forEach(r => {
    const checkinMidnight = new Date(r.checkin);
    checkinMidnight.setHours(0, 0, 0, 0);
    const checkoutMidnight = new Date(r.checkout);
    checkoutMidnight.setHours(0, 0, 0, 0);
    if (checkinMidnight <= selectedDateMidnight && checkoutMidnight >= selectedDateMidnight) {
      if (!roomsMap.has(r.room)) roomsMap.set(r.room, r);
    }
  });

  const activeReservations = Array.from(roomsMap.values()).filter(r => r.guest);

  // Check if reservation has extras with meal flags in catalog
  const hasExtraMeal = (res, mealFlag) => {
    if (!res.extras || res.extras.length === 0) return false;
    return res.extras.some(ex => {
      const cat = extrasCatalog.find(c => c.name === ex.name);
      return cat && cat[mealFlag];
    });
  };

  const breakfastGuests = activeReservations.filter(r => {
    if (r.meals?.breakfast) return true;
    // Show if extras-based breakfast AND rate plan doesn't already include breakfast
    const rp = r._roomData?.ratePlanId && ratePlans.find(p => p.id === r._roomData.ratePlanId);
    if (rp && rp.includesBreakfast) return false;
    return hasExtraMeal(r, 'breakfast');
  });
  const lunchGuests = activeReservations.filter(r => r.meals?.lunch || hasExtraMeal(r, 'lunch'));
  const dinnerGuests = activeReservations.filter(r => r.meals?.dinner || hasExtraMeal(r, 'dinner'));

  const tabs = [
    { id: 'all', label: `All [${activeReservations.length}]`, data: activeReservations },
    { id: 'breakfast', label: `Breakfast [${breakfastGuests.length}]`, data: breakfastGuests },
    { id: 'lunch', label: `Lunch [${lunchGuests.length}]`, data: lunchGuests },
    { id: 'dinner', label: `Dinner [${dinnerGuests.length}]`, data: dinnerGuests },
  ];

  const currentData = tabs.find(t => t.id === fbTab)?.data || [];

  const totalCovers = {
    breakfast: breakfastGuests.reduce((sum, r) => sum + r.guestCount, 0),
    lunch: lunchGuests.reduce((sum, r) => sum + r.guestCount, 0),
    dinner: dinnerGuests.reduce((sum, r) => sum + r.guestCount, 0),
  };

  const getListText = () => {
    const dateStr = selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const tabLabel = tabs.find(t => t.id === fbTab)?.label || 'All';
    let text = `F&B - ${tabLabel} - ${dateStr}\n\n`;
    currentData.forEach(r => {
      const meals = [r.meals?.breakfast && 'B', r.meals?.lunch && 'L', r.meals?.dinner && 'D'].filter(Boolean).join('/');
      text += `Room ${r.room} | ${r.guest} | ${r.guestCount} pax | ${meals}\n`;
    });
    text += `\nTotal: ${currentData.length} rooms, ${currentData.reduce((s, r) => s + r.guestCount, 0)} covers`;
    return text;
  };

  return (
    <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
      <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <nav className="cal-nav">
          <a className="cal-nav-link"><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>
          <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>
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
          <div className="cal-title">
            <h2>F&B</h2>
            <p>Food & Beverages</p>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Print & Email */}
            <button onClick={() => { const w = window.open('', '_blank'); w.document.write('<pre style="font-family:system-ui;font-size:14px;padding:40px">' + getListText() + '</pre>'); w.document.title = 'F&B List'; w.print(); }}
              className="hidden md:flex p-2 hover:bg-neutral-100 rounded-xl transition-colors" title="Print list">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-neutral-600"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <a href={`mailto:?subject=F&B List - ${selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}&body=${encodeURIComponent(getListText())}`}
              className="hidden md:flex p-2 hover:bg-neutral-100 rounded-xl transition-colors" title="Email list">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-neutral-600"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </a>

            <div className="hidden md:block h-8 w-px bg-neutral-200" />

            {/* Date Navigation */}
            <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
              <Icons.ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <div className="px-3 py-1.5 md:px-6 md:py-2 bg-neutral-100 rounded-xl">
              <span className="text-sm md:text-lg font-medium text-neutral-900">
                {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
              <Icons.ChevronRight className="w-5 h-5 text-neutral-600" />
            </button>
            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1.5 md:px-4 md:py-2 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors text-xs md:text-sm">
              Today
            </button>
          </div>
        </div>

        {/* Cover Summary */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold text-neutral-900">{totalCovers.breakfast}</div>
            <div className="text-[11px] md:text-xs font-medium text-amber-700 uppercase tracking-wider mt-1">Breakfast</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold text-neutral-900">{totalCovers.lunch}</div>
            <div className="text-[11px] md:text-xs font-medium text-orange-700 uppercase tracking-wider mt-1">Lunch</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold text-neutral-900">{totalCovers.dinner}</div>
            <div className="text-[11px] md:text-xs font-medium text-indigo-700 uppercase tracking-wider mt-1">Dinner</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 md:mb-6 flex flex-wrap gap-2 md:gap-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setFbTab(tab.id)}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-xl transition-all duration-200 ${
                fbTab === tab.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Guest List */}
        <div className="space-y-3">
          {currentData.map(res => (
            <div key={res.id} onClick={() => { setPreviousPage(activePage); setSelectedReservation(res); }}
              className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow duration-200 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-6 min-w-0">
                  <div className="text-lg md:text-xl font-medium text-neutral-900 w-12 md:w-16 flex-shrink-0 font-serif">{res.room}</div>
                  <div className="h-10 w-px bg-neutral-200 hidden md:block" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900 truncate">{res.guest}</div>
                    <div className="text-xs text-neutral-500 truncate">{res.guestCount} {res.guestCount === 1 ? 'guest' : 'guests'} · {formatDate(res.checkin)} - {formatDate(res.checkout)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  {(() => {
                    const mealFlag = res.meals?.breakfast;
                    const extrasBreakfast = hasExtraMeal(res, 'breakfast');
                    if (!mealFlag && !extrasBreakfast) return null;
                    const rp = res._roomData?.ratePlanId && ratePlans.find(p => p.id === res._roomData.ratePlanId);
                    const included = rp && rp.includesBreakfast;
                    return <span className={`px-2 md:px-3 py-1 rounded-lg text-[11px] md:text-xs font-medium border ${included ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-50 text-amber-700 border-amber-200'}`} title={included ? `Included in ${rp.name}` : extrasBreakfast ? 'Breakfast (extra)' : 'Breakfast'}>{included ? 'B incl.' : 'B'}</span>;
                  })()}
                  {(res.meals?.lunch || hasExtraMeal(res, 'lunch')) && (
                    <span className="px-2 md:px-3 py-1 bg-orange-50 text-orange-700 rounded-lg text-[11px] md:text-xs font-medium border border-orange-200">L</span>
                  )}
                  {(res.meals?.dinner || hasExtraMeal(res, 'dinner')) && (
                    <span className="px-2 md:px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] md:text-xs font-medium border border-indigo-200">D</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};
