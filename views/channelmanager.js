// ── Channel Manager View ─────────────────────────────────────────────────────
const ChannelManagerView = (props) => {
  const { sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation, selectedDate, setSelectedDate, setToastMessage } = props;

  const [cmTab, setCmTab] = useState('rates');
  const [rateDate, setRateDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [rateDays] = useState(14);
  const [expandedTypes, setExpandedTypes] = useState(() => {
    const map = {};
    roomTypes.forEach(rt => map[rt.id] = true);
    return map;
  });
  const [localOverrides, setLocalOverrides] = useState(() => JSON.parse(JSON.stringify(channelRateOverrides)));
  const [localRestrictions, setLocalRestrictions] = useState(() => JSON.parse(JSON.stringify(channelRestrictions)));
  const [localChannels, setLocalChannels] = useState(() => JSON.parse(JSON.stringify(channelOTAConnections)));
  const [rateDirty, setRateDirty] = useState(false);
  const [channelDirty, setChannelDirty] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [logFilter, setLogFilter] = useState('');
  const [logChannelFilter, setLogChannelFilter] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkRoomType, setBulkRoomType] = useState('');
  const [bulkRatePlan, setBulkRatePlan] = useState('');
  const [bulkPriceMode, setBulkPriceMode] = useState('fixed'); // 'fixed' | 'adjust_eur' | 'adjust_pct'
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkMinStay, setBulkMinStay] = useState('');
  const [bulkStopSell, setBulkStopSell] = useState(false);
  const [bulkChannels, setBulkChannels] = useState([]); // array of channel IDs
  const [bulkAvailability, setBulkAvailability] = useState(''); // '' | 'close' | 'open'
  const [bulkDays, setBulkDays] = useState([]); // day indices 0-6, empty = all
  const [rateChannel, setRateChannel] = useState(''); // '' = all channels (base rates), or channel id
  const [syncProgress, setSyncProgress] = useState(null); // { channelName, current, total, phase }

  // Smart Pricing state
  const [spConfig, setSpConfig] = useState(() => JSON.parse(JSON.stringify(smartPricingConfig)));
  const [spDirty, setSpDirty] = useState(false);
  const [spPreviewDays] = useState(14);

  // Ensure every room type has a rule
  React.useEffect(() => {
    let changed = false;
    const rules = [...spConfig.rules];
    roomTypes.forEach(rt => {
      if (!rules.find(r => r.roomTypeId === rt.id)) {
        rules.push({
          roomTypeId: rt.id,
          enabled: true,
          tiers: [
            { minOcc: 0,  maxOcc: 30,  adjustment: -10 },
            { minOcc: 30, maxOcc: 60,  adjustment: 0 },
            { minOcc: 60, maxOcc: 80,  adjustment: 15 },
            { minOcc: 80, maxOcc: 100, adjustment: 30 },
          ]
        });
        changed = true;
      }
    });
    if (changed) setSpConfig(prev => ({ ...prev, rules }));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────
  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addD = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const days = Array.from({length: rateDays}, (_, i) => addD(rateDate, i));
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const selectedChannel = rateChannel ? localChannels.find(ch => ch.id === rateChannel) : null;
  const channelModifier = selectedChannel ? (selectedChannel.rateModifier || 0) : 0;

  const getBasePrice = (rtId, rpId, date) => {
    const key = `${rtId}:${rpId}:${fmtDate(date)}`;
    if (localOverrides[key] !== undefined) return localOverrides[key];
    const rt = roomTypes.find(t => t.id === rtId);
    const rp = ratePlans.find(p => p.id === rpId);
    if (!rt || !rp) return 0;
    return Math.round(rt.defaultRate + rp.priceModifier);
  };

  const getPrice = (rtId, rpId, date) => {
    const base = getBasePrice(rtId, rpId, date);
    if (!selectedChannel) return base;
    // Check for per-channel price override first
    const chKey = `${selectedChannel.id}:${rtId}:${rpId}:${fmtDate(date)}`;
    const chOverrides = selectedChannel.channelRateOverrides || {};
    if (chOverrides[chKey] !== undefined) return chOverrides[chKey];
    // Apply percentage modifier
    return Math.round(base * (1 + channelModifier / 100));
  };

  const getRestriction = (rtId, date) => {
    const key = `${rtId}:${fmtDate(date)}`;
    const base = localRestrictions[key] || { minStay: 0, maxStay: 0, stopSell: false, cta: false, ctd: false };
    if (!selectedChannel) return base;
    // Merge with per-channel restriction overrides
    const chKey = `${selectedChannel.id}:${rtId}:${fmtDate(date)}`;
    const chOverride = selectedChannel.restrictionOverrides?.[chKey];
    if (!chOverride) return base;
    return { ...base, ...chOverride };
  };

  const getAvailability = (rtId, date) => {
    const rt = roomTypes.find(t => t.id === rtId);
    if (!rt) return 0;
    const dateStr = fmtDate(date);
    let booked = 0;
    reservations.forEach(res => {
      if (res.status === 'cancelled') return;
      res.rooms?.forEach(rm => {
        if (!rt.rooms.includes(rm.roomNumber)) return;
        const ci = rm.checkin instanceof Date ? fmtDate(rm.checkin) : (rm.checkin || '').slice(0, 10);
        const co = rm.checkout instanceof Date ? fmtDate(rm.checkout) : (rm.checkout || '').slice(0, 10);
        if (ci <= dateStr && co > dateStr) booked++;
      });
    });
    return rt.rooms.length - booked;
  };

  const setPrice = (rtId, rpId, date, val) => {
    const num = Number(val);
    if (selectedChannel) {
      // Per-channel price override
      setLocalChannels(prev => prev.map(ch => {
        if (ch.id !== selectedChannel.id) return ch;
        const overrides = { ...(ch.channelRateOverrides || {}) };
        const chKey = `${ch.id}:${rtId}:${rpId}:${fmtDate(date)}`;
        overrides[chKey] = isNaN(num) ? 0 : num;
        return { ...ch, channelRateOverrides: overrides };
      }));
      setChannelDirty(true);
    } else {
      const key = `${rtId}:${rpId}:${fmtDate(date)}`;
      setLocalOverrides(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
      setRateDirty(true);
    }
  };

  const clearChannelPriceOverride = (rtId, rpId, date) => {
    if (!selectedChannel) return;
    setLocalChannels(prev => prev.map(ch => {
      if (ch.id !== selectedChannel.id) return ch;
      const overrides = { ...(ch.channelRateOverrides || {}) };
      delete overrides[`${ch.id}:${rtId}:${rpId}:${fmtDate(date)}`];
      return { ...ch, channelRateOverrides: overrides };
    }));
    setChannelDirty(true);
  };

  const toggleRestriction = (rtId, date, field) => {
    if (selectedChannel) {
      // Per-channel restriction override
      setLocalChannels(prev => prev.map(ch => {
        if (ch.id !== selectedChannel.id) return ch;
        const overrides = { ...(ch.restrictionOverrides || {}) };
        const chKey = `${ch.id}:${rtId}:${fmtDate(date)}`;
        const cur = overrides[chKey] || {};
        overrides[chKey] = { ...cur, [field]: !getRestriction(rtId, date)[field] };
        return { ...ch, restrictionOverrides: overrides };
      }));
      setChannelDirty(true);
    } else {
      const key = `${rtId}:${fmtDate(date)}`;
      setLocalRestrictions(prev => {
        const cur = prev[key] || { minStay: 0, maxStay: 0, stopSell: false, cta: false, ctd: false };
        return { ...prev, [key]: { ...cur, [field]: !cur[field] } };
      });
      setRateDirty(true);
    }
  };

  const setMinStay = (rtId, date, val) => {
    if (selectedChannel) {
      setLocalChannels(prev => prev.map(ch => {
        if (ch.id !== selectedChannel.id) return ch;
        const overrides = { ...(ch.restrictionOverrides || {}) };
        const chKey = `${ch.id}:${rtId}:${fmtDate(date)}`;
        const cur = overrides[chKey] || {};
        overrides[chKey] = { ...cur, minStay: Number(val) || 0 };
        return { ...ch, restrictionOverrides: overrides };
      }));
      setChannelDirty(true);
    } else {
      const key = `${rtId}:${fmtDate(date)}`;
      setLocalRestrictions(prev => {
        const cur = prev[key] || { minStay: 0, maxStay: 0, stopSell: false, cta: false, ctd: false };
        return { ...prev, [key]: { ...cur, minStay: Number(val) || 0 } };
      });
      setRateDirty(true);
    }
  };

  const saveRates = () => {
    Object.assign(channelRateOverrides, localOverrides);
    saveChannelRateOverrides();
    Object.keys(localRestrictions).forEach(k => channelRestrictions[k] = localRestrictions[k]);
    saveChannelRestrictions();
    // Log the update
    const logEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type: 'rate_update', channel: 'All channels', message: 'Rates & restrictions updated', details: `Manual update from Channel Manager` };
    channelActivityLog.unshift(logEntry);
    saveChannelActivityLog();
    setRateDirty(false);
    setToastMessage('Rates & restrictions saved');
  };

  const saveChannels = () => {
    channelOTAConnections.length = 0;
    localChannels.forEach(ch => channelOTAConnections.push(ch));
    saveChannelOTAConnections();
    setChannelDirty(false);
    setToastMessage('Channel settings saved');
  };

  const applyBulk = () => {
    if (!bulkFrom || !bulkTo) { setToastMessage('Select date range for bulk update'); return; }
    const from = new Date(bulkFrom + 'T00:00:00');
    const to = new Date(bulkTo + 'T00:00:00');
    if (from > to) { setToastMessage('From date must be before To date'); return; }
    let count = 0;
    const newOverrides = { ...localOverrides };
    const newRestrictions = { ...localRestrictions };
    const hasChannels = bulkChannels.length > 0;
    let newChannels = [...localChannels];

    const computePrice = (basePrice) => {
      const val = Number(bulkPrice);
      if (isNaN(val)) return null;
      if (bulkPriceMode === 'fixed') return val;
      if (bulkPriceMode === 'adjust_eur') return Math.round(basePrice + val);
      if (bulkPriceMode === 'adjust_pct') return Math.round(basePrice * (1 + val / 100));
      return null;
    };

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      // Day-of-week filter
      if (bulkDays.length > 0 && !bulkDays.includes(d.getDay())) continue;
      const ds = fmtDate(d);
      const targetTypes = bulkRoomType ? [bulkRoomType] : roomTypes.map(rt => rt.id);
      targetTypes.forEach(rtId => {
        const targetPlans = bulkRatePlan ? [bulkRatePlan] : ratePlans.map(rp => rp.id);

        // ── Base rate updates (when no channels selected, or always for price/restrictions) ──
        if (!hasChannels) {
          if (bulkPrice !== '') {
            targetPlans.forEach(rpId => {
              const base = getBasePrice(rtId, rpId, d);
              const newP = computePrice(base);
              if (newP !== null) { newOverrides[`${rtId}:${rpId}:${ds}`] = newP; count++; }
            });
          }
          const rKey = `${rtId}:${ds}`;
          const cur = newRestrictions[rKey] || { minStay: 0, maxStay: 0, stopSell: false, cta: false, ctd: false };
          if (bulkMinStay !== '') cur.minStay = Number(bulkMinStay);
          if (bulkStopSell) cur.stopSell = true;
          newRestrictions[rKey] = cur;
        }

        // ── Per-channel overrides ──
        if (hasChannels) {
          newChannels = newChannels.map(ch => {
            if (!bulkChannels.includes(ch.id)) return ch;
            const chOverrides = { ...(ch.channelRateOverrides || {}) };
            const chRestrictions = { ...(ch.restrictionOverrides || {}) };

            // Price
            if (bulkPrice !== '') {
              targetPlans.forEach(rpId => {
                const base = getBasePrice(rtId, rpId, d);
                const newP = computePrice(base);
                if (newP !== null) { chOverrides[`${ch.id}:${rtId}:${rpId}:${ds}`] = newP; count++; }
              });
            }

            // Availability close/open
            const chRKey = `${ch.id}:${rtId}:${ds}`;
            if (bulkAvailability === 'close') {
              chRestrictions[chRKey] = { ...(chRestrictions[chRKey] || {}), stopSell: true };
            } else if (bulkAvailability === 'open') {
              if (chRestrictions[chRKey]) { delete chRestrictions[chRKey].stopSell; if (!Object.keys(chRestrictions[chRKey]).length) delete chRestrictions[chRKey]; }
            }

            // Min stay / stop sell
            if (bulkMinStay !== '' || bulkStopSell) {
              const curR = chRestrictions[chRKey] || {};
              if (bulkMinStay !== '') curR.minStay = Number(bulkMinStay);
              if (bulkStopSell) curR.stopSell = true;
              chRestrictions[chRKey] = curR;
            }

            return { ...ch, channelRateOverrides: chOverrides, restrictionOverrides: chRestrictions };
          });
        }
      });
    }
    setLocalOverrides(newOverrides);
    setLocalRestrictions(newRestrictions);
    if (hasChannels) { setLocalChannels(newChannels); setChannelDirty(true); }
    setRateDirty(true);
    setBulkMode(false);
    setBulkFrom(''); setBulkTo(''); setBulkPrice(''); setBulkPriceMode('fixed'); setBulkMinStay(''); setBulkStopSell(false); setBulkRoomType(''); setBulkRatePlan(''); setBulkChannels([]); setBulkAvailability(''); setBulkDays([]);
    const parts = [];
    if (count) parts.push(`${count} prices`);
    if (hasChannels && bulkAvailability) parts.push(`availability ${bulkAvailability === 'close' ? 'closed' : 'opened'}`);
    if (hasChannels) parts.push(`${bulkChannels.length} channel${bulkChannels.length > 1 ? 's' : ''}`);
    setToastMessage(`Bulk update applied${parts.length ? ': ' + parts.join(', ') : ''}`);
  };

  const applyAutoAvailability = (channel, days = 90) => {
    if (!channel.autoAvailability?.enabled) { setToastMessage('Enable Auto Availability first'); return; }
    const rules = channel.autoAvailability.rules || [];
    if (!rules.length) { setToastMessage('No rules configured'); return; }
    const today = new Date(); today.setHours(0,0,0,0);
    let opened = 0, closed = 0;
    setLocalChannels(prev => prev.map(ch => {
      if (ch.id !== channel.id) return ch;
      const chRestrictions = { ...(ch.restrictionOverrides || {}) };
      for (let i = 0; i < days; i++) {
        const d = addD(today, i);
        const ds = fmtDate(d);
        rules.forEach(rule => {
          const occ = getOccupancyPercent(rule.roomTypeId, d);
          const chRKey = `${ch.id}:${rule.roomTypeId}:${ds}`;
          if (occ >= rule.maxOccupancy) {
            chRestrictions[chRKey] = { ...(chRestrictions[chRKey] || {}), stopSell: true };
            closed++;
          } else {
            if (chRestrictions[chRKey]?.stopSell) {
              delete chRestrictions[chRKey].stopSell;
              if (!Object.keys(chRestrictions[chRKey]).length) delete chRestrictions[chRKey];
              opened++;
            }
          }
        });
      }
      return { ...ch, restrictionOverrides: chRestrictions };
    }));
    setChannelDirty(true);
    const logEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type: 'restriction', channel: channel.name, message: `Auto Availability applied: ${closed} dates closed, ${opened} dates opened`, details: `${days}-day lookahead based on current occupancy` };
    channelActivityLog.unshift(logEntry);
    saveChannelActivityLog();
    setToastMessage(`Auto Availability: ${closed} closed, ${opened} opened for ${channel.name} (${days} days). Save to persist.`);
  };

  const triggerFullSync = (channelId) => {
    const SYNC_DAYS = 365;
    const ch = localChannels.find(c => c.id === channelId);
    if (!ch) return;
    const chName = ch.name;
    const chModifier = ch.rateModifier || 0;
    const chRateOverrides = ch.channelRateOverrides || {};
    const chRestrictionOverrides = { ...(ch.restrictionOverrides || {}) };
    const today = new Date(); today.setHours(0,0,0,0);

    setSyncProgress({ channelName: chName, current: 0, total: SYNC_DAYS, phase: 'Preparing...' });

    // Build ARI payload in batches via setTimeout to keep UI responsive
    const ariPayload = [];
    let rateCount = 0, restrictionCount = 0, stopSellCount = 0;
    let batchIndex = 0;
    const BATCH_SIZE = 30;

    const processBatch = () => {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, SYNC_DAYS);

      for (let i = start; i < end; i++) {
        const d = addD(today, i);
        const ds = fmtDate(d);

        roomTypes.forEach(rt => {
          const avail = getAvailability(rt.id, d);
          const baseRestriction = localRestrictions[`${rt.id}:${ds}`] || { minStay: 0, maxStay: 0, stopSell: false };
          const chRKey = `${ch.id}:${rt.id}:${ds}`;
          const chRestriction = chRestrictionOverrides[chRKey];
          const restriction = chRestriction ? { ...baseRestriction, ...chRestriction } : baseRestriction;

          // Apply auto-availability rules if enabled
          if (ch.autoAvailability?.enabled) {
            const occ = rt.rooms.length ? Math.round((1 - avail / rt.rooms.length) * 100) : 0;
            (ch.autoAvailability.rules || []).forEach(rule => {
              if (rule.roomTypeId !== rt.id) return;
              if (occ >= rule.maxOccupancy) {
                restriction.stopSell = true;
                chRestrictionOverrides[chRKey] = { ...(chRestrictionOverrides[chRKey] || {}), stopSell: true };
              }
            });
          }

          if (restriction.stopSell) stopSellCount++;
          if (restriction.minStay || restriction.maxStay || restriction.stopSell) restrictionCount++;

          ratePlans.forEach(rp => {
            // Compute channel price: base → plan modifier → channel override or channel modifier
            const baseKey = `${rt.id}:${rp.id}:${ds}`;
            const basePrice = localOverrides[baseKey] !== undefined
              ? localOverrides[baseKey]
              : Math.round(rt.defaultRate + rp.priceModifier);
            const chPriceKey = `${ch.id}:${rt.id}:${rp.id}:${ds}`;
            const channelPrice = chRateOverrides[chPriceKey] !== undefined
              ? chRateOverrides[chPriceKey]
              : Math.round(basePrice * (1 + chModifier / 100));

            ariPayload.push({
              date: ds,
              roomTypeId: rt.id,
              ratePlanId: rp.id,
              price: channelPrice,
              availability: avail,
              stopSell: restriction.stopSell || false,
              minStay: restriction.minStay || 0,
              maxStay: restriction.maxStay || 0
            });
            rateCount++;
          });
        });
      }

      batchIndex++;
      setSyncProgress({ channelName: chName, current: end, total: SYNC_DAYS, phase: `Computing ARI... (${end}/${SYNC_DAYS} days)` });

      if (end < SYNC_DAYS) {
        setTimeout(processBatch, 0);
      } else {
        // Done — store payload summary on channel and persist restriction updates
        const now = new Date().toISOString();
        setLocalChannels(prev => prev.map(c => {
          if (c.id !== ch.id) return c;
          return {
            ...c,
            lastSync: now,
            lastFullSyncStats: { date: now, days: SYNC_DAYS, rates: rateCount, restrictions: restrictionCount, stopSells: stopSellCount },
            restrictionOverrides: chRestrictionOverrides,
            // In production: ariPayload would be POSTed to Channex API here
            // channex: { lastAriPush: now, payload: ariPayload }
          };
        }));
        setChannelDirty(true);

        const logEntry = {
          id: 'log-' + Date.now(), timestamp: now, type: 'sync', channel: chName,
          message: `Full sync completed — ${SYNC_DAYS} days ARI`,
          details: `${rateCount} rates, ${restrictionCount} restrictions (${stopSellCount} stop sells), ${roomTypes.length} room types × ${ratePlans.length} rate plans. Auto-availability: ${ch.autoAvailability?.enabled ? 'applied' : 'off'}`
        };
        channelActivityLog.unshift(logEntry);
        saveChannelActivityLog();
        setSyncProgress(null);
        setToastMessage(`Full sync: ${rateCount} rates + ${restrictionCount} restrictions pushed for ${chName} (${SYNC_DAYS} days)`);
      }
    };

    setTimeout(processBatch, 0);
  };

  const toggleChannelStatus = (chId) => {
    let wasConnected = false;
    setLocalChannels(prev => prev.map(ch => {
      if (ch.id !== chId) return ch;
      wasConnected = ch.status === 'connected';
      const newStatus = wasConnected ? 'disconnected' : 'connected';
      const logEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type: newStatus === 'connected' ? 'sync' : 'error', channel: ch.name, message: newStatus === 'connected' ? 'Channel connected' : 'Channel disconnected', details: '' };
      channelActivityLog.unshift(logEntry);
      saveChannelActivityLog();
      return { ...ch, status: newStatus, lastSync: newStatus === 'connected' ? new Date().toISOString() : ch.lastSync };
    }));
    setChannelDirty(true);
    // Auto-trigger full sync when connecting a new channel
    if (!wasConnected) setTimeout(() => triggerFullSync(chId), 100);
  };

  // ── Connection status ──────────────────────────────────────────────────
  const isConnected = hotelSettings.channex?.apiKey && hotelSettings.channex?.propertyId;
  const connectedChannels = localChannels.filter(ch => ch.status === 'connected').length;

  // ── Style helpers ──────────────────────────────────────────────────────
  const inputClass = 'w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-neutral-500 mb-1';
  const tabClass = (active) => `px-4 py-2 text-sm font-medium rounded-xl transition-all ${active ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`;

  const channelIcon = (code) => {
    const colors = { BDC: '#003580', EXP: '#00355F', ABB: '#FF5A5F', GGL: '#4285F4', AGD: '#5C2D91', HRS: '#C5003E' };
    return React.createElement('div', {
      className: 'w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
      style: { background: colors[code] || '#6b7280' }
    }, code);
  };

  const statusBadge = (status) => {
    const styles = {
      connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      disconnected: 'bg-neutral-50 text-neutral-500 border-neutral-200',
      error: 'bg-red-50 text-red-600 border-red-200',
    };
    return React.createElement('span', { className: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.disconnected}` },
      React.createElement('span', { className: `w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-neutral-400'}` }),
      status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Disconnected'
    );
  };

  const logIcon = (type) => {
    if (type === 'sync') return React.createElement('div', { className: 'w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center' },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: '#3b82f6', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('polyline', { points: '23 4 23 10 17 10' }),
        React.createElement('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
      ));
    if (type === 'booking') return React.createElement('div', { className: 'w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center' },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: '#10b981', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        React.createElement('polyline', { points: '14 2 14 8 20 8' })
      ));
    if (type === 'rate_update') return React.createElement('div', { className: 'w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center' },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: '#f59e0b', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('line', { x1: 12, y1: 1, x2: 12, y2: 23 }),
        React.createElement('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })
      ));
    if (type === 'restriction') return React.createElement('div', { className: 'w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center' },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: '#f97316', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
        React.createElement('line', { x1: 4.93, y1: 4.93, x2: 19.07, y2: 19.07 })
      ));
    if (type === 'error') return React.createElement('div', { className: 'w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center' },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: '#ef4444', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
        React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }),
        React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 })
      ));
    return React.createElement('div', { className: 'w-7 h-7 rounded-lg bg-neutral-50 flex items-center justify-center' },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('circle', { cx: 12, cy: 12, r: 10 })
      ));
  };

  // ── Sidebar (same pattern as other views) ──────────────────────────────
  const sidebar = (
    <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <nav className="cal-nav">
        {canAccessPage(currentUser?.role, 'dashboard') && <a className={`cal-nav-link${activePage === 'dashboard' ? ' active' : ''}`} onClick={() => { setActivePage('dashboard'); setSelectedReservation(null); }}><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>}
        <a className="cal-nav-link active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>
        {canAccessPage(currentUser?.role, 'profiles') && <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>}
        {canAccessPage(currentUser?.role, 'payments') && <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>}
        {canAccessPage(currentUser?.role, 'reports') && <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>}
        {canAccessPage(currentUser?.role, 'settings') && <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>}
      </nav>
      <div className="cal-nav-user">
        <div className="relative">
          <button onClick={() => props.setUserMenuOpen(prev => !prev)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 hover:bg-neutral-100 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ backgroundColor: currentUser?.color || '#6b7280' }}>
              {currentUser?.name?.split(' ').map(n => n[0]).join('') || '?'}
            </div>
            {!sidebarCollapsed && <span className="text-xs text-neutral-600 truncate">{currentUser?.name?.split(' ')[0]}</span>}
          </button>
          {props.userMenuOpen && (<>
            <div className="fixed inset-0 z-[49]" onClick={() => props.setUserMenuOpen(false)} />
            <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-[50]">
              <div className="px-3 py-2 border-b border-neutral-100">
                <div className="text-sm font-medium text-neutral-900">{currentUser?.name}</div>
                <div className="text-[11px] text-neutral-400 capitalize">{currentUser?.role}</div>
              </div>
              <button onClick={props.handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </>)}
        </div>
      </div>
      <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy;<br/>All Rights Reserved</>)}</div>
    </aside>
  );

  // ── Tab: Overview ──────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-4">
      {/* Connection + stats bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Connection status chip */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${isConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isConnected ? 'Channex Connected' : 'Not Configured'}
            {!isConnected && <button onClick={() => setActivePage('settings')} className="ml-1 underline hover:no-underline">Setup</button>}
          </div>
          {isConnected && <span className="text-[11px] text-neutral-400">Property: {hotelSettings.channex.propertyId}</span>}
          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-neutral-200" />
          {/* Inline stats */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {[
              { label: 'Room Types', value: roomTypes.length },
              { label: 'Rate Plans', value: ratePlans.length },
              { label: 'Channels', value: connectedChannels },
              { label: 'Total Rooms', value: roomTypes.reduce((sum, rt) => sum + rt.rooms.length, 0) },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-neutral-900">{s.value}</span>
                <span className="text-neutral-400">{s.label}</span>
              </div>
            ))}
          </div>
          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-neutral-200" />
          {/* Property info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span className="font-medium text-neutral-700">{hotelSettings.hotelName}</span>
            <span>{getHotelAddress()}</span>
            <span>{hotelSettings.currency}</span>
            {hotelSettings.autoClose?.enabled && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Stop sell {getStopSellTime()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Room type + rate plan overview (compact) */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-neutral-900 mb-3">Room Types & Rate Plans</h3>
        <div className="space-y-2">
          {roomTypes.map(rt => (
            <div key={rt.id} className="border border-neutral-100 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-mono font-medium text-neutral-600">{rt.shortCode}</span>
                  <span className="text-xs font-semibold text-neutral-900">{rt.name}</span>
                  <span className="text-[10px] text-neutral-400">{rt.rooms.length} rooms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-700">{hotelSettings.currency} {rt.defaultRate}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${rt.channexId ? 'bg-emerald-400' : 'bg-neutral-300'}`} title={rt.channexId ? 'Mapped' : 'Not mapped'} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ratePlans.map(rp => {
                  const price = Math.round(rt.defaultRate + rp.priceModifier);
                  return (
                    <span key={rp.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-50 rounded text-[10px]">
                      <span className="font-medium text-neutral-600">{rp.shortCode}</span>
                      <span className="text-neutral-900 font-semibold">{price}</span>
                      <span className={`w-1 h-1 rounded-full ${rp.channexId ? 'bg-emerald-400' : 'bg-neutral-300'}`} />
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Tab: Inventory & Rates ─────────────────────────────────────────────
  const renderRates = () => (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setRateDate(addD(rateDate, -14))} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
            <Icons.ChevronLeft className="w-4 h-4 text-neutral-600" />
          </button>
          <div className="px-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium text-neutral-900">
            {rateDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {addD(rateDate, rateDays - 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <button onClick={() => setRateDate(addD(rateDate, 14))} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
            <Icons.ChevronRight className="w-4 h-4 text-neutral-600" />
          </button>
          <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setRateDate(d); }} className="px-3 py-2 text-xs font-medium bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors">Today</button>
        </div>
        <div className="flex items-center gap-2">
          {/* Channel selector dropdown */}
          <select value={rateChannel} onChange={e => setRateChannel(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-neutral-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer">
            <option value="">Base rates</option>
            {localChannels.filter(ch => ch.status === 'connected').map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}{ch.rateModifier ? ` (${ch.rateModifier > 0 ? '+' : ''}${ch.rateModifier}%)` : ''}</option>
            ))}
          </select>
          <button onClick={() => setBulkMode(!bulkMode)} className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors ${bulkMode ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
            Bulk Update
          </button>
          {(rateDirty || channelDirty) && (
            <button onClick={() => { if (rateDirty) saveRates(); if (channelDirty) saveChannels(); }} className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Bulk update panel */}
      {bulkMode && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {/* Column 1: When */}
            <div className="p-4 border-r border-neutral-100">
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">When</div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <input type="date" value={bulkFrom} onChange={e => setBulkFrom(e.target.value)} className={inputClass + ' !w-full'} />
                </div>
                <span className="text-neutral-300 text-xs">–</span>
                <div className="flex-1">
                  <input type="date" value={bulkTo} onChange={e => setBulkTo(e.target.value)} className={inputClass + ' !w-full'} />
                </div>
              </div>
              <div className="flex gap-0.5">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((name, i) => (
                  <button key={i} onClick={() => setBulkDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    className={`flex-1 h-7 text-[10px] font-medium rounded-md transition-colors ${
                      bulkDays.includes(i) ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
                    }`}>{name}</button>
                ))}
              </div>
            </div>
            {/* Column 2: What */}
            <div className="p-4 border-r border-neutral-100">
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">What</div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <select value={bulkRoomType} onChange={e => setBulkRoomType(e.target.value)} className={inputClass + ' !w-full'}>
                    <option value="">All room types</option>
                    {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <select value={bulkRatePlan} onChange={e => setBulkRatePlan(e.target.value)} className={inputClass + ' !w-full'}>
                    <option value="">All rate plans</option>
                    {ratePlans.map(rp => <option key={rp.id} value={rp.id}>{rp.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {localChannels.filter(ch => ch.status === 'connected').map(ch => (
                  <button key={ch.id} onClick={() => setBulkChannels(prev => prev.includes(ch.id) ? prev.filter(x => x !== ch.id) : [...prev, ch.id])}
                    className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                      bulkChannels.includes(ch.id) ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
                    }`}>{ch.name}</button>
                ))}
                {bulkChannels.length === 0 && <span className="text-[10px] text-neutral-300 py-1">Base rates only</span>}
              </div>
            </div>
            {/* Column 3: Action */}
            <div className="p-4">
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Action</div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <select value={bulkPriceMode} onChange={e => setBulkPriceMode(e.target.value)} className={inputClass + ' !w-full'}>
                    <option value="fixed">Fixed price</option>
                    <option value="adjust_eur">+/- {hotelSettings.currency}</option>
                    <option value="adjust_pct">+/- %</option>
                  </select>
                </div>
                <div style={{width: '80px'}}>
                  <input type="number" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} placeholder="—" className={inputClass + ' !w-full'} />
                </div>
                <div style={{width: '60px'}}>
                  <input type="number" min="0" value={bulkMinStay} onChange={e => setBulkMinStay(e.target.value)} placeholder="Min" title="Min stay" className={inputClass + ' !w-full'} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={bulkStopSell} onChange={e => setBulkStopSell(e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                    <span className="text-[11px] text-neutral-500">Stop sell</span>
                  </label>
                  {bulkChannels.length > 0 && (
                    <select value={bulkAvailability} onChange={e => setBulkAvailability(e.target.value)} className={inputClass + ' !w-auto !py-1 !text-[11px]'}>
                      <option value="">Availability: no change</option>
                      <option value="close">Close channels</option>
                      <option value="open">Open channels</option>
                    </select>
                  )}
                </div>
                <button onClick={applyBulk} className="px-5 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors">Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate calendar grid */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${rateDays}, minmax(70px, 1fr))`, minWidth: `${180 + rateDays * 70}px` }}>
            {/* Date header */}
            <div className="sticky left-0 z-10 bg-neutral-50 border-b border-r border-neutral-200 p-3">
              <span className="text-xs font-medium text-neutral-500">Room Type / Rate Plan</span>
            </div>
            {days.map((d, i) => {
              const isToday = fmtDate(d) === fmtDate(new Date());
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i} className={`border-b border-r border-neutral-200 p-2 text-center ${isToday ? 'bg-neutral-900 text-white' : isWeekend ? 'bg-neutral-50' : 'bg-white'}`}>
                  <div className={`text-[10px] font-medium ${isToday ? 'text-neutral-300' : 'text-neutral-400'}`}>{dayNames[d.getDay()]}</div>
                  <div className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-neutral-900'}`}>{d.getDate()}</div>
                  <div className={`text-[10px] ${isToday ? 'text-neutral-400' : 'text-neutral-400'}`}>{monthNames[d.getMonth()]}</div>
                </div>
              );
            })}

            {/* Room type sections */}
            {roomTypes.map(rt => {
              const isExpanded = expandedTypes[rt.id];
              return (
                <React.Fragment key={rt.id}>
                  {/* Room type header row */}
                  <div className="sticky left-0 z-10 bg-neutral-100 border-b border-r border-neutral-200 p-3 flex items-center gap-2 cursor-pointer" onClick={() => setExpandedTypes(prev => ({ ...prev, [rt.id]: !prev[rt.id] }))}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">{rt.name}</div>
                      <div className="text-[10px] text-neutral-500">{rt.rooms.length} rooms</div>
                    </div>
                  </div>
                  {/* Availability row */}
                  {days.map((d, di) => {
                    const avail = getAvailability(rt.id, d);
                    const rest = getRestriction(rt.id, d);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={di} className={`border-b border-r border-neutral-200 p-1.5 text-center ${rest.stopSell ? 'bg-red-50' : isWeekend ? 'bg-neutral-50' : 'bg-neutral-100/50'}`}>
                        <div className={`text-sm font-bold ${avail === 0 ? 'text-red-500' : avail <= 2 ? 'text-amber-500' : 'text-emerald-600'}`}>{avail}</div>
                        <div className="text-[9px] text-neutral-400">avail</div>
                      </div>
                    );
                  })}

                  {/* Rate plan rows (if expanded) */}
                  {isExpanded && ratePlans.map(rp => (
                    <React.Fragment key={rp.id}>
                      <div className="sticky left-0 z-10 bg-white border-b border-r border-neutral-200 p-3 pl-8">
                        <div className="text-xs text-neutral-600">{rp.name}</div>
                        <div className="text-[10px] text-neutral-400">{rp.shortCode}{selectedChannel ? ` · ${selectedChannel.name}` : ''}</div>
                      </div>
                      {days.map((d, di) => {
                        const price = getPrice(rt.id, rp.id, d);
                        const baseKey = `${rt.id}:${rp.id}:${fmtDate(d)}`;
                        const isBaseOverride = localOverrides[baseKey] !== undefined;
                        const hasChannelOverride = selectedChannel && (selectedChannel.channelRateOverrides || {})[`${selectedChannel.id}:${baseKey}`] !== undefined;
                        const isDerived = selectedChannel && !hasChannelOverride && channelModifier !== 0;
                        const rest = getRestriction(rt.id, d);
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={di} className={`relative border-b border-r border-neutral-200 p-0.5 ${rest.stopSell ? 'bg-red-50' : isWeekend ? 'bg-neutral-50/50' : ''}`}>
                            <input
                              type="number"
                              value={price}
                              onChange={e => setPrice(rt.id, rp.id, d, e.target.value)}
                              className={`w-full text-center text-xs py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                                hasChannelOverride ? 'bg-purple-50 text-purple-700 font-semibold' :
                                isDerived ? 'bg-emerald-50 text-emerald-700 font-medium' :
                                isBaseOverride ? 'bg-blue-50 text-blue-700 font-semibold' :
                                'bg-transparent text-neutral-700'
                              }`}
                            />
                            {hasChannelOverride && (
                              <button onClick={() => clearChannelPriceOverride(rt.id, rp.id, d)} title="Reset to derived price"
                                className="absolute top-0 right-0 p-0.5 text-purple-400 hover:text-purple-600 text-[9px] leading-none">×</button>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {/* Restrictions row (if expanded) */}
                  {isExpanded && (
                    <React.Fragment>
                      <div className="sticky left-0 z-10 bg-orange-50/50 border-b border-r border-neutral-200 p-3 pl-8">
                        <div className="text-xs text-orange-600 font-medium">Restrictions</div>
                      </div>
                      {days.map((d, di) => {
                        const rest = getRestriction(rt.id, d);
                        return (
                          <div key={di} className="border-b border-r border-neutral-200 p-1 bg-orange-50/30">
                            <div className="flex flex-col items-center gap-0.5">
                              <button onClick={() => toggleRestriction(rt.id, d, 'stopSell')} title="Stop sell"
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${rest.stopSell ? 'bg-red-100 text-red-600' : 'text-neutral-300 hover:text-neutral-500'}`}>
                                SS
                              </button>
                              <button onClick={() => toggleRestriction(rt.id, d, 'cta')} title="Closed to arrival"
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${rest.cta ? 'bg-orange-100 text-orange-600' : 'text-neutral-300 hover:text-neutral-500'}`}>
                                CTA
                              </button>
                              <button onClick={() => toggleRestriction(rt.id, d, 'ctd')} title="Closed to departure"
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${rest.ctd ? 'bg-orange-100 text-orange-600' : 'text-neutral-300 hover:text-neutral-500'}`}>
                                CTD
                              </button>
                              <input type="number" min="0" max="30" value={rest.minStay || ''} placeholder="MS" title="Min stay"
                                onChange={e => setMinStay(rt.id, d, e.target.value)}
                                className="w-8 text-center text-[9px] py-0.5 rounded border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200" /> Base override</span>
        {selectedChannel && <>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Derived ({channelModifier > 0 ? '+' : ''}{channelModifier}%)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-50 border border-purple-200" /> Channel override</span>
        </>}
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Stop sell</span>
        <span className="flex items-center gap-1.5"><span className="font-medium text-orange-600 text-[10px]">CTA</span> Closed to arrival</span>
        <span className="flex items-center gap-1.5"><span className="font-medium text-orange-600 text-[10px]">CTD</span> Closed to departure</span>
        <span className="flex items-center gap-1.5"><span className="font-medium text-neutral-400 text-[10px]">MS</span> Min stay nights</span>
      </div>
    </div>
  );

  // ── Tab: Channels ──────────────────────────────────────────────────────
  const renderChannels = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">OTA Channels</h3>
        {channelDirty && (
          <button onClick={saveChannels} className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
            Save Changes
          </button>
        )}
      </div>

      <div className="space-y-3">
        {localChannels.map(ch => (
          <div key={ch.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {/* Channel header */}
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50 transition-colors" onClick={() => setExpandedChannel(expandedChannel === ch.id ? null : ch.id)}>
              <div className="flex items-center gap-4">
                {channelIcon(ch.code)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">{ch.name}</span>
                    {ch.rateModifier !== 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ch.rateModifier > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {ch.rateModifier > 0 ? '+' : ''}{ch.rateModifier}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {ch.lastSync ? `Last sync: ${new Date(ch.lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Never synced'}
                    {ch.lastFullSyncStats && <span className="ml-2 text-neutral-300">({ch.lastFullSyncStats.rates} rates, {ch.lastFullSyncStats.days}d)</span>}
                  </div>
                  {syncProgress?.channelName === ch.name && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-neutral-900 rounded-full transition-all duration-300" style={{ width: `${Math.round(syncProgress.current / syncProgress.total * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-neutral-400 tabular-nums">{Math.round(syncProgress.current / syncProgress.total * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(ch.status)}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ transform: expandedChannel === ch.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedChannel === ch.id && (
              <div className="border-t border-neutral-100 p-5 bg-neutral-50/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Commission (%)</label>
                    <input type="number" min="0" max="100" step="0.5" value={ch.commission}
                      onChange={e => { setLocalChannels(prev => prev.map(c => c.id === ch.id ? { ...c, commission: Number(e.target.value) || 0 } : c)); setChannelDirty(true); }}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Rate Modifier (%)</label>
                    <input type="number" min="-100" max="100" step="0.5" value={ch.rateModifier || 0}
                      onChange={e => { setLocalChannels(prev => prev.map(c => c.id === ch.id ? { ...c, rateModifier: Number(e.target.value) || 0 } : c)); setChannelDirty(true); }}
                      className={inputClass} />
                    <p className="text-[10px] text-neutral-400 mt-1">{ch.rateModifier > 0 ? `+${ch.rateModifier}% on base rates` : ch.rateModifier < 0 ? `${ch.rateModifier}% discount on base rates` : 'Same as base rates'}</p>
                  </div>
                  <div>
                    <label className={labelClass}>Channex Channel ID</label>
                    <input value={ch.channexChannelId || ''} placeholder="Not mapped"
                      onChange={e => { setLocalChannels(prev => prev.map(c => c.id === ch.id ? { ...c, channexChannelId: e.target.value || null } : c)); setChannelDirty(true); }}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <div className="flex items-center gap-2 mt-1">
                      {statusBadge(ch.status)}
                    </div>
                  </div>
                </div>

                {/* Room type mapping */}
                <div>
                  <h4 className="text-xs font-medium text-neutral-700 mb-2">Room Type Mapping</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {roomTypes.map(rt => (
                      <div key={rt.id} className="flex items-center gap-2 text-xs bg-white border border-neutral-100 rounded-lg p-2.5">
                        <span className="text-neutral-600 flex-shrink-0 w-32 truncate">{rt.name}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="text-neutral-300 flex-shrink-0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        <input value={ch.roomTypeMappings?.[rt.id] || ''} placeholder="OTA room type"
                          onChange={e => {
                            setLocalChannels(prev => prev.map(c => {
                              if (c.id !== ch.id) return c;
                              const mappings = { ...c.roomTypeMappings, [rt.id]: e.target.value };
                              return { ...c, roomTypeMappings: mappings };
                            }));
                            setChannelDirty(true);
                          }}
                          className="flex-1 px-2 py-1 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rate plan mapping */}
                <div>
                  <h4 className="text-xs font-medium text-neutral-700 mb-2">Rate Plan Mapping</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ratePlans.map(rp => (
                      <div key={rp.id} className="flex items-center gap-2 text-xs bg-white border border-neutral-100 rounded-lg p-2.5">
                        <span className="text-neutral-600 flex-shrink-0 w-32 truncate">{rp.name}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="text-neutral-300 flex-shrink-0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        <input value={ch.ratePlanMappings?.[rp.id] || ''} placeholder="OTA rate plan"
                          onChange={e => {
                            setLocalChannels(prev => prev.map(c => {
                              if (c.id !== ch.id) return c;
                              const mappings = { ...c.ratePlanMappings, [rp.id]: e.target.value };
                              return { ...c, ratePlanMappings: mappings };
                            }));
                            setChannelDirty(true);
                          }}
                          className="flex-1 px-2 py-1 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto Availability */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-neutral-700">Auto Availability</h4>
                    <button onClick={() => {
                      setLocalChannels(prev => prev.map(c => {
                        if (c.id !== ch.id) return c;
                        const aa = { ...(c.autoAvailability || { enabled: false, rules: [] }) };
                        aa.enabled = !aa.enabled;
                        if (aa.enabled && (!aa.rules || !aa.rules.length)) {
                          aa.rules = roomTypes.map(rt => ({ roomTypeId: rt.id, maxOccupancy: 60 }));
                        }
                        return { ...c, autoAvailability: aa };
                      }));
                      setChannelDirty(true);
                    }} className={`relative w-9 h-5 rounded-full transition-colors ${ch.autoAvailability?.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ch.autoAvailability?.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 mb-3">Automatically open/close availability based on occupancy. Channel is only open when occupancy is <b>below</b> the threshold.</p>
                  {ch.autoAvailability?.enabled && (
                    <div className="space-y-2">
                      {roomTypes.map(rt => {
                        const rule = (ch.autoAvailability?.rules || []).find(r => r.roomTypeId === rt.id);
                        const threshold = rule?.maxOccupancy ?? 60;
                        const today = new Date(); today.setHours(0,0,0,0);
                        const currentOcc = getOccupancyPercent(rt.id, today);
                        const isOpen = currentOcc < threshold;
                        return (
                          <div key={rt.id} className="flex items-center gap-3 bg-white border border-neutral-100 rounded-lg p-2.5">
                            <span className="text-xs text-neutral-600 w-28 truncate flex-shrink-0">{rt.name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} title={isOpen ? `Open (${currentOcc}% < ${threshold}%)` : `Closed (${currentOcc}% >= ${threshold}%)`} />
                            <div className="flex items-center gap-1.5 flex-1">
                              <span className="text-[10px] text-neutral-400 flex-shrink-0">Close when occ ≥</span>
                              <input type="number" min="0" max="100" step="5" value={threshold}
                                onChange={e => {
                                  setLocalChannels(prev => prev.map(c => {
                                    if (c.id !== ch.id) return c;
                                    const aa = { ...(c.autoAvailability || { enabled: true, rules: [] }) };
                                    const rules = [...(aa.rules || [])];
                                    const idx = rules.findIndex(r => r.roomTypeId === rt.id);
                                    if (idx >= 0) rules[idx] = { ...rules[idx], maxOccupancy: Number(e.target.value) || 0 };
                                    else rules.push({ roomTypeId: rt.id, maxOccupancy: Number(e.target.value) || 0 });
                                    return { ...c, autoAvailability: { ...aa, rules } };
                                  }));
                                  setChannelDirty(true);
                                }}
                                className="w-14 px-1.5 py-1 border border-neutral-200 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                              <span className="text-[10px] text-neutral-400">%</span>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              {currentOcc}% occ → {isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 mt-2">
                        <select value={ch.autoAvailability?.applyDays || 90}
                          onChange={e => {
                            setLocalChannels(prev => prev.map(c => {
                              if (c.id !== ch.id) return c;
                              return { ...c, autoAvailability: { ...(c.autoAvailability || {}), applyDays: Number(e.target.value) } };
                            }));
                            setChannelDirty(true);
                          }}
                          className="px-2 py-2 text-xs bg-neutral-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer">
                          <option value={30}>30 days</option>
                          <option value={60}>60 days</option>
                          <option value={90}>90 days</option>
                          <option value={180}>180 days</option>
                          <option value={365}>365 days</option>
                          <option value={730}>Indefinite (2yr)</option>
                        </select>
                        <button onClick={() => applyAutoAvailability(ch, ch.autoAvailability?.applyDays || 90)}
                          className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors">
                          Apply Rules
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto Close (Nachtelijke Afsluiting) */}
                <div className="pt-3 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-neutral-700">Auto Close</h4>
                    <button onClick={() => {
                      hotelSettings.autoClose = { ...(hotelSettings.autoClose || {}), enabled: !hotelSettings.autoClose?.enabled };
                      if (!hotelSettings.autoClose.receptionCloseTime) hotelSettings.autoClose.receptionCloseTime = '22:00';
                      if (!hotelSettings.autoClose.stopSellOffset) hotelSettings.autoClose.stopSellOffset = 30;
                      saveHotelSettings();
                      setToastMessage(hotelSettings.autoClose.enabled ? 'Auto Close enabled' : 'Auto Close disabled');
                    }} className={`relative w-9 h-5 rounded-full transition-colors ${hotelSettings.autoClose?.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hotelSettings.autoClose?.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 mb-3">Automatically stop sell all room types before reception closes. In production this runs server-side; for now use "Apply Now".</p>
                  {hotelSettings.autoClose?.enabled && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] text-neutral-400 mb-1">Reception closes at</label>
                          <input type="time" value={hotelSettings.autoClose?.receptionCloseTime || '22:00'}
                            onChange={e => { hotelSettings.autoClose.receptionCloseTime = e.target.value; saveHotelSettings(); }}
                            className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-neutral-400 mb-1">Stop sell offset</label>
                          <select value={hotelSettings.autoClose?.stopSellOffset || 30}
                            onChange={e => { hotelSettings.autoClose.stopSellOffset = Number(e.target.value); saveHotelSettings(); }}
                            className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300">
                            <option value={15}>15 min before</option>
                            <option value={30}>30 min before</option>
                            <option value={45}>45 min before</option>
                            <option value={60}>60 min before</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span className="text-xs font-medium text-amber-800">Stop sell at {getStopSellTime()}</span>
                        </div>
                        <button onClick={() => {
                          const today = new Date(); today.setHours(0,0,0,0);
                          const ds = fmtDate(today);
                          setLocalChannels(prev => prev.map(c => {
                            if (c.status !== 'connected') return c;
                            if (hotelSettings.autoClose?.applyToChannels !== 'all' && c.id !== ch.id) return c;
                            const overrides = { ...(c.restrictionOverrides || {}) };
                            roomTypes.forEach(rt => {
                              const key = `${c.id}:${rt.id}:${ds}`;
                              overrides[key] = { ...(overrides[key] || {}), stopSell: true };
                            });
                            return { ...c, restrictionOverrides: overrides };
                          }));
                          setChannelDirty(true);
                          const logEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type: 'restriction', channel: ch.name, message: `Auto Close applied for today`, details: `Stop sell set for ${ds} on all room types` };
                          channelActivityLog.unshift(logEntry);
                          saveChannelActivityLog();
                          setToastMessage(`Auto Close: stop sell applied for today. Save to persist.`);
                        }}
                          className="px-3 py-1.5 text-[11px] font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                          Apply Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
                  <button onClick={() => toggleChannelStatus(ch.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors ${ch.status === 'connected' ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                    {ch.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </button>
                  {ch.status === 'connected' && (
                    <button onClick={() => triggerFullSync(ch.id)} disabled={!!syncProgress}
                      className={`px-3 py-2 text-xs font-medium border border-neutral-200 text-neutral-600 rounded-xl transition-colors ${syncProgress ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-50'}`}>
                      {syncProgress?.channelName === ch.name ? syncProgress.phase : 'Full Sync'}
                    </button>
                  )}
                  {ch.status === 'connected' && (
                    <button onClick={() => {
                      const logEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type: 'booking', channel: ch.name, message: 'Pull bookings triggered', details: 'Checking for new reservations...' };
                      channelActivityLog.unshift(logEntry);
                      saveChannelActivityLog();
                      setToastMessage(`Pulling bookings from ${ch.name}...`);
                    }} className="px-3 py-2 text-xs font-medium border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors">
                      Pull Bookings
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Tab: Activity Log ──────────────────────────────────────────────────
  const renderLog = () => {
    const logs = channelActivityLog
      .filter(l => !logFilter || l.type === logFilter)
      .filter(l => !logChannelFilter || l.channel === logChannelFilter);

    const uniqueChannels = [...new Set(channelActivityLog.map(l => l.channel))].sort();

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={logFilter} onChange={e => setLogFilter(e.target.value)} className={inputClass + ' !w-44'}>
            <option value="">All types</option>
            <option value="sync">Sync</option>
            <option value="booking">Booking</option>
            <option value="rate_update">Rate Update</option>
            <option value="restriction">Restriction</option>
            <option value="error">Error</option>
          </select>
          <select value={logChannelFilter} onChange={e => setLogChannelFilter(e.target.value)} className={inputClass + ' !w-44'}>
            <option value="">All channels</option>
            {uniqueChannels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>
          <span className="text-xs text-neutral-400">{logs.length} entries</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden">
          {logs.length === 0 && (
            <div className="p-8 text-center text-sm text-neutral-400">No activity entries found</div>
          )}
          {logs.map(log => (
            <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-neutral-50 transition-colors">
              {logIcon(log.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{log.message}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{log.channel}</span>
                </div>
                {log.details && <p className="text-xs text-neutral-500 mt-0.5">{log.details}</p>}
              </div>
              <div className="text-xs text-neutral-400 flex-shrink-0 text-right">
                {(() => {
                  const d = new Date(log.timestamp);
                  const now = new Date();
                  const diff = now - d;
                  if (diff < 60000) return 'Just now';
                  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Smart Pricing helpers ─────────────────────────────────────────────
  const getOccupancyPercent = (rtId, date) => {
    const rt = roomTypes.find(t => t.id === rtId);
    if (!rt || !rt.rooms.length) return 0;
    return Math.round((1 - getAvailability(rtId, date) / rt.rooms.length) * 100);
  };

  const getSmartAdjustment = (rtId, date) => {
    if (!spConfig.enabled) return 0;
    const rule = spConfig.rules.find(r => r.roomTypeId === rtId);
    if (!rule || !rule.enabled) return 0;
    const occ = getOccupancyPercent(rtId, date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    let adj = 0;
    for (const tier of rule.tiers) {
      if (occ >= tier.minOcc && occ < tier.maxOcc) { adj = tier.adjustment; break; }
    }
    if (occ >= 100) adj = rule.tiers.length ? rule.tiers[rule.tiers.length - 1].adjustment : 0;
    if (isWeekend) adj += (spConfig.weekendSurcharge || 0);
    return Math.max(-spConfig.maxDecrease, Math.min(spConfig.maxIncrease, adj));
  };

  const getSmartPrice = (rtId, rpId, date) => {
    const base = getBasePrice(rtId, rpId, date);
    const adj = getSmartAdjustment(rtId, date);
    return Math.round(base * (1 + adj / 100));
  };

  const updateSpRule = (rtId, field, value) => {
    setSpConfig(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.roomTypeId === rtId ? { ...r, [field]: value } : r)
    }));
    setSpDirty(true);
  };

  const updateSpTier = (rtId, tierIdx, field, value) => {
    setSpConfig(prev => ({
      ...prev,
      rules: prev.rules.map(r => {
        if (r.roomTypeId !== rtId) return r;
        const tiers = r.tiers.map((t, i) => i === tierIdx ? { ...t, [field]: Number(value) || 0 } : t);
        return { ...r, tiers };
      })
    }));
    setSpDirty(true);
  };

  const addSpTier = (rtId) => {
    setSpConfig(prev => ({
      ...prev,
      rules: prev.rules.map(r => {
        if (r.roomTypeId !== rtId) return r;
        const last = r.tiers[r.tiers.length - 1];
        const newMin = last ? last.maxOcc : 0;
        return { ...r, tiers: [...r.tiers, { minOcc: newMin, maxOcc: Math.min(newMin + 20, 100), adjustment: 0 }] };
      })
    }));
    setSpDirty(true);
  };

  const removeSpTier = (rtId, tierIdx) => {
    setSpConfig(prev => ({
      ...prev,
      rules: prev.rules.map(r => {
        if (r.roomTypeId !== rtId) return r;
        return { ...r, tiers: r.tiers.filter((_, i) => i !== tierIdx) };
      })
    }));
    setSpDirty(true);
  };

  const saveSmartPricing = () => {
    Object.assign(smartPricingConfig, spConfig);
    saveSmartPricingConfig();
    setSpDirty(false);
    setToastMessage('Smart Pricing settings saved');
  };

  const applySmartPricesToRates = () => {
    if (!spConfig.enabled) { setToastMessage('Enable Smart Pricing first'); return; }
    const newOverrides = { ...localOverrides };
    let count = 0;
    const previewDays = Array.from({length: 30}, (_, i) => addD(rateDate, i));
    previewDays.forEach(d => {
      roomTypes.forEach(rt => {
        const rule = spConfig.rules.find(r => r.roomTypeId === rt.id);
        if (!rule || !rule.enabled) return;
        const adj = getSmartAdjustment(rt.id, d);
        if (adj === 0) return;
        ratePlans.forEach(rp => {
          const base = getBasePrice(rt.id, rp.id, d);
          const newPrice = Math.round(base * (1 + adj / 100));
          newOverrides[`${rt.id}:${rp.id}:${fmtDate(d)}`] = newPrice;
          count++;
        });
      });
    });
    setLocalOverrides(newOverrides);
    setRateDirty(true);
    const logEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type: 'rate_update', channel: 'Smart Pricing', message: `Smart Pricing applied to ${count} rate cells`, details: '30-day lookahead based on current occupancy' };
    channelActivityLog.unshift(logEntry);
    saveChannelActivityLog();
    setToastMessage(`Smart Pricing applied to ${count} rate cells (30 days). Save rates to persist.`);
  };

  // ── Tab: Smart Pricing ──────────────────────────────────────────────────
  const renderSmartPricing = () => {
    const previewStart = new Date(); previewStart.setHours(0,0,0,0);
    const previewDaysList = Array.from({length: spPreviewDays}, (_, i) => addD(previewStart, i));

    return (
      <div className="space-y-4">
        {/* Premium banner */}
        <div className="relative overflow-hidden border border-neutral-200 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 p-5">
          <div className="absolute top-2 right-3 opacity-10">
            <Icons.Sparkles width="64" height="64" className="text-white" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Icons.Sparkles width="20" height="20" className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Smart Pricing</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Automatically adjust rates based on real-time occupancy</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {spDirty && (
                <button onClick={saveSmartPricing} className="px-3 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  Save Settings
                </button>
              )}
              <button onClick={() => { setSpConfig(prev => ({ ...prev, enabled: !prev.enabled })); setSpDirty(true); }}
                className={`relative w-11 h-6 rounded-full transition-colors ${spConfig.enabled ? 'bg-emerald-500' : 'bg-neutral-600'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${spConfig.enabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Global settings */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <h4 className="text-xs font-semibold text-neutral-900 mb-3">Global Settings</h4>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className={labelClass}>Max increase (%)</label>
              <input type="number" min="0" max="100" value={spConfig.maxIncrease}
                onChange={e => { setSpConfig(prev => ({ ...prev, maxIncrease: Number(e.target.value) || 0 })); setSpDirty(true); }}
                className={inputClass + ' !w-24'} />
            </div>
            <div>
              <label className={labelClass}>Max decrease (%)</label>
              <input type="number" min="0" max="100" value={spConfig.maxDecrease}
                onChange={e => { setSpConfig(prev => ({ ...prev, maxDecrease: Number(e.target.value) || 0 })); setSpDirty(true); }}
                className={inputClass + ' !w-24'} />
            </div>
            <div>
              <label className={labelClass}>Weekend surcharge (%)</label>
              <input type="number" min="0" max="50" value={spConfig.weekendSurcharge}
                onChange={e => { setSpConfig(prev => ({ ...prev, weekendSurcharge: Number(e.target.value) || 0 })); setSpDirty(true); }}
                className={inputClass + ' !w-24'} />
            </div>
            <button onClick={applySmartPricesToRates} disabled={!spConfig.enabled}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors ${spConfig.enabled ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
              Apply to Rate Calendar (30 days)
            </button>
          </div>
        </div>

        {/* Per room type rules */}
        <div className="space-y-3">
          {roomTypes.map(rt => {
            const rule = spConfig.rules.find(r => r.roomTypeId === rt.id);
            if (!rule) return null;
            return (
              <div key={rt.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                {/* Room type header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-mono font-medium text-neutral-600">{rt.shortCode}</span>
                    <span className="text-sm font-semibold text-neutral-900">{rt.name}</span>
                    <span className="text-xs text-neutral-400">{rt.rooms.length} rooms · Base {hotelSettings.currency} {rt.defaultRate}</span>
                  </div>
                  <button onClick={() => updateSpRule(rt.id, 'enabled', !rule.enabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {rule.enabled && (
                  <div className="border-t border-neutral-100 p-4 space-y-4">
                    {/* Tier configuration */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-medium text-neutral-700">Occupancy Tiers</h5>
                        <button onClick={() => addSpTier(rt.id)} className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">+ Add tier</button>
                      </div>
                      <div className="space-y-1.5">
                        {rule.tiers.map((tier, ti) => (
                          <div key={ti} className="flex items-center gap-2 text-xs">
                            <span className="text-neutral-400 w-8 text-right">{tier.minOcc}%</span>
                            <div className="flex-1 h-2.5 bg-neutral-100 rounded-full relative overflow-hidden">
                              <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                                tier.adjustment > 0 ? 'bg-emerald-400' : tier.adjustment < 0 ? 'bg-amber-400' : 'bg-neutral-300'
                              }`} style={{ width: `${tier.maxOcc - tier.minOcc}%`, marginLeft: `${tier.minOcc}%` }} />
                            </div>
                            <span className="text-neutral-400 w-10">{tier.maxOcc}%</span>
                            <input type="number" value={tier.minOcc} onChange={e => updateSpTier(rt.id, ti, 'minOcc', e.target.value)}
                              className="w-14 px-1.5 py-1 border border-neutral-200 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" title="Min occupancy %" />
                            <span className="text-neutral-300">—</span>
                            <input type="number" value={tier.maxOcc} onChange={e => updateSpTier(rt.id, ti, 'maxOcc', e.target.value)}
                              className="w-14 px-1.5 py-1 border border-neutral-200 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" title="Max occupancy %" />
                            <div className="flex items-center gap-1">
                              <input type="number" value={tier.adjustment} onChange={e => updateSpTier(rt.id, ti, 'adjustment', e.target.value)}
                                className={`w-16 px-1.5 py-1 border rounded text-center text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
                                  tier.adjustment > 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : tier.adjustment < 0 ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-neutral-200 text-neutral-600'
                                }`} />
                              <span className="text-neutral-400">%</span>
                            </div>
                            {rule.tiers.length > 1 && (
                              <button onClick={() => removeSpTier(rt.id, ti)} className="p-1 text-neutral-300 hover:text-red-500 transition-colors" title="Remove tier">
                                <Icons.X width="12" height="12" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 14-day preview grid */}
                    <div>
                      <h5 className="text-xs font-medium text-neutral-700 mb-2">14-Day Price Preview</h5>
                      <div className="overflow-x-auto">
                        <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${spPreviewDays}, minmax(56px, 1fr))`, minWidth: `${80 + spPreviewDays * 56}px` }} className="text-[10px]">
                          {/* Header row */}
                          <div className="bg-neutral-50 border-b border-r border-neutral-200 p-1.5 text-xs font-medium text-neutral-500" />
                          {previewDaysList.map((d, i) => {
                            const isToday = fmtDate(d) === fmtDate(new Date());
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            return (
                              <div key={i} className={`border-b border-r border-neutral-200 p-1 text-center ${isToday ? 'bg-neutral-900 text-white' : isWeekend ? 'bg-neutral-50' : ''}`}>
                                <div className={`font-medium ${isToday ? 'text-neutral-300' : 'text-neutral-400'}`}>{dayNames[d.getDay()]}</div>
                                <div className={`font-semibold text-xs ${isToday ? 'text-white' : 'text-neutral-900'}`}>{d.getDate()}</div>
                              </div>
                            );
                          })}
                          {/* Occupancy row */}
                          <div className="bg-neutral-50 border-b border-r border-neutral-200 p-1.5 font-medium text-neutral-500">Occ %</div>
                          {previewDaysList.map((d, i) => {
                            const occ = getOccupancyPercent(rt.id, d);
                            return (
                              <div key={i} className="border-b border-r border-neutral-200 p-1 text-center">
                                <span className={`font-bold ${occ >= 80 ? 'text-red-500' : occ >= 60 ? 'text-amber-500' : 'text-neutral-500'}`}>{occ}%</span>
                              </div>
                            );
                          })}
                          {/* Base price row (first rate plan) */}
                          <div className="bg-neutral-50 border-b border-r border-neutral-200 p-1.5 font-medium text-neutral-500">Base</div>
                          {previewDaysList.map((d, i) => {
                            const base = getBasePrice(rt.id, ratePlans[0]?.id, d);
                            return (
                              <div key={i} className="border-b border-r border-neutral-200 p-1 text-center text-neutral-600">{base}</div>
                            );
                          })}
                          {/* Smart price row */}
                          <div className="bg-neutral-50 border-b border-r border-neutral-200 p-1.5 font-medium text-neutral-700">Smart</div>
                          {previewDaysList.map((d, i) => {
                            const base = getBasePrice(rt.id, ratePlans[0]?.id, d);
                            const smart = spConfig.enabled ? getSmartPrice(rt.id, ratePlans[0]?.id, d) : base;
                            const diff = smart - base;
                            return (
                              <div key={i} className="border-b border-r border-neutral-200 p-1 text-center">
                                <div className={`font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-amber-600' : 'text-neutral-600'}`}>{smart}</div>
                                {diff !== 0 && <div className={`text-[9px] ${diff > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{diff > 0 ? '+' : ''}{diff}</div>}
                              </div>
                            );
                          })}
                          {/* Adjustment % row */}
                          <div className="bg-neutral-50 border-r border-neutral-200 p-1.5 font-medium text-neutral-500">Adj</div>
                          {previewDaysList.map((d, i) => {
                            const adj = spConfig.enabled ? getSmartAdjustment(rt.id, d) : 0;
                            return (
                              <div key={i} className="border-r border-neutral-200 p-1 text-center">
                                <span className={`font-medium ${adj > 0 ? 'text-emerald-500' : adj < 0 ? 'text-amber-500' : 'text-neutral-400'}`}>
                                  {adj > 0 ? '+' : ''}{adj}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Price increase (high demand)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Price decrease (low demand)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-neutral-100 border border-neutral-300" /> No change</span>
          <span>Preview uses first rate plan ({ratePlans[0]?.name}). Apply pushes to all rate plans.</span>
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
      {sidebar}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
            <div className="cal-title">
              <h2>Channel Manager</h2>
              <p>Manage distribution, rates, and availability across all channels</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'rates', label: 'Inventory & Rates' },
              { id: 'smartpricing', label: 'Smart Pricing' },
              { id: 'channels', label: 'Channels' },
              { id: 'log', label: 'Activity Log' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setCmTab(tab.id)} className={tabClass(cmTab === tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {cmTab === 'overview' && renderOverview()}
          {cmTab === 'rates' && renderRates()}
          {cmTab === 'smartpricing' && renderSmartPricing()}
          {cmTab === 'channels' && renderChannels()}
          {cmTab === 'log' && renderLog()}
        </div>
      </div>
    </div>
  );
};
