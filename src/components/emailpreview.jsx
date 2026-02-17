import React, { useState } from 'react';
import globals from '../globals.js';
import { SUPPORTED_LANGUAGES } from '../config.js';
import { resolveTemplateVariables, sendEmailViaRelay } from './emailengine.js';

// -- Email Preview / Send Modal -----------------------------------------------
// Shows rendered email, editable recipient, HTML/plaintext toggle, send button.
// Sends via PHP relay endpoint (sendEmailViaRelay from emailengine.js).
// Smart recipient: uses template.defaultRecipient to pre-fill booker or guest email.
// For group reservations with defaultRecipient 'guests': sends per-room emails.

const EmailPreviewModal = ({ templateId, reservation, extraData, onClose, onSend }) => {
  const template = globals.emailTemplates.find(t => t.id === templateId);
  if (!template) return null;

  const rooms = reservation?.rooms || [];
  const bookerEmail = reservation?.booker?.email || '';
  const isGroupRes = rooms.length > 1;
  const isGuestTemplate = template.defaultRecipient === 'guests';

  // For guest-targeted templates on group reservations: build per-room recipients
  const buildPerRoomRecipients = () => {
    if (!isGroupRes || !isGuestTemplate) return null;
    return rooms.map((room, ri) => {
      const mainGuest = room.guests?.[0];
      const email = mainGuest?.email || '';
      const name = mainGuest ? `${mainGuest.firstName || ''} ${mainGuest.lastName || ''}`.trim() : '';
      const lang = mainGuest?.language || reservation?.booker?.language || globals.hotelSettings.defaultLanguage || 'en';
      return { roomIndex: ri, roomNumber: room.roomNumber, email, name, language: lang };
    }).filter(r => r.email); // only rooms with a guest email
  };

  const perRoomRecipients = buildPerRoomRecipients();
  const isPerRoom = perRoomRecipients && perRoomRecipients.length > 0;

  // Smart single recipient (for non-group or booker-targeted templates)
  const getDefaultRecipient = () => {
    if (isGuestTemplate && !isPerRoom) {
      const guestEmails = [];
      rooms.forEach(room => {
        (room.guests || []).forEach(g => {
          if (g.email && !guestEmails.includes(g.email)) guestEmails.push(g.email);
        });
      });
      const nonBookerEmails = guestEmails.filter(e => e !== bookerEmail);
      if (nonBookerEmails.length > 0) return nonBookerEmails.join(', ');
      if (guestEmails.length > 0) return guestEmails[0];
    }
    return bookerEmail;
  };

  // Determine default language
  const getDefaultLanguage = () => {
    if (isGuestTemplate) {
      const guestLang = rooms[0]?.guests?.[0]?.language;
      if (guestLang) return guestLang;
    }
    return reservation?.booker?.language || globals.hotelSettings.defaultLanguage || 'en';
  };

  const [recipientEmail, setRecipientEmail] = useState(isPerRoom ? '' : getDefaultRecipient());
  const [selectedLang, setSelectedLang] = useState(getDefaultLanguage());
  const [usePlaintext, setUsePlaintext] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  // For per-room mode: track which rooms to send to
  const [roomSendList, setRoomSendList] = useState(() =>
    isPerRoom ? perRoomRecipients.map(r => ({ ...r, enabled: true })) : []
  );

  // Resolve template with language-specific content
  const getTplField = (field, lang) => {
    const l = lang || selectedLang;
    const tr = template.translations?.[l];
    if (tr && tr[field]) return tr[field];
    return template[field] || '';
  };

  // Resolved content for single-send mode (or preview)
  const previewRoomIndex = isPerRoom ? (roomSendList.find(r => r.enabled)?.roomIndex || 0) : 0;
  const previewExtraData = { ...extraData, _roomIndex: isPerRoom ? previewRoomIndex : (extraData._roomIndex || 0) };
  const resolvedHtml = resolveTemplateVariables(getTplField('bodyHtml'), reservation, previewExtraData);
  const resolvedPlaintext = resolveTemplateVariables(getTplField('bodyPlaintext'), reservation, previewExtraData);
  const resolvedSubject = resolveTemplateVariables(getTplField('subject'), reservation, previewExtraData);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setSendError('');

    const logEntries = [];

    if (isPerRoom) {
      // Send a separate email per room
      const toSend = roomSendList.filter(r => r.enabled && r.email);
      if (toSend.length === 0) { setSending(false); return; }

      for (const r of toSend) {
        const lang = r.language || selectedLang;
        const roomExtra = { ...extraData, _roomIndex: r.roomIndex };
        const html = resolveTemplateVariables(getTplField('bodyHtml', lang), reservation, roomExtra);
        const subject = resolveTemplateVariables(getTplField('subject', lang), reservation, roomExtra);

        try {
          const result = await sendEmailViaRelay(r.email, subject, html);
          if (result.simulated) console.log(`[Email] Simulated send to ${r.email} (room ${r.roomNumber})`);
          logEntries.push({
            id: Date.now() + r.roomIndex,
            templateId: template.id,
            templateName: template.name,
            sentAt: new Date().toISOString(),
            sentTo: r.email,
            subject,
            status: 'sent',
            language: lang,
            sentBy: globals.currentUser?.name || 'System',
            roomNumber: r.roomNumber,
            _roomIndex: r.roomIndex,
          });
        } catch (e) {
          console.error(`[Email] Send failed for room ${r.roomNumber}:`, e);
          setSendError(`Failed to send to ${r.email}: ${e.message || 'Unknown error'}`);
          logEntries.push({
            id: Date.now() + r.roomIndex,
            templateId: template.id,
            templateName: template.name,
            sentAt: new Date().toISOString(),
            sentTo: r.email,
            subject,
            status: 'failed',
            language: lang,
            sentBy: globals.currentUser?.name || 'System',
            roomNumber: r.roomNumber,
            _roomIndex: r.roomIndex,
          });
        }
      }
    } else {
      // Single send
      if (!recipientEmail) { setSending(false); return; }
      const html = resolveTemplateVariables(getTplField('bodyHtml'), reservation, extraData);
      const subject = resolveTemplateVariables(getTplField('subject'), reservation, extraData);

      try {
        const result = await sendEmailViaRelay(recipientEmail, subject, html);
        if (result.simulated) console.log('[Email] Simulated send (localhost)');
        logEntries.push({
          id: Date.now(),
          templateId: template.id,
          templateName: template.name,
          sentAt: new Date().toISOString(),
          sentTo: recipientEmail,
          subject,
          status: 'sent',
          language: selectedLang,
          sentBy: globals.currentUser?.name || 'System',
        });
      } catch (e) {
        console.error('[Email] Send failed:', e);
        setSendError(`Failed to send: ${e.message || 'Unknown error'}`);
        setSending(false);
        return;
      }
    }

    setSending(false);
    logEntries.forEach(entry => { if (onSend) onSend(entry); });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Send: {template.name}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">Subject: {resolvedSubject}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Recipient + language + toggle */}
        <div className="px-5 py-3 border-b border-neutral-100">
          {isPerRoom ? (
            <>
              <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">Sending per room</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {roomSendList.map((r, i) => (
                  <label key={r.roomNumber} className="flex items-center gap-2.5 text-xs cursor-pointer hover:bg-neutral-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                    <input type="checkbox" checked={r.enabled}
                      onChange={() => setRoomSendList(prev => prev.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}
                      className="rounded" />
                    <span className="font-medium text-neutral-900 w-14">Room {r.roomNumber}</span>
                    <span className="text-neutral-500 flex-1 truncate">{r.email}</span>
                    <span className="text-neutral-400">{r.name}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-neutral-500 flex-shrink-0">To:</label>
              <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <label className="text-xs font-medium text-neutral-500 flex-shrink-0">Lang:</label>
            <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)}
              className="px-2 py-1 text-[11px] border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer appearance-none">
              {(SUPPORTED_LANGUAGES || []).map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 text-xs text-neutral-500 flex-shrink-0 cursor-pointer">
              <input type="checkbox" checked={usePlaintext} onChange={() => setUsePlaintext(!usePlaintext)} className="rounded" />
              Plain text
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto">
          {usePlaintext ? (
            <pre className="p-5 text-xs font-mono whitespace-pre-wrap text-neutral-700 leading-relaxed">{resolvedPlaintext}</pre>
          ) : (
            <iframe srcDoc={resolvedHtml} style={{width: '100%', height: 450, border: 'none'}} sandbox="" title="Email Preview" />
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50">
          {sendError && <div className="text-xs text-red-500 mb-2">{sendError}</div>}
          <div className="flex items-center justify-between">
            <button onClick={() => { navigator.clipboard.writeText(resolvedPlaintext); }}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors">
              Copy Plain Text
            </button>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSend} disabled={sending || (isPerRoom ? !roomSendList.some(r => r.enabled) : !recipientEmail)}
                className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40">
                <span className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  {sending ? 'Sending...' : isPerRoom ? `Send to ${roomSendList.filter(r => r.enabled).length} rooms` : 'Send Email'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailPreviewModal;
