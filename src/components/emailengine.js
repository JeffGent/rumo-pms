/*
 * -- PRODUCTION CHECKLIST -- Communication System ---------------------
 * EMAIL DELIVERY:
 * [] Choose email service provider (Resend / Postmark / AWS SES)
 * [] Set up sending domain + DNS records (SPF, DKIM, DMARC)
 * [] Implement actual email sending in emailPreview "Send" handler
 * [] Add email delivery status webhooks (delivered/bounced/opened)
 *
 * GUEST PORTAL:
 * [] Deploy portal as separate route/app with custom domain support
 * [] Add SSL auto-provisioning for custom portal domains
 * [] Implement online check-in form, payment request, digital key
 * [] Add rate limiting server-side (Supabase edge function)
 *
 * AUTO-SEND:
 * [] Build scheduler service (Supabase Edge Function or cron)
 * [] Check for upcoming check-ins and trigger pre-checkin emails
 * [] Implement retry logic for failed sends
 *
 * SECURITY:
 * [] Portal codes: add Supabase RLS limiting reads to valid codes only
 * [] Rate limiting on code validation endpoint
 * [] Sanitize user-provided HTML in custom email templates (XSS)
 */

import globals from '../globals.js';
import { ReservationService } from '../services.js';
import { getHotelAddress, getRoomTypeName, saveEmailTemplates, lsKey } from '../config.js';

// -- Email Template Engine ----------------------------------------------------

