import globals from './globals.js';
import { toDateStr } from './utils.js';
import {
  HOTEL_ID, lsKey,
  saveHotelSettings, saveRoomTypes, saveRatePlans, saveCancellationPolicies,
  saveExtrasCatalog, saveVatRates, saveHotelUsers,
} from './config.js';
import { DATA_VERSION } from './data.js';

// ── Supabase Connection ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://smglrskbamymikilwsti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZ2xyc2tiYW15bWlraWx3c3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTA2ODgsImV4cCI6MjA4NjU2NjY4OH0.YOVm4nAvZzxrqq_vIIUaf-jCM5NTBShTAQeBhOknw8Q';

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

export const onSyncChange = (fn) => { syncListeners.push(fn); return () => { syncListeners = syncListeners.filter(f => f !== fn); }; };
const notifySync = () => syncListeners.forEach(fn => fn(syncStatus, lastSyncTime));
const setSyncStatus = (s) => { syncStatus = s; if (s === 'idle') lastSyncTime = new Date(); notifySync(); };

// ── Debounce helper ─────────────────────────────────────────────────────────
const debounceTimers = {};
export const debounce = (key, fn, ms = 1500) => {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(fn, ms);
};

// ── Direct REST helpers ─────────────────────────────────────────────────────
export const restGet = async (table, query = '') => {
  const res = await fetch(`${REST_URL}/${table}?${query}`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

export const restUpsert = async (table, rows, onConflict) => {
  const url = onConflict ? `${REST_URL}/${table}?on_conflict=${onConflict}` : `${REST_URL}/${table}`;
  const res = await fetch(url, { method: 'POST', headers: REST_HEADERS, body: JSON.stringify(rows) });
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
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
        updated_at: new Date().toISOString(),
      }));
    const dedupMap = new Map();
    rawRows.forEach(r => {
      if (dedupMap.has(r.booking_ref)) console.warn(`[Supabase] Duplicate booking_ref skipped: ${r.booking_ref}`);
      dedupMap.set(r.booking_ref, r);
    });
    const rows = [...dedupMap.values()];
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

export const syncReservation = async (res) => {
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
export const syncConfig = (key, data) => {
  debounce(`cfg-${key}`, async () => {
    try {
      await restUpsert('config', [{ hotel_id: HOTEL_ID, key, data, updated_at: new Date().toISOString() }], 'key');
    } catch (e) {
      console.error(`[Supabase] Config sync failed (${key}):`, e);
    }
  });
};

// Register syncConfig on globals so config.js can call it without circular import
globals.syncConfig = syncConfig;

// ── Profile sync ────────────────────────────────────────────────────────────
const dedup = (rows) => [...new Map(rows.map(r => [r.id, r])).values()];

export const syncProfiles = (table, profiles) => {
  debounce(`prof-${table}`, async () => {
    try {
      const rows = dedup(profiles.map(p => ({
        hotel_id: HOTEL_ID, id: String(p.id), data: p, updated_at: new Date().toISOString(),
      })));
      if (rows.length === 0) return;
      await restUpsert(table, rows, 'id');
    } catch (e) {
      console.error(`[Supabase] Profile sync failed (${table}):`, e);
    }
  });
};

// ── Convenience: save reservations to localStorage + Supabase ───────────────
export const saveReservations = () => {
  try { localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(globals.reservations)); } catch (e) {}
  debounce('all-res', () => syncAllReservations(globals.reservations), 2000);
};

export const saveReservationSingle = (res) => {
  try { localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(globals.reservations)); } catch (e) {}
  syncReservation(res);
};

