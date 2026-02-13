const MessagesPanel = (props) => {
    const { messagesOpen, setMessagesOpen, messages, setMessages, activeConversation, setActiveConversation, setShowCompose, showCompose, messagesEndRef, messageInputRef, setPreviousPage, activePage, setSelectedReservation, setToastMessage, setTime } = props;

    const [msgInput, setMsgInput] = React.useState('');
    const [composeSearch, setComposeSearch] = React.useState('');

    if (!messagesOpen) return null;

    const isGroup = (id) => id && id.startsWith('group-');

    const formatTime = (ts) => {
      const diff = Date.now() - ts;
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'Just now';
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    // Build DM conversations
    const dmConversations = staffMembers
      .filter(s => s.id !== currentUserId)
      .map(staff => {
        const convoMsgs = messages.filter(m =>
          (m.from === staff.id && m.to === currentUserId) ||
          (m.from === currentUserId && m.to === staff.id)
        ).sort((a, b) => a.timestamp - b.timestamp);
        const lastMsg = convoMsgs[convoMsgs.length - 1];
        const unread = convoMsgs.filter(m => m.to === currentUserId && !m.read).length;
        return { id: staff.id, type: 'dm', staff, messages: convoMsgs, lastMsg, unread };
      })
      .filter(c => c.lastMsg);

    // Build group conversations
    const groupConversations = groupChannels.map(group => {
      const convoMsgs = messages.filter(m => m.to === group.id).sort((a, b) => a.timestamp - b.timestamp);
      const lastMsg = convoMsgs[convoMsgs.length - 1];
      const unread = convoMsgs.filter(m => m.from !== currentUserId && m.readBy && !m.readBy.includes(currentUserId)).length;
      return { id: group.id, type: 'group', group, messages: convoMsgs, lastMsg, unread };
    }).filter(c => c.lastMsg);

    // Merge and sort all conversations
    const allConversations = [...dmConversations, ...groupConversations]
      .sort((a, b) => b.lastMsg.timestamp - a.lastMsg.timestamp);

    const activeConvo = activeConversation
      ? allConversations.find(c => c.id === activeConversation)
      : null;

    const markAsRead = (convoId) => {
      if (isGroup(convoId)) {
        setMessages(prev => prev.map(m =>
          m.to === convoId && m.readBy && !m.readBy.includes(currentUserId)
            ? { ...m, readBy: [...m.readBy, currentUserId] }
            : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.from === convoId && m.to === currentUserId && !m.read
            ? { ...m, read: true }
            : m
        ));
      }
    };

    const sendMessage = () => {
      if (!msgInput.trim() || !activeConversation) return;
      const newMsg = {
        id: Date.now(),
        from: currentUserId,
        to: activeConversation,
        text: msgInput.trim(),
        timestamp: Date.now(),
      };
      if (isGroup(activeConversation)) {
        newMsg.readBy = [currentUserId];
      } else {
        newMsg.read = true;
      }
      setMessages(prev => [...prev, newMsg]);
      setMsgInput('');
    };

    // Staff members not yet in a DM conversation (for compose)
    const availableContacts = staffMembers.filter(s =>
      s.id !== currentUserId && !dmConversations.find(c => c.staff.id === s.id)
    );

    const getSenderName = (fromId) => {
      if (fromId === currentUserId) return 'You';
      const staff = staffMembers.find(s => s.id === fromId);
      return staff ? staff.name.split(' ')[0] : '?';
    };

    // Render a conversation row
    const ConvoRow = ({ convo }) => {
      const name = convo.type === 'group' ? convo.group.name : convo.staff.name;
      const color = convo.type === 'group' ? convo.group.color : convo.staff.color;
      const avatarText = convo.type === 'group' ? '#' : name.split(' ').map(n => n[0]).join('');
      const subtitle = convo.type === 'group'
        ? `${convo.group.members.length} members`
        : convo.staff.department;
      const lastMsgPreview = convo.lastMsg
        ? (convo.lastMsg.from === currentUserId ? 'You: ' : (convo.type === 'group' ? getSenderName(convo.lastMsg.from) + ': ' : '')) + convo.lastMsg.text
        : '';

      return (
        <button
          className="w-full px-5 py-3.5 flex items-start gap-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-50"
          onClick={() => { setActiveConversation(convo.id); markAsRead(convo.id); setShowCompose(false); }}>
          <div className={`w-10 h-10 ${convo.type === 'group' ? 'rounded-xl' : 'rounded-full'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
            style={{ backgroundColor: color }}>
            {avatarText}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${convo.unread > 0 ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                {name}
              </span>
              <span className="text-[10px] text-neutral-400 flex-shrink-0">{formatTime(convo.lastMsg.timestamp)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className={`text-xs truncate ${convo.unread > 0 ? 'text-neutral-700' : 'text-neutral-400'}`}>
                {lastMsgPreview}
              </span>
              {convo.unread > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {convo.unread}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '15', color: color }}>
              {subtitle}
            </span>
          </div>
        </button>
      );
    };

    // Detail header info
    const convoName = activeConvo ? (activeConvo.type === 'group' ? activeConvo.group.name : activeConvo.staff.name) : '';
    const convoColor = activeConvo ? (activeConvo.type === 'group' ? activeConvo.group.color : activeConvo.staff.color) : '#999';
    const convoAvatar = activeConvo ? (activeConvo.type === 'group' ? '#' : convoName.split(' ').map(n => n[0]).join('')) : '';
    const convoSubtitle = activeConvo ? (activeConvo.type === 'group'
      ? `${activeConvo.group.members.length} members`
      : `${activeConvo.staff.role} · ${activeConvo.staff.department}`) : '';

    return (
      <>
        <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => { setMessagesOpen(false); setActiveConversation(null); setShowCompose(false); }} />

        <div className="fixed right-0 top-0 bottom-0 w-full md:max-w-sm bg-white z-50 shadow-2xl flex flex-col">
          {showCompose && !activeConvo ? (
            <>
              {/* Compose: pick a contact */}
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-3">
                <button onClick={() => { setShowCompose(false); setComposeSearch(''); }}
                  className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <h3 className="text-lg font-semibold text-neutral-900">New message</h3>
              </div>
              <div className="px-4 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl">
                  <Icons.Search className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <input type="text" value={composeSearch} onChange={(e) => setComposeSearch(e.target.value)}
                    placeholder="Search people or channels..."
                    className="flex-1 text-sm bg-transparent outline-none text-neutral-900 placeholder-neutral-400" />
                  {composeSearch && (
                    <button onClick={() => setComposeSearch('')} className="text-neutral-300 hover:text-neutral-500">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>
              {(() => {
                const q = composeSearch.toLowerCase();
                const filteredContacts = availableContacts.filter(s => !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.department.toLowerCase().includes(q));
                const filteredRecent = dmConversations.filter(c => !q || c.staff.name.toLowerCase().includes(q) || c.staff.role.toLowerCase().includes(q) || c.staff.department.toLowerCase().includes(q));
                const filteredGroups = groupChannels.filter(g => !q || g.name.toLowerCase().includes(q));
                return (
              <div className="flex-1 overflow-y-auto overscroll-none">
                {filteredContacts.length > 0 && (
                  <>
                    <div className="px-5 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">People</div>
                    {filteredContacts.map(staff => (
                      <button key={staff.id}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                        onClick={() => { setActiveConversation(staff.id); setShowCompose(false); setComposeSearch(''); }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: staff.color }}>
                          {staff.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{staff.name}</div>
                          <div className="text-xs text-neutral-500">{staff.role} · {staff.department}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {filteredRecent.length > 0 && (
                  <>
                    <div className="px-5 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-2">Recent</div>
                    {filteredRecent.map(convo => (
                      <button key={convo.staff.id}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                        onClick={() => { setActiveConversation(convo.staff.id); markAsRead(convo.staff.id); setShowCompose(false); setComposeSearch(''); }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: convo.staff.color }}>
                          {convo.staff.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{convo.staff.name}</div>
                          <div className="text-xs text-neutral-500">{convo.staff.role} · {convo.staff.department}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {filteredGroups.length > 0 && (
                  <>
                    <div className="px-5 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-2">Channels</div>
                    {filteredGroups.map(group => (
                      <button key={group.id}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                        onClick={() => { setActiveConversation(group.id); markAsRead(group.id); setShowCompose(false); setComposeSearch(''); }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: group.color }}>
                          #
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{group.name}</div>
                          <div className="text-xs text-neutral-500">{group.members.length} members</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {filteredContacts.length === 0 && filteredRecent.length === 0 && filteredGroups.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-neutral-400">No results for "{composeSearch}"</div>
                )}
              </div>
                );
              })()}
            </>
          ) : !activeConvo ? (
            <>
              {/* Conversation List Header */}
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Messages</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowCompose(true)}
                    className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors" title="New message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                  <button onClick={() => { setMessagesOpen(false); setActiveConversation(null); }}
                    className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto overscroll-none">
                {/* Due Reminders */}
                {(() => {
                  const dueReminders = reservations.flatMap(res =>
                    (res.reminders || []).filter(rem => !rem.fired && new Date(rem.dueDate) <= new Date()).map(rem => ({ ...rem, guest: res.guest || res.booker?.firstName || 'Reservation', resId: res.id, res }))
                  );
                  if (dueReminders.length === 0) return null;
                  return (
                    <>
                      <div className="px-5 py-2 text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Reminders</div>
                      {dueReminders.map(rem => (
                        <div key={rem.id} className="px-5 py-3 flex items-start gap-3 bg-amber-50 border-b border-amber-100 cursor-pointer hover:bg-amber-100/50 transition-colors"
                          onClick={() => {
                            const resObj = reservations.find(r => r.id === rem.resId);
                            if (resObj) {
                              setPreviousPage(activePage);
                              setSelectedReservation({ ...resObj, checkin: new Date(resObj.checkin), checkout: new Date(resObj.checkout) });
                              setMessagesOpen(false);
                              setActiveConversation(null);
                            }
                          }}>
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-amber-500"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-neutral-900">{rem.guest}</div>
                            <div className="text-xs text-neutral-600 mt-0.5">{rem.message}</div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">
                              {new Date(rem.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const resObj = reservations.find(r => r.id === rem.resId);
                            if (resObj) {
                              const r = (resObj.reminders || []).find(r => r.id === rem.id);
                              if (r) r.fired = true;
                              resObj.activityLog = resObj.activityLog || [];
                              resObj.activityLog.push({ id: Date.now(), timestamp: Date.now(), action: `Reminder acknowledged: "${rem.message}"`, user: 'Sophie' });
                              saveReservationSingle(resObj);
                              setToastMessage('Reminder acknowledged');
                              setTime(new Date());
                            }
                          }}
                            title="Acknowledge"
                            className="w-8 h-8 rounded-lg bg-amber-100 hover:bg-emerald-100 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-600 hover:text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                        </div>
                      ))}
                    </>
                  );
                })()}
                {/* Groups first */}
                {groupConversations.length > 0 && (
                  <>
                    <div className="px-5 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Channels</div>
                    {groupConversations.map(convo => <ConvoRow key={convo.id} convo={convo} />)}
                  </>
                )}
                {/* Then DMs */}
                <div className="px-5 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Direct messages</div>
                {dmConversations.sort((a, b) => b.lastMsg.timestamp - a.lastMsg.timestamp).map(convo => <ConvoRow key={convo.id} convo={convo} />)}
              </div>
            </>
          ) : (
            <>
              {/* Conversation Detail Header */}
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3">
                <button onClick={() => setActiveConversation(null)}
                  className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div className={`w-8 h-8 ${activeConvo?.type === 'group' ? 'rounded-xl' : 'rounded-full'} flex items-center justify-center text-white text-[10px] font-bold`}
                  style={{ backgroundColor: convoColor }}>
                  {convoAvatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{convoName}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: convoColor + '15', color: convoColor }}>
                    {convoSubtitle}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto overscroll-none px-4 py-4 space-y-3">
                {(activeConvo ? activeConvo.messages : []).map(msg => {
                  const isOwn = msg.from === currentUserId;
                  const senderStaff = staffMembers.find(s => s.id === msg.from);
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${isOwn ? '' : 'flex gap-2'}`}>
                        {!isOwn && activeConvo?.type === 'group' && senderStaff && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 mt-1"
                            style={{ backgroundColor: senderStaff.color }}>
                            {senderStaff.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                        <div className={`px-3.5 py-2.5 rounded-2xl ${
                          isOwn
                            ? 'bg-neutral-900 text-white rounded-br-md'
                            : 'bg-neutral-100 text-neutral-900 rounded-bl-md'
                        }`}>
                          {!isOwn && activeConvo?.type === 'group' && (
                            <div className="text-[10px] font-semibold mb-0.5" style={{ color: senderStaff?.color }}>{getSenderName(msg.from)}</div>
                          )}
                          <div className="text-sm leading-relaxed">{msg.text}</div>
                          <div className={`text-[10px] mt-1 ${isOwn ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-neutral-100">
                <div className="flex items-center gap-2">
                  <input
                    ref={messageInputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    className="flex-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                  />
                  <button onClick={sendMessage}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      msgInput.trim() ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </>
    );
  };