/** Resolve all {{variable}} placeholders in a template string */
export const resolveTemplateVariables = (templateString, reservation, extraData = {}) => {
  if (!templateString) return '';

  const res = reservation || {};
  const rooms = res.rooms || [];
  // Support per-room resolution: extraData._roomIndex overrides which room is used for variables
  const ri = (extraData._roomIndex != null && rooms[extraData._roomIndex]) ? extraData._roomIndex : 0;
  const r0 = rooms[ri] || {};
  const booker = res.booker || {};
  const eb = globals.hotelSettings.emailBranding || {};
  const ps = globals.hotelSettings.portalSettings || {};

  // Calculate totals
  const totals = ReservationService.calculateBillingTotals(res);
  const numNights = r0.checkin && r0.checkout
    ? Math.max(1, Math.round((new Date(r0.checkout) - new Date(r0.checkin)) / 86400000))
    : 0;

  // For portal link: use guest last name + room number when sending per-room
  const portalGuest = r0.guests?.[0];
  const portalLastName = portalGuest?.lastName || booker.lastName || '';
  const portalRoomNumber = rooms.length > 1 ? r0.roomNumber : null;

  const vars = {
    // General
    hotel_name: globals.hotelSettings.hotelName || '',
    company_name: globals.hotelSettings.companyName || globals.hotelSettings.hotelName || '',
    hotel_address: getHotelAddress(),
    hotel_email: globals.hotelSettings.hotelEmail || '',
    hotel_phone: globals.hotelSettings.hotelPhone || '',
    hotel_logo: eb.logoUrl ? `<img src="${eb.logoUrl}" alt="${globals.hotelSettings.hotelName}" style="max-height:60px;max-width:200px;" />` : '',
    primary_color: eb.primaryColor || '#171717',
    accent_color: eb.accentColor || '#f59e0b',
    background_color: eb.backgroundColor || '#ffffff',
    footer_text: eb.footerText || `${globals.hotelSettings.hotelName} · ${getHotelAddress()}`,
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
    rate_plan: (() => { const rp = globals.ratePlans.find(p => p.id === r0.ratePlanId); return rp?.name || ''; })(),
    total_price: totals.totalAmount.toFixed(2),
    currency: globals.hotelSettings.currency || 'EUR',
    extras_list: (res.extras || []).map(e => `${e.name} x${e.quantity} — ${globals.hotelSettings.currency || 'EUR'} ${(e.quantity * e.unitPrice).toFixed(2)}`).join('\n') || 'None',
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

    // Portal -- uses guest last name + room number for per-room portal links
    portal_code: res.bookingRef || '',
    portal_url: res.bookingRef ? getPortalUrl(res.bookingRef, portalLastName, portalRoomNumber) : '',
    portal_link: res.bookingRef ? getPortalUrl(res.bookingRef, portalLastName, portalRoomNumber) : '',
    payment_link: res.bookingRef ? getPortalUrl(res.bookingRef, portalLastName, portalRoomNumber) : '',

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

/** Get the full portal URL for a booking reference + optional name/room for auto-fill */
export const getPortalUrl = (code, lastName, roomNumber) => {
  const ps = globals.hotelSettings.portalSettings || {};
  const nameParam = lastName ? `&name=${encodeURIComponent(lastName)}` : '';
  const roomParam = roomNumber ? `&room=${encodeURIComponent(roomNumber)}` : '';
  if (ps.portalDomain) return `https://${ps.portalDomain}/go?code=${code}${nameParam}${roomParam}`;
  if (ps.portalSlug) return `https://portal.rumo.be/${ps.portalSlug}/go?code=${code}${nameParam}${roomParam}`;
  return `${window.location.origin}${window.location.pathname}#/go?code=${code}${nameParam}${roomParam}`;
};

/** Send an email via the PHP relay endpoint */
export const sendEmailViaRelay = async (to, subject, html, fromName) => {
  const ps = globals.hotelSettings.portalSettings || {};
  // Determine relay URL: custom domain, or same-origin /api/, or localhost fallback
  const relayBase = ps.emailRelayUrl
    || (window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost'
        ? `${window.location.origin}/api/send-email.php`
        : null);

  if (!relayBase) {
    console.warn('[Email] No relay URL configured and running on localhost — simulating send');
    return { success: true, simulated: true };
  }

  const res = await fetch(relayBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      subject,
      html,
      from_name: fromName || globals.hotelSettings.hotelName || 'Hotel',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
};

/** Strip HTML tags to generate a reasonable plaintext version */
export const htmlToPlaintext = (html) => {
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

// -- Default HTML Email Templates (table-based, inline-styled) ----------------
// Design: mirrors the guest portal -- clean, spacious, no visible borders on detail grids,
// Georgia serif headings, muted uppercase labels, whitespace instead of lines.

export const buildEmailHtml = (bodyContent) => {
  const eb = globals.hotelSettings.emailBranding || {};
  const bg = eb.backgroundColor || '#ffffff';
  const hotelName = globals.hotelSettings.hotelName || 'Hotel';
  const address = getHotelAddress();
  const logo = eb.logoUrl
    ? `<img src="${eb.logoUrl}" alt="${hotelName}" style="max-height:44px;max-width:160px;display:block;margin:0 auto;" />`
    : '';
  // WhatsApp deep link (strip formatting, drop leading +)
  const waPhone = (globals.hotelSettings.hotelPhone || '').replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
  const waUrl = waPhone ? `https://wa.me/${waPhone}` : '';
  // Google Maps link
  const mapsUrl = address ? `https://maps.google.com/?q=${encodeURIComponent(hotelName + ', ' + address)}` : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;font-family:system-ui,-apple-system,Arial,Helvetica,sans-serif;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:${bg};border-radius:20px;">
  <!-- Header: logo only -->
  ${logo ? `<tr><td align="center" style="padding:40px 44px 0;">${logo}</td></tr>` : ''}
  <!-- Body -->
  <tr><td style="padding:${logo ? '28' : '40'}px 44px 0;color:#333;">${bodyContent}</td></tr>
  <!-- Contact section -->
  <tr><td style="padding:0 44px;">
    <div style="border-top:1px solid #f0f0f0;margin:28px 0 24px;"></div>
    <p style="font-size:13px;color:#999;text-align:center;margin:0 0 16px;">Questions? Don't hesitate to reach out.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        ${waUrl ? `<td style="padding:0 6px;">
          <a href="${waUrl}" target="_blank" style="display:inline-block;padding:10px 20px;border:1px solid #e5e5e5;border-radius:10px;text-decoration:none;color:#555;font-size:13px;font-weight:500;">
            WhatsApp
          </a>
        </td>` : ''}
        <td style="padding:0 6px;">
          <a href="mailto:${globals.hotelSettings.hotelEmail || ''}" style="display:inline-block;padding:10px 20px;border:1px solid #e5e5e5;border-radius:10px;text-decoration:none;color:#555;font-size:13px;font-weight:500;">
            Email
          </a>
        </td>
      </tr></table>
    </td></tr></table>
  </td></tr>
  <!-- Footer: maps + address -->
  <tr><td align="center" style="padding:28px 44px 36px;">
    <div style="border-top:1px solid #f0f0f0;margin:0 0 24px;"></div>
    ${mapsUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td align="center">
      <a href="${mapsUrl}" target="_blank" style="display:inline-block;padding:10px 24px;border:1px solid #e5e5e5;border-radius:10px;text-decoration:none;color:#555;font-size:13px;font-weight:500;">
        View on Google Maps
      </a>
    </td></tr></table>` : ''}
    <div style="font-family:Georgia,serif;font-size:14px;color:#999;margin-bottom:4px;">${hotelName}</div>
    <div style="font-size:12px;color:#bbb;line-height:1.5;">${address}</div>
    <div style="font-size:10px;color:#ddd;margin-top:16px;">Powered by Rumo</div>
  </td></tr>
</table>
</td></tr></table>`;
};

const DEFAULT_CONFIRMATION_HTML = () => buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:24px;color:#111;margin:0 0 6px;font-weight:normal;">Your reservation is confirmed</h2>
<p style="font-size:14px;line-height:1.7;color:#777;margin:0 0 32px;">Dear {{booker_firstname}}, thank you for your booking.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-in</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkin_date}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-out</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkout_date}}</div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Room</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{room_type}}</div>
      <div style="font-size:12px;color:#aaa;margin-top:2px;">Room {{room_number}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Nights</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{num_nights}}</div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Booking Ref</div>
      <div style="font-size:15px;font-weight:600;color:#111;font-family:monospace;letter-spacing:1px;">{{booking_ref}}</div>
    </td>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Total</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{currency}} {{total_price}}</div>
    </td>
  </tr>
</table>

<div style="border-top:1px solid #f0f0f0;margin:20px 0 28px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td align="center">
  <a href="{{portal_link}}" style="display:inline-block;padding:14px 40px;background:{{primary_color}};color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">View Your Reservation</a>
</td></tr></table>
<p style="font-size:11px;color:#ccc;text-align:center;margin:0;">Portal code: <span style="font-family:monospace;letter-spacing:2px;color:#aaa;">{{portal_code}}</span></p>
`);

const DEFAULT_PRECHECKIN_HTML = () => buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:24px;color:#111;margin:0 0 6px;font-weight:normal;">Prepare your stay</h2>
<p style="font-size:14px;line-height:1.7;color:#777;margin:0 0 32px;">Dear {{booker_firstname}}, your check-in is coming up on <span style="color:#111;font-weight:600;">{{checkin_date}}</span>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td align="center" style="padding:32px 24px;background:#fafafa;border-radius:16px;">
  <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Your Access Code</div>
  <div style="font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:5px;color:#111;">{{portal_code}}</div>
</td></tr></table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-in</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkin_date}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-out</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkout_date}}</div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Room</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{room_type}}</div>
      <div style="font-size:12px;color:#aaa;margin-top:2px;">Room {{room_number}}</div>
    </td>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Nights</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{num_nights}}</div>
    </td>
  </tr>
