/*
 * ── PRODUCTION CHECKLIST — Communication System ────────────────────────
 * EMAIL DELIVERY:
 * □ Choose email service provider (Resend / Postmark / AWS SES)
 * □ Set up sending domain + DNS records (SPF, DKIM, DMARC)
 * □ Implement actual email sending in emailPreview "Send" handler
 * □ Add email delivery status webhooks (delivered/bounced/opened)
 *
 * GUEST PORTAL:
 * □ Deploy portal as separate route/app with custom domain support
 * □ Add SSL auto-provisioning for custom portal domains
 * □ Implement online check-in form, payment request, digital key
 * □ Add rate limiting server-side (Supabase edge function)
 *
 * AUTO-SEND:
 * □ Build scheduler service (Supabase Edge Function or cron)
 * □ Check for upcoming check-ins and trigger pre-checkin emails
 * □ Implement retry logic for failed sends
 *
 * SECURITY:
 * □ Portal codes: add Supabase RLS limiting reads to valid codes only
 * □ Rate limiting on code validation endpoint
 * □ Sanitize user-provided HTML in custom email templates (XSS)
 */

// ── Email Template Engine ───────────────────────────────────────────────────

/** Resolve all {{variable}} placeholders in a template string */
const resolveTemplateVariables = (templateString, reservation, extraData = {}) => {
  if (!templateString) return '';

  const res = reservation || {};
  const rooms = res.rooms || [];
  const r0 = rooms[0] || {};
  const booker = res.booker || {};
  const eb = hotelSettings.emailBranding || {};
  const ps = hotelSettings.portalSettings || {};

  // Calculate totals
  const totals = ReservationService.calculateBillingTotals(res);
  const numNights = r0.checkin && r0.checkout
    ? Math.max(1, Math.round((new Date(r0.checkout) - new Date(r0.checkin)) / 86400000))
    : 0;

  const vars = {
    // General
    hotel_name: hotelSettings.hotelName || '',
    hotel_address: getHotelAddress(),
    hotel_email: hotelSettings.hotelEmail || '',
    hotel_phone: hotelSettings.hotelPhone || '',
    hotel_logo: eb.logoUrl ? `<img src="${eb.logoUrl}" alt="${hotelSettings.hotelName}" style="max-height:60px;max-width:200px;" />` : '',
    primary_color: eb.primaryColor || '#171717',
    accent_color: eb.accentColor || '#f59e0b',
    background_color: eb.backgroundColor || '#ffffff',
    footer_text: eb.footerText || `${hotelSettings.hotelName} · ${getHotelAddress()}`,
    current_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    current_year: String(new Date().getFullYear()),

    // Reservation
    booking_ref: res.bookingRef || '',
    checkin_date: r0.checkin ? new Date(r0.checkin).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
    checkout_date: r0.checkout ? new Date(r0.checkout).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
    num_nights: String(numNights),
    num_rooms: String(rooms.length),
    room_type: r0.roomType || getRoomTypeName(r0.roomNumber) || '',
    room_number: r0.roomNumber || '',
    rate_plan: (() => { const rp = ratePlans.find(p => p.id === r0.ratePlanId); return rp?.name || ''; })(),
    total_price: totals.totalAmount.toFixed(2),
    currency: hotelSettings.currency || 'EUR',
    extras_list: (res.extras || []).map(e => `${e.name} x${e.quantity} — ${hotelSettings.currency || 'EUR'} ${(e.quantity * e.unitPrice).toFixed(2)}`).join('\n') || 'None',
    special_requests: res.specialRequests || '',

    // Guest / Booker
    guest_firstname: r0.guests?.[0]?.firstName || booker.firstName || '',
    guest_lastname: r0.guests?.[0]?.lastName || booker.lastName || '',
    guest_fullname: (() => { const g = r0.guests?.[0]; return g ? `${g.firstName || ''} ${g.lastName || ''}`.trim() : `${booker.firstName || ''} ${booker.lastName || ''}`.trim(); })(),
    booker_firstname: booker.firstName || '',
    booker_lastname: booker.lastName || '',
    booker_fullname: `${booker.firstName || ''} ${booker.lastName || ''}`.trim(),
    booker_email: booker.email || '',

    // Billing
    paid_amount: totals.paidAmount.toFixed(2),
    outstanding_amount: totals.outstandingAmount.toFixed(2),

    // Portal
    portal_code: extraData.portalCode || r0.guestPortalCode || '',
    portal_url: extraData.portalUrl || (r0.guestPortalCode ? getPortalUrl(r0.guestPortalCode) : ''),
    portal_link: extraData.portalUrl || (r0.guestPortalCode ? getPortalUrl(r0.guestPortalCode) : ''),
    payment_link: extraData.portalUrl || (r0.guestPortalCode ? getPortalUrl(r0.guestPortalCode) : ''),

    // Invoice (from extraData)
    invoice_number: extraData.invoiceNumber || '',
    invoice_date: extraData.invoiceDate || '',
    invoice_lines: extraData.invoiceLines || '',
    invoice_total: extraData.invoiceTotal || '',
    invoice_vat: extraData.invoiceVat || '',
    invoice_subtotal: extraData.invoiceSubtotal || '',
    company_name: res.billingRecipient?.name || '',
    company_vat: res.billingRecipient?.vatNumber || '',

    // Merge any extra custom variables
    ...extraData,
  };

  return templateString.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : '';
  });
};

