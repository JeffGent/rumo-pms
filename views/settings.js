// ── Settings View ────────────────────────────────────────────────────────────
const SettingsView = (props) => {
  const { setToastMessage, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation } = props;

  const [settingsTab, setSettingsTab] = useState('general');
  const [localSettings, setLocalSettings] = useState(() => JSON.parse(JSON.stringify(hotelSettings)));
  const [localRoomTypes, setLocalRoomTypes] = useState(() => JSON.parse(JSON.stringify(roomTypes)));
  const [localRatePlans, setLocalRatePlans] = useState(() => JSON.parse(JSON.stringify(ratePlans)));
  const [localPolicies, setLocalPolicies] = useState(() => JSON.parse(JSON.stringify(cancellationPolicies)));
  const [dirty, setDirty] = useState(false);

  const saveAll = () => {
    Object.assign(hotelSettings, localSettings);
    saveHotelSettings(); syncConfig('hotelSettings', hotelSettings);
    roomTypes.length = 0; localRoomTypes.forEach(rt => roomTypes.push(rt));
    saveRoomTypes(); syncConfig('roomTypes', roomTypes);
    ratePlans.length = 0; localRatePlans.forEach(rp => ratePlans.push(rp));
    saveRatePlans(); syncConfig('ratePlans', ratePlans);
    cancellationPolicies.length = 0; localPolicies.forEach(cp => cancellationPolicies.push(cp));
    saveCancellationPolicies(); syncConfig('cancellationPolicies', cancellationPolicies);
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

  const settingsTabs = [
    { id: 'general', label: 'General' },
    { id: 'roomtypes', label: 'Room Types' },
    { id: 'rateplans', label: 'Rate Plans' },
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

      {settingsTab === 'general' && (
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
            <div><label className={labelClass}>Default Room VAT (%)</label><input type="number" value={localSettings.defaultRoomVat} onChange={e => updateSetting('defaultRoomVat', Number(e.target.value) || 0)} className={inputClass} /></div>
          </div>
        </div>
      )}

      {settingsTab === 'roomtypes' && (
        <div className="space-y-4">
          {localRoomTypes.map((rt, i) => (
            <div key={rt.id} className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">{rt.name || 'New Room Type'}</h3>
                <button onClick={() => { setLocalRoomTypes(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); }}
                  className="text-xs text-neutral-400 hover:text-red-500 transition-colors">Remove</button>
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
                      <button onClick={() => { setLocalRoomTypes(prev => { const next = [...prev]; next[i] = { ...next[i], rooms: next[i].rooms.filter((_, idx) => idx !== ri) }; return next; }); setDirty(true); }}
                        className="text-neutral-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                  <input placeholder="+ room" className="w-20 px-2 py-1 border border-dashed border-neutral-300 rounded-lg text-sm text-center focus:outline-none focus:border-neutral-900"
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
    </div>
  );
};
