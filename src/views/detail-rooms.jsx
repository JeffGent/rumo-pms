import React, { useState } from 'react';
import globals from '../globals.js';
import { noTypeDateKey, deriveReservationDates, buildFlatRoomEntries, formatDate } from '../utils.js';
import { Icons } from '../icons.jsx';
import { getAllRooms, getRoomType, getRoomTypeName, SUPPORTED_LANGUAGES, detectLanguageFromPhone, lsKey, getExtraPrice, getHotelAddress, saveGuestProfiles } from '../config.js';

// -- Detail: Rooms & Guests Tab --
const DetailRoomsTab = ({ dp }) => {
  const {
    ed, setEditingReservation, reservation, updateEd, updateStatus, updateRoomStatus,
    setToastMessage, setWarningToast, onFocusTrack, onBlurLog, addToActivityLog, focusValRef,
    roomGridMode, setRoomGridMode, activeGuestTab, setActiveGuestTab,
    expandedRooms, setExpandedRooms, guestSearchActive, setGuestSearchActive,
    changeRoomTarget, setChangeRoomTarget, setPendingDateChange, edCheckin, edCheckout,
    addRoomDates, setAddRoomDates, addRoomRef, moveRoomQuery, setMoveRoomQuery,
    newExtra, setNewExtra, extraDropdownOpen, setExtraDropdownOpen,
    addCatalogExtra, pricingOpen, setPricingOpen, nightsLabel, housekeepingStatus,
    setProfileSelectedProfile, setProfileEditingProfile,
    setProfileSourceReservation, setProfileSourceTab,
    switchBookerOpen, setSwitchBookerOpen, switchBookerQuery, setSwitchBookerQuery,
  } = dp;

  // Print invoice helper (defined outside JSX to avoid Babel template literal issues)
  window._printInvoice = (inv, edR, payments) => {
              const r = inv.recipient || {};
              const invPayments = (payments || []).filter(p => (inv.linkedPayments || []).includes(p.id));
              const confirmedPayments = invPayments.filter(p => p.method !== 'Bank Transfer' || p.confirmed !== false);
              const pendingBTPayments = invPayments.filter(p => p.method === 'Bank Transfer' && p.confirmed === false);
              const invPaid = confirmedPayments.reduce((s, p) => s + p.amount, 0);
              const pendingBTTotal = pendingBTPayments.reduce((s, p) => s + p.amount, 0);
              const isCredit = inv.type === 'credit';
              const vatGroups = {};
              (inv.items || []).forEach(item => {
                const rate = item.vatRate || 0;
                if (!vatGroups[rate]) vatGroups[rate] = { net: 0, vat: 0, gross: 0 };
                const gross = item.amount;
                const net = gross / (1 + rate / 100);
                vatGroups[rate].gross += gross;
                vatGroups[rate].net += net;
                vatGroups[rate].vat += gross - net;
              });
              const checkIn = reservation.checkin ? new Date(reservation.checkin).toLocaleDateString('en-GB') : '';
              const checkOut = reservation.checkout ? new Date(reservation.checkout).toLocaleDateString('en-GB') : '';
              const cur = globals.hotelSettings.currency || 'EUR';
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.number}</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; max-width: 700px; margin: 0 auto; padding: 20mm; }
.header { display: flex; justify-content: space-between; margin-bottom: 40px; }
.hotel { font-size: 18pt; font-weight: 300; letter-spacing: 2px; font-family: Georgia, serif; }
.hotel-details { font-size: 8pt; color: #666; margin-top: 4px; }
.invoice-title { text-align: right; }
.invoice-title h2 { font-size: 14pt; font-weight: 600; color: ${isCredit ? '#dc2626' : '#1a1a1a'}; }
.invoice-title .inv-num { font-size: 11pt; color: #666; }
.meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
.meta-block { font-size: 9pt; }
.meta-block .label { color: #999; text-transform: uppercase; font-size: 7pt; letter-spacing: 1px; margin-bottom: 2px; }
.meta-block .value { color: #1a1a1a; }
table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
th:last-child { text-align: right; }
td { padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 9pt; }
td:last-child { text-align: right; font-weight: 500; }
.item-detail { font-size: 8pt; color: #999; }
.totals { margin-left: auto; width: 250px; }
.totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 9pt; }
.totals .row.total { border-top: 2px solid #1a1a1a; font-weight: 600; font-size: 11pt; margin-top: 4px; padding-top: 8px; }
.totals .row.vat { color: #666; font-size: 8pt; }
.payments { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; }
.payments h3 { font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
.pay-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 3px 0; }
.pay-method { color: #666; }
.due { color: #d97706; font-weight: 600; }
.footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 7pt; color: #999; padding: 10px 20mm; border-top: 1px solid #f0f0f0; }
.ref { font-size: 8pt; color: #999; margin-top: 20px; }
@media print { button { display: none !important; } }
</style></head><body>
<div class="header">
<div>
  <div class="hotel">${(globals.hotelSettings.companyName || globals.hotelSettings.hotelName || 'Hotel').split(' ')[0].toUpperCase()}</div>
  <div class="hotel-details">${globals.hotelSettings.companyName || globals.hotelSettings.hotelName || ''}<br>${getHotelAddress()}<br>BTW ${globals.hotelSettings.hotelVat || ''}<br>${globals.hotelSettings.hotelEmail || ''} · ${globals.hotelSettings.hotelPhone || ''}</div>
</div>
<div class="invoice-title">
  <h2>${isCredit ? 'CREDIT NOTE' : inv.type === 'proforma' ? 'PROFORMA' : 'INVOICE'}</h2>
  <div class="inv-num">${inv.number}</div>
  ${inv.creditFor ? '<div style="font-size:8pt;color:#999;">Credit for ' + inv.creditFor + '</div>' : ''}
  ${inv.amendsInvoice ? '<div style="font-size:8pt;color:#999;">Amends ' + inv.amendsInvoice + '</div>' : ''}
</div>
</div>
<div class="meta">
<div class="meta-block">
  <div class="label">Bill to</div>
  <div class="value" style="font-weight:500;">${r.name || '\u2014'}</div>
  ${r.vatNumber ? '<div class="value">' + r.vatNumber + '</div>' : ''}
  ${r.address ? '<div class="value">' + r.address + '</div>' : ''}
  ${r.zip || r.city ? '<div class="value">' + [r.zip, r.city].filter(Boolean).join(' ') + '</div>' : ''}
  ${r.country ? '<div class="value">' + r.country + '</div>' : ''}
  ${r.email ? '<div class="value" style="color:#666;">' + r.email + '</div>' : ''}
</div>
<div class="meta-block" style="text-align:right;">
  <div class="label">Date</div>
  <div class="value">${inv.date}</div>
  <div class="label" style="margin-top:8px;">Stay</div>
  <div class="value">${checkIn} \u2014 ${checkOut}</div>
  <div class="label" style="margin-top:8px;">Booking Ref</div>
  <div class="value">${ed.bookingRef || '\u2014'}</div>
  ${inv.reference ? '<div class="label" style="margin-top:8px;">Your Reference</div><div class="value">' + inv.reference + '</div>' : ''}
</div>
</div>
<table>
<thead><tr><th>Description</th><th>VAT</th><th style="text-align:right;">Amount</th></tr></thead>
<tbody>
  ${(inv.items || []).map(item => '<tr><td>' + item.label + (item.detail ? '<div class="item-detail">' + item.detail + '</div>' : '') + '</td><td>' + (item.vatRate || 0) + '%</td><td>' + cur + ' ' + item.amount.toFixed(2) + '</td></tr>').join('')}
</tbody>
</table>
<div class="totals">
${Object.entries(vatGroups).map(([rate, g]) => '<div class="row vat"><span>Net (' + rate + '% VAT)</span><span>' + cur + ' ' + g.net.toFixed(2) + '</span></div><div class="row vat"><span>VAT ' + rate + '%</span><span>' + cur + ' ' + g.vat.toFixed(2) + '</span></div>').join('')}
<div class="row total"><span>Total</span><span>${cur} ${inv.amount.toFixed(2)}</span></div>
</div>
${invPayments.length > 0 ? '<div class="payments"><h3>Payments</h3>' + confirmedPayments.map(p => '<div class="pay-row"><span class="pay-method">' + p.method + ' \u00b7 ' + p.date + '</span><span>' + cur + ' ' + p.amount.toFixed(2) + '</span></div>').join('') + (pendingBTPayments.length > 0 ? pendingBTPayments.map(p => '<div class="pay-row" style="color:#b45309;"><span class="pay-method">Expected payment: Bank Transfer</span><span>' + cur + ' ' + p.amount.toFixed(2) + '</span></div>').join('') : '') + (invPaid + pendingBTTotal < inv.amount && !isCredit ? '<div class="pay-row due"><span>Amount due</span><span>' + cur + ' ' + (inv.amount - invPaid - pendingBTTotal).toFixed(2) + '</span></div>' : '') + (invPaid < inv.amount && pendingBTTotal > 0 && !isCredit ? '<div class="pay-row due"><span>Balance (excl. expected)</span><span>' + cur + ' ' + (inv.amount - invPaid).toFixed(2) + '</span></div>' : '') + '</div>' : ''}
<div class="ref">Booking ref: ${ed.bookingRef || '\u2014'}${ed.otaRef ? ' \u00b7 OTA ref: ' + ed.otaRef : ''}</div>
<div class="footer">${globals.hotelSettings.companyName || globals.hotelSettings.hotelName || ''} \u00b7 ${getHotelAddress()} \u00b7 ${globals.hotelSettings.hotelVat || ''}</div>
</body></html>`;
              let iframe = document.getElementById('_printFrame');
              if (!iframe) { iframe = document.createElement('iframe'); iframe.id = '_printFrame'; iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;'; document.body.appendChild(iframe); }
              iframe.contentDocument.open();
              iframe.contentDocument.write(html);
              iframe.contentDocument.close();
              setTimeout(() => iframe.contentWindow.print(), 300);
  };

  return (
            <div className="space-y-4">

              {/* Quick Edit Grid */}
              {roomGridMode && (() => {
                const allRoomsList = getAllRooms();
                const flatEntries = buildFlatRoomEntries(globals.reservations);
                const getAvailableRooms = (ri) => {
                  const room = ed.rooms[ri];
                  const usedByOthers = ed.rooms.filter((_, i) => i !== ri).map(r => r.roomNumber);
                  const roomCi = room.checkin ? new Date(room.checkin) : new Date(ed.checkin || reservation.checkin);
                  const roomCo = room.checkout ? new Date(room.checkout) : new Date(ed.checkout || reservation.checkout);
                  return allRoomsList.filter(rm => {
                    if (rm === room.roomNumber) return true;
                    if (usedByOthers.includes(rm)) return false;
                    return !flatEntries.some(r => {
                      if (r.room !== rm || r.id === reservation.id) return false;
                      const st = r.reservationStatus || 'confirmed';
                      if (st === 'cancelled' || st === 'no-show') return false;
                      return new Date(r.checkin) < roomCo && new Date(r.checkout) > roomCi;
                    });
                  });
                };
                const gridTotal = ed.rooms.reduce((s, r) => s + (r.priceType === 'fixed' ? (r.fixedPrice || 0) : r.nightPrices.reduce((ns, n) => ns + (n.amount || 0), 0)), 0);
                return (
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-20">Room</th>
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-28">Status</th>
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Guest</th>
                          <th className="px-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-20">Pricing</th>
                          <th className="px-2.5 py-1.5 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider w-24">Price (&euro;)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ed.rooms.map((room, ri) => {
                          const guestCount = room.guests ? room.guests.length : 1;
                          const availRooms = getAvailableRooms(ri);
                          return (
                          <React.Fragment key={ri}>
                            <tr className={`${guestCount === 1 ? 'border-b border-neutral-100' : ''} hover:bg-neutral-50/50`}>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                <select value={room.roomNumber} onChange={(e) => {
                                    const newRoom = e.target.value;
                                    if (newRoom === room.roomNumber) return;
                                    const next = JSON.parse(JSON.stringify(ed));
                                    const oldRoom = next.rooms[ri].roomNumber;
                                    next.rooms[ri].roomNumber = newRoom;
                                    next.rooms[ri].roomType = getRoomTypeName(newRoom);
                                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room changed: ${oldRoom} \u2192 ${newRoom}`, user: globals.currentUser?.name || 'System' });
                                    setEditingReservation(next);
                                    setToastMessage(`Room changed to ${newRoom}`);
                                  }}
                                  className="w-full px-1.5 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 appearance-none cursor-pointer">
                                  {availRooms.map(rm => <option key={rm} value={rm}>{rm}</option>)}
                                </select>
                              </td>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                <select value={room.status || 'confirmed'} onChange={(e) => updateRoomStatus(ri, e.target.value)}
                                  className={`w-full px-1.5 py-1 rounded-lg text-xs font-semibold border-0 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                                    ({ confirmed: 'bg-blue-100 text-blue-800', option: 'bg-pink-100 text-pink-800', 'checked-in': 'bg-emerald-100 text-emerald-800', 'checked-out': 'bg-neutral-200 text-neutral-600', 'no-show': 'bg-red-100 text-red-800', cancelled: 'bg-red-100 text-red-800', blocked: 'bg-slate-200 text-slate-800' })[room.status || 'confirmed'] || 'bg-blue-100 text-blue-800'
                                  }`}>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="option">Option</option>
                                  <option value="checked-in">Checked-in</option>
                                  <option value="checked-out">Checked-out</option>
                                  <option value="no-show">No-show</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="blocked">Blocked</option>
                                </select>
                              </td>
                              <td className="px-2.5 py-1">
                                <div className="flex gap-1 items-center">
                                  <input value={(room.guests && room.guests[0] ? room.guests[0].firstName : '') || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.0.firstName`, e.target.value)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest 1 first name`)}
                                    placeholder="First..."
                                    className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                  <input value={(room.guests && room.guests[0] ? room.guests[0].lastName : '') || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.0.lastName`, e.target.value)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest 1 last name`)}
                                    placeholder="Last..."
                                    className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                  <input type="email" value={(room.guests && room.guests[0] ? room.guests[0].email : '') || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.0.email`, e.target.value)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest 1 email`)}
                                    placeholder="email..."
                                    className="flex-1 px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                </div>
                              </td>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                <select value={room.priceType} onChange={(e) => { const nv = e.target.value; if (nv !== room.priceType) updateEd(`rooms.${ri}.priceType`, nv, `Room ${room.roomNumber}: pricing ${room.priceType} \u2192 ${nv}`); }}
                                  className="w-full px-1.5 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 appearance-none cursor-pointer">
                                  <option value="fixed">Fixed</option>
                                  <option value="per-night">Per Night</option>
                                </select>
                              </td>
                              <td className="px-2.5 py-1" rowSpan={guestCount}>
                                {room.priceType === 'fixed' ? (
                                  <input type="number" value={room.fixedPrice || ''} onChange={(e) => updateEd(`rooms.${ri}.fixedPrice`, parseFloat(e.target.value) || 0)}
                                    onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} price`)}
                                    className="w-full px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                ) : (
                                  <div className="text-xs text-right text-neutral-900 font-medium">
                                    &euro;{room.nightPrices.reduce((s, n) => s + (n.amount || 0), 0)}
                                  </div>
                                )}
                              </td>
                            </tr>
                            {room.guests && room.guests.slice(1).map((guest, gi) => (
                              <tr key={`${ri}-g${gi+1}`} className={`${gi + 2 === guestCount ? 'border-b border-neutral-100' : ''} hover:bg-neutral-50/50`}>
                                <td className="px-2.5 py-1">
                                  <div className="flex gap-1 items-center">
                                    <input value={guest.firstName || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi+1}.firstName`, e.target.value)}
                                      onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+2} first name`)}
                                      placeholder="First..."
                                      className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                    <input value={guest.lastName || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi+1}.lastName`, e.target.value)}
                                      onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+2} last name`)}
                                      placeholder="Last..."
                                      className="w-[28%] px-2 py-1 bg-transparent border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-neutral-50 border-t border-neutral-200">
                          <td colSpan="3" className="px-2.5 py-2 text-xs font-medium text-neutral-700">Total</td>
                          <td colSpan="2" className="px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 justify-end">
                              <input type="number" placeholder="Set all..."
                                id="quickEditBulkPrice"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) return;
                                    const next = JSON.parse(JSON.stringify(ed));
                                    next.rooms.forEach(r => { r.fixedPrice = val; r.priceType = 'fixed'; });
                                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `All rooms price set to \u20AC${val.toFixed(2)}`, user: globals.currentUser?.name || 'System' });
                                    setEditingReservation(next);
                                    setToastMessage(`All ${next.rooms.length} rooms set to \u20AC${val.toFixed(2)}`);
                                    e.target.value = '';
                                  }
                                }}
                                className="w-20 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                              <button onClick={() => {
                                  const val = parseFloat(document.getElementById('quickEditBulkPrice')?.value);
                                  if (isNaN(val)) return;
                                  const next = JSON.parse(JSON.stringify(ed));
                                  next.rooms.forEach(r => { r.fixedPrice = val; r.priceType = 'fixed'; });
                                  next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `All rooms price set to \u20AC${val.toFixed(2)}`, user: globals.currentUser?.name || 'System' });
                                  setEditingReservation(next);
                                  setToastMessage(`All ${next.rooms.length} rooms set to \u20AC${val.toFixed(2)}`);
                                  document.getElementById('quickEditBulkPrice').value = '';
                                }}
                                className="px-2 py-1 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors">Apply</button>
                              <span className="text-xs font-bold text-neutral-900 pl-1">&euro;{gridTotal.toFixed(2)}</span>
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                );
              })()}

              {/* Detail View */}
              {!roomGridMode && (
                <div className={ed.rooms.length > 3 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                {ed.rooms.map((room, ri) => {
                  const isCollapsible = ed.rooms.length > 3;
                  const isExpanded = !isCollapsible || expandedRooms[ri];
                  const primaryGuest = room.guests && room.guests[0];
                  const guestLabel = primaryGuest && (primaryGuest.firstName || primaryGuest.lastName)
                    ? `${primaryGuest.firstName || ''} ${primaryGuest.lastName || ''}`.trim()
                    : '';
                  return (
                <div key={ri} className={`bg-white border border-neutral-200 rounded-2xl border-l-4 ${
                  ({ confirmed: 'border-l-blue-400', option: 'border-l-pink-400', 'checked-in': 'border-l-emerald-400', 'checked-out': 'border-l-neutral-300', 'no-show': 'border-l-red-400', cancelled: 'border-l-red-300', blocked: 'border-l-slate-400' })[room.status || 'confirmed'] || 'border-l-blue-400'
                } ${isExpanded && isCollapsible ? 'md:col-span-2' : ''}`}>
                  {/* Room Header — click to collapse/expand */}
                  <div className={`px-4 ${isCollapsible ? 'cursor-pointer select-none' : ''}`}
                    onClick={isCollapsible ? (e) => { if (['SELECT','OPTION','BUTTON','INPUT'].includes(e.target.tagName)) return; setExpandedRooms(prev => ({ ...prev, [ri]: !prev[ri] })); } : undefined}>
                    {/* Identity row */}
                    <div className={`flex items-center gap-2 ${isExpanded ? 'pt-3 pb-2' : 'pt-3 pb-0.5'}`}>
                      <span className="text-base font-bold text-neutral-900 flex-shrink-0">{room.roomNumber}</span>
                      {(housekeepingStatus?.[reservation.id] || room.housekeeping) !== 'clean' && <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" title="Housekeeping pending" />}
                      <span className="text-[13px] text-neutral-400 font-medium flex-shrink-0">{room.roomType}</span>
                      {guestLabel && <React.Fragment><span className="text-neutral-300 flex-shrink-0">&middot;</span><span className="text-[13px] text-neutral-500 truncate min-w-0">{guestLabel}</span></React.Fragment>}
                      <div className="flex-1 min-w-0" />
                      {/* Action icons */}
                      <div className="flex items-center gap-1 flex-shrink-0 relative" data-popup onClick={(e) => e.stopPropagation()}>
                        {!room.roomLocked && (
                        <button onClick={() => setChangeRoomTarget(changeRoomTarget === ri ? null : ri)}
                          title="Change Room"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200/60 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-neutral-400"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        </button>
                        )}
                        <button onClick={() => setToastMessage('Key card issued')}
                          title="Key Card"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200/60 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-neutral-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 0-7.778 7.778 5.5 5.5 0 0 0 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                        </button>
                        <button onClick={() => {
                          const next = JSON.parse(JSON.stringify(ed));
                          const wasLocked = next.rooms[ri].roomLocked;
                          next.rooms[ri].roomLocked = !wasLocked;
                          if (wasLocked) next.rooms[ri].roomLockedReason = '';
                          next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${room.roomNumber} ${wasLocked ? 'unlocked' : 'locked'}${!wasLocked ? '' : ''}`, user: globals.currentUser?.name || 'System' });
                          setEditingReservation(next);
                          setToastMessage(`Room ${room.roomNumber} ${wasLocked ? 'unlocked' : 'locked'}`);
                        }}
                          title={room.roomLocked ? 'Unlock Room' : 'Lock Room'}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${room.roomLocked ? 'hover:bg-red-100' : 'hover:bg-neutral-200/60'}`}>
                          {room.roomLocked ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-red-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-neutral-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                          )}
                        </button>

                        {/* Change Room / Move Room Popup */}
                        {changeRoomTarget === ri && (() => {
                          const allRooms = getAllRooms();
                          const usedRooms = ed.rooms.map(r => r.roomNumber);
                          const roomCi = room.checkin ? new Date(room.checkin) : new Date(ed.checkin || reservation.checkin);
                          const roomCo = room.checkout ? new Date(room.checkout) : new Date(ed.checkout || reservation.checkout);
                          const flatEntries = buildFlatRoomEntries(globals.reservations);
                          const freeRooms = allRooms.filter(rm => {
                            if (usedRooms.includes(rm)) return false;
                            return !flatEntries.some(r => {
                              if (r.room !== rm) return false;
                              if (r.id === reservation.id) return false;
                              const st = r.reservationStatus || 'confirmed';
                              if (st === 'cancelled' || st === 'no-show') return false;
                              const rCi = new Date(r.checkin);
                              const rCo = new Date(r.checkout);
                              return rCi < roomCo && rCo > roomCi;
                            });
                          });
                          // Check if this room has invoiced items (then it cannot be moved)
                          const roomInvoiced = (ed.invoices || []).some(inv => {
                            if (inv.type === 'proforma' || inv.status === 'credited') return false;
                            return (inv.items || []).some(it => it.key && it.key.includes(`room-${ri}-`));
                          });
                          const canMove = ed.rooms.length > 1 && !roomInvoiced;
                          return (
                          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-neutral-200 py-2 z-50" style={{ maxHeight: 380, overflowY: 'auto' }}>
                            {/* Section 1: Change room number */}
                            <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Change Room</div>
                            {freeRooms.length === 0
                              ? <div className="px-3 py-2 text-xs text-neutral-400">No rooms available for these dates</div>
                              : <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                                {freeRooms.map(rm => {
                                  const rt = globals.roomTypes.find(t => (t.rooms || []).includes(rm));
                                  return (
                                  <button key={rm} onClick={() => {
                                    const next = JSON.parse(JSON.stringify(ed));
                                    const oldRoom = next.rooms[ri].roomNumber;
                                    next.rooms[ri].roomNumber = rm;
                                    next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room changed: ${oldRoom} \u2192 ${rm}`, user: globals.currentUser?.name || 'System' });
                                    setEditingReservation(next);
                                    setChangeRoomTarget(null); setMoveRoomQuery('');
                                    setToastMessage(`Room changed to ${rm}`);
                                  }} className="w-full px-3 py-1.5 text-sm text-left hover:bg-neutral-50 transition-colors flex items-center justify-between">
                                    <span className="font-medium">{rm}</span>
                                    {rt && <span className="text-[11px] text-neutral-400">{rt.name}</span>}
                                  </button>
                                  );
                                })}
                              </div>
                            }

                            {/* Section 2: Move to another reservation */}
                            <div className="border-t border-neutral-100 mt-1 pt-1">
                              <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Move to Reservation</div>
                              {!canMove ? (
                                <div className="px-3 py-2 text-xs text-neutral-400">
                                  {ed.rooms.length <= 1 ? 'Only room \u2014 cannot move' : 'Room has invoiced items \u2014 cannot move'}
                                </div>
                              ) : (() => {
                                const moveTargets = globals.reservations.filter(r => {
                                  if (r.id === reservation.id) return false;
                                  const st = r.reservationStatus || 'confirmed';
                                  if (st === 'cancelled' || st === 'no-show' || st === 'checked-out') return false;
                                  return true;
                                }).slice(0, 8);
                                return (
                                  <div>
                                    <div className="px-3 mb-1">
                                      <input
                                        type="text"
                                        value={moveRoomQuery}
                                        placeholder="Search reservation..."
                                        className="w-full px-2 py-1 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                        onChange={(e) => setMoveRoomQuery(e.target.value)}
                                      />
                                    </div>
                                    {moveRoomQuery.length >= 1 && <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                                      {(() => {
                                        const q = moveRoomQuery.toLowerCase();
                                        const filtered = globals.reservations.filter(r => {
                                          if (r.id === reservation.id) return false;
                                          const st = r.reservationStatus || 'confirmed';
                                          if (st === 'cancelled' || st === 'no-show' || st === 'checked-out') return false;
                                          return (r.guest || '').toLowerCase().includes(q) ||
                                            (r.bookingRef || '').toLowerCase().includes(q) ||
                                            `${r.booker?.firstName || ''} ${r.booker?.lastName || ''}`.toLowerCase().includes(q);
                                        }).slice(0, 8);
                                        if (filtered.length === 0) return <div className="px-3 py-2 text-xs text-neutral-400">No matching reservations</div>;
                                        return filtered.map(target => (
                                          <button key={target.id} onClick={() => {
                                            // Move room from this reservation to target
                                            const next = JSON.parse(JSON.stringify(ed));
                                            const movedRoom = next.rooms.splice(ri, 1)[0];
                                            // Recalc reservation dates
                                            if (next.rooms.length > 0) {
                                              const dates = next.rooms.map(r => ({ ci: new Date(r.checkin), co: new Date(r.checkout) }));
                                              next.checkin = new Date(Math.min(...dates.map(d => d.ci))).toISOString();
                                              next.checkout = new Date(Math.max(...dates.map(d => d.co))).toISOString();
                                            }
                                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${movedRoom.roomNumber} moved to ${target.bookingRef}`, user: globals.currentUser?.name || 'System' });
                                            setEditingReservation(next);
                                            // Add room to target reservation (module-level)
                                            const targetRes = globals.reservations.find(r => r.id === target.id);
                                            if (targetRes) {
                                              // Convert dates to Date objects for module-level array
                                              movedRoom.checkin = new Date(movedRoom.checkin);
                                              movedRoom.checkout = new Date(movedRoom.checkout);
                                              targetRes.rooms.push(movedRoom);
                                              targetRes.checkin = new Date(Math.min(...targetRes.rooms.map(r => new Date(r.checkin))));
                                              targetRes.checkout = new Date(Math.max(...targetRes.rooms.map(r => new Date(r.checkout))));
                                              targetRes.activityLog = targetRes.activityLog || [];
                                              targetRes.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Room ${movedRoom.roomNumber} received from ${ed.bookingRef}`, user: globals.currentUser?.name || 'System' });
                                              try { localStorage.setItem(lsKey('hotelReservations'), JSON.stringify(globals.reservations)); } catch (e) {}
                                            }
                                            setChangeRoomTarget(null); setMoveRoomQuery('');
                                            setToastMessage(`Room ${movedRoom.roomNumber} moved to ${target.bookingRef}`);
                                          }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-50 transition-colors">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-neutral-900">{target.bookingRef}</span>
                                              <span className="text-[11px] text-neutral-400">{target.rooms?.length || 0} room{(target.rooms?.length || 0) !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="text-[11px] text-neutral-500">{target.guest || `${target.booker?.firstName || ''} ${target.booker?.lastName || ''}`.trim()}</div>
                                          </button>
                                        ));
                                      })()}
                                    </div>}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                      {isCollapsible && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 text-neutral-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}><path d="M9 18l6-6-6-6"/></svg>
                      )}
                    </div>
                    {/* Collapsed: summary line */}
                    {!isExpanded && (
                      <div className="flex items-center gap-1.5 pb-2.5">
                        <span className={`text-xs font-semibold ${
                          ({ confirmed: 'text-blue-600', option: 'text-pink-600', 'checked-in': 'text-emerald-600', 'checked-out': 'text-neutral-500', 'no-show': 'text-red-600', cancelled: 'text-red-500', blocked: 'text-slate-600' })[room.status || 'confirmed'] || 'text-blue-600'
                        }`}>{({ confirmed: 'Confirmed', option: 'Option', 'checked-in': 'Checked-in', 'checked-out': 'Checked-out', 'no-show': 'No-show', cancelled: 'Cancelled', blocked: 'Blocked' })[room.status || 'confirmed']}</span>
                        <span className="text-neutral-300 text-xs">&middot;</span>
                        <span className="text-xs text-neutral-400">{globals.ratePlans.find(rp => rp.id === room.ratePlanId)?.name || globals.ratePlans[0]?.name}</span>
                        <span className="text-neutral-300 text-xs">&middot;</span>
                        <span className="text-xs font-medium text-neutral-500">&euro;{room.priceType === 'fixed' ? (room.fixedPrice || 0) : (room.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0)}</span>
                        <span className="text-neutral-300 text-xs">&middot;</span>
                        <span className="text-xs text-neutral-400">{(() => { const ci = room.checkin ? new Date(room.checkin) : edCheckin; const co = room.checkout ? new Date(room.checkout) : edCheckout; return `${ci.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} \u2192 ${co.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`; })()}</span>
                      </div>
                    )}
                  </div>
                  {/* Expanded: form controls grid */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-neutral-50/80 border-b border-neutral-100" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Status</div>
                          <select value={room.status || 'confirmed'} onChange={(e) => updateRoomStatus(ri, e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                              ({ confirmed: 'bg-blue-100 text-blue-800', option: 'bg-pink-100 text-pink-800', 'checked-in': 'bg-emerald-100 text-emerald-800', 'checked-out': 'bg-neutral-200 text-neutral-600', 'no-show': 'bg-red-100 text-red-800', cancelled: 'bg-red-100 text-red-800', blocked: 'bg-slate-200 text-slate-800' })[room.status || 'confirmed'] || 'bg-blue-100 text-blue-800'
                            }`}>
                            <option value="confirmed">Confirmed</option>
                            <option value="option">Option</option>
                            <option value="checked-in">Checked-in</option>
                            <option value="checked-out">Checked-out</option>
                            <option value="no-show">No-show</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="blocked">Blocked</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Rate Plan</div>
                          <div className="flex items-center gap-1.5">
                            <select value={room.ratePlanId || globals.ratePlans[0]?.id || ''} onChange={(e) => updateEd(`rooms.${ri}.ratePlanId`, e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs font-medium bg-white border border-neutral-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900">
                              {globals.ratePlans.map(rp => <option key={rp.id} value={rp.id}>{rp.name}</option>)}
                            </select>
                            <button onClick={() => setPricingOpen(prev => ({ ...prev, [ri]: !prev[ri] }))}
                              className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${pricingOpen[ri] ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                              title="Edit pricing">
                              &euro;{room.priceType === 'fixed' ? (room.fixedPrice || 0) : (room.nightPrices || []).reduce((s, n) => s + (n.amount || 0), 0)}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Check-in</div>
                          <input type="date" onKeyDown={noTypeDateKey}
                            value={room.checkin ? (room.checkin instanceof Date ? room.checkin.toISOString().slice(0, 10) : new Date(room.checkin).toISOString().slice(0, 10)) : ''}
                            onChange={(e) => {
                              const newCheckin = new Date(e.target.value);
                              if (isNaN(newCheckin)) return;
                              const co = room.checkout ? new Date(room.checkout) : new Date(ed.checkout || reservation.checkout);
                              if (newCheckin >= co) { setToastMessage('Check-in must be before check-out'); return; }
                              const next = JSON.parse(JSON.stringify(ed));
                              next.rooms[ri].checkin = newCheckin.toISOString();
                              deriveReservationDates(next);
                              setPendingDateChange({ next, source: 'room', roomIndex: ri });
                            }}
                            className="w-full px-2 py-1 rounded-lg text-xs bg-white border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">Check-out</div>
                          <input type="date" onKeyDown={noTypeDateKey}
                            value={room.checkout ? (room.checkout instanceof Date ? room.checkout.toISOString().slice(0, 10) : new Date(room.checkout).toISOString().slice(0, 10)) : ''}
                            onChange={(e) => {
                              const newCheckout = new Date(e.target.value);
                              if (isNaN(newCheckout)) return;
                              const ci = room.checkin ? new Date(room.checkin) : new Date(ed.checkin || reservation.checkin);
                              if (newCheckout <= ci) { setToastMessage('Check-out must be after check-in'); return; }
                              const next = JSON.parse(JSON.stringify(ed));
                              next.rooms[ri].checkout = newCheckout.toISOString();
                              deriveReservationDates(next);
                              setPendingDateChange({ next, source: 'room', roomIndex: ri });
                            }}
                            className="w-full px-2 py-1 rounded-lg text-xs bg-white border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer" />
                        </div>
                      </div>
                      {(room.status || 'confirmed') === 'option' && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Option expires</div>
                          <input type="datetime-local" value={room.optionExpiry || ''} onChange={(e) => updateEd(`rooms.${ri}.optionExpiry`, e.target.value)}
                            className="px-2 py-1 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-700 focus:outline-none focus:ring-1 focus:ring-pink-300" />
                          {room.optionExpiry && (
                            <button onClick={() => updateEd(`rooms.${ri}.optionExpiry`, null)} className="text-pink-300 hover:text-pink-500 transition-colors">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                      {/* Pricing — inline, toggled from price badge */}
                      {pricingOpen[ri] && (
                        <div className="mt-2 pt-2 border-t border-neutral-200/60">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex gap-1">
                              <button onClick={() => { if (room.priceType !== 'fixed') updateEd(`rooms.${ri}.priceType`, 'fixed', `Room ${room.roomNumber}: pricing per-night \u2192 fixed`); }}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                                  room.priceType === 'fixed' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                                }`}>Fixed</button>
                              <button onClick={() => { if (room.priceType !== 'per-night') updateEd(`rooms.${ri}.priceType`, 'per-night', `Room ${room.roomNumber}: pricing fixed \u2192 per-night`); }}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                                  room.priceType === 'per-night' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                                }`}>Per Night</button>
                            </div>
                          </div>
                          {room.priceType === 'fixed' ? (
                            <div className="relative max-w-xs">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">EUR</span>
                              <input type="number" value={room.fixedPrice || ''} onChange={(e) => updateEd(`rooms.${ri}.fixedPrice`, parseFloat(e.target.value) || 0)}
                                onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} price`)}
                                className="w-full pl-12 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            </div>
                          ) : (
                            <div className="bg-white rounded-lg overflow-hidden border border-neutral-200">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-neutral-200">
                                    <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                                    <th className="px-3 py-1.5 text-right text-xs font-medium text-neutral-500 uppercase">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {room.nightPrices.map((night, ni) => (
                                    <tr key={ni} className="border-b border-neutral-100 last:border-0">
                                      <td className="px-3 py-1 text-xs text-neutral-900">
                                        {formatDate(new Date(night.date))} <span className="text-neutral-400">{new Date(night.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                                      </td>
                                      <td className="px-3 py-1 text-right">
                                        <div className="relative inline-block">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">EUR</span>
                                          <input type="number" value={night.amount}
                                            onChange={(e) => {
                                              const next = JSON.parse(JSON.stringify(ed));
                                              next.rooms[ri].nightPrices[ni].amount = parseFloat(e.target.value) || 0;
                                              setEditingReservation(next);
                                            }}
                                            onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} night rate (${night.date})`)}
                                            className="w-24 pl-10 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-neutral-50">
                                    <td className="px-3 py-1.5 text-xs font-medium text-neutral-900">Total</td>
                                    <td className="px-3 py-1.5 text-right text-xs font-bold text-neutral-900">
                                      EUR {room.nightPrices.reduce((s, n) => s + (n.amount || 0), 0)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {room.roomLocked && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-red-400 flex-shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span className="text-xs text-red-600 font-medium flex-shrink-0">Locked</span>
                      <input type="text" value={room.roomLockedReason || ''} onChange={(e) => updateEd(`rooms.${ri}.roomLockedReason`, e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 text-xs bg-transparent border-0 text-red-700 placeholder-red-300 focus:outline-none" />
                    </div>
                  )}

                  {isExpanded && (
                  <div className="p-4 pt-3 space-y-3">
                    {/* Guests */}
                    <div>
                      {/* Guest tabs */}
                      <div className="flex items-center gap-1 mb-3">
                        {(room.guests || []).map((g, gi) => (
                          <button key={gi} onClick={() => setActiveGuestTab(prev => ({ ...prev, [ri]: gi }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                              (activeGuestTab[ri] || 0) === gi
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-500 hover:bg-neutral-100'
                            }`}>
                            {g.firstName && g.lastName ? `${g.firstName} ${g.lastName}` : g.firstName || `Guest ${gi + 1}`}
                          </button>
                        ))}
                        {(room.guests || []).length < 3 && (
                          <button onClick={() => {
                            const next = JSON.parse(JSON.stringify(ed));
                            if (!next.rooms[ri].guests) next.rooms[ri].guests = [];
                            next.rooms[ri].guests.push({ firstName: '', lastName: '', email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' });
                            next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${room.roomNumber}: guest ${next.rooms[ri].guests.length} added`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setActiveGuestTab(prev => ({ ...prev, [ri]: next.rooms[ri].guests.length - 1 }));
                          }} className="w-7 h-7 rounded-lg border border-dashed border-neutral-300 hover:border-neutral-400 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M12 5v14M5 12h14"/></svg>
                          </button>
                        )}
                      </div>
                      {/* Active guest form */}
                      {(() => {
                        const gi = activeGuestTab[ri] || 0;
                        const g = (room.guests || [])[gi];
                        if (!g) return null;
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-medium text-neutral-400">Guest {gi + 1}{gi === 0 ? ' (primary)' : ''}</div>
                                {g.firstName && g.lastName && (() => {
                                  const gName = `${g.firstName} ${g.lastName}`.trim();
                                  const isSaved = globals.guestProfiles.some(gr => gr.firstName === g.firstName && gr.lastName === g.lastName);
                                  return isSaved ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                  ) : (
                                    <button onClick={() => {
                                      const newId = Math.max(0, ...globals.guestProfiles.map(gr => gr.id)) + 1;
                                      globals.guestProfiles.push({ id: newId, firstName: g.firstName, lastName: g.lastName, email: g.email || '', phone: g.phone || '', nationality: g.nationality || 'NL', idType: g.idType || '', idNumber: g.idNumber || '' });
                                      saveGuestProfiles();
                                      setToastMessage(`${gName} saved to guest registry`);
                                      setEditingReservation({ ...ed }); // trigger re-render
                                    }} className="text-neutral-400 hover:text-blue-600 transition-colors" title="Save to guest registry">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                    </button>
                                  );
                                })()}
                              </div>
                              {gi > 0 && (
                                <button onClick={() => {
                                  const next = JSON.parse(JSON.stringify(ed));
                                  const removed = next.rooms[ri].guests[gi];
                                  const gName = `${removed.firstName || ''} ${removed.lastName || ''}`.trim() || `Guest ${gi+1}`;
                                  next.rooms[ri].guests.splice(gi, 1);
                                  next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${room.roomNumber}: guest removed (${gName})`, user: globals.currentUser?.name || 'System' });
                                  setEditingReservation(next);
                                  setActiveGuestTab(prev => ({ ...prev, [ri]: Math.max(0, gi - 1) }));
                                }} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                              <input value={g.firstName || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.firstName`, e.target.value)}
                                onFocus={onFocusTrack} onBlur={onBlurLog(`Room ${room.roomNumber} guest ${gi+1} first name`)}
                                placeholder="First name"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="relative">
                                <input value={g.lastName || ''} onChange={(e) => {
                                    updateEd(`rooms.${ri}.guests.${gi}.lastName`, e.target.value);
                                    setGuestSearchActive({ ri, gi });
                                  }}
                                  onFocus={(e) => { onFocusTrack(e); if (!g.firstName && !g.email && !g.phone) setGuestSearchActive({ ri, gi }); }}
                                  onBlur={(e) => { onBlurLog(`Room ${room.roomNumber} guest ${gi+1} last name`)(e); setTimeout(() => setGuestSearchActive(null), 200); }}
                                  placeholder="Last name"
                                  className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-neutral-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                {guestSearchActive && guestSearchActive.ri === ri && guestSearchActive.gi === gi && g.lastName && g.lastName.length >= 2 && (() => {
                                  const matches = globals.guestProfiles.filter(gr =>
                                    gr.lastName.toLowerCase().includes(g.lastName.toLowerCase()) &&
                                    !(gr.firstName === g.firstName && gr.lastName === g.lastName)
                                  ).slice(0, 4);
                                  if (matches.length === 0) return null;
                                  return (
                                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                      {matches.map(gr => (
                                        <button key={gr.id} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                          const next = JSON.parse(JSON.stringify(ed));
                                          const guest = next.rooms[ri].guests[gi];
                                          guest.firstName = gr.firstName; guest.lastName = gr.lastName;
                                          guest.email = gr.email; guest.phone = gr.phone;
                                          guest.nationality = gr.nationality; guest.idType = gr.idType; guest.idNumber = gr.idNumber;
                                          setEditingReservation(next);
                                          setGuestSearchActive(null);
                                        }}
                                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                          <span className="font-medium text-neutral-900">{gr.firstName} {gr.lastName}</span>
                                          <span className="text-neutral-400">{gr.email || gr.phone || gr.nationality}</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                              {gi === 0 && <input type="email" value={g.email || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.email`, e.target.value)}
                                placeholder="Email"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />}
                              <div className="flex gap-1.5">
                                <input type="tel" value={g.phone || ''} onChange={(e) => {
                                    updateEd(`rooms.${ri}.guests.${gi}.phone`, e.target.value);
                                    if (!g.language || g.language === 'en') {
                                      const detected = detectLanguageFromPhone(e.target.value);
                                      if (detected) updateEd(`rooms.${ri}.guests.${gi}.language`, detected);
                                    }
                                  }}
                                  placeholder="Phone"
                                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                {g.phone && (
                                  <a href={`https://wa.me/${g.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                                    title="Chat via WhatsApp"
                                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex-shrink-0">
                                    <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <div className="relative">
                                <select value={g.language || 'en'} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.language`, e.target.value)}
                                  className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none cursor-pointer">
                                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                                </select>
                                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </div>
                              <div className="relative">
                                <select value={g.nationality || 'NL'} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.nationality`, e.target.value)}
                                  className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none cursor-pointer">
                                  {['NL','BE','DE','FR','GB','US','IT','ES','PT','AT','CH','DK','SE','NO','PL','CZ'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </div>
                              <div className="relative">
                                <select value={g.idType || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.idType`, e.target.value)}
                                  className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none cursor-pointer">
                                  <option value="">ID type...</option>
                                  <option value="passport">Passport</option>
                                  <option value="id-card">ID Card</option>
                                  <option value="drivers-license">Driver's License</option>
                                </select>
                                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </div>
                              <input value={g.idNumber || ''} onChange={(e) => updateEd(`rooms.${ri}.guests.${gi}.idNumber`, e.target.value)}
                                placeholder="ID number"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Housekeeping Note */}
                    <div>
                      <textarea value={room.housekeepingNote || ''} onChange={(e) => updateEd(`rooms.${ri}.housekeepingNote`, e.target.value)}
                        placeholder="Housekeeping notes..."
                        rows="1"
                        className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none" />
                    </div>

                  </div>
                  )}
                </div>
              ); })}
              </div>
              )}

              {/* Unified Extras Table (shown in both views) */}
              <div className="bg-white border border-neutral-200 rounded-2xl border-l-4 border-l-neutral-300">
                <div className="px-4 pt-3 pb-2">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Extras</div>
                </div>
                <div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50/80">
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-16">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-20">Room</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider w-16">VAT %</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider w-28">Unit Price</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider w-28">Total</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ed.extras || []).map((extra, ei) => (
                        <tr key={extra.id} className="border-b border-neutral-100 last:border-0">
                          <td className="px-3 py-1.5">
                            <div className="flex items-center">
                              <button onClick={() => { if (extra.quantity > 1) { const next = JSON.parse(JSON.stringify(ed)); next.extras[ei].quantity = extra.quantity - 1; setEditingReservation(next); } }}
                                className="w-6 h-7 flex items-center justify-center rounded-l-lg border border-r-0 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors text-sm leading-none select-none">&minus;</button>
                              <input type="text" inputMode="numeric" value={extra.quantity} onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                if (raw === '') return;
                                const next = JSON.parse(JSON.stringify(ed));
                                next.extras[ei].quantity = Math.max(1, parseInt(raw));
                                setEditingReservation(next);
                              }} className="w-7 h-7 px-0 bg-white border-y border-neutral-200 text-xs text-center focus:outline-none" />
                              <button onClick={() => { const next = JSON.parse(JSON.stringify(ed)); next.extras[ei].quantity = extra.quantity + 1; setEditingReservation(next); }}
                                className="w-6 h-7 flex items-center justify-center rounded-r-lg border border-l-0 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors text-sm leading-none select-none">+</button>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-neutral-900 font-medium">{extra.name}</td>
                          <td className="px-3 py-1.5">
                            <select value={extra.room || ''} onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.extras[ei].room = e.target.value || null;
                              setEditingReservation(next);
                            }} className="w-full px-1 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent">
                              <option value="">-</option>
                              {ed.rooms.map(rm => (
                                <option key={rm.roomNumber} value={rm.roomNumber}>{rm.roomNumber}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <select value={extra.vatRate} onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.extras[ei].vatRate = parseInt(e.target.value);
                              setEditingReservation(next);
                            }} className="w-full px-1 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent">
                              {globals.vatRates.map(vr => <option key={vr.id} value={vr.rate}>{vr.rate}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="relative inline-block">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">&euro;</span>
                              <input type="number" step="0.01" min="0" value={extra.unitPrice} onChange={(e) => {
                                const next = JSON.parse(JSON.stringify(ed));
                                next.extras[ei].unitPrice = parseFloat(e.target.value) || 0;
                                setEditingReservation(next);
                              }} className="w-20 pl-6 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs font-medium text-neutral-900">
                            &euro;{((extra.quantity || 0) * (extra.unitPrice || 0)).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              const removed = next.extras[ei];
                              next.extras.splice(ei, 1);
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Extra removed: ${removed.name}`, user: globals.currentUser?.name || 'System' });
                              setEditingReservation(next);
                            }} className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center transition-colors">
                              <Icons.X className="w-3 h-3 text-neutral-400 hover:text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Add row — catalog search or custom extra */}
                      {!newExtra.custom ? (
                      <tr className="border-t border-neutral-200 bg-white">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center">
                              <button onClick={() => setNewExtra(prev => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))}
                                className="w-6 h-7 flex items-center justify-center rounded-l-lg border border-r-0 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors text-sm leading-none select-none">&minus;</button>
                              <input type="text" inputMode="numeric" value={newExtra.qty} onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                if (raw === '') return;
                                setNewExtra(prev => ({ ...prev, qty: Math.max(1, parseInt(raw)) }));
                              }} className="w-7 h-7 px-0 bg-white border-y border-neutral-200 text-xs text-center focus:outline-none" />
                              <button onClick={() => setNewExtra(prev => ({ ...prev, qty: prev.qty + 1 }))}
                                className="w-6 h-7 flex items-center justify-center rounded-r-lg border border-l-0 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors text-sm leading-none select-none">+</button>
                            </div>
                        </td>
                        <td className="px-3 py-1.5" colSpan="6">
                          <div className="relative">
                            <input value={newExtra.name}
                              onChange={(e) => { setNewExtra(prev => ({ ...prev, name: e.target.value })); setExtraDropdownOpen(true); }}
                              onFocus={() => { if (newExtra.name.length > 0) setExtraDropdownOpen(true); }}
                              onBlur={() => setTimeout(() => setExtraDropdownOpen(false), 200)}
                              placeholder="+ Add extra..."
                              className="w-full px-2 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                            {extraDropdownOpen && (() => {
                              const q = newExtra.name.toLowerCase();
                              const ci = ed.rooms?.[0] ? new Date(ed.rooms[0].checkin) : new Date(ed.checkin);
                              if (!q) return null;
                              const matches = globals.extrasCatalog.filter(c => c.name.toLowerCase().includes(q));
                              const exactMatch = globals.extrasCatalog.some(c => c.name.toLowerCase() === q);
                              return (
                                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden" style={{ maxHeight: 240, overflowY: 'auto' }}>
                                  {matches.map(c => {
                                    const price = getExtraPrice(c, ci);
                                    return (
                                      <button key={c.name} onClick={() => addCatalogExtra(c.name)}
                                        className="w-full px-3 py-2 text-left hover:bg-neutral-50 transition-colors flex items-center justify-between border-b border-neutral-50 last:border-0">
                                        <span className="text-xs font-medium text-neutral-900">{c.name}</span>
                                        <span className="text-xs text-neutral-400">{price > 0 ? `\u20AC${price}` : 'Free'}</span>
                                      </button>
                                    );
                                  })}
                                  {q && !exactMatch && (
                                    <button onClick={() => {
                                        setNewExtra(prev => ({ ...prev, custom: true, vat: '', price: '' }));
                                        setExtraDropdownOpen(false);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-amber-50 transition-colors flex items-center gap-2 border-t border-neutral-100">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                      <span className="text-xs text-neutral-600">Add "<span className="font-medium">{newExtra.name}</span>" as custom extra</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                      ) : (
                      <tr className="border-t border-neutral-200 bg-amber-50/30">
                        <td className="px-3 py-1.5">
                          <input type="number" min="1" value={newExtra.qty} onChange={(e) => setNewExtra(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                            className="w-12 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <input value={newExtra.name} onChange={(e) => setNewExtra(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Custom extra name..."
                              className="flex-1 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                              onKeyDown={(e) => { if (e.key === 'Escape') setNewExtra({ name: '', qty: 1, room: '', vat: '', price: '', custom: false }); }}
                              autoFocus />
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <select value={newExtra.room} onChange={(e) => setNewExtra(prev => ({ ...prev, room: e.target.value }))}
                            className="w-full px-1 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent">
                            <option value="">-</option>
                            {ed.rooms.map(rm => <option key={rm.roomNumber} value={rm.roomNumber}>{rm.roomNumber}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <select value={newExtra.vat} onChange={(e) => setNewExtra(prev => ({ ...prev, vat: e.target.value }))}
                            className="w-full px-1 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent">
                            <option value="">-</option>
                            {globals.vatRates.map(vr => <option key={vr.id} value={vr.rate}>{vr.rate}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="relative inline-block">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">&euro;</span>
                            <input type="number" step="0.01" min="0" value={newExtra.price}
                              onChange={(e) => setNewExtra(prev => ({ ...prev, price: e.target.value }))}
                              placeholder="0"
                              className="w-20 pl-6 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                              onKeyDown={(e) => { if (e.key === 'Enter' && newExtra.name.trim()) { e.preventDefault(); document.getElementById('addCustomExtraBtn')?.click(); } }} />
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs text-neutral-400">
                          &euro;{((newExtra.qty || 0) * (parseFloat(newExtra.price) || 0)).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-0.5">
                            <button id="addCustomExtraBtn" onClick={() => {
                              const name = newExtra.name.trim();
                              if (!name) return;
                              const price = parseFloat(newExtra.price) || 0;
                              const vat = newExtra.vat;
                              if (price > 0 && !vat) { setToastMessage('Select a VAT rate for paid extras'); return; }
                              const next = JSON.parse(JSON.stringify(ed));
                              const newId = (next.extras || []).reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
                              next.extras = next.extras || [];
                              next.extras.push({ id: newId, name, quantity: newExtra.qty || 1, room: newExtra.room || null, vatRate: parseInt(vat) || 0, unitPrice: price });
                              next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Custom extra added: ${name} x${newExtra.qty || 1}`, user: globals.currentUser?.name || 'System' });
                              setEditingReservation(next);
                              setNewExtra({ name: '', qty: 1, room: '', vat: '', price: '', custom: false });
                            }} className="w-5 h-5 rounded hover:bg-emerald-50 flex items-center justify-center transition-colors" title="Add">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            <button onClick={() => setNewExtra({ name: '', qty: 1, room: '', vat: '', price: '', custom: false })}
                              className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center transition-colors" title="Cancel">
                              <Icons.X className="w-3 h-3 text-neutral-400 hover:text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      )}
                    </tbody>
                    {(ed.extras || []).length > 0 && (
                      <tfoot>
                        <tr className="bg-neutral-100">
                          <td colSpan="5" className="px-3 py-1.5 text-xs font-medium text-neutral-900">Extras Total</td>
                          <td className="px-3 py-1.5 text-right text-xs font-bold text-neutral-900">
                            &euro;{(ed.extras || []).reduce((s, ex) => s + (ex.quantity || 0) * (ex.unitPrice || 0), 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Add Room — with date pickers + availability check */}
              {(() => {
                const allRoomNumbers = getAllRooms();
                const usedRooms = ed.rooms.map(r => r.roomNumber);

                const addCi = addRoomDates.checkin ? new Date(addRoomDates.checkin) : null;
                const addCo = addRoomDates.checkout ? new Date(addRoomDates.checkout) : null;
                const validDates = addCi && addCo && addCo > addCi;

                // Check availability: not in this reservation AND not occupied by other reservations
                const flatEntries = buildFlatRoomEntries(globals.reservations);
                const availableRooms = validDates ? allRoomNumbers.filter(rm => {
                  if (usedRooms.includes(rm)) return false;
                  return !flatEntries.some(r => {
                    if (r.room !== rm) return false;
                    if (r.id === reservation.id) return false;
                    const st = r.reservationStatus || 'confirmed';
                    if (st === 'cancelled' || st === 'no-show') return false;
                    const rCi = new Date(r.checkin);
                    const rCo = new Date(r.checkout);
                    return rCi < addCo && rCo > addCi;
                  });
                }) : [];

                return (
                  <div ref={addRoomRef} className="bg-white border border-neutral-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Add rooms</div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <input type="date" value={addRoomDates.checkin} onKeyDown={noTypeDateKey}
                          onChange={(e) => setAddRoomDates(prev => ({ ...prev, checkin: e.target.value }))}
                          className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs w-[105px] focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                        <span className="text-neutral-300">&rarr;</span>
                        <input type="date" value={addRoomDates.checkout} onKeyDown={noTypeDateKey}
                          onChange={(e) => setAddRoomDates(prev => ({ ...prev, checkout: e.target.value }))}
                          className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs w-[105px] focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!validDates ? (
                        <span className="text-xs text-neutral-400">Select valid dates</span>
                      ) : availableRooms.length === 0 ? (
                        <span className="text-xs text-neutral-400">No rooms available for these dates</span>
                      ) : availableRooms.map(rm => {
                        const rt = getRoomType(rm);
                        const rtName = getRoomTypeName(rm);
                        // Use same rate plan as first room, or default
                        const existingRatePlanId = ed.rooms?.[0]?.ratePlanId || globals.ratePlans[0]?.id;
                        const rp = globals.ratePlans.find(p => p.id === existingRatePlanId) || globals.ratePlans[0];
                        const nightlyRate = Math.round((rt?.defaultRate || 95) + (rp?.priceModifier || 0));
                        return (
                        <div key={rm} className="relative group">
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 delay-[600ms] z-30">
                          <div className="bg-amber-50 border border-amber-300 rounded-2xl shadow-2xl px-4 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-500 flex-shrink-0"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.87M19 21V10.87"/></svg>
                              <div>
                                <div className="text-xs font-semibold text-amber-900">{rtName}</div>
                                <div className="text-[11px] text-amber-700 mt-0.5">{rp?.name || 'Room Only'} · <span className="font-bold">€{nightlyRate}</span>/night</div>
                              </div>
                            </div>
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-amber-50 border-r border-b border-amber-300 rotate-45" />
                        </div>
                        <button onClick={() => {
                          const next = JSON.parse(JSON.stringify(ed));
                          const nights = [];
                          for (let d = new Date(addCi); d < addCo; d.setDate(d.getDate() + 1)) {
                            nights.push({ date: d.toISOString().slice(0, 10), amount: nightlyRate });
                          }
                          next.rooms.push({
                            roomNumber: rm, roomType: rtName,
                            ratePlanId: existingRatePlanId,
                            status: 'confirmed',
                            guests: [
                              { firstName: ed.booker.firstName || '', lastName: ed.booker.lastName || '', email: ed.booker.email || '', phone: ed.booker.phone || '', nationality: 'NL', idType: '', idNumber: '' },
                              { firstName: '', lastName: '', email: '', phone: '', nationality: 'NL', idType: '', idNumber: '' }
                            ],
                            checkin: addCi.toISOString(),
                            checkout: addCo.toISOString(),
                            priceType: 'per-night', fixedPrice: nightlyRate,
                            nightPrices: nights,
                            housekeeping: 'clean', housekeepingNote: '', optionExpiry: null,
                            roomLocked: false, roomLockedReason: ''
                          });
                          next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Room ${rm} added (${addRoomDates.checkin} \u2192 ${addRoomDates.checkout})`, user: globals.currentUser?.name || 'System' });
                          setEditingReservation(next);
                          setToastMessage(`Room ${rm} added (${rtName} · ${rp?.name || 'Room Only'} · €${nightlyRate}/night)`);
                          setTimeout(() => { addRoomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 50);
                        }}
                          className="px-3 py-1.5 text-xs font-medium border border-dashed border-neutral-300 rounded-lg hover:border-neutral-900 hover:bg-neutral-50 hover:text-neutral-900 text-neutral-400 transition-all">
                          + {rm}
                        </button>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
  );
};

export default DetailRoomsTab;
