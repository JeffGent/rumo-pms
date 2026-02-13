// Helper function voor datum berekeningen
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// VIES VAT lookup with CORS proxy fallback
const fetchVIES = (countryCode, vatNum) => {
  const viesUrl = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNum}`;
  return fetch(`https://corsproxy.io/?${encodeURIComponent(viesUrl)}`)
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .catch(() => fetch(`https://api.codetabs.com/v1/proxy?quest=${viesUrl}`).then(r => r.json()));
};

// Date inputs: calendar-only (no typing), click opens picker globally
const noTypeDateKey = (e) => { if (!['Tab','Escape'].includes(e.key)) e.preventDefault(); };
document.addEventListener('click', (e) => { if (e.target.matches('input[type="date"]')) try { e.target.showPicker(); } catch(ex) {} });
document.addEventListener('keydown', (e) => { if (e.target.matches('input[type="date"]') && !['Tab','Escape'].includes(e.key)) e.preventDefault(); });

const formatDate = (date) => {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Derive reservation-level dates from room-level dates (min checkin, max checkout)
const deriveReservationDates = (res) => {
  if (!res.rooms || res.rooms.length === 0) return;
  const checkins = res.rooms.map(r => new Date(r.checkin)).filter(d => !isNaN(d));
  const checkouts = res.rooms.map(r => new Date(r.checkout)).filter(d => !isNaN(d));
  if (checkins.length > 0) res.checkin = new Date(Math.min(...checkins));
  if (checkouts.length > 0) res.checkout = new Date(Math.max(...checkouts));
};

// Build flat room entries: explode multi-room reservations into 1 entry per room
const buildFlatRoomEntries = (resList) => {
  const entries = [];
  resList.forEach(res => {
    if (res.rooms && res.rooms.length > 0) {
      res.rooms.forEach((room, ri) => {
        entries.push({
          ...res,
          room: room.roomNumber,
          checkin: room.checkin || res.checkin,
          checkout: room.checkout || res.checkout,
          _roomData: room,
          _roomIndex: ri
        });
      });
    } else {
      entries.push(res);
    }
  });
  return entries;
};
