const NewReservationModal = (props) => {
    const { newReservationOpen, setNewReservationOpen, setToastMessage, setPreviousPage, activePage, setSelectedReservation } = props;

    const [newResGuestName, setNewResGuestName] = React.useState('');
    const [newResShowSuggestions, setNewResShowSuggestions] = React.useState(false);
    const [newResCheckin, setNewResCheckin] = React.useState('');
    const [newResCheckout, setNewResCheckout] = React.useState('');
    const [newResInited, setNewResInited] = React.useState(false);
    const [newResCompanyMode, setNewResCompanyMode] = React.useState(false);
    const [newResCompanySearch, setNewResCompanySearch] = React.useState('');
    const [newResSelectedCompany, setNewResSelectedCompany] = React.useState(null);
    const [newResCompanyOpen, setNewResCompanyOpen] = React.useState(false);

    if (!newReservationOpen) return null;

    const preSelectedRooms = newReservationOpen?.rooms || [];
    const preSelectedRoom = typeof newReservationOpen === 'string' ? newReservationOpen
      : (newReservationOpen?.room || '');
    const preSelectedCheckin = newReservationOpen?.checkin || '';
    const preSelectedCheckout = newReservationOpen?.checkout || '';

    // Init dates from pre-selection (once)
    if (!newResInited) {
      if (preSelectedCheckin) setNewResCheckin(preSelectedCheckin);
      if (preSelectedCheckout) setNewResCheckout(preSelectedCheckout);
      setNewResInited(true);
    }

    const allRoomNumbers = getAllRooms();
    const ciDate = newResCheckin ? new Date(newResCheckin) : null;
    const coDate = newResCheckout ? new Date(newResCheckout) : null;
    const validDates = ciDate && coDate && coDate > ciDate;

    // Filter rooms: only show available for selected dates
    const flatEntries = buildFlatRoomEntries(reservations);
    const availableRooms = validDates ? allRoomNumbers.filter(rm => {
      return !flatEntries.some(r => {
        if (r.room !== rm) return false;
        const st = r.reservationStatus || 'confirmed';
        if (st === 'cancelled' || st === 'no-show') return false;
        const rCi = new Date(r.checkin);
        const rCo = new Date(r.checkout);
        return rCi < coDate && rCo > ciDate;
      });
    }) : allRoomNumbers;
    const isMultiRoom = preSelectedRooms.length > 1;

    // Build unique guest profiles from bookerProfiles + existing reservations
    const guestProfilesList = (() => {
      const seen = new Set();
      const results = [];
      // First: bookerProfiles (includes manually created ones)
      bookerProfiles.forEach(bp => {
        const name = `${bp.firstName || ''} ${bp.lastName || ''}`.trim();
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        const linkedCo = bp.linkedCompanyId ? companyProfiles.find(c => c.id === bp.linkedCompanyId) : null;
        results.push({ name, email: bp.email || '', phone: bp.phone || '', company: linkedCo?.name || '' });
      });
      // Then: from reservations (catch any not yet in bookerProfiles)
      reservations.forEach(r => {
        if (!r.booker?.firstName && !r.booker?.lastName) return;
        const name = `${r.booker.firstName || ''} ${r.booker.lastName || ''}`.trim();
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        results.push({ name, email: r.booker.email || '', phone: r.booker.phone || '', company: r.billingRecipient?.type === 'company' ? r.billingRecipient.name : '' });
      });
      return results;
    })();
    const q = newResGuestName.toLowerCase();
    const guestSuggestions = q.length >= 2 ? guestProfilesList.filter(p =>
      p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)
    ).slice(0, 5) : [];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 md:px-0"
        onClick={() => setNewReservationOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-neutral-100">
            <h3 className="text-lg font-semibold text-neutral-900">New Reservation</h3>
            <button onClick={() => setNewReservationOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Form */}
          <div className="p-4 md:p-6 space-y-4">
            {/* Guest / Company toggle */}
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { setNewResCompanyMode(false); setNewResSelectedCompany(null); setNewResCompanySearch(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!newResCompanyMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700'}`}>
                Guest
              </button>
              <button onClick={() => { setNewResCompanyMode(true); setNewResGuestName(''); setNewResShowSuggestions(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${newResCompanyMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700'}`}>
                Company
              </button>
            </div>

            {!newResCompanyMode ? (
              /* Guest name input with autocomplete */
              <div className="relative">
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Guest name</label>
                <input id="newResGuest" type="text" placeholder="Search or type name..."
                  value={newResGuestName}
                  onChange={(e) => { setNewResGuestName(e.target.value); setNewResShowSuggestions(true); }}
                  onFocus={() => { if (newResGuestName.length >= 2) setNewResShowSuggestions(true); }}
                  autoComplete="off"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                {newResShowSuggestions && guestSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl z-10 overflow-hidden">
                    {guestSuggestions.map((p, idx) => (
                      <button key={idx} type="button"
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNewResGuestName(p.name);
                          setNewResShowSuggestions(false);
                          // Auto-link company if booker has one
                          const bp = bookerProfiles.find(b => `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase() === p.name.toLowerCase());
                          if (bp?.linkedCompanyId) {
                            const co = companyProfiles.find(c => c.id === bp.linkedCompanyId);
                            if (co) { setNewResSelectedCompany(co); }
                          } else {
                            setNewResSelectedCompany(null);
                          }
                        }}>
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600 flex-shrink-0">
                          {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-900">{p.name}</div>
                          <div className="text-xs text-neutral-400 truncate">
                            {[p.email, p.company].filter(Boolean).join(' · ') || 'No details'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Company selection */
              <div className="relative">
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Company</label>
                {newResSelectedCompany ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                      {(newResSelectedCompany.name?.[0] || '').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-900">{newResSelectedCompany.name}</div>
                      <div className="text-xs text-neutral-400 truncate">{[newResSelectedCompany.vatNumber, newResSelectedCompany.city].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button onClick={() => { setNewResSelectedCompany(null); setNewResCompanySearch(''); }}
                      className="w-6 h-6 rounded-md hover:bg-blue-100 flex items-center justify-center transition-colors text-neutral-400 hover:text-neutral-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <input type="text" placeholder="Search companies..."
                      value={newResCompanySearch}
                      onChange={(e) => { setNewResCompanySearch(e.target.value); setNewResCompanyOpen(true); }}
                      onFocus={() => setNewResCompanyOpen(true)}
                      autoComplete="off"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    {newResCompanyOpen && (() => {
                      const cq = newResCompanySearch.toLowerCase();
                      const filtered = companyProfiles.filter(c => c.name && (!cq || c.name.toLowerCase().includes(cq) || (c.vatNumber && c.vatNumber.toLowerCase().includes(cq)) || (c.city && c.city.toLowerCase().includes(cq))));
                      if (filtered.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                          {filtered.slice(0, 8).map(c => (
                            <button key={c.id} type="button"
                              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setNewResSelectedCompany(c); setNewResCompanyOpen(false); setNewResCompanySearch(''); }}>
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                                {(c.name?.[0] || '').toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-neutral-900">{c.name}</div>
                                <div className="text-xs text-neutral-400 truncate">{[c.vatNumber, c.city].filter(Boolean).join(' · ')}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                  {isMultiRoom ? `Rooms (${preSelectedRooms.length})` : 'Room'}
                </label>
                {isMultiRoom ? (
                  <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl min-h-[42px] items-center">
                    {preSelectedRooms.map(rm => (
                      <span key={rm} className="inline-flex items-center px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-xs font-medium">{rm}</span>
                    ))}
                  </div>
                ) : (
                  <select id="newResRoom" defaultValue={preSelectedRoom} className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                    <option value="">Select{validDates ? ` (${availableRooms.length} available)` : ''}</option>
                    {availableRooms.map(room => <option key={room} value={room}>{room}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Guests</label>
                <input id="newResGuests" type="number" min="1" max="6" defaultValue="2"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Rate Plan</label>
                <select id="newResRatePlan" defaultValue={ratePlans[0]?.id || ''}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                  {ratePlans.map(rp => <option key={rp.id} value={rp.id}>{rp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Status</label>
                <select id="newResStatus" defaultValue="confirmed"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                  <option value="confirmed">Confirmed</option>
                  <option value="option">Option</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Check-in</label>
                <input id="newResCheckin" type="date" value={newResCheckin} onKeyDown={noTypeDateKey}
                  onChange={(e) => {
                    setNewResCheckin(e.target.value);
                    if (e.target.value && !newResCheckout) {
                      const next = new Date(e.target.value);
                      next.setDate(next.getDate() + 1);
                      setNewResCheckout(next.toISOString().slice(0, 10));
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Check-out</label>
                <input id="newResCheckout" type="date" value={newResCheckout} onKeyDown={noTypeDateKey}
                  onChange={(e) => setNewResCheckout(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Notes</label>
              <textarea id="newResNotes" rows="2" placeholder="Optional notes..."
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-neutral-100 bg-neutral-50">
            <kbd className="hidden md:inline-flex px-2 py-0.5 bg-white rounded-md text-[11px] font-medium text-neutral-400 border border-neutral-200">ESC to close</kbd>
            <div className="flex gap-3 ml-auto">
              <button onClick={() => setNewReservationOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
                Cancel
              </button>
              <button onClick={() => {
                const guestName = newResCompanyMode ? (newResSelectedCompany?.name || '') : (document.getElementById('newResGuest')?.value?.trim() || '');
                const status = document.getElementById('newResStatus')?.value || 'confirmed';
                const checkinStr = document.getElementById('newResCheckin')?.value;
                const checkoutStr = document.getElementById('newResCheckout')?.value;
                const guestCount = parseInt(document.getElementById('newResGuests')?.value) || 2;
                const notes = document.getElementById('newResNotes')?.value?.trim() || '';
                const selectedRatePlanId = document.getElementById('newResRatePlan')?.value || ratePlans[0]?.id || '';
                const rooms = isMultiRoom ? preSelectedRooms : [document.getElementById('newResRoom')?.value || preSelectedRoom];

                if (!checkinStr || !checkoutStr) { setToastMessage('Please select check-in and check-out dates'); return; }
                if (rooms.length === 0 || !rooms[0]) { setToastMessage('Please select a room'); return; }
                if (newResCompanyMode && !newResSelectedCompany) { setToastMessage('Please select a company'); return; }

                const checkin = new Date(checkinStr);
                const checkout = new Date(checkoutStr);
                if (checkout <= checkin) { setToastMessage('Check-out must be after check-in'); return; }

                let firstName = '', lastName = '';
                if (newResCompanyMode && newResSelectedCompany) {
                  // Use company name as display, email/phone from company profile
                  firstName = newResSelectedCompany.name;
                  lastName = '';
                } else {
                  const nameParts = guestName.split(' ');
                  firstName = nameParts[0] || '';
                  lastName = nameParts.slice(1).join(' ') || '';
                }

                const co = newResSelectedCompany;
                const billingRecipient = co
                  ? { type: 'company', companyId: co.id, name: co.name, vatNumber: co.vatNumber || '', peppolId: co.peppolId || '', address: co.address || '', zip: co.zip || '', city: co.city || '', country: co.country || '', email: co.email || '', phone: co.phone || '', reference: '' }
                  : { type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '', reference: '' };

                const nightPrices = [];
                for (let d = new Date(checkin); d < checkout; d.setDate(d.getDate() + 1)) {
                  nightPrices.push({ date: d.toISOString().slice(0, 10), amount: 0 });
                }

                const newId = Math.max(...reservations.map(r => r.id), 0) + 1;
                const bookingRef = getNextBookingRef();

                const newRes = {
                  id: newId,
                  guest: guestName || (status === 'blocked' ? '' : 'New Reservation'),
                  room: rooms[0],
                  type: getRoomTypeName(rooms[0]),
                  checkin,
                  checkout,
                  reservationStatus: status,
                  price: 0,
                  bookingRef,
                  otaRef: null,
                  source: newResCompanyMode ? (co?.source || 'Direct') : 'Direct',
                  guestCount,
                  eta: '',
                  paidPercentage: 0,
                  meals: { breakfast: false, lunch: false, dinner: false },
                  extras: [],
                  booker: newResCompanyMode && co
                    ? { firstName: co.name, lastName: '', email: co.email || '', phone: co.phone || '' }
                    : { firstName, lastName, email: '', phone: '' },
                  bookedVia: 'direct',
                  billingRecipient,
                  stayPurpose: newResCompanyMode ? 'business' : '',
                  notes,
                  blockReason: status === 'blocked' ? (notes || '') : '',
                  rooms: rooms.map(rm => ({
                    roomNumber: rm,
                    roomType: getRoomTypeName(rm),
                    ratePlanId: selectedRatePlanId,
                    status: status,
                    checkin: checkin.toISOString(),
                    checkout: checkout.toISOString(),
                    guests: [
                      { firstName, lastName, email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' },
                      { firstName: '', lastName: '', email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' }
                    ],
                    priceType: 'fixed',
                    fixedPrice: 0,
                    nightPrices: nightPrices.map(n => ({ ...n })),
                    housekeeping: 'clean',
                    housekeepingNote: '',
                    optionExpiry: null,
                    roomLocked: false,
                    roomLockedReason: ''
                  })),
                  payments: [],
                  optionExpiry: null,
                  invoices: [],
                  activityLog: [{ id: 1, timestamp: Date.now(), action: 'Reservation created', user: 'Sophie' }],
                  reminders: []
                };

                if (status === 'blocked' && rooms.length > 1) {
                  // Create separate block per room
                  rooms.forEach((rm, idx) => {
                    const blockId = newId + idx;
                    const blockRef = getNextBookingRef();
                    reservations.push({
                      ...JSON.parse(JSON.stringify(newRes)),
                      id: blockId,
                      room: rm,
                      bookingRef: blockRef,
                      checkin: new Date(checkinStr),
                      checkout: new Date(checkoutStr),
                      rooms: [{
                        ...newRes.rooms[0],
                        roomNumber: rm,
                        checkin: new Date(checkinStr).toISOString(),
                        checkout: new Date(checkoutStr).toISOString(),
                        nightPrices: nightPrices.map(n => ({ ...n }))
                      }]
                    });
                  });
                } else {
                  reservations.push(newRes);
                }
                saveReservationSingle(newRes);
                setNewReservationOpen(false);
                if (status === 'blocked') {
                  setToastMessage(`Block created for room${rooms.length > 1 ? 's' : ''} ${rooms.join(', ')}`);
                } else {
                  setPreviousPage(activePage);
                  setSelectedReservation(newRes);
                  setToastMessage(`Reservation ${bookingRef} created`);
                }
              }}
                className="px-6 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-lg">
                Create reservation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };