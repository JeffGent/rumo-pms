// ── Hotel Settings — persisted in localStorage ─────────────────────────────
let hotelSettings = (() => {
  try {
    const stored = localStorage.getItem('hotelSettings');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return {
    currency: 'EUR',
    defaultRoomVat: 12,
    hotelName: 'Rumo Boutique Hotel',
    hotelAddress: 'Keizerstraat 12, 2000 Antwerpen',
    hotelEmail: 'info@rumohotel.be',
    hotelPhone: '+32 3 123 45 67',
    hotelVat: 'BE0123456789',
    channex: { propertyId: null, apiKey: null },
  };
})();
const saveHotelSettings = () => localStorage.setItem('hotelSettings', JSON.stringify(hotelSettings));

// ── Room Type Catalog — persisted in localStorage ──────────────────────────
let roomTypes = (() => {
  try {
    const stored = localStorage.getItem('hotelRoomTypes');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    { id: 'rt-1', name: 'Standard',        shortCode: 'STD', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 95,  extraPersonSupplement: 0,  rooms: ['101','102','403'], amenities: [], channexId: null },
    { id: 'rt-2', name: 'Deluxe',          shortCode: 'DLX', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 140, extraPersonSupplement: 25, rooms: ['103','202','401'], amenities: [], channexId: null },
    { id: 'rt-3', name: 'Classic Twin',    shortCode: 'TWN', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 120, extraPersonSupplement: 0,  rooms: ['104','203','503'], amenities: [], channexId: null },
    { id: 'rt-4', name: 'Standard Triple', shortCode: 'TRP', maxOccupancy: 3, baseOccupancy: 2, defaultRate: 110, extraPersonSupplement: 30, rooms: ['105','502'],       amenities: [], channexId: null },
    { id: 'rt-5', name: 'Suite',           shortCode: 'STE', maxOccupancy: 3, baseOccupancy: 2, defaultRate: 180, extraPersonSupplement: 40, rooms: ['201','303','501'], amenities: [], channexId: null },
  ];
})();
const saveRoomTypes = () => localStorage.setItem('hotelRoomTypes', JSON.stringify(roomTypes));

// Helper: get room type name from room number
const getRoomTypeName = (roomNumber) => {
  const rt = roomTypes.find(t => t.rooms.includes(roomNumber));
  return rt ? rt.name : 'Standard';
};

// Helper: get room type object from room number
const getRoomType = (roomNumber) => roomTypes.find(t => t.rooms.includes(roomNumber)) || roomTypes[0];

// Helper: get all room numbers from roomTypes catalog
const getAllRooms = () => {
  const rooms = [];
  roomTypes.forEach(rt => rt.rooms.forEach(r => rooms.push(r)));
  return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

// ── Rate Plans — persisted in localStorage ─────────────────────────────────
let ratePlans = (() => {
  try {
    const stored = localStorage.getItem('hotelRatePlans');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    { id: 'rp-1', name: 'Room Only',        shortCode: 'RO', includesBreakfast: false, cancellationPolicyId: 'cp-1', isRefundable: true,  priceModifier: 0,   channexId: null },
    { id: 'rp-2', name: 'Room + Breakfast',  shortCode: 'BB', includesBreakfast: true,  cancellationPolicyId: 'cp-1', isRefundable: true,  priceModifier: 18,  channexId: null },
    { id: 'rp-3', name: 'Non-Refundable',    shortCode: 'NR', includesBreakfast: false, cancellationPolicyId: 'cp-2', isRefundable: false, priceModifier: -15, channexId: null },
  ];
})();
const saveRatePlans = () => localStorage.setItem('hotelRatePlans', JSON.stringify(ratePlans));

// ── Cancellation Policies — persisted in localStorage ──────────────────────
let cancellationPolicies = (() => {
  try {
    const stored = localStorage.getItem('hotelCancellationPolicies');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    { id: 'cp-1', name: 'Flexible',        description: 'Free cancellation up to 24h before check-in', deadlineHours: 24, penaltyType: 'first_night', penaltyValue: null },
    { id: 'cp-2', name: 'Non-Refundable',  description: 'No cancellation, full prepayment required',    deadlineHours: 0,  penaltyType: 'full_stay',   penaltyValue: null },
  ];
})();
const saveCancellationPolicies = () => localStorage.setItem('hotelCancellationPolicies', JSON.stringify(cancellationPolicies));

// ── Unified extras catalog (used in both data generation and UI) ───────────
const extrasCatalog = [
  { name: 'Citytax', defaultPrice: 3, defaultVat: 6 },
  { name: 'Parking', defaultPrice: 15, defaultVat: 6 },
  { name: 'Breakfast Package', defaultPrice: 18, defaultVat: 6 },
  { name: 'Dinner Package', defaultPrice: 45, defaultVat: 21 },
  { name: 'Extra Bed', defaultPrice: 35, defaultVat: 6 },
  { name: 'Extra Breakfast', defaultPrice: 18, defaultVat: 6 },
  { name: 'Airport Transfer', defaultPrice: 75, defaultVat: 6 },
  { name: 'Late Checkout', defaultPrice: 45, defaultVat: 6 },
  { name: 'Early Checkin', defaultPrice: 30, defaultVat: 6 },
  { name: 'Spa Access', defaultPrice: 25, defaultVat: 21 },
  { name: 'Pet Fee', defaultPrice: 20, defaultVat: 6 },
  { name: 'Rollaway Bed', defaultPrice: 25, defaultVat: 6 },
  { name: 'Crib', defaultPrice: 0, defaultVat: 6 },
  { name: 'Minibar', defaultPrice: 0, defaultVat: 21 },
  { name: 'Safe', defaultPrice: 3, defaultVat: 6 },
];

// ── Profile stores — persisted separately in localStorage ──────────────────

// Company profiles (replaces old companyRegistry)
let companyProfiles = (() => {
  try {
    const stored = localStorage.getItem('hotelCompanyProfiles');
    if (stored) { const parsed = JSON.parse(stored); if (parsed.length > 0) return parsed; }
  } catch (e) {}
  return [
    { id: 1, name: 'Acme Corp', vatNumber: 'BE0123456789', peppolId: '0208:0123456789', address: 'Kerkstraat 1', zip: '2000', city: 'Antwerpen', country: 'BE', email: 'billing@acme.be', phone: '+32 3 123 45 67', creditCard: null, priceAgreement: { amount: null, percentage: 10 }, source: 'direct', segment: 'corporate', notes: 'Long-standing corporate client, 10% negotiated discount.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 2, name: 'TechFlow BV', vatNumber: 'BE0987654321', peppolId: '0208:0987654321', address: 'Mechelsesteenweg 44', zip: '2018', city: 'Antwerpen', country: 'BE', email: 'admin@techflow.be', phone: '+32 3 987 65 43', creditCard: null, priceAgreement: { amount: null, percentage: null }, source: 'direct', segment: 'corporate', notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 3, name: 'Deloitte Belgium', vatNumber: 'BE0429053863', peppolId: '0208:0429053863', address: 'Gateway Building, Luchthaven Nationaal 1J', zip: '1930', city: 'Zaventem', country: 'BE', email: 'invoices@deloitte.be', phone: '+32 2 600 60 00', creditCard: null, priceAgreement: { amount: 135, percentage: null }, source: 'agency', segment: 'corporate', notes: 'Fixed nightly rate agreement (EUR 135).', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 4, name: 'MediaMarkt NV', vatNumber: 'BE0446017985', peppolId: '', address: 'Wijnegem Shopping Center', zip: '2110', city: 'Wijnegem', country: 'BE', email: 'facturatie@mediamarkt.be', phone: '+32 3 354 56 78', creditCard: null, priceAgreement: { amount: null, percentage: null }, source: 'direct', segment: 'corporate', notes: '', createdAt: Date.now(), updatedAt: Date.now() },
  ];
})();
const saveCompanyProfiles = () => localStorage.setItem('hotelCompanyProfiles', JSON.stringify(companyProfiles));

// Guest profiles (replaces old guestRegistry)
let guestProfiles = (() => {
  try {
    const stored = localStorage.getItem('hotelGuestProfiles');
    if (stored) { const parsed = JSON.parse(stored); if (parsed.length > 0) return parsed; }
  } catch (e) {}
  return [
    { id: 'gp-1', firstName: 'Marcel', lastName: 'Kiekeboe', email: 'marcel.kiekeboe@mail.be', phone: '+32 475 10 20 30', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-590412-001', dateOfBirth: null, notes: 'Prefers quiet room, higher floor.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-2', firstName: 'Charlotte', lastName: 'Kiekeboe', email: 'charlotte.kiekeboe@gmail.com', phone: '+32 476 20 30 40', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-610823-002', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-3', firstName: 'Fanny', lastName: 'Kiekeboe', email: 'fanny.kiekeboe@outlook.com', phone: '+32 477 30 40 50', nationality: 'BE', idType: '', idNumber: '', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-4', firstName: 'Konstantinopel', lastName: 'Kiekeboe', email: 'konstantinopel@hotmail.com', phone: '+32 478 40 50 60', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-950215-004', dateOfBirth: null, notes: 'Always asks for extra pillows.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-5', firstName: 'Leon', lastName: 'Van der Neffe', email: 'leon.vanderneffe@mail.be', phone: '+32 479 50 60 70', nationality: 'NL', idType: 'Passport', idNumber: 'NL-XR832451', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-6', firstName: 'Froefroe', lastName: 'Van der Neffe', email: 'froefroe@gmail.com', phone: '+32 470 60 70 80', nationality: 'NL', idType: '', idNumber: '', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-7', firstName: 'Firmin', lastName: 'Van de Kasseien', email: 'firmin.kasseien@telenet.be', phone: '+32 471 70 80 90', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-550930-007', dateOfBirth: null, notes: 'Loyal returning guest. Likes room 201.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-8', firstName: 'Fernand', lastName: 'Goegebuer', email: 'fernand.goegebuer@yahoo.com', phone: '+32 472 80 90 00', nationality: 'BE', idType: 'Driving License', idNumber: 'BE-DL-440317-008', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
  ];
})();
const saveGuestProfiles = () => localStorage.setItem('hotelGuestProfiles', JSON.stringify(guestProfiles));

// Booker profiles — auto-extracted from reservations via syncBookerProfiles()
let bookerProfiles = (() => {
  try {
    const stored = localStorage.getItem('hotelBookerProfiles');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [];
})();
const saveBookerProfiles = () => localStorage.setItem('hotelBookerProfiles', JSON.stringify(bookerProfiles));

// Backward-compatibility aliases (companyRegistry / guestRegistry used elsewhere in codebase)
const companyRegistry = companyProfiles;
const saveCompanyRegistry = saveCompanyProfiles;
const guestRegistry = guestProfiles;
const saveGuestRegistry = saveGuestProfiles;
