import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Check, CheckCheck, Loader2, FileText, Download, ExternalLink, Play, Pause, Mic, Copy, Share2, PhoneCall, PhoneMissed, Video, VideoOff, ChevronDown, Reply, Pin, Phone } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const AudioPlayerBubble = ({
  fileUrl,
  isMe,
  audioDuration,
  msgId,
  onPlayVoiceNote,
  isListened: isListenedProp = false,
  readBy = [],
  currentUserId,
}) => {
  const { user: authUser } = useAuth();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audioDuration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasPlayedLocally, setHasPlayedLocally] = useState(false);

  const effectiveMyId = (
    currentUserId?._id ||
    currentUserId?.id ||
    authUser?._id ||
    authUser?.id ||
    currentUserId
  )?.toString();

  useEffect(() => {
    if (audioDuration && audioDuration > 0) {
      setDuration(audioDuration);
    }
  }, [audioDuration]);

  const handleLoadedMetadata = () => {
    if (audioDuration && audioDuration > 0) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.duration || audio.duration === Infinity || isNaN(audio.duration)) {
      audio.currentTime = 1e101;
      audio.ontimeupdate = () => {
        audio.ontimeupdate = null;
        audio.currentTime = 0;
        if (audio.duration && audio.duration !== Infinity && !isNaN(audio.duration)) {
          setDuration(Math.round(audio.duration));
        }
      };
    } else {
      setDuration(Math.round(audio.duration));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!isMe) {
        setHasPlayedLocally(true);
        if (onPlayVoiceNote && msgId) {
          onPlayVoiceNote(msgId);
        }
      }
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch((err) => console.error('Audio playback error:', err));
      setIsPlaying(true);
    }
  };

  const toggleSpeed = (e) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatAudioTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const maxDuration = duration > 0 ? duration : 1;
  const progressRatio = Math.max(0, Math.min(currentTime / maxDuration, 1));

  // Generate dynamic vertical waveform bar heights based on msgId seed
  const barHeights = useMemo(() => {
    const seed = typeof msgId === 'string'
      ? msgId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : 42;
    return Array.from({ length: 24 }, (_, i) => {
      const pseudoRandom = Math.abs(Math.sin(seed + i * 7)) * 0.75 + 0.25;
      return Math.round(pseudoRandom * 22) + 6;
    });
  }, [msgId]);

  const activeBarIndex = Math.floor(progressRatio * barHeights.length);

  const handleWaveformClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(clickX / rect.width, 1));
    const seekTime = clickRatio * maxDuration;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const isReadInDb =
    Array.isArray(readBy) &&
    readBy.some((id) => {
      const uid = (id?._id || id)?.toString();
      return uid && effectiveMyId && uid === effectiveMyId;
    });

  const isListened = isReadInDb || isListenedProp || hasPlayedLocally;
  const isUnplayedOpponent = !isMe && !isListened;

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] min-w-[280px] max-w-[340px] flex items-center gap-3.5 select-none transition-all my-1">
      <audio
        ref={audioRef}
        src={fileUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Left: Circular Glowing Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Middle: Waveform + Time & Speed Sub-row */}
      <div className="flex-1 flex flex-col justify-center min-w-0 gap-1.5">
        {/* Top: Interactive Audio Waveform Bars */}
        <div
          onClick={handleWaveformClick}
          className="h-7 flex items-center gap-[3px] cursor-pointer group/wave py-0.5"
          title="Click to seek position"
        >
          {barHeights.map((height, i) => {
            const isActive = i <= activeBarIndex;
            const isCurrentlyPlaying = isPlaying && isActive;
            return (
              <span
                key={i}
                style={{ height: `${height}px` }}
                className={`w-[3px] rounded-full transition-all duration-150 ${
                  isActive
                    ? isCurrentlyPlaying
                      ? 'bg-gradient-to-t from-indigo-500 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse'
                      : 'bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]'
                    : 'bg-slate-700/60 group-hover/wave:bg-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Bottom Sub-row: Timestamp & Speed Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono font-medium">
            {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
          </span>

          <button
            type="button"
            onClick={toggleSpeed}
            className="px-2 py-0.5 text-[10px] font-mono font-bold bg-white/10 hover:bg-white/20 text-indigo-300 border border-white/10 rounded-md transition-all cursor-pointer active:scale-95"
            title="Toggle playback speed"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>

      {/* Right: Mic Badge / Indicator */}
      <div className="shrink-0 flex items-center justify-center">
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center ${
            isUnplayedOpponent
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
          }`}
          title={isUnplayedOpponent ? 'New Unheard Voice Note' : 'Voice Note'}
        >
          <Mic className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatFullDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return isToday ? `Today at ${timeStr}` : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};

const formatDateDivider = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

const MessageFeed = ({
  messages = [],
  loading = false,
  currentUserId,
  activeChannel,
  activeDmUser,
  chatName = 'this conversation',
  onReact,
  onPlayVoiceNote,
  onForwardMessage,
  onReply,
  onTogglePin,
  onStartCall,
}) => {
  const messagesEndRef = useRef(null);
  const feedContainerRef = useRef(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const handleCopyMessage = (msg) => {
    const textToCopy = msg.content || msg.fileUrl || '';
    if (textToCopy && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedMsgId(msg._id);
      setTimeout(() => setCopiedMsgId(null), 1500);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFeedScroll = () => {
    if (!feedContainerRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = feedContainerRef.current;
    const isUp = scrollTop + clientHeight < scrollHeight - 200;
    setShowScrollBottomButton(isUp);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        <p className="text-sm">Loading message history...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4 text-brand-400 shadow-glow-sm">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-200">This is the start of {chatName}</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Send the first message to kickstart real-time collaboration with your team!
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      <div
        ref={feedContainerRef}
        onScroll={handleFeedScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-1.5"
      >
        {messages.map((msg, index) => {
          const senderId = (msg.sender?._id || msg.sender)?.toString();
          const myId = currentUserId?.toString();
          const isMe = senderId === myId;

          const prevMsg = index > 0 ? messages[index - 1] : null;
          const prevSenderId = (prevMsg?.sender?._id || prevMsg?.sender)?.toString();
          const isSameSender = prevMsg && prevSenderId === senderId;
          const isWithin5Minutes =
            prevMsg &&
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;

          const msgDateStr = new Date(msg.createdAt).toDateString();
          const prevDateStr = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
          const showDateDivider = !prevMsg || msgDateStr !== prevDateStr;

          const isGrouped = !showDateDivider && isSameSender && isWithin5Minutes;

          const isReadByOthers =
            Array.isArray(msg.readBy) &&
            msg.readBy.some((r) => {
              const rId = (typeof r === 'object' ? r._id : r)?.toString();
              return rId && rId !== myId;
            });

          const isDeliveredToOthers =
            Array.isArray(msg.deliveredTo) &&
            msg.deliveredTo.some((d) => {
              const dId = (typeof d === 'object' ? d._id : d)?.toString();
              return dId && dId !== myId;
            });

          const reactionMap = (msg.reactions || []).reduce((acc, r) => {
            if (!r.emoji) return acc;
            if (!acc[r.emoji]) {
              acc[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
            }
            acc[r.emoji].count += 1;
            const uid = (r.user?._id || r.user)?.toString();
            if (uid) acc[r.emoji].userIds.push(uid);
            return acc;
          }, {});
          const groupedReactions = Object.values(reactionMap);

          return (
            <React.Fragment key={msg._id || index}>
              {showDateDivider && (
                <div className="flex items-center justify-center my-4 sticky top-2 z-20 select-none">
                  <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-400 text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">
                    {formatDateDivider(msg.createdAt)}
                  </div>
                </div>
              )}

              <div
                id={`msg-${msg._id}`}
                className={`flex w-full items-end gap-2 transition-all duration-200 ${
                  isMe ? 'justify-end' : 'justify-start'
                } ${isGrouped ? 'mt-1' : 'mt-3.5'}`}
              >
                {!isMe && (
                  <div className="shrink-0 w-8 h-8 relative mb-0.5">
                    {!isGrouped ? (
                      <>
                        <Avatar
                          src={msg.sender?.avatar}
                          name={msg.sender?.name}
                          className="w-8 h-8 rounded-xl"
                        />
                        {msg.sender?.isOnline && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5" />
                        )}
                      </>
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[65%] ${
                    isMe ? 'items-end' : 'items-start'
                  }`}
                >
                  {!isMe && !isGrouped && (() => {
                    const channelOwnerId = (
                      activeChannel?.creator?._id ||
                      activeChannel?.creator ||
                      activeChannel?.members?.[0]?._id ||
                      activeChannel?.members?.[0]
                    )?.toString();
                    const isCreator = Boolean(channelOwnerId && channelOwnerId === senderId);
                    const isChannelAdmin =
                      isCreator ||
                      (Array.isArray(activeChannel?.admins) &&
                        activeChannel.admins.some((a) => (a?._id || a)?.toString() === senderId));

                    return (
                      <div className="flex items-center gap-1.5 ml-2 mb-1">
                        <span className="text-[11px] font-semibold text-slate-300 truncate">
                          {msg.sender?.name || 'Teammate'}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="relative group/bubble flex items-center">
                    <div
                      className={`absolute -top-3 ${
                        isMe ? 'right-2' : 'left-2'
                      } opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto transition-all duration-200 z-30 flex items-center gap-0.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-full px-1.5 py-0.5 shadow-xl`}
                    >
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReact && onReact(msg._id, emoji)}
                          className="w-6 h-6 flex items-center justify-center text-xs hover:scale-125 transition-transform cursor-pointer select-none"
                          title={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => onReply && onReply(msg)}
                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white rounded-full hover:bg-slate-800 hover:scale-110 transition-all cursor-pointer select-none"
                        title="Reply to message"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onTogglePin && onTogglePin(msg)}
                        className={`w-6 h-6 flex items-center justify-center rounded-full hover:scale-110 transition-all cursor-pointer select-none ${
                          msg.isPinned ? 'text-amber-400 bg-amber-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                        title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-px h-3 bg-slate-700 mx-1" />

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg)}
                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white rounded-full hover:bg-slate-800 hover:scale-110 transition-all cursor-pointer select-none"
                        title="Copy message"
                      >
                        {copiedMsgId === msg._id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onForwardMessage && onForwardMessage(msg)}
                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white rounded-full hover:bg-slate-800 hover:scale-110 transition-all cursor-pointer select-none"
                        title="Forward message"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quoted Reply Context Banner */}
                    {msg.replyTo && (
                      <div className="mb-1.5 text-[11px] bg-slate-950/70 border-l-2 border-indigo-500 rounded-r-lg px-2.5 py-1 text-slate-300 flex flex-col max-w-full">
                        <span className="font-bold text-indigo-400">
                          {msg.replyTo.sender?.name || 'Teammate'}
                        </span>
                        <span className="truncate opacity-80">
                          {msg.replyTo.content || msg.replyTo.fileName || 'Attachment'}
                        </span>
                      </div>
                    )}

                    {/* Pinned Badge Indicator */}
                    {msg.isPinned && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mb-1 ml-1">
                        <Pin className="w-3 h-3 fill-amber-400" />
                        <span>Pinned</span>
                      </div>
                    )}

                    {msg.fileType === 'call_log' || msg.type === 'call_log' ? (
                      (() => {
                        const isVideoCall =
                          msg.callType === 'video' ||
                          msg.callData?.type === 'video' ||
                          msg.content?.toLowerCase().includes('video');

                        const callStatus = (msg.callStatus || msg.callData?.status || '').toLowerCase();
                        const isDeclined =
                          callStatus === 'rejected' ||
                          callStatus === 'declined' ||
                          msg.content?.toLowerCase().includes('declined') ||
                          msg.content?.toLowerCase().includes('rejected');
                        const isUnanswered =
                          callStatus === 'unanswered' ||
                          callStatus === 'missed' ||
                          msg.content?.toLowerCase().includes('missed') ||
                          msg.content?.toLowerCase().includes('unanswered');
                        
                        const isCompleted =
                          callStatus === 'completed' ||
                          (msg.content?.includes('•') && !isDeclined && !isUnanswered) ||
                          (msg.content?.toLowerCase().includes('completed') && !isDeclined && !isUnanswered);

                        const callTypeLabel = isVideoCall ? 'Video Call' : 'Audio Call';

                        let displayTitle = msg.content;
                        if (!isCompleted) {
                          if (isMe) {
                            if (isDeclined) {
                              displayTitle = `Declined ${callTypeLabel}`;
                            } else {
                              displayTitle = `Unanswered ${callTypeLabel}`;
                            }
                          } else {
                            displayTitle = `Missed ${callTypeLabel}`;
                          }
                        } else if (!displayTitle || displayTitle.startsWith('Missed ')) {
                          displayTitle = callTypeLabel;
                        }

                        const isRead =
                          isReadByOthers ||
                          msg.isRead ||
                          (Array.isArray(msg.readBy) &&
                            msg.readBy.some((r) => {
                              const rId = (typeof r === 'object' ? r._id : r)?.toString();
                              return rId && rId !== myId;
                            }));

                        const handleCallCardClick = (e) => {
                          e.stopPropagation();
                          if (onStartCall) {
                            const targetUser = isMe ? activeDmUser : (msg.sender || activeDmUser);
                            onStartCall(targetUser, isVideoCall ? 'video' : 'audio');
                          }
                        };

                        const buttonLabel = isMe ? 'Call again' : 'Call back';

                        return (
                          <div
                            onClick={handleCallCardClick}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/60 backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-indigo-400/40 text-xs select-none my-1 max-w-sm cursor-pointer transition-all duration-200 active:scale-[0.99] group/callcard"
                            title={`Click to ${buttonLabel.toLowerCase()}`}
                          >
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover/callcard:scale-105 ${
                                isCompleted
                                  ? isVideoCall
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isVideoCall
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {isVideoCall ? (
                                isCompleted ? (
                                  <Video className="w-4 h-4" />
                                ) : (
                                  <VideoOff className="w-4 h-4 text-purple-400" />
                                )
                              ) : isCompleted ? (
                                <PhoneCall className="w-4 h-4" />
                              ) : (
                                <PhoneMissed className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-semibold text-slate-200 group-hover/callcard:text-indigo-300 transition-colors truncate">
                                {displayTitle}
                              </span>
                              <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2 font-medium mt-0.5">
                                <span>{formatMessageTime(msg.createdAt)}</span>
                                {isMe && (
                                  <span className="inline-flex items-center ml-0.5">
                                    {isRead ? (
                                      <CheckCheck
                                        className="w-3.5 h-3.5 text-sky-400"
                                        title="Read"
                                      />
                                    ) : isDeliveredToOthers ? (
                                      <CheckCheck
                                        className="w-3.5 h-3.5 text-slate-400"
                                        title="Delivered"
                                      />
                                    ) : (
                                      <Check
                                        className="w-3.5 h-3.5 text-slate-400"
                                        title="Sent"
                                      />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 group-hover/callcard:bg-indigo-500/20 border border-indigo-500/25 px-2 py-1 rounded-lg shrink-0 opacity-80 group-hover/callcard:opacity-100 transition-all ml-1 shadow-sm"
                              title={`${buttonLabel} (${isVideoCall ? 'video' : 'audio'})`}
                            >
                              {isVideoCall ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                              <span className="hidden sm:inline">{buttonLabel}</span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (msg.fileType === 'audio' || /\.(webm|mp3|wav|ogg|m4a)$/i.test(msg.fileUrl)) && !msg.content ? (
                      <AudioPlayerBubble
                        fileUrl={msg.fileUrl}
                        isMe={isMe}
                        audioDuration={msg.audioDuration}
                        msgId={msg._id}
                        onPlayVoiceNote={onPlayVoiceNote}
                        readBy={msg.readBy}
                        currentUserId={myId}
                        isListened={Array.isArray(msg.readBy) && msg.readBy.some((r) => (r?._id || r)?.toString() === myId?.toString())}
                      />
                    ) : (
                      <div
                        className={`relative px-4 py-2.5 shadow-sm transition-all ${
                          isMe
                            ? 'bg-gradient-to-br from-indigo-600/80 to-violet-700/80 backdrop-blur-xl border border-indigo-400/30 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] rounded-2xl rounded-tr-none'
                            : 'bg-[#181c26]/90 dark:bg-[#181c26]/90 light:bg-white/95 backdrop-blur-xl border border-white/10 dark:border-white/10 light:border-slate-200 text-slate-100 dark:text-slate-100 light:text-slate-900 shadow-md rounded-2xl rounded-tl-none'
                        }`}
                      >
                        {msg.fileUrl && (
                          <div className="mb-2">
                            {msg.fileType === 'image' || /\.(jpe?g|png|gif|webp|svg)$/i.test(msg.fileUrl) ? (
                              <div className="overflow-hidden rounded-xl bg-black/25 max-w-xs sm:max-w-sm">
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block relative group/img cursor-pointer"
                                >
                                  <img
                                    src={msg.fileUrl}
                                    alt={msg.fileName || 'Image'}
                                    className="max-h-64 sm:max-h-80 w-auto rounded-xl object-contain hover:opacity-95 transition-opacity"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1.5 rounded-xl">
                                    <ExternalLink className="w-4 h-4" />
                                    <span>View Full Size</span>
                                  </div>
                                </a>
                              </div>
                            ) : msg.fileType === 'audio' || /\.(webm|mp3|wav|ogg|m4a)$/i.test(msg.fileUrl) ? (
                              <AudioPlayerBubble
                                fileUrl={msg.fileUrl}
                                isMe={isMe}
                                audioDuration={msg.audioDuration}
                                msgId={msg._id}
                                onPlayVoiceNote={onPlayVoiceNote}
                                readBy={msg.readBy}
                                currentUserId={myId}
                                isListened={Array.isArray(msg.readBy) && msg.readBy.some((r) => (r?._id || r)?.toString() === myId?.toString())}
                              />
                            ) : (
                              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/25 border border-white/10 max-w-xs sm:max-w-sm">
                                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white truncate">
                                    {msg.fileName || 'Attachment'}
                                  </p>
                                  {msg.fileSize && (
                                    <p className="text-[10px] text-white/70">
                                      {formatFileSize(msg.fileSize)}
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={msg.fileUrl}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                                  title="Download File"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {msg.content && (
                          <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {msg.content}
                          </p>
                        )}

                        <div
                          className={`flex items-center justify-end gap-1 text-[10px] mt-1 font-medium ${
                            isMe ? 'text-slate-400' : 'text-indigo-200'
                          }`}
                        >
                          <span>{formatMessageTime(msg.createdAt)}</span>

                          {isMe && (
                            <span className="inline-flex items-center ml-0.5">
                              {isReadByOthers ? (
                                <CheckCheck
                                  className="w-3.5 h-3.5 text-sky-400"
                                  title="Read"
                                />
                              ) : isDeliveredToOthers ? (
                                <CheckCheck
                                  className="w-3.5 h-3.5 text-slate-400"
                                  title="Delivered"
                                />
                              ) : (
                                <Check
                                  className="w-3.5 h-3.5 text-slate-400"
                                  title="Sent"
                                />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {groupedReactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {groupedReactions.map((g) => {
                        const hasUserReacted = myId && g.userIds.includes(myId);
                        return (
                          <button
                            key={g.emoji}
                            type="button"
                            onClick={() => onReact && onReact(msg._id, g.emoji)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                              hasUserReacted
                                ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 shadow-glow-sm scale-105'
                                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                            }`}
                            title={`Reacted by ${g.count} member${g.count > 1 ? 's' : ''}`}
                          >
                            <span>{g.emoji}</span>
                            <span className="text-[10px] font-mono">{g.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isMe && (
                  <div className="shrink-0 w-8 h-8 relative mb-0.5">
                    {!isGrouped ? (
                      <>
                        <Avatar
                          src={msg.sender?.avatar}
                          name={msg.sender?.name}
                          className="w-8 h-8 rounded-xl"
                        />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5" />
                      </>
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <button
        type="button"
        onClick={scrollToBottom}
        className={`absolute bottom-5 right-6 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white p-2.5 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer ${
          showScrollBottomButton ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        title="Scroll to bottom"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
};

export default MessageFeed;
