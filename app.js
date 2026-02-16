const { useState, useEffect } = React;

const ModernHotelPMS = () => {
  const [time, setTime] = useState(new Date());
  // Start met gisteren zodat vandaag op positie 2 staat in kalender view
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activePage, setActivePage] = useState('dashboard');
  // Profile state lifted to App level so it survives ProfilesView re-mounts
  const [profileSelectedProfile, setProfileSelectedProfile] = useState(null);
  const [profileEditingProfile, setProfileEditingProfile] = useState(null);
  const [profileSourceReservation, setProfileSourceReservation] = useState(null);
  const [profileSourceTab, setProfileSourceTab] = useState(null);
  const [calendarView, setCalendarView] = useState('list'); // 'list' or 'timeline'
  const [quickView, setQuickView] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [previousPage, setPreviousPage] = useState(null);
  const [reservationTab, setReservationTab] = useState('overview');
  const [billSelected, setBillSelected] = React.useState(null);
  const [billSplitMode, setBillSplitMode] = React.useState(false);
  const [billPaySelected, setBillPaySelected] = React.useState([]);
  const [billRecipientOverride, setBillRecipientOverride] = React.useState(null);
  const [billCustomLabels, setBillCustomLabels] = React.useState({});
  const [amendingInvoice, setAmendingInvoice] = React.useState(null);
  const [amendRecipient, setAmendRecipient] = React.useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeFilter, setActiveFilter] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'departing' : 'arriving';
  });
  const [calendarActiveFilter, setCalendarActiveFilter] = useState('all');
  const [calColWidth, setCalColWidth] = useState(() => {
    try { const v = localStorage.getItem('calColWidth'); if (v) return Number(v); } catch(e) {}
    return 155;
  });
  const [calDatePickerOpen, setCalDatePickerOpen] = useState(false);
  const [calViewMode, setCalViewMode] = useState(() => {
    try { const v = localStorage.getItem('calViewMode'); if (v === 'week' || v === 'month') return v; } catch(e) {}
    return 'month';
  });
  const [checkedInRooms, setCheckedInRooms] = useState({});
  const [housekeepingTab, setHousekeepingTab] = useState('checkin');
  const [fbTab, setFbTab] = useState('all');
  const [roomGridMode, setRoomGridMode] = useState(false);
  const [activeGuestTab, setActiveGuestTab] = useState({});
  const [guestSearchActive, setGuestSearchActive] = useState(null); // tracks {ri,gi} when lastName field is being actively searched
  const [expandedRooms, setExpandedRooms] = useState({});
  const [pendingDateChange, setPendingDateChange] = useState(null); // { next, source }
  const [addRoomDates, setAddRoomDates] = useState({ checkin: '', checkout: '' });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messages, setMessages] = useState(generateInitialMessages);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [changeRoomTarget, setChangeRoomTarget] = useState(null); // { roomIndex }
  const [billTransferMode, setBillTransferMode] = useState(null); // null | 'items' | 'payments'
  const [billTransferSearch, setBillTransferSearch] = useState('');
  const [billTransferTarget, setBillTransferTarget] = useState(null);
  const [billTransferSelected, setBillTransferSelected] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [warningToast, setWarningToast] = useState(null); // { message, resId }
  const [cloudStatus, setCloudStatus] = useState('idle'); // Supabase sync indicator
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourActive, setTourActive] = useState(null);
  const messageInputRef = React.useRef(null);
  const messagesEndRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const focusValRef = React.useRef('');
  const addRoomRef = React.useRef(null);
  const dragPaymentRef = React.useRef(null);
  const [housekeepingStatus, setHousekeepingStatus] = useState(() => {
    try {
      const stored = localStorage.getItem('housekeepingStatus');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading housekeeping status:', e);
    }
    return Object.fromEntries(reservations.map(r => [r.id, r.housekeeping]));
  });

  useEffect(() => {
    setMounted(true);
    initialSync();
    return onSyncChange((status) => setCloudStatus(status));
  }, []);

  // Persist calColWidth to localStorage
  useEffect(() => {
    try { localStorage.setItem('calColWidth', String(calColWidth)); } catch(e) {}
  }, [calColWidth]);

  // Close calendar date picker on outside click
  useEffect(() => {
    const handleClick = () => setCalDatePickerOpen(false);
    if (calDatePickerOpen) {
      setTimeout(() => document.addEventListener('click', handleClick), 0);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [calDatePickerOpen]);

  // Only tick the clock when NOT on reservation detail, profiles, or modals (avoids re-renders that kill state/dropdowns)
  const clockPaused = selectedReservation || newReservationOpen || searchOpen || invoiceOpen || messagesOpen || calDatePickerOpen || activePage === 'profiles' || activePage === 'reports' || activePage === 'settings' || activePage === 'payments' || activePage === 'channelmanager';
  useEffect(() => {
    if (clockPaused) return;
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [clockPaused]);

  // Sync editingReservation when selectedReservation changes
  useEffect(() => {
    if (selectedReservation) {
      const ed = JSON.parse(JSON.stringify(selectedReservation));
      // Migrate booker: name → firstName/lastName
      if (ed.booker) {
        if (!ed.booker.firstName && ed.booker.name) {
          const parts = ed.booker.name.split(' ');
          ed.booker.firstName = parts[0] || '';
          ed.booker.lastName = parts.slice(1).join(' ') || '';
        }
        // Fallback: parse from reservation.guest string
        if (!ed.booker.firstName && ed.guest) {
          const parts = ed.guest.split(' ');
          ed.booker.firstName = parts[0] || '';
          ed.booker.lastName = parts.slice(1).join(' ') || '';
        }
      }
      const bookerFirst = ed.booker?.firstName || '';
      const bookerLast = ed.booker?.lastName || '';
      // Migrate rooms: guestProfile → guests[], and fill empty guest 1 from booker
      (ed.rooms || []).forEach(room => {
        if (!room.guests || room.guests.length === 0) {
          if (room.guestProfile) {
            const gp = room.guestProfile;
            const parts = (gp.name || '').split(' ');
            room.guests = [
              { firstName: parts[0] || bookerFirst, lastName: parts.slice(1).join(' ') || bookerLast, email: gp.email || ed.booker?.email || '', phone: gp.phone || ed.booker?.phone || '', nationality: gp.nationality || 'NL', idType: gp.idType || '', idNumber: gp.idNumber || '' },
              { firstName: '', lastName: '', email: '', phone: '', nationality: gp.nationality || 'NL', idType: '', idNumber: '' }
            ];
          } else {
            room.guests = [
              { firstName: bookerFirst, lastName: bookerLast, email: ed.booker?.email || '', phone: ed.booker?.phone || '', nationality: 'NL', idType: '', idNumber: '' },
              { firstName: '', lastName: '', email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' }
            ];
          }
        } else if (room.guests[0] && !room.guests[0].firstName && !room.guests[0].lastName) {
          // Guests array exists but primary guest has no name — fill from booker
          room.guests[0].firstName = bookerFirst;
          room.guests[0].lastName = bookerLast;
          room.guests[0].email = room.guests[0].email || ed.booker?.email || '';
          room.guests[0].phone = room.guests[0].phone || ed.booker?.phone || '';
        }
        if (!room.status) room.status = ed.reservationStatus || 'confirmed';
      });
      setEditingReservation(ed);
    } else {
      setEditingReservation(null);
    }
    setShowActionMenu(false);
    // Init add-room dates from first room
    if (selectedReservation && selectedReservation.rooms && selectedReservation.rooms[0]) {
      const r0 = selectedReservation.rooms[0];
      setAddRoomDates({
        checkin: r0.checkin ? new Date(r0.checkin).toISOString().slice(0, 10) : (selectedReservation.checkin ? new Date(selectedReservation.checkin).toISOString().slice(0, 10) : ''),
        checkout: r0.checkout ? new Date(r0.checkout).toISOString().slice(0, 10) : (selectedReservation.checkout ? new Date(selectedReservation.checkout).toISOString().slice(0, 10) : '')
      });
    }
  }, [selectedReservation]);

  // Auto-save editingReservation changes back to reservations array + localStorage
  useEffect(() => {
    if (!editingReservation) return;
    const idx = reservations.findIndex(r => r.id === editingReservation.id);
    if (idx === -1) return;
    // Derive reservation-level status from room statuses
    const roomStatuses = (editingReservation.rooms || []).map(r => r.status || 'confirmed');
    let derivedStatus = editingReservation.reservationStatus;
    if (roomStatuses.length === 1) {
      // Single room: reservation always follows room
      derivedStatus = roomStatuses[0];
    } else if (roomStatuses.length > 1) {
      const allSame = roomStatuses.every(s => s === roomStatuses[0]);
      if (allSame) {
        // All rooms same status: reservation follows
        derivedStatus = roomStatuses[0];
      }
      // Mixed statuses: keep current reservation status (don't override)
    }
    // Update module-level array so other views (HK, calendar, etc.) see the changes
    const updated = {
      ...editingReservation,
      reservationStatus: derivedStatus,
      rooms: (editingReservation.rooms || []).map(room => ({
        ...room,
        checkin: room.checkin ? new Date(room.checkin) : new Date(editingReservation.checkin),
        checkout: room.checkout ? new Date(room.checkout) : new Date(editingReservation.checkout)
      }))
    };
    // Derive reservation-level dates from room dates
    deriveReservationDates(updated);
    reservations[idx] = updated;
    // Persist to localStorage + Supabase
    saveReservationSingle(updated);
  }, [editingReservation]);

  // Helper: check billing issues on checkout
  const showCheckoutWarning = (res) => {
    const roomTotal = (res.rooms || []).reduce((sum, rm) => {
      if (rm.priceType === 'fixed') return sum + (rm.fixedPrice || 0);
      return sum + (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0);
    }, 0);
    const extrasTotal = (res.extras || []).reduce((sum, ex) => sum + (ex.quantity || 0) * (ex.unitPrice || 0), 0);
    const totalAmount = roomTotal + extrasTotal;
    if (totalAmount <= 0) return;

    const parts = [];
    // Check 1: Uninvoiced
    const invoicedAmount = (res.invoices || [])
      .filter(inv => inv.status !== 'credited' && inv.type !== 'proforma' && inv.type !== 'credit')
      .reduce((s, inv) => s + inv.amount, 0);
    const uninvoiced = Math.max(0, totalAmount - invoicedAmount);
    if (uninvoiced > 0.01) parts.push(`EUR ${uninvoiced.toFixed(2)} uninvoiced`);

    // Check 2: Unpaid
    const paidAmount = (res.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const unpaid = Math.max(0, totalAmount - paidAmount);
    if (unpaid > 0.01) parts.push(`EUR ${unpaid.toFixed(2)} unpaid`);

    // Check 3: Unlinked payments
    const unlinkedCount = (res.payments || []).filter(p => p.status === 'completed' && !p.linkedInvoice).length;
    if (unlinkedCount > 0) parts.push(`${unlinkedCount} unlinked payment${unlinkedCount > 1 ? 's' : ''}`);

    if (parts.length > 0) {
      setWarningToast({ message: parts.join(' · '), resId: res.id });
    }
  };

  // Helper: toggle check-in/check-out from dashboard/calendar and persist to reservation
  const toggleCheckInOut = (resId, isDeparting) => {
    setCheckedInRooms(prev => {
      const wasToggled = prev[resId];
      const newValue = wasToggled ? false : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      // Also update the reservation in the module-level array
      const idx = reservations.findIndex(r => r.id === resId);
      if (idx !== -1) {
        if (isDeparting) {
          reservations[idx].isCheckedOut = !!newValue;
          reservations[idx].reservationStatus = newValue ? 'checked-out' : 'checked-in';
          // Update first room status
          if (reservations[idx].rooms && reservations[idx].rooms[0]) {
            reservations[idx].rooms[0].status = newValue ? 'checked-out' : 'checked-in';
          }
          // Set housekeeping to dirty on checkout
          if (newValue) {
            setHousekeepingStatus(prev => {
              const next = { ...prev, [resId]: 'dirty' };
              try { localStorage.setItem('housekeepingStatus', JSON.stringify(next)); } catch(e) {}
              return next;
            });
            // Show billing warning if issues exist
            showCheckoutWarning(reservations[idx]);
            // Auto-charge VCC on checkout
            const res = reservations[idx];
            const bp = bookerProfiles.find(b =>
              (b.email && b.email === res.booker?.email) ||
              (b.firstName === res.booker?.firstName && b.lastName === res.booker?.lastName)
            );
            if (bp?.creditCard?.isVCC) {
              const roomTotal = (res.rooms || []).reduce((sum, rm) => rm.priceType === 'fixed' ? sum + (rm.fixedPrice || 0) : sum + (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0), 0);
              const extrasTotal = (res.extras || []).reduce((sum, ex) => sum + (ex.quantity || 0) * (ex.unitPrice || 0), 0);
              const totalAmt = roomTotal + extrasTotal;
              const paidAmt = (res.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
              const outstanding = Math.max(0, totalAmt - paidAmt);
              if (outstanding > 0) {
                const maxPid = (res.payments || []).reduce((m, p) => Math.max(m, p.id || 0), 0);
                reservations[idx].payments = [...(res.payments || []), {
                  id: maxPid + 1, date: new Date().toISOString().split('T')[0],
                  amount: Math.round(outstanding * 100) / 100,
                  method: `VCC (\u2022\u2022\u2022\u2022 ${bp.creditCard.last4})`,
                  note: 'Auto-charged VCC on checkout', status: 'completed', linkedInvoice: null,
                }];
                setToastMessage(`VCC charged: EUR ${outstanding.toFixed(2)}`);
                saveReservationSingle(reservations[idx]);
              }
            }
          }
        } else {
          reservations[idx].isCheckedIn = !!newValue;
          reservations[idx].checkedInTime = newValue || null;
          reservations[idx].reservationStatus = newValue ? 'checked-in' : 'confirmed';
          // Update first room status
          if (reservations[idx].rooms && reservations[idx].rooms[0]) {
            reservations[idx].rooms[0].status = newValue ? 'checked-in' : 'confirmed';
          }
        }
        // Activity log
        if (!reservations[idx].activityLog) reservations[idx].activityLog = [];
        if (isDeparting) {
          reservations[idx].activityLog.push({ id: Date.now(), timestamp: Date.now(), action: newValue ? 'Checked out' : 'Check-out undone', user: 'Sophie' });
        } else {
          reservations[idx].activityLog.push({ id: Date.now(), timestamp: Date.now(), action: newValue ? `Checked in at ${newValue}` : 'Check-in undone', user: 'Sophie' });
        }
        saveReservationSingle(reservations[idx]);
      }
      return { ...prev, [resId]: newValue };
    });
  };

  // Close popups on Escape or click outside
  const popupOpenRef = React.useRef({ actionMenu: false, changeRoom: null });
  popupOpenRef.current = { actionMenu: showActionMenu, changeRoom: changeRoomTarget };
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') { setShowActionMenu(false); setChangeRoomTarget(null); } };
    const handleClick = (e) => {
      if (e.target.closest('select') || e.target.closest('option')) return;
      const { actionMenu, changeRoom } = popupOpenRef.current;
      if ((actionMenu || changeRoom !== null) && !e.target.closest('[data-popup]')) {
        setShowActionMenu(false);
        setChangeRoomTarget(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Warning toast auto-dismiss (longer: 6s)
  useEffect(() => {
    if (warningToast) {
      const timer = setTimeout(() => setWarningToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [warningToast]);

  // Option auto-cancel: check every 30 seconds for expired options
  useEffect(() => {
    const checkExpired = () => {
      const now = new Date();
      let changed = false;
      reservations.forEach(res => {
        // Reservation-level expiry
        if (res.reservationStatus === 'option' && res.optionExpiry) {
          const expiry = new Date(res.optionExpiry);
          if (expiry <= now) {
            res.reservationStatus = 'cancelled';
            res.optionExpiry = null;
            res.rooms.forEach(room => { room.status = 'cancelled'; room.optionExpiry = null; });
            res.activityLog = res.activityLog || [];
            res.activityLog.push({ id: Date.now(), timestamp: now.getTime(), action: 'Option expired → auto-cancelled', user: 'System' });
            changed = true;
          }
        }
        // Room-level expiry (individual rooms can expire independently)
        if (res.rooms) {
          res.rooms.forEach(room => {
            if (room.status === 'option' && room.optionExpiry) {
              const expiry = new Date(room.optionExpiry);
              if (expiry <= now) {
                room.status = 'cancelled';
                room.optionExpiry = null;
                changed = true;
              }
            }
          });
          // If all rooms are cancelled after room-level expiry, cancel the reservation too
          if (res.rooms.length > 0 && res.rooms.every(r => r.status === 'cancelled') && res.reservationStatus !== 'cancelled') {
            res.reservationStatus = 'cancelled';
            res.optionExpiry = null;
            res.activityLog = res.activityLog || [];
            res.activityLog.push({ id: Date.now(), timestamp: now.getTime(), action: 'All rooms expired → auto-cancelled', user: 'System' });
            changed = true;
          }
        }
      });
      if (changed) {
        saveReservations();
        setToastMessage('Option(s) expired — reservation auto-cancelled');
        // If currently viewing an expired reservation, refresh the editing copy
        if (selectedReservation) {
          const fresh = reservations.find(r => r.id === selectedReservation.id);
          if (fresh && fresh.reservationStatus === 'cancelled') {
            setSelectedReservation({ ...fresh, checkin: new Date(fresh.checkin), checkout: new Date(fresh.checkout) });
          }
        }
      }
    };
    const timer = setInterval(checkExpired, 30000);
    checkExpired(); // Run once immediately
    return () => clearInterval(timer);
  }, [selectedReservation]);

  // Reminder auto-fire: check every 30 seconds for due reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      let changed = false;
      reservations.forEach(res => {
        if (!res.reminders) return;
        res.reminders.forEach(rem => {
          if (!rem.toastShown && !rem.fired && new Date(rem.dueDate) <= now) {
            rem.toastShown = true;
            const guestName = res.guest || res.booker?.firstName || 'Reservation';
            setToastMessage(`${guestName}: ${rem.message}`);
            res.activityLog = res.activityLog || [];
            res.activityLog.push({ id: Date.now(), timestamp: now.getTime(), action: `Reminder fired: "${rem.message}"`, user: 'System' });
            changed = true;
          }
        });
      });
      if (changed) {
        saveReservations();
        if (selectedReservation) {
          const fresh = reservations.find(r => r.id === selectedReservation.id);
          if (fresh) {
            setSelectedReservation({ ...fresh, checkin: new Date(fresh.checkin), checkout: new Date(fresh.checkout) });
          }
        }
        if (editingReservation) {
          const freshEd = reservations.find(r => r.id === editingReservation.id);
          if (freshEd) {
            setEditingReservation(prev => {
              const next = JSON.parse(JSON.stringify(prev));
              next.reminders = JSON.parse(JSON.stringify(freshEd.reminders || []));
              next.activityLog = JSON.parse(JSON.stringify(freshEd.activityLog || []));
              return next;
            });
          }
        }
      }
    };
    const timer = setInterval(checkReminders, 10000);
    checkReminders();
    return () => clearInterval(timer);
  }, [selectedReservation, editingReservation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        // Exception: Escape should still close modals
        if (e.key === 'Escape') {
          setSearchOpen(false);
          setNewReservationOpen(false);
          setInvoiceOpen(false);
          setMessagesOpen(false);
        }
        return;
      }

      // Ctrl+K: Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
        setSearchQuery('');
        return;
      }

      // Escape: Close modals (before mod check so it works without modifier)
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNewReservationOpen(false);
        setInvoiceOpen(false);
        setMessagesOpen(false);
        return;
      }

      // Modifier: Alt on Windows/Linux, Ctrl on Mac
      const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
      const mod = isMac ? e.ctrlKey : e.altKey;
      if (!mod) return;

      // Mod+N: New Reservation
      if (e.key === 'n') {
        e.preventDefault();
        setNewReservationOpen(true);
        return;
      }

      // Mod+F: Invoice
      if (e.key === 'f') {
        e.preventDefault();
        setInvoiceOpen(true);
        return;
      }

      // Mod+1: Dashboard
      if (e.key === '1') {
        e.preventDefault();
        setActivePage('dashboard'); setSelectedReservation(null);
        return;
      }

      // Mod+2: Calendar
      if (e.key === '2') {
        e.preventDefault();
        setActivePage('calendar'); setSelectedReservation(null);
        return;
      }

      // Mod+3: Housekeeping
      if (e.key === '3') {
        e.preventDefault();
        setActivePage('housekeeping'); setSelectedReservation(null);
        return;
      }

      // Mod+4: F&B
      if (e.key === '4') {
        e.preventDefault();
        setActivePage('fb'); setSelectedReservation(null);
        return;
      }

      // Mod+5: Reports
      if (e.key === '5') {
        e.preventDefault();
        setActivePage('reports'); setSelectedReservation(null);
        return;
      }

      // Mod+M: Messages
      if (e.key === 'm') {
        e.preventDefault();
        setMessagesOpen(prev => !prev);
        return;
      }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 50);
    }
  }, [searchOpen]);

  // Sla housekeeping status op in localStorage bij wijzigingen
  useEffect(() => {
    try {
      localStorage.setItem('housekeepingStatus', JSON.stringify(housekeepingStatus));
    } catch (e) {
      console.error('Error saving housekeeping status:', e);
    }
  }, [housekeepingStatus]);

  const totalRooms = getAllRooms().length;

  // Navigation Tabs
  const navTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Home },
    { id: 'calendar', label: 'Calendar', icon: Icons.Calendar },
    { id: 'housekeeping', label: 'Housekeeping', icon: Icons.Sparkles },
    { id: 'fb', label: 'F&B', icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    )},
  ];

  // ── View Props bundle ────────────────────────────────────────────────
  const vp = {
    time, selectedDate, setSelectedDate, activePage, setActivePage,
    profileSelectedProfile, setProfileSelectedProfile, profileEditingProfile, setProfileEditingProfile,
    profileSourceReservation, setProfileSourceReservation, profileSourceTab, setProfileSourceTab,
    quickView, mounted, selectedReservation, setSelectedReservation,
    previousPage, setPreviousPage, reservationTab, setReservationTab,
    billSelected, setBillSelected, billSplitMode, setBillSplitMode,
    billPaySelected, setBillPaySelected, billRecipientOverride, setBillRecipientOverride,
    billCustomLabels, setBillCustomLabels, amendingInvoice, setAmendingInvoice,
    billTransferMode, setBillTransferMode, billTransferSearch, setBillTransferSearch,
    billTransferTarget, setBillTransferTarget, billTransferSelected, setBillTransferSelected,
    amendRecipient, setAmendRecipient, sidebarCollapsed, setSidebarCollapsed,
    activeFilter, setActiveFilter, calendarActiveFilter, setCalendarActiveFilter,
    calColWidth, setCalColWidth, calDatePickerOpen, setCalDatePickerOpen, calViewMode, setCalViewMode,
    checkedInRooms, housekeepingTab, setHousekeepingTab, fbTab, setFbTab,
    roomGridMode, setRoomGridMode, activeGuestTab, setActiveGuestTab,
    guestSearchActive, setGuestSearchActive, expandedRooms, setExpandedRooms,
    pendingDateChange, setPendingDateChange, addRoomDates, setAddRoomDates,
    searchOpen, setSearchOpen, searchQuery, setSearchQuery,
    newReservationOpen, setNewReservationOpen, invoiceOpen, setInvoiceOpen,
    messagesOpen, setMessagesOpen, messages, setMessages,
    activeConversation, setActiveConversation, showCompose, setShowCompose,
    editingReservation, setEditingReservation, showActionMenu, setShowActionMenu,
    changeRoomTarget, setChangeRoomTarget, toastMessage, setToastMessage,
    housekeepingStatus, setHousekeepingStatus, totalRooms,
    messageInputRef, messagesEndRef, searchInputRef, focusValRef, addRoomRef, dragPaymentRef,
    showCheckoutWarning, toggleCheckInOut, setTime,
  };

  // Main render with view switching
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top Navigation Bar with Tabs */}
      <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50 backdrop-blur-xl bg-white/80">
        <div className="px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Navigation Tabs */}
            <div className="flex items-center gap-4 md:gap-8">
              {/* Mobile hamburger */}
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-neutral-100 rounded-xl transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center">
                  <Icons.Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Rumo</div>
                  <div className="text-xs text-neutral-500 tabular-nums flex items-center gap-1.5">
                    {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    <span className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'idle' ? 'bg-emerald-400' : cloudStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : cloudStatus === 'error' ? 'bg-red-400' : 'bg-neutral-300'}`} title={cloudStatus === 'idle' ? 'Cloud synced' : cloudStatus === 'syncing' ? 'Syncing...' : cloudStatus === 'error' ? 'Sync error' : 'Offline'} />
                  </div>
                </div>
              </div>

              {/* Navigation Tabs - hidden on mobile */}
              <div className="hidden md:flex gap-2">
                {navTabs.map(tab => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActivePage(tab.id); setSelectedReservation(null); }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        activePage === tab.id
                          ? 'bg-neutral-900 text-white shadow-lg'
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Side - Stats & Actions */}
            <div className="flex items-center gap-3 md:gap-6">
              {/* New Reservation Button */}
              <button data-tour="new-res-btn" onClick={() => setNewReservationOpen(true)}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors duration-200 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/>
                  <path d="M12 5v14"/>
                </svg>
                New
              </button>

              {/* Search button (opens Ctrl+K modal) */}
              <button data-tour="search-btn" onClick={() => { setSearchOpen(true); setSearchQuery(''); }}
                className="flex items-center gap-3 pl-3 pr-3 py-2 w-auto flex-1 md:w-56 md:flex-none bg-neutral-100 rounded-xl text-sm text-neutral-400 hover:bg-neutral-200 transition-all duration-200 cursor-pointer">
                <Icons.Search className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline flex-1 text-left">Search...</span>
                <kbd className="hidden md:inline px-1.5 py-0.5 bg-white rounded-md text-[11px] font-medium text-neutral-400 border border-neutral-200">Ctrl+K</kbd>
              </button>

              {/* Tour help button */}
              <button onClick={() => setTourActive(activePage)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200" title="Start guided tour">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-neutral-600">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </button>

              {/* Messages */}
              <button onClick={() => setMessagesOpen(prev => !prev)} className="relative p-2 hover:bg-neutral-100 rounded-xl transition-colors duration-200">
                <Icons.Bell className="w-5 h-5 text-neutral-600" />
                {(() => {
                  const dmUnread = messages.filter(m => m.to === currentUserId && !m.read).length;
                  const groupUnread = messages.filter(m => m.readBy && !m.readBy.includes(currentUserId) && m.from !== currentUserId).length;
                  const remindersDue = reservations.reduce((c, r) => c + (r.reminders || []).filter(rem => !rem.fired && new Date(rem.dueDate) <= new Date()).length, 0);
                  const total = dmUnread + groupUnread + remindersDue;
                  return total > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm">
                      {total}
                    </span>
                  ) : null;
                })()}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Slide-out Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-slideIn">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
                  <Icons.Home className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-neutral-900">Rumo</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3">
              {[
                { id: 'dashboard', label: 'Reservations', icon: Icons.Calendar },
                { id: 'calendar', label: 'Calendar', icon: Icons.Calendar },
                { id: 'housekeeping', label: 'Housekeeping', icon: Icons.Sparkles },
                { id: 'fb', label: 'F&B', icon: navTabs[3].icon },
                { id: 'channelmanager', label: 'Channel Manager', icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg> },
                { id: 'profiles', label: 'Profiles', icon: Icons.Users },
                { id: 'payments', label: 'Payments', icon: Icons.CreditCard },
                { id: 'reports', label: 'Reports', icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                { id: 'settings', label: 'Settings', icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
              ].map(tab => {
                const IconComp = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { setActivePage(tab.id); setSelectedReservation(null); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                      activePage === tab.id ? 'bg-neutral-100 text-neutral-900 font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}>
                    <IconComp className="w-[18px] h-[18px] flex-shrink-0" width="18" height="18" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-neutral-100 text-xs text-neutral-400">Rumo &copy; All Rights Reserved</div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around py-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Icons.Home },
            { id: 'housekeeping', label: 'Housekeeping', icon: Icons.Sparkles },
            { id: 'fb', label: 'F&B', icon: navTabs[3].icon },
            { id: 'messages', label: 'Messages', icon: Icons.Bell },
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = tab.id === 'messages' ? messagesOpen : activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'messages') { setMessagesOpen(prev => !prev); }
                  else { setActivePage(tab.id); setSelectedReservation(null); setMessagesOpen(false); }
                }}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors duration-200 relative ${
                  isActive ? 'text-neutral-900' : 'text-neutral-400'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-[11px] font-medium">{tab.label}</span>
                {tab.id === 'messages' && (() => {
                  const dmUnread = messages.filter(m => m.to === currentUserId && !m.read).length;
                  const groupUnread = messages.filter(m => m.readBy && !m.readBy.includes(currentUserId) && m.from !== currentUserId).length;
                  const remindersDue = reservations.reduce((c, r) => c + (r.reminders || []).filter(rem => !rem.fired && new Date(rem.dueDate) <= new Date()).length, 0);
                  const total = dmUnread + groupUnread + remindersDue;
                  return total > 0 ? (
                    <span className="absolute top-0 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {total}
                    </span>
                  ) : null;
                })()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content - View Switching */}
      <div className="pb-16 md:pb-0">
      {selectedReservation ? (
        <ReservationDetailView {...vp} />
      ) : (
        <>
          {activePage === 'dashboard' && <DashboardView {...vp} />}
          {activePage === 'calendar' && <CalendarView {...vp} />}
          {activePage === 'housekeeping' && <HousekeepingView {...vp} />}
          {activePage === 'fb' && <FBView {...vp} />}
          {activePage === 'profiles' && <ProfilesView {...vp} />}
          {activePage === 'reports' && <ReportsView {...vp} />}
          {activePage === 'payments' && <PaymentsView {...vp} />}
          {activePage === 'channelmanager' && <ChannelManagerView {...vp} />}
          {activePage === 'settings' && <SettingsView {...vp} />}
        </>
      )}
      </div>

      {/* Modals */}
      <SearchModal {...vp} />
      <NewReservationModal {...vp} />
      <InvoiceModal {...vp} />
      <MessagesPanel {...vp} />

      {/* Toast Notification */}
      {/* Keep prices popup — shown after any date change */}
      {pendingDateChange && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center" onClick={() => setPendingDateChange(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 px-6 py-4 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-neutral-700 font-medium">Keep existing prices?</span>
            <div className="flex gap-3">
              <button onClick={() => {
                const next = pendingDateChange.next;
                const curEd = editingReservation;
                const roomIndices = pendingDateChange.source === 'room' ? [pendingDateChange.roomIndex] : next.rooms.map((_, i) => i);
                roomIndices.forEach(ri => {
                  const room = next.rooms[ri];
                  const ci = new Date(room.checkin);
                  const co = new Date(room.checkout);
                  const existingMap = {};
                  (curEd?.rooms?.[ri]?.nightPrices || []).forEach(n => { existingMap[n.date] = n.amount; });
                  const nights = [];
                  for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
                    const key = d.toISOString().slice(0, 10);
                    nights.push({ date: key, amount: existingMap[key] || 0 });
                  }
                  next.rooms[ri].nightPrices = nights;
                });
                deriveReservationDates(next);
                setEditingReservation(next);
                setPendingDateChange(null);
              }}
                className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors">
                Keep prices
              </button>
              <button onClick={() => {
                const next = pendingDateChange.next;
                const roomIndices = pendingDateChange.source === 'room' ? [pendingDateChange.roomIndex] : next.rooms.map((_, i) => i);
                roomIndices.forEach(ri => {
                  const room = next.rooms[ri];
                  const ci = new Date(room.checkin);
                  const co = new Date(room.checkout);
                  const nights = [];
                  for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
                    nights.push({ date: d.toISOString().slice(0, 10), amount: 0 });
                  }
                  next.rooms[ri].nightPrices = nights;
                });
                deriveReservationDates(next);
                setEditingReservation(next);
                setPendingDateChange(null);
              }}
                className="px-4 py-2 bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors">
                Reset prices
              </button>
            </div>
          </div>
        </div>
      )}
      {warningToast && (
        <div className="fixed bottom-32 md:bottom-16 left-1/2 -translate-x-1/2 z-[201] max-w-2xl w-[calc(100%-2rem)]"
          style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-amber-50 border border-amber-300 rounded-2xl shadow-2xl px-5 py-3.5">
            <div className="flex items-start gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-amber-900">Check-out warning</div>
                <div className="text-xs text-amber-800 mt-0.5">{warningToast.message}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => {
                  const res = reservations.find(r => r.id === warningToast.resId);
                  if (res) { setSelectedReservation(res); setReservationTab('billing'); }
                  setWarningToast(null);
                }} className="text-xs font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap">
                  View billing
                </button>
                <button onClick={() => setWarningToast(null)} className="p-0.5 hover:bg-amber-100 rounded-lg transition-colors">
                  <Icons.X className="w-3.5 h-3.5 text-amber-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-neutral-900 text-white rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-3"
          style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <Icons.Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Spotlight Tour */}
      {tourActive && <SpotlightTour tourId={tourActive} onComplete={() => setTourActive(null)} />}
    </div>
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ModernHotelPMS />);