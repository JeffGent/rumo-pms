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
    const rawRows = resList
      .filter(res => res.bookingRef && typeof res.bookingRef === 'string' && res.bookingRef.trim() !== '')
      .map(res => ({
        hotel_id: HOTEL_ID,
        booking_ref: res.bookingRef,
        checkin: toDateStr(res.checkin),
        checkout: toDateStr(res.checkout),
        status: res.reservationStatus || 'confirmed',
        guest_name: res.guest || `${res.booker?.firstName || ''} ${res.booker?.lastName || ''}`.trim(),
        data: res,
      }));
    // Deduplicate by booking_ref (last wins) — prevents PG "cannot affect row a second time" error
    const dedupMap = new Map();
    rawRows.forEach(r => {
      if (dedupMap.has(r.booking_ref)) console.warn(`[Supabase] Duplicate booking_ref skipped: ${r.booking_ref}`);
      dedupMap.set(r.booking_ref, r);
    });
    const rows = [...dedupMap.values()];

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
        hotel_id: HOTEL_ID,
        booking_ref: res.bookingRef,
        checkin: toDateStr(res.checkin),
        checkout: toDateStr(res.checkout),
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
      await restUpsert('config', [{ hotel_id: HOTEL_ID, key, data, updated_at: new Date().toISOString() }], 'key');
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
        hotel_id: HOTEL_ID,
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
  try { localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(reservations)); } catch (e) {}
  debounce('all-res', () => syncAllReservations(reservations), 2000);
};

const saveReservationSingle = (res) => {
  try { localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(reservations)); } catch (e) {}
  syncReservation(res);
};

// ── Pull from Supabase (fresh instance) ─────────────────────────────────────
const pullFromSupabase = async () => {
  if (localStorage.getItem(lsKey('supabaseSeeded'))) return false;

  console.log('[Supabase] Fresh instance detected — pulling data from cloud...');
  setSyncStatus('syncing');

  try {
    // 1. Pull config
    const configs = await restGet('config', `hotel_id=eq.${HOTEL_ID}&select=key,data`);
    if (configs.length === 0) {
      console.log('[Supabase] No config in cloud, using defaults');
      localStorage.setItem(lsKey('supabaseSeeded'), String(Date.now()));
      setSyncStatus('idle');
      return false;
    }

    const cfgMap = {};
    configs.forEach(c => { cfgMap[c.key] = c.data; });

    if (cfgMap.hotelSettings) { Object.assign(hotelSettings, cfgMap.hotelSettings); saveHotelSettings(); }
    if (cfgMap.roomTypes && Array.isArray(cfgMap.roomTypes)) { roomTypes.length = 0; roomTypes.push(...cfgMap.roomTypes); saveRoomTypes(); }
    if (cfgMap.ratePlans && Array.isArray(cfgMap.ratePlans)) { ratePlans.length = 0; ratePlans.push(...cfgMap.ratePlans); saveRatePlans(); }
    if (cfgMap.cancellationPolicies && Array.isArray(cfgMap.cancellationPolicies)) { cancellationPolicies.length = 0; cancellationPolicies.push(...cfgMap.cancellationPolicies); saveCancellationPolicies(); }
    if (cfgMap.extrasCatalog && Array.isArray(cfgMap.extrasCatalog)) { extrasCatalog.length = 0; extrasCatalog.push(...cfgMap.extrasCatalog); saveExtrasCatalog(); }
    if (cfgMap.vatRates && Array.isArray(cfgMap.vatRates)) { vatRates.length = 0; vatRates.push(...cfgMap.vatRates); saveVatRates(); }
    if (cfgMap.hotelUsers && Array.isArray(cfgMap.hotelUsers)) { hotelUsers.length = 0; hotelUsers.push(...cfgMap.hotelUsers); saveHotelUsers(); }
    console.log('[Supabase] Config pulled:', Object.keys(cfgMap).join(', '));

    // 2. Pull reservations
    const resRows = await restGet('reservations', `hotel_id=eq.${HOTEL_ID}&select=data&order=booking_ref`);
    if (resRows.length > 0) {
      const pulled = resRows.map(r => r.data);
      try {
        localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(pulled));
        localStorage.setItem(lsKey('hotelDataVersion'), typeof DATA_VERSION !== 'undefined' ? String(DATA_VERSION) : '27');
      } catch (e) {}
      console.log(`[Supabase] Pulled ${resRows.length} reservations`);
    }

    // 3. Pull profiles
    const pullProf = async (table, storageKey) => {
      try {
        const rows = await restGet(table, `hotel_id=eq.${HOTEL_ID}&select=data`);
        if (rows.length > 0) {
          localStorage.setItem(lsKey(storageKey), JSON.stringify(rows.map(r => r.data)));
          console.log(`[Supabase] Pulled ${rows.length} ${table}`);
        }
      } catch (e) { console.warn(`[Supabase] Pull ${table}:`, e.message); }
    };
    await pullProf('company_profiles', 'hotelCompanyProfiles');
    await pullProf('guest_profiles', 'hotelGuestProfiles');
    await pullProf('booker_profiles', 'hotelBookerProfiles');

    // Mark as seeded, reload to re-initialize everything from pulled localStorage
    localStorage.setItem(lsKey('supabaseSeeded'), String(Date.now()));
    console.log('[Supabase] Pull complete — reloading...');
    window.location.reload();
    return true;
  } catch (e) {
    console.error('[Supabase] Pull failed:', e);
    setSyncStatus('error');
    return false;
  }
};

