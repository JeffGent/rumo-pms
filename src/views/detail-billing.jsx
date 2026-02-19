import React from 'react';
import globals from '../globals.js';
import { formatDate, toDateStr } from '../utils.js';
import { Icons } from '../icons.jsx';
import { getNextInvoiceNumber } from '../config.js';

// -- Detail: Billing Tab --
const DetailBillingTab = ({ dp }) => {
  const {
    ed, setEditingReservation, reservation, updateEd, addToActivityLog,
    setToastMessage, showCheckoutWarning, dragPaymentRef,
    billSelected, setBillSelected, billSplitMode, setBillSplitMode,
    billPaySelected, setBillPaySelected, billRecipientOverride, setBillRecipientOverride,
    billCustomLabels, setBillCustomLabels,
    amendingInvoice, setAmendingInvoice, amendRecipient, setAmendRecipient,
    billTransferMode, setBillTransferMode, billTransferSearch, setBillTransferSearch,
    billTransferTarget, setBillTransferTarget, billTransferSelected, setBillTransferSelected,
    searchTransferTargets, exitTransferMode, assignPaymentsToInvoice, executeTransfer,
    confirmBTPayment, setConfirmBTPayment, openInvoiceEmail,
    roomTotal, extrasTotal, totalAmount, paidAmount, outstandingAmount,
    setProfileSelectedProfile, setProfileEditingProfile,
    setProfileSourceReservation, setProfileSourceTab,
  } = dp;
            // Compute billable items from rooms + extras
            const nights = ed.rooms[0] ? ed.rooms[0].nightPrices.length : 0;
            const billableItems = [];
            ed.rooms.forEach((room, i) => {
              const amount = room.priceType === 'fixed' ? (room.fixedPrice || 0) : room.nightPrices.reduce((s, n) => s + (n.amount || 0), 0);
              const roomNights = room.nightPrices ? room.nightPrices.length : nights;
              const roomCi = room.checkin ? new Date(room.checkin) : reservation.checkin;
              const roomCo = room.checkout ? new Date(room.checkout) : reservation.checkout;
              const dateRange = roomCi && roomCo ? `${formatDate(roomCi)} → ${formatDate(roomCo)}` : '';
              billableItems.push({ key: `room-${i}`, type: 'room', roomNumber: room.roomNumber, label: `Room ${room.roomNumber}`, detail: `${room.roomType} · ${roomNights} night${roomNights !== 1 ? 's' : ''} · ${dateRange}`, amount, vatRate: globals.hotelSettings.defaultRoomVat });
            });
            (ed.extras || []).forEach(ex => {
              const amount = (ex.quantity || 0) * (ex.unitPrice || 0);
              if (amount > 0) billableItems.push({ key: `extra-${ex.id}`, type: 'extra', roomNumber: ex.room || null, label: ex.name, detail: `${ex.quantity} × EUR ${ex.unitPrice}${ex.room ? ` · Room ${ex.room}` : ''}`, amount, vatRate: ex.vatRate });
            });

            // Which items are on active (non-credited, non-proforma) invoices?
            const invoicedKeys = new Set();
            (ed.invoices || []).forEach(inv => {
              if (inv.status !== 'credited' && inv.type !== 'proforma' && inv.type !== 'credit' && inv.items) inv.items.forEach(item => invoicedKeys.add(item.key));
            });
            const uninvoicedItems = billableItems.filter(item => !invoicedKeys.has(item.key));

            // Selection logic: null = all selected
            const effectiveSelection = billSelected !== null
              ? billSelected.filter(k => uninvoicedItems.some(i => i.key === k))
              : uninvoicedItems.map(i => i.key);
            const selectedItems = uninvoicedItems.filter(i => effectiveSelection.includes(i.key));
            const selectedTotal = selectedItems.reduce((s, i) => s + i.amount, 0);
            const allSelected = effectiveSelection.length === uninvoicedItems.length && uninvoicedItems.length > 0;

            const activeInvoices = (ed.invoices || []).filter(inv => inv.type !== 'credit');
            const creditNotes = (ed.invoices || []).filter(inv => inv.type === 'credit');

            const toggleItem = (key) => {
              const newSel = effectiveSelection.includes(key) ? effectiveSelection.filter(k => k !== key) : [...effectiveSelection, key];
              setBillSelected(newSel);
            };
            const toggleAll = () => setBillSelected(allSelected ? [] : uninvoicedItems.map(i => i.key));

            const createInvoice = (type, quick, checkout) => {
              if (selectedItems.length === 0) return;
              const invNum = getNextInvoiceNumber(type === 'proforma' ? 'proforma' : 'invoice');
              const invoiceItems = selectedItems.map(i => ({ key: i.key, label: billCustomLabels[i.key] || i.label, detail: i.detail, amount: i.amount, vatRate: i.vatRate }));
              const next = JSON.parse(JSON.stringify(ed));
              // Link payments: skip for proformas (concept, no payment linking)
              const linkedPays = [];
              if (type !== 'proforma') {
                if (quick) {
                  next.payments.forEach(p => {
                    if (p.status === 'completed' && !p.linkedInvoice) { p.linkedInvoice = invNum; linkedPays.push(p.id); }
                  });
                } else {
                  billPaySelected.forEach(payId => {
                    const p = next.payments.find(pp => pp.id === payId);
                    if (p && !p.linkedInvoice) { p.linkedInvoice = invNum; linkedPays.push(payId); }
                  });
                }
              }
              // Build recipient: use override if set, else fall back to billingRecipient
              let recipient;
              if (billRecipientOverride) {
                const o = billRecipientOverride;
                recipient = o.type === 'company'
                  ? { name: o.name, vatNumber: o.vatNumber, peppolId: o.peppolId, address: o.address, zip: o.zip, city: o.city, country: o.country, email: o.email }
                  : { name: o.name || `${next.booker?.firstName || ''} ${next.booker?.lastName || ''}`.trim(), vatNumber: '', peppolId: '', address: o.address || '', zip: o.zip || '', city: o.city || '', country: o.country || '', email: o.email || next.booker?.email || '' };
              } else {
                const br = next.billingRecipient || {};
                recipient = br.type === 'company'
                  ? { name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email }
                  : { name: `${next.booker?.firstName || ''} ${next.booker?.lastName || ''}`.trim(), vatNumber: '', peppolId: '', address: br.address || '', zip: br.zip || '', city: br.city || '', country: br.country || '', email: next.booker?.email || '' };
              }
              const invoiceRef = (next.billingRecipient?.reference || '').trim();
              next.invoices.push({ id: Date.now(), number: invNum, date: toDateStr(new Date()), amount: selectedTotal, type, status: 'created', items: invoiceItems, linkedPayments: linkedPays, recipient, reference: invoiceRef || '' });
              next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `${type === 'proforma' ? 'Proforma' : 'Invoice'} ${invNum} created (EUR ${selectedTotal}, ${selectedItems.length} items)${linkedPays.length > 0 ? ` — ${linkedPays.length} payment(s) linked` : ''}`, user: globals.currentUser?.name || 'System' });
              // Optional: check out all rooms
              if (checkout) {
                (next.rooms || []).forEach(r => { r.status = 'checked-out'; });
                next.reservationStatus = 'checked-out';
                next.activityLog.push({ id: Date.now() + 2, timestamp: Date.now(), action: 'Checked out (via quick invoice)', user: globals.currentUser?.name || 'System' });
              }
              setEditingReservation(next);
              setBillSelected(null);
              setBillSplitMode(false);
              setBillPaySelected([]);
              setBillRecipientOverride(null);
              setBillCustomLabels({});
              setToastMessage(checkout ? `Invoice created & checked out` : `${type === 'proforma' ? 'Proforma' : 'Invoice'} created — EUR ${selectedTotal}`);
              if (checkout) showCheckoutWarning(next);
            };

            const previewInvoice = () => {
              const items = (billSplitMode ? selectedItems : uninvoicedItems);
              if (items.length === 0) return;
              const invoiceItems = items.map(i => ({ key: i.key, label: billCustomLabels[i.key] || i.label, detail: i.detail, amount: i.amount, vatRate: i.vatRate }));
              const total = items.reduce((s, i) => s + i.amount, 0);
              let recipient;
              if (billRecipientOverride) {
                const o = billRecipientOverride;
                recipient = o.type === 'company'
                  ? { name: o.name, vatNumber: o.vatNumber, peppolId: o.peppolId, address: o.address, zip: o.zip, city: o.city, country: o.country, email: o.email }
                  : { name: o.name || `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim(), vatNumber: '', address: o.address || '', zip: o.zip || '', city: o.city || '', country: o.country || '', email: o.email || ed.booker?.email || '' };
              } else {
                const br = ed.billingRecipient || {};
                recipient = br.type === 'company'
                  ? { name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email }
                  : { name: `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim(), vatNumber: '', address: br.address || '', zip: br.zip || '', city: br.city || '', country: br.country || '', email: ed.booker?.email || '' };
              }
              const virtualInv = { number: 'PREVIEW', date: toDateStr(new Date()), amount: total, type: 'proforma', status: 'preview', items: invoiceItems, linkedPayments: [], recipient, reference: (ed.billingRecipient?.reference || '').trim() };
              window._printInvoice(virtualInv, ed, []);
            };

            return (
            <div className="space-y-4">
              {/* Pricing Summary */}
              <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Total</span>
                    <span className="text-sm font-medium text-neutral-900">EUR {totalAmount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Paid</span>
                    <span className="text-sm font-medium text-emerald-600">EUR {paidAmount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">Outstanding</span>
                    <span className="text-sm font-medium text-amber-600">EUR {outstandingAmount}</span>
                  </div>
                  {totalAmount > 0 && (
                    <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (paidAmount / totalAmount) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: Invoicing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoices</div>
                    {uninvoicedItems.length === 0 && billableItems.length > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="text-xs">All invoiced</span>
                      </div>
                    )}
                  </div>
                  {/* Uninvoiced Items */}
                  {uninvoicedItems.length > 0 && (
                    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                      {!billSplitMode ? (
                        <>
                          {/* Compact mode — summary */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Uninvoiced</div>
                            <div className="flex items-center gap-3">
                              {uninvoicedItems.some(i => i.type === 'extra') && (
                                <button onClick={() => { setBillTransferMode(billTransferMode === 'items' ? null : 'items'); setBillTransferSelected([]); setBillTransferSearch(''); setBillTransferTarget(null); setBillSplitMode(false); setBillSelected(null); }}
                                  className={`text-xs transition-colors ${billTransferMode === 'items' ? 'text-violet-600 font-medium' : 'text-neutral-400 hover:text-neutral-900'}`}>
                                  Transfer
                                </button>
                              )}
                              <button onClick={() => { setBillSplitMode(true); setBillSelected([]); exitTransferMode(); }}
                                className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors">
                                Split items
                              </button>
                            </div>
                          </div>

                          {billTransferMode === 'items' ? (
                            <div className="space-y-3">
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {uninvoicedItems.filter(i => i.type === 'extra').map(item => {
                                  const extraId = parseInt(item.key.replace('extra-', ''));
                                  const isSelected = billTransferSelected.includes(extraId);
                                  return (
                                    <div key={item.key} onClick={() => setBillTransferSelected(prev => isSelected ? prev.filter(id => id !== extraId) : [...prev, extraId])}
                                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-violet-50 border border-violet-200' : 'bg-neutral-50 border border-transparent hover:bg-neutral-100'}`}>
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-neutral-300'}`}>
                                        {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-neutral-900">{item.label}</div>
                                        <div className="text-xs text-neutral-500">{item.detail}</div>
                                      </div>
                                      <div className="text-xs font-medium text-neutral-900 flex-shrink-0">EUR {item.amount}</div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="relative">
                                <input value={billTransferSearch} onChange={(e) => { setBillTransferSearch(e.target.value); setBillTransferTarget(null); }}
                                  placeholder="Search booking ref or guest..."
                                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                                {billTransferTarget && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                  </svg>
                                )}
                                {billTransferSearch.length >= 2 && !billTransferTarget && (() => {
                                  const results = searchTransferTargets(billTransferSearch);
                                  return results.length > 0 ? (
                                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                      {results.map(r => (
                                        <button key={r.id} onClick={() => { setBillTransferTarget(r); setBillTransferSearch(`${r.bookingRef} — ${r.guest}`); }}
                                          className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 flex items-center justify-between border-b border-neutral-50 last:border-0">
                                          <span className="font-medium text-neutral-900">{r.guest}</span>
                                          <span className="text-neutral-400">{r.bookingRef}</span>
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-xs text-neutral-400 text-center">No reservations found</div>
                                  );
                                })()}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={executeTransfer} disabled={!billTransferTarget || billTransferSelected.length === 0}
                                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${billTransferTarget && billTransferSelected.length > 0 ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
                                  Transfer {billTransferSelected.length} item{billTransferSelected.length !== 1 ? 's' : ''}
                                </button>
                                <button onClick={exitTransferMode}
                                  className="px-3 py-2 rounded-xl text-xs font-medium text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm text-neutral-700 mb-1">
                                {uninvoicedItems.filter(i => i.type === 'room').length > 0 && (
                                  <span>{uninvoicedItems.filter(i => i.type === 'room').length} room{uninvoicedItems.filter(i => i.type === 'room').length !== 1 ? 's' : ''}</span>
                                )}
                                {uninvoicedItems.filter(i => i.type === 'extra').length > 0 && (
                                  <span>{uninvoicedItems.filter(i => i.type === 'room').length > 0 ? ' · ' : ''}{uninvoicedItems.filter(i => i.type === 'extra').length} extra{uninvoicedItems.filter(i => i.type === 'extra').length !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                              <div className="text-lg font-light text-neutral-900 mb-3 font-serif">EUR {selectedTotal}</div>
                              <input value={ed.billingRecipient?.reference || ''} onChange={(e) => updateEd('billingRecipient.reference', e.target.value)}
                                placeholder="Reference (PO, cost center...)"
                                className="w-full px-3 py-1.5 mb-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="flex gap-2">
                                <button onClick={() => createInvoice('standard', true, true)}
                                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                                  Quick invoice and check-out
                                </button>
                                <button onClick={previewInvoice}
                                  className="px-3 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                                  Preview
                                </button>
                                <button onClick={() => createInvoice('proforma', true)}
                                  className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                                  Proforma
                                </button>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Split mode — individual items */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Select Items</div>
                            <div className="flex gap-2">
                              {uninvoicedItems.length > 1 && (
                                <button onClick={toggleAll} className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors">
                                  {allSelected ? 'Deselect all' : 'Select all'}
                                </button>
                              )}
                              <button onClick={() => { setBillSplitMode(false); setBillSelected(null); setBillCustomLabels({}); setBillRecipientOverride(null); }}
                                className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors">
                                Done
                              </button>
                            </div>
                          </div>
                          {/* Room quick-select chips */}
                          {ed.rooms.length > 1 && (() => {
                            const roomNumbers = ed.rooms.map(r => r.roomNumber);
                            return (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {roomNumbers.map(rn => {
                                  const roomKeys = uninvoicedItems.filter(i => i.roomNumber === rn).map(i => i.key);
                                  if (roomKeys.length === 0) return null;
                                  const allRoomSelected = roomKeys.every(k => effectiveSelection.includes(k));
                                  const someRoomSelected = !allRoomSelected && roomKeys.some(k => effectiveSelection.includes(k));
                                  return (
                                    <button key={rn} onClick={() => {
                                        if (allRoomSelected) {
                                          setBillSelected(effectiveSelection.filter(k => !roomKeys.includes(k)));
                                        } else {
                                          const merged = [...new Set([...effectiveSelection, ...roomKeys])];
                                          setBillSelected(merged);
                                        }
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                                        allRoomSelected ? 'bg-blue-600 border-blue-600 text-white' :
                                        someRoomSelected ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                        'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-400'
                                      }`}>
                                      {rn}
                                    </button>
                                  );
                                })}
                                {/* Unassigned extras chip */}
                                {(() => {
                                  const unassignedKeys = uninvoicedItems.filter(i => i.type === 'extra' && !i.roomNumber).map(i => i.key);
                                  if (unassignedKeys.length === 0) return null;
                                  const allUnassigned = unassignedKeys.every(k => effectiveSelection.includes(k));
                                  const someUnassigned = !allUnassigned && unassignedKeys.some(k => effectiveSelection.includes(k));
                                  return (
                                    <button onClick={() => {
                                        if (allUnassigned) setBillSelected(effectiveSelection.filter(k => !unassignedKeys.includes(k)));
                                        else setBillSelected([...new Set([...effectiveSelection, ...unassignedKeys])]);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                                        allUnassigned ? 'bg-blue-600 border-blue-600 text-white' :
                                        someUnassigned ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                        'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-400'
                                      }`}>
                                      General
                                    </button>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {[...uninvoicedItems].sort((a, b) => {
                              const aS = effectiveSelection.includes(a.key) ? 0 : 1;
                              const bS = effectiveSelection.includes(b.key) ? 0 : 1;
                              return aS - bS;
                            }).map(item => {
                              const customLabel = billCustomLabels[item.key];
                              const isEditing = customLabel !== undefined;
                              return (
                              <div key={item.key} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                                  effectiveSelection.includes(item.key) ? 'bg-blue-50 border border-blue-200' : 'bg-neutral-50 border border-transparent hover:bg-neutral-100'
                                }`}>
                                <div onClick={() => toggleItem(item.key)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                                  effectiveSelection.includes(item.key) ? 'bg-blue-600 border-blue-600' : 'border-neutral-300'
                                }`}>
                                  {effectiveSelection.includes(item.key) && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {isEditing ? (
                                    <input value={customLabel} onChange={(e) => setBillCustomLabels({ ...billCustomLabels, [item.key]: e.target.value })}
                                      onBlur={() => { if (customLabel === item.label || !customLabel.trim()) setBillCustomLabels(prev => { const n = { ...prev }; delete n[item.key]; return n; }); }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                      className="text-xs font-medium text-neutral-900 bg-transparent border-b border-neutral-300 focus:border-neutral-900 outline-none w-full py-0" autoFocus />
                                  ) : (
                                    <div className="text-xs font-medium text-neutral-900 cursor-text" onClick={() => setBillCustomLabels({ ...billCustomLabels, [item.key]: item.label })}>{item.label}</div>
                                  )}
                                  <div className="text-xs text-neutral-500 cursor-pointer" onClick={() => toggleItem(item.key)}>{item.detail}</div>
                                </div>
                                <div className="text-xs font-medium text-neutral-900 flex-shrink-0 cursor-pointer" onClick={() => toggleItem(item.key)}>EUR {item.amount}</div>
                              </div>
                              );
                            })}
                          </div>
                          {/* Recipient selector */}
                          {(() => {
                            const defaultBr = ed.billingRecipient || {};
                            const defaultLabel = defaultBr.type === 'company' ? defaultBr.name : `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim() || 'Booker';
                            const defaultIcon = defaultBr.type === 'company';
                            const isOverridden = !!billRecipientOverride;
                            const isOtherMode = isOverridden && billRecipientOverride._mode === 'other';
                            // Room main guests (first guest per room), excluding booker
                            const bookerName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim();
                            const roomGuests = (ed.rooms || []).map((room, ri) => {
                              const g = room.guests?.[0];
                              if (!g) return null;
                              const name = `${g.firstName || ''} ${g.lastName || ''}`.trim();
                              if (!name || name === bookerName) return null;
                              return { name, email: g.email || '', roomNumber: room.roomNumber, roomIndex: ri };
                            }).filter(Boolean);
                            // Other mode: search query + matches (companies + bookers)
                            const otherQuery = isOtherMode ? (billRecipientOverride._searchQuery || '') : '';
                            const companyMatches = otherQuery.length >= 1 ? globals.companyProfiles.filter(c =>
                              c.name.toLowerCase().includes(otherQuery.toLowerCase())
                            ).slice(0, 4) : [];
                            const bookerMatches = otherQuery.length >= 1 ? (() => {
                              const seen = new Set();
                              return globals.reservations.filter(r => {
                                const name = `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.trim();
                                if (!name || seen.has(name) || !name.toLowerCase().includes(otherQuery.toLowerCase())) return false;
                                seen.add(name);
                                return true;
                              }).slice(0, 3).map(r => ({ name: `${r.booker.firstName} ${r.booker.lastName}`.trim(), email: r.booker.email || '', phone: r.booker.phone || '' }));
                            })() : [];
                            const hasMatches = (companyMatches.length > 0 || bookerMatches.length > 0) && !billRecipientOverride.companyId && !billRecipientOverride._bookerId;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-100">
                                <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">Invoice to</div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* 1: Default recipient */}
                                  <button onClick={() => setBillRecipientOverride(null)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${!isOverridden ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                                    {defaultIcon ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    )}
                                    {defaultLabel}
                                  </button>
                                  {/* 2: Other (search company/individual) */}
                                  <button onClick={() => setBillRecipientOverride(isOtherMode ? null : { _mode: 'other', _searchQuery: '', type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '' })}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isOtherMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    Other
                                  </button>
                                  {/* 3: Room main guests (not booker) */}
                                  {roomGuests.map(rg => {
                                    const isActive = isOverridden && !isOtherMode && billRecipientOverride._guestRoom === rg.roomNumber;
                                    return (
                                      <button key={rg.roomNumber} onClick={() => setBillRecipientOverride({ _mode: 'guest', _guestRoom: rg.roomNumber, type: 'individual', companyId: null, name: rg.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: rg.email, phone: '' })}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        {rg.name}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Other mode: search + fields */}
                                {isOtherMode && (
                                  <div className="mt-2 space-y-1.5">
                                    <div className="relative">
                                      <input value={otherQuery} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, _searchQuery: e.target.value, name: e.target.value, companyId: null, _bookerId: null, type: 'individual' })}
                                        placeholder="Search company or person..."
                                        className="w-full px-2.5 py-1 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" autoFocus />
                                      {(billRecipientOverride.companyId || billRecipientOverride._bookerId) && (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                      )}
                                      {hasMatches && (
                                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                          {companyMatches.map(c => (
                                            <button key={`c-${c.id}`} onClick={() => setBillRecipientOverride({ _mode: 'other', _searchQuery: c.name, type: 'company', companyId: c.id, name: c.name, vatNumber: c.vatNumber, peppolId: c.peppolId, address: c.address, zip: c.zip, city: c.city, country: c.country, email: c.email, phone: c.phone })}
                                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                              <span className="flex items-center gap-1.5">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                                <span className="font-medium text-neutral-900">{c.name}</span>
                                              </span>
                                              <span className="text-neutral-400">{c.vatNumber}</span>
                                            </button>
                                          ))}
                                          {bookerMatches.map(b => (
                                            <button key={`b-${b.name}`} onClick={() => setBillRecipientOverride({ _mode: 'other', _searchQuery: b.name, _bookerId: b.name, type: 'individual', companyId: null, name: b.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: b.email, phone: b.phone })}
                                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                              <span className="flex items-center gap-1.5">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                <span className="font-medium text-neutral-900">{b.name}</span>
                                              </span>
                                              <span className="text-neutral-400">{b.email}</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* Show address fields for manual entry */}
                                    {!billRecipientOverride.companyId && !billRecipientOverride._bookerId && otherQuery && (
                                      <div className="space-y-1.5">
                                        <input value={billRecipientOverride.email} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, email: e.target.value })}
                                          placeholder="Email" className="w-full px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                        <input value={billRecipientOverride.address} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, address: e.target.value })}
                                          placeholder="Address" className="w-full px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                        <div className="grid grid-cols-3 gap-1.5">
                                          <input value={billRecipientOverride.zip} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, zip: e.target.value })}
                                            placeholder="Zip" className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                          <input value={billRecipientOverride.city} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, city: e.target.value })}
                                            placeholder="City" className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                          <input value={billRecipientOverride.country} onChange={(e) => setBillRecipientOverride({ ...billRecipientOverride, country: e.target.value })}
                                            placeholder="Country" className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="mt-3 pt-3 border-t border-neutral-100">
                            <input value={ed.billingRecipient?.reference || ''} onChange={(e) => updateEd('billingRecipient.reference', e.target.value)}
                              placeholder="Reference (PO, cost center...)"
                              className="w-full px-3 py-1.5 mb-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            <div className="flex gap-2">
                              <button onClick={() => createInvoice('standard')} disabled={selectedItems.length === 0}
                                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                  selectedItems.length > 0 ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                }`}>
                                Create Invoice · EUR {selectedTotal}
                              </button>
                              <button onClick={previewInvoice} disabled={selectedItems.length === 0}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                  selectedItems.length > 0 ? 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100' : 'text-neutral-300 cursor-not-allowed'
                                }`}>
                                Preview
                              </button>
                              <button onClick={() => createInvoice('proforma')} disabled={selectedItems.length === 0}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                  selectedItems.length > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                }`}>
                                Proforma
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Existing Invoices */}
                  {activeInvoices.map(inv => {
                    const invPayments = ed.payments.filter(p => p.linkedInvoice === inv.number);
                    const invPaid = invPayments.reduce((s, p) => s + p.amount, 0);
                    return (
                      <div key={inv.id}
                        onDragOver={inv.status !== 'credited' && inv.status !== 'finalized' ? (e) => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 0 0 2px #3b82f6'; } : undefined}
                        onDragLeave={inv.status !== 'credited' && inv.status !== 'finalized' ? (e) => { e.currentTarget.style.boxShadow = ''; } : undefined}
                        onDrop={inv.status !== 'credited' && inv.status !== 'finalized' ? (e) => {
                          e.preventDefault();
                          e.currentTarget.style.boxShadow = '';
                          const payId = dragPaymentRef.current;
                          if (!payId) return;
                          dragPaymentRef.current = null;
                          const next = JSON.parse(JSON.stringify(ed));
                          const p = next.payments.find(pp => pp.id === payId);
                          if (p && p.linkedInvoice !== inv.number) {
                            // Unlink from old invoice if reassigning
                            if (p.linkedInvoice) {
                              const oldInv = next.invoices.find(ii => ii.number === p.linkedInvoice);
                              if (oldInv && oldInv.linkedPayments) oldInv.linkedPayments = oldInv.linkedPayments.filter(id => id !== payId);
                            }
                            p.linkedInvoice = inv.number;
                            const invObj = next.invoices.find(ii => ii.id === inv.id);
                            if (invObj) { if (!invObj.linkedPayments) invObj.linkedPayments = []; invObj.linkedPayments.push(payId); }
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `EUR ${p.amount} linked to ${inv.number}`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setToastMessage(`EUR ${p.amount} linked to ${inv.number}`);
                          }
                        } : undefined}
                        className={`bg-white border rounded-2xl overflow-hidden transition-shadow ${inv.status === 'credited' || inv.status === 'finalized' ? 'border-neutral-200 opacity-60' : inv.type === 'proforma' ? 'border-amber-200' : 'border-neutral-200'}`}>
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${inv.type === 'proforma' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {inv.type === 'proforma' ? 'PRO' : 'INV'}
                            </span>
                            <span className="text-xs font-medium text-neutral-900">{inv.number}</span>
                            {inv.status === 'credited' && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Credited</span>}
                            {inv.status === 'finalized' && <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Finalized</span>}
                            {inv.amendsInvoice && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Amends {inv.amendsInvoice}</span>}
                            {inv.fromProforma && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">From {inv.fromProforma}</span>}
                          </div>
                          <div className="text-xs text-neutral-500">{inv.date}</div>
                        </div>
                        {/* Recipient */}
                        {inv.recipient && inv.recipient.name && (
                          <div className="px-4 py-1.5 border-t border-neutral-50 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              {inv.recipient.vatNumber ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 flex-shrink-0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 flex-shrink-0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              )}
                              <span>{inv.recipient.name}</span>
                              {inv.recipient.vatNumber && <span className="text-neutral-400">· {inv.recipient.vatNumber}</span>}
                            </div>
                          </div>
                        )}
                        {/* Items */}
                        {inv.items && inv.items.length > 0 && (
                          <div className="px-4 py-2 border-t border-neutral-50 space-y-0.5">
                            {inv.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs py-0.5">
                                <div>
                                  <span className="text-neutral-700">{item.label}</span>
                                  {item.detail && <span className="text-neutral-400 ml-1.5">{item.detail}</span>}
                                </div>
                                <span className="text-neutral-900 font-medium flex-shrink-0 ml-3">EUR {item.amount}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Total + linked payments */}
                        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100">
                          <div className="flex justify-between text-xs font-medium">
                            <span>Total</span>
                            <span>EUR {inv.amount}</span>
                          </div>
                          {invPayments.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {invPayments.map(p => (
                                <div key={p.id} className={`flex justify-between text-xs ${p.method === 'Bank Transfer' && p.confirmed === false ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  <span>{p.method === 'Bank Transfer' && p.confirmed === false ? 'Expected: Bank Transfer' : p.method} · {p.date}</span>
                                  <span>EUR {p.amount}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {inv.status !== 'credited' && invPaid < inv.amount && (
                            <div className="flex justify-between text-xs text-amber-600 font-medium mt-1 pt-1 border-t border-neutral-200">
                              <span>Due</span>
                              <span>EUR {inv.amount - invPaid}</span>
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="px-4 py-2 flex flex-wrap gap-1 border-t border-neutral-100">
                          <button onClick={() => window._printInvoice(inv, ed, ed.payments)}
                            className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs hover:bg-neutral-200 transition-colors">Print</button>
                          {/* Email invoice */}
                          <button onClick={() => openInvoiceEmail(inv)}
                            className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs hover:bg-neutral-200 transition-colors">Email</button>
                          {/* Peppol — only for real company invoices (not proformas) */}
                          {inv.type !== 'proforma' && inv.recipient?.vatNumber && (() => {
                            const ps = inv.peppolStatus;
                            const hasPeppol = !!inv.recipient?.peppolId;
                            const psClass = ps === 'delivered' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : ps === 'error' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200';
                            const psTitle = ps === 'delivered' ? 'Delivered via Peppol'
                              : ps === 'error' ? `Peppol delivery failed\n\nRecipient ${inv.recipient?.peppolId || '—'} could not be reached.\nThe access point did not respond or rejected the document.\n\nRetry or verify the Peppol ID.`
                              : hasPeppol ? `Send via Peppol to ${inv.recipient.peppolId}` : 'No Peppol ID — edit recipient to add one';
                            return (
                              <button onClick={() => {
                                if (ps === 'delivered') return;
                                if (!hasPeppol) { setToastMessage('No Peppol ID — edit recipient to add one'); return; }
                                const next = JSON.parse(JSON.stringify(ed));
                                const invObj = next.invoices.find(ii => ii.id === inv.id);
                                const newStatus = Math.random() < 0.7 ? 'delivered' : 'error';
                                if (invObj) invObj.peppolStatus = newStatus;
                                next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `${inv.number} sent via Peppol — ${newStatus === 'delivered' ? 'delivered' : 'delivery failed'}`, user: globals.currentUser?.name || 'System' });
                                setEditingReservation(next);
                                setToastMessage(newStatus === 'delivered' ? `Delivered via Peppol to ${inv.recipient.peppolId}` : 'Peppol delivery failed — recipient unreachable');
                              }}
                                title={psTitle}
                                className={`px-2 py-1 rounded text-xs transition-colors ${psClass}`}>
                                Peppol
                              </button>
                            );
                          })()}
                          {/* Proforma actions: Finalize + Delete */}
                          {inv.type === 'proforma' && inv.status !== 'credited' && inv.status !== 'finalized' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const invObj = next.invoices.find(ii => ii.id === inv.id);
                              if (!invObj) return;
                              // Archive the proforma
                              invObj.status = 'finalized';
                              // Create a real invoice with the same items + recipient
                              const newInvNum = getNextInvoiceNumber('invoice');
                              next.invoices.push({ id: Date.now(), number: newInvNum, date: toDateStr(new Date()), amount: inv.amount, type: 'invoice', status: 'created', items: inv.items ? inv.items.map(i => ({ ...i })) : [], linkedPayments: [], recipient: inv.recipient ? { ...inv.recipient } : null, reference: inv.reference || '', fromProforma: inv.number });
                              // Unlink any payments from the proforma (user links them manually to the new invoice)
                              invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                              next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Proforma ${inv.number} finalized → invoice ${newInvNum}`, user: globals.currentUser?.name || 'System' });
                              setEditingReservation(next);
                              setBillSelected(null);
                              setToastMessage(`Proforma finalized — invoice ${newInvNum} created`);
                            }}
                              className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs hover:bg-emerald-100 transition-colors">Finalize</button>
                          )}
                          {inv.type === 'proforma' && inv.status !== 'credited' && inv.status !== 'finalized' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.invoices = next.invoices.filter(ii => ii.id !== inv.id);
                              // Unlink any payments linked to this proforma
                              invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Proforma ${inv.number} deleted`, user: globals.currentUser?.name || 'System' });
                              setEditingReservation(next);
                              setBillSelected(null);
                              setToastMessage(`Proforma ${inv.number} deleted`);
                            }}
                              className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition-colors">Delete</button>
                          )}
                          {/* Invoice actions: Credit + Amend (not for proformas) */}
                          {inv.type !== 'proforma' && inv.status !== 'credited' && (
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const invObj = next.invoices.find(ii => ii.id === inv.id);
                              if (invObj) invObj.status = 'credited';
                              const creditNum = getNextInvoiceNumber('credit');
                              next.invoices.push({ id: Date.now(), number: creditNum, date: toDateStr(new Date()), amount: inv.amount, type: 'credit', status: 'created', items: inv.items || [], linkedPayments: [], creditFor: inv.number, recipient: inv.recipient ? { ...inv.recipient } : null, reference: inv.reference || '' });
                              // Unlink payments from credited invoice — return to unlinked pool
                              invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                              if (invObj) invObj.linkedPayments = [];
                              next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Credit note ${creditNum} for ${inv.number} — items released`, user: globals.currentUser?.name || 'System' });
                              setEditingReservation(next);
                              setBillSelected(null);
                              setToastMessage('Credit note created — items available for re-invoicing');
                            }}
                              className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition-colors">Credit</button>
                          )}
                          {inv.type !== 'proforma' && inv.status !== 'credited' && (
                            <button onClick={() => { setAmendingInvoice(amendingInvoice === inv.id ? null : inv.id); setAmendRecipient(null); }}
                              className={`px-2 py-1 rounded text-xs transition-colors ${amendingInvoice === inv.id ? 'bg-amber-200 text-amber-800' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>Amend</button>
                          )}
                        </div>
                        {/* Amend panel: recipient picker */}
                        {amendingInvoice === inv.id && (() => {
                          const currentRcpt = inv.recipient || {};
                          const defaultBr = ed.billingRecipient || {};
                          const defaultLabel = defaultBr.type === 'company' ? defaultBr.name : `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim() || 'Booker';
                          const defaultIcon = defaultBr.type === 'company';
                          const isOriginal = !amendRecipient;
                          const isOtherMode = amendRecipient && amendRecipient._mode === 'other';
                          const bookerName = `${ed.booker?.firstName || ''} ${ed.booker?.lastName || ''}`.trim();
                          const roomGuests = (ed.rooms || []).map((room, ri) => {
                            const g = room.guests?.[0];
                            if (!g) return null;
                            const name = `${g.firstName || ''} ${g.lastName || ''}`.trim();
                            if (!name || name === bookerName) return null;
                            return { name, email: g.email || '', roomNumber: room.roomNumber, roomIndex: ri };
                          }).filter(Boolean);
                          const otherQuery = isOtherMode ? (amendRecipient._searchQuery || '') : '';
                          const companyMatches = otherQuery.length >= 1 ? globals.companyProfiles.filter(c => c.name.toLowerCase().includes(otherQuery.toLowerCase())).slice(0, 4) : [];
                          const bookerMatches = otherQuery.length >= 1 ? (() => {
                            const seen = new Set();
                            return globals.reservations.filter(r => {
                              const name = `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.trim();
                              if (!name || seen.has(name) || !name.toLowerCase().includes(otherQuery.toLowerCase())) return false;
                              seen.add(name); return true;
                            }).slice(0, 3).map(r => ({ name: `${r.booker.firstName} ${r.booker.lastName}`.trim(), email: r.booker.email || '', phone: r.booker.phone || '' }));
                          })() : [];
                          const hasMatches = (companyMatches.length > 0 || bookerMatches.length > 0) && amendRecipient && !amendRecipient.companyId && !amendRecipient._bookerId;

                          const doAmend = () => {
                            const next = JSON.parse(JSON.stringify(ed));
                            const invObj = next.invoices.find(ii => ii.id === inv.id);
                            if (!invObj) return;
                            // 1. Credit the original
                            invObj.status = 'credited';
                            const creditNum = getNextInvoiceNumber('credit');
                            next.invoices.push({ id: Date.now(), number: creditNum, date: toDateStr(new Date()), amount: inv.amount, type: 'credit', status: 'created', items: inv.items || [], linkedPayments: [], creditFor: inv.number, recipient: inv.recipient ? { ...inv.recipient } : null, reference: inv.reference || '' });
                            // Unlink payments from credited invoice
                            invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = null; });
                            // 2. Build new recipient
                            let newRecipient;
                            if (amendRecipient) {
                              const o = amendRecipient;
                              newRecipient = o.type === 'company'
                                ? { name: o.name, vatNumber: o.vatNumber, peppolId: o.peppolId, address: o.address, zip: o.zip, city: o.city, country: o.country, email: o.email }
                                : { name: o.name || bookerName, vatNumber: '', peppolId: '', address: o.address || '', zip: o.zip || '', city: o.city || '', country: o.country || '', email: o.email || '' };
                            } else {
                              newRecipient = inv.recipient ? { ...inv.recipient } : null;
                            }
                            // 3. Create amended invoice with same items
                            const newInvNum = getNextInvoiceNumber('invoice');
                            next.invoices.push({ id: Date.now() + 2, number: newInvNum, date: toDateStr(new Date()), amount: inv.amount, type: 'invoice', status: 'created', items: inv.items ? inv.items.map(i => ({ ...i })) : [], linkedPayments: [], recipient: newRecipient, reference: inv.reference || '', amendsInvoice: inv.number });
                            // Re-link payments to new invoice
                            invPayments.forEach(p => { const pp = next.payments.find(pp => pp.id === p.id); if (pp) pp.linkedInvoice = newInvNum; });
                            next.activityLog.push({ id: Date.now() + 3, timestamp: Date.now(), action: `Amended ${inv.number} → credit note ${creditNum} + new invoice ${newInvNum}${amendRecipient ? ` (recipient: ${newRecipient?.name || 'unknown'})` : ''}`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setAmendingInvoice(null);
                            setAmendRecipient(null);
                            setBillSelected(null);
                            setToastMessage(`Invoice amended — ${creditNum} + ${newInvNum} created`);
                          };

                          return (
                            <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                              <div className="text-xs font-medium text-amber-700 mb-2">Amend {inv.number} — select new recipient</div>
                              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                {/* Keep original */}
                                <button onClick={() => setAmendRecipient(null)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isOriginal ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                  {currentRcpt.vatNumber ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                  ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                  )}
                                  {currentRcpt.name || 'Original'}
                                </button>
                                {/* Default billing recipient (if different) */}
                                {defaultLabel !== currentRcpt.name && (
                                  <button onClick={() => {
                                    const br = ed.billingRecipient || {};
                                    setAmendRecipient(br.type === 'company'
                                      ? { _mode: 'default', type: 'company', companyId: br.companyId, name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email, phone: br.phone }
                                      : { _mode: 'default', type: 'individual', companyId: null, name: bookerName, vatNumber: '', peppolId: '', address: br.address || '', zip: br.zip || '', city: br.city || '', country: br.country || '', email: ed.booker?.email || '', phone: '' });
                                  }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${amendRecipient?._mode === 'default' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                    {defaultIcon ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    )}
                                    {defaultLabel}
                                  </button>
                                )}
                                {/* Other (search) */}
                                <button onClick={() => setAmendRecipient(isOtherMode ? null : { _mode: 'other', _searchQuery: '', type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '' })}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isOtherMode ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                  Other
                                </button>
                                {/* Room guests */}
                                {roomGuests.map(rg => {
                                  const isActive = amendRecipient && amendRecipient._mode === 'guest' && amendRecipient._guestRoom === rg.roomNumber;
                                  return (
                                    <button key={rg.roomNumber} onClick={() => setAmendRecipient({ _mode: 'guest', _guestRoom: rg.roomNumber, type: 'individual', companyId: null, name: rg.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: rg.email, phone: '' })}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'}`}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                      {rg.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Other mode: search + fields */}
                              {isOtherMode && (
                                <div className="space-y-1.5 mb-2">
                                  <div className="relative">
                                    <input value={otherQuery} onChange={(e) => setAmendRecipient({ ...amendRecipient, _searchQuery: e.target.value, name: e.target.value, companyId: null, _bookerId: null, type: 'individual' })}
                                      placeholder="Search company or person..."
                                      className="w-full px-2.5 py-1 pr-7 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" autoFocus />
                                    {(amendRecipient.companyId || amendRecipient._bookerId) && (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    )}
                                    {hasMatches && (
                                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                        {companyMatches.map(c => (
                                          <button key={`c-${c.id}`} onClick={() => setAmendRecipient({ _mode: 'other', _searchQuery: c.name, type: 'company', companyId: c.id, name: c.name, vatNumber: c.vatNumber, peppolId: c.peppolId, address: c.address, zip: c.zip, city: c.city, country: c.country, email: c.email, phone: c.phone })}
                                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                                              <span className="font-medium text-neutral-900">{c.name}</span>
                                            </span>
                                            <span className="text-neutral-400">{c.vatNumber}</span>
                                          </button>
                                        ))}
                                        {bookerMatches.map(b => (
                                          <button key={`b-${b.name}`} onClick={() => setAmendRecipient({ _mode: 'other', _searchQuery: b.name, _bookerId: b.name, type: 'individual', companyId: null, name: b.name, vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: b.email, phone: b.phone })}
                                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                              <span className="font-medium text-neutral-900">{b.name}</span>
                                            </span>
                                            <span className="text-neutral-400">{b.email}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {!amendRecipient.companyId && !amendRecipient._bookerId && otherQuery && (
                                    <div className="space-y-1.5">
                                      <input value={amendRecipient.email} onChange={(e) => setAmendRecipient({ ...amendRecipient, email: e.target.value })}
                                        placeholder="Email" className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                      <input value={amendRecipient.address} onChange={(e) => setAmendRecipient({ ...amendRecipient, address: e.target.value })}
                                        placeholder="Address" className="w-full px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                      <div className="grid grid-cols-3 gap-1.5">
                                        <input value={amendRecipient.zip} onChange={(e) => setAmendRecipient({ ...amendRecipient, zip: e.target.value })}
                                          placeholder="Zip" className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                        <input value={amendRecipient.city} onChange={(e) => setAmendRecipient({ ...amendRecipient, city: e.target.value })}
                                          placeholder="City" className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                        <input value={amendRecipient.country} onChange={(e) => setAmendRecipient({ ...amendRecipient, country: e.target.value })}
                                          placeholder="Country" className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button onClick={doAmend}
                                  className="flex-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
                                  {isOriginal ? 'Amend (keep recipient)' : `Amend → ${amendRecipient?.name || 'new recipient'}`}
                                </button>
                                <button onClick={() => { setAmendingInvoice(null); setAmendRecipient(null); }}
                                  className="px-3 py-1.5 bg-white text-neutral-500 rounded-lg text-xs font-medium hover:bg-neutral-100 border border-neutral-200 transition-colors">Cancel</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}

                  {/* Credit Notes */}
                  {creditNotes.length > 0 && creditNotes.map(cn => (
                    <div key={cn.id} className="bg-red-50 border border-red-200 rounded-2xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-neutral-900 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">CN</span>
                            {cn.number}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">EUR {cn.amount} · {cn.date} · Credits {cn.creditFor}</div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => window._printInvoice(cn, ed, ed.payments)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">Print</button>
                          <button onClick={() => { addToActivityLog(`${cn.number} emailed to ${cn.recipient?.email || 'booker'}`); setToastMessage(`${cn.number} emailed to ${cn.recipient?.email || 'booker'}`); }}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">Email</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* RIGHT: Payments */}
                <div className="space-y-4 md:sticky md:top-4 md:self-start">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Payments</div>
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                {/* Payments List */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {ed.payments.length} payment{ed.payments.length !== 1 ? 's' : ''}
                    </div>
                    {ed.payments.length > 0 && (
                      <button onClick={() => { if (billTransferMode === 'payments') { exitTransferMode(); } else { setBillTransferMode('payments'); setBillTransferSelected([]); setBillTransferSearch(''); setBillTransferTarget(null); setBillSplitMode(false); setBillSelected(null); } }}
                        className={`text-xs transition-colors ${billTransferMode === 'payments' ? 'text-violet-600 font-medium' : 'text-neutral-400 hover:text-neutral-900'}`}>
                        {billTransferMode === 'payments' ? 'Cancel' : 'Transfer'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {ed.payments.map((payment) => {
                      const isTransferMode = billTransferMode === 'payments';
                      const isTransferChecked = isTransferMode && billTransferSelected.includes(payment.id);
                      const canLink = payment.status === 'completed' && !payment.linkedInvoice;
                      const canReassign = payment.status === 'completed' && payment.linkedInvoice && activeInvoices.filter(inv => inv.status !== 'credited' && inv.number !== payment.linkedInvoice).length > 0;
                      const canDrag = (canLink || canReassign) && activeInvoices.some(inv => inv.status !== 'credited') && !isTransferMode;
                      const canCheck = canLink && billSplitMode && uninvoicedItems.length > 0 && !isTransferMode;
                      const isPayChecked = billPaySelected.includes(payment.id);
                      return (
                      <div key={payment.id}
                        draggable={(canDrag || canReassign) && !canCheck && !isTransferMode}
                        onDragStart={(canDrag || canReassign) && !canCheck && !isTransferMode ? (e) => { dragPaymentRef.current = payment.id; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.style.opacity = '0.5'; } : undefined}
                        onDragEnd={(canDrag || canReassign) && !canCheck && !isTransferMode ? (e) => { dragPaymentRef.current = null; e.currentTarget.style.opacity = '1'; } : undefined}
                        onClick={isTransferMode ? () => setBillTransferSelected(prev => prev.includes(payment.id) ? prev.filter(id => id !== payment.id) : [...prev, payment.id]) : canCheck ? () => setBillPaySelected(prev => prev.includes(payment.id) ? prev.filter(id => id !== payment.id) : [...prev, payment.id]) : undefined}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                        isTransferChecked ? 'bg-violet-50 border border-violet-200' :
                        payment.status === 'pending' ? 'bg-amber-50 border border-amber-200' :
                        payment.status === 'request-sent' ? 'bg-blue-50 border border-blue-200' :
                        isPayChecked ? 'bg-emerald-50 border border-emerald-200' : 'bg-white'
                      } ${isTransferMode || canCheck ? 'cursor-pointer' : (canDrag || canReassign) ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                        <div className="flex items-center gap-3">
                          {isTransferMode ? (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isTransferChecked ? 'bg-violet-600 border-violet-600' : 'border-neutral-300'
                            }`}>
                              {isTransferChecked && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                          ) : canCheck ? (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isPayChecked ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-300'
                            }`}>
                              {isPayChecked && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                          ) : (canDrag || canReassign) ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-neutral-400 flex-shrink-0"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                          ) : null}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            payment.status === 'pending' ? 'bg-amber-100' :
                            payment.status === 'request-sent' ? 'bg-blue-100' : 'bg-emerald-50'
                          }`}>
                            {payment.status === 'pending' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ) : payment.status === 'request-sent' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            ) : (
                              <Icons.CreditCard className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-neutral-900">
                              {payment.method}
                              {payment.method === 'Bank Transfer' && payment.confirmed === false && <span className="ml-1 text-amber-600">(awaiting)</span>}
                              {payment.method === 'Bank Transfer' && payment.confirmed === true && <span className="ml-1 text-emerald-600">(confirmed)</span>}
                              {payment.status === 'pending' && payment.method !== 'Bank Transfer' && <span className="ml-1 text-amber-600">(pending)</span>}
                              {payment.status === 'request-sent' && <span className="ml-1 text-blue-600">(request sent)</span>}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {payment.date}{payment.note ? ` — ${payment.note}` : ''}
                              {payment.linkedInvoice && <span className="ml-1 text-blue-600">({payment.linkedInvoice})</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-xs font-medium ${
                            payment.status === 'pending' ? 'text-amber-700' :
                            payment.status === 'request-sent' ? 'text-blue-700' : 'text-emerald-700'
                          }`}>
                            {payment.status === 'pending' || payment.status === 'request-sent' ? '' : '+ '}EUR {payment.amount}
                          </div>
                          {payment.method === 'Bank Transfer' && payment.confirmed === false && (
                            <button onClick={() => setConfirmBTPayment(payment.id)}
                              className="px-2 py-0.5 text-[10px] font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors" title="Confirm bank transfer received">
                              Confirm
                            </button>
                          )}
                          {payment.status === 'pending' && payment.method !== 'Bank Transfer' && (() => {
                            const confirmWithCard = (cardType) => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const p = next.payments.find(pp => pp.id === payment.id);
                              if (p) { p.status = 'completed'; p.method = cardType ? `${cardType} (Terminal)` : 'Card (Terminal)'; }
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Terminal payment EUR ${payment.amount} confirmed — ${cardType || 'Card'}`, user: globals.currentUser?.name || 'System' });
                              setEditingReservation(next);
                              setToastMessage(`Payment confirmed — ${cardType || 'Card'}`);
                            };
                            return (
                              <div className="flex items-center gap-1">
                                {['Bancontact', 'Maestro', 'Visa', 'MC', 'Amex'].map(ct => (
                                  <button key={ct} onClick={() => confirmWithCard(ct === 'MC' ? 'Mastercard' : ct)}
                                    className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors" title={ct === 'MC' ? 'Mastercard' : ct}>
                                    {ct}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          <button onClick={() => {
                            const next = JSON.parse(JSON.stringify(ed));
                            next.payments = next.payments.filter(pp => pp.id !== payment.id);
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Payment deleted: EUR ${payment.amount} (${payment.method})`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setToastMessage('Payment deleted');
                          }}
                            className="w-5 h-5 rounded hover:bg-red-100 flex items-center justify-center transition-colors" title="Delete payment">
                            <Icons.X className="w-3 h-3 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                    {ed.payments.length === 0 && (
                      <div className="text-xs text-neutral-400 text-center py-3">No payments yet</div>
                    )}
                  </div>
                </div>

                {/* Bank Transfer Confirm Popup */}
                {confirmBTPayment && (() => {
                  const btPay = ed.payments.find(p => p.id === confirmBTPayment);
                  if (!btPay) return null;
                  return (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmBTPayment(null)}>
                      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-5" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Confirm Bank Transfer</h3>
                        <p className="text-xs text-neutral-500 mb-4">EUR {btPay.amount.toFixed(2)} — when was this payment received?</p>
                        <div className="mb-4">
                          <label className="block text-xs text-neutral-500 mb-1">Date received</label>
                          <input type="date" id="btConfirmDate" defaultValue={toDateStr(new Date())}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmBTPayment(null)}
                            className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                            Cancel
                          </button>
                          <button onClick={() => {
                            const confirmDate = document.getElementById('btConfirmDate').value || toDateStr(new Date());
                            const next = JSON.parse(JSON.stringify(ed));
                            const p = next.payments.find(pp => pp.id === confirmBTPayment);
                            if (p) {
                              p.status = 'completed';
                              p.confirmed = true;
                              p.confirmedDate = confirmDate;
                              p.note = `Bank transfer confirmed (${confirmDate})`;
                            }
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Bank transfer EUR ${btPay.amount.toFixed(2)} confirmed — received ${confirmDate}`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setConfirmBTPayment(null);
                            setToastMessage('Bank transfer confirmed');
                          }}
                            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
                            Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Transfer Payment Panel — combined: assign to invoice OR move to reservation */}
                {billTransferMode === 'payments' && billTransferSelected.length > 0 && (
                  <div className="p-4 border-t border-neutral-100 space-y-4">
                    {/* Section 1: Assign to invoice */}
                    {(() => {
                      const linkableInvoices = activeInvoices.filter(inv => inv.status !== 'credited' && inv.status !== 'finalized');
                      return linkableInvoices.length > 0 ? (
                        <div>
                          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Assign to invoice</div>
                          <div className="space-y-1.5">
                            {linkableInvoices.map(inv => {
                              const invPaid = ed.payments.filter(p => p.linkedInvoice === inv.number).reduce((s, p) => s + p.amount, 0);
                              const allAlreadyLinked = billTransferSelected.every(payId => {
                                const p = ed.payments.find(pp => pp.id === payId);
                                return p && p.linkedInvoice === inv.number;
                              });
                              return allAlreadyLinked ? (
                                <div key={inv.id}
                                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-left opacity-70">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${inv.type === 'proforma' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {inv.type === 'proforma' ? 'PRO' : 'INV'}
                                    </span>
                                    <span className="text-xs font-medium text-neutral-900">{inv.number}</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-emerald-600"><path d="M20 6L9 17l-5-5"/></svg>
                                    <span className="text-xs text-emerald-600">linked</span>
                                  </div>
                                  <span className="text-xs text-neutral-400">&euro; {invPaid.toFixed(2)} / {inv.amount.toFixed(2)}</span>
                                </div>
                              ) : (
                                <button key={inv.id} onClick={() => assignPaymentsToInvoice(inv)}
                                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-50 hover:bg-blue-50 hover:border-blue-200 border border-neutral-200 transition-all text-left group">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${inv.type === 'proforma' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {inv.type === 'proforma' ? 'PRO' : 'INV'}
                                    </span>
                                    <span className="text-xs font-medium text-neutral-900">{inv.number}</span>
                                  </div>
                                  <span className="text-xs text-neutral-400 group-hover:text-blue-600">&euro; {invPaid.toFixed(2)} / {inv.amount.toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Divider */}
                    {activeInvoices.some(inv => inv.status !== 'credited' && inv.status !== 'finalized') && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-neutral-200" />
                        <span className="text-xs text-neutral-400">or</span>
                        <div className="flex-1 h-px bg-neutral-200" />
                      </div>
                    )}

                    {/* Section 2: Move to another reservation */}
                    {(() => {
                      const movableCount = billTransferSelected.filter(payId => {
                        const p = ed.payments.find(pp => pp.id === payId);
                        return p && !p.linkedInvoice;
                      }).length;
                      return (
                        <div className={movableCount === 0 ? 'opacity-50' : ''}>
                          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Move to reservation</div>
                          {movableCount === 0 ? (
                            <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-400">
                              All selected payments are linked to an invoice and cannot be moved.
                            </div>
                          ) : (
                            <>
                              <div className="relative">
                                <input value={billTransferSearch} onChange={(e) => { setBillTransferSearch(e.target.value); setBillTransferTarget(null); }}
                                  placeholder="Search booking ref or guest..."
                                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                                {billTransferTarget && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                  </svg>
                                )}
                                {billTransferSearch.length >= 2 && !billTransferTarget && (() => {
                                  const results = searchTransferTargets(billTransferSearch);
                                  return results.length > 0 ? (
                                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                      {results.map(r => (
                                        <button key={r.id} onClick={() => { setBillTransferTarget(r); setBillTransferSearch(`${r.bookingRef} — ${r.guest}`); }}
                                          className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 flex items-center justify-between border-b border-neutral-50 last:border-0">
                                          <span className="font-medium text-neutral-900">{r.guest}</span>
                                          <span className="text-neutral-400">{r.bookingRef}</span>
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-xs text-neutral-400 text-center">No reservations found</div>
                                  );
                                })()}
                              </div>
                              {billTransferTarget && (
                                <button onClick={executeTransfer}
                                  className="w-full mt-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-violet-600 text-white hover:bg-violet-700">
                                  Move {movableCount} payment{movableCount !== 1 ? 's' : ''} to {billTransferTarget.bookingRef}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Add Payment */}
                {billTransferMode !== 'payments' && (
                <div className="p-4 border-t border-neutral-100">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Add Payment</div>
                  <div className="flex gap-1 mb-3">
                    <button onClick={() => updateEd('_paymentMode', 'terminal')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                        (ed._paymentMode || 'terminal') === 'terminal' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                      Via terminal
                    </button>
                    <button onClick={() => updateEd('_paymentMode', 'email')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                        ed._paymentMode === 'email' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Via e-mail
                    </button>
                    <button onClick={() => updateEd('_paymentMode', 'manual')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                        ed._paymentMode === 'manual' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}>Add manually</button>
                    {(() => {
                      const bookerCard = globals.bookerProfiles.find(bp => (bp.email && bp.email === ed.booker?.email) || (bp.firstName === ed.booker?.firstName && bp.lastName === ed.booker?.lastName))?.creditCard;
                      const companyCard = ed.billingRecipient?.companyId ? globals.companyProfiles.find(c => c.id === ed.billingRecipient.companyId)?.creditCard : null;
                      const card = bookerCard || companyCard;
                      if (!card) return null;
                      return (
                        <button onClick={() => updateEd('_paymentMode', 'creditcard')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                            ed._paymentMode === 'creditcard' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                          }`}>
                          <Icons.CreditCard className="w-3 h-3" />
                          {'•••• ' + card.last4}
                        </button>
                      );
                    })()}
                  </div>

                  {(ed._paymentMode || 'terminal') === 'terminal' && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                        <input type="number" id="terminalAmount" key={`term-${outstandingAmount}`} defaultValue={outstandingAmount}
                          className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      </div>
                      <button onClick={() => {
                        const amount = parseFloat(document.getElementById('terminalAmount').value) || 0;
                        if (amount <= 0) return;
                        const next = JSON.parse(JSON.stringify(ed));
                        next.payments.push({ id: Date.now(), date: toDateStr(new Date()), amount, method: 'Terminal', note: 'Sent to terminal', status: 'pending', linkedInvoice: null });
                        next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Terminal payment request EUR ${amount}`, user: globals.currentUser?.name || 'System' });
                        setEditingReservation(next);
                        setToastMessage(`EUR ${amount} sent to terminal`);
                      }}
                        className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap">
                        Send
                      </button>
                    </div>
                  )}

                  {ed._paymentMode === 'email' && (() => {
                    // Collect all possible recipients with email addresses
                    const emailRecipients = [];
                    if (ed.booker?.email) {
                      emailRecipients.push({ label: `${ed.booker.firstName || ''} ${ed.booker.lastName || ''}`.trim() + ' (booker)', email: ed.booker.email });
                    }
                    ed.rooms.forEach((room) => {
                      room.guests.forEach((g) => {
                        if (g.email && g.email !== ed.booker?.email) {
                          emailRecipients.push({ label: `${g.firstName || ''} ${g.lastName || ''}`.trim() + ` (room ${room.roomNumber})`, email: g.email });
                        }
                      });
                    });
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <select id="emailRecipient" className="w-full px-2 py-1.5 pr-7 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                              {emailRecipients.length > 0 ? emailRecipients.map((r, i) => (
                                <option key={i} value={r.email}>{r.label} — {r.email}</option>
                              )) : (
                                <option value="">No email addresses available</option>
                              )}
                            </select>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                            <input type="number" id="emailAmount" key={`email-${outstandingAmount}`} defaultValue={outstandingAmount}
                              className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                          </div>
                          <button onClick={() => {
                            const amount = parseFloat(document.getElementById('emailAmount').value) || 0;
                            const recipientEl = document.getElementById('emailRecipient');
                            const recipientEmail = recipientEl?.value;
                            if (amount <= 0 || !recipientEmail) return;
                            const next = JSON.parse(JSON.stringify(ed));
                            next.payments.push({ id: Date.now(), date: toDateStr(new Date()), amount, method: 'Email Request', note: `Sent to ${recipientEmail}`, status: 'request-sent', linkedInvoice: null });
                            // Auto-create reminder 24h from now to check payment
                            const reminderDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                            if (!next.reminders) next.reminders = [];
                            next.reminders.push({ id: Date.now() + 2, message: `Check payment EUR ${amount} (${recipientEmail})`, dueDate: reminderDue, createdAt: Date.now(), fired: false, toastShown: false });
                            next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Email payment request EUR ${amount} sent to ${recipientEmail} — reminder set for 24h`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setToastMessage(`EUR ${amount} request sent to ${recipientEmail}`);
                          }}
                            disabled={emailRecipients.length === 0}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${emailRecipients.length > 0 ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}>
                            Send
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {ed._paymentMode === 'creditcard' && (() => {
                    const bookerCard = globals.bookerProfiles.find(bp => (bp.email && bp.email === ed.booker?.email) || (bp.firstName === ed.booker?.firstName && bp.lastName === ed.booker?.lastName))?.creditCard;
                    const companyCard = ed.billingRecipient?.companyId ? globals.companyProfiles.find(c => c.id === ed.billingRecipient.companyId)?.creditCard : null;
                    const card = bookerCard || companyCard;
                    if (!card) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                          <input type="number" id="ccAmount" key={`cc-${outstandingAmount}`} defaultValue={outstandingAmount}
                            className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                        </div>
                        <button onClick={() => {
                          const amount = parseFloat(document.getElementById('ccAmount').value) || 0;
                          if (amount <= 0) return;
                          const next = JSON.parse(JSON.stringify(ed));
                          next.payments.push({ id: Date.now(), date: toDateStr(new Date()), amount, method: `Credit Card (•••• ${card.last4})`, note: 'Charged to card on file', status: 'completed', linkedInvoice: null });
                          next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Credit card charge: EUR ${amount} (•••• ${card.last4})`, user: globals.currentUser?.name || 'System' });
                          setEditingReservation(next);
                          setToastMessage(`EUR ${amount} charged to •••• ${card.last4}`);
                        }}
                          className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap flex items-center gap-1">
                          <Icons.CreditCard className="w-3 h-3" />
                          Charge
                        </button>
                      </div>
                    );
                  })()}

                  {ed._paymentMode === 'manual' && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                        <input type="number" id="paymentAmount" placeholder="0" key={`manual-${outstandingAmount}`} defaultValue={outstandingAmount}
                          className="w-full pl-10 pr-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      </div>
                      <div className="relative">
                        <select id="paymentMethod" defaultValue={(globals.hotelSettings.paymentMethods || [])[1] || 'Card (PIN)'}
                          className="px-2 py-1.5 pr-7 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                          {(globals.hotelSettings.paymentMethods || ['Cash', 'Card (PIN)', 'Maestro', 'Mastercard', 'Visa', 'Bank Transfer', 'iDEAL']).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      <button onClick={() => {
                        const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
                        if (amount === 0) return;
                        const method = document.getElementById('paymentMethod').value;
                        const isRefund = amount < 0;
                        const isBankTransfer = method === 'Bank Transfer';
                        const next = JSON.parse(JSON.stringify(ed));
                        next.payments.push({
                          id: Date.now(),
                          date: toDateStr(new Date()),
                          amount,
                          method: isRefund ? `Refund (${method})` : method,
                          note: isRefund ? 'Manual refund' : (isBankTransfer && !isRefund ? 'Awaiting bank transfer' : ''),
                          status: (isBankTransfer && !isRefund) ? 'pending' : 'completed',
                          confirmed: isBankTransfer && !isRefund ? false : true,
                          confirmedDate: (isBankTransfer && !isRefund) ? null : toDateStr(new Date()),
                          linkedInvoice: null
                        });
                        next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `${isRefund ? 'Refund' : 'Payment'} recorded: EUR ${amount} (${method})${isBankTransfer && !isRefund ? ' — awaiting confirmation' : ''}`, user: globals.currentUser?.name || 'System' });
                        setEditingReservation(next);
                        setToastMessage(`EUR ${amount} ${isRefund ? 'refund' : ''} recorded`);
                        document.getElementById('paymentAmount').value = '';
                      }}
                        className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap">
                        Add
                      </button>
                    </div>
                  )}
                </div>
                )}
                </div>
                </div>
              </div>
            </div>
            );
};

export default DetailBillingTab;