</table>

<div style="border-top:1px solid #f0f0f0;margin:20px 0 28px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td align="center">
  <a href="{{portal_link}}" style="display:inline-block;padding:14px 40px;background:{{primary_color}};color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">Open Guest Portal</a>
</td></tr></table>
<p style="font-size:14px;color:#999;text-align:center;margin:8px 0 0;">We look forward to welcoming you!</p>
`);

const DEFAULT_INVOICE_HTML = () => buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:24px;color:#111;margin:0 0 4px;font-weight:normal;">Invoice {{invoice_number}}</h2>
<p style="font-size:13px;color:#aaa;margin:0 0 32px;">{{invoice_date}}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Bill to</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{company_name}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">VAT Number</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{company_vat}}</div>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Booking Ref</div>
      <div style="font-size:15px;font-weight:600;color:#111;font-family:monospace;letter-spacing:1px;">{{booking_ref}}</div>
    </td>
  </tr>
</table>

<div style="border-top:1px solid #f0f0f0;margin:20px 0 24px;"></div>

<div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Items</div>
<div style="font-size:13px;white-space:pre-line;color:#555;line-height:1.9;margin-bottom:24px;">{{invoice_lines}}</div>

<div style="border-top:1px solid #f0f0f0;margin:0 0 20px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#777;">
  <tr><td style="padding:4px 0;">Subtotal</td><td align="right" style="padding:4px 0;">{{currency}} {{invoice_subtotal}}</td></tr>
  <tr><td style="padding:4px 0;">VAT</td><td align="right" style="padding:4px 0;">{{currency}} {{invoice_vat}}</td></tr>
</table>
<div style="border-top:1px solid #f0f0f0;margin:12px 0;"></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="font-size:17px;font-weight:600;color:#111;padding:0;">Total</td><td align="right" style="font-size:17px;font-weight:600;color:#111;padding:0;">{{currency}} {{invoice_total}}</td></tr>
</table>
`);

