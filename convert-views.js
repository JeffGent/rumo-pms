// Node.js script to convert views/ files to src/views/ ES modules
// Usage: node convert-views.js
//
// Strategy: For each global name, replace bare references with globals.xxx
// using a tokenizer-aware approach that avoids strings, comments, and
// property names.

const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const srcViewsDir = path.join(__dirname, 'src', 'views');

if (!fs.existsSync(srcViewsDir)) {
  fs.mkdirSync(srcViewsDir, { recursive: true });
}

// ── Per-file configuration ──
const FILE_CONFIG = {
  'calendar.js': {
    outName: 'calendar.jsx',
    component: 'CalendarView',
    hooks: ['useState', 'useRef'],
    globals: ['reservations', 'currentUser'],
    utilImports: ['addDays', 'canAccessPage', 'lsKey'],
    configImports: ['getAllRooms', 'getRoomTypeName', 'buildFlatRoomEntries'],
    icons: true,
    supabaseImports: ['saveReservationSingle'],
    dataImports: [],
    otherImports: [],
  },
  'housekeeping.js': {
    outName: 'housekeeping.jsx',
    component: 'HousekeepingView',
    hooks: [],
    globals: ['reservations', 'currentUser'],
    utilImports: ['formatDate', 'addDays', 'canAccessPage'],
    configImports: ['buildFlatRoomEntries'],
    icons: true,
    supabaseImports: [],
    dataImports: [],
    otherImports: [],
  },
  'fnb.js': {
    outName: 'fnb.jsx',
    component: 'FBView',
    hooks: [],
    globals: ['reservations', 'extrasCatalog', 'ratePlans', 'currentUser'],
    utilImports: ['formatDate', 'addDays', 'canAccessPage'],
    configImports: ['buildFlatRoomEntries'],
    icons: true,
    supabaseImports: [],
    dataImports: [],
    otherImports: [],
  },
  'profiles.js': {
    outName: 'profiles.jsx',
    component: 'ProfilesView',
    hooks: ['useState', 'useEffect'],
    globals: ['bookerProfiles', 'guestProfiles', 'companyProfiles', 'reservations', 'currentUser'],
    utilImports: ['canAccessPage', 'detectLanguageFromPhone', 'fetchVIES', 'SUPPORTED_LANGUAGES', 'noTypeDateKey'],
    configImports: [],
    icons: true,
    supabaseImports: ['saveBookerProfiles', 'saveGuestProfiles', 'saveCompanyProfiles', 'saveReservations', 'syncProfiles'],
    dataImports: [],
    otherImports: [],
  },
  'settings.js': {
    outName: 'settings.jsx',
    component: 'SettingsView',
    hooks: ['useState', 'useEffect', 'useRef'],
    globals: ['hotelSettings', 'roomTypes', 'ratePlans', 'cancellationPolicies', 'extrasCatalog', 'vatRates', 'hotelUsers', 'emailTemplates', 'reservations', 'currentUser'],
    utilImports: ['canAccessPage', 'lsKey', 'SUPPORTED_LANGUAGES'],
    configImports: [],
    icons: true,
    supabaseImports: ['saveHotelSettings', 'saveRoomTypes', 'saveRatePlans', 'saveCancellationPolicies', 'saveExtrasCatalog', 'saveVatRates', 'saveHotelUsers', 'saveEmailTemplates', 'syncConfig'],
    dataImports: [],
    otherImports: [{ from: '../components/emailengine.js', imports: ['resolveTemplateVariables'] }],
  },
  'reports.js': {
    outName: 'reports.jsx',
    component: 'ReportsView',
    hooks: ['useState'],
    globals: ['reservations', 'currentUser'],
    utilImports: ['addDays', 'canAccessPage', 'noTypeDateKey', 'lsKey'],
    configImports: ['getAllRooms', 'getRoomTypeName'],
    icons: true,
    supabaseImports: [],
    dataImports: [],
    otherImports: [],
  },
  'payments.js': {
    outName: 'payments.jsx',
    component: 'PaymentsView',
    hooks: ['useState', 'useEffect', 'useRef'],
    globals: ['reservations', 'hotelSettings', 'bookerProfiles', 'cashRegister', 'currentUser'],
    utilImports: ['canAccessPage', 'noTypeDateKey', 'formatDate'],
    configImports: [],
    icons: true,
    supabaseImports: ['saveReservationSingle', 'saveCashRegister'],
    dataImports: [],
    otherImports: [],
  },
  'channelmanager.js': {
    outName: 'channelmanager.jsx',
    component: 'ChannelManagerView',
    hooks: ['useState', 'useEffect', 'useRef'],
    globals: ['channelOTAConnections', 'channelRateOverrides', 'channelRestrictions', 'channelActivityLog', 'smartPricingConfig', 'hotelSettings', 'roomTypes', 'ratePlans', 'reservations', 'currentUser'],
    utilImports: ['canAccessPage', 'getHotelAddress', 'getStopSellTime'],
    configImports: ['getAllRooms'],
    icons: true,
    supabaseImports: ['saveChannelRateOverrides', 'saveChannelRestrictions', 'saveChannelOTAConnections', 'saveChannelActivityLog', 'saveSmartPricingConfig', 'syncConfig'],
    dataImports: [],
    otherImports: [],
  },
  'portal.js': {
    outName: 'portal.jsx',
    component: 'GuestPortal',
    hooks: ['useState', 'useEffect'],
    globals: ['reservations', 'hotelSettings'],
    utilImports: [],
    configImports: ['getRoomTypeName'],
    icons: false,
    supabaseImports: ['lookupPortalCode'],
    dataImports: [],
    otherImports: [],
  },
};

