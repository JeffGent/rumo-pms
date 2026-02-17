// ── Settings View ────────────────────────────────────────────────────────────
const SettingsView = (props) => {
  const { setToastMessage, sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation, currentUser } = props;

  const [settingsTab, setSettingsTab] = useState('general');
  const [localSettings, setLocalSettings] = useState(() => JSON.parse(JSON.stringify(hotelSettings)));
  const [localRoomTypes, setLocalRoomTypes] = useState(() => JSON.parse(JSON.stringify(roomTypes)));
  const [localRatePlans, setLocalRatePlans] = useState(() => JSON.parse(JSON.stringify(ratePlans)));
  const [localPolicies, setLocalPolicies] = useState(() => JSON.parse(JSON.stringify(cancellationPolicies)));
  const [localExtras, setLocalExtras] = useState(() => JSON.parse(JSON.stringify(extrasCatalog)));
  const [localVatRates, setLocalVatRates] = useState(() => JSON.parse(JSON.stringify(vatRates)));
  const [localUsers, setLocalUsers] = useState(() => JSON.parse(JSON.stringify(hotelUsers)));
  const [dirty, setDirty] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [removeWarning, setRemoveWarning] = useState(null);
  // Email template editor state
  const [localTemplates, setLocalTemplates] = useState(() => JSON.parse(JSON.stringify(emailTemplates)));
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateEditorTab, setTemplateEditorTab] = useState('visual');
  const [emailPreviewHtml, setEmailPreviewHtml] = useState(null);

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
    // Users
    const activeAdmins = localUsers.filter(u => u.active && u.role === 'admin');
    if (activeAdmins.length === 0) { setToastMessage('At least one active admin is required'); return; }
    const badPin = localUsers.find(u => u.active && u.pin.length < 4);
    if (badPin) { setToastMessage(`PIN for ${badPin.name || 'new user'} must be at least 4 digits`); return; }
    hotelUsers.length = 0; localUsers.forEach(u => hotelUsers.push(u));
    saveHotelUsers(); syncConfig('hotelUsers', hotelUsers);
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
    ...(currentUser?.role === 'admin' ? [{ id: 'users', label: 'Users' }] : []),
    { id: 'channex', label: 'Channel Manager' },
    { id: 'email', label: 'Email' },
  ];

  const inputClass = 'w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-neutral-500 mb-1';

  const settingsSidebar = (
    <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <nav className="cal-nav">
        {canAccessPage(currentUser?.role, 'dashboard') && <a className="cal-nav-link" onClick={() => { setActivePage('dashboard'); setSelectedReservation(null); }}><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>}
        {canAccessPage(currentUser?.role, 'channelmanager') && <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>}
        {canAccessPage(currentUser?.role, 'profiles') && <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>}
        {canAccessPage(currentUser?.role, 'payments') && <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>}
        {canAccessPage(currentUser?.role, 'reports') && <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>}
        <a className="cal-nav-link active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>
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
            <div><label className={labelClass}>Street + Nr</label><input value={localSettings.hotelStreet || ''} onChange={e => updateSetting('hotelStreet', e.target.value)} className={inputClass} /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div><label className={labelClass}>Postal Code</label><input value={localSettings.hotelZip || ''} onChange={e => updateSetting('hotelZip', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>City</label><input value={localSettings.hotelCity || ''} onChange={e => updateSetting('hotelCity', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Country</label><input value={localSettings.hotelCountry || ''} onChange={e => updateSetting('hotelCountry', e.target.value)} className={inputClass} /></div>
            </div>
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
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">VAT Rates</h3>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
            <thead><tr>
              <th className="text-[11px] font-medium text-neutral-400 text-left pl-3 pb-1" style={{ width: 70 }}>Rate</th>
              <th className="text-[11px] font-medium text-neutral-400 text-left pl-2 pb-1">Label</th>
              <th style={{ width: 100 }} />
              <th style={{ width: 24 }} />
            </tr></thead>
            <tbody>
              {localVatRates.map((vr, vi) => (
                <React.Fragment key={vr.id}>
                  <tr className="group">
                    <td className="bg-neutral-50 rounded-l-lg pl-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="100" value={vr.rate} onChange={e => {
                          setLocalVatRates(prev => { const next = [...prev]; next[vi] = { ...next[vi], rate: Number(e.target.value) || 0 }; return next; });
                          setDirty(true);
                        }} className="w-14 px-2 py-1 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white" />
                        <span className="text-xs text-neutral-400">%</span>
                      </div>
                    </td>
                    <td className="bg-neutral-50 py-1.5 pl-2">
                      <input value={vr.label} onChange={e => {
                        setLocalVatRates(prev => { const next = [...prev]; next[vi] = { ...next[vi], label: e.target.value }; return next; });
                        setDirty(true);
                      }} className="w-full px-2 py-1 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white" />
                    </td>
                    <td className="bg-neutral-50 py-1.5 text-right pr-1">
                      <button onClick={() => {
                        setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule = [...(next[vi].schedule || []), { from: '', newRate: vr.rate }]; return next; });
                        setDirty(true);
                      }} className="text-[11px] text-neutral-300 hover:text-neutral-500 transition-colors opacity-0 group-hover:opacity-100">+ Schedule</button>
                    </td>
                    <td className="bg-neutral-50 rounded-r-lg py-1.5 pr-2 text-center">
                      <button onClick={() => { setLocalVatRates(prev => prev.filter((_, idx) => idx !== vi)); setDirty(true); }}
                        className="text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </td>
                  </tr>
                  {(vr.schedule && vr.schedule.length > 0) && vr.schedule.map((s, si) => (
                    <tr key={`${vr.id}-s${si}`}>
                      <td colSpan="4" className="pl-6 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-400">from</span>
                          <input type="date" value={s.from || ''} onChange={e => {
                            setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule[si].from = e.target.value; return next; });
                            setDirty(true);
                          }} className="px-2 py-0.5 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                          <span className="text-[11px] text-neutral-400">&rarr;</span>
                          <input type="number" min="0" max="100" value={s.newRate} onChange={e => {
                            setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule[si].newRate = Number(e.target.value) || 0; return next; });
                            setDirty(true);
                          }} className="w-14 px-2 py-0.5 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                          <span className="text-[11px] text-neutral-400">%</span>
                          <button onClick={() => {
                            setLocalVatRates(prev => { const next = JSON.parse(JSON.stringify(prev)); next[vi].schedule.splice(si, 1); return next; });
                            setDirty(true);
                          }} className="text-neutral-300 hover:text-red-500 text-xs ml-1">×</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <button onClick={() => {
            const newId = 'vat-' + Date.now();
            setLocalVatRates(prev => [...prev, { id: newId, rate: 0, label: '', schedule: [] }]);
            setDirty(true);
          }} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors mt-2">+ Add rate</button>
        </div>

        {/* Invoice Numbering */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mt-4">
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Invoice Numbering</h3>
          <p className="text-xs text-neutral-400 mb-4">Sequential numbering for invoices, credit notes and proformas. Belgian law requires ascending numbers without gaps.</p>
          {(() => {
            const inv = localSettings.invoiceNumbering || {};
            const updateInv = (key, value) => {
              setLocalSettings(prev => ({ ...prev, invoiceNumbering: { ...prev.invoiceNumbering, [key]: value } }));
              setDirty(true);
            };
            const sep = inv.separator || '-';
            const yr = new Date().getFullYear();
            const pad = String(inv.nextNumber || 1).padStart(inv.digits || 4, '0');
            const preview = [inv.prefix || 'INV', ...(inv.includeYear ? [yr] : []), pad].join(sep);
            const previewCN = [inv.creditPrefix || 'CN', ...(inv.includeYear ? [yr] : []), pad].join(sep);
            return (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Invoice prefix</label>
                    <input value={inv.prefix || ''} onChange={e => updateInv('prefix', e.target.value)} className={inputClass} placeholder="INV" />
                  </div>
                  <div>
                    <label className={labelClass}>Credit note prefix</label>
                    <input value={inv.creditPrefix || ''} onChange={e => updateInv('creditPrefix', e.target.value)} className={inputClass} placeholder="CN" />
                  </div>
                  <div>
                    <label className={labelClass}>Proforma prefix</label>
                    <input value={inv.proformaPrefix || ''} onChange={e => updateInv('proformaPrefix', e.target.value)} className={inputClass} placeholder="PRO" />
                  </div>
                  <div>
                    <label className={labelClass}>Separator</label>
                    <select value={inv.separator || '-'} onChange={e => updateInv('separator', e.target.value)} className={inputClass}>
                      <option value="-">Dash (-)</option>
                      <option value="/">Slash (/)</option>
                      <option value=".">Dot (.)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Next number</label>
                    <input type="number" min="1" value={inv.nextNumber || 1} onChange={e => updateInv('nextNumber', Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Digits (zero-pad)</label>
                    <select value={inv.digits || 4} onChange={e => updateInv('digits', Number(e.target.value))} className={inputClass}>
                      <option value={3}>3 (001)</option>
                      <option value={4}>4 (0001)</option>
                      <option value={5}>5 (00001)</option>
                      <option value={6}>6 (000001)</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-3 pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={inv.includeYear !== false} onChange={e => updateInv('includeYear', e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500" />
                      <span className="text-sm text-neutral-700">Include year</span>
                    </label>
                  </div>
                  <div className="flex items-end gap-3 pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={inv.resetYearly !== false} onChange={e => updateInv('resetYearly', e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500" />
                      <span className="text-sm text-neutral-700">Reset yearly</span>
                    </label>
                  </div>
                </div>
                <div className="bg-neutral-50 rounded-xl px-4 py-3 flex items-center gap-6">
                  <span className="text-xs text-neutral-400">Preview:</span>
                  <span className="text-sm font-mono font-medium text-neutral-900">{preview}</span>
                  <span className="text-xs text-neutral-300">|</span>
                  <span className="text-sm font-mono font-medium text-neutral-900">{previewCN}</span>
                </div>
              </div>
            );
          })()}
        </div>
        {/* Booking Reference Numbering */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mt-4">
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Booking Reference</h3>
          <p className="text-xs text-neutral-400 mb-4">Customise the format of internal reservation reference numbers (e.g. RMO-00001).</p>
          {(() => {
            const br = localSettings.bookingRefNumbering || {};
            const updateBR = (key, value) => {
              setLocalSettings(prev => ({ ...prev, bookingRefNumbering: { ...prev.bookingRefNumbering, [key]: value } }));
              setDirty(true);
            };
            const sep = br.separator || '-';
            const yr = new Date().getFullYear();
            const pad = String(br.nextNumber || 1).padStart(br.digits || 5, '0');
            const preview = [br.prefix || 'RMO', ...(br.includeYear ? [yr] : []), pad].join(sep);
            return (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Prefix</label>
                    <input value={br.prefix || ''} onChange={e => updateBR('prefix', e.target.value)} className={inputClass} placeholder="RMO" />
                  </div>
                  <div>
                    <label className={labelClass}>Separator</label>
                    <select value={br.separator || '-'} onChange={e => updateBR('separator', e.target.value)} className={inputClass}>
                      <option value="-">Dash (-)</option>
                      <option value="/">Slash (/)</option>
                      <option value=".">Dot (.)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Next number</label>
                    <input type="number" min="1" value={br.nextNumber || 1} onChange={e => updateBR('nextNumber', Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Digits (zero-pad)</label>
                    <select value={br.digits || 5} onChange={e => updateBR('digits', Number(e.target.value))} className={inputClass}>
                      <option value={3}>3 (001)</option>
                      <option value={4}>4 (0001)</option>
                      <option value={5}>5 (00001)</option>
                      <option value={6}>6 (000001)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="flex items-end gap-3 pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={br.includeYear || false} onChange={e => updateBR('includeYear', e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500" />
                      <span className="text-sm text-neutral-700">Include year</span>
                    </label>
                  </div>
                  <div className="flex items-end gap-3 pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={br.resetYearly || false} onChange={e => updateBR('resetYearly', e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500" />
                      <span className="text-sm text-neutral-700">Reset yearly</span>
                    </label>
                  </div>
                </div>
                <div className="bg-neutral-50 rounded-xl px-4 py-3 flex items-center gap-6">
                  <span className="text-xs text-neutral-400">Preview:</span>
                  <span className="text-sm font-mono font-medium text-neutral-900">{preview}</span>
                </div>
              </div>
            );
          })()}
        </div>
        {/* Payment Methods */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mt-4">
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Payment Methods</h3>
          <p className="text-xs text-neutral-400 mb-4">Configure which payment methods are available when recording payments. Cash and Bank Transfer are always available.</p>
          {(() => {
            const FIXED_METHODS = ['Cash', 'Bank Transfer'];
            const methods = localSettings.paymentMethods || [];
            const customMethods = methods.filter(m => !FIXED_METHODS.includes(m));
            const updateCustom = (newCustom) => {
              setLocalSettings(prev => ({ ...prev, paymentMethods: ['Cash', ...newCustom, 'Bank Transfer'] }));
              setDirty(true);
            };
            return (
              <div>
                <div className="space-y-1.5 mb-3">
                  {/* Fixed: Cash */}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-neutral-200 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <div className="flex-1 px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg text-sm text-neutral-400">Cash</div>
                  </div>
                  {/* Custom methods (editable, draggable) */}
                  {customMethods.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 group"
                      draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                      onDrop={() => {
                        if (dragIdx !== null && dragIdx !== i) {
                          const arr = [...customMethods];
                          const [moved] = arr.splice(dragIdx, 1);
                          arr.splice(i, 0, moved);
                          updateCustom(arr);
                        }
                        setDragIdx(null); setDragOverIdx(null);
                      }}>
                      <svg className="w-4 h-4 text-neutral-300 cursor-grab flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                      </svg>
                      <input value={m} onChange={e => {
                        const arr = [...customMethods]; arr[i] = e.target.value; updateCustom(arr);
                      }} className="flex-1 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                      <button onClick={() => updateCustom(customMethods.filter((_, j) => j !== i))}
                        className="p-1 text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  {/* Fixed: Bank Transfer */}
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-neutral-200 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <div className="flex-1 px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg text-sm text-neutral-400">Bank Transfer</div>
                  </div>
                </div>
                <button onClick={() => updateCustom([...customMethods, ''])}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors mt-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add method
                </button>
              </div>
            );
          })()}
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

      {settingsTab === 'users' && currentUser?.role === 'admin' && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                <th className="text-left pl-4 pr-2 py-2.5 w-10"></th>
                <th className="text-left px-2 py-2.5" style={{width:'30%'}}>Name</th>
                <th className="text-left px-2 py-2.5" style={{width:'12%'}}>PIN</th>
                <th className="text-left px-2 py-2.5" style={{width:'20%'}}>Role</th>
                <th className="text-left px-2 py-2.5 hidden md:table-cell" style={{width:'20%'}}>Department</th>
                <th className="text-center px-2 py-2.5 w-14">Active</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {localUsers.map((user, i) => (
                <tr key={user.id} className={`border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors${!user.active ? ' opacity-40' : ''}`}>
                  <td className="px-4 py-2">
                    <label className="relative w-7 h-7 rounded-full cursor-pointer block" style={{ backgroundColor: user.color }} title="Color">
                      <input type="color" value={user.color} onChange={e => { setLocalUsers(prev => { const next = [...prev]; next[i] = { ...next[i], color: e.target.value, updatedAt: Date.now() }; return next; }); setDirty(true); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </label>
                  </td>
                  <td className="px-2 py-2">
                    <input value={user.name} onChange={e => { setLocalUsers(prev => { const next = [...prev]; next[i] = { ...next[i], name: e.target.value, updatedAt: Date.now() }; return next; }); setDirty(true); }}
                      className="w-full bg-transparent text-sm text-neutral-900 outline-none border-b border-transparent focus:border-neutral-300 py-1 transition-colors" placeholder="Full name" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="password" inputMode="numeric" maxLength={6} value={user.pin} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setLocalUsers(prev => { const next = [...prev]; next[i] = { ...next[i], pin: v, updatedAt: Date.now() }; return next; }); setDirty(true); }}
                      className="w-full bg-transparent text-sm text-neutral-900 outline-none border-b border-transparent focus:border-neutral-300 py-1 transition-colors" placeholder="PIN" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={user.role} onChange={e => {
                      if (user.id === currentUser.id && e.target.value !== 'admin') {
                        const otherAdmins = localUsers.filter(u => u.active && u.role === 'admin' && u.id !== user.id);
                        if (otherAdmins.length === 0) { setToastMessage('Cannot change role — you are the only admin'); return; }
                      }
                      setLocalUsers(prev => { const next = [...prev]; next[i] = { ...next[i], role: e.target.value, updatedAt: Date.now() }; return next; }); setDirty(true);
                    }} className="w-full bg-transparent text-sm text-neutral-900 outline-none py-1 cursor-pointer">
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="housekeeping">Housekeeping</option>
                      <option value="fb">F&B</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 hidden md:table-cell">
                    <input value={user.department} onChange={e => { setLocalUsers(prev => { const next = [...prev]; next[i] = { ...next[i], department: e.target.value, updatedAt: Date.now() }; return next; }); setDirty(true); }}
                      className="w-full bg-transparent text-sm text-neutral-900 outline-none border-b border-transparent focus:border-neutral-300 py-1 transition-colors" placeholder="Department" />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={user.active !== false} onChange={e => {
                      if (!e.target.checked && user.role === 'admin') {
                        const otherAdmins = localUsers.filter(u => u.active && u.role === 'admin' && u.id !== user.id);
                        if (otherAdmins.length === 0) { setToastMessage('Cannot deactivate the last admin'); return; }
                      }
                      setLocalUsers(prev => { const next = [...prev]; next[i] = { ...next[i], active: e.target.checked, updatedAt: Date.now() }; return next; }); setDirty(true);
                    }} className="rounded border-neutral-300 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => {
                      if (user.id === currentUser.id) { setToastMessage('Cannot remove yourself'); return; }
                      const activeAdmins = localUsers.filter(u => u.active && u.role === 'admin' && u.id !== user.id);
                      if (user.role === 'admin' && activeAdmins.length === 0) { setToastMessage('Cannot remove the last admin'); return; }
                      setLocalUsers(prev => prev.filter((_, idx) => idx !== i));
                      setDirty(true);
                    }} className="text-neutral-300 hover:text-red-500 transition-colors" title="Remove">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => {
            const newId = 'usr-' + Date.now();
            setLocalUsers(prev => [...prev, { id: newId, name: '', pin: '', role: 'receptionist', department: 'Reception', color: '#6b7280', active: true, createdAt: Date.now(), updatedAt: Date.now() }]);
            setDirty(true);
          }} className="w-full py-2.5 text-xs font-medium text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors border-t border-neutral-100">
            + Add User
          </button>
        </div>
      )}

      {settingsTab === 'channex' && (<>
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

        {/* Auto Close */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-neutral-900">Auto Close</h3>
            <button onClick={() => {
              setLocalSettings(prev => ({
                ...prev,
                autoClose: {
                  ...(prev.autoClose || { receptionCloseTime: '22:00', stopSellOffset: 30, applyToChannels: 'all' }),
                  enabled: !prev.autoClose?.enabled
                }
              }));
              setDirty(true);
            }} className={`relative w-9 h-5 rounded-full transition-colors ${localSettings.autoClose?.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${localSettings.autoClose?.enabled ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Automatically stop sell all room types on all connected channels before reception closes each night.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Reception closes at</label>
              <input type="time" value={localSettings.autoClose?.receptionCloseTime || '22:00'}
                onChange={e => { setLocalSettings(prev => ({ ...prev, autoClose: { ...prev.autoClose, receptionCloseTime: e.target.value } })); setDirty(true); }}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Stop sell offset</label>
              <select value={localSettings.autoClose?.stopSellOffset || 30}
                onChange={e => { setLocalSettings(prev => ({ ...prev, autoClose: { ...prev.autoClose, stopSellOffset: Number(e.target.value) } })); setDirty(true); }}
                className={inputClass}>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={45}>45 minutes before</option>
                <option value={60}>60 minutes before</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl w-full ${localSettings.autoClose?.enabled ? 'bg-amber-50 border border-amber-100' : 'bg-neutral-50 border border-neutral-100'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke={localSettings.autoClose?.enabled ? '#b45309' : '#a3a3a3'} strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className={`text-xs font-medium ${localSettings.autoClose?.enabled ? 'text-amber-800' : 'text-neutral-400'}`}>Stop sell at {(() => {
                  const ct = localSettings.autoClose?.receptionCloseTime || '22:00';
                  const off = localSettings.autoClose?.stopSellOffset || 30;
                  const [h, m] = ct.split(':').map(Number);
                  const t = h * 60 + m - off;
                  const sh = Math.floor(((t % 1440) + 1440) % 1440 / 60);
                  const sm = ((t % 1440) + 1440) % 1440 % 60;
                  return `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
                })()}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 mt-3">{localSettings.autoClose?.enabled ? 'In production this will run automatically via a server-side scheduler. Use "Apply Now" in Channel Manager for manual trigger.' : 'Enable the toggle to activate automatic stop sell.'}</p>
        </div>
      </>)}

      {/* ── Email Templates Tab ──────────────────────────────────────────── */}
      {settingsTab === 'email' && (<>
        {/* Branding */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-4">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Email Branding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Logo</label>
              {localSettings.emailBranding?.logoUrl && (
                <div className="mb-2 p-2 bg-neutral-50 rounded-lg inline-block">
                  <img src={localSettings.emailBranding.logoUrl} alt="Logo" style={{maxHeight: 48, maxWidth: 160}} />
                </div>
              )}
              <input type="file" accept="image/*" className="block text-xs text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-200 file:text-xs file:font-medium file:bg-neutral-50 file:text-neutral-700 hover:file:bg-neutral-100"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, logoUrl: ev.target.result } }));
                    setDirty(true);
                  };
                  reader.readAsDataURL(file);
                }} />
            </div>
            <div>
              <label className={labelClass}>Sender Name</label>
              <input value={localSettings.emailBranding?.senderName || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, senderName: e.target.value } })); setDirty(true); }} placeholder={localSettings.hotelName || 'Hotel name'} className={inputClass} />
              <label className={`${labelClass} mt-3`}>Reply-to Email</label>
              <input value={localSettings.emailBranding?.replyToEmail || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, replyToEmail: e.target.value } })); setDirty(true); }} placeholder={localSettings.hotelEmail || 'info@hotel.com'} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Primary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={localSettings.emailBranding?.primaryColor || '#171717'} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, primaryColor: e.target.value } })); setDirty(true); }} className="w-8 h-8 rounded-lg border border-neutral-200 cursor-pointer" />
                <span className="text-xs text-neutral-500 font-mono">{localSettings.emailBranding?.primaryColor || '#171717'}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={localSettings.emailBranding?.accentColor || '#f59e0b'} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, accentColor: e.target.value } })); setDirty(true); }} className="w-8 h-8 rounded-lg border border-neutral-200 cursor-pointer" />
                <span className="text-xs text-neutral-500 font-mono">{localSettings.emailBranding?.accentColor || '#f59e0b'}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Background</label>
              <div className="flex items-center gap-2">
                <input type="color" value={localSettings.emailBranding?.backgroundColor || '#ffffff'} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, backgroundColor: e.target.value } })); setDirty(true); }} className="w-8 h-8 rounded-lg border border-neutral-200 cursor-pointer" />
                <span className="text-xs text-neutral-500 font-mono">{localSettings.emailBranding?.backgroundColor || '#ffffff'}</span>
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Footer Text</label>
            <input value={localSettings.emailBranding?.footerText || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, footerText: e.target.value } })); setDirty(true); }} placeholder={`${localSettings.hotelName} · ${localSettings.hotelStreet} · ${localSettings.hotelZip} ${localSettings.hotelCity}`} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div><label className={labelClass}>Facebook URL</label><input value={localSettings.emailBranding?.socialLinks?.facebook || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, socialLinks: { ...prev.emailBranding?.socialLinks, facebook: e.target.value } } })); setDirty(true); }} placeholder="https://facebook.com/..." className={inputClass} /></div>
            <div><label className={labelClass}>Instagram URL</label><input value={localSettings.emailBranding?.socialLinks?.instagram || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, socialLinks: { ...prev.emailBranding?.socialLinks, instagram: e.target.value } } })); setDirty(true); }} placeholder="https://instagram.com/..." className={inputClass} /></div>
            <div><label className={labelClass}>Website URL</label><input value={localSettings.emailBranding?.socialLinks?.website || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, emailBranding: { ...prev.emailBranding, socialLinks: { ...prev.emailBranding?.socialLinks, website: e.target.value } } })); setDirty(true); }} placeholder="https://..." className={inputClass} /></div>
          </div>
        </div>

        {/* Templates List / Editor */}
        {editingTemplate ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Edit Template: {editingTemplate.name}</h3>
              <button onClick={() => setEditingTemplate(null)} className="text-xs text-neutral-500 hover:text-neutral-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Template Name</label>
                <input value={editingTemplate.name} onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Subject Line</label>
                <input value={editingTemplate.subject} onChange={e => setEditingTemplate(prev => ({ ...prev, subject: e.target.value }))} className={inputClass} />
              </div>
            </div>

            {/* Variable insert helper */}
            <div className="mb-3">
              <label className={labelClass}>Insert Variable</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { group: 'Hotel', vars: ['hotel_name','hotel_email','hotel_phone'] },
                  { group: 'Booking', vars: ['booking_ref','checkin_date','checkout_date','num_nights','room_type','room_number','total_price','currency','paid_amount','outstanding_amount'] },
                  { group: 'Guest', vars: ['booker_firstname','booker_lastname','guest_fullname'] },
                  { group: 'Portal', vars: ['portal_code','portal_url','portal_link','payment_link'] },
                  { group: 'Invoice', vars: ['invoice_number','invoice_date','invoice_total'] },
                ].map(g => (
                  <div key={g.group} className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-400 font-medium">{g.group}:</span>
                    {g.vars.map(v => (
                      <button key={v} onClick={() => {
                        const tag = `{{${v}}}`;
                        navigator.clipboard.writeText(tag);
                        setToastMessage(`Copied ${tag}`);
                      }} className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-100 hover:bg-neutral-200 rounded text-neutral-600 transition-colors">
                        {v}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Editor tabs */}
            <div className="flex gap-2 mb-3 border-b border-neutral-200">
              {['visual', 'source', 'plaintext'].map(tab => (
                <button key={tab} onClick={() => setTemplateEditorTab(tab)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${templateEditorTab === tab ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}>
                  {tab === 'visual' ? 'Visual' : tab === 'source' ? 'Source Code' : 'Plain Text'}
                </button>
              ))}
            </div>

            {templateEditorTab === 'visual' && (
              <div>
                <textarea value={(() => { try { return htmlToPlaintext(editingTemplate.bodyHtml); } catch(e) { return ''; } })()} readOnly
                  className="w-full h-48 px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-neutral-50 text-neutral-600 resize-y"
                  placeholder="Visual preview of the HTML template. Edit in Source Code tab." />
                <p className="text-[10px] text-neutral-400 mt-1">Read-only preview. Switch to Source Code to edit HTML, or Plain Text for the text-only version.</p>
              </div>
            )}

            {templateEditorTab === 'source' && (
              <div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-600 flex-shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span className="text-[11px] text-amber-800">Advanced: editing HTML directly. Use table-based layout with inline styles for email compatibility.</span>
                </div>
                <textarea value={editingTemplate.bodyHtml || ''} onChange={e => setEditingTemplate(prev => ({ ...prev, bodyHtml: e.target.value }))}
                  className="w-full h-64 px-3 py-2 border border-neutral-200 rounded-lg text-xs font-mono bg-neutral-900 text-emerald-400 resize-y"
                  spellCheck={false} />
              </div>
            )}

            {templateEditorTab === 'plaintext' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-500">Plain text version (for OTA relay emails)</span>
                  <button onClick={() => {
                    setEditingTemplate(prev => ({ ...prev, bodyPlaintext: htmlToPlaintext(prev.bodyHtml) }));
                    setToastMessage('Plain text generated from HTML');
                  }} className="text-[11px] text-neutral-500 hover:text-neutral-700 underline">Generate from HTML</button>
                </div>
                <textarea value={editingTemplate.bodyPlaintext || ''} onChange={e => setEditingTemplate(prev => ({ ...prev, bodyPlaintext: e.target.value }))}
                  className="w-full h-48 px-3 py-2 border border-neutral-200 rounded-lg text-xs font-mono resize-y" />
              </div>
            )}

            {/* Auto-send settings */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-neutral-100">
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <button onClick={() => setEditingTemplate(prev => ({ ...prev, autoSend: !prev.autoSend }))}
                  className={`relative w-8 h-4.5 rounded-full transition-colors ${editingTemplate.autoSend ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                  style={{width: 32, height: 18}}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform`}
                    style={{width: 14, height: 14, left: editingTemplate.autoSend ? 16 : 2}} />
                </button>
                Auto-send
              </label>
              {editingTemplate.autoSend && (<>
                <select value={editingTemplate.triggerEvent || 'manual'} onChange={e => setEditingTemplate(prev => ({ ...prev, triggerEvent: e.target.value }))} className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5">
                  <option value="booking_created">On booking created</option>
                  <option value="pre_checkin">Before check-in</option>
                  <option value="checkout">On check-out</option>
                  <option value="manual">Manual only</option>
                </select>
                {editingTemplate.triggerEvent === 'pre_checkin' && (
                  <div className="flex items-center gap-1">
                    <input type="number" value={Math.abs(editingTemplate.triggerOffset || 48)} onChange={e => setEditingTemplate(prev => ({ ...prev, triggerOffset: -Math.abs(Number(e.target.value)) }))}
                      className="w-16 text-xs border border-neutral-200 rounded-lg px-2 py-1.5" min="1" max="168" />
                    <span className="text-xs text-neutral-500">hours before</span>
                  </div>
                )}
              </>)}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
              <div className="flex gap-2">
                <button onClick={() => {
                  setEmailPreviewHtml(resolveTemplateVariables(editingTemplate.bodyHtml, reservations[0] || {}));
                }} className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                  Preview
                </button>
                <button onClick={() => setToastMessage(`Test email would be sent to ${hotelSettings.hotelEmail}`)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                  Send Test
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={() => {
                  const idx = localTemplates.findIndex(t => t.id === editingTemplate.id);
                  if (idx !== -1) {
                    const next = [...localTemplates];
                    next[idx] = { ...editingTemplate, updatedAt: Date.now() };
                    setLocalTemplates(next);
                  }
                  emailTemplates.length = 0;
                  emailTemplates.push(...(idx !== -1 ? localTemplates.map((t, i) => i === idx ? { ...editingTemplate, updatedAt: Date.now() } : t) : localTemplates));
                  saveEmailTemplates();
                  setToastMessage('Template saved');
                  setEditingTemplate(null);
                }} className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
                  Save Template
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Email Templates</h3>
            <div className="space-y-2">
              {localTemplates.map((tpl, i) => (
                <div key={tpl.id} className="flex items-center justify-between p-3 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      tpl.type === 'confirmation' ? 'bg-emerald-100 text-emerald-700' :
                      tpl.type === 'pre-checkin' ? 'bg-blue-100 text-blue-700' :
                      tpl.type === 'invoice' ? 'bg-amber-100 text-amber-700' :
                      tpl.type === 'checkout' ? 'bg-purple-100 text-purple-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>{tpl.type}</span>
                    <div>
                      <div className="text-sm font-medium text-neutral-900">{tpl.name}</div>
                      <div className="text-[11px] text-neutral-400">{tpl.subject}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tpl.autoSend && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Auto</span>
                    )}
                    <button onClick={() => {
                      const next = [...localTemplates];
                      next[i] = { ...next[i], active: !next[i].active };
                      setLocalTemplates(next);
                      emailTemplates.length = 0; emailTemplates.push(...next); saveEmailTemplates();
                    }} className={`relative w-8 rounded-full transition-colors ${tpl.active ? 'bg-emerald-500' : 'bg-neutral-300'}`} style={{width: 32, height: 18}}>
                      <span className="absolute top-0.5 bg-white rounded-full shadow" style={{width: 14, height: 14, left: tpl.active ? 16 : 2, transition: 'left 200ms'}} />
                    </button>
                    <button onClick={() => setEditingTemplate(JSON.parse(JSON.stringify(tpl)))}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const newTpl = { id: `tpl-custom-${Date.now()}`, name: 'New Template', type: 'custom', subject: '{{hotel_name}}', bodyHtml: buildEmailHtml('<h2 style="font-family:Georgia,serif;font-size:22px;color:#111;margin:0 0 16px;">Your heading here</h2>\n<p style="font-size:14px;line-height:1.6;color:#555;">Dear {{booker_firstname}},</p>'), bodyPlaintext: '', isCustomHtml: false, active: true, autoSend: false, triggerEvent: 'manual', triggerOffset: 0, updatedAt: Date.now() };
              setLocalTemplates(prev => [...prev, newTpl]);
              setEditingTemplate(newTpl);
            }} className="mt-3 w-full py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 transition-colors">
              + Add Custom Template
            </button>
          </div>
        )}

        {/* Email Preview Modal */}
        {emailPreviewHtml && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setEmailPreviewHtml(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
                <span className="text-sm font-semibold text-neutral-900">Email Preview</span>
                <button onClick={() => setEmailPreviewHtml(null)} className="p-1 hover:bg-neutral-100 rounded-lg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
              </div>
              <div className="flex-1 overflow-auto p-1">
                <iframe srcDoc={emailPreviewHtml} style={{width: '100%', height: 500, border: 'none'}} sandbox="" title="Email Preview" />
              </div>
            </div>
          </div>
        )}

        {/* Portal Settings */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900">Guest Portal</h3>
            <button onClick={() => {
              setLocalSettings(prev => ({ ...prev, portalSettings: { ...prev.portalSettings, enabled: !prev.portalSettings?.enabled } }));
              setDirty(true);
            }} className={`relative w-9 h-5 rounded-full transition-colors ${localSettings.portalSettings?.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${localSettings.portalSettings?.enabled ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Portal Slug</label>
              <input value={localSettings.portalSettings?.portalSlug || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, portalSettings: { ...prev.portalSettings, portalSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } })); setDirty(true); }} placeholder="your-hotel" className={inputClass} />
              <p className="text-[10px] text-neutral-400 mt-1">URL: portal.rumo.be/<strong>{localSettings.portalSettings?.portalSlug || 'your-hotel'}</strong></p>
            </div>
            <div>
              <label className={labelClass}>Custom Domain (optional)</label>
              <input value={localSettings.portalSettings?.portalDomain || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, portalSettings: { ...prev.portalSettings, portalDomain: e.target.value } })); setDirty(true); }} placeholder="portal.yourhotel.com" className={inputClass} />
              <p className="text-[10px] text-neutral-400 mt-1">Set up a CNAME record pointing to portal.rumo.be</p>
            </div>
          </div>
          {localSettings.portalSettings?.enabled && (
            <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
              <div className="text-xs text-neutral-500 mb-1">Current portal URL (dev):</div>
              <a href={`#/go`} className="text-xs font-mono text-blue-600 hover:underline" target="_blank" rel="noopener">
                {window.location.origin}{window.location.pathname}#/go
              </a>
            </div>
          )}
        </div>
      </>)}
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
