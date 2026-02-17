// ── SpotlightTour Component ─────────────────────────────────────────────────
// Generic spotlight tour with overlay, tooltip card, and step navigation.
// Usage: <SpotlightTour tourId="dashboard" onComplete={() => setTourActive(null)} />

// Tour bullet helper
const TourBullet = ({ color, children }) => (
  <div style={{ display: 'flex', alignItems: 'start', gap: 8, marginTop: 6 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color || '#a3a3a3', flexShrink: 0, marginTop: 6 }} />
    <span>{children}</span>
  </div>
);
const TourKbd = ({ children }) => (
  <span style={{ display: 'inline-block', padding: '1px 6px', background: '#f5f5f5', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'monospace', verticalAlign: 'middle' }}>{children}</span>
);

const TOUR_DEFINITIONS = {
  dashboard: [
    {
      title: 'Welcome to Rumo',
      description: (
        <div>
          <div>This is your hotel operations dashboard. Let's walk you through the key features.</div>
        </div>
      ),
      position: 'center',
    },
    {
      target: '[data-tour="date-nav"]',
      title: 'Date Navigation',
      description: (
        <div>
          <div>Switch between dates to view room status for any day.</div>
        </div>
      ),
      position: 'bottom',
    },
    {
      target: '[data-tour="room-filters"]',
      title: 'Room Filters',
      description: (
        <div>
          <div>Quickly narrow down which rooms you see.</div>
          <TourBullet color="#3b82f6"><strong>Arriving</strong></TourBullet>
          <TourBullet color="#f59e0b"><strong>Leaving</strong></TourBullet>
          <TourBullet color="#10b981"><strong>In-house</strong></TourBullet>
          <TourBullet color="#e5e7eb"><strong>Available</strong></TourBullet>
          <div style={{ marginTop: 8, fontSize: 12, color: '#a3a3a3' }}>From midnight to noon the default filter is <strong>Leaving</strong>, from noon to midnight it switches to <strong>Arriving</strong>.</div>
        </div>
      ),
      position: 'bottom',
    },
    {
      target: '[data-tour="room-grid"]',
      title: 'Room Cards',
      description: (
        <div>
          <div>Each card represents a room. Click any card to open the full reservation.</div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#525252' }}>What the indicators mean:</div>
          <TourBullet color="#3b82f6"><strong>Blue top border</strong> — reserved</TourBullet>
          <TourBullet color="#10b981"><strong>Green top border</strong> — checked in</TourBullet>
          <TourBullet color="#d1d5db"><strong>Grey top border</strong> — checked out</TourBullet>
          <TourBullet color="#f59e0b"><strong>Orange dot</strong> (top-right) — room is not cleaned yet</TourBullet>
          <TourBullet color="#e5e7eb"><strong>Empty card</strong> — available. Click to start a new reservation for this room.</TourBullet>
        </div>
      ),
      position: 'top',
    },
    {
      target: '[data-tour="search-btn"]',
      title: 'Quick Search',
      description: (
        <div>
          <div>Find any reservation instantly.</div>
          <TourBullet color="#171717">Search by <strong>guest name</strong>, <strong>booking ref</strong>, or <strong>invoice number</strong></TourBullet>
          <TourBullet color="#171717">Shortcut: <TourKbd>Ctrl+K</TourKbd></TourBullet>
        </div>
      ),
      position: 'bottom',
    },
    {
      target: '[data-tour="new-res-btn"]',
      title: 'New Reservation',
      description: (
        <div>
          <div>Create a new booking from scratch.</div>
          <TourBullet color="#171717">Opens a form to select dates, room type, and guest details</TourBullet>
          <TourBullet color="#171717">Shortcut: <TourKbd>Alt+N</TourKbd></TourBullet>
          <div style={{ marginTop: 6, fontSize: 12, color: '#a3a3a3' }}>Tip: you can also click an empty room card on the dashboard to start a booking directly for that room.</div>
        </div>
      ),
      position: 'bottom',
    },
    {
      target: '[data-tour="sidebar"]',
      title: 'Sidebar Navigation',
      description: (
        <div>
          <div>Quick access to all modules.</div>
          <TourBullet color="#171717"><strong>Profiles</strong> — guest, booker & company database</TourBullet>
          <TourBullet color="#171717"><strong>Payments</strong> — all transactions & cash register</TourBullet>
          <TourBullet color="#171717"><strong>Reports</strong> — revenue & occupancy analytics</TourBullet>
          <TourBullet color="#171717"><strong>Settings</strong> — hotel config, rooms & rates</TourBullet>
          <div style={{ marginTop: 6, fontSize: 12, color: '#a3a3a3' }}>Tip: collapse the sidebar with the arrow button for more screen space.</div>
        </div>
      ),
      position: 'right',
    },
  ],
};

