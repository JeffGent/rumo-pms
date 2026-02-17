// -- Detail: Messages Tab --
const DetailMessagesTab = ({ dp }) => {
  const {
    ed, setEditingReservation, setToastMessage,
    setEmailPreviewTemplate, openInvoiceEmail, setViewingEmailLog,
  } = dp;
  return (
            <div className="space-y-4">
              {/* Guest Portal Section */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Guest Portal</div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-neutral-900 bg-neutral-50 px-2 py-0.5 rounded-lg">{ed.bookingRef}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { navigator.clipboard.writeText(getPortalUrl(ed.bookingRef)); setToastMessage('Portal link copied'); }}
                      title="Copy portal link"
                      className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(ed.bookingRef); setToastMessage('Booking ref copied'); }}
                      title="Copy booking reference"
                      className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Send Email Section */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Send Email</div>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const typeStyles = {
                      'confirmation': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-600' },
                      'cancellation': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-500' },
                      'cc-request': { icon: <Icons.CreditCard className="w-4 h-4" />, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-600' },
                      'pre-checkin': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-600' },
                      'invoice': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, bg: 'bg-neutral-50', border: 'border-neutral-200', iconColor: 'text-neutral-500' },
                      'checkout': { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, bg: 'bg-neutral-50', border: 'border-neutral-200', iconColor: 'text-neutral-500' },
                    };
                    return emailTemplates.filter(t => t.active).map(template => {
                      const autoSendConfig = hotelSettings.emailAutoSend?.[template.id];
                      const isAutoSend = autoSendConfig?.enabled || template.autoSend;
                      const sentLogs = (ed.emailLog || []).filter(l => l.templateId === template.id && l.status === 'sent');
                      const wasSent = sentLogs.length > 0;
                      const lastSent = wasSent ? sentLogs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] : null;
                      const style = typeStyles[template.type] || typeStyles['invoice'];
                      return (
                        <div key={template.id} className={`flex items-center justify-between p-3 ${style.bg} border ${style.border} rounded-xl hover:brightness-95 transition-all`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center ${style.iconColor}`}>
                              {style.icon}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-neutral-900">{template.name}</div>
                              {wasSent ? (
                                <div className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                  Sent {new Date(lastSent.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  {sentLogs.length > 1 && ` (${sentLogs.length}x)`}
                                </div>
                              ) : isAutoSend ? (
                                <div className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  Auto-send scheduled
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <button onClick={() => {
                            if (template.type === 'invoice') {
                              openInvoiceEmail();
                            } else {
                              setEmailPreviewTemplate(template.id);
                            }
                          }}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors">
                            Preview & Send
                          </button>
                        </div>
                      );
                    });
                  })()}
                  {emailTemplates.filter(t => t.active).length === 0 && (
                    <div className="text-xs text-neutral-400 text-center py-4">No active email templates. Configure templates in Settings.</div>
                  )}
                </div>
              </div>

              {/* Email Log */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Email History {(ed.emailLog || []).length > 0 && <span className="text-neutral-300 ml-1">({ed.emailLog.length})</span>}
                  </div>
                </div>
                {(ed.emailLog || []).length > 0 ? (
                  <div className="space-y-2">
                    {[...(ed.emailLog || [])].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)).map(log => (
                      <div key={log.id} onClick={() => { if (log.templateId) setViewingEmailLog(log); }}
                        className={`flex items-center justify-between p-3 bg-neutral-50 rounded-xl${log.templateId ? ' cursor-pointer hover:bg-neutral-100 transition-colors' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.status === 'sent' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            {log.status === 'sent' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-neutral-900">{log.templateName}{log.roomNumber ? <span className="text-neutral-400 ml-1">· Room {log.roomNumber}</span> : ''}</div>
                            <div className="text-[10px] text-neutral-400">
                              {new Date(log.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {' · '}{log.sentTo}
                              {log.sentBy && <> · by {log.sentBy}</>}
                            </div>
                          </div>
                        </div>
                        {log.templateId && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 text-center py-4">No emails sent yet</div>
                )}
              </div>
            </div>
  );
};