// ── Pull from Supabase (fresh instance) ─────────────────────────────────────
const pullFromSupabase = async () => {
  if (localStorage.getItem(lsKey('supabaseSeeded'))) return false;

  console.log('[Supabase] Fresh instance detected \u2014 pulling data from cloud...');
  setSyncStatus('syncing');

  try {
    const configs = await restGet('config', `hotel_id=eq.${HOTEL_ID}&select=key,data`);
    if (configs.length === 0) {
      console.log('[Supabase] No config in cloud, using defaults');
      localStorage.setItem(lsKey('supabaseSeeded'), String(Date.now()));
      setSyncStatus('idle');
      return false;
    }

    const cfgMap = {};
    configs.forEach(c => { cfgMap[c.key] = c.data; });

    if (cfgMap.hotelSettings) { Object.assign(globals.hotelSettings, cfgMap.hotelSettings); saveHotelSettings(); }
    if (cfgMap.roomTypes && Array.isArray(cfgMap.roomTypes)) { globals.roomTypes.length = 0; globals.roomTypes.push(...cfgMap.roomTypes); saveRoomTypes(); }
    if (cfgMap.ratePlans && Array.isArray(cfgMap.ratePlans)) { globals.ratePlans.length = 0; globals.ratePlans.push(...cfgMap.ratePlans); saveRatePlans(); }
    if (cfgMap.cancellationPolicies && Array.isArray(cfgMap.cancellationPolicies)) { globals.cancellationPolicies.length = 0; globals.cancellationPolicies.push(...cfgMap.cancellationPolicies); saveCancellationPolicies(); }
    if (cfgMap.extrasCatalog && Array.isArray(cfgMap.extrasCatalog)) { globals.extrasCatalog.length = 0; globals.extrasCatalog.push(...cfgMap.extrasCatalog); saveExtrasCatalog(); }
    if (cfgMap.vatRates && Array.isArray(cfgMap.vatRates)) { globals.vatRates.length = 0; globals.vatRates.push(...cfgMap.vatRates); saveVatRates(); }
    if (cfgMap.hotelUsers && Array.isArray(cfgMap.hotelUsers)) { globals.hotelUsers.length = 0; globals.hotelUsers.push(...cfgMap.hotelUsers); saveHotelUsers(); }
    console.log('[Supabase] Config pulled:', Object.keys(cfgMap).join(', '));

    const resRows = await restGet('reservations', `hotel_id=eq.${HOTEL_ID}&select=data&order=booking_ref`);
    if (resRows.length > 0) {
      const pulled = resRows.map(r => r.data);
      try {
        localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(pulled));
        localStorage.setItem(lsKey('hotelDataVersion'), String(DATA_VERSION));
      } catch (e) {}
      console.log(`[Supabase] Pulled ${resRows.length} reservations`);
    }

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

    localStorage.setItem(lsKey('supabaseSeeded'), String(Date.now()));
    console.log('[Supabase] Pull complete \u2014 reloading...');
    window.location.reload();
    return true;
  } catch (e) {
    console.error('[Supabase] Pull failed:', e);
    setSyncStatus('error');
    return false;
  }
};

// ── Initial sync on page load ───────────────────────────────────────────────
export const initialSync = async () => {
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

  const didPull = await pullFromSupabase();
  if (didPull) return;

  console.log('[Supabase] Starting initial sync...');
  await syncAllReservations(globals.reservations);

  try {
    await restUpsert('config', [
      { hotel_id: HOTEL_ID, key: 'hotelSettings', data: globals.hotelSettings, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'roomTypes', data: globals.roomTypes, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'ratePlans', data: globals.ratePlans, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'cancellationPolicies', data: globals.cancellationPolicies, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'extrasCatalog', data: globals.extrasCatalog, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'vatRates', data: globals.vatRates, updated_at: new Date().toISOString() },
      { hotel_id: HOTEL_ID, key: 'hotelUsers', data: globals.hotelUsers, updated_at: new Date().toISOString() },
    ], 'key');
  } catch (e) { console.error('[Supabase] Config sync:', e); }

  const profSync = async (table, list) => {
    const rows = dedup(list.map(p => ({ hotel_id: HOTEL_ID, id: String(p.id), data: p, updated_at: new Date().toISOString() })));
    if (rows.length === 0) { console.log(`[Supabase] ${table}: skipped (0 rows)`); return; }
    console.log(`[Supabase] ${table}: upserting ${rows.length} rows...`);
    await restUpsert(table, rows, 'id');
    const verify = await restGet(table, `hotel_id=eq.${HOTEL_ID}&select=id&limit=1`);
    console.log(`[Supabase] ${table}: upsert done, verify read=${verify.length} rows ${verify.length === 0 ? '\u26a0\ufe0f RLS BLOCKING? Check Supabase \u2192 Authentication \u2192 Policies' : '\u2713'}`);
  };

  try { await profSync('company_profiles', globals.companyProfiles); } catch (e) { console.error('[Supabase] company_profiles FAILED:', e.message); }
  try { await profSync('guest_profiles', globals.guestProfiles); } catch (e) { console.error('[Supabase] guest_profiles FAILED:', e.message); }
  try { await profSync('booker_profiles', globals.bookerProfiles); } catch (e) { console.error('[Supabase] booker_profiles FAILED:', e.message); }
  console.log('[Supabase] Initial sync complete');
};

// ── Portal code lookup ──────────────────────────────────────────────────────
export const lookupPortalCode = async (code) => {
  try {
    const resRows = await restGet('reservations', `booking_ref=eq.${encodeURIComponent(code)}&select=hotel_id,data`);
    if (resRows.length === 0) return null;
    const row = resRows[0];
    const hid = row.hotel_id || HOTEL_ID;
    let hotelBranding = null;
    try {
      const cfgRows = await restGet('config', `hotel_id=eq.${hid}&key=eq.hotelSettings&select=data`);
      if (cfgRows.length > 0) hotelBranding = cfgRows[0].data;
    } catch (e) {}
    return { reservation: row.data, hotelBranding };
  } catch (e) {
    console.error('[Supabase] Portal lookup failed:', e);
    return null;
  }
};

// ── Force pull (console helper) ────────────────────────────────────────────
window.forcePull = () => {
  localStorage.removeItem(lsKey('supabaseSeeded'));
  console.log('[Supabase] supabaseSeeded removed \u2014 reloading to trigger pull...');
  location.reload();
};
