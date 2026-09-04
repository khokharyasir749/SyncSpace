import React, { useState, useEffect, useRef } from 'react';
import { Search, Hash, Lock, User, MessageSquare, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import Avatar from '../common/Avatar';

const QuickSearchModal = ({
  isOpen,
  onClose,
  channels = [],
  workspaceMembers = [],
  messages = [],
  onSelectChannel,
  onSelectUser,
  onSelectMessage,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanQuery = query.trim().toLowerCase();

  // Filter Channels
  const filteredChannels = cleanQuery
    ? channels.filter(
        (c) =>
          c.name?.toLowerCase().includes(cleanQuery) ||
          c.description?.toLowerCase().includes(cleanQuery)
      )
    : channels.slice(0, 5);

  // Filter Members
  const filteredMembers = cleanQuery
    ? workspaceMembers.filter((m) => {
        const u = typeof m.user === 'object' ? m.user : { name: '', email: '' };
        return (
          u.name?.toLowerCase().includes(cleanQuery) ||
          u.email?.toLowerCase().includes(cleanQuery)
        );
      })
    : workspaceMembers.slice(0, 5);

  // Filter Messages
  const filteredMessages = cleanQuery
    ? messages.filter((msg) => msg.content?.toLowerCase().includes(cleanQuery))
    : [];

  // Flat list for keyboard navigation
  const flatResults = [
    ...filteredChannels.map((c) => ({ type: 'channel', data: c })),
    ...filteredMembers.map((m) => ({ type: 'user', data: typeof m.user === 'object' ? m.user : m })),
    ...filteredMessages.map((msg) => ({ type: 'message', data: msg })),
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(flatResults.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatResults.length) % Math.max(flatResults.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatResults[selectedIndex];
      if (item) {
        handleSelectItem(item);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectItem = (item) => {
    if (item.type === 'channel') {
      onSelectChannel(item.data);
    } else if (item.type === 'user') {
      onSelectUser(item.data);
    } else if (item.type === 'message') {
      onSelectMessage(item.data);
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/60 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search channels, teammates, or messages... (Ctrl + K)"
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {flatResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {/* Channels Group */}
              {filteredChannels.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Channels
                  </div>
                  {filteredChannels.map((c) => {
                    const globalIdx = flatResults.findIndex((r) => r.type === 'channel' && r.data._id === c._id);
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <div
                        key={c._id}
                        onClick={() => handleSelectItem({ type: 'channel', data: c })}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                          isSelected ? 'bg-indigo-600/30 text-white border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {c.type === 'private' ? (
                            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="font-semibold truncate">#{c.name}</span>
                          {c.description && (
                            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                              — {c.description}
                            </span>
                          )}
                        </div>
                        {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Members Group */}
              {filteredMembers.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Teammates
                  </div>
                  {filteredMembers.map((m) => {
                    const u = typeof m.user === 'object' ? m.user : m;
                    if (!u?._id) return null;
                    const globalIdx = flatResults.findIndex((r) => r.type === 'user' && r.data._id === u._id);
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <div
                        key={u._id}
                        onClick={() => handleSelectItem({ type: 'user', data: u })}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                          isSelected ? 'bg-indigo-600/30 text-white border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar src={u.avatar} name={u.name} className="w-6 h-6 rounded-lg shrink-0" />
                          <span className="font-semibold truncate">{u.name}</span>
                          <span className="text-[11px] text-slate-400 truncate">({u.email})</span>
                        </div>
                        {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Messages Group */}
              {filteredMessages.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Messages History
                  </div>
                  {filteredMessages.map((msg) => {
                    const globalIdx = flatResults.findIndex((r) => r.type === 'message' && r.data._id === msg._id);
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <div
                        key={msg._id}
                        onClick={() => handleSelectItem({ type: 'message', data: msg })}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                          isSelected ? 'bg-indigo-600/30 text-white border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-medium text-slate-200 truncate max-w-md">
                            <strong className="text-slate-100">{msg.sender?.name}: </strong>
                            {msg.content}
                          </span>
                        </div>
                        {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 select-none">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 ml-1">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Esc</kbd> Close
            </span>
          </div>
          <span>SyncSpace Spotlight</span>
        </div>
      </div>
    </div>
  );
};

export default QuickSearchModal;
