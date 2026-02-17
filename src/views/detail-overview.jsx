import React from 'react';
import globals from '../globals.js';
import { noTypeDateKey, deriveReservationDates } from '../utils.js';
import { Icons } from '../icons.jsx';
import { SUPPORTED_LANGUAGES, detectLanguageFromPhone, saveCompanyRegistry } from '../config.js';
import { fetchVIES } from '../utils.js';

// -- Detail: Overview Tab --
const DetailOverviewTab = ({ dp }) => {
  const { ed, setEditingReservation, reservation, updateEd, setToastMessage, onFocusTrack, onBlurLog, nightsLabel, setPendingDateChange, setEmailPreviewTemplate } = dp;
  return (
            <div className="space-y-4">
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                {/* Context row — stay info */}
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between relative">
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <input type="date" onKeyDown={noTypeDateKey}
                      value={(() => { const ci = ed.checkin || (ed.rooms && ed.rooms.length > 0 ? ed.rooms.reduce((min, r) => { const d = new Date(r.checkin); return d < min ? d : min; }, new Date(ed.rooms[0].checkin)) : null); return ci ? (ci instanceof Date ? ci : new Date(ci)).toISOString().slice(0, 10) : ''; })()}
                      onChange={(e) => {
                        const newCheckin = new Date(e.target.value);
                        if (isNaN(newCheckin)) return;
                        const edCo = ed.checkout ? new Date(ed.checkout) : new Date(ed.rooms[0].checkout);
                        if (newCheckin >= edCo) { setToastMessage('Check-in must be before check-out'); return; }
                        const next = JSON.parse(JSON.stringify(ed));
                        next.rooms.forEach((room, ri) => {
                          const co = room.checkout ? new Date(room.checkout) : edCo;
                          if (newCheckin >= co) return;
                          next.rooms[ri].checkin = newCheckin.toISOString();
                        });
                        deriveReservationDates(next);
                        setPendingDateChange({ next, source: 'reservation' });
                      }}
                      className="font-medium text-neutral-900 bg-transparent border-0 border-b border-dashed border-neutral-300 px-0 py-0 text-xs cursor-pointer focus:outline-none focus:border-neutral-900 w-[110px]" />
                    <span className="text-neutral-400">&rarr;</span>
                    <input type="date" onKeyDown={noTypeDateKey}
                      value={(() => { const co = ed.checkout || (ed.rooms && ed.rooms.length > 0 ? ed.rooms.reduce((max, r) => { const d = new Date(r.checkout); return d > max ? d : max; }, new Date(ed.rooms[0].checkout)) : null); return co ? (co instanceof Date ? co : new Date(co)).toISOString().slice(0, 10) : ''; })()}
                      onChange={(e) => {
                        const newCheckout = new Date(e.target.value);
                        if (isNaN(newCheckout)) return;
                        const edCi = ed.checkin ? new Date(ed.checkin) : new Date(ed.rooms[0].checkin);
                        if (newCheckout <= edCi) { setToastMessage('Check-out must be after check-in'); return; }
                        const next = JSON.parse(JSON.stringify(ed));
                        next.rooms.forEach((room, ri) => {
                          const ci = room.checkin ? new Date(room.checkin) : edCi;
                          if (newCheckout <= ci) return;
                          next.rooms[ri].checkout = newCheckout.toISOString();
                        });
                        deriveReservationDates(next);
                        setPendingDateChange({ next, source: 'reservation' });
                      }}
                      className="font-medium text-neutral-900 bg-transparent border-0 border-b border-dashed border-neutral-300 px-0 py-0 text-xs cursor-pointer focus:outline-none focus:border-neutral-900 w-[110px]" />
                    <span className="text-neutral-300">·</span>
                    <span>{nightsLabel}</span>
                    <span className="text-neutral-300">·</span>
                    <span>{reservation.guestCount} guest{reservation.guestCount !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Keep prices popup is rendered globally below */}
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[
                        { key: 'breakfast', label: 'B', activeClass: 'bg-amber-100 text-amber-700 border border-amber-300', inactiveClass: 'bg-white border border-neutral-200 text-neutral-400 hover:text-amber-600 hover:border-amber-200' },
                        { key: 'lunch', label: 'L', activeClass: 'bg-orange-100 text-orange-700 border border-orange-300', inactiveClass: 'bg-white border border-neutral-200 text-neutral-400 hover:text-orange-600 hover:border-orange-200' },
                        { key: 'dinner', label: 'D', activeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-300', inactiveClass: 'bg-white border border-neutral-200 text-neutral-400 hover:text-indigo-600 hover:border-indigo-200' },
                      ].map(meal => {
                        const active = ed.meals && ed.meals[meal.key];
                        return (
                          <button key={meal.key} onClick={() => {
                            const next = JSON.parse(JSON.stringify(ed));
                            if (!next.meals) next.meals = { breakfast: false, lunch: false, dinner: false };
                            next.meals[meal.key] = !next.meals[meal.key];
                            setEditingReservation(next);
                          }}
                            className={`w-6 h-6 text-xs font-semibold rounded transition-all ${active ? meal.activeClass : meal.inactiveClass}`}
                            title={meal.key.charAt(0).toUpperCase() + meal.key.slice(1)}>
                            {meal.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-neutral-200">|</span>
                    <span className="text-xs text-neutral-400">ETA</span>
                    {ed.eta ? (
                      <div className="flex items-center gap-1">
                        <input type="time" value={ed.eta} onChange={(e) => updateEd('eta', e.target.value)}
                          className="px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                        <button onClick={() => updateEd('eta', '')} className="text-neutral-300 hover:text-neutral-500 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => updateEd('eta', '14:00')}
                        className="px-2 py-1 text-xs text-neutral-400 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:text-neutral-600 transition-all">
                        Unknown
                      </button>
                    )}
                  </div>
                </div>

                {/* Booker + Booking Details — 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
                  {/* Booker */}
                  <div className="p-4 pt-3 space-y-2">
                    <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Booker</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={ed.booker.firstName || ''} onChange={(e) => updateEd('booker.firstName', e.target.value)}
                        onFocus={onFocusTrack} onBlur={onBlurLog('Booker first name')}
                        placeholder="First name"
                        className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      <input value={ed.booker.lastName || ''} onChange={(e) => updateEd('booker.lastName', e.target.value)}
                        onFocus={onFocusTrack} onBlur={onBlurLog('Booker last name')}
                        placeholder="Last name"
                        className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    </div>
                    <input type="email" value={ed.booker.email} onChange={(e) => updateEd('booker.email', e.target.value)}
                      onFocus={onFocusTrack} onBlur={onBlurLog('Booker email')}
                      placeholder="Email"
                      className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    <div className="flex gap-1.5">
                      <input type="tel" value={ed.booker.phone} onChange={(e) => {
                          updateEd('booker.phone', e.target.value);
                          if (!ed.booker.language || ed.booker.language === 'en') {
                            const detected = detectLanguageFromPhone(e.target.value);
                            if (detected) updateEd('booker.language', detected);
                          }
                        }}
                        onFocus={onFocusTrack} onBlur={onBlurLog('Booker phone')}
                        placeholder="Phone"
                        className="flex-1 px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      {ed.booker.phone && (
                        <a href={`https://wa.me/${ed.booker.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                          title="WhatsApp"
                          className="flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex-shrink-0">
                          <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <select value={ed.booker.language || 'en'} onChange={(e) => updateEd('booker.language', e.target.value)}
                        className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none cursor-pointer">
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>

                  {/* Booker Details */}
                  <div className="p-4 pt-3 space-y-2">
                    {/* Billing Recipient */}
                    {(() => {
                      const br = ed.billingRecipient || { type: 'individual', companyId: null, name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: '', email: '', phone: '', reference: '' };
                      const updateBR = (field, value) => {
                        const next = { ...br, [field]: value };
                        updateEd('billingRecipient', next);
                      };
                      const updateBRMulti = (fields) => {
                        const next = { ...br, ...fields };
                        updateEd('billingRecipient', next);
                      };
                      const companyQuery = br.type === 'company' ? (br.name || '') : '';
                      const companyMatches = companyQuery.length >= 1 ? globals.companyProfiles.filter(c =>
                        c.name.toLowerCase().includes(companyQuery.toLowerCase()) && c.id !== br.companyId
                      ).slice(0, 5) : [];
                      const selectCompany = (comp) => {
                        updateEd('billingRecipient', { type: 'company', companyId: comp.id, name: comp.name, vatNumber: comp.vatNumber, peppolId: comp.peppolId, address: comp.address, zip: comp.zip, city: comp.city, country: comp.country, email: comp.email, phone: comp.phone });
                      };
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Booker Details</div>
                            <div className="flex gap-1">
                            <button onClick={() => updateEd('billingRecipient', { ...br, type: 'individual' })}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${br.type === 'individual' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                              Individual
                            </button>
                            <button onClick={() => {
                                const next = JSON.parse(JSON.stringify(ed));
                                next.billingRecipient = { ...(next.billingRecipient || {}), type: 'company' };
                                if (next.stayPurpose !== 'business') next.stayPurpose = 'business';
                                setEditingReservation(next);
                              }}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${br.type === 'company' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                              Company
                            </button>
                            </div>
                          </div>
                          {br.type === 'individual' && (
                            <div className="space-y-1.5">
                              <input value={br.address} onChange={(e) => updateBR('address', e.target.value)} placeholder="Address"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="grid grid-cols-3 gap-1.5">
                                <input value={br.zip} onChange={(e) => updateBR('zip', e.target.value)} placeholder="Zip"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.city} onChange={(e) => updateBR('city', e.target.value)} placeholder="City"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.country} onChange={(e) => updateBR('country', e.target.value)} placeholder="Country"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              </div>
                            </div>
                          )}
                          {br.type === 'company' && (
                            <div className="space-y-1.5">
                              <div className="relative">
                                <input value={br.name} onChange={(e) => { updateBRMulti(br.companyId ? { name: e.target.value, companyId: null } : { name: e.target.value }); }}
                                  placeholder="Search or type company name..."
                                  className="w-full px-2.5 py-1.5 pr-8 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                {!br.companyId && br.name && (
                                  <button onClick={() => {
                                    const newId = Math.max(0, ...globals.companyProfiles.map(c => c.id)) + 1;
                                    globals.companyProfiles.push({ id: newId, name: br.name, vatNumber: br.vatNumber, peppolId: br.peppolId, address: br.address, zip: br.zip, city: br.city, country: br.country, email: br.email, phone: br.phone });
                                    saveCompanyRegistry();
                                    updateBR('companyId', newId);
                                    setToastMessage(`${br.name} saved to registry`);
                                  }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-blue-600 transition-colors" title="Save to company registry">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                  </button>
                                )}
                                {br.companyId && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                )}
                                {companyMatches.length > 0 && !br.companyId && (
                                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                                    {companyMatches.map(c => (
                                      <button key={c.id} onClick={() => selectCompany(c)}
                                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-neutral-50 flex items-center justify-between">
                                        <span className="font-medium text-neutral-900">{c.name}</span>
                                        <span className="text-xs text-neutral-400">{c.vatNumber}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className="relative">
                                  <input value={br.vatNumber} onChange={(e) => {
                                      const vat = e.target.value;
                                      const digits = vat.replace(/[^0-9]/g, '');
                                      const peppolId = digits.length >= 9 ? '0208:' + digits : ((!br.peppolId || br.peppolId.startsWith('0208:')) ? '' : br.peppolId);
                                      updateBRMulti({ vatNumber: vat, peppolId, _viesValid: undefined });
                                    }}
                                    placeholder="VAT number"
                                    className="w-full px-2.5 py-1.5 pr-8 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                  {/* VIES lookup button / status */}
                                  {br.vatNumber && br.vatNumber.length >= 6 && (
                                    br._viesValid === 'loading' ? (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                                    ) : br._viesValid === true ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    ) : br._viesValid === false ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-500 absolute right-2 top-1/2 -translate-y-1/2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    ) : (
                                      <button onClick={() => {
                                        const vat = br.vatNumber || '';
                                        const countryCode = vat.slice(0, 2).toUpperCase();
                                        const vatNum = vat.slice(2).replace(/[^0-9A-Za-z]/g, '');
                                        if (!/^[A-Z]{2}$/.test(countryCode) || vatNum.length < 4) {
                                          setToastMessage('Enter VAT as: BE0123456789');
                                          return;
                                        }
                                        updateBRMulti({ _viesValid: 'loading' });
                                        fetchVIES(countryCode, vatNum)
                                          .then(data => {
                                            if (data.isValid && data.name && data.name !== '---') {
                                              const addr = data.address || '';
                                              const fields = { _viesValid: true };
                                              if (!br.name || !br.companyId) fields.name = data.name;
                                              if (addr) {
                                                const lines = addr.split('\n').map(l => l.trim()).filter(Boolean);
                                                if (lines.length >= 2) {
                                                  fields.address = lines[0];
                                                  const lastLine = lines[lines.length - 1];
                                                  const zipMatch = lastLine.match(/^(\d{4,6})\s+(.+)/);
                                                  if (zipMatch) { fields.zip = zipMatch[1]; fields.city = zipMatch[2]; }
                                                  else fields.city = lastLine;
                                                }
                                                if (!br.country) fields.country = countryCode;
                                              }
                                              updateBRMulti(fields);
                                              setToastMessage(`VIES: ${data.name}`);
                                            } else if (data.isValid === false) {
                                              updateBRMulti({ _viesValid: false });
                                              setToastMessage('VIES: VAT number not found');
                                            } else {
                                              updateBRMulti({ _viesValid: false });
                                              setToastMessage('VIES: Could not validate');
                                            }
                                          })
                                          .catch(() => {
                                            updateBRMulti({ _viesValid: false });
                                            setToastMessage('VIES: Connection failed');
                                          });
                                      }}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors rounded" title="Look up in EU VIES database">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                      </button>
                                    )
                                  )}
                                </div>
                                <input value={br.peppolId} onChange={(e) => updateBR('peppolId', e.target.value)} placeholder="Peppol ID"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              </div>
                              <input value={br.address} onChange={(e) => updateBR('address', e.target.value)} placeholder="Address"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              <div className="grid grid-cols-3 gap-1.5">
                                <input value={br.zip} onChange={(e) => updateBR('zip', e.target.value)} placeholder="Zip"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.city} onChange={(e) => updateBR('city', e.target.value)} placeholder="City"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                                <input value={br.country} onChange={(e) => updateBR('country', e.target.value)} placeholder="Country"
                                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                              </div>
                              <input value={br.email} onChange={(e) => updateBR('email', e.target.value)} placeholder="Billing email"
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="relative">
                        <select value={ed.bookedVia} onChange={(e) => { const nv = e.target.value; if (nv !== ed.bookedVia) updateEd('bookedVia', nv, `Booked via: ${ed.bookedVia} → ${nv}`); }}
                          className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                          <option value="direct">Direct</option>
                          <option value="booking.com">Booking.com</option>
                          <option value="expedia">Expedia</option>
                          <option value="phone">Phone</option>
                          <option value="email">Email</option>
                          <option value="walk-in">Walk-in</option>
                          <option value="agency">Travel Agency</option>
                        </select>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      <div className="relative">
                        <select value={ed.stayPurpose} onChange={(e) => { const nv = e.target.value; if (nv !== ed.stayPurpose) updateEd('stayPurpose', nv, `Stay purpose: ${ed.stayPurpose} → ${nv}`); }}
                          className="w-full px-2.5 py-1.5 pr-7 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all appearance-none">
                          <option value="leisure">Leisure</option>
                          <option value="business">Business</option>
                          <option value="mice">MICE</option>
                        </select>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes — full width bottom */}
                <div className="px-4 py-2.5 border-t border-neutral-100">
                  <textarea value={ed.notes} onChange={(e) => updateEd('notes', e.target.value)}
                    rows="1" placeholder="Notes..."
                    className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none" />
                </div>
              </div>

              {/* Communication + Reminders + Activity Log */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Email Actions */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Messages</div>
                  {(() => {
                    // Filter: skip auto-send, skip invoice (→ billing), skip cc-request if card on file
                    const bookerBp = globals.bookerProfiles.find(b => (b.email && b.email === ed.booker?.email) || (b.firstName === ed.booker?.firstName && b.lastName === ed.booker?.lastName));
                    const hasCard = bookerBp?.creditCard;
                    const visibleTemplates = globals.emailTemplates.filter(t => {
                      if (!t.active) return false;
                      const autoConfig = globals.hotelSettings.emailAutoSend?.[t.id];
                      if (autoConfig?.enabled || t.autoSend) return false; // skip auto-send
                      if (t.type === 'invoice') return false; // invoice → billing tab
                      if (t.type === 'cc-request' && hasCard) return false; // card already on file
                      return true;
                    });

                    const typeStyles = {
                      'confirmation': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-600' },
                      'cancellation': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-500' },
                      'cc-request': { icon: <Icons.CreditCard className="w-3.5 h-3.5" />, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-600' },
                      'checkout': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, bg: 'bg-neutral-50', border: 'border-neutral-200', iconColor: 'text-neutral-500' },
                    };

                    return (
                      <div className="grid grid-cols-2 gap-1.5">
                        {visibleTemplates.map(tpl => {
                          const sentLogs = (ed.emailLog || []).filter(l => l.templateId === tpl.id && l.status === 'sent');
                          const wasSent = sentLogs.length > 0;
                          const lastSent = wasSent ? sentLogs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] : null;
                          const style = typeStyles[tpl.type] || typeStyles['checkout'];

                          return (
                            <button key={tpl.id} onClick={() => {
                              if (tpl.type === 'cancellation') {
                                const resStatus = ed.status || ed.rooms?.[0]?.status;
                                if (resStatus === 'checked-in') {
                                  if (!confirm('This reservation is currently checked in. Are you sure you want to send a cancellation email?')) return;
                                }
                              }
                              setEmailPreviewTemplate(tpl.id);
                            }}
                              className={`p-2.5 ${style.bg} border ${style.border} rounded-xl hover:brightness-95 transition-all flex items-center gap-2`}>
                              <div className={`w-6 h-6 rounded-lg bg-white/80 flex items-center justify-center ${style.iconColor} flex-shrink-0`}>
                                {style.icon}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="text-[11px] font-medium text-neutral-900 truncate">{tpl.name}</div>
                                {wasSent && (
                                  <div className="text-[9px] text-emerald-600 flex items-center gap-0.5 mt-0.5">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-2 h-2 flex-shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    <span className="truncate">Sent {new Date(lastSent.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{sentLogs.length > 1 ? ` (${sentLogs.length}x)` : ''}</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                        {visibleTemplates.length === 0 && (
                          <div className="col-span-2 text-[11px] text-neutral-400 text-center py-2">No manual templates available</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Reminders */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Reminders</div>
                    <button onClick={() => {
                      const next = JSON.parse(JSON.stringify(ed));
                      if (!next._showReminderForm) next._showReminderForm = true;
                      else next._showReminderForm = false;
                      setEditingReservation(next);
                    }}
                      className="w-5 h-5 rounded-md hover:bg-neutral-100 flex items-center justify-center transition-colors text-neutral-400 hover:text-neutral-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>

                  {/* Add reminder form */}
                  {ed._showReminderForm && (
                    <div className="mb-3 p-2.5 bg-neutral-50 rounded-xl space-y-2">
                      <input id="reminderMsg" placeholder="Reminder message..." className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'Tomorrow 9:00', tomorrow9: true },
                          { label: 'Day before check-in', daysBefore: 1 },
                          { label: 'Day of check-in', daysBefore: 0 },
                          { label: '1 week before', daysBefore: 7 },
                          { label: 'Custom', custom: true }
                        ].map(opt => (
                          <button key={opt.label} onClick={() => {
                            if (opt.custom) {
                              const el = document.getElementById('reminderDateCustom');
                              if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
                              return;
                            }
                            let due;
                            if (opt.tomorrow9) {
                              due = new Date();
                              due.setDate(due.getDate() + 1);
                              due.setHours(9, 0, 0, 0);
                            } else if (opt.daysBefore !== undefined) {
                              due = new Date(ed.checkin || reservation.checkin);
                              due.setDate(due.getDate() - opt.daysBefore);
                              due.setHours(9, 0, 0, 0);
                            } else {
                              due = new Date(Date.now() + opt.mins * 60000);
                            }
                            const msg = document.getElementById('reminderMsg')?.value?.trim();
                            if (!msg) { setToastMessage('Please enter a message'); return; }
                            const isoLocal = new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            const next = JSON.parse(JSON.stringify(ed));
                            if (!next.reminders) next.reminders = [];
                            next.reminders.push({ id: Date.now(), message: msg, dueDate: isoLocal, createdAt: Date.now(), fired: false, toastShown: false });
                            next._showReminderForm = false;
                            next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Reminder set: "${msg}" (${opt.label})`, user: globals.currentUser?.name || 'System' });
                            setEditingReservation(next);
                            setToastMessage('Reminder added');
                          }}
                            className={`px-2 py-1 text-xs font-medium rounded-lg border transition-all ${opt.custom ? 'border-neutral-300 text-neutral-500 hover:bg-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-900 hover:text-neutral-900'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div id="reminderDateCustom" style={{ display: 'none' }} className="flex gap-1.5">
                        <input id="reminderDateInput" type="datetime-local" className="flex-1 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                        <button onClick={() => {
                          const msg = document.getElementById('reminderMsg')?.value?.trim();
                          const due = document.getElementById('reminderDateInput')?.value;
                          if (!msg || !due) { setToastMessage('Please fill in message and date'); return; }
                          const next = JSON.parse(JSON.stringify(ed));
                          if (!next.reminders) next.reminders = [];
                          next.reminders.push({ id: Date.now(), message: msg, dueDate: due, createdAt: Date.now(), fired: false, toastShown: false });
                          next._showReminderForm = false;
                          next.activityLog.push({ id: Date.now() + 1, timestamp: Date.now(), action: `Reminder set: "${msg}"`, user: globals.currentUser?.name || 'System' });
                          setEditingReservation(next);
                          setToastMessage('Reminder added');
                        }}
                          className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors flex-shrink-0">
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reminders list */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(ed.reminders || []).length === 0 && !ed._showReminderForm && (
                      <div className="text-xs text-neutral-400 text-center py-3">No reminders</div>
                    )}
                    {[...(ed.reminders || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((rem) => {
                      const isDue = new Date(rem.dueDate) <= new Date();
                      const isPending = isDue && !rem.fired;
                      return (
                        <div key={rem.id} className={`flex items-start gap-2 p-2 rounded-lg ${rem.fired ? 'bg-neutral-50 opacity-50' : isPending ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50'}`}>
                          <div className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${rem.fired ? 'bg-neutral-300' : isPending ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs ${rem.fired ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{rem.message}</div>
                            <div className="text-xs text-neutral-400">
                              {new Date(rem.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            {isPending && (
                              <button onClick={() => {
                                const next = JSON.parse(JSON.stringify(ed));
                                const r = next.reminders.find(r => r.id === rem.id);
                                if (r) r.fired = true;
                                next.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Reminder acknowledged: "${rem.message}"`, user: globals.currentUser?.name || 'System' });
                                setEditingReservation(next);
                              }}
                                title="Acknowledge"
                                className="text-amber-400 hover:text-emerald-500 transition-colors">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                            )}
                            <button onClick={() => {
                              const next = JSON.parse(JSON.stringify(ed));
                              next.reminders = next.reminders.filter(r => r.id !== rem.id);
                              setEditingReservation(next);
                            }}
                              className="text-neutral-300 hover:text-red-400 transition-colors">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Activity Log */}
                {(() => {
                  const sorted = [...ed.activityLog].sort((a, b) => b.timestamp - a.timestamp);
                  const collapsed = !ed._logExpanded;
                  const preview = 3;
                  const shown = collapsed ? sorted.slice(0, preview) : sorted;
                  const hasMore = sorted.length > preview;
                  return (
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Activity Log</div>
                  <div className={`space-y-2 ${!collapsed ? 'max-h-64 overflow-y-auto' : ''}`}>
                    {shown.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-neutral-300 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-neutral-900">{entry.action}</div>
                          <div className="text-xs text-neutral-400">
                            {new Date(entry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} &middot; {entry.user}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <button onClick={() => {
                      const next = JSON.parse(JSON.stringify(ed));
                      next._logExpanded = !ed._logExpanded;
                      setEditingReservation(next);
                    }}
                      className="mt-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                      {collapsed ? `Show all (${sorted.length})` : 'Show less'}
                    </button>
                  )}
                </div>
                  );
                })()}
              </div>
            </div>
  );
};

export default DetailOverviewTab;