/** Generate a portal code for a reservation room: XX-0000 format */
const generatePortalCode = (reservation, roomIndex = 0) => {
  const room = reservation.rooms?.[roomIndex];
  if (!room) return null;

  // Letters from guest initials
  const guest = room.guests?.[0] || reservation.booker || {};
  const l1 = (guest.firstName || 'X')[0].toUpperCase();
  const l2 = (guest.lastName || 'X')[0].toUpperCase();

  // Random 4 digits
  const digits = String(Math.floor(1000 + Math.random() * 9000));

  // Check uniqueness
  let code = `${l1}${l2}-${digits}`;
  const existingCodes = new Set();
  reservations.forEach(r => (r.rooms || []).forEach(rm => { if (rm.guestPortalCode) existingCodes.add(rm.guestPortalCode); }));

  let attempts = 0;
  while (existingCodes.has(code) && attempts < 100) {
    const d = String(Math.floor(1000 + Math.random() * 9000));
    code = `${l1}${l2}-${d}`;
    attempts++;
  }

  // Return code + validity range — caller is responsible for storing on room + setState
  const ci = room.checkin ? new Date(room.checkin) : new Date();
  return {
    code,
    validFrom: new Date(ci.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    validUntil: new Date(new Date(room.checkout || ci).getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

/** Get the full portal URL for a given code */
const getPortalUrl = (code) => {
  const ps = hotelSettings.portalSettings || {};
  if (ps.portalDomain) return `https://${ps.portalDomain}/go?code=${code}`;
  if (ps.portalSlug) return `https://portal.rumo.be/${ps.portalSlug}/go?code=${code}`;
  return `${window.location.origin}${window.location.pathname}#/go?code=${code}`;
};

/** Strip HTML tags to generate a reasonable plaintext version */
const htmlToPlaintext = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/th>/gi, '\t')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '  • ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ── Default HTML Email Templates (table-based, inline-styled) ───────────────

const buildEmailHtml = (bodyContent) => {
  const eb = hotelSettings.emailBranding || {};
  const pc = eb.primaryColor || '#171717';
  const bg = eb.backgroundColor || '#ffffff';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${bg};border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <tr><td style="background-color:${pc};padding:24px 32px;text-align:center;">
    ${eb.logoUrl ? `<img src="${eb.logoUrl}" alt="${hotelSettings.hotelName || ''}" style="max-height:50px;max-width:180px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;" />` : ''}
    <div style="color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:bold;">${hotelSettings.hotelName || 'Hotel'}</div>
  </td></tr>
  <tr><td style="padding:32px;">${bodyContent}</td></tr>
  <tr><td style="padding:16px 32px;background-color:#fafafa;border-top:1px solid #e5e5e5;text-align:center;font-size:12px;color:#999;">
    {{footer_text}}<br/>&copy; {{current_year}} {{hotel_name}}
  </td></tr>
</table>
</td></tr></table>`;
};

const DEFAULT_CONFIRMATION_HTML = buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:22px;color:#111;margin:0 0 16px;">Your reservation is confirmed</h2>
<p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 24px;">Dear {{booker_firstname}},<br/>Thank you for your booking at {{hotel_name}}.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:24px;">
  <tr style="background:#fafafa;"><td style="font-weight:bold;width:140px;border-bottom:1px solid #e5e5e5;">Booking Ref</td><td style="border-bottom:1px solid #e5e5e5;">{{booking_ref}}</td></tr>
  <tr><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">Check-in</td><td style="border-bottom:1px solid #e5e5e5;">{{checkin_date}}</td></tr>
  <tr style="background:#fafafa;"><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">Check-out</td><td style="border-bottom:1px solid #e5e5e5;">{{checkout_date}}</td></tr>
  <tr><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">Room</td><td style="border-bottom:1px solid #e5e5e5;">{{room_type}} ({{room_number}})</td></tr>
  <tr style="background:#fafafa;"><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">Nights</td><td style="border-bottom:1px solid #e5e5e5;">{{num_nights}}</td></tr>
  <tr><td style="font-weight:bold;">Total</td><td><strong>{{currency}} {{total_price}}</strong></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <a href="{{portal_link}}" style="display:inline-block;padding:12px 32px;background:{{primary_color}};color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Your Reservation</a>
</td></tr></table>
<p style="font-size:12px;color:#999;text-align:center;margin-top:16px;">Portal code: <strong style="font-family:monospace;letter-spacing:2px;">{{portal_code}}</strong></p>
`);

const DEFAULT_PRECHECKIN_HTML = buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:22px;color:#111;margin:0 0 16px;">Prepare your stay</h2>
<p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 24px;">Dear {{booker_firstname}},<br/>Your check-in at {{hotel_name}} is coming up on <strong>{{checkin_date}}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td align="center" style="padding:24px;background:#fafafa;border-radius:8px;border:1px solid #e5e5e5;">
  <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Access Code</div>
  <div style="font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:4px;color:#111;">{{portal_code}}</div>
  <div style="font-size:12px;color:#999;margin-top:8px;">Enter at {{portal_url}}</div>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <a href="{{portal_link}}" style="display:inline-block;padding:12px 32px;background:{{primary_color}};color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Open Guest Portal</a>
</td></tr></table>
<p style="font-size:14px;line-height:1.6;color:#555;margin:24px 0 0;">We look forward to welcoming you!</p>
`);

const DEFAULT_INVOICE_HTML = buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:22px;color:#111;margin:0 0 4px;">Invoice {{invoice_number}}</h2>
<p style="font-size:13px;color:#999;margin:0 0 24px;">Date: {{invoice_date}}</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:16px;">
  <tr style="background:#fafafa;"><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">Bill to</td><td style="border-bottom:1px solid #e5e5e5;">{{company_name}}</td></tr>
  <tr><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">VAT</td><td style="border-bottom:1px solid #e5e5e5;">{{company_vat}}</td></tr>
  <tr style="background:#fafafa;"><td style="font-weight:bold;">Booking Ref</td><td>{{booking_ref}}</td></tr>
</table>
<div style="font-size:13px;white-space:pre-line;background:#fafafa;padding:16px;border-radius:8px;border:1px solid #e5e5e5;margin-bottom:16px;">{{invoice_lines}}</div>
<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;margin-bottom:24px;">
  <tr><td>Subtotal</td><td align="right">{{currency}} {{invoice_subtotal}}</td></tr>
  <tr><td>VAT</td><td align="right">{{currency}} {{invoice_vat}}</td></tr>
  <tr style="font-weight:bold;font-size:16px;"><td>Total</td><td align="right">{{currency}} {{invoice_total}}</td></tr>
</table>
`);

const DEFAULT_CHECKOUT_HTML = buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:22px;color:#111;margin:0 0 16px;">Thank you for your stay</h2>
<p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 24px;">Dear {{booker_firstname}},<br/>We hope you enjoyed your stay at {{hotel_name}}.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;font-size:13px;margin-bottom:24px;">
  <tr style="background:#fafafa;"><td style="font-weight:bold;width:140px;border-bottom:1px solid #e5e5e5;">Check-in</td><td style="border-bottom:1px solid #e5e5e5;">{{checkin_date}}</td></tr>
  <tr><td style="font-weight:bold;border-bottom:1px solid #e5e5e5;">Check-out</td><td style="border-bottom:1px solid #e5e5e5;">{{checkout_date}}</td></tr>
  <tr style="background:#fafafa;"><td style="font-weight:bold;">Room</td><td>{{room_type}} ({{room_number}})</td></tr>
</table>
<p style="font-size:14px;line-height:1.6;color:#555;">We hope to welcome you again soon!</p>
`);

// Apply defaults to templates without HTML
(() => {
  const defaults = {
    'tpl-confirmation': DEFAULT_CONFIRMATION_HTML,
    'tpl-precheckin': DEFAULT_PRECHECKIN_HTML,
    'tpl-invoice': DEFAULT_INVOICE_HTML,
    'tpl-checkout': DEFAULT_CHECKOUT_HTML,
  };
  let changed = false;
  emailTemplates.forEach(tpl => {
    if (!tpl.bodyHtml && defaults[tpl.id]) {
      tpl.bodyHtml = defaults[tpl.id];
      changed = true;
    }
  });
  if (changed) saveEmailTemplates();
})();
