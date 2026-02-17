// ── Calendar View ─────────────────────────────────────────────────────────────
const CalendarView = (props) => {
  const { selectedDate, setSelectedDate, calDatePickerOpen, setCalDatePickerOpen, calendarActiveFilter, setCalendarActiveFilter, calColWidth, setCalColWidth, calViewMode, setCalViewMode, sidebarCollapsed, setSidebarCollapsed, setActivePage, activePage, setSelectedReservation, setNewReservationOpen, setToastMessage, housekeepingStatus, setPreviousPage, toggleCheckInOut } = props;

    const dayNames = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];
    const todayDate = new Date();

    // Build flat room entries: 1 entry per room (multi-room reservations exploded)
    const flatEntries = buildFlatRoomEntries(reservations);
    const allRooms = getAllRooms();

    const statusToChip = (res) => {
      if (!res) return null;
      const st = res.reservationStatus || 'confirmed';
      if (st === 'cancelled' || st === 'no-show') return null;
      if (st === 'blocked') return 'blocked';
      if (!res.guest) return null;
      if (st === 'option') return 'option';
      if (st === 'checked-in') return 'checkedin';
      if (st === 'checked-out') return 'checkedout';
      return 'reserved'; // confirmed
    };

    // Week view: 7 days starting Monday; Month view: 30 days starting yesterday
    const getMonday = (d) => { const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day; return addDays(d, diff); };
    const calDaysCount = calViewMode === 'week' ? 7 : 30;
    const calStart = calViewMode === 'week' ? getMonday(selectedDate) : addDays(selectedDate, -1);
    const days = Array.from({length: calDaysCount}, (_, i) => addDays(calStart, i));

    const calGridWrapRef = React.useRef(null);

    // Drag-to-create state (supports multi-room rectangle selection)
    const calDragRef = React.useRef(null);
    const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const getRoomIdx = (room) => allRooms.indexOf(room);

    const isCellOccupied = (roomNum, dayIndex) => {
      const day = days[dayIndex];
      return flatEntries.some(r => {
        if (r.room !== roomNum || !r.checkin || !r.checkout) return false;
        const st = r.reservationStatus || 'confirmed';
        if (st === 'cancelled' || st === 'no-show') return false;
        return r.checkin <= day && r.checkout > day;
      });
    };

    const updateDragHighlight = () => {
      document.querySelectorAll('.cal-select').forEach(el => el.classList.remove('cal-select'));
      const drag = calDragRef.current;
      if (!drag) return;
      const minR = Math.min(drag.startRoomIdx, drag.endRoomIdx);
      const maxR = Math.max(drag.startRoomIdx, drag.endRoomIdx);
      const minD = Math.min(drag.startDayIdx, drag.endDayIdx);
      const maxD = Math.max(drag.startDayIdx, drag.endDayIdx);
      for (let r = minR; r <= maxR; r++) {
        for (let d = minD; d <= maxD; d++) {
          const el = document.querySelector(`[data-cal-cell="${r}-${d}"]`);
          if (el) el.classList.add('cal-select');
        }
      }
    };

    const clearCalDrag = () => {
      calDragRef.current = null;
      document.querySelectorAll('.cal-select').forEach(el => el.classList.remove('cal-select'));
    };

    const startCalDrag = (rIdx, dayIdx) => {
      calDragRef.current = { startRoomIdx: rIdx, endRoomIdx: rIdx, startDayIdx: dayIdx, endDayIdx: dayIdx };
      updateDragHighlight();

      const onMove = (e) => {
        if (!calDragRef.current) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        const cell = el.closest('[data-cal-cell]');
        if (cell) {
          const [rStr, dStr] = cell.getAttribute('data-cal-cell').split('-');
          const r = parseInt(rStr);
          const d = parseInt(dStr);
          if (calDragRef.current.endRoomIdx !== r || calDragRef.current.endDayIdx !== d) {
            calDragRef.current.endRoomIdx = r;
            calDragRef.current.endDayIdx = d;
            updateDragHighlight();
          }
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const drag = calDragRef.current;
        if (!drag) return;
        const minR = Math.min(drag.startRoomIdx, drag.endRoomIdx);
        const maxR = Math.max(drag.startRoomIdx, drag.endRoomIdx);
        const minD = Math.min(drag.startDayIdx, drag.endDayIdx);
        const maxD = Math.max(drag.startDayIdx, drag.endDayIdx);
        const selectedRooms = allRooms.slice(minR, maxR + 1);
        clearCalDrag();
        setNewReservationOpen({
          rooms: selectedRooms,
          room: selectedRooms[0],
          checkin: toISO(days[minD]),
          checkout: toISO(addDays(days[maxD], 1))
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    // Multi-room hover highlight (DOM-based to survive parent re-renders)
    const hoverTimerRef = React.useRef(null);
    const highlightGroup = (resId) => {
      clearTimeout(hoverTimerRef.current);
      const chips = document.querySelectorAll(`[data-res-id="${resId}"]`);
      chips.forEach(el => {
        el.classList.add('res-chip-grouped');
        const cell = el.closest('[data-room-drag]');
        if (cell) {
          const rm = cell.getAttribute('data-room-drag');
          const roomCell = document.querySelector(`.cal-room-cell[data-room-drag="${rm}"]`);
          if (roomCell) roomCell.classList.add('room-grouped');
        }
      });
    };
    const clearGroup = () => {
      hoverTimerRef.current = setTimeout(() => {
        document.querySelectorAll('.res-chip-grouped').forEach(el => el.classList.remove('res-chip-grouped'));
        document.querySelectorAll('.room-grouped').forEach(el => el.classList.remove('room-grouped'));
      }, 80);
    };

    // Room drag & drop: move reservation to another room or swap two reservations
    const [dragActive, setDragActive] = React.useState(false);
    const dragResRef = React.useRef(null);
    const dragRoomRef = React.useRef(null);
    const dropTargetRef = React.useRef(null);

    const handleChipDragStart = (e, res) => {
      dragResRef.current = res.id;
      dragRoomRef.current = res.room;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(res.id));
      // Delay state update to not interfere with drag image capture
      setTimeout(() => setDragActive(true), 0);
    };

    const handleChipDragEnd = () => {
      // Clear highlight from previous target
      document.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
      dragResRef.current = null;
      dragRoomRef.current = null;
      dropTargetRef.current = null;
      setDragActive(false);
    };

    const handleRowDragOver = (e, room) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTargetRef.current !== room) {
        document.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
        dropTargetRef.current = room;
        document.querySelectorAll(`[data-room-drag="${room}"]`).forEach(el => el.classList.add('drag-highlight'));
      }
    };

    const handleRowDrop = (e, targetRoom) => {
      e.preventDefault();
      const resId = dragResRef.current;
      const dragFromRoom = dragRoomRef.current;
      if (resId == null) return;

      // Find the exact flat entry that was dragged (match both id AND room)
      const draggedFlat = flatEntries.find(r => r.id === resId && r.room === dragFromRoom)
        || flatEntries.find(r => r.id === resId);
      const draggedRes = reservations.find(r => r.id === resId);
      if (!draggedRes || !draggedFlat || draggedFlat.room === targetRoom) {
        document.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
        dragResRef.current = null;
        dragRoomRef.current = null;
        dropTargetRef.current = null;
        setDragActive(false);
        return;
      }

      // Check if target room has a reservation overlapping the dragged reservation's dates
      const targetFlat = flatEntries.find(r => {
        if (r.room !== targetRoom || r.id === resId || !r.checkin || !r.checkout) return false;
        const st = r.reservationStatus || 'confirmed';
        if (st === 'cancelled' || st === 'no-show') return false;
        return r.checkin < draggedFlat.checkout && r.checkout > draggedFlat.checkin;
      });
      const targetRes = targetFlat ? reservations.find(r => r.id === targetFlat.id) : null;

      // Determine correct room indices in the rooms[] array
      const draggedRoomIdx = draggedFlat._roomIndex != null ? draggedFlat._roomIndex : 0;
      const targetRoomIdx = targetFlat && targetFlat._roomIndex != null ? targetFlat._roomIndex : 0;

      if (targetRes) {
        // Swap rooms
        const oldRoom = draggedFlat.room;
        draggedRes.room = targetRoom;
        targetRes.room = oldRoom;
        if (draggedRes.rooms && draggedRes.rooms[draggedRoomIdx]) draggedRes.rooms[draggedRoomIdx].roomNumber = targetRoom;
        if (targetRes.rooms && targetRes.rooms[targetRoomIdx]) targetRes.rooms[targetRoomIdx].roomNumber = oldRoom;
        setToastMessage(`Swapped ${draggedRes.guest} ↔ ${targetRes.guest}`);
      } else {
        // Move to empty room
        draggedRes.room = targetRoom;
        if (draggedRes.rooms && draggedRes.rooms[draggedRoomIdx]) draggedRes.rooms[draggedRoomIdx].roomNumber = targetRoom;
        setToastMessage(`Moved ${draggedRes.guest} to room ${targetRoom}`);
      }

      saveReservationSingle(draggedRes);
      document.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
      dragResRef.current = null;
      dragRoomRef.current = null;
      dropTargetRef.current = null;
      setDragActive(false);
    };

    const getChipForCell = (roomNum, dayIndex) => {
      const day = days[dayIndex];
      return flatEntries.find(r => {
        if (r.room !== roomNum || !r.checkin || !r.checkout) return false;
        if (r.checkin.toDateString() === day.toDateString()) return true;
        if (dayIndex === 0 && r.checkin < day && r.checkout > day) return true;
        return false;
      });
    };

    const getChipSpan = (res, dayIndex) => {
      const startDay = days[dayIndex];
      if (!res.checkout) return 1;
      const daysLeft = Math.ceil((res.checkout - startDay) / (1000 * 60 * 60 * 24));
      return Math.min(Math.max(1, daysLeft), calDaysCount - dayIndex);
    };

    // Bereken counts dynamisch op basis van todayDate
    const todayMidnight = new Date(todayDate);
    todayMidnight.setHours(0, 0, 0, 0);

    const counts = {
      all: flatEntries.filter(r => {
        if (!r.guest) return false;
        const checkinMidnight = new Date(r.checkin);
        checkinMidnight.setHours(0, 0, 0, 0);
        const checkoutMidnight = new Date(r.checkout);
        checkoutMidnight.setHours(0, 0, 0, 0);
        return checkinMidnight <= todayMidnight && checkoutMidnight >= todayMidnight;
      }).length,
      reserved: flatEntries.filter(r => {
        const checkinMidnight = new Date(r.checkin);
        checkinMidnight.setHours(0, 0, 0, 0);
        return checkinMidnight.getTime() === todayMidnight.getTime();
      }).length,
      checkedout: flatEntries.filter(r => {
        const checkoutMidnight = new Date(r.checkout);
        checkoutMidnight.setHours(0, 0, 0, 0);
        return checkoutMidnight.getTime() === todayMidnight.getTime();
      }).length,
      checkedin: flatEntries.filter(r => {
        const checkinMidnight = new Date(r.checkin);
        checkinMidnight.setHours(0, 0, 0, 0);
        const checkoutMidnight = new Date(r.checkout);
        checkoutMidnight.setHours(0, 0, 0, 0);
        return checkinMidnight < todayMidnight && checkoutMidnight > todayMidnight;
      }).length,
    };

    const filteredRooms = calendarActiveFilter === 'all'
      ? allRooms
      : allRooms.filter(room => {
          return flatEntries.some(r => {
            if (r.room !== room) return false;

            const checkinMidnight = new Date(r.checkin);
            checkinMidnight.setHours(0, 0, 0, 0);
            const checkoutMidnight = new Date(r.checkout);
            checkoutMidnight.setHours(0, 0, 0, 0);

            if (calendarActiveFilter === 'reserved') {
              return checkinMidnight.getTime() === todayMidnight.getTime();
            } else if (calendarActiveFilter === 'checkedout') {
              return checkoutMidnight.getTime() === todayMidnight.getTime();
            } else if (calendarActiveFilter === 'checkedin') {
              return checkinMidnight < todayMidnight && checkoutMidnight > todayMidnight;
            }
            return false;
          });
        });

    const filterTabs = [
      { id: 'all', label: 'All', count: counts.all },
      { id: 'reserved', label: 'Arriving', count: counts.reserved },
      { id: 'checkedout', label: 'Leaving', count: counts.checkedout },
      { id: 'checkedin', label: 'In-house', count: counts.checkedin },
    ];

    // Mobile blocker for calendar
    if (window.innerWidth < 768) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
            <Icons.Calendar className="w-8 h-8 text-neutral-400" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Calendar view</h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-xs">The calendar view is optimized for desktop. Use the Dashboard for a mobile-friendly overview.</p>
          <button
            onClick={() => setActivePage('dashboard')}
            className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors text-sm"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }

    return (
      <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
        <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-toggle"
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <nav className="cal-nav">
            <a className="cal-nav-link active">
              <Icons.Calendar width="18" height="18" />
              <span>Reservations</span>
            </a>
            {canAccessPage(currentUser?.role, 'channelmanager') && <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg>
              <span>Channel manager</span>
            </a>}
            {canAccessPage(currentUser?.role, 'profiles') && <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}>
              <Icons.Users width="18" height="18" />
              <span>Profiles</span>
            </a>}
            {canAccessPage(currentUser?.role, 'payments') && <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}>
              <Icons.CreditCard width="18" height="18" />
              <span>Payments</span>
            </a>}
            {canAccessPage(currentUser?.role, 'reports') && <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>Reports</span>
            </a>}
            {canAccessPage(currentUser?.role, 'settings') && <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>Settings</span>
            </a>}
          </nav>
          <div className="cal-nav-user">
            <div className="relative">
              <button onClick={() => props.setUserMenuOpen(prev => !prev)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 hover:bg-neutral-100 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                  style={{ backgroundColor: currentUser?.color || '#6b7280' }}>
                  {currentUser?.name?.split(' ').map(n => n[0]).join('') || '?'}
                </div>
                {!sidebarCollapsed && <span className="text-xs text-neutral-600 truncate">{currentUser?.name?.split(' ')[0]}</span>}
              </button>
              {props.userMenuOpen && (<>
                <div className="fixed inset-0 z-[49]" onClick={() => props.setUserMenuOpen(false)} />
                <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-[50]">
                  <div className="px-3 py-2 border-b border-neutral-100">
                    <div className="text-sm font-medium text-neutral-900">{currentUser?.name}</div>
                    <div className="text-[11px] text-neutral-400 capitalize">{currentUser?.role}</div>
                  </div>
                  <button onClick={props.handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </div>
              </>)}
            </div>
          </div>
          <div className="cal-nav-footer">
            {!sidebarCollapsed && (
              <>
                Rumo &copy;<br/>All Rights Reserved
              </>
            )}
          </div>
        </aside>
        <div className="cal-view">
        <div className="flex items-center justify-between pl-5 pr-[93px] py-2.5 border-b border-neutral-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {filterTabs.map(tab => (
                <button key={tab.id}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200 ${
                    calendarActiveFilter === tab.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                  onClick={() => setCalendarActiveFilter(tab.id)}>
                  {tab.label} {tab.id !== 'all' && <span className={`ml-0.5 ${calendarActiveFilter === tab.id ? 'text-white/70' : 'text-neutral-400'}`}>({tab.count})</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 pr-4 border-r border-neutral-200" style={{
              transition: 'max-width 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease, transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
              maxWidth: calViewMode === 'month' ? '220px' : '0px',
              opacity: calViewMode === 'month' ? 1 : 0,
              transform: calViewMode === 'month' ? 'translateX(0)' : 'translateX(12px)',
              overflow: 'hidden',
              borderColor: calViewMode === 'month' ? '' : 'transparent',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400" style={{flexShrink:0}}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input type="range" min="60" max="250" value={calColWidth} onChange={(e) => setCalColWidth(Number(e.target.value))}
                className="w-40 h-1 accent-neutral-800" title={`Column width: ${calColWidth}px`} />
            </div>
            <div className="relative flex bg-neutral-100 rounded-lg p-0.5" style={{minWidth: '106px'}}>
              <div className="absolute top-0.5 bottom-0.5 bg-white rounded-md shadow-sm" style={{
                width: 'calc(50% - 2px)',
                left: calViewMode === 'week' ? '2px' : 'calc(50%)',
                transition: 'left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
              <button onClick={() => { setCalViewMode('week'); try { localStorage.setItem(lsKey('calViewMode'), 'week'); } catch(e) {} }}
                className="relative z-10 px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-200"
                style={{ color: calViewMode === 'week' ? '#171717' : '#737373', flex: 1 }}>
                Week
              </button>
              <button onClick={() => { setCalViewMode('month'); try { localStorage.setItem(lsKey('calViewMode'), 'month'); } catch(e) {} }}
                className="relative z-10 px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-200"
                style={{ color: calViewMode === 'month' ? '#171717' : '#737373', flex: 1 }}>
                Month
              </button>
            </div>
          <div className="cal-date-nav" style={{ marginBottom: 0, position: 'relative' }}>
            <button className="cal-nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="cal-date-display mini-picker-nav" onClick={() => setCalDatePickerOpen(!calDatePickerOpen)}
              style={{ padding: '4px 8px', borderRadius: '8px', color: '#111827', fontWeight: 500, fontSize: '0.875rem' }}>
              {calViewMode === 'week'
                ? (() => {
                    const mon = getMonday(selectedDate);
                    const sun = addDays(mon, 6);
                    const sameMonth = mon.getMonth() === sun.getMonth();
                    return sameMonth
                      ? `${mon.getDate()} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                  })()
                : selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </button>
            {calDatePickerOpen && (() => {
              const pickerDate = new Date(selectedDate);
              const year = pickerDate.getFullYear();
              const month = pickerDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const prevMonthDays = new Date(year, month, 0).getDate();
              const startOffset = firstDay === 0 ? 6 : firstDay - 1;
              const cells = [];
              for (let i = startOffset - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, current: false });
              for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
              const remaining = 7 - (cells.length % 7);
              if (remaining < 7) for (let d = 1; d <= remaining; d++) cells.push({ day: d, current: false });
              return (
                <div className="mini-picker" onClick={(e) => e.stopPropagation()}>
                  <div className="mini-picker-header">
                    <button onClick={() => setSelectedDate(new Date(year, month - 1, 1))} className="mini-picker-nav">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span className="mini-picker-title">
                      {new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => setSelectedDate(new Date(year, month + 1, 1))} className="mini-picker-nav">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  <div className="mini-picker-grid">
                    {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => (
                      <div key={d} className="mini-picker-day">{d}</div>
                    ))}
                    {cells.map((c, i) => {
                      const isToday = c.current && c.day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();
                      const isSelected = c.current && c.day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                      return (
                        <button key={i} onClick={() => { if (c.current) { setSelectedDate(new Date(year, month, c.day)); setCalDatePickerOpen(false); } }}
                          className={`mini-picker-date${isSelected ? ' selected' : isToday ? ' today' : ''}${!c.current ? ' other-month' : ''}`}>
                          {c.day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <button className="cal-nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button className="cal-today-btn" onClick={() => { setSelectedDate(new Date()); setCalDatePickerOpen(false); }}>Today</button>
          </div>
          </div>
        </div>

        <div className="cal-grid-wrap" ref={calGridWrapRef}>
          <div className="cal-grid" style={{gridTemplateColumns: calViewMode === 'week' ? `170px repeat(${calDaysCount}, 1fr)` : `170px repeat(${calDaysCount}, ${calColWidth}px)`, userSelect: 'none'}}>
            <div className="cal-corner-cell"></div>
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div key={i} className={`cal-head-cell${day.toDateString() === todayDate.toDateString() ? ' today' : ''}${isWeekend ? ' weekend' : ''}`}>
                  <div className="head-day">{dayNames[day.getDay()]}</div>
                  <div className="head-num">{day.getDate()}</div>
                </div>
              );
            })}

            {filteredRooms.map(room => {
              // Vind de reservering die actief is op de huidige datum (voor housekeeping status)
              const todayMidnight = new Date(todayDate);
              todayMidnight.setHours(0, 0, 0, 0);

              const activeRes = flatEntries.find(r => {
                if (r.room !== room) return false;
                const checkinMidnight = new Date(r.checkin);
                checkinMidnight.setHours(0, 0, 0, 0);
                const checkoutMidnight = new Date(r.checkout);
                checkoutMidnight.setHours(0, 0, 0, 0);
                return checkinMidnight <= todayMidnight && checkoutMidnight >= todayMidnight;
              });
              const roomData = activeRes || flatEntries.find(r => r.room === room);
              const isClean = roomData ? housekeepingStatus[roomData.id] === 'clean' : true;
              return (
                <React.Fragment key={room}>
                  <div className="cal-room-cell" data-room-drag={room}
                    onClick={() => { if (roomData && roomData.guest) { setPreviousPage(activePage); setSelectedReservation(roomData); } }}
                    onDragOver={(e) => handleRowDragOver(e, room)}
                    onDrop={(e) => handleRowDrop(e, room)}>
                    <span className="room-num">{room}</span>
                    <span className="room-type">{getRoomTypeName(room)}</span>
                    {!isClean && <><span style={{flex:1}} /><span className="room-dot dirty"></span></>}
                  </div>
                  {days.map((day, i) => {
                    const res = getChipForCell(room, i);
                    const isToday = day.toDateString() === todayDate.toDateString();
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const chipStatus = res ? statusToChip(res) : null;
                    const span = res && chipStatus ? getChipSpan(res, i) : 1;
                    // Chip overlap: extend a few px past gridlines at check-in/check-out
                    const chipStyle = {};
                    if (res && chipStatus) {
                      const isRealStart = res.checkin && res.checkin.toDateString() === day.toDateString();
                      const daysTotal = res.checkout ? Math.ceil((res.checkout - day) / 86400000) : 1;
                      const isRealEnd = span >= daysTotal;
                      const OV = 5;
                      if (isRealStart && i > 0) chipStyle.left = `${4 + OV}px`;
                      if (span > 1) {
                        chipStyle.right = `calc(${-(span - 1) * 100}%${isRealEnd ? ` - ${OV}px` : ''})`;
                      } else if (isRealEnd) {
                        chipStyle.right = `-${OV}px`;
                      }
                    }
                    // Check of reservering vandaag aankomt of vertrekt (onafhankelijk van welke kolom de chip start)
                    return (
                      <div key={i} className={`cal-day-cell${isToday ? ' today-col' : ''}${isWeekend ? ' weekend' : ''}`}
                        data-room-drag={room} data-cal-cell={`${getRoomIdx(room)}-${i}`}
                        onDragOver={(e) => handleRowDragOver(e, room)}
                        onDrop={(e) => handleRowDrop(e, room)}
                        onMouseDown={(e) => {
                          if (!res && !isCellOccupied(room, i)) {
                            e.preventDefault();
                            startCalDrag(getRoomIdx(room), i);
                          }
                        }}>
                        {res && chipStatus && (
                          <div className={`res-chip ${chipStatus}`} style={chipStyle}
                            draggable="true"
                            data-res-id={res.rooms && res.rooms.length > 1 ? res.id : undefined}
                            onDragStart={(e) => { e.stopPropagation(); handleChipDragStart(e, res); }}
                            onDragEnd={handleChipDragEnd}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleRowDragOver(e, room); }}
                            onDrop={(e) => { e.stopPropagation(); handleRowDrop(e, room); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseEnter={() => { if (res.rooms && res.rooms.length > 1) highlightGroup(res.id); }}
                            onMouseLeave={() => { if (res.rooms && res.rooms.length > 1) clearGroup(); }}
                            onClick={() => { setPreviousPage(activePage); setSelectedReservation(res); }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                              <div className="res-name" style={{ flex: 1 }}>{chipStatus === 'blocked' ? (res.blockReason || 'Blocked') : res.guest}
                                {chipStatus !== 'blocked' && res.paidPercentage !== undefined && res.paidPercentage < 1 && (
                                  <span style={{
                                    display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                                    backgroundColor: res.paidPercentage === 0 ? '#ef4444' : '#f59e0b',
                                    marginLeft: '4px', verticalAlign: 'middle'
                                  }} />
                                )}
                                {chipStatus === 'option' && res.optionExpiry && (() => {
                                  const exp = new Date(res.optionExpiry);
                                  const diff = exp - todayDate;
                                  const hoursLeft = Math.floor(diff / 3600000);
                                  const daysLeft = Math.floor(diff / 86400000);
                                  const isExpired = diff <= 0;
                                  const label = isExpired ? 'exp' : daysLeft >= 1 ? `${daysLeft}d` : `${hoursLeft}h`;
                                  return (
                                    <span style={{
                                      marginLeft: '4px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em',
                                      color: isExpired ? '#ef4444' : hoursLeft < 24 ? '#f59e0b' : '#ec4899',
                                      verticalAlign: 'middle'
                                    }}>&#9201;{label}</span>
                                  );
                                })()}
                              </div>
                              {(() => {
                                const todayStr = todayDate.toDateString();
                                const isArrivingToday = res.checkin && res.checkin.toDateString() === todayStr;
                                const isDepartingToday = res.checkout && res.checkout.toDateString() === todayStr;
                                const canCheckIn = isArrivingToday && chipStatus === 'reserved';
                                const canCheckOut = isDepartingToday && chipStatus === 'checkedin';
                                const isCheckedInToday = isArrivingToday && chipStatus === 'checkedin';
                                const isCheckedOutToday = isDepartingToday && chipStatus === 'checkedout';
                                const showChip = canCheckIn || canCheckOut || isCheckedInToday || isCheckedOutToday;
                                if (!showChip) return null;
                                if (canCheckIn) return (
                                  <button onClick={(e) => { e.stopPropagation(); toggleCheckInOut(res.id, false); }}
                                    className="chip-badge badge-checkin" title="Check in">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                                    IN
                                  </button>
                                );
                                if (canCheckOut) return (
                                  <button onClick={(e) => { e.stopPropagation(); toggleCheckInOut(res.id, true); }}
                                    className="chip-badge badge-checkout" title="Check out">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                                    OUT
                                  </button>
                                );
                                if (isCheckedInToday) return (
                                  <span className="chip-badge badge-done-in">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    IN
                                  </span>
                                );
                                if (isCheckedOutToday) return (
                                  <span className="chip-badge badge-done-out">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    OUT
                                  </span>
                                );
                                return null;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Dummy drop row — visible only during drag */}
            {dragActive && (
              <React.Fragment>
                <div className="cal-room-cell" data-room-drag="__dummy__"
                  onDragOver={(e) => handleRowDragOver(e, '__dummy__')}
                  onDrop={(e) => { e.preventDefault(); handleChipDragEnd(); }}
                  style={{ borderBottom: 'none', borderTop: '2px dashed #d1d5db', opacity: 0.6 }}>
                  <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic' }}>Drop here...</span>
                </div>
                {days.map((_, i) => (
                  <div key={i} className="cal-day-cell" data-room-drag="__dummy__"
                    style={{ borderBottom: 'none', borderTop: '2px dashed #d1d5db', opacity: 0.6 }}
                    onDragOver={(e) => handleRowDragOver(e, '__dummy__')}
                    onDrop={(e) => { e.preventDefault(); handleChipDragEnd(); }} />
                ))}
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
    );
};