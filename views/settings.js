// ── Settings View ────────────────────────────────────────────────────────────
const SettingsView = (props) => {
  const { setToastMessage, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation } = props;

  const [settingsTab, setSettingsTab] = useState('general');
  const [localSettings, setLocalSettings] = useState(() => JSON.parse(JSON.stringify(hotelSettings)));
  const [localRoomTypes, setLocalRoomTypes] = useState(() => JSON.parse(JSON.stringify(roomTypes)));
  const [localRatePlans, setLocalRatePlans] = useState(() => JSON.parse(JSON.stringify(ratePlans)));
  const [localPolicies, setLocalPolicies] = useState(() => JSON.parse(JSON.stringify(cancellationPolicies)));
  const [localExtras, setLocalExtras] = useState(() => JSON.parse(JSON.stringify(extrasCatalog)));
  const [localVatRates, setLocalVatRates] = useState(() => JSON.parse(JSON.stringify(vatRates)));
  const [dirty, setDirty] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [removeWarning, setRemoveWarning] = useState(null);

  // Helper: count active reservations for a room number
  const getReservationCountForRoom = (roomNumber) =>
    reservations.filter(r => r.rooms?.some(rm => rm.roomNumber === roomNumber)).length;

  const getReservationCountForRooms = (roomNumbers) =>
    reservations.filter(r => r.rooms?.some(rm => roomNumbers.includes(rm.roomNumber))).length;

  // Check if any price schedule periods overlap within a single extra
  const getOverlappingPeriods = (schedule) => {
    if (!schedule || schedule.length < 2) return new Set();
    const overlapping = new Set();
    for (let a = 0; a < schedule.length; a++) {
      if (!schedule[a].from || !schedule[a].to) continue;
      for (let b = a + 1; b < schedule.length; b++) {
        if (!schedule[b].from || !schedule[b].to) continue;
        if (schedule[a].from <= schedule[b].to && schedule[a].to >= schedule[b].from) {
          overlapping.add(a);
          overlapping.add(b);
        }
      }
    }
    return overlapping;
  };

  const hasAnyOverlap = localExtras.some(ex => getOverlappingPeriods(ex.priceSchedule).size > 0);

  const saveAll = () => {
    if (hasAnyOverlap) {
      setToastMessage('Fix overlapping price schedule periods before saving');
      return;
    }
    Object.assign(hotelSettings, localSettings);
    saveHotelSettings(); syncConfig('hotelSettings', hotelSettings);
    roomTypes.length = 0; localRoomTypes.forEach(rt => roomTypes.push(rt));
    saveRoomTypes(); syncConfig('roomTypes', roomTypes);
    ratePlans.length = 0; localRatePlans.forEach(rp => ratePlans.push(rp));
    saveRatePlans(); syncConfig('ratePlans', ratePlans);
    cancellationPolicies.length = 0; localPolicies.forEach(cp => cancellationPolicies.push(cp));
    saveCancellationPolicies(); syncConfig('cancellationPolicies', cancellationPolicies);
    extrasCatalog.length = 0; localExtras.forEach(ex => extrasCatalog.push(ex));
    saveExtrasCatalog(); syncConfig('extrasCatalog', extrasCatalog);
    vatRates.length = 0; localVatRates.forEach(vr => vatRates.push(vr));
    saveVatRates(); syncConfig('vatRates', vatRates);
    setDirty(false);
    setToastMessage('Settings saved');
  };

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateRoomType = (idx, key, value) => {
    setLocalRoomTypes(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: key === 'defaultRate' || key === 'maxOccupancy' || key === 'baseOccupancy' || key === 'extraPersonSupplement' ? Number(value) || 0 : value };
      return next;
    });
    setDirty(true);
  };

  const updateRatePlan = (idx, key, value) => {
    setLocalRatePlans(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: key === 'priceModifier' ? Number(value) || 0 : value };
      return next;
    });
    setDirty(true);
  };

  const updatePolicy = (idx, key, value) => {
    setLocalPolicies(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: key === 'deadlineHours' ? Number(value) || 0 : value };
      return next;
    });
    setDirty(true);
  };

  const updateExtra = (idx, key, value) => {
    setLocalExtras(prev => {
      const next = [...prev];
      const numKeys = ['defaultPrice', 'defaultVat', 'dailyInventoryLimit', 'multipleBookableLimit'];
      const boolKeys = ['breakfast', 'lunch', 'dinner', 'housekeepingList', 'perPerson', 'perNight', 'multipleBookable', 'dailyInventory', 'bookingEngine', 'upsellOnlineCheckin'];
      if (numKeys.includes(key)) next[idx] = { ...next[idx], [key]: Number(value) || 0 };
      else if (boolKeys.includes(key)) next[idx] = { ...next[idx], [key]: Boolean(value) };
      else next[idx] = { ...next[idx], [key]: value };
      return next;
    });
    setDirty(true);
  };

  const settingsTabs = [
    { id: 'general', label: 'General' },
    { id: 'roomtypes', label: 'Room Types' },
    { id: 'rateplans', label: 'Rate Plans' },
    { id: 'extras', label: 'Extras' },
    { id: 'cancellation', label: 'Cancellation' },
    { id: 'channex', label: 'Channel Manager' },
  ];

  const inputClass = 'w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-neutral-500 mb-1';

  const settingsSidebar = (
    <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <nav className="cal-nav">
        <a className="cal-nav-link" onClick={() => { setActivePage('dashboard'); setSelectedReservation(null); }}><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>
        <a className="cal-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>
        <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>
        <a className="cal-nav-link"><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>
        <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>
        <a className="cal-nav-link active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>
      </nav>
      <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy;<br/>All Rights Reserved</>)}</div>
    </aside>
  );

  return (
    <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
    {settingsSidebar}
    <div className="p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div className="cal-title">
          <h2>Settings</h2>
          <p>Hotel configuration and preferences</p>
        </div>
        {dirty && (
          <button onClick={saveAll} className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-800 transition-colors">
            Save changes
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-neutral-200 overflow-x-auto">
        {settingsTabs.map(tab => (
          <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${
              settingsTab === tab.id ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
            }`}>
            {tab.label}
            {settingsTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />}
          </button>
        ))}
      </div>

      {settingsTab === 'general' && (<>
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Hotel Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>Hotel Name</label><input value={localSettings.hotelName} onChange={e => updateSetting('hotelName', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>VAT Number</label><input value={localSettings.hotelVat} onChange={e => updateSetting('hotelVat', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Address</label><input value={localSettings.hotelAddress} onChange={e => updateSetting('hotelAddress', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Email</label><input value={localSettings.hotelEmail} onChange={e => updateSetting('hotelEmail', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Phone</label><input value={localSettings.hotelPhone} onChange={e => updateSetting('hotelPhone', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Currency</label>
              <select value={localSettings.currency} onChange={e => updateSetting('currency', e.target.value)} className={inputClass}>
                <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div><label className={labelClass}>Default Room VAT (%)</label>
              <select value={localSettings.defaultRoomVat} onChange={e => updateSetting('defaultRoomVat', Number(e.target.value))} className={inputClass}>
                {localVatRates.map(vr => <option key={vr.id} value={vr.rate}>{vr.rate}% — {vr.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* VAT Rates */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mt-4">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">VAT Rates</h3>
          <div className="space-y-3">
            {localVatRates.map((vr, vi) => (
              <div key={vr.id} className="flex flex-wrap items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-20">
                    <label className={labelClass}>Rate (%)</label>
                    <input type="number" min="0" max="100" value={vr.rate} onChange={e => {
                      setLocalVatRates(prev => { const next = [...prev]; next[vi] = { ...next[vi], rate: Number(e.target.value) || 0 }; return next; });
                      setDirty(true);
                    }} className={inputClass} />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className={labelClass}>Label</label>
                    <input value={vr.label} onChange={e => {
                      setLocalVatRates(prev => { const next = [...prev]; next[vi] = { ...next[vi], label: e.target.value }; return next; });
                      setDirty(true);
                    }} className={inputClass} />
                  </div>
                  <button onClick={() => { setLocalVatRates(prev => prev.filter((_, idx) => idx !== vi)); setDirty(true); }}
                    className="text-xs text-neutral-400 hover:text-red-500 transition-colors mt-5">Remove</button>
                </div>
                {/* Schedule: future rate changes */}
                {(vr.schedule && vr.schedule.length > 0) && (
                  <div className="w-full pl-1">
                    <div className="text-[11px] font-medium text-neutral-500 mb-1">Scheduled changes</div>
                    {vr.schedule.map((s, si) => (
                      <div key={si} className="flex items-center gap-2 mb-1">
                        <input type="date" value={s.from || ''} onChange={e => {
                          setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule[si].from = e.target.value; return next; });
                          setDirty(true);
                        }} className="px-2 py-0.5 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                        <span className="text-xs text-neutral-400">&rarr;</span>
                        <input type="number" min="0" max="100" value={s.newRate} onChange={e => {
                          setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule[si].newRate = Number(e.target.value) || 0; return next; });
                          setDirty(true);
                        }} className="w-16 px-2 py-0.5 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                        <span className="text-xs text-neutral-400">%</span>
                        <button onClick={() => {
                          setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule.splice(si, 1); return next; });
                          setDirty(true);
                        }} className="text-neutral-300 hover:text-red-500 text-xs">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => {
                  setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule = [...(next[vi].schedule || []), { from: '', newRate: vr.rate }]; return next; });
                  setDirty(true);
                }} className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors mt-5">+ Schedule change</button>
              </div>
            ))}
          </div>
          <button onClick={() => {
            const newId = 'vat-' + Date.now();
            setLocalVatRates(prev => [...prev, { id: newId, rate: 0, label: '', schedule: [] }]);
            setDirty(true);
          }} className="w-full py-2.5 mt-3 border-2 border-dashed border-neutral-200 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-colors">
            + Add VAT Rate
          </button>
        </div>
      </>)}

      {settingsTab === 'roomtypes' && (
        <div className="space-y-4">
          {localRoomTypes.map((rt, i) => (
            <div key={rt.id} className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">{rt.name || 'New Room Type'}</h3>
                <button onClick={() => {
                  const count = getReservationCountForRooms(rt.rooms);
                  if (count > 0) {
                    setRemoveWarning({ type: 'roomType', roomTypeIdx: i, roomTypeName: rt.name, count });
                  } else {
                    setLocalRoomTypes(prev => prev.filter((_, idx) => idx !== i));
                    setDirty(true);
                  }
                }} className="text-xs text-neutral-400 hover:text-red-500 transition-colors">Remove</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div><label className={labelClass}>Name</label><input value={rt.name} onChange={e => updateRoomType(i, 'name', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Code</label><input value={rt.shortCode} onChange={e => updateRoomType(i, 'shortCode', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Base Rate (€)</label><input type="number" value={rt.defaultRate} onChange={e => updateRoomType(i, 'defaultRate', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Extra Person (€)</label><input type="number" value={rt.extraPersonSupplement} onChange={e => updateRoomType(i, 'extraPersonSupplement', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Base Occupancy</label><input type="number" value={rt.baseOccupancy} onChange={e => updateRoomType(i, 'baseOccupancy', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Max Occupancy</label><input type="number" value={rt.maxOccupancy} onChange={e => updateRoomType(i, 'maxOccupancy', e.target.value)} className={inputClass} /></div>
              </div>
              <div>
                <label className={labelClass}>Rooms</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {rt.rooms.map((room, ri) => (
                    <span key={room} className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 rounded-lg text-sm text-neutral-700">
                      {room}
                      <button onClick={() => {
                        const count = getReservationCountForRoom(room);
                        if (count > 0) {
                          setRemoveWarning({ type: 'room', roomTypeIdx: i, roomIdx: ri, roomNumber: room, count });
                        } else {
                          setLocalRoomTypes(prev => { const next = [...prev]; next[i] = { ...next[i], rooms: next[i].rooms.filter((_, idx) => idx !== ri) }; return next; });
                          setDirty(true);
                        }
                      }} className="text-neutral-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                  <div className="relative inline-flex items-center">
                  <input placeholder="+ room" className="w-20 px-2 py-1 pr-6 border border-dashed border-neutral-300 rounded-lg text-sm text-center focus:outline-none focus:border-neutral-900"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        const val = e.target.value.trim();
                        const allRooms = localRoomTypes.flatMap(t => t.rooms);
                        if (allRooms.includes(val)) { setToastMessage(`Room ${val} is already assigned`); return; }
                        setLocalRoomTypes(prev => { const next = [...prev]; next[i] = { ...next[i], rooms: [...next[i].rooms, val] }; return next; });
                        setDirty(true);
                        e.target.value = '';
                      }
                    }} />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-300 pointer-events-none" title="Press Enter to add">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
                  </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => {
            const newId = 'rt-' + Date.now();
            setLocalRoomTypes(prev => [...prev, { id: newId, name: '', shortCode: '', defaultRate: 0, baseOccupancy: 2, maxOccupancy: 2, extraPersonSupplement: 0, rooms: [], channexId: null }]);
            setDirty(true);
          }} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-colors">
            + Add Room Type
          </button>
        </div>
      )}

      {settingsTab === 'rateplans' && (
        <div className="space-y-4">
          {localRatePlans.map((rp, i) => (
            <div key={rp.id} className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">{rp.name || 'New Rate Plan'}</h3>
                <button onClick={() => { setLocalRatePlans(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); }}
                  className="text-xs text-neutral-400 hover:text-red-500 transition-colors">Remove</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className={labelClass}>Name</label><input value={rp.name} onChange={e => updateRatePlan(i, 'name', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Code</label><input value={rp.shortCode} onChange={e => updateRatePlan(i, 'shortCode', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>± Base Rate (€)</label><input type="number" value={rp.priceModifier} onChange={e => updateRatePlan(i, 'priceModifier', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Cancellation Policy</label>
                  <select value={rp.cancellationPolicyId} onChange={e => updateRatePlan(i, 'cancellationPolicyId', e.target.value)} className={inputClass}>
                    {localPolicies.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4 col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rp.includesBreakfast} onChange={e => updateRatePlan(i, 'includesBreakfast', e.target.checked)} className="rounded border-neutral-300" />
                    <span className="text-sm text-neutral-700">Includes breakfast</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => {
            const newId = 'rp-' + Date.now();
            setLocalRatePlans(prev => [...prev, { id: newId, name: '', shortCode: '', includesBreakfast: false, isRefundable: true, priceModifier: 0, cancellationPolicyId: localPolicies[0]?.id || '', channexId: null }]);
            setDirty(true);
          }} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-colors">
            + Add Rate Plan
          </button>
        </div>
      )}

      {settingsTab === 'extras' && (
        <div className="space-y-3">
          {localExtras.map((ex, i) => (
            <div key={ex.id}
              draggable
              onDragStart={e => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragIdx !== null && dragOverIdx !== i) setDragOverIdx(i); }}
              onDragLeave={() => { if (dragOverIdx === i) setDragOverIdx(null); }}
              onDrop={e => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) {
                  setLocalExtras(prev => { const next = [...prev]; const [item] = next.splice(dragIdx, 1); next.splice(i, 0, item); return next; });
                  setDirty(true);
                }
                setDragIdx(null); setDragOverIdx(null);
              }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`relative bg-white border rounded-2xl p-4 transition-all ${dragIdx === i ? 'opacity-40 border-neutral-300' : dragOverIdx === i ? 'border-neutral-900 shadow-md' : 'border-neutral-200'}`}>
              <button onClick={() => { setLocalExtras(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); }}
                className="absolute top-2 right-2 p-1 text-neutral-300 hover:text-red-500 transition-colors" title="Remove extra">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              {/* Header + basic fields in one row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex items-center pt-6 cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500" title="Drag to reorder">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
                </div>
                <div className="flex-1 grid grid-cols-3 md:grid-cols-6 gap-2">
                  <div className="col-span-2"><label className={labelClass}>Name</label><input value={ex.name} onChange={e => updateExtra(i, 'name', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Price ({localSettings.currency})</label><input type="number" step="0.01" value={ex.defaultPrice} onChange={e => updateExtra(i, 'defaultPrice', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>VAT</label>
                    <select value={ex.defaultVat} onChange={e => updateExtra(i, 'defaultVat', e.target.value)} className={inputClass}>
                      {localVatRates.map(vr => <option key={vr.id} value={vr.rate}>{vr.rate}%</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 flex items-end gap-2">
                    <button onClick={() => {
                      setLocalExtras(prev => {
                        const next = JSON.parse(JSON.stringify(prev));
                        if (!next[i].priceSchedule) next[i].priceSchedule = [];
                        next[i].priceSchedule.push({ id: 'ps-' + Date.now(), from: '', to: '', price: ex.defaultPrice });
                        return next;
                      });
                      setDirty(true);
                    }} className="px-2 py-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors mb-px">+ Price period</button>
                  </div>
                </div>
              </div>
              {/* All flags in compact rows */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.perPerson || false} onChange={e => updateExtra(i, 'perPerson', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Per person</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.perNight || false} onChange={e => updateExtra(i, 'perNight', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Per night</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.dailyInventory || false} onChange={e => updateExtra(i, 'dailyInventory', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Daily inventory</span>
                </label>
                {ex.dailyInventory && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500">Limit:</span>
                    <input type="number" min="1" value={ex.dailyInventoryLimit || 0} onChange={e => updateExtra(i, 'dailyInventoryLimit', e.target.value)} className="w-14 px-1.5 py-0.5 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                  </div>
                )}
                <span className="text-neutral-300">|</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.breakfast || false} onChange={e => updateExtra(i, 'breakfast', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Breakfast</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.lunch || false} onChange={e => updateExtra(i, 'lunch', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Lunch</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.dinner || false} onChange={e => updateExtra(i, 'dinner', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Dinner</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ex.housekeepingList || false} onChange={e => updateExtra(i, 'housekeepingList', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-700">Housekeeping</span>
                </label>
                <span className="text-neutral-300">|</span>
                <label className="flex items-center gap-1.5 cursor-pointer opacity-50">
                  <input type="checkbox" checked={ex.bookingEngine || false} onChange={e => updateExtra(i, 'bookingEngine', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-500 italic">Booking engine</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer opacity-50">
                  <input type="checkbox" checked={ex.multipleBookable || false} onChange={e => updateExtra(i, 'multipleBookable', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-500 italic">Multiple bookable</span>
                </label>
                {ex.multipleBookable && (
                  <div className="flex items-center gap-1.5 opacity-50">
                    <span className="text-neutral-500 italic">Limit:</span>
                    <input type="number" min="1" value={ex.multipleBookableLimit || 1} onChange={e => updateExtra(i, 'multipleBookableLimit', e.target.value)} className="w-14 px-1.5 py-0.5 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                  </div>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer opacity-50">
                  <input type="checkbox" checked={ex.upsellOnlineCheckin || false} onChange={e => updateExtra(i, 'upsellOnlineCheckin', e.target.checked)} className="rounded border-neutral-300 w-3.5 h-3.5" />
                  <span className="text-neutral-500 italic">Upsell check-in</span>
                </label>
                <div className="flex items-center gap-1.5 opacity-50">
                  {ex.photo ? (
                    <div className="flex items-center gap-1.5">
                      <img src={ex.photo} className="w-6 h-6 rounded object-cover border border-neutral-200" />
                      <button onClick={() => updateExtra(i, 'photo', '')} className="text-neutral-400 hover:text-red-500" title="Remove photo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1.5 cursor-pointer" title="Upload photo for booking engine">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" className="text-neutral-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span className="text-neutral-500 italic">Photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 512 * 1024) { setToastMessage('Photo must be under 512 KB'); e.target.value = ''; return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => { updateExtra(i, 'photo', ev.target.result); };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }} />
                    </label>
                  )}
                </div>
              </div>
              {/* Price Schedule */}
              {(ex.priceSchedule && ex.priceSchedule.length > 0) && (() => {
                const overlaps = getOverlappingPeriods(ex.priceSchedule);
                return (
                <div className="mt-3 border-t border-neutral-100 pt-2">
                  <div className="text-xs font-medium text-neutral-500 mb-1.5">Price Schedule</div>
                  {ex.priceSchedule.map((ps, pi) => {
                    const isOverlap = overlaps.has(pi);
                    const dateInputClass = `px-2 py-1 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:border-transparent ${isOverlap ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-neutral-200 focus:ring-neutral-900'}`;
                    return (
                    <div key={ps.id} className="flex items-center gap-2 mb-1.5">
                      <input type="date" value={ps.from || ''} onChange={e => {
                        setLocalExtras(prev => { const next = JSON.parse(JSON.stringify(prev)); next[i].priceSchedule[pi].from = e.target.value; return next; });
                        setDirty(true);
                      }} className={dateInputClass} />
                      <span className="text-xs text-neutral-400">to</span>
                      <input type="date" value={ps.to || ''} onChange={e => {
                        setLocalExtras(prev => { const next = JSON.parse(JSON.stringify(prev)); next[i].priceSchedule[pi].to = e.target.value; return next; });
                        setDirty(true);
                      }} className={dateInputClass} />
                      <span className="text-xs text-neutral-500">{localSettings.currency}</span>
                      <input type="number" step="0.01" value={ps.price} onChange={e => {
                        setLocalExtras(prev => { const next = JSON.parse(JSON.stringify(prev)); next[i].priceSchedule[pi].price = Number(e.target.value) || 0; return next; });
                        setDirty(true);
                      }} className="w-20 px-2 py-1 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                      <button onClick={() => {
                        setLocalExtras(prev => { const next = JSON.parse(JSON.stringify(prev)); next[i].priceSchedule.splice(pi, 1); return next; });
                        setDirty(true);
                      }} className="text-neutral-400 hover:text-red-500 text-xs px-1">×</button>
                      {isOverlap && <span className="text-red-500 text-xs">Overlap</span>}
                    </div>
                    );
                  })}
                  {overlaps.size > 0 && (
                    <div className="text-xs text-red-500 mt-1">Periods overlap — adjust dates before saving</div>
                  )}
                </div>
                );
              })()}
            </div>
          ))}
          <button onClick={() => {
            const newId = 'ex-' + Date.now();
            setLocalExtras(prev => [...prev, {
              id: newId, name: '', defaultPrice: 0, defaultVat: 6,
              perPerson: false, perNight: false, multipleBookable: false,
              dailyInventory: false, dailyInventoryLimit: 0,
              breakfast: false, lunch: false, dinner: false,
              housekeepingList: false, bookingEngine: false, upsellOnlineCheckin: false,
              multipleBookableLimit: 1, priceSchedule: [], photo: ''
            }]);
            setDirty(true);
          }} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-colors">
            + Add Extra
          </button>
        </div>
      )}

      {settingsTab === 'cancellation' && (
        <div className="space-y-4">
          {localPolicies.map((cp, i) => (
            <div key={cp.id} className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">{cp.name || 'New Policy'}</h3>
                <button onClick={() => { setLocalPolicies(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); }}
                  className="text-xs text-neutral-400 hover:text-red-500 transition-colors">Remove</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={labelClass}>Name</label><input value={cp.name} onChange={e => updatePolicy(i, 'name', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Deadline (hours before check-in)</label><input type="number" value={cp.deadlineHours} onChange={e => updatePolicy(i, 'deadlineHours', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Penalty Type</label>
                  <select value={cp.penaltyType} onChange={e => updatePolicy(i, 'penaltyType', e.target.value)} className={inputClass}>
                    <option value="none">None</option><option value="first_night">First Night</option><option value="full_stay">Full Stay</option><option value="percentage">Percentage</option>
                  </select>
                </div>
                <div><label className={labelClass}>Description</label><input value={cp.description} onChange={e => updatePolicy(i, 'description', e.target.value)} className={inputClass} /></div>
              </div>
            </div>
          ))}
          <button onClick={() => {
            const newId = 'cp-' + Date.now();
            setLocalPolicies(prev => [...prev, { id: newId, name: '', description: '', deadlineHours: 48, penaltyType: 'none', penaltyValue: 0 }]);
            setDirty(true);
          }} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-colors">
            + Add Cancellation Policy
          </button>
        </div>
      )}

      {settingsTab === 'channex' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Channel Manager — Channex.io</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div><label className={labelClass}>Property ID</label><input value={localSettings.channex?.propertyId || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, channex: { ...prev.channex, propertyId: e.target.value || null } })); setDirty(true); }} placeholder="Not connected" className={inputClass} /></div>
            <div><label className={labelClass}>API Key</label><input value={localSettings.channex?.apiKey || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, channex: { ...prev.channex, apiKey: e.target.value || null } })); setDirty(true); }} placeholder="Not configured" type="password" className={inputClass} /></div>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-medium text-neutral-700 mb-3">OTA Mapping</h4>
            <p className="text-xs text-neutral-400 mb-3">Channex IDs for room types and rate plans can be configured in their respective tabs.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-neutral-100 rounded-xl p-3">
                <div className="text-xs font-medium text-neutral-500 mb-2">Room Types</div>
                {localRoomTypes.map(rt => (
                  <div key={rt.id} className="flex justify-between text-xs py-1">
                    <span className="text-neutral-700">{rt.name}</span>
                    <span className={rt.channexId ? 'text-emerald-600' : 'text-neutral-300'}>{rt.channexId || 'Not mapped'}</span>
                  </div>
                ))}
              </div>
              <div className="border border-neutral-100 rounded-xl p-3">
                <div className="text-xs font-medium text-neutral-500 mb-2">Rate Plans</div>
                {localRatePlans.map(rp => (
                  <div key={rp.id} className="flex justify-between text-xs py-1">
                    <span className="text-neutral-700">{rp.name}</span>
                    <span className={rp.channexId ? 'text-emerald-600' : 'text-neutral-300'}>{rp.channexId || 'Not mapped'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>

    {/* Warning modal for removing rooms/types with reservations */}
    {removeWarning && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setRemoveWarning(null)}>
        <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-neutral-900 mb-2">Warning</h3>
          <p className="text-sm text-neutral-600 mb-4">
            {removeWarning.type === 'room'
              ? `Room ${removeWarning.roomNumber} has ${removeWarning.count} reservation${removeWarning.count > 1 ? 's' : ''} mapped to it. Removing it may cause data inconsistencies.`
              : `Room type "${removeWarning.roomTypeName}" has rooms with ${removeWarning.count} reservation${removeWarning.count > 1 ? 's' : ''} mapped to them. Removing it may cause data inconsistencies.`
            }
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRemoveWarning(null)}
              className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={() => {
              if (removeWarning.type === 'room') {
                setLocalRoomTypes(prev => {
                  const next = [...prev];
                  next[removeWarning.roomTypeIdx] = {
                    ...next[removeWarning.roomTypeIdx],
                    rooms: next[removeWarning.roomTypeIdx].rooms.filter((_, idx) => idx !== removeWarning.roomIdx)
                  };
                  return next;
                });
              } else {
                setLocalRoomTypes(prev => prev.filter((_, idx) => idx !== removeWarning.roomTypeIdx));
              }
              setDirty(true);
              setRemoveWarning(null);
            }}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Remove anyway
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
};
