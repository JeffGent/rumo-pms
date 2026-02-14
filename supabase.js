// ── Supabase Connection ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://smglrskbamymikilwsti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZ2xyc2tiYW15bWlraWx3c3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTA2ODgsImV4cCI6MjA4NjU2NjY4OH0.YOVm4nAvZzxrqq_vIIUaf-jCM5NTBShTAQeBhOknw8Q';

// REST API base for direct fetch calls (bypasses supabase-js AbortController issues)
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const REST_HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=minimal',
};

// ── Sync status (reactive) ──────────────────────────────────────────────────
let syncStatus = 'idle';
let lastSyncTime = null;
let syncListeners = [];

const onSyncChange = (fn) => { syncListeners.push(fn); return () => { syncListeners = syncListeners.filter(f => f !== fn); }; };
const notifySync = () => syncListeners.forEach(fn => fn(syncStatus, lastSyncTime));
const setSyncStatus = (s) => { syncStatus = s; if (s === 'idle') lastSyncTime = new Date(); notifySync(); };

// ── Debounce helper ─────────────────────────────────────────────────────────
const debounceTimers = {};
const debounce = (key, fn, ms = 1500) => {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(fn, ms);
};

// ── Direct REST helpers ─────────────────────────────────────────────────────

const restGet = async (table, query = '') => {
  const res = await fetch(`${REST_URL}/${table}?${query}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

const restUpsert = async (table, rows, onConflict) => {
  const url = onConflict
    ? `${REST_URL}/${table}?on_conflict=${onConflict}`
    : `${REST_URL}/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: REST_HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
};

// ── Reservation sync ────────────────────────────────────────────────────────

const syncAllReservations = async (resList) => {
  setSyncStatus('syncing');
  try {
    const rawRows = resList.map(res => ({
      booking_ref: res.bookingRef,
      checkin: res.checkin instanceof Date ? res.checkin.toISOString().slice(0, 10) : (res.checkin || '').slice(0, 10),
      checkout: res.checkout instanceof Date ? res.checkout.toISOString().slice(0, 10) : (res.checkout || '').slice(0, 10),
      status: res.reservationStatus || 'confirmed',
      guest_name: res.guest || `${res.booker?.firstName || ''} ${res.booker?.lastName || ''}`.trim(),
      data: res,
    }));
    // Deduplicate by booking_ref (last wins) — prevents PG "cannot affect row a second time" error
    const rows = [...new Map(rawRows.map(r => [r.booking_ref, r])).values()];

    // Upsert in batches of 50 (PostgREST limit safe)
    for (let i = 0; i < rows.length; i += 50) {
      await restUpsert('reservations', rows.slice(i, i + 50), 'booking_ref');
    }

    setSyncStatus('idle');
    console.log(`[Supabase] Synced ${rows.length} reservations`);
    return true;
  } catch (e) {
    console.error('[Supabase] Sync failed:', e);
    setSyncStatus('error');
    return false;
  }
};

const syncReservation = async (res) => {
  if (!res?.bookingRef) return;
  debounce(`res-${res.bookingRef}`, async () => {
    setSyncStatus('syncing');
    try {
      await restUpsert('reservations', [{
        booking_ref: res.bookingRef,
        checkin: res.checkin instanceof Date ? res.checkin.toISOString().slice(0, 10) : (res.checkin || '').slice(0, 10),
        checkout: res.checkout instanceof Date ? res.checkout.toISOString().slice(0, 10) : (res.checkout || '').slice(0, 10),
        status: res.reservationStatus || 'confirmed',
        guest_name: res.guest || `${res.booker?.firstName || ''} ${res.booker?.lastName || ''}`.trim(),
        data: res,
        updated_at: new Date().toISOString(),
      }], 'booking_ref');
      setSyncStatus('idle');
    } catch (e) {
      console.error('[Supabase] Single sync failed:', e);
      setSyncStatus('error');
    }
  });
};

// ── Config sync ─────────────────────────────────────────────────────────────
const syncConfig = (key, data) => {
  debounce(`cfg-${key}`, async () => {
    try {
      await restUpsert('config', [{ key, data, updated_at: new Date().toISOString() }], 'key');
    } catch (e) {
      console.error(`[Supabase] Config sync failed (${key}):`, e);
    }
  });
};

// ── Profile sync ────────────────────────────────────────────────────────────
const dedup = (rows) => [...new Map(rows.map(r => [r.id, r])).values()];

const syncProfiles = (table, profiles) => {
  debounce(`prof-${table}`, async () => {
    try {
      const rows = dedup(profiles.map(p => ({
        id: String(p.id),
        data: p,
        updated_at: new Date().toISOString(),
      })));
      if (rows.length === 0) return;
      await restUpsert(table, rows, 'id');
    } catch (e) {
      console.error(`[Supabase] Profile sync failed (${table}):`, e);
    }
  });
};

// ── Convenience: save reservations to localStorage + Supabase ───────────────
const saveReservations = () => {
  try { localStorage.setItem('hotelReservations', JSON.stringify(reservations)); } catch (e) {}
  debounce('all-res', () => syncAllReservations(reservations), 2000);
};

const saveReservationSingle = (res) => {
  try { localStorage.setItem('hotelReservations', JSON.stringify(reservations)); } catch (e) {}
  syncReservation(res);
};

// ── Initial sync on page load ───────────────────────────────────────────────
const initialSync = async () => {
  // Check connectivity with a direct fetch
  try {
    const res = await fetch(`${REST_URL}/config?select=key&limit=1`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    console.log('[Supabase] Connectivity OK');
  } catch (e) {
    console.warn('[Supabase] Offline or unreachable:', e.message || e);
    setSyncStatus('offline');
    return;
  }

  // Push current localStorage data to Supabase (direct, no debounce)
  console.log('[Supabase] Starting initial sync...');
  await syncAllReservations(reservations);

  try {
    await restUpsert('config', [
      { key: 'hotelSettings', data: hotelSettings, updated_at: new Date().toISOString() },
      { key: 'roomTypes', data: roomTypes, updated_at: new Date().toISOString() },
      { key: 'ratePlans', data: ratePlans, updated_at: new Date().toISOString() },
      { key: 'cancellationPolicies', data: cancellationPolicies, updated_at: new Date().toISOString() },
      { key: 'extrasCatalog', data: extrasCatalog, updated_at: new Date().toISOString() },
      { key: 'vatRates', data: vatRates, updated_at: new Date().toISOString() },
    ], 'key');
  } catch (e) { console.error('[Supabase] Config sync:', e); }

  const profSync = async (table, list) => {
    const rows = dedup(list.map(p => ({ id: String(p.id), data: p, updated_at: new Date().toISOString() })));
    if (rows.length === 0) { console.log(`[Supabase] ${table}: skipped (0 rows)`); return; }
    console.log(`[Supabase] ${table}: upserting ${rows.length} rows...`);
    await restUpsert(table, rows, 'id');
    // Verify write succeeded by reading back
    const verify = await restGet(table, 'select=id&limit=1');
    console.log(`[Supabase] ${table}: upsert done, verify read=${verify.length} rows ${verify.length === 0 ? '⚠️ RLS BLOCKING? Check Supabase → Authentication → Policies' : '✓'}`);
  };

  try { await profSync('company_profiles', companyProfiles); } catch (e) { console.error('[Supabase] company_profiles FAILED:', e.message); }
  try { await profSync('guest_profiles', guestProfiles); } catch (e) { console.error('[Supabase] guest_profiles FAILED:', e.message); }
  try { await profSync('booker_profiles', bookerProfiles); } catch (e) { console.error('[Supabase] booker_profiles FAILED:', e.message); }
  console.log('[Supabase] Initial sync complete');
};