function buildImportHeader(config) {
  const lines = [];
  if (config.hooks.length > 0) {
    lines.push(`import React, { ${config.hooks.join(', ')} } from 'react';`);
  } else {
    lines.push(`import React from 'react';`);
  }
  if (config.globals.length > 0) lines.push(`import globals from '../globals.js';`);
  if (config.utilImports.length > 0) lines.push(`import { ${config.utilImports.join(', ')} } from '../utils.js';`);
  if (config.configImports.length > 0) lines.push(`import { ${config.configImports.join(', ')} } from '../config.js';`);
  if (config.icons) lines.push(`import Icons from '../icons.jsx';`);
  if (config.supabaseImports.length > 0) lines.push(`import { ${config.supabaseImports.join(', ')} } from '../supabase.js';`);
  if (config.dataImports.length > 0) lines.push(`import { ${config.dataImports.join(', ')} } from '../data.js';`);
  for (const imp of (config.otherImports || [])) {
    lines.push(`import { ${imp.imports.join(', ')} } from '${imp.from}';`);
  }
  return lines.join('\n');
}

/**
 * Replace global name references with globals.name
 * Uses a careful regex that:
 * - Only matches standalone identifiers (word boundaries)
 * - Skips if preceded by . (property access like r.reservations)
 * - Skips if preceded by globals. (already prefixed)
 * - Skips inside string literals (basic heuristic)
 */
function replaceGlobalRefs(code, globalNames) {
  for (const name of globalNames) {
    // Build a regex that matches the name as a standalone identifier
    // Negative lookbehind: not preceded by . or word chars or $ or globals.
    // Negative lookahead: not followed by word chars or $
    const re = new RegExp(`(?<![.\\w$])\\b${name}\\b(?=[^\\w$]|$)`, 'g');

    code = code.replace(re, (match, offset) => {
      // Check preceding context (up to 10 chars) for . or already globals.
      const pre = code.substring(Math.max(0, offset - 10), offset);
      if (pre.endsWith('.') || pre.endsWith('globals.')) return match;

      // Check if inside a string (look for unmatched quotes)
      // Simple heuristic: check the last 100 chars for single/double quotes
      // This won't catch all cases but handles the most common ones
      const lineStart = code.lastIndexOf('\n', offset - 1) + 1;
      const lineText = code.substring(lineStart, offset);

      // Skip if inside a single-quoted or double-quoted string
      // Count unescaped quotes before this position on the same line
      let inSingle = false, inDouble = false, inTemplate = false;
      for (let i = 0; i < lineText.length; i++) {
        const ch = lineText[i];
        const prev = i > 0 ? lineText[i-1] : '';
        if (prev === '\\') continue;
        if (ch === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
        if (ch === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
        if (ch === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
      }
      if (inSingle || inDouble || inTemplate) return match;

      // Check if it's a line comment
      const commentIdx = lineText.indexOf('//');
      if (commentIdx >= 0 && offset - lineStart > commentIdx) return match;

      return `globals.${name}`;
    });
  }
  return code;
}

function processFile(filename, config) {
  const inputPath = path.join(viewsDir, filename);
  const outputPath = path.join(srcViewsDir, config.outName);

  console.log(`Processing ${filename} -> ${config.outName}`);

  let code = fs.readFileSync(inputPath, 'utf-8');

  // 1. Remove leading comment
  code = code.replace(/^\/\/[^\n]*\n/, '');
  // Also remove secondary comment lines (like portal.js has multiple comment lines)
  while (code.startsWith('//')) {
    code = code.replace(/^\/\/[^\n]*\n/, '');
  }

  // 2. Replace React.useXxx with useXxx
  code = code.replace(/React\.useState\b/g, 'useState');
  code = code.replace(/React\.useEffect\b/g, 'useEffect');
  code = code.replace(/React\.useRef\b/g, 'useRef');
  code = code.replace(/React\.useCallback\b/g, 'useCallback');
  code = code.replace(/React\.useMemo\b/g, 'useMemo');

  // 3. Replace global state references
  code = replaceGlobalRefs(code, config.globals);

  // 4. Build output
  const header = buildImportHeader(config);
  const exportLine = `\nexport default ${config.component};\n`;
  const output = header + '\n\n' + code + exportLine;

  fs.writeFileSync(outputPath, output, 'utf-8');

  // Verification: count how many globals.xxx references were created
  for (const name of config.globals) {
    const count = (output.match(new RegExp(`globals\\.${name}`, 'g')) || []).length;
    console.log(`  globals.${name}: ${count} replacements`);
  }

  console.log(`  Written ${output.split('\n').length} lines`);
}

// ── Main ──
console.log('Converting view files to ES modules...\n');
console.log('NOTE: dashboard.jsx was already written manually.\n');

for (const [filename, config] of Object.entries(FILE_CONFIG)) {
  try {
    processFile(filename, config);
  } catch (err) {
    console.error(`ERROR processing ${filename}:`, err.message);
  }
  console.log('');
}

console.log('Conversion complete!');
console.log('\nManual verification needed:');
console.log('- Check that no local variables/params were incorrectly prefixed');
console.log('- Verify React.Fragment / React.createElement references are intact');
