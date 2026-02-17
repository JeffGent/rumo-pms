// Generator voor dummy reserveringen (-30 tot +30 dagen)
// ZONDER overlappende reserveringen voor dezelfde kamer
const generateReservations = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rooms = getAllRooms();
  const roomTypeMap = {};
  rooms.forEach(r => { roomTypeMap[r] = getRoomTypeName(r); });
  const guestNames = [
    // Belgian / Flemish
    { firstName: 'Marcel', lastName: 'Kiekeboe' }, { firstName: 'Charlotte', lastName: 'Kiekeboe' },
    { firstName: 'Fanny', lastName: 'Kiekeboe' }, { firstName: 'Konstantinopel', lastName: 'Kiekeboe' },
    { firstName: 'Leon', lastName: 'Van der Neffe' }, { firstName: 'Froefroe', lastName: 'Van der Neffe' },
    { firstName: 'Firmin', lastName: 'Van de Kasseien' }, { firstName: 'Yvonne', lastName: 'Van de Kasseien' },
    { firstName: 'Fernand', lastName: 'Goegebuer' }, { firstName: 'Carmella', lastName: 'Vuylstreke' },
    { firstName: 'Balthazar', lastName: 'Balthazar' }, { firstName: 'Dédé', lastName: 'La Canaille' },
    { firstName: 'Timothea', lastName: 'Triangl' }, { firstName: 'August', lastName: 'Sapperdeboere' },
    { firstName: 'Jules', lastName: 'Porei' }, { firstName: 'Angèle', lastName: 'Stokvis' },
    { firstName: 'Emiel', lastName: 'Van Zwam' }, { firstName: 'Alfons', lastName: 'Munte' },
    { firstName: 'Eduard', lastName: 'Van Krot' }, { firstName: 'Oscar', lastName: 'Wapper' },
    { firstName: 'Bob', lastName: 'Stapper' }, { firstName: 'Georgina', lastName: 'De Vadder' },
    { firstName: 'Dimitri', lastName: 'De Tremmer' }, { firstName: 'Hector', lastName: 'Van den Drommel' },
    { firstName: 'Dick', lastName: 'Van Vooren' }, { firstName: 'Guido', lastName: 'Gezansen' },
    { firstName: 'Rita', lastName: 'Pansen' }, { firstName: 'Willy', lastName: 'Schoeters' },
    { firstName: 'Bernadette', lastName: 'Claessens' }, { firstName: 'Roger', lastName: 'Willems' },
    // Dutch
    { firstName: 'Jan', lastName: 'De Boer' }, { firstName: 'Pieter', lastName: 'Vermeulen' },
    { firstName: 'Anneke', lastName: 'Van Dijk' }, { firstName: 'Henk', lastName: 'Bakker' },
    { firstName: 'Mariëtte', lastName: 'Visser' }, { firstName: 'Bram', lastName: 'Smits' },
    { firstName: 'Sanne', lastName: 'Meijer' }, { firstName: 'Thijs', lastName: 'De Graaf' },
    { firstName: 'Fleur', lastName: 'Mulder' }, { firstName: 'Joris', lastName: 'Bos' },
    { firstName: 'Lies', lastName: 'Hendriks' }, { firstName: 'Ruben', lastName: 'Dekker' },
    { firstName: 'Femke', lastName: 'Dijkstra' }, { firstName: 'Koen', lastName: 'Van Leeuwen' },
    { firstName: 'Maaike', lastName: 'Peters' }, { firstName: 'Daan', lastName: 'Brouwer' },
    { firstName: 'Eline', lastName: 'De Wit' }, { firstName: 'Stijn', lastName: 'Jansen' },
    // German
    { firstName: 'Klaus', lastName: 'Müller' }, { firstName: 'Petra', lastName: 'Schmidt' },
    { firstName: 'Wolfgang', lastName: 'Schneider' }, { firstName: 'Ingrid', lastName: 'Fischer' },
    { firstName: 'Dieter', lastName: 'Weber' }, { firstName: 'Monika', lastName: 'Wagner' },
    { firstName: 'Hans', lastName: 'Becker' }, { firstName: 'Greta', lastName: 'Hoffmann' },
    { firstName: 'Stefan', lastName: 'Richter' }, { firstName: 'Claudia', lastName: 'Klein' },
    // French
    { firstName: 'Pierre', lastName: 'Dupont' }, { firstName: 'Marie', lastName: 'Laurent' },
    { firstName: 'Jean-Luc', lastName: 'Martin' }, { firstName: 'Isabelle', lastName: 'Moreau' },
    { firstName: 'François', lastName: 'Bernard' }, { firstName: 'Nathalie', lastName: 'Robert' },
    { firstName: 'Philippe', lastName: 'Petit' }, { firstName: 'Céline', lastName: 'Duval' },
    // British / American
    { firstName: 'James', lastName: 'Thompson' }, { firstName: 'Sarah', lastName: 'Williams' },
    { firstName: 'Oliver', lastName: 'Brown' }, { firstName: 'Emily', lastName: 'Davies' },
    { firstName: 'Michael', lastName: 'Johnson' }, { firstName: 'Catherine', lastName: 'Wilson' },
    { firstName: 'David', lastName: 'Taylor' }, { firstName: 'Rachel', lastName: 'Clark' },
    // Italian / Spanish
    { firstName: 'Marco', lastName: 'Rossi' }, { firstName: 'Lucia', lastName: 'Bianchi' },
    { firstName: 'Alessandro', lastName: 'Conti' }, { firstName: 'Chiara', lastName: 'Romano' },
    { firstName: 'Carlos', lastName: 'García' }, { firstName: 'María', lastName: 'Fernández' },
    { firstName: 'Pablo', lastName: 'López' }, { firstName: 'Ana', lastName: 'Martínez' },
    // Scandinavian
    { firstName: 'Erik', lastName: 'Lindqvist' }, { firstName: 'Astrid', lastName: 'Johansson' },
    { firstName: 'Lars', lastName: 'Andersen' }, { firstName: 'Sigrid', lastName: 'Nilsen' },
  ];
  // Stay length: 50% 1n, 20% 2n, 10% 3n, 10% 4-5n, 7% 6-8n, 3% 9-14n
  const getRandomStayLength = () => {
    const r = Math.random();
    if (r < 0.50) return 1;
    if (r < 0.70) return 2;
    if (r < 0.80) return 3;
    if (r < 0.90) return 4 + Math.floor(Math.random() * 2);
    if (r < 0.97) return 6 + Math.floor(Math.random() * 3);
    return 9 + Math.floor(Math.random() * 6);
  };
  const extraOptions = [[], [], ['Parking'], ['Breakfast'], ['Parking', 'Breakfast']];
  const bookingSources = ['direct', 'booking.com', 'expedia', 'phone', 'email', 'walk-in', 'agency'];
  const stayPurposes = ['business', 'leisure', 'leisure', 'leisure', 'group', 'event'];
  const nationalities = ['NL', 'NL', 'NL', 'BE', 'BE', 'DE', 'FR', 'GB', 'US', 'IT', 'ES'];
  const etaTimes = ['', '', '', '', '', '14:00', '15:00', '16:00', '17:00', '18:00', '20:00'];
  const emailDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'mail.be', 'telenet.be'];
  const paymentMethods = hotelSettings.paymentMethods || ['Cash', 'Card (PIN)', 'Maestro', 'Mastercard', 'Visa', 'Bank Transfer', 'iDEAL'];

  const reservations = [];
  let resId = 1;

  // Track room occupancy for multi-room reservations
  const roomOccupancy = {};
  rooms.forEach(r => { roomOccupancy[r] = []; });

  const isRoomFree = (room, from, to) => {
    return !roomOccupancy[room].some(o => o.from < to && o.to > from);
  };

  const makeReservation = (room, checkinOffset, stayLength, multiRoomParent) => {
    const roomType = roomTypeMap[room];
    const checkin = addDays(today, checkinOffset);
    const checkout = addDays(today, checkinOffset + stayLength);

    roomOccupancy[room].push({ from: checkinOffset, to: checkinOffset + stayLength });

    const guestObj = multiRoomParent ? multiRoomParent.guestObj : guestNames[Math.floor(Math.random() * guestNames.length)];
    const guest = `${guestObj.firstName} ${guestObj.lastName}`;

    let status;
    if (checkinOffset === 0) status = 'arriving';
    else if (checkinOffset + stayLength === 0) status = 'departing';
    else if (checkinOffset < 0 && checkinOffset + stayLength > 0) status = 'In-house';
    else if (checkinOffset > 0) status = 'future';
    else status = 'past';

    const isCheckedIn = status === 'arriving' ? Math.random() > 0.5 : false;
    const checkedInTime = isCheckedIn ? `${8 + Math.floor(Math.random() * 6)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` : null;
    const isCheckedOut = status === 'departing' ? Math.random() > 0.5 : false;
    const isOption = checkinOffset > 0 ? Math.random() < 0.12 : false;

    const rt = getRoomType(room);
    const baseRate = rt ? rt.defaultRate : 95;
    const nightlyRate = baseRate + Math.floor(Math.random() * 40) - 15;
    const price = nightlyRate * stayLength;

    const payRoll = Math.random();
    let paidPercentage;
    if (status === 'past' || isCheckedOut) {
      paidPercentage = Math.random() < 0.85 ? 1 : [0.7, 0.8, 0.9][Math.floor(Math.random() * 3)];
    } else if (checkinOffset > 3) {
      paidPercentage = payRoll < 0.40 ? 0 : payRoll < 0.65 ? [0.2, 0.3][Math.floor(Math.random() * 2)] : payRoll < 0.80 ? 0.5 : 1;
    } else {
      paidPercentage = payRoll < 0.15 ? 0 : payRoll < 0.35 ? [0.3, 0.5][Math.floor(Math.random() * 2)] : payRoll < 0.55 ? [0.7, 0.8][Math.floor(Math.random() * 2)] : 1;
    }

    const hk = (status === 'past' || isCheckedOut) ? (Math.random() > 0.4 ? 'dirty' : 'clean') :
               status === 'In-house' ? (Math.random() > 0.5 ? 'clean' : 'dirty') : 'clean';
    const guestCount = Math.floor(Math.random() * (rt ? rt.maxOccupancy : 2)) + 1;
    const bookedVia = multiRoomParent ? multiRoomParent.bookedVia : bookingSources[Math.floor(Math.random() * bookingSources.length)];
    const stayPurpose = multiRoomParent ? multiRoomParent.stayPurpose : stayPurposes[Math.floor(Math.random() * stayPurposes.length)];

    // Assign a random rate plan
    const ratePlan = ratePlans[Math.floor(Math.random() * ratePlans.length)];
    const cancellationPolicy = cancellationPolicies.find(cp => cp.id === ratePlan.cancellationPolicyId) || cancellationPolicies[0];

    let reservationStatus = 'confirmed';
    if (isOption) reservationStatus = 'option';
    else if (isCheckedOut) reservationStatus = 'checked-out';
    else if (isCheckedIn) reservationStatus = 'checked-in';
    else if (status === 'In-house') reservationStatus = 'checked-in';
    else if (status === 'past') reservationStatus = 'checked-out';

    const billingRecipient = (() => {
      if (Math.random() < 0.3) {
        const comp = companyRegistry[Math.floor(Math.random() * companyRegistry.length)];
        return { type: 'company', companyId: comp.id, name: comp.name, vatNumber: comp.vatNumber, peppolId: comp.peppolId, address: comp.address, zip: comp.zip, city: comp.city, country: comp.country, email: comp.email, phone: comp.phone };
      }
      return { type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '' };
    })();
    const nationality = nationalities[Math.floor(Math.random() * nationalities.length)];
    const eta = etaTimes[Math.floor(Math.random() * etaTimes.length)];
    const guestEmail = `${guestObj.firstName}.${guestObj.lastName}`.toLowerCase().replace(/\s+/g, '') + '@' + emailDomains[Math.floor(Math.random() * emailDomains.length)];
    const guestPhone = `+31 6 ${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

    const nightPrices = [];
    for (let d = 0; d < stayLength; d++) {
      const nightDate = addDays(checkin, d);
      nightPrices.push({ date: nightDate.toISOString().split('T')[0], amount: nightlyRate + Math.floor(Math.random() * 20) - 10 });
    }

    const payments = [];
    const paidAmount = Math.floor(price * paidPercentage);
    if (paidAmount > 0) {
      const numPayments = paidAmount > 200 && Math.random() > 0.4 ? (Math.random() > 0.5 ? 3 : 2) : 1;
      if (numPayments === 1) {
        payments.push({ id: 1, date: addDays(checkin, -Math.floor(Math.random() * 14)).toISOString().split('T')[0], amount: paidAmount, method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)], note: paidPercentage < 1 ? 'Deposit' : '', status: 'completed', linkedInvoice: null });
      } else if (numPayments === 2) {
        const first = Math.floor(paidAmount * (0.4 + Math.random() * 0.3));
        payments.push({ id: 1, date: addDays(checkin, -Math.floor(Math.random() * 14) - 7).toISOString().split('T')[0], amount: first, method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)], note: 'Deposit', status: 'completed', linkedInvoice: null });
        payments.push({ id: 2, date: addDays(checkin, -Math.floor(Math.random() * 5)).toISOString().split('T')[0], amount: paidAmount - first, method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)], note: '', status: 'completed', linkedInvoice: null });
      } else {
        const first = Math.floor(paidAmount * 0.3);
        const second = Math.floor(paidAmount * 0.4);
        payments.push({ id: 1, date: addDays(checkin, -Math.floor(Math.random() * 20) - 10).toISOString().split('T')[0], amount: first, method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)], note: 'Deposit', status: 'completed', linkedInvoice: null });
        payments.push({ id: 2, date: addDays(checkin, -Math.floor(Math.random() * 7) - 3).toISOString().split('T')[0], amount: second, method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)], note: '2nd payment', status: 'completed', linkedInvoice: null });
        payments.push({ id: 3, date: addDays(checkin, -Math.floor(Math.random() * 2)).toISOString().split('T')[0], amount: paidAmount - first - second, method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)], note: 'Final', status: 'completed', linkedInvoice: null });
      }
    }

    // Auto-calculate extra quantity using catalog flags
    const calcExtraQty = (cat, guests, nights) => {
      if (cat.perPerson && cat.perNight) return guests * nights;
      if (cat.perPerson) return guests;
      if (cat.perNight) return nights;
      return 1;
    };

    let extId = 1;
    const unifiedExtras = [];
    const citytaxCat = extrasCatalog.find(c => c.name === 'Citytax');
    if (citytaxCat && stayLength > 0) {
      unifiedExtras.push({ id: extId++, name: citytaxCat.name, quantity: calcExtraQty(citytaxCat, guestCount, stayLength), room: null, vatRate: citytaxCat.defaultVat, unitPrice: citytaxCat.defaultPrice });
    }
    const resExtraNames = extraOptions[Math.floor(Math.random() * extraOptions.length)];
    resExtraNames.forEach(name => {
      const cat = extrasCatalog.find(c => c.name.toLowerCase().startsWith(name.toLowerCase()));
      if (cat) unifiedExtras.push({ id: extId++, name: cat.name, quantity: calcExtraQty(cat, guestCount, stayLength) || 1, room: null, vatRate: cat.defaultVat, unitPrice: cat.defaultPrice });
    });
    if (Math.random() < 0.2) {
      const roomCats = extrasCatalog.filter(c => c.housekeepingList || ['Safe', 'Minibar'].includes(c.name));
      if (roomCats.length > 0) {
        const pick = roomCats[Math.floor(Math.random() * roomCats.length)];
        unifiedExtras.push({ id: extId++, name: pick.name, quantity: calcExtraQty(pick, guestCount, stayLength) || 1, room: room, vatRate: pick.defaultVat, unitPrice: pick.defaultPrice });
      }
    }

    const currentId = resId++;
    return {
      id: currentId,
      room,
      type: roomType,
      guest,
      bookingRef: formatBookingRef(currentId),
      otaRef: bookedVia === 'booking.com' ? `BDC-${100000000 + Math.floor(Math.random() * 900000000)}` :
              bookedVia === 'expedia' ? `EXP-${10000000 + Math.floor(Math.random() * 90000000)}` :
              bookedVia === 'agency' ? `AGN-${100000 + Math.floor(Math.random() * 900000)}` : null,
      checkin: checkin.toISOString(),
      checkout: checkout.toISOString(),
      status,
      isCheckedIn,
      checkedInTime,
      isCheckedOut,
      isOption,
      guestCount,
      meals: { breakfast: ratePlan.includesBreakfast || Math.random() < 0.5, lunch: Math.random() < 0.3, dinner: Math.random() < 0.4 },
      extras: unifiedExtras,
      price,
      paidPercentage,
      housekeeping: hk,
      reservationStatus,
      cancellationPolicyId: cancellationPolicy.id,
      booker: { firstName: guestObj.firstName, lastName: guestObj.lastName, email: guestEmail, phone: guestPhone },
      billingRecipient,
      notes: '',
      eta,
      bookedVia,
      stayPurpose,
      rooms: [{
        roomNumber: room,
        roomType,
        ratePlanId: ratePlan.id,
        status: reservationStatus,
        checkin: checkin.toISOString(),
        checkout: checkout.toISOString(),
        guests: (() => {
          const extraGuest = guestNames[Math.floor(Math.random() * guestNames.length)];
          return [
            { firstName: guestObj.firstName, lastName: guestObj.lastName, email: guestEmail, phone: guestPhone, nationality, idType: '', idNumber: '' },
            { firstName: extraGuest.firstName, lastName: extraGuest.lastName, email: '', phone: '', nationality, idType: '', idNumber: '' }
          ];
        })(),
        priceType: 'fixed',
        fixedPrice: price,
        nightPrices,
        housekeeping: hk,
        housekeepingNote: '',
        optionExpiry: isOption ? addDays(checkin, -(Math.floor(Math.random() * 3) + 1)).toISOString().slice(0, 16) : null,
        roomLocked: false,
        roomLockedReason: ''
      }],
      payments,
      optionExpiry: isOption ? addDays(checkin, -(Math.floor(Math.random() * 3) + 1)).toISOString().slice(0, 16) : null,
      blockReason: '',
      invoices: [],
      activityLog: [{ id: 1, timestamp: addDays(checkin, -Math.floor(Math.random() * 20) - 1).getTime(), action: 'Reservation created', user: 'System' }],
      reminders: [],
      _guestObj: guestObj, _bookedVia: bookedVia, _stayPurpose: stayPurpose
    };
  };

  // --- Phase 1: Fill rooms sequentially targeting ~30% occupancy ---
  rooms.forEach(room => {
    let currentDay = -30;
    while (currentDay < 30) {
      // ~70% chance of gap (1-4 days), gives ~30% occupancy
      if (Math.random() < 0.70) {
        currentDay += 1 + Math.floor(Math.random() * 4);
      }
      if (currentDay >= 30) break;

      const stayLength = getRandomStayLength();
      if (currentDay + stayLength > 32) break;

      const res = makeReservation(room, currentDay, stayLength, null);
      delete res._guestObj; delete res._bookedVia; delete res._stayPurpose;
      reservations.push(res);
      currentDay += stayLength;
    }
  });

  // --- Phase 2: Create some multi-room reservations (merge 2 adjacent rooms) ---
  const multiRoomCandidates = [];
  for (let i = 0; i < reservations.length; i++) {
    const a = reservations[i];
    if (a.rooms.length > 1) continue;
    for (let j = i + 1; j < reservations.length; j++) {
      const b = reservations[j];
      if (b.rooms.length > 1) continue;
      if (a.room === b.room) continue;
      const floorA = a.room[0], floorB = b.room[0];
      if (Math.abs(floorA - floorB) > 1) continue;
      const aStart = new Date(a.checkin), bStart = new Date(b.checkin);
      if (Math.abs(aStart - bStart) > 86400000) continue;
      multiRoomCandidates.push([i, j]);
    }
  }
  multiRoomCandidates.sort(() => Math.random() - 0.5);
  const used = new Set();
  let merged = 0;
  for (const [ai, bi] of multiRoomCandidates) {
    if (merged >= 5 || used.has(ai) || used.has(bi)) continue;
    const a = reservations[ai], b = reservations[bi];
    a.rooms.push(b.rooms[0]);
    a.guest = `${a.booker.firstName} ${a.booker.lastName}`;
    used.add(ai);
    used.add(bi);
    merged++;
  }
  const toRemove = [...used].sort((a, b) => b - a);
  toRemove.forEach(idx => reservations.splice(idx, 1));

  // --- Phase 3: Add a few blocked rooms ---
  const blockableRooms = ['303', '403'];
  blockableRooms.forEach(room => {
    const offset = Math.floor(Math.random() * 10) + 5;
    const len = 2 + Math.floor(Math.random() * 3);
    if (isRoomFree(room, offset, offset + len)) {
      const blockReasons = ['Maintenance', 'Renovation', 'Out of order', 'Deep cleaning'];
      roomOccupancy[room].push({ from: offset, to: offset + len });
      const blockId = resId++;
      reservations.push({
        id: blockId, room, type: roomTypeMap[room], guest: '',
        bookingRef: formatBookingRef(blockId), otaRef: null,
        checkin: addDays(today, offset).toISOString(), checkout: addDays(today, offset + len).toISOString(),
        status: 'future', isCheckedIn: false, checkedInTime: null, isCheckedOut: false, isOption: false,
        guestCount: 0, meals: { breakfast: false, lunch: false, dinner: false },
        extras: [], price: 0, paidPercentage: 0, housekeeping: 'clean',
        reservationStatus: 'blocked',
        booker: { firstName: '', lastName: '', email: '', phone: '' },
        billingRecipient: { type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '', reference: '' },
        notes: '', eta: '', bookedVia: '', stayPurpose: '',
        rooms: [{ roomNumber: room, roomType: roomTypeMap[room], status: 'blocked',
          checkin: addDays(today, offset).toISOString(), checkout: addDays(today, offset + len).toISOString(),
          guests: [], priceType: 'fixed', fixedPrice: 0, nightPrices: [],
          housekeeping: 'clean', housekeepingNote: '', optionExpiry: null, roomLocked: false, roomLockedReason: '' }],
        payments: [], optionExpiry: null,
        blockReason: blockReasons[Math.floor(Math.random() * blockReasons.length)],
        invoices: [], activityLog: [{ id: 1, timestamp: Date.now(), action: 'Room blocked', user: 'System' }], reminders: []
      });
    }
  });

  return reservations;
};

// Data version — increment to force regeneration when model changes
const DATA_VERSION = 33;

// Laad of genereer reserveringen met localStorage persistentie
const getReservations = () => {
  try {
    const storedVersion = localStorage.getItem('hotelDataVersion');
    const stored = localStorage.getItem('hotelReservations');
    if (stored && storedVersion === String(DATA_VERSION)) {
      const parsed = JSON.parse(stored);
      // Validate and sanitize on load — skip corrupt entries instead of crashing
      return parsed.filter(r => {
        if (!r || !r.id || !r.bookingRef) {
          console.warn('[Data] Skipping corrupt reservation (missing id/bookingRef):', r);
          return false;
        }
        if (!r.rooms || !Array.isArray(r.rooms) || r.rooms.length === 0) {
          console.warn(`[Data] Skipping ${r.bookingRef}: missing/empty rooms array`);
          return false;
        }
        // Ensure required arrays exist
        if (!r.activityLog) r.activityLog = [];
        if (!r.extras) r.extras = [];
        if (!r.payments) r.payments = [];
        if (!r.invoices) r.invoices = [];
        return true;
      }).map(r => ({
        ...r,
        checkin: new Date(r.checkin),
        checkout: new Date(r.checkout),
        rooms: (r.rooms || []).map(room => ({
          ...room,
          checkin: room.checkin ? new Date(room.checkin) : new Date(r.checkin),
          checkout: room.checkout ? new Date(room.checkout) : new Date(r.checkout)
        }))
      }));
    }
  } catch (e) {
    console.error('Error loading reservations:', e);
  }

  const newReservations = generateReservations();
  try {
    localStorage.setItem('hotelReservations', JSON.stringify(newReservations));
    localStorage.setItem('hotelDataVersion', String(DATA_VERSION));
  } catch (e) {
    console.error('Error saving reservations:', e);
  }

  return newReservations.map(r => ({
    ...r,
    checkin: new Date(r.checkin),
    checkout: new Date(r.checkout),
    rooms: (r.rooms || []).map(room => ({
      ...room,
      checkin: room.checkin ? new Date(room.checkin) : new Date(r.checkin),
      checkout: room.checkout ? new Date(room.checkout) : new Date(r.checkout)
    }))
  }));
};

// Genereer reserveringen 1x bij het laden
const reservations = getReservations();

// Sync bookingRefNumbering.nextNumber so new reservations get the right sequence
if (hotelSettings.bookingRefNumbering) {
  const maxResId = Math.max(...reservations.map(r => r.id), 0);
  if (maxResId >= (hotelSettings.bookingRefNumbering.nextNumber || 1)) {
    hotelSettings.bookingRefNumbering.nextNumber = maxResId + 1;
    saveHotelSettings();
  }
}

// Auto-extract booker profiles from reservations
function syncBookerProfiles() {
  let changed = false;
  reservations.forEach(res => {
    if (!res.booker?.email && !res.booker?.firstName) return;
    const existing = bookerProfiles.find(bp =>
      (bp.email && bp.email === res.booker.email) ||
      (bp.firstName === res.booker.firstName && bp.lastName === res.booker.lastName && bp.phone === res.booker.phone)
    );
    if (!existing) {
      const isVCC = res.otaRef && res.otaRef.startsWith('BDC-') && Math.random() < 0.4;
      bookerProfiles.push({
        id: 'bp-' + Date.now() + Math.random().toString(36).slice(2, 6),
        firstName: res.booker.firstName || '',
        lastName: res.booker.lastName || '',
        email: res.booker.email || '',
        phone: res.booker.phone || '',
        language: detectLanguageFromPhone(res.booker.phone) || 'en',
        linkedCompanyId: null,
        creditCard: isVCC ? { last4: String(1000 + Math.floor(Math.random() * 9000)), expiry: '12/26', cvc: '***', holder: 'Virtual Card', token: 'vcc_demo', isVCC: true } : null,
        priceAgreement: { amount: null, percentage: null },
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      changed = true;
    }
  });
  if (changed) saveBookerProfiles();
}
syncBookerProfiles();

// Staff members — derived from hotelUsers for messaging backward-compat
const staffMembers = hotelUsers.filter(u => u.active).map(u => ({
  id: u.id, name: u.name, role: u.department, department: u.department, color: u.color,
}));

// Current user — set by login screen, persisted in sessionStorage
let currentUserId = null;
let currentUser = null;

const setCurrentUser = (userId) => {
  const user = hotelUsers.find(u => u.id === userId && u.active);
  if (user) {
    currentUserId = user.id;
    currentUser = user;
    try { sessionStorage.setItem('rumoCurrentUserId', userId); } catch(e) {}
  }
};

const clearCurrentUser = () => {
  currentUserId = null;
  currentUser = null;
  try { sessionStorage.removeItem('rumoCurrentUserId'); } catch(e) {}
};

// Restore session on load
(() => {
  try {
    const sessionId = sessionStorage.getItem('rumoCurrentUserId');
    if (sessionId) setCurrentUser(sessionId);
  } catch(e) {}
})();

// Group channels — dynamic from user departments
const groupChannels = (() => {
  const deptMap = {};
  hotelUsers.filter(u => u.active).forEach(u => {
    const key = u.department.toLowerCase().replace(/\s+/g, '-');
    if (!deptMap[key]) deptMap[key] = { id: `group-${key}`, name: u.department, color: u.color, members: [] };
    deptMap[key].members.push(u.id);
  });
  const channels = Object.values(deptMap);
  channels.push({ id: 'group-all', name: 'All Staff', color: '#171717', members: hotelUsers.filter(u => u.active).map(u => u.id) });
  return channels;
})();

const generateInitialMessages = () => {
  const now = Date.now();
  const min = 60000;
  const hr = 3600000;
  // Map user IDs by name for readability
  const uid = (name) => { const u = hotelUsers.find(u => u.name.toLowerCase().includes(name)); return u ? u.id : 'usr-1'; };
  const sophie = uid('sophie'), lukas = uid('lukas'), emma = uid('emma'), peter = uid('peter'), nina = uid('nina');
  return [
    { id: 1, from: lukas, to: sophie, text: 'Room 204 needs extra towels and pillows. Guest requested it twice already.', timestamp: now - 3 * min, read: false },
    { id: 2, from: sophie, to: lukas, text: 'On it, sending someone up right away!', timestamp: now - 2 * min, read: true },
    { id: 3, from: lukas, to: sophie, text: 'Thanks. Also room 108 checkout was messy, will need deep clean.', timestamp: now - 1 * min, read: false },
    { id: 4, from: emma, to: sophie, text: 'Breakfast count updated to 18 covers for tomorrow. Can you confirm with the guest in 301?', timestamp: now - 15 * min, read: false },
    { id: 5, from: sophie, to: emma, text: 'Will check with them at dinner tonight.', timestamp: now - 12 * min, read: true },
    { id: 6, from: peter, to: sophie, text: 'Good morning team. We have a VIP arriving at 14:00 — room 301. Please ensure everything is perfect.', timestamp: now - 2 * hr, read: true },
    { id: 7, from: sophie, to: peter, text: 'Noted! Room is prepped, welcome package ready.', timestamp: now - 1.5 * hr, read: true },
    { id: 8, from: peter, to: sophie, text: 'Perfect. Let me know when they check in.', timestamp: now - 1 * hr, read: true },
    { id: 9, from: nina, to: sophie, text: 'Hey Sophie, quiet night. Guest in 205 asked about late checkout tomorrow — I told them to confirm with you in the morning.', timestamp: now - 6 * hr, read: true },
    { id: 10, from: emma, to: sophie, text: 'Room service order for 402 — bottle of champagne + cheese platter. Can you add it to their folio?', timestamp: now - 45 * min, read: false },
    { id: 11, from: peter, to: 'group-all', text: 'Reminder: fire drill scheduled for Thursday at 10:00. Please inform your teams.', timestamp: now - 4 * hr, readBy: [sophie, peter] },
    { id: 12, from: sophie, to: 'group-reception', text: 'New check-in procedure starting today — please scan passport on arrival.', timestamp: now - 3 * hr, readBy: [sophie] },
    { id: 13, from: nina, to: 'group-reception', text: 'Got it, will follow the new procedure tonight.', timestamp: now - 2.5 * hr, readBy: [sophie, nina] },
    { id: 14, from: lukas, to: 'group-housekeeping', text: 'Deep clean schedule updated for this week. Check the board.', timestamp: now - 5 * hr, readBy: [lukas] },
    { id: 15, from: emma, to: 'group-fb', text: 'Menu change: we are out of salmon today. Substitute with sea bass.', timestamp: now - 30 * min, readBy: [emma] },
  ];
};