const DEFAULT_CHECKOUT_HTML = () => buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:24px;color:#111;margin:0 0 6px;font-weight:normal;">Thank you for your stay</h2>
<p style="font-size:14px;line-height:1.7;color:#777;margin:0 0 32px;">Dear {{booker_firstname}}, we hope you enjoyed your time at {{hotel_name}}.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-in</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkin_date}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-out</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkout_date}}</div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Room</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{room_type}}</div>
      <div style="font-size:12px;color:#aaa;margin-top:2px;">Room {{room_number}}</div>
    </td>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Nights</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{num_nights}}</div>
    </td>
  </tr>
</table>

<div style="border-top:1px solid #f0f0f0;margin:20px 0 28px;"></div>

<p style="font-size:14px;color:#999;text-align:center;margin:0;">We hope to welcome you again soon.</p>
`);

const DEFAULT_CANCELLATION_HTML = () => buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:24px;color:#111;margin:0 0 6px;font-weight:normal;">Reservation cancelled</h2>
<p style="font-size:14px;line-height:1.7;color:#777;margin:0 0 32px;">Dear {{booker_firstname}}, your reservation has been cancelled as requested.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-in</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkin_date}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-out</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkout_date}}</div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Room</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{room_type}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Booking Ref</div>
      <div style="font-size:15px;font-weight:600;color:#111;font-family:monospace;letter-spacing:1px;">{{booking_ref}}</div>
    </td>
  </tr>
</table>

<div style="border-top:1px solid #f0f0f0;margin:20px 0 28px;"></div>

<p style="font-size:14px;line-height:1.7;color:#777;margin:0 0 8px;">If you have any questions about this cancellation or wish to rebook, please don't hesitate to contact us.</p>
`);

const DEFAULT_CC_REQUEST_HTML = () => buildEmailHtml(`
<h2 style="font-family:Georgia,serif;font-size:24px;color:#111;margin:0 0 6px;font-weight:normal;">Credit card required</h2>
<p style="font-size:14px;line-height:1.7;color:#777;margin:0 0 32px;">Dear {{booker_firstname}}, to guarantee your reservation we kindly ask you to provide your credit card details.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-in</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkin_date}}</div>
    </td>
    <td width="50%" style="padding:0 0 24px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Check-out</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{checkout_date}}</div>
    </td>
  </tr>
  <tr>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Room</div>
      <div style="font-size:15px;font-weight:600;color:#111;">{{room_type}}</div>
      <div style="font-size:12px;color:#aaa;margin-top:2px;">Room {{room_number}}</div>
    </td>
    <td width="50%" style="padding:0 0 4px;vertical-align:top;">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Booking Ref</div>
      <div style="font-size:15px;font-weight:600;color:#111;font-family:monospace;letter-spacing:1px;">{{booking_ref}}</div>
    </td>
  </tr>
</table>

<div style="border-top:1px solid #f0f0f0;margin:20px 0 28px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td align="center">
  <a href="{{portal_link}}" style="display:inline-block;padding:14px 40px;background:{{primary_color}};color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">Provide Card Details</a>
</td></tr></table>
<p style="font-size:12px;color:#aaa;text-align:center;margin:8px 0 0;">Your card details are securely encrypted and only used to guarantee your reservation.</p>
`);

