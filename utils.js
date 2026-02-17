// ── Date Helpers ────────────────────────────────────────────────────────────
// Consistent date handling: internally always ISO strings, Date only for rendering.

/** Convert any date-like value to ISO date string "YYYY-MM-DD" */
const toDateStr = (d) => {
  if (!d) return '';
  if (d instanceof Date) return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

/** Convert ISO date string to Date object (midnight local time) */
const toDate = (s) => {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// VIES VAT lookup with CORS proxy fallback
// TODO PRODUCTION: Replace corsproxy.io with own backend proxy (Supabase Edge Function)
// to avoid third-party dependency and rate limits.
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
  if (checkins.length > 0) res.checkin = new Date(Math.min(...checkins)).toISOString();
  if (checkouts.length > 0) res.checkout = new Date(Math.max(...checkouts)).toISOString();
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

// ── Error Boundary ──────────────────────────────────────────────────────────
// Catches render errors in child components and shows a recovery UI
// instead of crashing the entire app with a white screen.

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary] ${this.props.name || 'Component'} crashed:`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'flex flex-col items-center justify-center min-h-[300px] p-8 text-center'
      },
        React.createElement('div', { className: 'w-12 h-12 mb-4 rounded-2xl bg-red-50 flex items-center justify-center' },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', className: 'w-6 h-6 text-red-500' },
            React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
            React.createElement('line', { x1: '12', y1: '8', x2: '12', y2: '12' }),
            React.createElement('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' })
          )
        ),
        React.createElement('h3', { className: 'text-sm font-semibold text-neutral-900 mb-1' },
          `${this.props.name || 'This section'} encountered an error`
        ),
        React.createElement('p', { className: 'text-xs text-neutral-500 mb-4 max-w-sm' },
          String(this.state.error?.message || 'An unexpected error occurred')
        ),
        React.createElement('button', {
          className: 'px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors',
          onClick: () => this.setState({ hasError: false, error: null })
        }, 'Try Again')
      );
    }
    return this.props.children;
  }
}
