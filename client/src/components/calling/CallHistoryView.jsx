import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  RefreshCw,
  Clock,
  Calendar,
  Hash,
  Users,
} from 'lucide-react';
import api from '../../services/api';
import Avatar from '../common/Avatar';

const formatCallTimestamp = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = yesterday.toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};

const formatCallDuration = (secs, status) => {
  if (status === 'missed' || status === 'unanswered' || status === 'rejected') {
    return 'Missed';
  }
  if (!secs || secs <= 0) return '0s';
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  if (mins > 0) {
    return `${mins}m ${remainingSecs}s`;
  }
  return `${remainingSecs}s`;
};

const CallHistoryView = ({
  activeWorkspace,
  currentWorkspace,
  workspace,
  currentUser,
  user,
  socket,
  onlineUserIds = new Set(),
  onStartCall,
}) => {
  const targetWs = activeWorkspace || currentWorkspace || workspace;
  const targetUser = currentUser || user;
  const onlineSet = onlineUserIds instanceof Set ? onlineUserIds : new Set();

  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'missed'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCallHistory = useCallback(async () => {
    if (!targetWs?._id) {
      setCallLogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/calls/history', {
        params: {
          workspaceId: targetWs._id,
          filter: activeTab === 'missed' ? 'missed' : 'all',
        },
      });
      if (res.data?.success && Array.isArray(res.data.calls)) {
        setCallLogs(res.data.calls);
      } else {
        setCallLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch call history:', err);
      setCallLogs([]);
    } finally {
      setLoading(false);
    }
  }, [targetWs?._id, activeTab]);

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  const safeCallLogs = Array.isArray(callLogs) ? callLogs : [];

  const filteredLogs = safeCallLogs.filter((log) => {
    if (!log) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();

    if (log.channel?.name?.toLowerCase().includes(q)) return true;
    if (typeof log.caller === 'object' && log.caller?.name?.toLowerCase().includes(q)) return true;
    if (Array.isArray(log.recipients) && log.recipients.some((r) => r?.name?.toLowerCase().includes(q))) {
      return true;
    }

    return false;
  });

  const handleCallback = (log) => {
    if (!onStartCall || !log) return;

    const isAudioOnly = log.type === 'audio';

    if (log.channel?._id) {
      onStartCall({
        isAudioOnly,
        targetRoomId: `channel_${log.channel._id}`,
        peerName: `#${log.channel.name || 'channel'}`,
        peerAvatar: '',
      });
    } else {
      const callerId = typeof log.caller === 'object' ? log.caller?._id : log.caller;
      const isCaller = callerId?.toString() === targetUser?._id?.toString();
      const peer = isCaller
        ? (Array.isArray(log.recipients) ? log.recipients[0] : null)
        : (typeof log.caller === 'object' ? log.caller : null);

      if (peer && peer._id) {
        onStartCall({
          isAudioOnly,
          targetUserId: peer._id,
          peerName: peer.name || 'Teammate',
          peerAvatar: peer.avatar || '',
        });
      }
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-950/20 dark:bg-slate-950/20 light:bg-slate-50/70 text-slate-100 dark:text-slate-100 light:text-slate-900 overflow-hidden font-sans">
      {/* Top Header & Search Bar */}
      <div className="h-16 border-b border-white/5 dark:border-white/5 light:border-slate-200/80 bg-slate-900/60 dark:bg-slate-900/60 light:bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight">Call History</h1>
            <p className="text-xs text-slate-400">
              {callLogs.length} total call{callLogs.length === 1 ? '' : 's'} in workspace
            </p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Calls
          </button>
          <button
            onClick={() => setActiveTab('missed')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'missed'
                ? 'bg-rose-600/20 text-rose-400 shadow-sm border border-rose-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Missed Calls
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm hidden md:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by participant or channel..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-medium"
          />
        </div>
      </div>

      {/* Main Call History List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-xs">Loading call history...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log) => {
            const callerId = typeof log.caller === 'object' ? log.caller?._id : log.caller;
            const isCaller = callerId?.toString() === currentUser?._id?.toString();
            const isMissed = ['missed', 'unanswered', 'rejected'].includes(log.status);
            const isVideo = log.type === 'video';

            let displayName = 'Call';
            let displayAvatar = '';
            let isOnline = false;
            let directionPrefix = '';
            let statusIcon = null;
            let statusTagText = '';
            let statusTextColor = '';

            if (log.channel) {
              displayName = `#${log.channel.name}`;
              directionPrefix = isCaller ? 'Channel call to' : 'Channel call in';
              if (isMissed) {
                statusIcon = <PhoneMissed className="w-3.5 h-3.5" />;
                statusTagText = 'Missed Call';
                statusTextColor = 'text-rose-400';
              } else if (isCaller) {
                statusIcon = <PhoneOutgoing className="w-3.5 h-3.5" />;
                statusTagText = 'Outgoing Call';
                statusTextColor = 'text-indigo-400';
              } else {
                statusIcon = <PhoneIncoming className="w-3.5 h-3.5" />;
                statusTagText = 'Incoming Call';
                statusTextColor = 'text-emerald-400';
              }
            } else {
              const recipientUser = Array.isArray(log.recipients) && log.recipients.length > 0
                ? (typeof log.recipients[0] === 'object' ? log.recipients[0] : null)
                : null;
              const callerUser = typeof log.caller === 'object' ? log.caller : null;

              if (isCaller) {
                const counterpart = recipientUser;
                displayName = counterpart?.name || 'Teammate';
                displayAvatar = counterpart?.avatar || '';
                isOnline = counterpart?._id ? onlineUserIds.has(counterpart._id.toString()) : false;
                directionPrefix = `Outgoing to ${displayName}`;

                if (isMissed) {
                  statusIcon = <PhoneMissed className="w-3.5 h-3.5" />;
                  statusTagText = 'Outgoing (Unanswered)';
                  statusTextColor = 'text-rose-400';
                } else {
                  statusIcon = <PhoneOutgoing className="w-3.5 h-3.5" />;
                  statusTagText = 'Outgoing Call';
                  statusTextColor = 'text-indigo-400';
                }
              } else {
                const counterpart = callerUser;
                displayName = counterpart?.name || 'Teammate';
                displayAvatar = counterpart?.avatar || '';
                isOnline = counterpart?._id ? onlineUserIds.has(counterpart._id.toString()) : false;
                directionPrefix = `Incoming from ${displayName}`;

                if (isMissed) {
                  statusIcon = <PhoneMissed className="w-3.5 h-3.5" />;
                  statusTagText = 'Missed Call';
                  statusTextColor = 'text-rose-400';
                } else {
                  statusIcon = <PhoneIncoming className="w-3.5 h-3.5" />;
                  statusTagText = 'Incoming Call';
                  statusTextColor = 'text-emerald-400';
                }
              }
            }

            return (
              <div
                key={log._id}
                className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 transition-all group"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {/* Left Avatar with Online Status */}
                  <div className="relative shrink-0">
                    {log.channel ? (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-indigo-400 font-bold">
                        <Hash className="w-5 h-5" />
                      </div>
                    ) : (
                      <>
                        <Avatar
                          src={displayAvatar}
                          name={displayName}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </>
                    )}
                  </div>

                  {/* Title, Direction, Duration & Timestamp */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-100 truncate">{displayName}</span>

                      {/* Call Type Badge (Video / Audio) */}
                      {isVideo ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                          <Video className="w-3.5 h-3.5" />
                          <span>Video</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                          <Phone className="w-3.5 h-3.5" />
                          <span>Audio</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap">
                      {/* Direction Tag & Icon */}
                      <span className={`flex items-center gap-1 font-medium ${statusTextColor}`}>
                        {statusIcon}
                        <span>{statusTagText}</span>
                      </span>

                      <span className="text-slate-600">•</span>

                      {/* Direction Subtext */}
                      <span className="text-slate-400 font-medium text-[11px] truncate">
                        {directionPrefix}
                      </span>

                      <span className="text-slate-600">•</span>

                      {/* Call Type Label */}
                      <span className="text-slate-400 font-medium text-[11px]">
                        {isVideo ? 'Video' : 'Audio'}
                      </span>

                      <span className="text-slate-600">•</span>

                      {/* Duration */}
                      <span
                        className={`font-mono text-[11px] font-medium ${
                          isMissed ? 'text-rose-400 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {formatCallDuration(log.duration, log.status)}
                      </span>

                      <span className="text-slate-600">•</span>

                      {/* Relative Timestamp */}
                      <span className="text-slate-400 text-[11px] shrink-0">
                        {formatCallTimestamp(log.startedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Callback Action Button */}
                <button
                  onClick={() => handleCallback(log)}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700/60 transition-all font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm group-hover:border-indigo-500/40"
                  title={`Call ${displayName}`}
                >
                  {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Callback</span>
                </button>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-3 border border-dashed border-slate-800/80 rounded-3xl bg-slate-900/20">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">No call history found</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === 'missed'
                  ? 'You have no missed calls'
                  : 'Recent voice and video calls will appear here'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallHistoryView;
