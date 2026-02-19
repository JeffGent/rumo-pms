import React from 'react';
import globals from '../globals.js';
import Icons from '../icons.jsx';
import { noTypeDateKey } from '../utils.js';
import { canAccessPage, saveCashRegister } from '../config.js';
import { saveReservationSingle } from '../supabase.js';

// ── Payments View ─────────────────────────────────────────────────────────────
const PaymentsView = (props) => {
  const { sidebarCollapsed, setSidebarCollapsed, activePage, setActivePage, setSelectedReservation, setPreviousPage, setToastMessage, cloudStatus } = props;

  const [payTab, setPayTab] = React.useState('rumopay');
  const [rumoSubTab, setRumoSubTab] = React.useState('dashboard');
  const [dateRange, setDateRange] = React.useState('thisMonth');
  const [customFrom, setCustomFrom] = React.useState('');
  const [customTo, setCustomTo] = React.useState('');
  const [sortField, setSortField] = React.useState('date');
  const [sortDir, setSortDir] = React.useState('desc');
  const [filterMethod, setFilterMethod] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [kassaForm, setKassaForm] = React.useState(null);
  const [rpSearchQuery, setRpSearchQuery] = React.useState('');
  const [selectedPayment, setSelectedPayment] = React.useState(null);
  const [refundModal, setRefundModal] = React.useState(null);
  const [refundAmount, setRefundAmount] = React.useState('');
  const [refundNote, setRefundNote] = React.useState('');
  const [paymentDetailModal, setPaymentDetailModal] = React.useState(null);
  const [, forceUpdate] = React.useState(0);

  // Date range boundaries
  const now = new Date();
  const rangeStart = (() => {
    if (dateRange === 'thisMonth') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (dateRange === 'lastMonth') return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (dateRange === 'thisYear') return new Date(now.getFullYear(), 0, 1);
    if (dateRange === 'last7') { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
    if (dateRange === 'last30') { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
    if (dateRange === 'custom' && customFrom) return new Date(customFrom);
    return new Date(now.getFullYear(), now.getMonth(), 1);
  })();
  const rangeEnd = (() => {
    if (dateRange === 'thisMonth') return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (dateRange === 'lastMonth') return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    if (dateRange === 'thisYear') return new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    if (dateRange === 'last7' || dateRange === 'last30') return new Date();
    if (dateRange === 'custom' && customTo) return new Date(customTo + 'T23:59:59');
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  })();

  // ── Data aggregation ──
  const getAllPayments = () => {
    const all = [];
    globals.reservations.forEach(res => {
      (res.payments || []).forEach(p => {
        all.push({
          ...p,
          reservationId: res.id,
          bookingRef: res.bookingRef,
          guest: res.guest || `${res.booker?.firstName || ''} ${res.booker?.lastName || ''}`.trim(),
          otaRef: res.otaRef,
        });
      });
    });
    return all;
  };

  const allPayments = getAllPayments();

  const filterByDate = (payments) => payments.filter(p => {
    const d = new Date(p.date);
    return d >= rangeStart && d <= rangeEnd;
  });

  const filteredPayments = (() => {
    let result = filterByDate(allPayments);
    if (filterMethod) result = result.filter(p => p.method === filterMethod);
    if (filterStatus === 'bt-pending') result = result.filter(p => p.method === 'Bank Transfer' && p.confirmed === false);
    else if (filterStatus === 'bt-confirmed') result = result.filter(p => p.method === 'Bank Transfer' && p.confirmed === true);
    else if (filterStatus) result = result.filter(p => p.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.bookingRef && p.bookingRef.toLowerCase().includes(q)) ||
        (p.guest && p.guest.toLowerCase().includes(q)) ||
        (p.note && p.note.toLowerCase().includes(q)) ||
        (p.method && p.method.toLowerCase().includes(q))
      );
    }
    return result;
  })();

  // Rumo Pay = non-cash payments (processed through payment system)
  const rumoPayMethods = (globals.hotelSettings.paymentMethods || []).filter(m => m !== 'Cash');
  const isRumoPayMethod = (m) => rumoPayMethods.includes(m) || (m && m.startsWith('Credit Card')) || (m && m.startsWith('VCC'));
  const rumoPayPayments = filterByDate(allPayments).filter(p => isRumoPayMethod(p.method));

  // Sort helper
  const sortPayments = (list) => {
    return [...list].sort((a, b) => {
      let va, vb;
      if (sortField === 'date') { va = a.date; vb = b.date; }
      else if (sortField === 'amount') { va = a.amount; vb = b.amount; }
      else if (sortField === 'method') { va = a.method || ''; vb = b.method || ''; }
      else if (sortField === 'status') { va = a.status || ''; vb = b.status || ''; }
      else if (sortField === 'guest') { va = a.guest || ''; vb = b.guest || ''; }
      else { va = a.date; vb = b.date; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => (
    sortField === field ? (
      <span className="ml-1 text-neutral-400">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
    ) : null
  );

  // Methods for filter dropdown: configured methods + any historical methods from data
  const configuredMethods = globals.hotelSettings.paymentMethods || ['Cash', 'Card (PIN)', 'Maestro', 'Mastercard', 'Visa', 'iDEAL', 'Bank Transfer'];
  const historicalMethods = [...new Set(allPayments.map(p => p.method).filter(Boolean))];
  const allMethods = [...configuredMethods];
  historicalMethods.forEach(m => { if (!allMethods.includes(m)) allMethods.push(m); });

  // Revenue helper
  const calcResFinancials = (res) => {
    const roomTotal = (res.rooms || []).reduce((sum, rm) => {
      if (rm.priceType === 'fixed') return sum + (rm.fixedPrice || 0);
      return sum + (rm.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0);
    }, 0);
    const extrasTotal = (res.extras || []).reduce((sum, ex) => sum + (ex.quantity || 0) * (ex.unitPrice || 0), 0);
    const totalAmount = roomTotal + extrasTotal;
    const paidAmount = (res.payments || []).reduce((s, p) => s + p.amount, 0);
    return { roomTotal, extrasTotal, totalAmount, paidAmount, outstanding: Math.max(0, totalAmount - paidAmount) };
  };

  // Navigate to reservation detail
  const goToReservation = (resId) => {
    const res = globals.reservations.find(r => r.id === resId);
    if (res) {
      setPreviousPage('payments');
      setSelectedReservation(res);
    }
  };

  // CSV export
  const exportCSV = (payments, filename) => {
    const header = 'Date,Reservation,Guest,Amount,Method,Status,Note\n';
    const rows = payments.map(p =>
      `${p.date},"${p.bookingRef || ''}","${(p.guest || '').replace(/"/g, '""')}",${p.amount.toFixed(2)},"${p.method || ''}","${p.status || ''}","${(p.note || '').replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'payments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Excel export (XLSX via XML spreadsheet)
  const exportExcel = (payments, filename) => {
    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '<Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/></Style>';
    xml += '<Style ss:ID="currency"><NumberFormat ss:Format="#,##0.00"/></Style></Styles>\n';
    xml += '<Worksheet ss:Name="Payments"><Table>\n';
    xml += '<Column ss:Width="85"/><Column ss:Width="100"/><Column ss:Width="150"/><Column ss:Width="85"/><Column ss:Width="100"/><Column ss:Width="85"/><Column ss:Width="180"/>\n';
    xml += '<Row ss:StyleID="header">';
    ['Date', 'Reservation', 'Guest', 'Amount', 'Method', 'Status', 'Note'].forEach(h => { xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>`; });
    xml += '</Row>\n';
    payments.forEach(p => {
      xml += '<Row>';
      xml += `<Cell><Data ss:Type="String">${esc(p.date)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${esc(p.bookingRef)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${esc(p.guest)}</Data></Cell>`;
      xml += `<Cell ss:StyleID="currency"><Data ss:Type="Number">${p.amount.toFixed(2)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${esc(p.method)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${esc(p.status)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${esc(p.note)}</Data></Cell>`;
      xml += '</Row>\n';
    });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (filename || 'payments').replace(/\.csv$/, '') + '.xls'; a.click();
    URL.revokeObjectURL(url);
  };

  // PDF export (print-style)
  const exportPDF = (payments, title) => {
    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const total = payments.reduce((s, p) => s + p.amount, 0);
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title || 'Payments'}</title><style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #171717; margin: 0; padding: 20px; }
      h1 { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
      .meta { font-size: 10px; color: #737373; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; font-weight: 600; font-size: 10px; color: #737373; padding: 6px 8px; border-bottom: 2px solid #e5e5e5; text-transform: uppercase; letter-spacing: 0.03em; }
      td { padding: 5px 8px; border-bottom: 1px solid #f5f5f5; font-size: 11px; }
      tr:nth-child(even) { background: #fafafa; }
      .right { text-align: right; }
      .total-row td { border-top: 2px solid #171717; font-weight: 700; padding-top: 8px; }
      .status { display: inline-block; padding: 1px 6px; border-radius: 9px; font-size: 10px; font-weight: 500; }
      .s-completed { background: #ecfdf5; color: #047857; }
      .s-pending { background: #fffbeb; color: #b45309; }
      .s-request-sent { background: #eff6ff; color: #1d4ed8; }
    </style></head><body>`;
    html += `<h1>${esc(globals.hotelSettings?.companyName || globals.hotelSettings?.hotelName || 'Hotel')} — ${esc(title || 'Payments')}</h1>`;
    html += `<div class="meta">${payments.length} payments &bull; Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>`;
    html += '<table><thead><tr><th>Date</th><th>Reservation</th><th>Guest</th><th class="right">Amount</th><th>Method</th><th>Status</th><th>Note</th></tr></thead><tbody>';
    payments.forEach(p => {
      const sc = p.status === 'completed' ? 's-completed' : p.status === 'pending' ? 's-pending' : p.status === 'request-sent' ? 's-request-sent' : '';
      html += `<tr><td>${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td>`;
      html += `<td>${esc(p.bookingRef)}</td><td>${esc(p.guest)}</td>`;
      html += `<td class="right">&euro; ${p.amount.toFixed(2)}</td>`;
      html += `<td>${esc(p.method)}</td><td><span class="status ${sc}">${esc(p.status)}</span></td>`;
      html += `<td>${esc(p.note)}</td></tr>`;
    });
    html += `<tr class="total-row"><td colspan="3">Total</td><td class="right">&euro; ${total.toFixed(2)}</td><td colspan="3"></td></tr>`;
    html += '</tbody></table></body></html>';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 300);
  };

  // ── DateRangePicker ──
  const DateRangePicker = () => (
    <div className="flex items-center gap-2 flex-wrap mb-6">
      {[
        { id: 'last7', label: 'Last 7 days' },
        { id: 'last30', label: 'Last 30 days' },
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

  // ── Status badge ──
  const StatusBadge = ({ status }) => {
    const colors = {
      completed: 'bg-emerald-50 text-emerald-700',
      pending: 'bg-amber-50 text-amber-700',
      'request-sent': 'bg-blue-50 text-blue-700',
      failed: 'bg-red-50 text-red-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-neutral-100 text-neutral-600'}`}>
        {status || 'unknown'}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: RUMO PAY
  // ═══════════════════════════════════════════════════════════════════════════

  const RumoPayTab = () => {
    const subTabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'payouts', label: 'Payouts' },
      { id: 'vccs', label: 'Virtual Credit Cards' },
      { id: 'chargebacks', label: 'Chargebacks' },
      { id: 'settings', label: 'Settings' },
      { id: 'onboarding', label: 'Onboarding' },
    ];

    // ── Dashboard sub-tab ──
    const DashboardSubTab = () => {
      const totalProcessed = rumoPayPayments.reduce((s, p) => s + p.amount, 0);
      const txCount = rumoPayPayments.length;
      const avgTx = txCount > 0 ? totalProcessed / txCount : 0;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayPayments = allPayments.filter(p => p.date === todayStr && isRumoPayMethod(p.method));
      const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0);
      const pendingPayments = allPayments.filter(p => p.status === 'pending' || p.status === 'request-sent');
      const pendingTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);

      // Daily chart data
      const dailyTotals = {};
      rumoPayPayments.forEach(p => {
        dailyTotals[p.date] = (dailyTotals[p.date] || 0) + p.amount;
      });
      const dailyEntries = Object.entries(dailyTotals).sort((a, b) => a[0].localeCompare(b[0]));
      const maxDaily = Math.max(...dailyEntries.map(e => e[1]), 1);

      return (
        <div>
          {/* Revenue Banner */}
          <div className="mb-6 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-6 text-white shadow-2xl shadow-neutral-900/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05),transparent_60%)]" />
            <div className="relative">
              <div className="text-sm text-neutral-400 mb-1">Total Processed (Rumo Pay)</div>
              <div className="text-3xl font-bold mb-4">&euro; {totalProcessed.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</div>
              <div className="flex gap-8">
                <div><div className="text-xs text-neutral-500">Transactions</div><div className="text-lg font-semibold">{txCount}</div></div>
                <div><div className="text-xs text-neutral-500">Avg. Transaction</div><div className="text-lg font-semibold">&euro; {avgTx.toFixed(2)}</div></div>
                <div><div className="text-xs text-neutral-500">Today</div><div className="text-lg font-semibold">&euro; {todayTotal.toFixed(2)}</div></div>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="text-xs text-neutral-500 mb-1">Today's Revenue</div>
              <div className="text-2xl font-bold text-neutral-900">&euro; {todayTotal.toFixed(2)}</div>
              <div className="text-xs text-neutral-400 mt-1">{todayPayments.length} transactions</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="text-xs text-neutral-500 mb-1">Pending Payments</div>
              <div className="text-2xl font-bold text-amber-600">&euro; {pendingTotal.toFixed(2)}</div>
              <div className="text-xs text-neutral-400 mt-1">{pendingPayments.length} awaiting</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="text-xs text-neutral-500 mb-1">Payment Methods</div>
              <div className="text-2xl font-bold text-neutral-900">{new Set(rumoPayPayments.map(p => p.method)).size}</div>
              <div className="text-xs text-neutral-400 mt-1">active methods</div>
            </div>
          </div>

          {/* Daily Bar Chart */}
          {dailyEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-6">
              <div className="text-sm font-medium text-neutral-700 mb-4">Daily Volume</div>
              <div className="flex items-end gap-1" style={{ height: '120px' }}>
                {dailyEntries.slice(-30).map(([date, total]) => (
                  <div key={date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                      {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: &euro;{total.toFixed(0)}
                    </div>
                    <div className="w-full bg-neutral-800 rounded-t transition-all hover:bg-neutral-600"
                      style={{ height: `${Math.max(2, (total / maxDaily) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-neutral-400">{dailyEntries.length > 0 ? new Date(dailyEntries[Math.max(0, dailyEntries.length - 30)][0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
                <span className="text-[10px] text-neutral-400">{dailyEntries.length > 0 ? new Date(dailyEntries[dailyEntries.length - 1][0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
              </div>
            </div>
          )}

          {/* Recent Transactions (compact) */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-700">Recent Transactions</div>
              <button onClick={() => setRumoSubTab('transactions')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                View all &rarr;
              </button>
            </div>
            <table className="w-full">
              <thead><tr className="text-xs text-neutral-500 border-b border-neutral-100">
                <th className="px-5 py-2.5 text-left font-medium">Date</th>
                <th className="px-5 py-2.5 text-left font-medium">Guest</th>
                <th className="px-5 py-2.5 text-left font-medium">Method</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 text-center font-medium">Status</th>
              </tr></thead>
              <tbody>
                {sortPayments(rumoPayPayments).slice(0, 5).map((p, i) => (
                  <tr key={`${p.reservationId}-${p.id}-${i}`} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors cursor-pointer"
                    onClick={() => { setRumoSubTab('transactions'); setSelectedPayment(p); }}>
                    <td className="px-5 py-2.5 text-sm text-neutral-600">{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-5 py-2.5">
                      <div className="text-sm text-neutral-900 font-medium">{p.guest}</div>
                      <div className="text-xs text-neutral-400">{p.bookingRef}</div>
                    </td>
                    <td className="px-5 py-2.5 text-sm text-neutral-600">{p.method}</td>
                    <td className={`px-5 py-2.5 text-sm text-right font-medium ${p.amount < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                      {p.amount < 0 ? '-' : ''}&euro; {Math.abs(p.amount).toFixed(2)}
                    </td>
                    <td className="px-5 py-2.5 text-center"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {rumoPayPayments.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-6 text-center text-neutral-400 text-sm">No Rumo Pay transactions in this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // ── Transactions sub-tab ──
    const TransactionsSubTab = () => {
      // Search/filter for transactions
      const rpQ = rpSearchQuery.toLowerCase().trim();
      const searchedPayments = rpQ
        ? rumoPayPayments.filter(p =>
            (p.guest && p.guest.toLowerCase().includes(rpQ)) ||
            (p.bookingRef && p.bookingRef.toLowerCase().includes(rpQ)) ||
            (p.method && p.method.toLowerCase().includes(rpQ)) ||
            (p.note && p.note.toLowerCase().includes(rpQ)) ||
            (p.amount && p.amount.toFixed(2).includes(rpQ))
          )
        : rumoPayPayments;

      // Process refund
      const processRefund = () => {
        if (!refundModal) return;
        const amount = parseFloat(refundAmount);
        if (!amount || amount <= 0 || amount > refundModal.amount) {
          setToastMessage('Invalid refund amount');
          return;
        }
        const res = globals.reservations.find(r => r.id === refundModal.reservationId);
        if (!res) return;
        const maxId = (res.payments || []).reduce((m, p) => Math.max(m, p.id || 0), 0);
        const refundPayment = {
          id: maxId + 1,
          date: new Date().toISOString().split('T')[0],
          amount: -amount,
          method: `Refund (${refundModal.method || 'Card'})`,
          note: refundNote || `Refund of ${refundModal.method} payment`,
          status: 'completed',
          linkedInvoice: null,
        };
        res.payments = [...(res.payments || []), refundPayment];
        if (typeof saveReservationSingle === 'function') saveReservationSingle(res);
        const isPartial = amount < refundModal.amount;
        setToastMessage(`${isPartial ? 'Partial refund' : 'Full refund'}: \u20AC ${amount.toFixed(2)} processed`);
        setRefundModal(null);
        setRefundAmount('');
        setRefundNote('');
        setSelectedPayment(null);
        forceUpdate(n => n + 1);
      };

      return (
        <div>
          {/* Transactions table with search */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-neutral-700">Transactions</div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="text" value={rpSearchQuery} onChange={e => { setRpSearchQuery(e.target.value); setSelectedPayment(null); }}
                    placeholder="Search guest, ref, amount..."
                    className="pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300 w-64 bg-neutral-50" />
                  <Icons.Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  {rpSearchQuery && (
                    <button onClick={() => { setRpSearchQuery(''); setSelectedPayment(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
                <span className="text-xs text-neutral-400">{searchedPayments.length} {rpQ ? 'found' : 'total'}</span>
              </div>
            </div>
            <table className="w-full">
              <thead><tr className="text-xs text-neutral-500 border-b border-neutral-100">
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-left font-medium">Guest</th>
                <th className="px-5 py-3 text-left font-medium">Method</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
                <th className="px-5 py-3 text-center font-medium" style={{ width: 90 }}>Actions</th>
              </tr></thead>
              <tbody>
                {sortPayments(searchedPayments).slice(0, rpQ ? 50 : 30).map((p, i) => {
                  const isRefund = p.amount < 0;
                  const isSelected = selectedPayment && selectedPayment.id === p.id && selectedPayment.reservationId === p.reservationId;
                  return (
                    <React.Fragment key={`${p.reservationId}-${p.id}-${i}`}>
                      <tr className={`border-b border-neutral-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-neutral-50'} ${isRefund ? 'opacity-60' : ''}`}
                        onClick={() => setSelectedPayment(isSelected ? null : p)}>
                        <td className="px-5 py-3 text-sm text-neutral-600">{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                        <td className="px-5 py-3">
                          <div className="text-sm text-neutral-900 font-medium">{p.guest}</div>
                          <div className="text-xs text-neutral-400">{p.bookingRef}</div>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-600">{p.method}</td>
                        <td className={`px-5 py-3 text-sm text-right font-medium ${isRefund ? 'text-red-600' : 'text-neutral-900'}`}>
                          {isRefund ? '-' : ''}&euro; {Math.abs(p.amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-center"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setPaymentDetailModal(p); }}
                              className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Payment details">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            {p.status === 'completed' && p.amount > 0 && (
                              <button onClick={(e) => { e.stopPropagation(); setRefundModal(p); setRefundAmount(String(p.amount)); setRefundNote(''); }}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Refund">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {isSelected && (
                        <tr className="bg-blue-50/50">
                          <td colSpan="6" className="px-5 py-4">
                            <div className="flex items-start gap-6">
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <div className="text-neutral-400 mb-0.5">Transaction ID</div>
                                  <div className="font-mono text-neutral-700">TXN-{String(p.reservationId).padStart(3, '0')}-{String(p.id).padStart(3, '0')}</div>
                                </div>
                                <div>
                                  <div className="text-neutral-400 mb-0.5">Date & Time</div>
                                  <div className="text-neutral-700">{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                </div>
                                <div>
                                  <div className="text-neutral-400 mb-0.5">Reservation</div>
                                  <button onClick={() => goToReservation(p.reservationId)} className="text-blue-600 hover:underline font-medium">{p.bookingRef}</button>
                                  {p.otaRef && <div className="text-neutral-400 mt-0.5">{p.otaRef}</div>}
                                </div>
                                <div>
                                  <div className="text-neutral-400 mb-0.5">Note</div>
                                  <div className="text-neutral-700">{p.note || '\u2014'}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => setPaymentDetailModal(p)}
                                  className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
                                  Payment details
                                </button>
                                <button onClick={() => goToReservation(p.reservationId)}
                                  className="px-3 py-1.5 text-xs font-medium bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">
                                  View reservation
                                </button>
                                {p.status === 'completed' && p.amount > 0 && (
                                  <button onClick={() => { setRefundModal(p); setRefundAmount(String(p.amount)); setRefundNote(''); }}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                    Refund
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {searchedPayments.length === 0 && (
                  <tr><td colSpan="6" className="px-5 py-8 text-center text-neutral-400 text-sm">
                    {rpQ ? `No transactions matching "${rpSearchQuery}"` : 'No Rumo Pay transactions in this period'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Detail Modal */}
          {paymentDetailModal && (() => {
            const pm = paymentDetailModal;
            const res = globals.reservations.find(r => r.id === pm.reservationId);
            const booker = res?.booker || {};
            const bp = globals.bookerProfiles.find(b => b.email === booker.email || (b.firstName === booker.firstName && b.lastName === booker.lastName));
            const card = bp?.creditCard || null;
            const isVCC = card?.isVCC || false;
            const method = pm.method || '';
            const isCardPayment = method.includes('Visa') || method.includes('Mastercard') || method.includes('Maestro') || method.includes('Card') || method.includes('Credit Card') || method.startsWith('VCC');

            // Derive card brand from method
            let cardBrand = null;
            if (method.includes('Visa')) cardBrand = 'Visa';
            else if (method.includes('Mastercard') || method.includes('MC')) cardBrand = 'Mastercard';
            else if (method.includes('Maestro')) cardBrand = 'Maestro';
            else if (method.startsWith('VCC') || method.includes('Credit Card')) cardBrand = card ? 'Visa' : 'Card';

            // Simulated data for demo
            const txnId = `TXN-${String(pm.reservationId).padStart(3, '0')}-${String(pm.id).padStart(3, '0')}`;
            const payDate = new Date(pm.date);
            const hour = 8 + ((pm.id * 7) % 12);
            const minute = (pm.id * 13) % 60;
            const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const countries = ['NL', 'BE', 'DE', 'FR', 'GB', 'US'];
            const country = countries[(pm.reservationId + pm.id) % countries.length];
            const countryNames = { NL: 'Netherlands', BE: 'Belgium', DE: 'Germany', FR: 'France', GB: 'United Kingdom', US: 'United States' };
            const isCompleted = pm.status === 'completed';
            const isPast = payDate < new Date(new Date().setDate(new Date().getDate() - 3));

            const DetailRow = ({ label, value, valueClass, children }) => (
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-50 last:border-0">
                <span className="text-xs text-neutral-400">{label}</span>
                {children || <span className={`text-xs text-right ${valueClass || 'text-neutral-900'}`}>{value}</span>}
              </div>
            );

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setPaymentDetailModal(null)}>
                <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900">Payment Details</h3>
                      <span className="text-[10px] text-neutral-400 font-mono">{txnId}</span>
                    </div>
                    <button onClick={() => setPaymentDetailModal(null)}
                      className="w-7 h-7 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>

                  {/* Amount banner */}
                  <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-neutral-400 mb-0.5">Amount</div>
                      <div className={`text-xl font-bold ${pm.amount < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                        {pm.amount < 0 ? '-' : ''}&euro; {Math.abs(pm.amount).toFixed(2)}
                      </div>
                    </div>
                    <StatusBadge status={pm.status} />
                  </div>

                  {/* Details grid */}
                  <div className="px-5 py-1 max-h-[50vh] overflow-y-auto">
                    <DetailRow label="Payment method" value={method} />
                    <DetailRow label="Date" value={payDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
                    <DetailRow label="Time" value={timeStr} />
                    <DetailRow label="Reservation">
                      <button onClick={() => { setPaymentDetailModal(null); goToReservation(pm.reservationId); }}
                        className="text-xs text-blue-600 hover:underline font-medium">
                        {pm.bookingRef}
                      </button>
                    </DetailRow>
                    {pm.otaRef && <DetailRow label="OTA Reference" value={pm.otaRef} />}
                    <DetailRow label="Guest" value={pm.guest} />
                    <DetailRow label="Payout status">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        isCompleted && isPast ? 'bg-emerald-50 text-emerald-700' :
                        isCompleted ? 'bg-amber-50 text-amber-700' :
                        'bg-neutral-100 text-neutral-500'
                      }`}>
                        {isCompleted && isPast ? 'Paid out' : isCompleted ? 'Scheduled' : 'N/A'}
                      </span>
                    </DetailRow>
                    <DetailRow label="Chargeback risk">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        isCardPayment ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {isCardPayment ? 'Normal' : 'N/A'}
                      </span>
                    </DetailRow>
                    <DetailRow label="Currency" value="EUR" />
                    {isCardPayment && <DetailRow label="Country" value={countryNames[country] || country} />}

                    {/* Card details section */}
                    {isCardPayment && (
                      <>
                        <div className="mt-1.5 mb-0.5 pt-1.5 border-t border-neutral-100">
                          <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Card Details</span>
                        </div>
                        <DetailRow label="Brand">
                          <div className="flex items-center gap-1.5">
                            {cardBrand === 'Visa' && (
                              <span className="inline-flex items-center justify-center w-8 h-5 bg-[#1a1f71] rounded text-white text-[8px] font-bold italic tracking-tight">VISA</span>
                            )}
                            {cardBrand === 'Mastercard' && (
                              <span className="inline-flex items-center justify-center w-8 h-5 bg-neutral-900 rounded">
                                <svg viewBox="0 0 24 16" width="16" height="10"><circle cx="9" cy="8" r="6" fill="#eb001b" opacity="0.9"/><circle cx="15" cy="8" r="6" fill="#f79e1b" opacity="0.9"/></svg>
                              </span>
                            )}
                            {cardBrand === 'Maestro' && (
                              <span className="inline-flex items-center justify-center w-8 h-5 bg-neutral-100 rounded text-[8px] font-bold text-neutral-700">MAE</span>
                            )}
                            {!['Visa', 'Mastercard', 'Maestro'].includes(cardBrand) && cardBrand && (
                              <span className="inline-flex items-center justify-center px-1.5 h-5 bg-neutral-100 rounded text-[8px] font-medium text-neutral-600">{cardBrand}</span>
                            )}
                            <span className="text-xs text-neutral-900">{cardBrand || 'Card'}</span>
                          </div>
                        </DetailRow>
                        <DetailRow label="Card ends with" value={card?.last4 || String(1000 + ((pm.id * 1234) % 9000))} valueClass="text-neutral-900 font-mono" />
                        <DetailRow label="Expiry" value={card?.expiry || `${String(1 + (pm.id % 12)).padStart(2, '0')}/${String(25 + (pm.id % 4))}`} valueClass="text-neutral-900 font-mono" />
                        <DetailRow label="Virtual credit card">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isVCC ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {isVCC ? 'Yes' : 'No'}
                          </span>
                        </DetailRow>
                        <DetailRow label="Cardholder" value={card?.holder || pm.guest} />
                      </>
                    )}

                    {pm.note && <DetailRow label="Note" value={pm.note} valueClass="text-neutral-500 italic" />}
                    <DetailRow label="RumoPay version" value="v2.4.1" valueClass="text-neutral-400 font-mono text-[10px]" />
                  </div>

                  {/* Footer actions */}
                  <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                    <button onClick={() => { setPaymentDetailModal(null); goToReservation(pm.reservationId); }}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      View reservation
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => setPaymentDetailModal(null)}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                        Close
                      </button>
                      {pm.status === 'completed' && pm.amount > 0 && (
                        <button onClick={() => { setPaymentDetailModal(null); setRefundModal(pm); setRefundAmount(String(pm.amount)); setRefundNote(''); }}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
                          Refund
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Refund Modal */}
          {refundModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRefundModal(null)}>
              <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-neutral-900">Process Refund</h3>
                  <button onClick={() => setRefundModal(null)}
                    className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {/* Original payment info */}
                  <div className="bg-neutral-50 rounded-xl p-4">
                    <div className="text-xs text-neutral-400 mb-2">Original Payment</div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-neutral-900">{refundModal.guest}</span>
                      <span className="text-sm font-bold text-neutral-900">&euro; {refundModal.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">{refundModal.bookingRef} &middot; {refundModal.method}</span>
                      <span className="text-xs text-neutral-400">{new Date(refundModal.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Refund type quick buttons */}
                  <div>
                    <div className="text-xs font-medium text-neutral-500 mb-2">Refund Type</div>
                    <div className="flex gap-2">
                      <button onClick={() => setRefundAmount(String(refundModal.amount))}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-xl border transition-all ${
                          parseFloat(refundAmount) === refundModal.amount
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}>
                        Full refund
                      </button>
                      <button onClick={() => { setRefundAmount(''); setTimeout(() => document.getElementById('refundAmountInput')?.focus(), 50); }}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-xl border transition-all ${
                          refundAmount && parseFloat(refundAmount) !== refundModal.amount
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}>
                        Partial refund
                      </button>
                    </div>
                  </div>

                  {/* Amount input */}
                  <div>
                    <label className="text-xs font-medium text-neutral-500 block mb-1">Refund Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">&euro;</span>
                      <input id="refundAmountInput" type="number" step="0.01" min="0.01" max={refundModal.amount}
                        value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                    </div>
                    {parseFloat(refundAmount) > refundModal.amount && (
                      <div className="text-xs text-red-500 mt-1">Cannot exceed original amount (&euro; {refundModal.amount.toFixed(2)})</div>
                    )}
                  </div>

                  {/* Note */}
                  <div>
                    <label className="text-xs font-medium text-neutral-500 block mb-1">Reason (optional)</label>
                    <input type="text" value={refundNote} onChange={e => setRefundNote(e.target.value)}
                      placeholder="e.g. Guest complaint, double charge..."
                      className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                  <div className="text-xs text-neutral-400">Refund will be processed to original payment method</div>
                  <div className="flex gap-2">
                    <button onClick={() => setRefundModal(null)}
                      className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
                      Cancel
                    </button>
                    <button onClick={processRefund}
                      disabled={!refundAmount || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > refundModal.amount}
                      className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
                      Refund &euro; {(parseFloat(refundAmount) || 0).toFixed(2)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    // ── Uitbetalingen sub-tab ──
    const PayoutsSubTab = () => {
      // Group by week
      const weeklyPayouts = {};
      rumoPayPayments.filter(p => p.status === 'completed').forEach(p => {
        const d = new Date(p.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
        const key = weekStart.toISOString().split('T')[0];
        if (!weeklyPayouts[key]) weeklyPayouts[key] = { start: weekStart, total: 0, count: 0, fee: 0 };
        weeklyPayouts[key].total += p.amount;
        weeklyPayouts[key].count++;
        weeklyPayouts[key].fee += p.amount * 0.015; // 1.5% fee simulation
      });
      const weeks = Object.entries(weeklyPayouts).sort((a, b) => b[0].localeCompare(a[0]));

      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm font-medium text-neutral-700">Payout Schedule</div>
              <div className="text-xs text-neutral-400 mt-0.5">Weekly payouts to your bank account (IBAN ending ****4589)</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportCSV(rumoPayPayments.filter(p => p.status === 'completed'), 'rumo-payouts.csv')}
                className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
                CSV
              </button>
              <button onClick={() => exportExcel(rumoPayPayments.filter(p => p.status === 'completed'), 'rumo-payouts')}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                Excel
              </button>
              <button onClick={() => exportPDF(rumoPayPayments.filter(p => p.status === 'completed'), 'Rumo Pay Payouts')}
                className="px-3 py-1.5 text-xs font-medium bg-red-700 text-white rounded-lg hover:bg-red-600 transition-colors">
                PDF
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr className="text-xs text-neutral-500 border-b border-neutral-100">
                <th className="px-5 py-3 text-left font-medium">Payout Period</th>
                <th className="px-5 py-3 text-right font-medium">Gross</th>
                <th className="px-5 py-3 text-right font-medium">Fees (1.5%)</th>
                <th className="px-5 py-3 text-right font-medium">Net Payout</th>
                <th className="px-5 py-3 text-center font-medium">Transactions</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
              </tr></thead>
              <tbody>
                {weeks.map(([key, w]) => {
                  const endDate = new Date(w.start);
                  endDate.setDate(endDate.getDate() + 6);
                  const isPast = endDate < now;
                  return (
                    <tr key={key} className="border-b border-neutral-50">
                      <td className="px-5 py-3 text-sm text-neutral-900 font-medium">
                        {w.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} &mdash; {endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-neutral-600">&euro; {w.total.toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-right text-red-500">- &euro; {w.fee.toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-right font-medium text-neutral-900">&euro; {(w.total - w.fee).toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-center text-neutral-500">{w.count}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {isPast ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {weeks.length === 0 && (
                  <tr><td colSpan="6" className="px-5 py-8 text-center text-neutral-400 text-sm">No payouts in this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // ── VCC sub-tab ──
    const VCCSubTab = () => {
      const vccProfiles = globals.bookerProfiles.filter(bp => bp.creditCard?.isVCC);

      // Match VCC profiles to reservations
      const vccEntries = vccProfiles.map(bp => {
        const linkedRes = globals.reservations.filter(r =>
          (r.booker?.email && r.booker.email === bp.email) ||
          (r.booker?.firstName === bp.firstName && r.booker?.lastName === bp.lastName)
        );
        const totalOutstanding = linkedRes.reduce((s, r) => s + calcResFinancials(r).outstanding, 0);
        const allCheckedOut = linkedRes.length > 0 && linkedRes.every(r => r.reservationStatus === 'checked-out');
        const hasVCCPayment = linkedRes.some(r => (r.payments || []).some(p => p.method && p.method.startsWith('VCC')));
        let status = 'pending';
        if (hasVCCPayment) status = 'charged';
        else if (allCheckedOut && totalOutstanding <= 0) status = 'charged';
        else if (new Date(bp.creditCard.expiry.split('/').reverse().join('-') + '-01') < now) status = 'expired';
        return { ...bp, linkedRes, totalOutstanding, status };
      });

      const chargeVCC = (entry) => {
        if (entry.totalOutstanding <= 0) return;
        entry.linkedRes.forEach(res => {
          const fin = calcResFinancials(res);
          if (fin.outstanding <= 0) return;
          const idx = globals.reservations.findIndex(r => r.id === res.id);
          if (idx === -1) return;
          const maxId = (globals.reservations[idx].payments || []).reduce((m, p) => Math.max(m, p.id || 0), 0);
          globals.reservations[idx].payments = [...(globals.reservations[idx].payments || []), {
            id: maxId + 1,
            date: new Date().toISOString().split('T')[0],
            amount: fin.outstanding,
            method: `VCC (\u2022\u2022\u2022\u2022 ${entry.creditCard.last4})`,
            note: 'Manual VCC charge',
            status: 'completed',
            linkedInvoice: null,
          }];
          if (typeof saveReservationSingle === 'function') saveReservationSingle(globals.reservations[idx]);
        });
      };

      return (
        <div>
          <div className="mb-6">
            <div className="text-sm font-medium text-neutral-700">Virtual Credit Cards</div>
            <div className="text-xs text-neutral-400 mt-0.5">VCCs from OTA bookings (Booking.com). Auto-charged on checkout.</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="text-xs text-neutral-500 border-b border-neutral-100">
                <th className="px-5 py-3 text-left font-medium">Guest</th>
                <th className="px-5 py-3 text-left font-medium">Card</th>
                <th className="px-5 py-3 text-left font-medium">Expiry</th>
                <th className="px-5 py-3 text-left font-medium">Reservation(s)</th>
                <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
                <th className="px-5 py-3 text-center font-medium"></th>
              </tr></thead>
              <tbody>
                {vccEntries.map((entry, i) => (
                  <tr key={i} className="border-b border-neutral-50">
                    <td className="px-5 py-3 text-sm font-medium text-neutral-900">{entry.firstName} {entry.lastName}</td>
                    <td className="px-5 py-3 text-sm text-neutral-600 font-mono">{'\u2022\u2022\u2022\u2022 '}{entry.creditCard.last4}</td>
                    <td className="px-5 py-3 text-sm text-neutral-500">{entry.creditCard.expiry}</td>
                    <td className="px-5 py-3">
                      {entry.linkedRes.slice(0, 2).map(r => (
                        <button key={r.id} onClick={() => goToReservation(r.id)} className="text-xs text-blue-600 hover:underline mr-2">{r.bookingRef}</button>
                      ))}
                      {entry.linkedRes.length > 2 && <span className="text-xs text-neutral-400">+{entry.linkedRes.length - 2}</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-right font-medium text-neutral-900">&euro; {entry.totalOutstanding.toFixed(2)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.status === 'charged' ? 'bg-emerald-50 text-emerald-700' :
                        entry.status === 'expired' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-700'
                      }`}>{entry.status}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {entry.status === 'pending' && entry.totalOutstanding > 0 && (
                        <button onClick={() => chargeVCC(entry)}
                          className="px-2 py-1 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
                          Charge now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {vccEntries.length === 0 && (
                  <tr><td colSpan="7" className="px-5 py-8 text-center text-neutral-400 text-sm">No virtual credit cards found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // ── Chargebacks sub-tab ──
    const ChargebacksSubTab = () => (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24" className="text-neutral-400">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <div className="text-lg font-medium text-neutral-900 mb-2">No chargebacks</div>
        <div className="text-sm text-neutral-400">There are currently no chargebacks or disputes. Well done!</div>
      </div>
    );

    // ── Settings sub-tab ──
    const SettingsSubTab = () => {
      const [terminalEnabled, setTerminalEnabled] = React.useState(true);
      const [idealEnabled, setIdealEnabled] = React.useState(true);
      const [cardEnabled, setCardEnabled] = React.useState(true);
      const [bankTransferEnabled, setBankTransferEnabled] = React.useState(true);

      const Toggle = ({ enabled, onChange, label }) => (
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-neutral-700">{label}</span>
          <button onClick={() => onChange(!enabled)}
            className={`w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${enabled ? 'translate-x-4' : ''}`} />
          </button>
        </div>
      );

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Terminal Config */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="text-sm font-medium text-neutral-700 mb-4">Terminal Configuration</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Terminal ID</span>
                <span className="text-sm font-mono text-neutral-700">TRM-2024-0847</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Location</span>
                <span className="text-sm text-neutral-700">Front Desk</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Status</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Last transaction</span>
                <span className="text-sm text-neutral-700">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
          {/* Payment Methods */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="text-sm font-medium text-neutral-700 mb-4">Payment Methods</div>
            <Toggle label="Card Terminal (PIN, Maestro, Visa, MC)" enabled={terminalEnabled} onChange={setTerminalEnabled} />
            <Toggle label="iDEAL" enabled={idealEnabled} onChange={setIdealEnabled} />
            <Toggle label="Credit Card (online)" enabled={cardEnabled} onChange={setCardEnabled} />
            <Toggle label="Bank Transfer" enabled={bankTransferEnabled} onChange={setBankTransferEnabled} />
          </div>
          {/* Account Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 md:col-span-2">
            <div className="text-sm font-medium text-neutral-700 mb-4">Rumo Pay Account</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-neutral-500">Account ID</div><div className="text-sm font-mono text-neutral-700">RP-NL-00284</div></div>
              <div><div className="text-xs text-neutral-500">IBAN</div><div className="text-sm font-mono text-neutral-700">NL91 ABNA ****4589</div></div>
              <div><div className="text-xs text-neutral-500">Payout Schedule</div><div className="text-sm text-neutral-700">Weekly (Monday)</div></div>
              <div><div className="text-xs text-neutral-500">Fee Rate</div><div className="text-sm text-neutral-700">1.5% per transaction</div></div>
            </div>
          </div>
        </div>
      );
    };

    // ── Onboarding sub-tab ──
    const OnboardingSubTab = () => {
      const steps = [
        { label: 'Account created', done: true },
        { label: 'Bank account linked', done: true },
        { label: 'Terminal configured', done: true },
        { label: 'First payment processed', done: rumoPayPayments.length > 0 },
        { label: 'First payout received', done: rumoPayPayments.filter(p => p.status === 'completed').length > 5 },
      ];

      return (
        <div className="max-w-lg">
          <div className="mb-6">
            <div className="text-sm font-medium text-neutral-700">Rumo Pay Onboarding</div>
            <div className="text-xs text-neutral-400 mt-0.5">Setup status for your Rumo Pay integration</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                    {step.done ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <span className="text-xs font-medium text-neutral-500">{i + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm ${step.done ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100">
              <div className="text-xs text-neutral-400">{steps.filter(s => s.done).length} of {steps.length} steps completed</div>
              <div className="w-full bg-neutral-100 rounded-full h-2 mt-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(steps.filter(s => s.done).length / steps.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {subTabs.map(tab => (
            <button key={tab.id} onClick={() => setRumoSubTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                rumoSubTab === tab.id ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <DateRangePicker />

        {rumoSubTab === 'dashboard' && <DashboardSubTab />}
        {rumoSubTab === 'transactions' && <TransactionsSubTab />}
        {rumoSubTab === 'payouts' && <PayoutsSubTab />}
        {rumoSubTab === 'vccs' && <VCCSubTab />}
        {rumoSubTab === 'chargebacks' && <ChargebacksSubTab />}
        {rumoSubTab === 'settings' && <SettingsSubTab />}
        {rumoSubTab === 'onboarding' && <OnboardingSubTab />}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2: ALLE BETALINGEN
  // ═══════════════════════════════════════════════════════════════════════════

  const AlleBetalingenTab = () => {
    const sorted = sortPayments(filteredPayments);
    const totalAmount = filteredPayments.reduce((s, p) => s + p.amount, 0);

    return (
      <div>
        <DateRangePicker />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setFilterStatus(''); }}
            className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white">
            <option value="">All methods</option>
            {allMethods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white">
            <option value="">All statuses</option>
            {filterMethod === 'Bank Transfer' ? (
              <React.Fragment>
                <option value="bt-pending">Awaiting</option>
                <option value="bt-confirmed">Confirmed</option>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="request-sent">Request sent</option>
                <option value="bt-pending">Bank Transfer (awaiting)</option>
                <option value="bt-confirmed">Bank Transfer (confirmed)</option>
              </React.Fragment>
            )}
          </select>
          <div className="relative">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search guest, ref, note..."
              className="pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300 w-56" />
            <Icons.Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-neutral-400">{filteredPayments.length} payments &middot; &euro; {totalAmount.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</span>
            <button onClick={() => exportCSV(sorted, 'all-payments.csv')}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
              CSV
            </button>
            <button onClick={() => exportExcel(sorted, 'all-payments')}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors">
              Excel
            </button>
            <button onClick={() => exportPDF(sorted, 'All Payments')}
              className="px-3 py-1.5 text-xs font-medium bg-red-700 text-white rounded-lg hover:bg-red-600 transition-colors">
              PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead><tr className="text-xs text-neutral-500 border-b border-neutral-100">
              <th className="px-5 py-3 text-left font-medium cursor-pointer hover:text-neutral-900" onClick={() => toggleSort('date')}>Date<SortIcon field="date" /></th>
              <th className="px-5 py-3 text-left font-medium">Reservation</th>
              <th className="px-5 py-3 text-left font-medium cursor-pointer hover:text-neutral-900" onClick={() => toggleSort('guest')}>Guest<SortIcon field="guest" /></th>
              <th className="px-5 py-3 text-right font-medium cursor-pointer hover:text-neutral-900" onClick={() => toggleSort('amount')}>Amount<SortIcon field="amount" /></th>
              <th className="px-5 py-3 text-left font-medium cursor-pointer hover:text-neutral-900" onClick={() => toggleSort('method')}>Method<SortIcon field="method" /></th>
              <th className="px-5 py-3 text-center font-medium cursor-pointer hover:text-neutral-900" onClick={() => toggleSort('status')}>Status<SortIcon field="status" /></th>
              <th className="px-5 py-3 text-left font-medium">Note</th>
            </tr></thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={i} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-neutral-600">{new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => goToReservation(p.reservationId)} className="text-sm text-blue-600 hover:underline font-medium">{p.bookingRef}</button>
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-900">{p.guest}</td>
                  <td className="px-5 py-3 text-sm text-right font-medium text-neutral-900">&euro; {p.amount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-sm text-neutral-600">{p.method}</td>
                  <td className="px-5 py-3 text-center">
                    {p.method === 'Bank Transfer' && p.confirmed === false
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">awaiting</span>
                      : p.method === 'Bank Transfer' && p.confirmed === true
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">confirmed</span>
                      : <StatusBadge status={p.status} />}
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-400 max-w-[150px] truncate">{p.note}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan="7" className="px-5 py-8 text-center text-neutral-400 text-sm">No payments found matching your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3: KASSA
  // ═══════════════════════════════════════════════════════════════════════════

  const KassaTab = () => {
    const [kassaDateRange, setKassaDateRange] = React.useState('thisMonth');

    // Cash payments from reservations
    const cashPayments = filterByDate(allPayments).filter(p => p.method === 'Cash').map(p => ({
      id: 'res-' + p.reservationId + '-' + p.id,
      date: p.date,
      type: 'in',
      amount: p.amount,
      description: `Payment from ${p.guest}`,
      category: 'payment',
      source: p.bookingRef,
      reservationId: p.reservationId,
      isManual: false,
    }));

    // Manual kassa entries (from cashRegister)
    const manualEntries = globals.cashRegister.filter(e => {
      const d = new Date(e.date);
      return d >= rangeStart && d <= rangeEnd;
    }).map(e => ({
      ...e,
      source: 'Manual',
      isManual: true,
    }));

    // Combine and sort
    const allEntries = [...cashPayments, ...manualEntries].sort((a, b) => b.date.localeCompare(a.date));

    // Calculate balance
    const totalIn = allEntries.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0);
    const totalOut = allEntries.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0);
    const balance = totalIn - totalOut;

    // Full balance (all time, not just filtered)
    const allCashIn = allPayments.filter(p => p.method === 'Cash').reduce((s, p) => s + p.amount, 0) +
                      globals.cashRegister.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0);
    const allCashOut = globals.cashRegister.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0);
    const fullBalance = allCashIn - allCashOut;

    const categoryLabels = {
      payment: 'Payment',
      float: 'Float',
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
      expense: 'Expense',
      other: 'Other',
    };

    const addKassaEntry = () => {
      if (!kassaForm || !kassaForm.amount || kassaForm.amount <= 0) return;
      const entry = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: kassaForm.type || 'in',
        amount: parseFloat(kassaForm.amount),
        description: kassaForm.description || '',
        category: kassaForm.category || 'other',
        createdAt: Date.now(),
      };
      globals.cashRegister.push(entry);
      saveCashRegister();
      setKassaForm(null);
    };

    const deleteKassaEntry = (id) => {
      const idx = globals.cashRegister.findIndex(e => e.id === id);
      if (idx !== -1) {
        globals.cashRegister.splice(idx, 1);
        saveCashRegister();
        setKassaForm(kassaForm ? { ...kassaForm } : null); // force re-render
      }
    };

    return (
      <div>
        {/* Balance Banner */}
        <div className="mb-6 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-6 text-white shadow-2xl shadow-neutral-900/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05),transparent_60%)]" />
          <div className="relative">
            <div className="text-sm text-neutral-400 mb-1">Cash Balance</div>
            <div className="text-3xl font-bold mb-4">&euro; {fullBalance.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</div>
            <div className="flex gap-8">
              <div><div className="text-xs text-neutral-500">Period In</div><div className="text-lg font-semibold text-emerald-400">&euro; {totalIn.toFixed(2)}</div></div>
              <div><div className="text-xs text-neutral-500">Period Out</div><div className="text-lg font-semibold text-red-400">&euro; {totalOut.toFixed(2)}</div></div>
              <div><div className="text-xs text-neutral-500">Period Net</div><div className="text-lg font-semibold">&euro; {balance.toFixed(2)}</div></div>
            </div>
          </div>
        </div>

        <DateRangePicker />

        {/* Add Entry Button / Form */}
        {kassaForm ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-6">
            <div className="text-sm font-medium text-neutral-700 mb-4">New cash register entry</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Type</label>
                <select value={kassaForm.type || 'in'} onChange={e => setKassaForm({ ...kassaForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300">
                  <option value="in">Incoming (IN)</option>
                  <option value="out">Outgoing (OUT)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Amount</label>
                <input type="number" step="0.01" min="0" value={kassaForm.amount || ''} onChange={e => setKassaForm({ ...kassaForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Category</label>
                <select value={kassaForm.category || 'other'} onChange={e => setKassaForm({ ...kassaForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300">
                  <option value="float">Float</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="expense">Expense</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Description</label>
                <input type="text" value={kassaForm.description || ''} onChange={e => setKassaForm({ ...kassaForm, description: e.target.value })}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
              </div>
              <div className="flex gap-2">
                <button onClick={addKassaEntry}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
                  Add
                </button>
                <button onClick={() => setKassaForm(null)}
                  className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <button onClick={() => setKassaForm({ type: 'in', amount: '', category: 'other', description: '' })}
              className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
              Add cash entry
            </button>
          </div>
        )}

        {/* Entries Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-700">Cash Book</div>
            <span className="text-xs text-neutral-400">{allEntries.length} entries</span>
          </div>
          <table className="w-full min-w-[600px]">
            <thead><tr className="text-xs text-neutral-500 border-b border-neutral-100">
              <th className="px-5 py-3 text-left font-medium">Date</th>
              <th className="px-5 py-3 text-center font-medium">Type</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3 text-left font-medium">Description</th>
              <th className="px-5 py-3 text-left font-medium">Category</th>
              <th className="px-5 py-3 text-left font-medium">Source</th>
              <th className="px-5 py-3 text-center font-medium"></th>
            </tr></thead>
            <tbody>
              {allEntries.map((e, i) => (
                <tr key={e.id || i} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-neutral-600">{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {e.type === 'in' ? 'IN' : 'OUT'}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-sm text-right font-medium ${e.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {e.type === 'in' ? '+' : '-'} &euro; {e.amount.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-700 max-w-[200px] truncate">{e.description}</td>
                  <td className="px-5 py-3 text-sm text-neutral-500">{categoryLabels[e.category] || e.category}</td>
                  <td className="px-5 py-3">
                    {e.reservationId ? (
                      <button onClick={() => goToReservation(e.reservationId)} className="text-xs text-blue-600 hover:underline">{e.source}</button>
                    ) : (
                      <span className="text-xs text-neutral-400">{e.source}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {e.isManual && (
                      <button onClick={() => deleteKassaEntry(e.id)} className="text-neutral-300 hover:text-red-500 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {allEntries.length === 0 && (
                <tr><td colSpan="7" className="px-5 py-8 text-center text-neutral-400 text-sm">No cash register entries in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Sidebar ──
  const paymentsSidebar = (
    <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <nav className="cal-nav">
        {canAccessPage(globals.currentUser?.role, 'dashboard') && <a className="cal-nav-link" onClick={() => { setActivePage('dashboard'); setSelectedReservation(null); }}><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>}
        {canAccessPage(globals.currentUser?.role, 'channelmanager') && <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>}
        {canAccessPage(globals.currentUser?.role, 'profiles') && <a className={`cal-nav-link${activePage === 'profiles' ? ' active' : ''}`} onClick={() => { setActivePage('profiles'); setSelectedReservation(null); }}><Icons.Users width="18" height="18" /><span>Profiles</span></a>}
        <a className="cal-nav-link active"><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>
        {canAccessPage(globals.currentUser?.role, 'reports') && <a className={`cal-nav-link${activePage === 'reports' ? ' active' : ''}`} onClick={() => { setActivePage('reports'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>}
        {canAccessPage(globals.currentUser?.role, 'settings') && <a className={`cal-nav-link${activePage === 'settings' ? ' active' : ''}`} onClick={() => { setActivePage('settings'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></a>}
      </nav>
      <div className="cal-nav-user">
        <div className="relative">
          <button onClick={() => props.setUserMenuOpen(prev => !prev)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 hover:bg-neutral-100 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ backgroundColor: globals.currentUser?.color || '#6b7280' }}>
              {globals.currentUser?.name?.split(' ').map(n => n[0]).join('') || '?'}
            </div>
            {!sidebarCollapsed && <span className="text-xs text-neutral-600 truncate">{globals.currentUser?.name?.split(' ')[0]}</span>}
          </button>
          {props.userMenuOpen && (<>
            <div className="fixed inset-0 z-[49]" onClick={() => props.setUserMenuOpen(false)} />
            <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-[50]">
              <div className="px-3 py-2 border-b border-neutral-100">
                <div className="text-sm font-medium text-neutral-900">{globals.currentUser?.name}</div>
                <div className="text-[11px] text-neutral-400 capitalize">{globals.currentUser?.role}</div>
              </div>
              <button onClick={props.handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </>)}
        </div>
      </div>
      <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy; <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle ${cloudStatus === 'idle' ? 'bg-emerald-400' : cloudStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : cloudStatus === 'error' ? 'bg-red-400' : 'bg-neutral-300'}`} title={cloudStatus === 'idle' ? 'Cloud synced' : cloudStatus === 'syncing' ? 'Syncing...' : cloudStatus === 'error' ? 'Sync error' : 'Offline'} /><br/>All Rights Reserved</>)}</div>
    </aside>
  );

  // Main tabs
  const mainTabs = [
    { id: 'rumopay', label: 'Rumo Pay' },
    { id: 'allpayments', label: 'All Payments' },
    { id: 'kassa', label: 'Cash Register' },
  ];

  // ── Main Return ──
  return (
    <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
    {paymentsSidebar}
    <div className="p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="cal-title">
          <h2>Payments</h2>
          <p>Payment processing, transactions, and cash management</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-neutral-200">
        {mainTabs.map(tab => (
          <button key={tab.id} onClick={() => setPayTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              payTab === tab.id ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
            }`}>
            {tab.label}
            {payTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {payTab === 'rumopay' && <RumoPayTab />}
      {payTab === 'allpayments' && <AlleBetalingenTab />}
      {payTab === 'kassa' && <KassaTab />}
    </div>
    </div>
    </div>
  );
};

export default PaymentsView;
