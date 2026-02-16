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
    invoiceNumbering: {
      prefix: 'INV',
      creditPrefix: 'CN',
      proformaPrefix: 'PRO',
      separator: '-',
      digits: 4,
      includeYear: true,
      resetYearly: true,
      nextNumber: 1,
    },
    bookingRefNumbering: {
      prefix: 'RMO',
      separator: '-',
      digits: 5,
      includeYear: false,
      resetYearly: false,
      nextNumber: 1,
    },
    paymentMethods: ['Cash', 'Card (PIN)', 'Maestro', 'Mastercard', 'Visa', 'iDEAL', 'Bank Transfer'],
  };
})();
const saveHotelSettings = () => localStorage.setItem('hotelSettings', JSON.stringify(hotelSettings));

// Ensure invoiceNumbering exists for existing localStorage data
if (!hotelSettings.invoiceNumbering) {
  hotelSettings.invoiceNumbering = { prefix: 'INV', creditPrefix: 'CN', proformaPrefix: 'PRO', separator: '-', digits: 4, includeYear: true, resetYearly: true, nextNumber: 1 };
  saveHotelSettings();
}

// Ensure bookingRefNumbering exists for existing localStorage data
if (!hotelSettings.bookingRefNumbering) {
  hotelSettings.bookingRefNumbering = { prefix: 'RMO', separator: '-', digits: 5, includeYear: false, resetYearly: false, nextNumber: 1 };
  saveHotelSettings();
}

// Ensure paymentMethods exists for existing localStorage data
if (!hotelSettings.paymentMethods || !hotelSettings.paymentMethods.length) {
  hotelSettings.paymentMethods = ['Cash', 'Card (PIN)', 'Maestro', 'Mastercard', 'Visa', 'iDEAL', 'Bank Transfer'];
  saveHotelSettings();
} else {
  // Ensure Cash is first and Bank Transfer is last
  let pm = hotelSettings.paymentMethods.filter(m => m !== 'Cash' && m !== 'Bank Transfer');
  if (!hotelSettings.paymentMethods.includes('Cash')) pm = ['Cash', ...pm];
  else pm.unshift('Cash');
  if (!hotelSettings.paymentMethods.includes('Bank Transfer')) pm.push('Bank Transfer');
  else pm.push('Bank Transfer');
  if (JSON.stringify(pm) !== JSON.stringify(hotelSettings.paymentMethods)) {
    hotelSettings.paymentMethods = pm;
    saveHotelSettings();
  }
}

// ── Sequential Invoice Number Generator ─────────────────────────────────────
// Single ascending sequence for invoices + credit notes (Belgian law).
// Proformas get their own lightweight counter (not legally required).
const getNextInvoiceNumber = (type) => {
  const cfg = hotelSettings.invoiceNumbering;
  const year = new Date().getFullYear();
  const sep = cfg.separator || '-';

  // Reset counter if new year and resetYearly is on
  if (cfg.resetYearly && cfg._lastYear && cfg._lastYear !== year) {
    cfg.nextNumber = 1;
  }
  cfg._lastYear = year;

  const num = cfg.nextNumber || 1;
  const padded = String(num).padStart(cfg.digits || 4, '0');

  let prefix;
  if (type === 'credit') prefix = cfg.creditPrefix || 'CN';
  else if (type === 'proforma') prefix = cfg.proformaPrefix || 'PRO';
  else prefix = cfg.prefix || 'INV';

  const parts = [prefix];
  if (cfg.includeYear) parts.push(year);
  parts.push(padded);

  // Increment counter (shared for all types — Belgian requirement)
  cfg.nextNumber = num + 1;
  saveHotelSettings();

  return parts.join(sep);
};

// ── Sequential Booking Reference Generator ───────────────────────────────────
// Format: PREFIX-00001 (configurable prefix, separator, digits, optional year)
const formatBookingRef = (num) => {
  const cfg = hotelSettings.bookingRefNumbering;
  const sep = cfg.separator || '-';
  const padded = String(num).padStart(cfg.digits || 5, '0');
  const parts = [cfg.prefix || 'RMO'];
  if (cfg.includeYear) parts.push(new Date().getFullYear());
  parts.push(padded);
  return parts.join(sep);
};