// Apply defaults to templates without HTML, or refresh non-custom templates to latest design
export const initEmailTemplates = () => {
  const defaults = {
    'tpl-confirmation': DEFAULT_CONFIRMATION_HTML(),
    'tpl-precheckin': DEFAULT_PRECHECKIN_HTML(),
    'tpl-invoice': DEFAULT_INVOICE_HTML(),
    'tpl-checkout': DEFAULT_CHECKOUT_HTML(),
    'tpl-cancellation': DEFAULT_CANCELLATION_HTML(),
    'tpl-cc-request': DEFAULT_CC_REQUEST_HTML(),
  };
  const TEMPLATE_VERSION = 7; // bump to force-refresh default templates
  // Rename map: update display names for existing templates
  const renames = { 'tpl-precheckin': 'Prepare check-in', 'tpl-checkout': 'Stay feedback' };
  // New template definitions to inject if missing from existing localStorage
  const newTemplates = {
    'tpl-cancellation': { id: 'tpl-cancellation', name: 'Cancellation', type: 'cancellation', defaultRecipient: 'booker', subject: 'Reservation Cancelled — {{hotel_name}}', bodyHtml: '', bodyPlaintext: 'RESERVATION CANCELLED\n======================================\n\nDear {{booker_firstname}},\n\nYour reservation at {{hotel_name}} has been cancelled.\n\nBooking Ref: {{booking_ref}}\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}\nRoom: {{room_type}}\n\nIf you have questions, please contact us.\n\n{{footer_text}}\n', isCustomHtml: false, active: true, autoSend: false, triggerEvent: 'manual', triggerOffset: 0, translations: {}, updatedAt: Date.now() },
    'tpl-cc-request': { id: 'tpl-cc-request', name: 'Credit Card Request', type: 'cc-request', defaultRecipient: 'booker', subject: 'Credit card required — {{hotel_name}}', bodyHtml: '', bodyPlaintext: 'CREDIT CARD REQUIRED\n======================================\n\nDear {{booker_firstname}},\n\nTo guarantee your reservation at {{hotel_name}}, please provide your credit card details.\n\nBooking Ref: {{booking_ref}}\nCheck-in: {{checkin_date}}\nRoom: {{room_type}} ({{room_number}})\n\nVisit your guest portal: {{portal_url}}\n\n{{footer_text}}\n', isCustomHtml: false, active: true, autoSend: false, triggerEvent: 'manual', triggerOffset: 0, translations: {}, updatedAt: Date.now() },
  };
  let changed = false;
  // Inject missing templates
  Object.entries(newTemplates).forEach(([id, tpl]) => {
    if (!globals.emailTemplates.find(t => t.id === id)) {
      globals.emailTemplates.push(tpl);
      changed = true;
    }
  });
  globals.emailTemplates.forEach(tpl => {
    if (renames[tpl.id] && tpl.name !== renames[tpl.id]) {
      tpl.name = renames[tpl.id];
      changed = true;
    }
    if (defaults[tpl.id] && !tpl.isCustomHtml && (tpl._tplVersion || 0) < TEMPLATE_VERSION) {
      tpl.bodyHtml = defaults[tpl.id];
      tpl._tplVersion = TEMPLATE_VERSION;
      changed = true;
    }
  });
  if (changed) saveEmailTemplates();
};
