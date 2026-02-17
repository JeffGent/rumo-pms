// ── Email Preview / Send Modal ──────────────────────────────────────────────
// Shows rendered email, editable recipient, HTML/plaintext toggle, send button.
// Actual email delivery NOT implemented — logs to reservation.emailLog[].

const EmailPreviewModal = ({ templateId, reservation, extraData, onClose, onSend }) => {
  const [recipientEmail, setRecipientEmail] = useState(reservation?.booker?.email || '');
  const [usePlaintext, setUsePlaintext] = useState(false);

  const template = emailTemplates.find(t => t.id === templateId);
  if (!template) return null;

  const resolvedHtml = resolveTemplateVariables(template.bodyHtml, reservation, extraData);
  const resolvedPlaintext = resolveTemplateVariables(template.bodyPlaintext, reservation, extraData);
  const resolvedSubject = resolveTemplateVariables(template.subject, reservation, extraData);

  const handleSend = () => {
    // TODO PRODUCTION: Replace with actual email API call (Resend/Postmark/SES)
    const logEntry = {
      id: Date.now(),
      templateId: template.id,
      templateName: template.name,
      sentAt: new Date().toISOString(),
      sentTo: recipientEmail,
      subject: resolvedSubject,
      status: 'sent',
      sentBy: currentUser?.name || 'System',
    };
    if (onSend) onSend(logEntry);
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

        {/* Recipient + toggle */}
        <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3">
          <label className="text-xs font-medium text-neutral-500 flex-shrink-0">To:</label>
          <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 flex-shrink-0 cursor-pointer">
            <input type="checkbox" checked={usePlaintext} onChange={() => setUsePlaintext(!usePlaintext)} className="rounded" />
            Plain text
          </label>
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200 bg-neutral-50">
          <button onClick={() => { navigator.clipboard.writeText(resolvedPlaintext); }}
            className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors">
            Copy Plain Text
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSend} disabled={!recipientEmail}
              className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40">
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send Email
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
