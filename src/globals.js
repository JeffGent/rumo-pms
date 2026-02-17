// src/globals.js
// Centrale plek voor alle gedeelde mutable state.
// In Babel standalone leefden deze als globale variabelen across script tags.
// In ES modules moeten ze expliciet geimporteerd worden.
//
// Sync callbacks worden gezet door supabase.js bij module evaluation.
// Dit voorkomt circulaire dependencies (config.js ↔ supabase.js).

const globals = {
  // Filled by config.js initConfig()
  hotelSettings: null,
  roomTypes: [],
  ratePlans: [],
  extrasCatalog: [],
  emailTemplates: [],
  hotelUsers: [],
  cancellationPolicies: [],
  vatRates: [],
  companyProfiles: [],
  guestProfiles: [],
  bookerProfiles: [],
  cashRegister: [],
  channelRateOverrides: {},
  channelRestrictions: {},
  channelOTAConnections: [],
  channelActivityLog: [],
  smartPricingConfig: {},

  // Filled by data.js initData()
  reservations: [],
  staffMembers: [],
  currentUser: null,
  currentUserId: null,
  groupChannels: [],

  // Sync callbacks (set by supabase.js at module evaluation time)
  // This avoids config.js importing from supabase.js (circular dep)
  syncConfig: null,
  syncProfiles: null,
};

export default globals;
