// ── Reports View ─────────────────────────────────────────────────────────────
const ReportsView = (props) => {
  const { sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation, setPreviousPage } = props;

    const [reportTab, setReportTab] = useState('reservations');
    const [dateRange, setDateRange] = useState('thisMonth');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [sortField, setSortField] = useState('checkin');
    const [sortDir, setSortDir] = useState('desc');

    // Date range boundaries
    const now = new Date();
    const rangeStart = (() => {
      if (dateRange === 'thisMonth') return new Date(now.getFullYear(), now.getMonth(), 1);
      if (dateRange === 'lastMonth') return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      if (dateRange === 'thisYear') return new Date(now.getFullYear(), 0, 1);
      if (dateRange === 'custom' && customFrom) return new Date(customFrom);
      return new Date(now.getFullYear(), now.getMonth(), 1);
    })();
    const rangeEnd = (() => {
      if (dateRange === 'thisMonth') return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      if (dateRange === 'lastMonth') return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      if (dateRange === 'thisYear') return new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      if (dateRange === 'custom' && customTo) return new Date(customTo + 'T23:59:59');
      return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    })();

    // Filter reservations overlapping with date range
    const rangeReservations = reservations.filter(r => {
      const ci = new Date(r.checkin);
      const co = new Date(r.checkout);
      return ci <= rangeEnd && co >= rangeStart && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'blocked';
    });

    // Revenue helper
    const calcResFinancials = (res) => {
      const roomTotal = (res.rooms || []).reduce((sum, rm) => {
        if (rm.priceType === 'fixed') return sum + (rm.fixedPrice || 0);
        return sum + (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0);
      }, 0);
      const extrasTotal = (res.extras || []).reduce((sum, ex) => sum + (ex.quantity || 0) * (ex.unitPrice || 0), 0);
      const totalAmount = roomTotal + extrasTotal;
      const paidAmount = (res.payments || []).reduce((s, p) => s + p.amount, 0);
      const paidConfirmed = (res.payments || []).filter(p => !(p.method === 'Bank Transfer' && p.confirmed === false)).reduce((s, p) => s + p.amount, 0);
      const pendingBT = (res.payments || []).filter(p => p.method === 'Bank Transfer' && p.confirmed === false).reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, totalAmount - paidAmount);
      const outstandingReal = Math.max(0, totalAmount - paidConfirmed);
      return { roomTotal, extrasTotal, totalAmount, paidAmount, paidConfirmed, pendingBT, outstanding, outstandingReal };
    };

    const statusColor = (s) => {
      if (s === 'confirmed') return 'bg-blue-50 text-blue-700';
      if (s === 'checked-in') return 'bg-emerald-50 text-emerald-700';
      if (s === 'checked-out') return 'bg-neutral-100 text-neutral-600';
      if (s === 'option') return 'bg-amber-50 text-amber-700';
      if (s === 'cancelled') return 'bg-red-50 text-red-600';
      if (s === 'no-show') return 'bg-red-50 text-red-600';
      return 'bg-neutral-100 text-neutral-600';
    };

    const tabs = [
      { id: 'reservations', label: 'Reservations' },
      { id: 'revenue', label: 'Revenue' },
      { id: 'debtors', label: 'Debtors' },
      { id: 'occupancy', label: 'Occupancy' },
      { id: 'nationality', label: 'Nationality' },
    ];

    // Shared date range picker
    const DateRangePicker = () => (
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {[
          { id: 'thisMonth', label: 'This Month' },
          { id: 'lastMonth', label: 'Last Month' },
          { id: 'thisYear', label: 'This Year' },
          { id: 'custom', label: 'Custom' },
        ].map(r => (
          <button key={r.id} onClick={() => setDateRange(r.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              dateRange === r.id ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200'
            }`}>
            {r.label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} onKeyDown={noTypeDateKey}
              className="px-2 py-1 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300" />
            <span className="text-neutral-400 text-xs">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} onKeyDown={noTypeDateKey}
              className="px-2 py-1 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300" />
          </div>
        )}
      </div>
    );

    // ── Reservations Tab ──
    const ReservationsTab = () => {
      // Filter state
      const [fDateFrom, setFDateFrom] = useState('');
      const [fDateTo, setFDateTo] = useState('');
      const [fStatus, setFStatus] = useState('');
      const [fSource, setFSource] = useState('');
      const [fRoomType, setFRoomType] = useState('');
      const [fRoom, setFRoom] = useState('');
      const [fPurpose, setFPurpose] = useState('');
      const [fPriceMin, setFPriceMin] = useState('');
      const [fPriceMax, setFPriceMax] = useState('');
      const [fOutstanding, setFOutstanding] = useState(false);
      const [fNoInvoice, setFNoInvoice] = useState(false);
      const [fUnlinkedPayments, setFUnlinkedPayments] = useState(false);
      const [hasSearched, setHasSearched] = useState(false);
      const [showFilters, setShowFilters] = useState(true);

      // Saved presets
      const [savedPresets, setSavedPresets] = useState(() => {
        try { const s = localStorage.getItem('hotelReportPresets'); return s ? JSON.parse(s) : []; } catch(e) { return []; }
      });
      const [presetName, setPresetName] = useState('');
      const [showSavePreset, setShowSavePreset] = useState(false);

      const savePresetsToStorage = (presets) => { localStorage.setItem('hotelReportPresets', JSON.stringify(presets)); setSavedPresets(presets); };

      const getCurrentFilters = () => ({ fDateFrom, fDateTo, fStatus, fSource, fRoomType, fRoom, fPurpose, fPriceMin, fPriceMax, fOutstanding, fNoInvoice, fUnlinkedPayments });

      const applyFilters = (f) => {
        setFDateFrom(f.fDateFrom || ''); setFDateTo(f.fDateTo || '');
        setFStatus(f.fStatus || ''); setFSource(f.fSource || '');
        setFRoomType(f.fRoomType || ''); setFRoom(f.fRoom || '');
        setFPurpose(f.fPurpose || '');
        setFPriceMin(f.fPriceMin || ''); setFPriceMax(f.fPriceMax || '');
        setFOutstanding(f.fOutstanding || false); setFNoInvoice(f.fNoInvoice || false);
        setFUnlinkedPayments(f.fUnlinkedPayments || false);
      };

      const savePreset = () => {
        const name = presetName.trim();
        if (!name) return;
        const existing = savedPresets.filter(p => p.name !== name);
        const updated = [...existing, { name, filters: getCurrentFilters(), createdAt: Date.now() }];
        savePresetsToStorage(updated);
        setPresetName(''); setShowSavePreset(false);
      };

      const loadPreset = (preset) => {
        applyFilters(preset.filters);
        setHasSearched(true);
      };

      const deletePreset = (name) => {
        savePresetsToStorage(savedPresets.filter(p => p.name !== name));
      };

      // Unique values for dropdowns
      const allStatuses = [...new Set(reservations.map(r => r.reservationStatus).filter(Boolean))].sort();
      const allSources = [...new Set(reservations.map(r => r.bookedVia).filter(Boolean))].sort();
      const allRoomTypes = [...new Set(reservations.flatMap(r => (r.rooms || []).map(rm => rm.roomType)).filter(Boolean))].sort();
      const allRooms = [...new Set(reservations.flatMap(r => (r.rooms || []).map(rm => rm.roomNumber)).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      const allPurposes = [...new Set(reservations.map(r => r.stayPurpose).filter(Boolean))].sort();

      const activeFilterCount = [fDateFrom, fDateTo, fStatus, fSource, fRoomType, fRoom, fPurpose, fPriceMin, fPriceMax, fOutstanding, fNoInvoice, fUnlinkedPayments].filter(Boolean).length;

      const clearFilters = () => {
        setFDateFrom(''); setFDateTo(''); setFStatus(''); setFSource('');
        setFRoomType(''); setFRoom(''); setFPurpose('');
        setFPriceMin(''); setFPriceMax('');
        setFOutstanding(false); setFNoInvoice(false); setFUnlinkedPayments(false);
        setHasSearched(false);
      };

      // Apply filters only when searched
      const filtered = !hasSearched ? [] : reservations.filter(r => {
        if (r.reservationStatus === 'blocked') return false;
        if (fDateFrom) { const d = new Date(fDateFrom); if (new Date(r.checkin) < d) return false; }
        if (fDateTo) { const d = new Date(fDateTo + 'T23:59:59'); if (new Date(r.checkin) > d) return false; }
        if (fStatus && r.reservationStatus !== fStatus) return false;
        if (fSource && r.bookedVia !== fSource) return false;
        if (fRoomType && !(r.rooms || []).some(rm => rm.roomType === fRoomType)) return false;
        if (fRoom && !(r.rooms || []).some(rm => rm.roomNumber === fRoom)) return false;
        if (fPurpose && r.stayPurpose !== fPurpose) return false;
        const fin = calcResFinancials(r);
        if (fPriceMin && fin.totalAmount < parseFloat(fPriceMin)) return false;
        if (fPriceMax && fin.totalAmount > parseFloat(fPriceMax)) return false;
        if (fOutstanding && fin.outstanding <= 0) return false;
        if (fNoInvoice && (r.invoices || []).filter(i => i.type === 'invoice').length > 0) return false;
        if (fUnlinkedPayments) { if (!(r.payments || []).some(p => !p.linkedInvoice)) return false; }
        return true;
      });

      // Sort
      const sorted = [...filtered].sort((a, b) => {
        if (sortField === 'checkin') return sortDir === 'desc' ? new Date(b.checkin) - new Date(a.checkin) : new Date(a.checkin) - new Date(b.checkin);
        if (sortField === 'guest') return sortDir === 'desc' ? (b.guest || '').localeCompare(a.guest || '') : (a.guest || '').localeCompare(b.guest || '');
        if (sortField === 'total') { const fa = calcResFinancials(a); const fb = calcResFinancials(b); return sortDir === 'desc' ? fb.totalAmount - fa.totalAmount : fa.totalAmount - fb.totalAmount; }
        return 0;
      });

      const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
      };

      // Totals
      const totalFiltered = sorted.reduce((s, r) => { const f = calcResFinancials(r); return { total: s.total + f.totalAmount, paid: s.paid + f.paidAmount, outstanding: s.outstanding + f.outstanding }; }, { total: 0, paid: 0, outstanding: 0 });

      // ── Export helpers ──
      const buildExportRows = () => sorted.map(r => {
        const fin = calcResFinancials(r);
        return {
          'Booking Ref': r.bookingRef, 'OTA Ref': r.otaRef || '', 'Guest': r.guest || '',
          'Rooms': (r.rooms || []).map(rm => rm.roomNumber).join(', '),
          'Room Types': (r.rooms || []).map(rm => rm.roomType).join(', '),
          'Check-in': new Date(r.checkin).toLocaleDateString('en-GB'),
          'Check-out': new Date(r.checkout).toLocaleDateString('en-GB'),
          'Nights': (r.rooms || []).reduce((s, rm) => { const ci = new Date(rm.checkin); const co = new Date(rm.checkout); return s + Math.max(0, Math.ceil((co - ci) / 86400000)); }, 0),
          'Status': r.reservationStatus || '', 'Source': r.bookedVia || '', 'Purpose': r.stayPurpose || '',
          'Room Total': fin.roomTotal.toFixed(2), 'Extras Total': fin.extrasTotal.toFixed(2),
          'Total': fin.totalAmount.toFixed(2), 'Paid': fin.paidAmount.toFixed(2), 'Outstanding': fin.outstanding.toFixed(2),
          'Invoices': (r.invoices || []).map(i => i.number).join(', '),
          'Booker': `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.trim(),
          'Booker Email': r.booker?.email || '', 'Booker Phone': r.booker?.phone || '',
        };
      });

      const downloadCSV = () => {
        const rows = buildExportRows(); if (rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
          let v = String(r[h] || '');
          if (v.includes(',') || v.includes('"') || v.includes('\n')) v = '"' + v.replace(/"/g, '""') + '"';
          return v;
        }).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `reservations-${new Date().toISOString().slice(0,10)}.csv`; a.click();
        URL.revokeObjectURL(url);
      };

      const downloadExcel = () => {
        if (typeof XLSX === 'undefined') { alert('Excel library not loaded'); return; }
        const rows = buildExportRows(); if (rows.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = Object.keys(rows[0]).map(h => Math.max(h.length, ...rows.map(r => String(r[h] || '').length)));
        ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w + 2, 40) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reservations');
        XLSX.writeFile(wb, `reservations-${new Date().toISOString().slice(0,10)}.xlsx`);
      };

      const downloadPDF = () => {
        const rows = buildExportRows(); if (rows.length === 0) return;
        const cols = ['Booking Ref', 'Guest', 'Rooms', 'Check-in', 'Check-out', 'Status', 'Source', 'Total', 'Paid', 'Outstanding'];
        const html = `<!DOCTYPE html><html><head><style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: -apple-system, sans-serif; font-size: 9px; color: #333; }
          h1 { font-family: Georgia, serif; font-weight: 300; font-size: 18px; margin-bottom: 4px; }
          .sub { color: #888; font-size: 10px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; border-bottom: 2px solid #ddd; }
          td { padding: 5px 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #fafafa; }
          .right { text-align: right; }
          tfoot td { font-weight: 600; border-top: 2px solid #ddd; background: #f9f9f9; }
        </style></head><body>
          <h1>Reservations Report</h1>
          <div class="sub">${sorted.length} reservations${activeFilterCount > 0 ? ' (filtered)' : ''} &mdash; Generated ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</div>
          <table>
            <thead><tr>${cols.map(c => `<th${['Total','Paid','Outstanding'].includes(c) ? ' class="right"' : ''}>${c}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${cols.map(c => `<td${['Total','Paid','Outstanding'].includes(c) ? ' class="right"' : ''}>${['Total','Paid','Outstanding'].includes(c) ? '&euro; ' + r[c] : (r[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="7" class="right">Totals</td><td class="right">&euro; ${totalFiltered.total.toFixed(2)}</td><td class="right">&euro; ${totalFiltered.paid.toFixed(2)}</td><td class="right">&euro; ${totalFiltered.outstanding.toFixed(2)}</td></tr></tfoot>
          </table>
        </body></html>`;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;';
        document.body.appendChild(iframe);
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 250);
      };

      const selectClass = "px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300 text-neutral-700";
      const inputClass = "px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300 text-neutral-700 w-full";
      const checkClass = "flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer select-none hover:text-neutral-900 transition-colors";

      return (
        <div className="space-y-4">
          {/* Saved Presets */}
          {savedPresets.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-neutral-400">Saved:</span>
              {savedPresets.map(p => (
                <div key={p.name} className="flex items-center gap-0 group">
                  <button onClick={() => loadPreset(p)}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-l-lg transition-all">
                    {p.name}
                  </button>
                  <button onClick={() => deletePreset(p.name)}
                    className="px-1.5 py-1.5 text-xs text-neutral-400 bg-neutral-100 hover:bg-red-100 hover:text-red-500 rounded-r-lg transition-all border-l border-neutral-200">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Date range */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Check-in from</label>
                  <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} onKeyDown={noTypeDateKey} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Check-in to</label>
                  <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} onKeyDown={noTypeDateKey} className={inputClass} />
                </div>
                {/* Status */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={selectClass + ' w-full'}>
                    <option value="">All statuses</option>
                    {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {/* Source */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Source</label>
                  <select value={fSource} onChange={e => setFSource(e.target.value)} className={selectClass + ' w-full'}>
                    <option value="">All sources</option>
                    {allSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {/* Room type */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Room type</label>
                  <select value={fRoomType} onChange={e => setFRoomType(e.target.value)} className={selectClass + ' w-full'}>
                    <option value="">All types</option>
                    {allRoomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {/* Room number */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Room</label>
                  <select value={fRoom} onChange={e => setFRoom(e.target.value)} className={selectClass + ' w-full'}>
                    <option value="">All rooms</option>
                    {allRooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {/* Purpose */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Purpose</label>
                  <select value={fPurpose} onChange={e => setFPurpose(e.target.value)} className={selectClass + ' w-full'}>
                    <option value="">All purposes</option>
                    {allPurposes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {/* Price range */}
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Min price</label>
                  <input type="number" value={fPriceMin} onChange={e => setFPriceMin(e.target.value)} placeholder={'€ 0'} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Max price</label>
                  <input type="number" value={fPriceMax} onChange={e => setFPriceMax(e.target.value)} placeholder={'€ 9999'} className={inputClass} />
                </div>
                {/* Checkboxes — auto-trigger search */}
                <div className="flex flex-col gap-2 justify-center col-span-2">
                  <label className={checkClass}>
                    <input type="checkbox" checked={fOutstanding} onChange={e => { setFOutstanding(e.target.checked); setHasSearched(true); }} className="rounded border-neutral-300" />
                    Outstanding balance only
                  </label>
                  <label className={checkClass}>
                    <input type="checkbox" checked={fNoInvoice} onChange={e => { setFNoInvoice(e.target.checked); setHasSearched(true); }} className="rounded border-neutral-300" />
                    No invoice created
                  </label>
                  <label className={checkClass}>
                    <input type="checkbox" checked={fUnlinkedPayments} onChange={e => { setFUnlinkedPayments(e.target.checked); setHasSearched(true); }} className="rounded border-neutral-300" />
                    Unlinked payments
                  </label>
                </div>
              </div>

              {/* Search + Save + Clear buttons */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100">
                <div className="flex items-center gap-2">
                  <button onClick={() => setHasSearched(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors">
                    <Icons.Search className="w-3.5 h-3.5" />
                    Search
                  </button>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="px-3 py-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {showSavePreset ? (
                    <div className="flex items-center gap-1.5">
                      <input value={presetName} onChange={e => setPresetName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowSavePreset(false); }}
                        placeholder="Preset name..."
                        className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300 w-40"
                        autoFocus />
                      <button onClick={savePreset} disabled={!presetName.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-30">
                        Save
                      </button>
                      <button onClick={() => setShowSavePreset(false)} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowSavePreset(true)}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors border border-neutral-200 rounded-lg hover:bg-neutral-50">
                      Save as preset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Toolbar: filter toggle + count + downloads */}
          {hasSearched && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${showFilters ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  Filters{activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">{activeFilterCount}</span>}
                </button>
                <span className="text-xs text-neutral-400">{sorted.length} reservations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={downloadCSV} className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-all" title="Download CSV">CSV</button>
                <button onClick={downloadExcel} className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-all" title="Download Excel">Excel</button>
                <button onClick={downloadPDF} className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-all" title="Print / PDF">PDF</button>
              </div>
            </div>
          )}

          {/* Empty state before search */}
          {!hasSearched && (
            <div className="bg-white border border-neutral-200 rounded-2xl py-16 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-neutral-300 mx-auto mb-3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <p className="text-sm text-neutral-400">Set your filters and click <span className="font-medium text-neutral-600">Search</span> to generate a list</p>
              <p className="text-xs text-neutral-300 mt-1">Or select a saved preset above</p>
            </div>
          )}

          {/* Results */}
          {hasSearched && (
            <>
              {/* Summary bar */}
              {sorted.length > 0 && (
                <div className="flex items-center gap-6 px-1">
                  <span className="text-xs text-neutral-400">Total: <span className="text-neutral-700 font-medium">&euro; {totalFiltered.total.toLocaleString()}</span></span>
                  <span className="text-xs text-neutral-400">Paid: <span className="text-emerald-600 font-medium">&euro; {totalFiltered.paid.toLocaleString()}</span></span>
                  <span className="text-xs text-neutral-400">Outstanding: <span className="text-amber-600 font-medium">&euro; {totalFiltered.outstanding.toLocaleString()}</span></span>
                </div>
              )}

              {/* Table */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700" onClick={() => toggleSort('checkin')}>
                        Ref {sortField === 'checkin' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700" onClick={() => toggleSort('guest')}>
                        Guest {sortField === 'guest' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Check-in</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Check-out</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Source</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700" onClick={() => toggleSort('total')}>
                        Total {sortField === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Paid</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(r => {
                      const fin = calcResFinancials(r);
                      return (
                        <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer transition-colors"
                          onClick={() => { setPreviousPage('reports'); setSelectedReservation(r); }}>
                          <td className="px-4 py-3 text-xs font-mono text-neutral-600">{r.bookingRef}</td>
                          <td className="px-4 py-3 font-medium text-neutral-900">{r.guest}</td>
                          <td className="px-4 py-3 text-neutral-600">{r.rooms?.map(rm => rm.roomNumber).join(', ')}</td>
                          <td className="px-4 py-3 text-neutral-600">{new Date(r.checkin).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</td>
                          <td className="px-4 py-3 text-neutral-600">{new Date(r.checkout).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.reservationStatus)}`}>{r.reservationStatus}</span></td>
                          <td className="px-4 py-3 text-xs text-neutral-500 capitalize">{r.bookedVia}</td>
                          <td className="px-4 py-3 text-right font-medium">&euro; {fin.totalAmount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">&euro; {fin.paidAmount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-medium text-amber-600">{fin.outstanding > 0 ? `€ ${fin.outstanding.toLocaleString()}` : '—'}</td>
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr><td colSpan="10" className="px-4 py-8 text-center text-neutral-400">No reservations match the current filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      );
    };

    // ── Revenue Tab ──
    const RevenueTab = () => {
      const totalRevenue = rangeReservations.reduce((s, r) => s + calcResFinancials(r).totalAmount, 0);
      const totalRoomRev = rangeReservations.reduce((s, r) => s + calcResFinancials(r).roomTotal, 0);
      const totalExtrasRev = rangeReservations.reduce((s, r) => s + calcResFinancials(r).extrasTotal, 0);
      const roomNightCount = rangeReservations.reduce((s, r) => s + (r.rooms || []).reduce((rs, rm) => {
        const ci = new Date(rm.checkin); const co = new Date(rm.checkout);
        return rs + Math.max(0, Math.ceil((co - ci) / (1000*60*60*24)));
      }, 0), 0);
      const adr = roomNightCount > 0 ? Math.round(totalRoomRev / roomNightCount) : 0;

      // By room type
      const byRoomType = {};
      rangeReservations.forEach(r => {
        (r.rooms || []).forEach(rm => {
          const t = rm.roomType || 'Unknown';
          if (!byRoomType[t]) byRoomType[t] = { nights: 0, revenue: 0, count: 0 };
          const ci = new Date(rm.checkin); const co = new Date(rm.checkout);
          const nights = Math.max(0, Math.ceil((co - ci) / (1000*60*60*24)));
          const rev = rm.priceType === 'fixed' ? (rm.fixedPrice || 0) : (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0);
          byRoomType[t].nights += nights;
          byRoomType[t].revenue += rev;
          byRoomType[t].count += 1;
        });
      });

      // By source
      const bySource = {};
      rangeReservations.forEach(r => {
        const src = r.bookedVia || 'Unknown';
        if (!bySource[src]) bySource[src] = { count: 0, revenue: 0 };
        bySource[src].count += 1;
        bySource[src].revenue += calcResFinancials(r).totalAmount;
      });

      return (
        <div className="space-y-6">
          <DateRangePicker />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: `€ ${totalRevenue.toLocaleString()}` },
              { label: 'Room Revenue', value: `€ ${totalRoomRev.toLocaleString()}` },
              { label: 'Extras Revenue', value: `€ ${totalExtrasRev.toLocaleString()}` },
              { label: 'Avg Daily Rate', value: `€ ${adr}` },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-neutral-200 rounded-2xl p-5">
                <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">{kpi.label}</div>
                <div className="text-2xl font-light text-neutral-900 font-serif">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Revenue by Room Type */}
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Revenue by Room Type</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Room Type</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Bookings</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Nights</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Revenue</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">ADR</th>
              </tr></thead>
              <tbody>
                {Object.entries(byRoomType).sort((a,b) => b[1].revenue - a[1].revenue).map(([type, data]) => (
                  <tr key={type} className="border-b border-neutral-50">
                    <td className="px-5 py-3 font-medium text-neutral-900">{type}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{data.count}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{data.nights}</td>
                    <td className="px-5 py-3 text-right font-medium">&euro; {data.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">&euro; {data.nights > 0 ? Math.round(data.revenue / data.nights) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Revenue by Channel */}
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Revenue by Channel</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Channel</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Bookings</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Revenue</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">% of Total</th>
              </tr></thead>
              <tbody>
                {Object.entries(bySource).sort((a,b) => b[1].revenue - a[1].revenue).map(([src, data]) => (
                  <tr key={src} className="border-b border-neutral-50">
                    <td className="px-5 py-3 font-medium text-neutral-900 capitalize">{src}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{data.count}</td>
                    <td className="px-5 py-3 text-right font-medium">&euro; {data.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{totalRevenue > 0 ? Math.round(data.revenue / totalRevenue * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // ── Debtors Tab ──
    const DebtorsTab = () => {
      const debtors = reservations
        .filter(r => r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'blocked')
        .map(r => ({ ...r, ...calcResFinancials(r) }))
        .filter(r => r.outstandingReal > 0)
        .sort((a, b) => b.outstandingReal - a.outstandingReal);

      const totalOutstanding = debtors.reduce((s, r) => s + r.outstandingReal, 0);
      const totalPendingBT = debtors.reduce((s, r) => s + r.pendingBT, 0);
      const totalDebtAmount = debtors.reduce((s, r) => s + r.totalAmount, 0);

      return (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Total Outstanding</div>
              <div className="text-2xl font-light text-amber-600 font-serif">&euro; {totalOutstanding.toLocaleString()}</div>
            </div>
            {totalPendingBT > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Awaiting Bank Transfer</div>
                <div className="text-2xl font-light text-orange-500 font-serif">&euro; {totalPendingBT.toLocaleString()}</div>
              </div>
            )}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Open Accounts</div>
              <div className="text-2xl font-light text-neutral-900 font-serif">{debtors.length}</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Collection Rate</div>
              <div className="text-2xl font-light text-neutral-900 font-serif">
                {totalDebtAmount > 0 ? Math.round((1 - totalOutstanding / totalDebtAmount) * 100) : 100}%
              </div>
            </div>
          </div>

          {/* Debtors Table */}
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Booking Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Guest</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Check-out</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pending BT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Outstanding</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {debtors.map(r => (
                  <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => { setPreviousPage('reports'); setSelectedReservation(r); }}>
                    <td className="px-4 py-3 text-xs font-mono text-neutral-600">{r.bookingRef}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{r.guest}</td>
                    <td className="px-4 py-3 text-neutral-600">{new Date(r.checkin).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</td>
                    <td className="px-4 py-3 text-neutral-600">{new Date(r.checkout).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</td>
                    <td className="px-4 py-3 text-right">&euro; {r.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">&euro; {r.paidConfirmed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-orange-500">{r.pendingBT > 0 ? '€ ' + r.pendingBT.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">&euro; {r.outstandingReal.toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.reservationStatus)}`}>{r.reservationStatus}</span></td>
                  </tr>
                ))}
                {debtors.length === 0 && (
                  <tr><td colSpan="9" className="px-4 py-8 text-center text-neutral-400">No outstanding balances</td></tr>
                )}
              </tbody>
              {debtors.length > 0 && (
                <tfoot>
                  <tr className="bg-neutral-50 border-t border-neutral-200">
                    <td colSpan="7" className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Total Outstanding</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">&euro; {totalOutstanding.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      );
    };

    // ── Occupancy Tab ──
    const OccupancyTab = () => {
      const totalRoomCount = getAllRooms().length;

      // Daily occupancy
      const days = [];
      for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
        const dayStr = d.toISOString().slice(0, 10);
        let occupied = 0;
        let dayRevenue = 0;
        reservations.forEach(r => {
          (r.rooms || []).forEach(rm => {
            const ci = new Date(rm.checkin); ci.setHours(0,0,0,0);
            const co = new Date(rm.checkout); co.setHours(0,0,0,0);
            const current = new Date(d); current.setHours(0,0,0,0);
            if (current >= ci && current < co && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'blocked') {
              occupied++;
              const nightPrice = (rm.nightPrices || []).find(n => n.date === dayStr);
              if (nightPrice) dayRevenue += nightPrice.amount || 0;
            }
          });
        });
        days.push({ date: dayStr, occupied, occupancy: Math.round(occupied / totalRoomCount * 100), revenue: dayRevenue });
      }

      const avgOccupancy = days.length > 0 ? Math.round(days.reduce((s, d) => s + d.occupancy, 0) / days.length) : 0;
      const totalPeriodRevenue = days.reduce((s, d) => s + d.revenue, 0);
      const totalOccupiedNights = days.reduce((s, d) => s + d.occupied, 0);
      const periodADR = totalOccupiedNights > 0 ? Math.round(totalPeriodRevenue / totalOccupiedNights) : 0;
      const periodRevPAR = days.length > 0 ? Math.round(totalPeriodRevenue / (days.length * totalRoomCount)) : 0;

      // By room type
      const roomTypeMap = {};
      getAllRooms().forEach(r => { roomTypeMap[r] = getRoomTypeName(r); });
      const roomsByType = {};
      Object.values(roomTypeMap).forEach(t => { if (!roomsByType[t]) roomsByType[t] = 0; roomsByType[t]++; });

      const occupancyByType = {};
      Object.keys(roomsByType).forEach(t => { occupancyByType[t] = { totalNights: days.length * roomsByType[t], occupiedNights: 0 }; });
      days.forEach(day => {
        reservations.forEach(r => {
          (r.rooms || []).forEach(rm => {
            const ci = new Date(rm.checkin); ci.setHours(0,0,0,0);
            const co = new Date(rm.checkout); co.setHours(0,0,0,0);
            const current = new Date(day.date); current.setHours(0,0,0,0);
            if (current >= ci && current < co && r.reservationStatus !== 'cancelled' && r.reservationStatus !== 'blocked') {
              const t = rm.roomType || 'Unknown';
              if (occupancyByType[t]) occupancyByType[t].occupiedNights++;
            }
          });
        });
      });

      return (
        <div className="space-y-6">
          <DateRangePicker />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Avg Occupancy', value: `${avgOccupancy}%` },
              { label: 'ADR', value: `€ ${periodADR}` },
              { label: 'RevPAR', value: `€ ${periodRevPAR}` },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-neutral-200 rounded-2xl p-5">
                <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">{kpi.label}</div>
                <div className="text-2xl font-light text-neutral-900 font-serif">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Occupancy by Room Type */}
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Occupancy by Room Type</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Room Type</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Rooms</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Available</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Occupied</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Occupancy</th>
              </tr></thead>
              <tbody>
                {Object.entries(occupancyByType).map(([type, data]) => (
                  <tr key={type} className="border-b border-neutral-50">
                    <td className="px-5 py-3 font-medium text-neutral-900">{type}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{roomsByType[type]}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{data.totalNights}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{data.occupiedNights}</td>
                    <td className="px-5 py-3 text-right font-medium">{data.totalNights > 0 ? Math.round(data.occupiedNights / data.totalNights * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Daily Occupancy Bars */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Daily Occupancy</h3>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {days.map(day => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 w-20 flex-shrink-0">{new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', {day:'numeric',month:'short',weekday:'short'})}</span>
                  <div className="flex-1 bg-neutral-100 rounded-full h-4 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${day.occupancy > 85 ? 'bg-red-400' : day.occupancy > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${day.occupancy}%` }} />
                  </div>
                  <span className="text-xs font-medium text-neutral-600 w-12 text-right">{day.occupancy}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    // ── Nationality Tab ──
    const NationalityTab = () => {
      const nationalityCounts = {};
      rangeReservations.forEach(r => {
        (r.rooms || []).forEach(rm => {
          (rm.guests || []).forEach(g => {
            if (g.nationality && (g.firstName || g.lastName)) {
              const nat = g.nationality.toUpperCase();
              if (!nationalityCounts[nat]) nationalityCounts[nat] = 0;
              nationalityCounts[nat]++;
            }
          });
        });
      });

      const sorted = Object.entries(nationalityCounts).sort((a, b) => b[1] - a[1]);
      const totalGuests = sorted.reduce((s, [, c]) => s + c, 0);

      const countryNames = { NL: 'Netherlands', BE: 'Belgium', DE: 'Germany', FR: 'France', GB: 'United Kingdom', US: 'United States', IT: 'Italy', ES: 'Spain', PT: 'Portugal', CH: 'Switzerland', AT: 'Austria', LU: 'Luxembourg', DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', PL: 'Poland', CZ: 'Czech Republic', IE: 'Ireland', JP: 'Japan', CN: 'China', BR: 'Brazil', CA: 'Canada', AU: 'Australia' };

      return (
        <div className="space-y-6">
          <DateRangePicker />

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Total Guests</div>
              <div className="text-2xl font-light text-neutral-900 font-serif">{totalGuests}</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Nationalities</div>
              <div className="text-2xl font-light text-neutral-900 font-serif">{sorted.length}</div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Guest Nationality Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Country</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Guests</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">%</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase w-1/3">Distribution</th>
              </tr></thead>
              <tbody>
                {sorted.map(([nat, count]) => (
                  <tr key={nat} className="border-b border-neutral-50">
                    <td className="px-5 py-3 font-medium text-neutral-900">{countryNames[nat] || nat} <span className="text-xs text-neutral-400 ml-1">({nat})</span></td>
                    <td className="px-5 py-3 text-right text-neutral-600">{count}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">{totalGuests > 0 ? Math.round(count / totalGuests * 100) : 0}%</td>
                    <td className="px-5 py-3">
                      <div className="bg-neutral-100 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-neutral-800 rounded-full" style={{ width: `${totalGuests > 0 ? Math.round(count / totalGuests * 100) : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-neutral-400">No nationality data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // ── Sidebar ──
    const reportsSidebar = (
      <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <nav className="cal-nav">
          <a className="cal-nav-link" onClick={() => { setActivePage('dashboard'); setSelectedReservation(null); }}><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>
          <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>
          <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>
          <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>
          <a className="cal-nav-link active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>
          <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>
        </nav>
        <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy;<br/>All Rights Reserved</>)}</div>
      </aside>
    );

    // ── Main Return ──
    return (
      <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
      {reportsSidebar}
      <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="cal-title">
            <h2>Reports</h2>
            <p>Analytics and financial overview</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-neutral-200">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setReportTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                reportTab === tab.id ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
              }`}>
              {tab.label}
              {reportTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {reportTab === 'reservations' && <ReservationsTab />}
        {reportTab === 'revenue' && <RevenueTab />}
        {reportTab === 'debtors' && <DebtorsTab />}
        {reportTab === 'occupancy' && <OccupancyTab />}
        {reportTab === 'nationality' && <NationalityTab />}
      </div>
      </div>
      </div>
    );
  };
