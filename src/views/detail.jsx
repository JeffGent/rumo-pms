import React, { useState, useRef } from 'react';
import globals from '../globals.js';
import Icons from '../icons.jsx';
import { formatDate } from '../utils.js';
import { canAccessPage, getExtraPrice } from '../config.js';
import { saveReservationSingle } from '../supabase.js';
import { resolveTemplateVariables } from '../components/emailengine.js';
import EmailPreviewModal from '../components/emailpreview.jsx';
import DetailOverviewTab from './detail-overview.jsx';
import DetailRoomsTab from './detail-rooms.jsx';
import DetailBillingTab from './detail-billing.jsx';
import DetailMessagesTab from './detail-messages.jsx';

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
    billTransferMode, setBillTransferMode, billTransferSearch, setBillTransferSearch,
    billTransferTarget, setBillTransferTarget, billTransferSelected, setBillTransferSelected,
    setToastMessage, focusValRef, addRoomRef, dragPaymentRef,
    housekeepingStatus,
    showCheckoutWarning, setProfileSelectedProfile, setProfileEditingProfile,
    setProfileSourceReservation, setProfileSourceTab,
  } = props;
  const reservation = selectedReservation;
  const ed = editingReservation;
  if (!reservation || !ed) return null;
  const [pricingOpen, setPricingOpen] = useState({});
  const [inventoryPopup, setInventoryPopup] = useState(null); // { catName, nights: [{ date, label, used, limit, full }], qty, cat, ci, co }
  const [inventorySelected, setInventorySelected] = useState(new Set()); // selected night indices
  const inventoryPendingRef = useRef(false); // guard against select double-fire
  const [confirmBTPayment, setConfirmBTPayment] = useState(null); // payment id for bank transfer confirm popup

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
  const commonRatePlanName = allSameRatePlan ? (globals.ratePlans.find(rp => rp.id === roomRatePlanIds[0])?.name || '') : '';

  const goBack = () => {
    setSelectedReservation(null);
    setReservationTab('overview');
    exitTransferMode();
  };

  // ── Transfer helpers ──────────────────────────────────────────────────────
  const searchTransferTargets = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return globals.reservations.filter(r =>
      r.id !== ed.id && (
        (r.bookingRef && r.bookingRef.toLowerCase().includes(q)) ||
        (r.otaRef && r.otaRef.toLowerCase().includes(q)) ||
        (r.guest && r.guest.toLowerCase().includes(q))
      )
    ).slice(0, 5);
  };

  const exitTransferMode = () => {
    setBillTransferMode(null);
    setBillTransferSearch('');
    setBillTransferTarget(null);
    setBillTransferSelected([]);
  };

  const assignPaymentsToInvoice = (inv) => {
    if (!inv || billTransferSelected.length === 0) return;
    const next = JSON.parse(JSON.stringify(ed));
    let linked = 0;
    billTransferSelected.forEach(payId => {
      const p = next.payments.find(pp => pp.id === payId);
      if (p && p.status === 'completed' && p.linkedInvoice !== inv.number) {
        // Unlink from old invoice if reassigning
        if (p.linkedInvoice) {
          const oldInv = next.invoices.find(ii => ii.number === p.linkedInvoice);
          if (oldInv && oldInv.linkedPayments) oldInv.linkedPayments = oldInv.linkedPayments.filter(id => id !== payId);
        }
        p.linkedInvoice = inv.number;
        const invObj = next.invoices.find(ii => ii.id === inv.id);
        if (invObj) { if (!invObj.linkedPayments) invObj.linkedPayments = []; invObj.linkedPayments.push(payId); }
        linked++;
      }
    });
    if (linked > 0) {
      const total = billTransferSelected.reduce((s, payId) => { const p = next.payments.find(pp => pp.id === payId); return s + (p ? p.amount : 0); }, 0);
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `${linked} payment(s) (EUR ${total.toFixed(2)}) linked to ${inv.number}`, user: globals.currentUser?.name || 'System' });
      setEditingReservation(next);
      setToastMessage(`${linked} payment(s) linked to ${inv.number}`);
    }
    exitTransferMode();
  };

  const executeTransfer = () => {
    if (!billTransferTarget || billTransferSelected.length === 0) return;
    const targetIdx = globals.reservations.findIndex(r => r.id === billTransferTarget.id);
    if (targetIdx === -1) { setToastMessage('Target reservation not found'); return; }

    const next = JSON.parse(JSON.stringify(ed));
    const target = JSON.parse(JSON.stringify(globals.reservations[targetIdx]));

    if (billTransferMode === 'items') {
      const extrasToMove = [];
      billTransferSelected.forEach(extraId => {
        const idx = next.extras.findIndex(ex => ex.id === extraId);
        if (idx !== -1) { extrasToMove.push(next.extras[idx]); next.extras.splice(idx, 1); }
      });
      const maxId = (target.extras || []).reduce((m, ex) => Math.max(m, ex.id || 0), 0);
      extrasToMove.forEach((ex, i) => {
        target.extras = target.extras || [];
        target.extras.push({ ...ex, id: maxId + i + 1 });
      });
      const names = extrasToMove.map(ex => ex.name).join(', ');
      const total = extrasToMove.reduce((s, ex) => s + (ex.quantity || 0) * (ex.unitPrice || 0), 0);
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Transferred ${extrasToMove.length} item(s) to ${target.bookingRef}: ${names} (EUR ${total.toFixed(2)})`, user: globals.currentUser?.name || 'System' });
      target.activityLog = target.activityLog || [];
      target.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Received ${extrasToMove.length} item(s) from ${next.bookingRef}: ${names} (EUR ${total.toFixed(2)})`, user: globals.currentUser?.name || 'System' });
      setToastMessage(`${extrasToMove.length} item(s) transferred to ${target.bookingRef}`);

    } else if (billTransferMode === 'payments') {
      const paymentsToMove = [];
      billTransferSelected.forEach(payId => {
        const idx = next.payments.findIndex(p => p.id === payId);
        if (idx !== -1 && !next.payments[idx].linkedInvoice) {
          const pay = { ...next.payments[idx], linkedInvoice: null };
          paymentsToMove.push(pay);
          next.payments.splice(idx, 1);
        }
      });
      if (paymentsToMove.length === 0) { setToastMessage('No unlinked payments to move'); exitTransferMode(); return; }
      paymentsToMove.forEach(p => {
        target.payments = target.payments || [];
        target.payments.push({ ...p, id: Date.now() + Math.floor(Math.random() * 10000) });
      });
      const total = paymentsToMove.reduce((s, p) => s + p.amount, 0);
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Transferred ${paymentsToMove.length} payment(s) to ${target.bookingRef} (EUR ${total.toFixed(2)})`, user: globals.currentUser?.name || 'System' });
      target.activityLog = target.activityLog || [];
      target.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Received ${paymentsToMove.length} payment(s) from ${next.bookingRef} (EUR ${total.toFixed(2)})`, user: globals.currentUser?.name || 'System' });
      setToastMessage(`${paymentsToMove.length} payment(s) transferred to ${target.bookingRef}`);
    }

    // Save target directly
    globals.reservations[targetIdx] = target;
    saveReservationSingle(target);
    // Update source via editingReservation (auto-save picks it up)
    setEditingReservation(next);
    exitTransferMode();
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'room', label: 'Rooms & Guests' },
    { id: 'billing', label: 'Billing' },
    { id: 'email', label: 'Messages' },
  ];
  const [emailPreviewTemplate, setEmailPreviewTemplate] = useState(null);
  const [emailExtraData, setEmailExtraData] = useState({});
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false); // for picking which invoice to email
  const [viewingEmailLog, setViewingEmailLog] = useState(null); // log entry to view
  const [moveRoomQuery, setMoveRoomQuery] = useState('');
  const [newExtra, setNewExtra] = useState({ name: '', qty: 1, room: '', vat: '', price: '' });
  const [extraDropdownOpen, setExtraDropdownOpen] = useState(false);
  const [switchBookerOpen, setSwitchBookerOpen] = useState(false);
  const [switchBookerQuery, setSwitchBookerQuery] = useState('');

  // Helper: build extraData for an invoice email
  const buildInvoiceExtraData = (inv) => {
    const currency = globals.hotelSettings.currency || 'EUR';
    const lines = (inv.items || []).map(item =>
      `${item.label}${item.detail ? ' — ' + item.detail : ''}: ${currency} ${item.amount.toFixed(2)}`
    ).join('\n');
    const subtotal = (inv.items || []).reduce((s, i) => s + (i.exVat != null ? i.exVat : i.amount / (1 + (i.vatRate || 0) / 100)), 0);
    const vatAmount = inv.amount - subtotal;
    return {
      invoiceNumber: inv.number,
      invoiceDate: inv.date,
      invoiceLines: lines,
      invoiceTotal: inv.amount.toFixed(2),
      invoiceSubtotal: subtotal.toFixed(2),
      invoiceVat: vatAmount.toFixed(2),
      _invoiceId: inv.id,
    };
  };

  // Helper: open invoice email preview (handles single vs multiple invoices)
  const openInvoiceEmail = (forcedInvoice) => {
    const invoices = (ed.invoices || []).filter(i => i.status !== 'credited' && i.type !== 'credit');
    if (forcedInvoice) {
      setEmailExtraData(buildInvoiceExtraData(forcedInvoice));
      setEmailPreviewTemplate('tpl-invoice');
    } else if (invoices.length === 1) {
      setEmailExtraData(buildInvoiceExtraData(invoices[0]));
      setEmailPreviewTemplate('tpl-invoice');
    } else if (invoices.length > 1) {
      setInvoicePickerOpen(true);
    } else {
      setToastMessage('No invoices to send');
    }
  };

  // Helper: add a catalog extra (handles auto-qty, inventory check, etc.)
  const addCatalogExtra = (catName, overrideQty) => {
    if (inventoryPendingRef.current) return;
    const cat = globals.extrasCatalog.find(c => c.name === catName);
    if (!cat) return;
    let qty = overrideQty || newExtra.qty || 1;
    const guests = ed.guestCount || 1;
    const ci = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
    const co = ed.rooms?.[0] ? new Date(ed.rooms[0].checkout) : new Date(ed.checkout);
    const nights = Math.max(1, Math.round((co - ci) / 86400000));
    let autoQty = 1;
    if (cat.perPerson && cat.perNight) autoQty = guests * nights;
    else if (cat.perPerson) autoQty = guests;
    else if (cat.perNight) autoQty = nights;
    if (qty === 1 && autoQty > 1) qty = autoQty;
    if (!cat.multipleBookable && qty > Math.max(1, autoQty)) qty = Math.max(1, autoQty);

    // Daily inventory check
    if (cat.dailyInventory && cat.dailyInventoryLimit > 0) {
      const ci2 = new Date(ci); ci2.setHours(0,0,0,0);
      const co2 = new Date(co); co2.setHours(0,0,0,0);
      const nightsInfo = [];
      let hasFullNight = false;
      for (let d = new Date(ci2); d < co2; d.setDate(d.getDate() + 1)) {
        let dayCount = 0;
        globals.reservations.forEach(r => {
          if (r.id === ed.id) return;
          const st = r.reservationStatus || 'confirmed';
          if (st === 'cancelled' || st === 'no-show' || st === 'blocked') return;
          const rCi = new Date(r.checkin); rCi.setHours(0,0,0,0);
          const rCo = new Date(r.checkout); rCo.setHours(0,0,0,0);
          if (d >= rCi && d < rCo) {
            const rNights = Math.max(1, Math.round((rCo - rCi) / 86400000));
            (r.extras || []).forEach(ex => {
              if (ex.name === cat.name) dayCount += cat.perNight ? Math.round(ex.quantity / rNights) : ex.quantity;
            });
          }
        });
        const edNights = Math.max(1, Math.round((co2 - ci2) / 86400000));
        (ed.extras || []).forEach(ex => {
          if (ex.name === cat.name) dayCount += cat.perNight ? Math.round(ex.quantity / edNights) : ex.quantity;
        });
        const full = dayCount >= cat.dailyInventoryLimit;
        if (full) hasFullNight = true;
        nightsInfo.push({ date: new Date(d).toISOString().slice(0, 10), label: new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), used: dayCount, limit: cat.dailyInventoryLimit, full });
      }
      if (hasFullNight) {
        inventoryPendingRef.current = true;
        setInventorySelected(new Set(nightsInfo.map((n, i) => !n.full ? i : null).filter(i => i !== null)));
        setInventoryPopup({ catName: cat.name, nights: nightsInfo, qty, cat, ci, co });
        setNewExtra({ name: '', qty: 1, room: '', vat: '', price: '' });
        setExtraDropdownOpen(false);
        return;
      }
    }

    const next = JSON.parse(JSON.stringify(ed));
    const newId = (next.extras || []).reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
    next.extras = next.extras || [];
    next.extras.push({ id: newId, name: cat.name, quantity: qty, room: null, vatRate: cat.defaultVat, unitPrice: getExtraPrice(cat, ci) });
    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Extra added: ${cat.name} x${qty}`, user: globals.currentUser?.name || 'System' });
    setEditingReservation(next);
    setNewExtra({ name: '', qty: 1, room: '', vat: '', price: '' });
    setExtraDropdownOpen(false);
  };

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
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: logMsg, user: globals.currentUser?.name || 'System' });
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
    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: actionLabel, user: globals.currentUser?.name || 'System' });
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
      next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${next.rooms[roomIndex].roomNumber}: ${label[oldStatus] || oldStatus} → ${label[newStatus] || newStatus}`, user: globals.currentUser?.name || 'System' });
    }
    setEditingReservation(next);
    if (newStatus === 'checked-out') showCheckoutWarning(next);
  };

  const addToActivityLog = (action) => {
    const next = JSON.parse(JSON.stringify(ed));
    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action, user: globals.currentUser?.name || 'System' });
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

  // ── Props bundle for extracted tab components ─────────────────────────────
  const dp = {
    // Core data
    ed, setEditingReservation, reservation,
    // Shared helpers
    updateEd, updateStatus, updateRoomStatus, addToActivityLog,
    onFocusTrack, onBlurLog, nightsLabel,
    // Navigation / profile
    setProfileSelectedProfile, setProfileEditingProfile,
    setProfileSourceReservation, setProfileSourceTab,
    // Dates
    setPendingDateChange, edCheckin, edCheckout,
    // Email
    setEmailPreviewTemplate, openInvoiceEmail, setViewingEmailLog,
    // UI state
    setToastMessage, focusValRef, showCheckoutWarning, housekeepingStatus,
    // Rooms tab state
    roomGridMode, setRoomGridMode, activeGuestTab, setActiveGuestTab,
    expandedRooms, setExpandedRooms, guestSearchActive, setGuestSearchActive,
    changeRoomTarget, setChangeRoomTarget,
    addRoomDates, setAddRoomDates, addRoomRef,
    moveRoomQuery, setMoveRoomQuery,
    newExtra, setNewExtra, extraDropdownOpen, setExtraDropdownOpen,
    addCatalogExtra, pricingOpen, setPricingOpen,
    // Billing tab state
    dragPaymentRef,
    billSelected, setBillSelected, billSplitMode, setBillSplitMode,
    billPaySelected, setBillPaySelected,
    billRecipientOverride, setBillRecipientOverride,
    billCustomLabels, setBillCustomLabels,
    amendingInvoice, setAmendingInvoice, amendRecipient, setAmendRecipient,
    billTransferMode, setBillTransferMode, billTransferSearch, setBillTransferSearch,
    billTransferTarget, setBillTransferTarget, billTransferSelected, setBillTransferSelected,
    searchTransferTargets, exitTransferMode, assignPaymentsToInvoice, executeTransfer,
    confirmBTPayment, setConfirmBTPayment,
    // Computed billing totals
    roomTotal, extrasTotal, totalAmount, paidAmount, outstandingAmount,
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
                      const bp = globals.bookerProfiles.find(p =>
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
                  <div className="relative" data-popup>
                    <button onClick={() => { setSwitchBookerOpen(!switchBookerOpen); setSwitchBookerQuery(''); }}
                      title="Switch booker"
                      className={`p-2 border rounded-xl hover:bg-neutral-50 transition-colors flex items-center ${switchBookerOpen ? 'border-neutral-900 text-neutral-900' : 'border-neutral-200 text-neutral-500'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                    </button>
                    {switchBookerOpen && (() => {
                      const q = switchBookerQuery.toLowerCase();
                      const currentName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim().toLowerCase();
                      // Search booker profiles
                      const bookerMatches = q.length >= 1 ? globals.bookerProfiles.filter(bp => {
                        const name = `${bp.firstName || ''} ${bp.lastName || ''}`.trim().toLowerCase();
                        if (name === currentName) return false;
                        return name.includes(q) || (bp.email || '').toLowerCase().includes(q) || (bp.phone || '').includes(q);
                      }).slice(0, 6) : [];
                      // Search other reservations' bookers (not in profiles yet)
                      const resBooerMatches = q.length >= 2 ? (() => {
                        const profileEmails = new Set(globals.bookerProfiles.map(bp => bp.email).filter(Boolean));
                        const seen = new Set();
                        return globals.reservations.filter(r => {
                          if (r.id === reservation.id) return false;
                          const name = `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.trim();
                          const email = r.booker?.email || '';
                          if (!name || seen.has(name.toLowerCase()) || name.toLowerCase() === currentName) return false;
                          if (email && profileEmails.has(email)) return false;
                          seen.add(name.toLowerCase());
                          return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
                        }).slice(0, 4).map(r => r.booker);
                      })() : [];

                      const applyBooker = (booker) => {
                        const oldName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim();
                        const newName = `${booker.firstName || ''} ${booker.lastName || ''}`.trim();
                        const next = JSON.parse(JSON.stringify(ed));
                        next.booker = { ...next.booker, firstName: booker.firstName || '', lastName: booker.lastName || '', email: booker.email || '', phone: booker.phone || '' };
                        if (booker.language) next.booker.language = booker.language;
                        next.guest = newName;
                        next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Booker changed: ${oldName} → ${newName}`, user: globals.currentUser?.name || 'System' });
                        setEditingReservation(next);
                        setSwitchBookerOpen(false);
                        setSwitchBookerQuery('');
                        setToastMessage(`Booker changed to ${newName}`);
                      };

                      return (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-neutral-200 z-50 overflow-hidden">
                          <div className="p-3 border-b border-neutral-100">
                            <input value={switchBookerQuery}
                              onChange={(e) => setSwitchBookerQuery(e.target.value)}
                              placeholder="Search by name, email or phone..."
                              className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                              autoFocus />
                          </div>
                          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {bookerMatches.map(bp => (
                              <button key={bp.id} onClick={() => applyBooker(bp)}
                                className="w-full px-3 py-2 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0">
                                <div className="text-xs font-medium text-neutral-900">{bp.firstName} {bp.lastName}</div>
                                <div className="text-[11px] text-neutral-400">{[bp.email, bp.phone].filter(Boolean).join(' · ')}</div>
                              </button>
                            ))}
                            {resBooerMatches.map((b, i) => (
                              <button key={`res-${i}`} onClick={() => applyBooker(b)}
                                className="w-full px-3 py-2 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0">
                                <div className="text-xs font-medium text-neutral-900">{b.firstName} {b.lastName}</div>
                                <div className="text-[11px] text-neutral-400">{[b.email, b.phone].filter(Boolean).join(' · ')}</div>
                              </button>
                            ))}
                            {q.length >= 1 && bookerMatches.length === 0 && resBooerMatches.length === 0 && (
                              <div className="px-3 py-3 text-xs text-neutral-400 text-center">No matches found</div>
                            )}
                          </div>
                          {/* New booker option */}
                          <div className="border-t border-neutral-100">
                            <button onClick={() => {
                                const next = JSON.parse(JSON.stringify(ed));
                                const oldName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim();
                                next.booker = { firstName: '', lastName: '', email: '', phone: '', language: ed.booker?.language || 'en' };
                                next.guest = '';
                                next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Booker cleared (was: ${oldName})`, user: globals.currentUser?.name || 'System' });
                                setEditingReservation(next);
                                setSwitchBookerOpen(false);
                                setSwitchBookerQuery('');
                                setToastMessage('Booker cleared — fill in new details');
                              }}
                              className="w-full px-3 py-2.5 text-left hover:bg-amber-50 transition-colors flex items-center gap-2">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              <span className="text-xs font-medium text-neutral-600">New booker</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
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
                <button key={tab.id} onClick={() => { setReservationTab(tab.id); setAmendingInvoice(null); setAmendRecipient(null); exitTransferMode(); }}
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

          {reservationTab === 'overview' && <DetailOverviewTab dp={dp} />}
          {reservationTab === 'room' && <DetailRoomsTab dp={dp} />}
          {reservationTab === 'billing' && <DetailBillingTab dp={dp} />}
          {reservationTab === 'email' && <DetailMessagesTab dp={dp} />}

          {/* Email Preview Modal */}
          {emailPreviewTemplate && (
            <EmailPreviewModal
              templateId={emailPreviewTemplate}
              reservation={ed}
              extraData={emailExtraData}
              onClose={() => { setEmailPreviewTemplate(null); setEmailExtraData({}); }}
              onSend={(logEntry) => {
                const next = JSON.parse(JSON.stringify(ed));
                if (!next.emailLog) next.emailLog = [];
                next.emailLog.push(logEntry);
                next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Email sent: ${logEntry.templateName} to ${logEntry.sentTo}`, user: globals.currentUser?.name || 'System' });
                // Auto-reminder for credit card request (24h)
                const tpl = globals.emailTemplates.find(t => t.id === logEntry.templateId);
                if (tpl?.type === 'cc-request' && logEntry.status === 'sent') {
                  if (!next.reminders) next.reminders = [];
                  const reminderDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                  next.reminders.push({ id: Date.now() + 3, message: `Check credit card request (${logEntry.sentTo})`, dueDate: reminderDue, createdAt: Date.now(), fired: false, toastShown: false });
                  next.activityLog.push({ id: Date.now() + 4, timestamp: Date.now(), action: `Reminder set: check credit card request in 24h`, user: 'System' });
                }
                setEditingReservation(next);
                setToastMessage(`Email sent to ${logEntry.sentTo}`);
              }}
            />
          )}

          {/* Invoice Picker Modal — when multiple invoices exist */}
          {invoicePickerOpen && (() => {
            const invoices = (ed.invoices || []).filter(i => i.status !== 'credited' && i.type !== 'credit');
            return (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={() => setInvoicePickerOpen(false)}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-900">Which invoice?</div>
                    <button onClick={() => setInvoicePickerOpen(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
                    {invoices.map(inv => (
                      <button key={inv.id} onClick={() => {
                        setInvoicePickerOpen(false);
                        openInvoiceEmail(inv);
                      }}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors text-left">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${inv.type === 'proforma' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {inv.type === 'proforma' ? 'PRO' : 'INV'}
                          </span>
                          <div>
                            <div className="text-xs font-medium text-neutral-900">{inv.number}</div>
                            <div className="text-[10px] text-neutral-400">{inv.date}{inv.recipient?.name ? ` · ${inv.recipient.name}` : ''}</div>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-neutral-900">{globals.hotelSettings.currency || 'EUR'} {inv.amount.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Email Log Viewer Modal — re-renders template on demand (no HTML stored) */}
          {viewingEmailLog && (() => {
            const log = viewingEmailLog;
            const tpl = globals.emailTemplates.find(t => t.id === log.templateId);
            if (!tpl) return null;
            const lang = log.language || 'en';
            const tr = tpl.translations?.[lang];
            const bodyField = (tr && tr.bodyHtml) ? tr.bodyHtml : (tpl.bodyHtml || '');
            const renderedHtml = resolveTemplateVariables(bodyField, ed, { _roomIndex: log._roomIndex || 0 });
            return (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={() => setViewingEmailLog(null)}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{log.templateName}{log.roomNumber ? ` · Room ${log.roomNumber}` : ''}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {new Date(log.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{log.sentTo}
                        {log.language && <> · {log.language.toUpperCase()}</>}
                      </div>
                    </div>
                    <button onClick={() => setViewingEmailLog(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <iframe srcDoc={renderedHtml} style={{width: '100%', height: 500, border: 'none'}} sandbox="" title="Sent Email" />
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
                      vatRate: p.cat ? p.cat.defaultVat : (globals.vatRates[0]?.rate ?? 6),
                      unitPrice: p.cat ? getExtraPrice(p.cat, ciDate) : 0,
                    });
                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Extra added: ${p.catName} x${selectedQty}`, user: globals.currentUser?.name || 'System' });
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

export default ReservationDetailView;