const SpotlightTour = ({ tourId, onComplete }) => {
  const steps = TOUR_DEFINITIONS[tourId];
  if (!steps || steps.length === 0) { if (onComplete) onComplete(); return null; }

  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const [tipPos, setTipPos] = React.useState(null);
  const tipRef = React.useRef(null);
  const closeRef = React.useRef(null);

  const cur = steps[step];
  const pad = 12;

  const close = () => {
    try { localStorage.setItem(lsKey(`tourCompleted_${tourId}`), 'true'); } catch (e) {}
    if (onComplete) onComplete();
  };
  closeRef.current = close;

  // Keyboard: Escape to close, Arrow keys to navigate
  React.useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); closeRef.current(); }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); setStep(s => s < steps.length - 1 ? s + 1 : s); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setStep(s => s > 0 ? s - 1 : s); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [steps.length]);

  // Measure target element
  React.useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      if (!cur.target) { setRect(null); return; }
      const el = document.querySelector(cur.target);
      if (el && el.offsetWidth > 0) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
        }, 300);
      } else {
        setRect(null);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => { cancelled = true; window.removeEventListener('resize', measure); };
  }, [step]);

  // Position tooltip relative to target
  React.useEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const frame = requestAnimationFrame(() => {
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 16;

      if (!rect || cur.position === 'center') {
        setTipPos({ left: Math.max(16, (vw - tw) / 2), top: Math.max(16, (vh - th) / 2) });
        return;
      }

      let left, top;
      const pos = cur.position || 'bottom';

      if (pos === 'bottom') {
        left = rect.left + (rect.width - tw) / 2;
        top = rect.top + rect.height + pad + gap;
        if (top + th > vh - 16) top = rect.top - pad - gap - th;
      } else if (pos === 'top') {
        left = rect.left + (rect.width - tw) / 2;
        top = rect.top - pad - gap - th;
        if (top < 16) top = rect.top + rect.height + pad + gap;
      } else if (pos === 'right') {
        left = rect.left + rect.width + pad + gap;
        top = rect.top + (rect.height - th) / 2;
        if (left + tw > vw - 16) left = rect.left - pad - gap - tw;
      } else if (pos === 'left') {
        left = rect.left - pad - gap - tw;
        top = rect.top + (rect.height - th) / 2;
        if (left < 16) left = rect.left + rect.width + pad + gap;
      }

      left = Math.max(16, Math.min(left, vw - tw - 16));
      top = Math.max(16, Math.min(top, vh - th - 16));
      setTipPos({ left, top });
    });
    return () => cancelAnimationFrame(frame);
  }, [rect, step]);

  // Handle last step → finish
  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else close();
  };
  const prev = () => { if (step > 0) setStep(step - 1); };

  // Spotlight cutout dimensions
  const sx = rect ? rect.left - pad : 0;
  const sy = rect ? rect.top - pad : 0;
  const sw = rect ? rect.width + pad * 2 : 0;
  const sh = rect ? rect.height + pad * 2 : 0;

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }}>
      {/* Click shield — clicking dark area dismisses tour */}
      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'pointer' }} />

      {/* Dark overlay with spotlight cutout (box-shadow trick) */}
      {rect ? (
        <div style={{
          position: 'fixed', zIndex: 9991,
          left: sx, top: sy, width: sw, height: sh,
          borderRadius: 16,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.12)',
          pointerEvents: 'none',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      ) : (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9991,
          background: 'rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Tooltip card */}
      <div
        ref={tipRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-[400px]"
        style={{
          position: 'fixed', zIndex: 10000,
          left: tipPos ? tipPos.left : '50%',
          top: tipPos ? tipPos.top : '50%',
          padding: '24px',
          opacity: tipPos ? 1 : 0,
          transition: 'left 0.4s cubic-bezier(0.4,0,0.2,1), top 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
          width: 'calc(100vw - 32px)',
          maxWidth: 400,
        }}
      >
        {/* Header: step counter + skip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="text-xs font-medium text-neutral-400">{step + 1} of {steps.length}</span>
          <button onClick={close} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
            Skip tour
          </button>
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold text-neutral-900 mb-1.5" style={{ lineHeight: 1.3 }}>{cur.title}</h3>
        <div className="text-sm text-neutral-500 leading-relaxed mb-5">{cur.description}</div>

        {/* Footer: progress dots + nav buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                height: 8,
                borderRadius: 4,
                transition: 'all 0.3s ease',
                width: i === step ? 20 : 8,
                background: i === step ? '#171717' : i < step ? '#a3a3a3' : '#e5e7eb',
              }} />
            ))}
          </div>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={prev}
                className="px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors">
                Back
              </button>
            )}
            <button onClick={next}
              className="px-4 py-1.5 text-sm font-medium bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors shadow-lg">
              {step === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};