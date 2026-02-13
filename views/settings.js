// ── Settings View ────────────────────────────────────────────────────────────
const SettingsView = (props) => {
  const { setToastMessage } = props;

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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 font-serif">Settings</h2>
        {dirty && (
          <button onClick={saveAll} className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-800 transition-colors">
            Save changes
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {settingsTabs.map(tab => (
          <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${settingsTab === tab.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
            {tab.label}
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
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Room Types</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Name</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Code</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-neutral-500">Base Rate</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-neutral-500">Base Occ.</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-neutral-500">Max Occ.</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-neutral-500">Extra Person</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Rooms</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Channex ID</th>
                </tr>
              </thead>
              <tbody>
                {localRoomTypes.map((rt, i) => (
                  <tr key={rt.id} className="border-b border-neutral-100">
                    <td className="py-2 px-2"><input value={rt.name} onChange={e => updateRoomType(i, 'name', e.target.value)} className="w-full px-2 py-1 border border-neutral-200 rounded text-sm" /></td>
                    <td className="py-2 px-2"><input value={rt.shortCode} onChange={e => updateRoomType(i, 'shortCode', e.target.value)} className="w-16 px-2 py-1 border border-neutral-200 rounded text-sm" /></td>
                    <td className="py-2 px-2"><input type="number" value={rt.defaultRate} onChange={e => updateRoomType(i, 'defaultRate', e.target.value)} className="w-20 px-2 py-1 border border-neutral-200 rounded text-sm text-right" /></td>
                    <td className="py-2 px-2 text-center"><input type="number" value={rt.baseOccupancy} onChange={e => updateRoomType(i, 'baseOccupancy', e.target.value)} className="w-14 px-2 py-1 border border-neutral-200 rounded text-sm text-center" /></td>
                    <td className="py-2 px-2 text-center"><input type="number" value={rt.maxOccupancy} onChange={e => updateRoomType(i, 'maxOccupancy', e.target.value)} className="w-14 px-2 py-1 border border-neutral-200 rounded text-sm text-center" /></td>
                    <td className="py-2 px-2"><input type="number" value={rt.extraPersonSupplement} onChange={e => updateRoomType(i, 'extraPersonSupplement', e.target.value)} className="w-20 px-2 py-1 border border-neutral-200 rounded text-sm text-right" /></td>
                    <td className="py-2 px-2 text-xs text-neutral-500">{rt.rooms.join(', ')}</td>
                    <td className="py-2 px-2"><input value={rt.channexId || ''} onChange={e => updateRoomType(i, 'channexId', e.target.value || null)} placeholder="—" className="w-24 px-2 py-1 border border-neutral-200 rounded text-sm text-neutral-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-400 mt-3">Room assignments are managed here. To add or remove physical rooms, edit the room list for each type.</p>
        </div>
      )}

      {settingsTab === 'rateplans' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Rate Plans</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Name</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Code</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-neutral-500">Breakfast</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-neutral-500">Refundable</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-neutral-500">Price Modifier</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Cancellation</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-neutral-500">Channex ID</th>
                </tr>
              </thead>
              <tbody>
                {localRatePlans.map((rp, i) => (
                  <tr key={rp.id} className="border-b border-neutral-100">
                    <td className="py-2 px-2"><input value={rp.name} onChange={e => updateRatePlan(i, 'name', e.target.value)} className="w-full px-2 py-1 border border-neutral-200 rounded text-sm" /></td>
                    <td className="py-2 px-2"><input value={rp.shortCode} onChange={e => updateRatePlan(i, 'shortCode', e.target.value)} className="w-16 px-2 py-1 border border-neutral-200 rounded text-sm" /></td>
                    <td className="py-2 px-2 text-center"><input type="checkbox" checked={rp.includesBreakfast} onChange={e => updateRatePlan(i, 'includesBreakfast', e.target.checked)} className="rounded" /></td>
                    <td className="py-2 px-2 text-center"><input type="checkbox" checked={rp.isRefundable} onChange={e => updateRatePlan(i, 'isRefundable', e.target.checked)} className="rounded" /></td>
                    <td className="py-2 px-2"><input type="number" value={rp.priceModifier} onChange={e => updateRatePlan(i, 'priceModifier', e.target.value)} className="w-20 px-2 py-1 border border-neutral-200 rounded text-sm text-right" /></td>
                    <td className="py-2 px-2">
                      <select value={rp.cancellationPolicyId} onChange={e => updateRatePlan(i, 'cancellationPolicyId', e.target.value)} className="px-2 py-1 border border-neutral-200 rounded text-sm">
                        {localPolicies.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2"><input value={rp.channexId || ''} onChange={e => updateRatePlan(i, 'channexId', e.target.value || null)} placeholder="—" className="w-24 px-2 py-1 border border-neutral-200 rounded text-sm text-neutral-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-400 mt-3">Price modifier is added to the room type's base rate. Use negative values for discounts.</p>
        </div>
      )}

      {settingsTab === 'cancellation' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Cancellation Policies</h3>
          <div className="space-y-4">
            {localPolicies.map((cp, i) => (
              <div key={cp.id} className="border border-neutral-100 rounded-xl p-4">
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
          </div>
        </div>
      )}

      {settingsTab === 'channex' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Channel Manager — Channex.io</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div><label className={labelClass}>Property ID</label><input value={localSettings.channex?.propertyId || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, channex: { ...prev.channex, propertyId: e.target.value || null } })); setDirty(true); }} placeholder="Not connected" className={inputClass} /></div>
            <div><label className={labelClass}>API Key</label><input value={localSettings.channex?.apiKey || ''} onChange={e => { setLocalSettings(prev => ({ ...prev, channex: { ...prev.channex, apiKey: e.target.value || null } })); setDirty(true); }} placeholder="Not configured" type="password" className={inputClass} /></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800">Channel manager integration requires a backend. Property ID and API key configuration will be functional once connected to Channex.io via the backend service.</p>
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
  );
};
