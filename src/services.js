import { toDateStr } from './utils.js';

// ── Services Layer ──────────────────────────────────────────────────────────
// Pure business logic functions extracted from app.js / detail.js.
// No React state dependencies — these are testable, reusable functions.
// ────────────────────────────────────────────────────────────────────────────

export const ReservationService = {

  // ── Billing Calculations ───────────────────────────────────────────────

  /** Calculate room, extras, and outstanding amounts for a reservation */
  calculateBillingTotals(res) {
    const roomTotal = (res.rooms || []).reduce((sum, rm) => {
      if (rm.priceType === 'fixed') return sum + (rm.fixedPrice || 0);
      return sum + (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0);
    }, 0);

    const extrasTotal = (res.extras || []).reduce((sum, ex) =>
      sum + (ex.quantity || 0) * (ex.unitPrice || 0), 0);

    const totalAmount = roomTotal + extrasTotal;

    const invoicedAmount = (res.invoices || [])
      .filter(inv => inv.status !== 'credited' && inv.type !== 'proforma' && inv.type !== 'credit')
      .reduce((s, inv) => s + inv.amount, 0);

    const paidAmount = (res.payments || [])
      .filter(p => p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0);

    return {
      roomTotal,
      extrasTotal,
      totalAmount,
      invoicedAmount,
      paidAmount,
      outstandingAmount: Math.max(0, totalAmount - paidAmount),
      uninvoicedAmount: Math.max(0, totalAmount - invoicedAmount),
    };
  },

  // ── Checkout Validation ────────────────────────────────────────────────

  /** Check for billing issues before checkout. Returns array of warning strings or null. */
  validateCheckout(res) {
    const { totalAmount, uninvoicedAmount, paidAmount } = this.calculateBillingTotals(res);
    if (totalAmount <= 0) return null;

    const parts = [];
    const unpaid = Math.max(0, totalAmount - paidAmount);
    if (unpaid > 0.01) parts.push(`EUR ${unpaid.toFixed(2)} still unpaid`);

    if (uninvoicedAmount > 0.01) parts.push(`EUR ${uninvoicedAmount.toFixed(2)} not yet invoiced`);

    const unlinkedCount = (res.payments || []).filter(p => p.status === 'completed' && !p.linkedInvoice).length;
    if (unlinkedCount > 0) parts.push(`${unlinkedCount} payment${unlinkedCount > 1 ? 's' : ''} not linked to invoice`);

    return parts.length > 0 ? parts : null;
  },

  // ── Status Derivation ─────────────────────────────────────────────────

  /** Derive reservation-level status from room statuses */
  deriveReservationStatus(rooms, currentStatus) {
    const roomStatuses = (rooms || []).map(r => r.status || 'confirmed');
    if (roomStatuses.length === 1) return roomStatuses[0];
    if (roomStatuses.length > 1) {
      const allSame = roomStatuses.every(s => s === roomStatuses[0]);
      if (allSame) return roomStatuses[0];
    }
    return currentStatus; // mixed statuses: keep current
  },

  // ── VCC Auto-Charge ────────────────────────────────────────────────────

  /** Create a VCC auto-charge payment if applicable. Returns payment object or null. */
  createVCCAutoCharge(res, bookerProfilesList) {
    const bp = bookerProfilesList.find(b =>
      (b.email && b.email === res.booker?.email) ||
      (b.firstName === res.booker?.firstName && b.lastName === res.booker?.lastName)
    );
    if (!bp?.creditCard?.isVCC) return null;

    const { outstandingAmount } = this.calculateBillingTotals(res);
    if (outstandingAmount <= 0) return null;

    const maxPid = (res.payments || []).reduce((m, p) => Math.max(m, p.id || 0), 0);
    return {
      id: maxPid + 1,
      date: toDateStr(new Date()),
      amount: Math.round(outstandingAmount * 100) / 100,
      method: `VCC (\u2022\u2022\u2022\u2022 ${bp.creditCard.last4})`,
      note: 'Auto-charged VCC on checkout',
      status: 'completed',
      linkedInvoice: null,
    };
  },

  // ── Activity Log ───────────────────────────────────────────────────────

  /** Create an activity log entry */
  createLogEntry(action, user) {
    return {
      id: Date.now(),
      timestamp: Date.now(),
      action,
      user: user || 'System',
    };
  },

  // ── Option Expiry ──────────────────────────────────────────────────────

  /** Check all reservations for expired options. Mutates in-place, returns true if any changed. */
  processExpiredOptions(resList, now) {
    let changed = false;
    now = now || new Date();

    resList.forEach(res => {
      // Reservation-level expiry
      if (res.reservationStatus === 'option' && res.optionExpiry) {
        if (new Date(res.optionExpiry) <= now) {
          res.reservationStatus = 'cancelled';
          res.optionExpiry = null;
          (res.rooms || []).forEach(room => { room.status = 'cancelled'; room.optionExpiry = null; });
          res.activityLog = res.activityLog || [];
          res.activityLog.push(this.createLogEntry('Option expired \u2192 auto-cancelled'));
          changed = true;
        }
      }
      // Room-level expiry
      if (res.rooms) {
        res.rooms.forEach(room => {
          if (room.status === 'option' && room.optionExpiry && new Date(room.optionExpiry) <= now) {
            room.status = 'cancelled';
            room.optionExpiry = null;
            changed = true;
          }
        });
        // All rooms cancelled → cancel reservation
        if (res.rooms.length > 0 && res.rooms.every(r => r.status === 'cancelled') && res.reservationStatus !== 'cancelled') {
          res.reservationStatus = 'cancelled';
          res.optionExpiry = null;
          res.activityLog = res.activityLog || [];
          res.activityLog.push(this.createLogEntry('All rooms expired \u2192 auto-cancelled'));
          changed = true;
        }
      }
    });

    return changed;
  },

  // ── Reminder Processing ────────────────────────────────────────────────

  /** Check all reservations for due reminders. Mutates in-place, returns array of fired messages. */
  processDueReminders(resList, now) {
    const fired = [];
    now = now || new Date();

    resList.forEach(res => {
      if (!res.reminders) return;
      res.reminders.forEach(rem => {
        if (!rem.toastShown && !rem.fired && new Date(rem.dueDate) <= now) {
          rem.toastShown = true;
          const guestName = res.guest || res.booker?.firstName || 'Reservation';
          fired.push({ resId: res.id, message: `${guestName}: ${rem.message}` });
          res.activityLog = res.activityLog || [];
          res.activityLog.push(this.createLogEntry(`Reminder fired: "${rem.message}"`));
        }
      });
    });

    return fired;
  },

  // ── Deep Path Setter ───────────────────────────────────────────────────

  /** Set a value on a nested object using dot-notation path (e.g. "rooms.0.guests.0.firstName") */
  setByPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      current = keys[i].match(/^\d+$/) ? current[parseInt(keys[i])] : current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  },

  // ── Reservation Validation ─────────────────────────────────────────────

  /** Pure validation — returns array of issues (empty = valid). Does NOT mutate. */
  validateReservation(res) {
    const issues = [];
    if (!res) { issues.push('Reservation is null'); return issues; }
    if (!res.id) issues.push('Missing id');
    if (!res.bookingRef) issues.push('Missing bookingRef');
    if (!res.rooms || !Array.isArray(res.rooms) || res.rooms.length === 0) {
      issues.push('Missing or empty rooms array');
    } else {
      res.rooms.forEach((room, i) => {
        if (!room.roomNumber) issues.push(`Room ${i}: missing roomNumber`);
        if (!room.checkin) issues.push(`Room ${i}: missing checkin`);
        if (!room.checkout) issues.push(`Room ${i}: missing checkout`);
        if (room.checkin && room.checkout) {
          const ci = new Date(room.checkin);
          const co = new Date(room.checkout);
          if (isNaN(ci.getTime())) issues.push(`Room ${i}: invalid checkin date`);
          if (isNaN(co.getTime())) issues.push(`Room ${i}: invalid checkout date`);
          if (!isNaN(ci.getTime()) && !isNaN(co.getTime()) && ci >= co) {
            issues.push(`Room ${i}: checkin >= checkout`);
          }
        }
      });
    }
    return issues;
  },

  /** Ensure required arrays exist on a reservation (mutates in-place). */
  normalizeReservation(res) {
    if (!res) return;
    if (!res.activityLog) res.activityLog = [];
    if (!res.extras) res.extras = [];
    if (!res.payments) res.payments = [];
    if (!res.invoices) res.invoices = [];
  },

};