// ── Initial sync on page load ───────────────────────────────────────────────
const initialSync = async () => {
  // Check connectivity with a direct fetch
  try {
    const res = await fetch(`${REST_URL}/config?hotel_id=eq.${HOTEL_ID}&select=key&limit=1`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    console.log('[Supabase] Connectivity OK');
  } catch (e) {
    console.warn('[Supabase] Offline or unreachable:', e.message || e);
    setSyncStatus('offline');
    return;
  }

  // On a fresh instance (no supabaseSeeded flag), pull from cloud first
  const didPull = await pullFromSupabase();
  if (didPull) return; // page is reloading

  // Push current localStorage data to Supabase (direct, no debounce)
  console.log('[Supabase] Starting initial sync...');
  await syncAllReservations(reservations);

  try {
    await restUpsert('config', [
      { hotel_id: HOTEL_ID, key: 'hotelSettings', data: hotelSettings, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'roomTypes', data: roomTypes, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'ratePlans', data: ratePlans, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'cancellationPolicies', data: cancellationPolicies, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'extrasCatalog', data: extrasCatalog, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'vatRates', data: vatRates, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'hotelUsers', data: hotelUsers, updated_at: new Date().toISOString() },
    ], 'key');
  } catch (e) { console.error('[Supabase] Config sync:', e); }

  const profSync = async (table, list) => {
    const rows = dedup(list.map(p => ({ hotel_id: HOTEL_ID, id: String(p.id), data: p, updated_at: new Date().toISOString() })));
    if (rows.length === 0) { console.log(`[Supabase] ${table}: skipped (0 rows)`); return; }
    console.log(`[Supabase] ${table}: upserting ${rows.length} rows...`);
    await restUpsert(table, rows, 'id');
    const verify = await restGet(table, `hotel_id=eq.${HOTEL_ID}&select=id&limit=1`);
    console.log(`[Supabase] ${table}: upsert done, verify read=${verify.length} rows ${verify.length === 0 ? '⚠️ RLS BLOCKING? Check Supabase → Authentication → Policies' : '✓'}`);
  };

  try { await profSync('company_profiles', companyProfiles); } catch (e) { console.error('[Supabase] company_profiles FAILED:', e.message); }
  try { await profSync('guest_profiles', guestProfiles); } catch (e) { console.error('[Supabase] guest_profiles FAILED:', e.message); }
  try { await profSync('booker_profiles', bookerProfiles); } catch (e) { console.error('[Supabase] booker_profiles FAILED:', e.message); }
  console.log('[Supabase] Initial sync complete');
};

// ── Portal code sync ────────────────────────────────────────────────────────
/*
 * SQL for the table (run in Supabase SQL Editor):
 *
 * -- Add hotel_id to existing tables (multi-tenant prep):
 * ALTER TABLE reservations ADD COLUMN IF NOT EXISTS hotel_id text NOT NULL DEFAULT 'default';
 * ALTER TABLE config ADD COLUMN IF NOT EXISTS hotel_id text NOT NULL DEFAULT 'default';
 * ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS hotel_id text NOT NULL DEFAULT 'default';
 * ALTER TABLE guest_profiles ADD COLUMN IF NOT EXISTS hotel_id text NOT NULL DEFAULT 'default';
 * ALTER TABLE booker_profiles ADD COLUMN IF NOT EXISTS hotel_id text NOT NULL DEFAULT 'default';
 *
 * CREATE INDEX IF NOT EXISTS idx_reservations_hotel ON reservations(hotel_id);
 * CREATE INDEX IF NOT EXISTS idx_config_hotel ON config(hotel_id);
 * CREATE INDEX IF NOT EXISTS idx_company_profiles_hotel ON company_profiles(hotel_id);
 * CREATE INDEX IF NOT EXISTS idx_guest_profiles_hotel ON guest_profiles(hotel_id);
 * CREATE INDEX IF NOT EXISTS idx_booker_profiles_hotel ON booker_profiles(hotel_id);
 *
 * -- Portal codes table:
 * CREATE TABLE IF NOT EXISTS guest_portal_codes (
 *   code text PRIMARY KEY,
 *   hotel_id text NOT NULL DEFAULT 'default',
 *   booking_ref text NOT NULL,
 *   room_index integer NOT NULL DEFAULT 0,
 *   valid_from timestamptz,
 *   valid_until timestamptz,
 *   created_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE guest_portal_codes ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "anon_full_access" ON guest_portal_codes FOR ALL USING (true) WITH CHECK (true);
 * CREATE INDEX idx_portal_codes_booking ON guest_portal_codes(booking_ref);
 * CREATE INDEX idx_portal_codes_hotel ON guest_portal_codes(hotel_id);
 */
const syncPortalCode = async (code, bookingRef, roomIndex, validFrom, validUntil) => {
  try {
    await restUpsert('guest_portal_codes', [{
      hotel_id: HOTEL_ID,
      code,
      booking_ref: bookingRef,
      room_index: roomIndex,
      valid_from: validFrom,
      valid_until: validUntil,
      created_at: new Date().toISOString(),
    }], 'code');
  } catch (e) {
    console.error('[Supabase] Portal code sync failed:', e);
  }
};

const lookupPortalCode = async (code) => {
  try {
    // Portal codes are globally unique — lookup without hotel_id filter (guest doesn't know it)
    const rows = await restGet('guest_portal_codes', `code=eq.${encodeURIComponent(code)}&select=*`);
    if (rows.length === 0) return null;
    const row = rows[0];
    const now = new Date();
    if (row.valid_from && new Date(row.valid_from) > now) return null;
    if (row.valid_until && new Date(row.valid_until) < now) return null;
    // Use hotel_id from the portal code row to scope the reservation lookup
    const hid = row.hotel_id || HOTEL_ID;
    const resRows = await restGet('reservations', `hotel_id=eq.${hid}&booking_ref=eq.${encodeURIComponent(row.booking_ref)}&select=data`);
    if (resRows.length === 0) return null;
    // Also pull hotel branding (hotelSettings config) for this tenant
    let hotelBranding = null;
    try {
      const cfgRows = await restGet('config', `hotel_id=eq.${hid}&key=eq.hotelSettings&select=data`);
      if (cfgRows.length > 0) hotelBranding = cfgRows[0].data;
    } catch (e) { /* branding is optional */ }
    return { ...row, reservation: resRows[0].data, hotelBranding };
  } catch (e) {
    console.error('[Supabase] Portal code lookup failed:', e);
    return null;
  }
};

// ── Force pull (console helper) ────────────────────────────────────────────
window.forcePull = () => {
  localStorage.removeItem(lsKey('supabaseSeeded'));
  console.log('[Supabase] supabaseSeeded removed — reloading to trigger pull...');
  location.reload();
};
