import React, { useState, useEffect } from 'react';
import globals from '../globals.js';
import Icons from '../icons.jsx';
import { canAccessPage, saveBookerProfiles, saveCompanyProfiles, saveGuestProfiles, SUPPORTED_LANGUAGES, detectLanguageFromPhone } from '../config.js';
import { fetchVIES, noTypeDateKey } from '../utils.js';
import { saveReservations, syncProfiles } from '../supabase.js';

// ── Profiles View ────────────────────────────────────────────────────────────
const ProfilesView = (props) => {
  const {
    profileSelectedProfile, setProfileSelectedProfile,
    profileEditingProfile, setProfileEditingProfile,
    profileSourceReservation, setProfileSourceReservation,
    profileSourceTab, setProfileSourceTab,
    setActivePage, activePage,
    setSelectedReservation, setPreviousPage,
    sidebarCollapsed, setSidebarCollapsed,
    setReservationTab,
  } = props;

    // Use App-level state for profile selection (survives inline component re-mounts)
    const selectedProfile = profileSelectedProfile;
    const setSelectedProfile = setProfileSelectedProfile;
    const editingProfile = profileEditingProfile;
    const setEditingProfile = setProfileEditingProfile;
    const sourceReservation = profileSourceReservation;
    const setSourceReservation = setProfileSourceReservation;
    const sourceTab = profileSourceTab;
    const setSourceTab = setProfileSourceTab;

    const [profileTab, setProfileTab] = useState('bookers');
    const [profileSearch, setProfileSearch] = useState('');
    const [, forceUpdate] = useState(0);
    const [companySearch, setCompanySearch] = useState('');
    const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
    const [showCardForm, setShowCardForm] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardHolder, setCardHolder] = useState('');
    const [cardCvc, setCardCvc] = useState('');
    const [showCompanyCardForm, setShowCompanyCardForm] = useState(false);
    const [companyCardNumber, setCompanyCardNumber] = useState('');
    const [companyCardExpiry, setCompanyCardExpiry] = useState('');
    const [companyCardHolder, setCompanyCardHolder] = useState('');
    const [companyCardCvc, setCompanyCardCvc] = useState('');

    const [showDuplicates, setShowDuplicates] = useState(false);
    const [localToast, setLocalToast] = useState(null);

    // Auto-clear local toast
    useEffect(() => {
      if (!localToast) return;
      const t = setTimeout(() => setLocalToast(null), 3000);
      return () => clearTimeout(t);
    }, [localToast]);

    const tabs = [
      { id: 'bookers', label: 'Bookers', count: globals.bookerProfiles.length },
      { id: 'companies', label: 'Companies', count: globals.companyProfiles.length },
      { id: 'guests', label: 'Guests', count: globals.guestProfiles.length },
    ];

    const q = profileSearch.toLowerCase().trim();

    const filteredBookers = globals.bookerProfiles.filter(p =>
      !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q)) || (p.phone && p.phone.includes(q))
    );
    const filteredCompanies = globals.companyProfiles.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.vatNumber && p.vatNumber.toLowerCase().includes(q)) || (p.city && p.city.toLowerCase().includes(q))
    );
    const filteredGuests = globals.guestProfiles.filter(p =>
      !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q)) || (p.nationality && p.nationality.toLowerCase().includes(q))
    );

    // ── Duplicate detection (strict: email match, or name+phone match) ──
    const findDuplicates = (profiles, type) => {
      const pairs = [];
      const seen = new Set();
      for (let i = 0; i < profiles.length; i++) {
        for (let j = i + 1; j < profiles.length; j++) {
          const a = profiles[i], b = profiles[j];
          let isDup = false;
          if (type === 'bookers') {
            const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
            const sameName = a.firstName && b.firstName && a.lastName && b.lastName &&
              a.firstName.toLowerCase() === b.firstName.toLowerCase() &&
              a.lastName.toLowerCase() === b.lastName.toLowerCase();
            const samePhone = a.phone && b.phone && a.phone.replace(/\s/g,'') === b.phone.replace(/\s/g,'');
            isDup = sameEmail || (sameName && samePhone);
          } else if (type === 'companies') {
            isDup = (a.vatNumber && b.vatNumber && a.vatNumber.replace(/[\s.]/g,'').toLowerCase() === b.vatNumber.replace(/[\s.]/g,'').toLowerCase()) ||
              (a.name && b.name && a.name.toLowerCase() === b.name.toLowerCase());
          } else if (type === 'guests') {
            const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
            const sameName = a.firstName && b.firstName && a.lastName && b.lastName &&
              a.firstName.toLowerCase() === b.firstName.toLowerCase() &&
              a.lastName.toLowerCase() === b.lastName.toLowerCase();
            const sameNat = a.nationality && b.nationality && a.nationality === b.nationality;
            isDup = sameEmail || (sameName && sameNat);
          }
          if (isDup) {
            const key = [a.id, b.id].sort().join('-');
            if (!seen.has(key)) { seen.add(key); pairs.push([a, b]); }
          }
        }
      }
      return pairs;
    };

    const duplicates = profileTab === 'bookers' ? findDuplicates(globals.bookerProfiles, 'bookers')
      : profileTab === 'companies' ? findDuplicates(globals.companyProfiles, 'companies')
      : findDuplicates(globals.guestProfiles, 'guests');

    const mergeProfiles = (keep, remove, type) => {
      // Merge non-empty fields from remove into keep
      const merged = { ...keep };
      Object.keys(remove).forEach(key => {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt') return;
        if (!merged[key] && remove[key]) merged[key] = remove[key];
        // For nested objects like priceAgreement, creditCard
        if (typeof merged[key] === 'object' && merged[key] && typeof remove[key] === 'object' && remove[key]) {
          Object.keys(remove[key]).forEach(subKey => {
            if (!merged[key][subKey] && remove[key][subKey]) merged[key][subKey] = remove[key][subKey];
          });
        }
      });
      merged.updatedAt = Date.now();

      if (type === 'bookers') {
        const keepIdx = globals.bookerProfiles.findIndex(p => p.id === keep.id);
        if (keepIdx >= 0) globals.bookerProfiles[keepIdx] = merged;
        const removeIdx = globals.bookerProfiles.findIndex(p => p.id === remove.id);
        if (removeIdx >= 0) globals.bookerProfiles.splice(removeIdx, 1);
        // Update reservations referencing the removed profile
        globals.reservations.forEach(r => {
          if (r.booker?.email === remove.email || (r.booker?.firstName === remove.firstName && r.booker?.lastName === remove.lastName)) {
            r.booker = { firstName: merged.firstName, lastName: merged.lastName, email: merged.email, phone: merged.phone };
          }
        });
        saveBookerProfiles(); syncProfiles('booker_profiles', globals.bookerProfiles);
      } else if (type === 'companies') {
        const keepIdx = globals.companyProfiles.findIndex(p => p.id === keep.id);
        if (keepIdx >= 0) globals.companyProfiles[keepIdx] = merged;
        const removeIdx = globals.companyProfiles.findIndex(p => p.id === remove.id);
        if (removeIdx >= 0) globals.companyProfiles.splice(removeIdx, 1);
        globals.reservations.forEach(r => {
          if (r.billingRecipient?.companyId === remove.id) r.billingRecipient.companyId = merged.id;
        });
        saveCompanyProfiles(); syncProfiles('company_profiles', globals.companyProfiles);
      } else if (type === 'guests') {
        const keepIdx = globals.guestProfiles.findIndex(p => p.id === keep.id);
        if (keepIdx >= 0) globals.guestProfiles[keepIdx] = merged;
        const removeIdx = globals.guestProfiles.findIndex(p => p.id === remove.id);
        if (removeIdx >= 0) globals.guestProfiles.splice(removeIdx, 1);
        saveGuestProfiles(); syncProfiles('guest_profiles', globals.guestProfiles);
      }
      saveReservations();
      forceUpdate(n => n + 1);
      setLocalToast('Profiles merged successfully');
    };

    // Find linked reservations for a profile
    const getLinkedReservations = (profile, type) => {
      if (type === 'bookers') {
        return globals.reservations.filter(r =>
          (r.booker?.email && r.booker.email === profile.email) ||
          (r.booker?.firstName === profile.firstName && r.booker?.lastName === profile.lastName)
        );
      }
      if (type === 'companies') {
        return globals.reservations.filter(r =>
          r.billingRecipient?.companyId === profile.id || r.billingRecipient?.name === profile.name
        );
      }
      if (type === 'guests') {
        return globals.reservations.filter(r =>
          r.rooms?.some(room => room.guests?.some(g =>
            g.firstName === profile.firstName && g.lastName === profile.lastName
          ))
        );
      }
      return [];
    };

    // Get linked invoices for a profile
    const getLinkedInvoices = (profile, type) => {
      const linkedRes = getLinkedReservations(profile, type);
      const invoices = [];
      linkedRes.forEach(r => {
        (r.invoices || []).forEach(inv => invoices.push({ ...inv, bookingRef: r.bookingRef }));
      });
      return invoices;
    };

    // Persist profile to module-level array + localStorage (called automatically by updateEP)
    const persistProfile = (profile) => {
      if (!profile) return;
      const now = Date.now();
      if (profileTab === 'bookers') {
        if (profile.id === '__new__') {
          profile = { ...profile, id: 'bp-' + now + Math.random().toString(36).slice(2,6), createdAt: now, updatedAt: now };
          globals.bookerProfiles.push(profile);
        } else {
          const idx = globals.bookerProfiles.findIndex(p => p.id === profile.id);
          if (idx >= 0) { globals.bookerProfiles[idx] = { ...profile, updatedAt: now }; }
        }
        saveBookerProfiles(); syncProfiles('booker_profiles', globals.bookerProfiles);
      } else if (profileTab === 'companies') {
        if (profile.id === '__new__') {
          profile = { ...profile, id: Math.max(0, ...globals.companyProfiles.map(c => c.id)) + 1, createdAt: now, updatedAt: now };
          globals.companyProfiles.push(profile);
        } else {
          const idx = globals.companyProfiles.findIndex(p => p.id === profile.id);
          if (idx >= 0) { globals.companyProfiles[idx] = { ...profile, updatedAt: now }; }
        }
        saveCompanyProfiles(); syncProfiles('company_profiles', globals.companyProfiles);
      } else if (profileTab === 'guests') {
        if (profile.id === '__new__') {
          profile = { ...profile, id: 'gp-' + now + Math.random().toString(36).slice(2,6), createdAt: now, updatedAt: now };
          globals.guestProfiles.push(profile);
        } else {
          const idx = globals.guestProfiles.findIndex(p => p.id === profile.id);
          if (idx >= 0) { globals.guestProfiles[idx] = { ...profile, updatedAt: now }; }
        }
        saveGuestProfiles(); syncProfiles('guest_profiles', globals.guestProfiles);
      }
      setSelectedProfile(profile);
      setEditingProfile(profile);
      forceUpdate(n => n + 1);
      return profile;
    };

    // Delete profile handler
    const handleDeleteProfile = (profile, type) => {
      if (type === 'bookers') {
        const idx = globals.bookerProfiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) globals.bookerProfiles.splice(idx, 1);
        saveBookerProfiles(); syncProfiles('booker_profiles', globals.bookerProfiles);
      } else if (type === 'companies') {
        const idx = globals.companyProfiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) globals.companyProfiles.splice(idx, 1);
        saveCompanyProfiles(); syncProfiles('company_profiles', globals.companyProfiles);
      } else if (type === 'guests') {
        const idx = globals.guestProfiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) globals.guestProfiles.splice(idx, 1);
        saveGuestProfiles(); syncProfiles('guest_profiles', globals.guestProfiles);
      }
      setSelectedProfile(null);
      setEditingProfile(null);
      forceUpdate(n => n + 1);
    };

    // New empty profile
    const handleNewProfile = () => {
      if (profileTab === 'bookers') {
        const p = { id: '__new__', firstName: '', lastName: '', email: '', phone: '', linkedCompanyId: null, creditCard: null, priceAgreement: { amount: null, percentage: null }, notes: '', createdAt: Date.now(), updatedAt: Date.now() };
        setSelectedProfile(p); setEditingProfile(p);
      } else if (profileTab === 'companies') {
        const p = { id: '__new__', name: '', vatNumber: '', peppolId: '', address: '', zip: '', city: '', country: 'BE', email: '', phone: '', creditCard: null, priceAgreement: { amount: null, percentage: null }, source: '', segment: '', notes: '', createdAt: Date.now(), updatedAt: Date.now() };
        setSelectedProfile(p); setEditingProfile(p);
      } else if (profileTab === 'guests') {
        const p = { id: '__new__', firstName: '', lastName: '', email: '', phone: '', nationality: '', idType: '', idNumber: '', dateOfBirth: null, notes: '', createdAt: Date.now(), updatedAt: Date.now() };
        setSelectedProfile(p); setEditingProfile(p);
      }
    };

    // Update editing profile field + auto-save
    const updateEP = (field, value) => {
      setEditingProfile(prev => {
        let next;
        if (field.includes('.')) {
          const parts = field.split('.');
          next = { ...prev };
          let ref = next;
          for (let i = 0; i < parts.length - 1; i++) {
            ref[parts[i]] = { ...ref[parts[i]] };
            ref = ref[parts[i]];
          }
          ref[parts[parts.length - 1]] = value;
        } else {
          next = { ...prev, [field]: value };
        }
        // Auto-save: persist to module-level array + localStorage
        setTimeout(() => persistProfile(next), 0);
        return next;
      });
    };

    // Batch update multiple fields at once (single persist)
    const updateEPBatch = (updates) => {
      setEditingProfile(prev => {
        const next = { ...prev, ...updates };
        setTimeout(() => persistProfile(next), 0);
        return next;
      });
    };

    // Sidebar JSX (not a component — avoids remount on every render)
    const profilesSidebar = (
      <aside className={`cal-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <nav className="cal-nav">
          {canAccessPage(globals.currentUser?.role, 'dashboard') && <a className="cal-nav-link" onClick={() => { setActivePage('dashboard'); setSelectedReservation(null); }}><Icons.Calendar width="18" height="18" /><span>Reservations</span></a>}
          {canAccessPage(globals.currentUser?.role, 'channelmanager') && <a className={`cal-nav-link${activePage === 'channelmanager' ? ' active' : ''}`} onClick={() => { setActivePage('channelmanager'); setSelectedReservation(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="6.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="17.5" y2="16.5"/></svg><span>Channel manager</span></a>}
          <a className="cal-nav-link active"><Icons.Users width="18" height="18" /><span>Profiles</span></a>
          {canAccessPage(globals.currentUser?.role, 'payments') && <a className={`cal-nav-link${activePage === 'payments' ? ' active' : ''}`} onClick={() => { setActivePage('payments'); setSelectedReservation(null); }}><Icons.CreditCard width="18" height="18" /><span>Payments</span></a>}
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
        <div className="cal-nav-footer">{!sidebarCollapsed && (<>Rumo &copy;<br/>All Rights Reserved</>)}</div>
      </aside>
    );

    // ── Detail / Edit View ──
    if (selectedProfile) {
      // Always in edit mode — ensure editingProfile is set
      if (!editingProfile) {
        setEditingProfile({ ...selectedProfile });
      }
      const p = editingProfile || selectedProfile;
      const linkedRes = getLinkedReservations(selectedProfile, profileTab);
      const linkedInv = getLinkedInvoices(selectedProfile, profileTab);
      const linkedCompany = profileTab === 'bookers' && p.linkedCompanyId ? globals.companyProfiles.find(c => c.id === p.linkedCompanyId) : null;
      const filteredCompanies_search = globals.companyProfiles.filter(c => c.name && c.name.toLowerCase().includes(companySearch.toLowerCase()));

      return (
        <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
        {localToast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in">{localToast}</div>}
        {profilesSidebar}
        <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => {
                if (sourceReservation) {
                  // Navigate back to the reservation we came from
                  setSelectedProfile(null); setEditingProfile(null);
                  setReservationTab(sourceTab || 'billing');
                  setSelectedReservation(sourceReservation);
                  setSourceReservation(null); setSourceTab(null);
                } else {
                  setSelectedProfile(null); setEditingProfile(null); setCompanySearch(''); setCompanyDropdownOpen(false); setShowCardForm(false); setShowCompanyCardForm(false);
                }
              }}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
              <Icons.ChevronLeft className="w-4 h-4" /> {sourceReservation ? `Back to ${sourceReservation.bookingRef}` : 'Back to list'}
            </button>
          </div>

          {/* Profile title */}
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">
            {profileTab === 'companies' ? (p.name || 'New Company') : `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'New Profile'}
          </h2>
          <p className="text-sm text-neutral-400 mb-6">
            {profileTab === 'bookers' ? 'Booker Profile' : profileTab === 'companies' ? 'Company Profile' : 'Guest Profile'}
          </p>

          {/* ── Booker Detail ── */}
          {profileTab === 'bookers' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">First name</label>
                    <input value={p.firstName} onChange={e => updateEP('firstName', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Last name</label>
                    <input value={p.lastName} onChange={e => updateEP('lastName', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Email</label>
                    <input type="email" value={p.email} onChange={e => updateEP('email', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Phone</label>
                    <div className="flex items-center gap-2">
                      <input value={p.phone} onChange={e => {
                        updateEP('phone', e.target.value);
                        if (!p.language || p.language === 'en') {
                          const detected = detectLanguageFromPhone(e.target.value);
                          if (detected) updateEP('language', detected);
                        }
                      }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                      {p.phone && <a href={`https://wa.me/${p.phone.replace(/[\s\-\(\)]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 flex-shrink-0" title="WhatsApp">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.12 1.52 5.856L.057 23.988l6.257-1.44A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.978 0-3.81-.577-5.36-1.568l-.384-.23-3.716.855.884-3.627-.254-.404A9.77 9.77 0 012.18 12c0-5.422 4.398-9.82 9.82-9.82 5.422 0 9.82 4.398 9.82 9.82 0 5.422-4.398 9.82-9.82 9.82z"/></svg>
                      </a>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Language</label>
                    <div className="relative">
                      <select value={p.language || 'en'} onChange={e => updateEP('language', e.target.value)}
                        className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white appearance-none cursor-pointer">
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company link */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Company</h3>
                {linkedCompany && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-full text-sm text-neutral-700">
                      {linkedCompany.name}
                      <button onClick={() => updateEP('linkedCompanyId', null)} className="text-neutral-400 hover:text-neutral-600 ml-1" title="Unlink company">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </span>
                  </div>
                )}
                <div className="relative">
                  <div className="relative">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      value={companySearch}
                      onChange={e => { setCompanySearch(e.target.value); setCompanyDropdownOpen(true); }}
                      onFocus={() => setCompanyDropdownOpen(true)}
                      placeholder="Search companies..."
                      className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </div>
                  {companyDropdownOpen && companySearch && filteredCompanies_search.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCompanies_search.map(c => (
                        <button key={c.id} onClick={() => { updateEP('linkedCompanyId', c.id); setCompanySearch(''); setCompanyDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {companyDropdownOpen && companySearch && filteredCompanies_search.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg px-3 py-2 text-sm text-neutral-400">
                      No companies found
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Card */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Credit Card</h3>
                {p.creditCard ? (
                  <div className="flex items-center gap-3">
                    <Icons.CreditCard className="w-5 h-5 text-neutral-400" />
                    <span className="text-sm text-neutral-700 font-mono">{'•••• •••• •••• '}{p.creditCard.last4}</span>
                    <span className="text-xs text-neutral-400 ml-2">{p.creditCard.expiry}</span>
                    <span className="text-xs text-neutral-500 ml-2">{p.creditCard.holder}</span>
                    <button onClick={() => { updateEP('creditCard', null); setShowCardForm(false); setCardNumber(''); setCardExpiry(''); setCardCvc(''); setCardHolder(''); }} className="ml-auto text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                ) : showCardForm ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Card number</label>
                      <input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Expiry (MM/YY)</label>
                        <input value={cardExpiry} onChange={e => {
                          let v = e.target.value.replace(/[^\d/]/g, '');
                          if (v.length === 2 && !v.includes('/') && cardExpiry.length < 2) v += '/';
                          setCardExpiry(v.slice(0, 5));
                        }}
                          placeholder="MM/YY"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">CVC</label>
                        <input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Holder name</label>
                        <input value={cardHolder} onChange={e => setCardHolder(e.target.value)}
                          placeholder="Name on card"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => {
                        if (cardNumber.length >= 4 && cardExpiry && cardCvc && cardHolder) {
                          updateEP('creditCard', { last4: cardNumber.slice(-4), expiry: cardExpiry, cvc: cardCvc, holder: cardHolder, token: 'enc_demo' });
                          setShowCardForm(false); setCardNumber(''); setCardExpiry(''); setCardCvc(''); setCardHolder('');
                        }
                      }}
                        disabled={cardNumber.length < 4 || !cardExpiry || !cardCvc || !cardHolder}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${cardNumber.length >= 4 && cardExpiry && cardCvc && cardHolder ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
                        Save card
                      </button>
                      <button onClick={() => { setShowCardForm(false); setCardNumber(''); setCardExpiry(''); setCardCvc(''); setCardHolder(''); }}
                        className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowCardForm(true)} className="text-sm text-blue-600 hover:underline">+ Add credit card</button>
                )}
              </div>

              {/* Price Agreement */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Price Agreement</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-500">&euro;</span>
                    <input type="number" value={p.priceAgreement?.amount || ''} onChange={e => updateEP('priceAgreement.amount', e.target.value ? Number(e.target.value) : null)}
                      disabled={p.priceAgreement?.percentage != null && p.priceAgreement?.percentage !== ''}
                      className={`w-24 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300${p.priceAgreement?.percentage != null && p.priceAgreement?.percentage !== '' ? ' opacity-50 cursor-not-allowed' : ''}`} placeholder="Fixed" />
                  </div>
                  <span className="text-neutral-300">/</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-500">%</span>
                    <input type="number" value={p.priceAgreement?.percentage || ''} onChange={e => updateEP('priceAgreement.percentage', e.target.value ? Number(e.target.value) : null)}
                      disabled={p.priceAgreement?.amount != null && p.priceAgreement?.amount !== ''}
                      className={`w-24 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300${p.priceAgreement?.amount != null && p.priceAgreement?.amount !== '' ? ' opacity-50 cursor-not-allowed' : ''}`} placeholder="Discount" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Notes</h3>
                <textarea value={p.notes} onChange={e => updateEP('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none" />
              </div>

              {/* Linked Reservations */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Reservations ({linkedRes.length})</h3>
                {linkedRes.length === 0 ? <p className="text-sm text-neutral-400">No reservations found</p> : (
                  <div className="space-y-2">
                    {linkedRes.map(r => (
                      <button key={r.id} onClick={() => { setPreviousPage(activePage); setSelectedReservation(r); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-neutral-900">{r.bookingRef}</span>
                          <span className="text-xs text-neutral-400">{r.rooms?.map(rm => rm.roomNumber).join(', ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-500">{new Date(r.checkin).toLocaleDateString('en-GB', {day:'numeric',month:'short'})} &rarr; {new Date(r.checkout).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'checked-in' ? 'bg-emerald-50 text-emerald-700' : r.status === 'checked-out' ? 'bg-neutral-100 text-neutral-500' : r.status === 'option' ? 'bg-pink-50 text-pink-700' : r.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.status}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Invoices */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Invoices ({linkedInv.length})</h3>
                {linkedInv.length === 0 ? <p className="text-sm text-neutral-400">No invoices found</p> : (
                  <div className="space-y-2">
                    {linkedInv.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-neutral-900">{inv.number}</span>
                          <span className="text-xs text-neutral-400">{inv.bookingRef}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-neutral-700">&euro;{inv.amount?.toFixed(2)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : inv.status === 'sent' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{inv.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Company Detail ── */}
          {profileTab === 'companies' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Company Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-neutral-500 mb-1">Company name</label>
                    <input value={p.name} onChange={e => updateEP('name', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">VAT number</label>
                    <div className="relative">
                      <input value={p.vatNumber} onChange={e => {
                        const vat = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        const batch = { vatNumber: vat };
                        // Auto-generate Peppol ID
                        if (vat.length >= 4) {
                          const cc = vat.slice(0, 2);
                          const num = vat.slice(2);
                          const peppolPrefixes = { BE: '0208', NL: '0106', DE: '9930', FR: '9957', LU: '9945' };
                          if (peppolPrefixes[cc]) batch.peppolId = `${peppolPrefixes[cc]}:${num}`;
                        }
                        updateEPBatch(batch);
                      }} placeholder="e.g. BE0841405912" className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                      {p.vatNumber && p.vatNumber.length >= 4 && (
                        p._viesValid === 'loading' ? (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs animate-pulse">...</span>
                        ) : p._viesValid === true ? (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">&#10003;</span>
                        ) : p._viesValid === false ? (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-sm">&#10007;</span>
                        ) : (
                          <button type="button" onClick={() => {
                            const vat = p.vatNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            if (vat.length < 4) return;
                            const countryCode = vat.slice(0, 2);
                            const vatNum = vat.slice(2);
                            updateEPBatch({ _viesValid: 'loading' });
                            fetchVIES(countryCode, vatNum)
                              .then(data => {
                                if (data.isValid) {
                                  const updates = { _viesValid: true };
                                  if (data.name && data.name !== '---') updates.name = data.name;
                                  if (data.address && data.address !== '---') {
                                    const lines = data.address.split('\n').map(l => l.trim()).filter(Boolean);
                                    if (lines.length === 1) {
                                      updates.address = lines[0];
                                    } else if (lines.length >= 2) {
                                      updates.address = lines.slice(0, -1).join(', ');
                                      const lastLine = lines[lines.length - 1];
                                      const zipMatch = lastLine.match(/^(\d{4,6})\s+(.+)/);
                                      if (zipMatch) { updates.zip = zipMatch[1]; updates.city = zipMatch[2]; }
                                      else updates.city = lastLine;
                                    }
                                  }
                                  updates.country = countryCode;
                                  const peppolPrefixes = { BE: '0208', NL: '0106', DE: '9930', FR: '9957', LU: '9945' };
                                  if (peppolPrefixes[countryCode]) updates.peppolId = `${peppolPrefixes[countryCode]}:${vatNum}`;
                                  updateEPBatch(updates);
                                  setLocalToast(`VIES: ${data.name || 'Valid'}`);
                                } else if (data.isValid === false) {
                                  updateEPBatch({ _viesValid: false });
                                  setLocalToast('VIES: VAT number not found');
                                } else {
                                  updateEPBatch({ _viesValid: false });
                                  setLocalToast('VIES: Could not validate');
                                }
                              })
                              .catch(() => {
                                updateEPBatch({ _viesValid: false });
                                setLocalToast('VIES: Connection failed');
                              });
                          }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors rounded" title="Look up in EU VIES database">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Peppol ID</label>
                    <input value={p.peppolId} onChange={e => updateEP('peppolId', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-neutral-500 mb-1">Street</label>
                    <input value={p.address} onChange={e => updateEP('address', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Postal code</label>
                    <input value={p.zip} onChange={e => updateEP('zip', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">City</label>
                    <input value={p.city} onChange={e => updateEP('city', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Country</label>
                    <input value={p.country} onChange={e => updateEP('country', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Invoice email</label>
                    <input type="email" value={p.email} onChange={e => updateEP('email', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Phone</label>
                    <input value={p.phone} onChange={e => {
                      updateEP('phone', e.target.value);
                      if (!p.language || p.language === 'en') {
                        const detected = detectLanguageFromPhone(e.target.value);
                        if (detected) updateEP('language', detected);
                      }
                    }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Language</label>
                    <div className="relative">
                      <select value={p.language || 'en'} onChange={e => updateEP('language', e.target.value)}
                        className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white appearance-none cursor-pointer">
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Source</label>
                    <select value={p.source || ''} onChange={e => updateEP('source', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white">
                      <option value="">--</option>
                      <option value="direct">Direct</option>
                      <option value="booking.com">Booking.com</option>
                      <option value="expedia">Expedia</option>
                      <option value="agency">Agency</option>
                      <option value="walk-in">Walk-in</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Segment</label>
                    <select value={p.segment || ''} onChange={e => updateEP('segment', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white">
                      <option value="">--</option>
                      <option value="corporate">Corporate</option>
                      <option value="leisure">Leisure</option>
                      <option value="group">Group</option>
                      <option value="government">Government</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Credit Card */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Credit Card</h3>
                {p.creditCard ? (
                  <div className="flex items-center gap-3">
                    <Icons.CreditCard className="w-5 h-5 text-neutral-400" />
                    <span className="text-sm text-neutral-700 font-mono">{'•••• •••• •••• '}{p.creditCard.last4}</span>
                    <span className="text-xs text-neutral-400 ml-2">{p.creditCard.expiry}</span>
                    <span className="text-xs text-neutral-500 ml-2">{p.creditCard.holder}</span>
                    <button onClick={() => { updateEP('creditCard', null); setShowCompanyCardForm(false); setCompanyCardNumber(''); setCompanyCardExpiry(''); setCompanyCardCvc(''); setCompanyCardHolder(''); }} className="ml-auto text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                ) : showCompanyCardForm ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Card number</label>
                      <input value={companyCardNumber} onChange={e => setCompanyCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Expiry (MM/YY)</label>
                        <input value={companyCardExpiry} onChange={e => {
                          let v = e.target.value.replace(/[^\d/]/g, '');
                          if (v.length === 2 && !v.includes('/') && companyCardExpiry.length < 2) v += '/';
                          setCompanyCardExpiry(v.slice(0, 5));
                        }}
                          placeholder="MM/YY"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">CVC</label>
                        <input value={companyCardCvc} onChange={e => setCompanyCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Holder name</label>
                        <input value={companyCardHolder} onChange={e => setCompanyCardHolder(e.target.value)}
                          placeholder="Name on card"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => {
                        if (companyCardNumber.length >= 4 && companyCardExpiry && companyCardCvc && companyCardHolder) {
                          updateEP('creditCard', { last4: companyCardNumber.slice(-4), expiry: companyCardExpiry, cvc: companyCardCvc, holder: companyCardHolder, token: 'enc_demo' });
                          setShowCompanyCardForm(false); setCompanyCardNumber(''); setCompanyCardExpiry(''); setCompanyCardCvc(''); setCompanyCardHolder('');
                        }
                      }}
                        disabled={companyCardNumber.length < 4 || !companyCardExpiry || !companyCardCvc || !companyCardHolder}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${companyCardNumber.length >= 4 && companyCardExpiry && companyCardCvc && companyCardHolder ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
                        Save card
                      </button>
                      <button onClick={() => { setShowCompanyCardForm(false); setCompanyCardNumber(''); setCompanyCardExpiry(''); setCompanyCardCvc(''); setCompanyCardHolder(''); }}
                        className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowCompanyCardForm(true)} className="text-sm text-blue-600 hover:underline">+ Add credit card</button>
                )}
              </div>

              {/* Price Agreement */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Price Agreement</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-500">&euro;</span>
                    <input type="number" value={p.priceAgreement?.amount || ''} onChange={e => updateEP('priceAgreement.amount', e.target.value ? Number(e.target.value) : null)}
                      disabled={p.priceAgreement?.percentage != null && p.priceAgreement?.percentage !== ''}
                      className={`w-24 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300${p.priceAgreement?.percentage != null && p.priceAgreement?.percentage !== '' ? ' opacity-50 cursor-not-allowed' : ''}`} placeholder="Fixed" />
                  </div>
                  <span className="text-neutral-300">/</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-500">%</span>
                    <input type="number" value={p.priceAgreement?.percentage || ''} onChange={e => updateEP('priceAgreement.percentage', e.target.value ? Number(e.target.value) : null)}
                      disabled={p.priceAgreement?.amount != null && p.priceAgreement?.amount !== ''}
                      className={`w-24 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300${p.priceAgreement?.amount != null && p.priceAgreement?.amount !== '' ? ' opacity-50 cursor-not-allowed' : ''}`} placeholder="Discount" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Notes</h3>
                <textarea value={p.notes} onChange={e => updateEP('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none" />
              </div>

              {/* Linked Reservations */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Reservations ({linkedRes.length})</h3>
                {linkedRes.length === 0 ? <p className="text-sm text-neutral-400">No reservations found</p> : (
                  <div className="space-y-2">
                    {linkedRes.map(r => (
                      <button key={r.id} onClick={() => { setPreviousPage(activePage); setSelectedReservation(r); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-neutral-900">{r.bookingRef}</span>
                          <span className="text-xs text-neutral-400">{r.rooms?.map(rm => rm.roomNumber).join(', ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-500">{new Date(r.checkin).toLocaleDateString('en-GB', {day:'numeric',month:'short'})} &rarr; {new Date(r.checkout).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'checked-in' ? 'bg-emerald-50 text-emerald-700' : r.status === 'checked-out' ? 'bg-neutral-100 text-neutral-500' : r.status === 'option' ? 'bg-pink-50 text-pink-700' : r.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.status}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Guest Detail ── */}
          {profileTab === 'guests' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">First name</label>
                    <input value={p.firstName} onChange={e => updateEP('firstName', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Last name</label>
                    <input value={p.lastName} onChange={e => updateEP('lastName', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Email</label>
                    <input type="email" value={p.email} onChange={e => updateEP('email', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Phone</label>
                    <input value={p.phone} onChange={e => {
                      updateEP('phone', e.target.value);
                      if (!p.language || p.language === 'en') {
                        const detected = detectLanguageFromPhone(e.target.value);
                        if (detected) updateEP('language', detected);
                      }
                    }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Language</label>
                    <div className="relative">
                      <select value={p.language || 'en'} onChange={e => updateEP('language', e.target.value)}
                        className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white appearance-none cursor-pointer">
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Identification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Nationality</label>
                    <input value={p.nationality} onChange={e => updateEP('nationality', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">ID type</label>
                    <select value={p.idType || ''} onChange={e => updateEP('idType', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white">
                      <option value="">--</option>
                      <option value="ID Card">ID Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">ID number</label>
                    <input value={p.idNumber} onChange={e => updateEP('idNumber', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Date of birth</label>
                    <input type="date" value={p.dateOfBirth || ''} onChange={e => updateEP('dateOfBirth', e.target.value || null)} onKeyDown={noTypeDateKey} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Notes</h3>
                <textarea value={p.notes} onChange={e => updateEP('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none" />
              </div>

              {/* Linked Reservations */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Reservations ({linkedRes.length})</h3>
                {linkedRes.length === 0 ? <p className="text-sm text-neutral-400">No reservations found</p> : (
                  <div className="space-y-2">
                    {linkedRes.map(r => (
                      <button key={r.id} onClick={() => { setPreviousPage(activePage); setSelectedReservation(r); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-neutral-900">{r.bookingRef}</span>
                          <span className="text-xs text-neutral-400">{r.rooms?.map(rm => rm.roomNumber).join(', ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-500">{new Date(r.checkin).toLocaleDateString('en-GB', {day:'numeric',month:'short'})} &rarr; {new Date(r.checkout).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'checked-in' ? 'bg-emerald-50 text-emerald-700' : r.status === 'checked-out' ? 'bg-neutral-100 text-neutral-500' : r.status === 'option' ? 'bg-pink-50 text-pink-700' : r.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.status}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delete button at bottom */}
          {selectedProfile.id !== '__new__' && (
            <div className="mt-8 pt-6 border-t border-neutral-200">
              <button onClick={() => { if (confirm('Delete this profile?')) handleDeleteProfile(selectedProfile, profileTab); }}
                className="text-sm text-red-500 hover:text-red-700 transition-colors">
                Delete profile
              </button>
            </div>
          )}
        </div>
        </div>
        </div>
      );
    }

    // ── List View ──
    const currentList = profileTab === 'bookers' ? filteredBookers : profileTab === 'companies' ? filteredCompanies : filteredGuests;

    return (
      <div className={`cal-layout${sidebarCollapsed ? ' collapsed' : ''}`}>
      {localToast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in">{localToast}</div>}
      {profilesSidebar}
      <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="cal-title">
            <h2>Profiles</h2>
            <p>Manage bookers, companies, and guests</p>
          </div>
          <button onClick={handleNewProfile}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            New {profileTab === 'bookers' ? 'Booker' : profileTab === 'companies' ? 'Company' : 'Guest'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-neutral-200">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setProfileTab(tab.id); setProfileSearch(''); }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                profileTab === tab.id ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
              }`}>
              {tab.label}
              <span className="ml-1.5 text-xs text-neutral-400">{tab.count}</span>
              {profileTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input value={profileSearch} onChange={e => setProfileSearch(e.target.value)}
            placeholder={`Search ${profileTab}...`}
            className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 bg-white" />
        </div>

        {/* Duplicate warning banner */}
        {duplicates.length > 0 && (
          <div className="mb-4">
            <button onClick={() => setShowDuplicates(!showDuplicates)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl hover:border-amber-300 transition-all text-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-500 flex-shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-sm font-medium text-amber-800">{duplicates.length} possible duplicate{duplicates.length !== 1 ? 's' : ''} found</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 text-amber-400 ml-auto transition-transform ${showDuplicates ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showDuplicates && (
              <div className="mt-2 space-y-2">
                {duplicates.map(([a, b], idx) => (
                  <div key={idx} className="bg-white border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex-1 text-center">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-medium text-neutral-600 mx-auto mb-1">
                          {profileTab === 'companies' ? (a.name?.[0] || '').toUpperCase() : `${(a.firstName?.[0] || '').toUpperCase()}${(a.lastName?.[0] || '').toUpperCase()}`}
                        </div>
                        <div className="text-sm font-medium text-neutral-900">{profileTab === 'companies' ? a.name : `${a.firstName} ${a.lastName}`}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">{a.email || a.vatNumber || ''}</div>
                        <div className="text-xs text-neutral-400">{a.phone || a.city || ''}</div>
                        <div className="text-[10px] text-neutral-300 mt-1">{getLinkedReservations(a, profileTab).length} res.</div>
                      </div>
                      <div className="text-xs text-neutral-300 font-medium">=</div>
                      <div className="flex-1 text-center">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-medium text-neutral-600 mx-auto mb-1">
                          {profileTab === 'companies' ? (b.name?.[0] || '').toUpperCase() : `${(b.firstName?.[0] || '').toUpperCase()}${(b.lastName?.[0] || '').toUpperCase()}`}
                        </div>
                        <div className="text-sm font-medium text-neutral-900">{profileTab === 'companies' ? b.name : `${b.firstName} ${b.lastName}`}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">{b.email || b.vatNumber || ''}</div>
                        <div className="text-xs text-neutral-400">{b.phone || b.city || ''}</div>
                        <div className="text-[10px] text-neutral-300 mt-1">{getLinkedReservations(b, profileTab).length} res.</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => mergeProfiles(a, b, profileTab)}
                        className="flex-1 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors">
                        Keep {profileTab === 'companies' ? a.name?.split(' ')[0] : a.firstName}
                      </button>
                      <button onClick={() => mergeProfiles(b, a, profileTab)}
                        className="flex-1 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors">
                        Keep {profileTab === 'companies' ? b.name?.split(' ')[0] : b.firstName}
                      </button>
                      <button onClick={() => {
                        // Dismiss this pair (just ignore - they stay separate)
                        setShowDuplicates(false);
                        setLocalToast('Duplicate ignored');
                      }}
                        className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-50 transition-colors">
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List */}
        {currentList.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 text-sm">
            {q ? 'No profiles match your search' : 'No profiles yet'}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Booker cards */}
            {profileTab === 'bookers' && filteredBookers.map(p => {
              const linkedCompany = p.linkedCompanyId ? globals.companyProfiles.find(c => c.id === p.linkedCompanyId) : null;
              const resCount = getLinkedReservations(p, 'bookers').length;
              return (
                <button key={p.id} onClick={() => { setSelectedProfile(p); setEditingProfile(null); }}
                  className="w-full flex items-center gap-4 px-4 py-3 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-medium text-neutral-600 flex-shrink-0">
                    {(p.firstName?.[0] || '').toUpperCase()}{(p.lastName?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 truncate">{p.firstName} {p.lastName}</span>
                      {linkedCompany && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full truncate">{linkedCompany.name}</span>}
                      {p.creditCard && <Icons.CreditCard className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-neutral-400 truncate mt-0.5">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {resCount > 0 && <span className="text-xs text-neutral-400">{resCount} res.</span>}
                    <Icons.ChevronRight className="w-4 h-4 text-neutral-300" />
                  </div>
                </button>
              );
            })}

            {/* Company cards */}
            {profileTab === 'companies' && filteredCompanies.map(p => {
              const resCount = getLinkedReservations(p, 'companies').length;
              return (
                <button key={p.id} onClick={() => { setSelectedProfile(p); setEditingProfile(null); }}
                  className="w-full flex items-center gap-4 px-4 py-3 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-sm font-medium text-blue-600 flex-shrink-0">
                    {(p.name?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 truncate">{p.name}</span>
                      {p.segment && <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded-full capitalize">{p.segment}</span>}
                      {p.creditCard && <Icons.CreditCard className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-neutral-400 truncate mt-0.5">{p.vatNumber}{p.city ? ` · ${p.city}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {resCount > 0 && <span className="text-xs text-neutral-400">{resCount} res.</span>}
                    <Icons.ChevronRight className="w-4 h-4 text-neutral-300" />
                  </div>
                </button>
              );
            })}

            {/* Guest cards */}
            {profileTab === 'guests' && filteredGuests.map(p => {
              const resCount = getLinkedReservations(p, 'guests').length;
              return (
                <button key={p.id} onClick={() => { setSelectedProfile(p); setEditingProfile(null); }}
                  className="w-full flex items-center gap-4 px-4 py-3 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-sm font-medium text-emerald-600 flex-shrink-0">
                    {(p.firstName?.[0] || '').toUpperCase()}{(p.lastName?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 truncate">{p.firstName} {p.lastName}</span>
                      {p.nationality && <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">{p.nationality}</span>}
                    </div>
                    <div className="text-xs text-neutral-400 truncate mt-0.5">{p.idType ? `${p.idType}${p.idNumber ? `: ${p.idNumber}` : ''}` : p.email || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {resCount > 0 && <span className="text-xs text-neutral-400">{resCount} res.</span>}
                    <Icons.ChevronRight className="w-4 h-4 text-neutral-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>
      </div>
    );
  };

export default ProfilesView;