const getNextBookingRef = () => {
  const cfg = hotelSettings.bookingRefNumbering;
  const year = new Date().getFullYear();
  const sep = cfg.separator || '-';

  // Reset counter if new year and resetYearly is on
  if (cfg.resetYearly && cfg._lastYear && cfg._lastYear !== year) {
    cfg.nextNumber = 1;
  }
  cfg._lastYear = year;

  const num = cfg.nextNumber || 1;
  const padded = String(num).padStart(cfg.digits || 5, '0');

  const parts = [cfg.prefix || 'RMO'];
  if (cfg.includeYear) parts.push(year);
  parts.push(padded);

  cfg.nextNumber = num + 1;
  saveHotelSettings();

  return parts.join(sep);
};

// ── Languages for guest/booker/company communication ─────────────────────────
const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Fran\u00e7ais' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Portugu\u00eas' },
  { code: 'da', label: 'Dansk' },
  { code: 'sv', label: 'Svenska' },
  { code: 'no', label: 'Norsk' },
  { code: 'pl', label: 'Polski' },
  { code: 'cs', label: '\u010ce\u0161tina' },
];

// Phone prefix → language mapping (auto-detect)
const PHONE_PREFIX_TO_LANG = {
  '+31': 'nl', '+32': 'nl', '+33': 'fr', '+49': 'de', '+44': 'en', '+1': 'en',
  '+34': 'es', '+39': 'it', '+351': 'pt', '+43': 'de', '+41': 'de',
  '+352': 'fr', '+45': 'da', '+46': 'sv', '+47': 'no', '+48': 'pl', '+420': 'cs',
  '0031': 'nl', '0032': 'nl', '0033': 'fr', '0049': 'de', '0044': 'en',
};

const detectLanguageFromPhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Try longest prefixes first (+420, +351, 0049, etc.)
  for (const len of [4, 3, 2]) {
    const prefix = cleaned.substring(0, len);
    if (PHONE_PREFIX_TO_LANG[prefix]) return PHONE_PREFIX_TO_LANG[prefix];
    if (len <= 3 && PHONE_PREFIX_TO_LANG['+' + prefix]) return PHONE_PREFIX_TO_LANG['+' + prefix];
  }
  return null;
};

// ── VAT Rates — persisted in localStorage ───────────────────────────────────
let vatRates = (() => {
  try {
    const stored = localStorage.getItem('hotelVatRates');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    { id: 'vat-1', rate: 0,  label: 'Exempt',        schedule: [] },
    { id: 'vat-2', rate: 6,  label: 'Reduced',        schedule: [] },
    { id: 'vat-3', rate: 9,  label: 'Accommodation',  schedule: [] },
    { id: 'vat-4', rate: 21, label: 'Standard',       schedule: [] },
  ];
})();
const saveVatRates = () => localStorage.setItem('hotelVatRates', JSON.stringify(vatRates));

// Helper: get effective VAT rate for a date (checks schedule entries)
const getEffectiveVatRate = (baseRate, date) => {
  const vr = vatRates.find(v => v.rate === baseRate);
  if (!vr || !vr.schedule || vr.schedule.length === 0) return baseRate;
  const d = date instanceof Date ? date.toISOString().slice(0, 10) : (typeof date === 'string' ? date.slice(0, 10) : null);
  if (!d) return baseRate;
  let effective = vr.rate;
  [...vr.schedule].sort((a, b) => a.from.localeCompare(b.from)).forEach(s => {
    if (s.from <= d) effective = s.newRate;
  });
  return effective;
};

