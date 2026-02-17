import React from 'react';
import globals from '../globals.js';
import { Icons } from '../icons.jsx';
import { formatDate } from '../utils.js';

const SearchModal = (props) => {
  const { searchOpen, searchQuery, setSearchQuery, setSearchOpen, setActivePage, setSelectedReservation, setNewReservationOpen, setInvoiceOpen, searchInputRef, setPreviousPage, activePage } = props;

  if (!searchOpen) return null;

    const filteredResults = searchQuery.length > 0
      ? globals.reservations.filter(r => {
          const q = searchQuery.toLowerCase();
          // Search guest name (legacy field + booker)
          if (r.guest && r.guest.toLowerCase().includes(q)) return true;
          if (r.booker && (`${r.booker.firstName} ${r.booker.lastName}`).toLowerCase().includes(q)) return true;
          // Search all room numbers (multi-room support)
          if (r.rooms && r.rooms.some(rm => String(rm.roomNumber).includes(searchQuery))) return true;
          if (r.room && r.room.includes(searchQuery)) return true;
          // Search room guests
          if (r.rooms && r.rooms.some(rm => (rm.guests || []).some(g =>
            (`${g.firstName} ${g.lastName}`).toLowerCase().includes(q)
          ))) return true;
          // Search booking refs
          if (r.bookingRef && r.bookingRef.toLowerCase().includes(q)) return true;
          if (r.otaRef && r.otaRef.toLowerCase().includes(q)) return true;
          return false;
        }).slice(0, 8)
      : [];

    const modLabel = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '\u2303' : 'Alt+';
    const quickActions = [
      { label: 'Dashboard', shortcut: `${modLabel}1`, action: () => { setActivePage('dashboard'); setSelectedReservation(null); setSearchOpen(false); }, icon: 'Home' },
      { label: 'Calendar', shortcut: `${modLabel}2`, action: () => { setActivePage('calendar'); setSelectedReservation(null); setSearchOpen(false); }, icon: 'Calendar' },
      { label: 'Housekeeping', shortcut: `${modLabel}3`, action: () => { setActivePage('housekeeping'); setSelectedReservation(null); setSearchOpen(false); }, icon: 'Sparkles' },
      { label: 'F&B', shortcut: `${modLabel}4`, action: () => { setActivePage('fb'); setSelectedReservation(null); setSearchOpen(false); }, icon: 'Coffee' },
      { label: 'Reports', shortcut: `${modLabel}5`, action: () => { setActivePage('reports'); setSelectedReservation(null); setSearchOpen(false); }, icon: 'BarChart' },
      { label: 'New reservation', shortcut: `${modLabel}N`, action: () => { setSearchOpen(false); setNewReservationOpen(true); }, icon: 'Plus' },
      { label: 'Quick invoice', shortcut: `${modLabel}F`, action: () => { setSearchOpen(false); setInvoiceOpen(true); }, icon: 'Invoice' },
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] md:pt-[20vh] px-4 md:px-0"
        onClick={() => setSearchOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden"
          onClick={e => e.stopPropagation()}>
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
            <Icons.Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by guest, booking reference or invoice number..."
              className="flex-1 text-sm outline-none bg-transparent text-neutral-900 placeholder-neutral-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 bg-neutral-100 rounded-md text-[11px] font-medium text-neutral-500 border border-neutral-200">ESC</kbd>
          </div>

          {/* Results */}
          <div className={searchQuery.length > 0 && filteredResults.length > 5 ? "max-h-80 overflow-y-auto overscroll-contain" : ""}>
            {searchQuery.length > 0 ? (
              filteredResults.length > 0 ? (
                <div className="py-2">
                  <div className="px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Reservations</div>
                  {filteredResults.map(res => (
                    <button key={res.id}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                      onClick={() => { setPreviousPage(activePage); setSelectedReservation(res); setSearchOpen(false); }}>
                      <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-xs font-bold text-neutral-600">
                        {res.room}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">{res.guest}</div>
                        <div className="text-xs text-neutral-500">{res.bookingRef}{res.otaRef ? ` · ${res.otaRef}` : ''} · {formatDate(res.checkin)} - {formatDate(res.checkout)}</div>
                      </div>
                      <div className="text-xs font-medium text-neutral-400">&euro;{res.price}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <div className="text-sm text-neutral-400">No results for "{searchQuery}"</div>
                </div>
              )
            ) : (
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {quickActions.map((action, i) => (
                  <button key={i}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors text-left"
                    onClick={action.action}>
                    <span className="text-xs font-medium text-neutral-600">{action.label}</span>
                    <kbd className="px-1.5 py-0.5 bg-white rounded text-[9px] font-medium text-neutral-400 border border-neutral-150">{action.shortcut}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
};

export default SearchModal;
