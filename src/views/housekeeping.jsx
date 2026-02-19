import React from 'react';
import globals from '../globals.js';
import { formatDate, addDays, buildFlatRoomEntries, getGuestName } from '../utils.js';
import { canAccessPage } from '../config.js';
import Icons from '../icons.jsx';

const HousekeepingView = (props) => {
  const { selectedDate, setSelectedDate, housekeepingTab, setHousekeepingTab, housekeepingStatus, setHousekeepingStatus, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation, setPreviousPage, cloudStatus } = props;

  const toggleHousekeeping = (id) => {
    setHousekeepingStatus(prev => ({
      ...prev,
      [id]: prev[id] === 'clean' ? 'dirty' : 'clean'
    }));
  };

  const selectedDateMidnight = new Date(selectedDate);
  selectedDateMidnight.setHours(0, 0, 0, 0);

  const roomsMap = new Map();
  const flatEntries = buildFlatRoomEntries(globals.reservations);
  const sortedReservations = [...flatEntries].sort((a, b) => a.checkin - b.checkin);

  sortedReservations.forEach(r => {
    const checkinMidnight = new Date(r.checkin);
    checkinMidnight.setHours(0, 0, 0, 0);
    const checkoutMidnight = new Date(r.checkout);
    checkoutMidnight.setHours(0, 0, 0, 0);

    if (checkinMidnight <= selectedDateMidnight && checkoutMidnight >= selectedDateMidnight) {
      if (!roomsMap.has(r.room)) {
        roomsMap.set(r.room, r);
      } else {
        const existing = roomsMap.get(r.room);
        const existingCheckin = new Date(existing.checkin);
        existingCheckin.setHours(0, 0, 0, 0);
        if (checkinMidnight < existingCheckin) {
          roomsMap.set(r.room, r);
        }
      }
    }
  });

  const activeReservations = Array.from(roomsMap.values());

  const arriving = activeReservations.filter(r => {
    const checkinMidnight = new Date(r.checkin);
    checkinMidnight.setHours(0, 0, 0, 0);
    return checkinMidnight.getTime() === selectedDateMidnight.getTime();
  });

  const inhouse = activeReservations.filter(r => {
    const checkinMidnight = new Date(r.checkin);
    checkinMidnight.setHours(0, 0, 0, 0);
    const checkoutMidnight = new Date(r.checkout);
    checkoutMidnight.setHours(0, 0, 0, 0);
    return checkinMidnight < selectedDateMidnight && checkoutMidnight > selectedDateMidnight;
  });

  const departing = activeReservations.filter(r => {
    const checkoutMidnight = new Date(r.checkout);
    checkoutMidnight.setHours(0, 0, 0, 0);
    return checkoutMidnight.getTime() === selectedDateMidnight.getTime();
  });

  const tabs = [
    { id: 'checkin', label: `Check-in [${arriving.length}]`, data: arriving },
    { id: 'in-house', label: `In-house [${inhouse.length}]`, data: inhouse },
    { id: 'checkout', label: `Check-out [${departing.length}]`, data: departing },
  ];

  const currentData = tabs.find(t => t.id === housekeepingTab)?.data || [];

  const getHousekeepingListText = () => {
    const dateStr = selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const tabLabel = tabs.find(t => t.id === housekeepingTab)?.label || '';
    let text = `Housekeeping - ${tabLabel} - ${dateStr}\n\n`;
    currentData.forEach(r => {
      const status = housekeepingStatus[r.id] === 'clean' ? 'Clean' : 'Dirty';
      text += `Room ${r.room} | ${r.guest || 'Available'} | ${status}\n`;
    });
    text += `\nTotal: ${currentData.length} rooms`;
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
            {props.userMenuOpen && (<>
              <div className="fixed inset-0 z-[49]" onClick={() => props.setUserMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-[50]">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <div className="text-sm font-medium text-neutral-900">{globals.currentUser?.name}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{globals.currentUser?.role}</div>
                </div>
                <button onClick={props.handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            </>)}
          </div>
        </div>
        <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy; <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle ${cloudStatus === 'idle' ? 'bg-emerald-400' : cloudStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : cloudStatus === 'error' ? 'bg-red-400' : 'bg-neutral-300'}`} title={cloudStatus === 'idle' ? 'Cloud synced' : cloudStatus === 'syncing' ? 'Syncing...' : cloudStatus === 'error' ? 'Sync error' : 'Offline'} /><br/>All Rights Reserved</>)}</div>
      </aside>
      <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
          <div className="cal-title">
            <h2>Housekeeping</h2>
            <p>Room cleaning status</p>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => { const w = window.open('', '_blank'); w.document.write('<pre style="font-family:system-ui;font-size:14px;padding:40px">' + getHousekeepingListText() + '</pre>'); w.document.title = 'Housekeeping List'; w.print(); }}
              className="hidden md:flex p-2 hover:bg-neutral-100 rounded-xl transition-colors" title="Print list">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-neutral-600"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <a href={`mailto:?subject=Housekeeping List - ${selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}&body=${encodeURIComponent(getHousekeepingListText())}`}
              className="hidden md:flex p-2 hover:bg-neutral-100 rounded-xl transition-colors" title="Email list">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-neutral-600"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </a>

            <div className="hidden md:block h-8 w-px bg-neutral-200" />

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

        {/* Tabs */}
        <div className="mb-4 md:mb-6 flex flex-wrap gap-2 md:gap-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setHousekeepingTab(tab.id)}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-xl transition-all duration-200 ${
                housekeepingTab === tab.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Room Status List */}
        <div className="space-y-3">
          {currentData.map(res => (
            <div key={res.id} onClick={() => { setPreviousPage(activePage); setSelectedReservation(res); }}
              className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow duration-200 cursor-pointer"
              style={{ borderLeft: `3px solid ${housekeepingStatus[res.id] === 'clean' ? '#10b981' : '#f59e0b'}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-6 min-w-0">
                  <div className="text-lg md:text-xl font-medium text-neutral-900 w-12 md:w-16 flex-shrink-0 font-serif">{res.room}</div>
                  <div className="h-10 w-px bg-neutral-200 hidden md:block" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900 truncate">{getGuestName(res) || 'Available'}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {res.checkin && res.checkout ? `${formatDate(res.checkin)} - ${formatDate(res.checkout)}` : '-'}
                    </div>
                  </div>
                  {res.rooms && res.rooms[0] && res.rooms[0].housekeepingNote && (
                    <>
                      <div className="h-10 w-px bg-neutral-200 hidden md:block" />
                      <span className="hidden md:inline text-xs px-3 py-1 bg-amber-50 text-amber-700 rounded-lg">
                        {res.rooms[0].housekeepingNote}
                      </span>
                    </>
                  )}
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-medium ${housekeepingStatus[res.id] === 'clean' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {housekeepingStatus[res.id] === 'clean' ? 'Clean' : 'Dirty'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); toggleHousekeeping(res.id); }}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ${
                      housekeepingStatus[res.id] === 'clean' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                      housekeepingStatus[res.id] === 'clean' ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All Clean Toggle */}
        <div className="mt-6 flex items-center justify-between px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <span className="text-xs text-neutral-500">Mark all rooms in this category as clean</span>
          <button onClick={() => {
              setHousekeepingStatus(prev => {
                const updated = { ...prev };
                currentData.forEach(res => { updated[res.id] = 'clean'; });
                return updated;
              });
            }}
            className="px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-100 hover:text-neutral-900 transition-colors duration-200">
            Mark all clean
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default HousekeepingView;