// ── Room Type Catalog — persisted in localStorage ──────────────────────────
let roomTypes = (() => {
  try {
    const stored = localStorage.getItem('hotelRoomTypes');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    { id: 'rt-1', name: 'Standard Triple',  shortCode: 'TRP', maxOccupancy: 3, baseOccupancy: 2, defaultRate: 110, extraPersonSupplement: 30, rooms: ['101','102','103','104'],                         amenities: [], channexId: null },
    { id: 'rt-2', name: 'Standard Double',  shortCode: 'DBL', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 95,  extraPersonSupplement: 0,  rooms: ['201','202','203','204'],                         amenities: [], channexId: null },
    { id: 'rt-3', name: 'Standard Twin',    shortCode: 'TWN', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 95,  extraPersonSupplement: 0,  rooms: ['301','302','303','304','401','402','403','404'], amenities: [], channexId: null },
    { id: 'rt-4', name: 'Classic Twin',     shortCode: 'CTW', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 120, extraPersonSupplement: 0,  rooms: ['501','502'],                                     amenities: [], channexId: null },
    { id: 'rt-5', name: 'Classic Double',   shortCode: 'CDB', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 120, extraPersonSupplement: 0,  rooms: ['503','504'],                                     amenities: [], channexId: null },
    { id: 'rt-6', name: 'Deluxe Double',    shortCode: 'DLX', maxOccupancy: 2, baseOccupancy: 2, defaultRate: 140, extraPersonSupplement: 25, rooms: ['601','602'],                                     amenities: [], channexId: null },
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

// ── Extras catalog — persisted in localStorage ──────────────────────────────
let extrasCatalog = (() => {
  try {
    const stored = localStorage.getItem('hotelExtrasCatalog');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    { id: 'ex-1',  name: 'Citytax',           defaultPrice: 3,  defaultVat: 6,  perPerson: true,  perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-2',  name: 'Parking',           defaultPrice: 15, defaultVat: 6,  perPerson: false, perNight: true,  multipleBookable: false, dailyInventory: true,  dailyInventoryLimit: 8,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: true,  upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-3',  name: 'Breakfast Package', defaultPrice: 18, defaultVat: 6,  perPerson: true,  perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: true,  lunch: false, dinner: false, housekeepingList: false, bookingEngine: true,  upsellOnlineCheckin: true,  multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-4',  name: 'Dinner Package',    defaultPrice: 45, defaultVat: 21, perPerson: true,  perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: true,  housekeepingList: false, bookingEngine: true,  upsellOnlineCheckin: true,  multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-5',  name: 'Extra Bed',         defaultPrice: 35, defaultVat: 6,  perPerson: false, perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: true,  bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-6',  name: 'Extra Breakfast',   defaultPrice: 18, defaultVat: 6,  perPerson: true,  perNight: false, multipleBookable: true,  dailyInventory: false, dailyInventoryLimit: 0,  breakfast: true,  lunch: false, dinner: false, housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-7',  name: 'Airport Transfer',  defaultPrice: 75, defaultVat: 6,  perPerson: false, perNight: false, multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: true,  upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-8',  name: 'Late Checkout',     defaultPrice: 45, defaultVat: 6,  perPerson: false, perNight: false, multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-9',  name: 'Early Checkin',     defaultPrice: 30, defaultVat: 6,  perPerson: false, perNight: false, multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-10', name: 'Spa Access',        defaultPrice: 25, defaultVat: 21, perPerson: true,  perNight: false, multipleBookable: false, dailyInventory: true,  dailyInventoryLimit: 15, breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: true,  upsellOnlineCheckin: true,  multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-11', name: 'Pet Fee',           defaultPrice: 20, defaultVat: 6,  perPerson: false, perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: true,  bookingEngine: true,  upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-12', name: 'Rollaway Bed',      defaultPrice: 25, defaultVat: 6,  perPerson: false, perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: true,  bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-13', name: 'Crib',              defaultPrice: 0,  defaultVat: 6,  perPerson: false, perNight: false, multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: true,  bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-14', name: 'Minibar',           defaultPrice: 0,  defaultVat: 21, perPerson: false, perNight: false, multipleBookable: true,  dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
    { id: 'ex-15', name: 'Safe',              defaultPrice: 3,  defaultVat: 6,  perPerson: false, perNight: true,  multipleBookable: false, dailyInventory: false, dailyInventoryLimit: 0,  breakfast: false, lunch: false, dinner: false, housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false, multipleBookableLimit: 1, priceSchedule: [], photo: '' },
  ];
})();
const saveExtrasCatalog = () => localStorage.setItem('hotelExtrasCatalog', JSON.stringify(extrasCatalog));

// Helper: get extra price for a given date (checks priceSchedule, falls back to defaultPrice)
const getExtraPrice = (cat, date) => {
  if (!cat.priceSchedule || cat.priceSchedule.length === 0) return cat.defaultPrice;
  const d = typeof date === 'string' ? date.slice(0, 10) : (date instanceof Date ? date.toISOString().slice(0, 10) : null);
  if (!d) return cat.defaultPrice;
  const match = cat.priceSchedule.find(ps => ps.from <= d && ps.to >= d);
  return match ? match.price : cat.defaultPrice;
};

// ── Profile stores — persisted separately in localStorage ──────────────────

// Company profiles (replaces old companyRegistry)
let companyProfiles = (() => {
  try {
    const stored = localStorage.getItem('hotelCompanyProfiles');
    if (stored) { const parsed = JSON.parse(stored); if (parsed.length > 0) return parsed; }
  } catch (e) {}
  return [
    { id: 1, name: 'Acme Corp', vatNumber: 'BE0123456789', peppolId: '0208:0123456789', address: 'Kerkstraat 1', zip: '2000', city: 'Antwerpen', country: 'BE', email: 'billing@acme.be', phone: '+32 3 123 45 67', language: 'nl', creditCard: null, priceAgreement: { amount: null, percentage: 10 }, source: 'direct', segment: 'corporate', notes: 'Long-standing corporate client, 10% negotiated discount.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 2, name: 'TechFlow BV', vatNumber: 'BE0987654321', peppolId: '0208:0987654321', address: 'Mechelsesteenweg 44', zip: '2018', city: 'Antwerpen', country: 'BE', email: 'admin@techflow.be', phone: '+32 3 987 65 43', language: 'nl', creditCard: null, priceAgreement: { amount: null, percentage: null }, source: 'direct', segment: 'corporate', notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 3, name: 'Deloitte Belgium', vatNumber: 'BE0429053863', peppolId: '0208:0429053863', address: 'Gateway Building, Luchthaven Nationaal 1J', zip: '1930', city: 'Zaventem', country: 'BE', email: 'invoices@deloitte.be', phone: '+32 2 600 60 00', language: 'en', creditCard: null, priceAgreement: { amount: 135, percentage: null }, source: 'agency', segment: 'corporate', notes: 'Fixed nightly rate agreement (EUR 135).', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 4, name: 'MediaMarkt NV', vatNumber: 'BE0446017985', peppolId: '', address: 'Wijnegem Shopping Center', zip: '2110', city: 'Wijnegem', country: 'BE', email: 'facturatie@mediamarkt.be', phone: '+32 3 354 56 78', language: 'nl', creditCard: null, priceAgreement: { amount: null, percentage: null }, source: 'direct', segment: 'corporate', notes: '', createdAt: Date.now(), updatedAt: Date.now() },
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
    { id: 'gp-1', firstName: 'Marcel', lastName: 'Kiekeboe', email: 'marcel.kiekeboe@mail.be', phone: '+32 475 10 20 30', language: 'nl', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-590412-001', dateOfBirth: null, notes: 'Prefers quiet room, higher floor.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-2', firstName: 'Charlotte', lastName: 'Kiekeboe', email: 'charlotte.kiekeboe@gmail.com', phone: '+32 476 20 30 40', language: 'nl', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-610823-002', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-3', firstName: 'Fanny', lastName: 'Kiekeboe', email: 'fanny.kiekeboe@outlook.com', phone: '+32 477 30 40 50', language: 'nl', nationality: 'BE', idType: '', idNumber: '', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-4', firstName: 'Konstantinopel', lastName: 'Kiekeboe', email: 'konstantinopel@hotmail.com', phone: '+32 478 40 50 60', language: 'nl', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-950215-004', dateOfBirth: null, notes: 'Always asks for extra pillows.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-5', firstName: 'Leon', lastName: 'Van der Neffe', email: 'leon.vanderneffe@mail.be', phone: '+32 479 50 60 70', language: 'nl', nationality: 'NL', idType: 'Passport', idNumber: 'NL-XR832451', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-6', firstName: 'Froefroe', lastName: 'Van der Neffe', email: 'froefroe@gmail.com', phone: '+32 470 60 70 80', language: 'nl', nationality: 'NL', idType: '', idNumber: '', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-7', firstName: 'Firmin', lastName: 'Van de Kasseien', email: 'firmin.kasseien@telenet.be', phone: '+32 471 70 80 90', language: 'nl', nationality: 'BE', idType: 'ID Card', idNumber: 'BE-550930-007', dateOfBirth: null, notes: 'Loyal returning guest. Likes room 201.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'gp-8', firstName: 'Fernand', lastName: 'Goegebuer', email: 'fernand.goegebuer@yahoo.com', phone: '+32 472 80 90 00', language: 'nl', nationality: 'BE', idType: 'Driving License', idNumber: 'BE-DL-440317-008', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() },
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

// Cash register (Kassa) entries — persisted to localStorage
let cashRegister = (() => {
  try {
    const stored = localStorage.getItem('hotelCashRegister');
    if (stored) return JSON.parse(stored);
  } catch(e) {}
  return [];
})();
const saveCashRegister = () => localStorage.setItem('hotelCashRegister', JSON.stringify(cashRegister));

// Backward-compatibility aliases (companyRegistry / guestRegistry used elsewhere in codebase)
const companyRegistry = companyProfiles;
const saveCompanyRegistry = saveCompanyProfiles;
const guestRegistry = guestProfiles;
const saveGuestRegistry = saveGuestProfiles;
