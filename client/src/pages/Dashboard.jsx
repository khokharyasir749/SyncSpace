import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import Logo from '../components/common/Logo';
import QuickSearchModal from '../components/modals/QuickSearchModal';
import { playSentSound, playReceivedSound, playRingtoneSound } from '../utils/soundEffects';

import {
  Layers,
  Plus,
  Hash,
  Lock,
  MessageSquare,
  Users,
  ChevronDown,
  LogOut,
  Sparkles,
  Menu,
  X,
  Volume2,
  VolumeX,
  Settings,
  Circle,
  UserPlus,
  Share2,
  Phone,
  Video,
  Search,
  Pin,
  Reply,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';

import MessageFeed from '../components/chat/MessageFeed';
import MessageInput from '../components/chat/MessageInput';
import CreateWorkspaceModal from '../components/modals/CreateWorkspaceModal';
import CreateChannelModal from '../components/modals/CreateChannelModal';
import InviteMemberModal from '../components/modals/InviteMemberModal';
import UserProfileModal from '../components/modals/UserProfileModal';
import ChannelSettingsModal from '../components/modals/ChannelSettingsModal';
import IncomingCallModal from '../components/calling/IncomingCallModal';
import VideoMeetingModal from '../components/calling/VideoMeetingModal';
import CallHistoryView from '../components/calling/CallHistoryView';
import Avatar from '../components/common/Avatar';

class CallHistoryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CallHistoryView error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
          <Phone className="w-8 h-8 text-rose-400" />
          <p className="text-sm font-semibold text-slate-200">Call History unavailable</p>
          <p className="text-xs text-slate-500">An unexpected error occurred while rendering call history.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { socket, connected, isUserOnline, joinRoom, leaveRoom, sendMessage, sendTyping, markDelivered, markAsRead, reactToMessage } = useSocket();

  // Navigation & Data States
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [activeView, setActiveView] = useState(() => {
    try {
      return localStorage.getItem('syncspace_active_view') || 'chat';
    } catch (e) {
      return 'chat';
    }
  });

  const handleSwitchView = (viewName) => {
    setActiveView(viewName);
    try {
      localStorage.setItem('syncspace_active_view', viewName);
    } catch (e) {
      console.error('Failed to save active view:', e);
    }
  };

  // Chat, Messaging & Unread States
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [unreadCounts, setUnreadCounts] = useState({});

  // Modals & UI States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [replyingToMsg, setReplyingToMsg] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => m.isPinned);
  }, [messages]);

  const prevRoomRef = useRef(null);
  const processedMessageIdsRef = useRef(new Set());

  // WebRTC Calling State
  const [activeCall, setActiveCall] = useState(null);
  const [isMeetingMinimized, setIsMeetingMinimized] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [incomingMeetingInvite, setIncomingMeetingInvite] = useState(null);
  const [activeChannelCalls, setActiveChannelCalls] = useState(new Map());

  // Compute active room ID
  const currentRoomId = useMemo(() => {
    if (activeChannel) {
      return `channel_${activeChannel._id}`;
    }
    if (activeDmUser && user) {
      const dmId = [user._id.toString(), activeDmUser._id.toString()].sort().join('_');
      return `dm_${dmId}`;
    }
    return null;
  }, [activeChannel, activeDmUser, user]);

  // Compute conversationId for direct messages
  const activeConversationId = useMemo(() => {
    if (activeDmUser && user) {
      return `dm_${[user._id.toString(), activeDmUser._id.toString()].sort().join('_')}`;
    }
    return null;
  }, [activeDmUser, user]);

  // 1. Fetch User Workspaces on Mount
  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoadingWorkspaces(true);
      const res = await api.get('/workspaces');
      if (res.data?.success) {
        const list = res.data.workspaces || [];
        setWorkspaces(list);
        if (list.length > 0) {
          let matchedWs = null;
          try {
            const storedWsId = localStorage.getItem('syncspace_active_workspace_id');
            if (storedWsId) {
              matchedWs = list.find((w) => w._id?.toString() === storedWsId.toString());
            }
          } catch (e) {}
          setActiveWorkspace((prev) => prev || matchedWs || list[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // 2. Fetch Workspace Channels when Active Workspace Changes & Restore Active Channel or DM User
  useEffect(() => {
    if (!activeWorkspace) return;

    if (activeWorkspace._id) {
      try {
        localStorage.setItem('syncspace_active_workspace_id', activeWorkspace._id.toString());
      } catch (e) {}
    }

    const fetchChannels = async () => {
      try {
        const res = await api.get(`/channels/${activeWorkspace._id}`);
        if (res.data?.success) {
          const loadedChannels = res.data.channels || [];
          setChannels(loadedChannels);

          const storedView = localStorage.getItem('syncspace_active_view');
          const storedDmUserId = localStorage.getItem('syncspace_active_dm_user_id');
          const storedChannelId = localStorage.getItem('syncspace_active_channel_id');

          const members = activeWorkspace.members || [];
          const workspaceTeammates = members
            .map((m) => (typeof m.user === 'object' ? m.user : { _id: m.user }))
            .filter((u) => u?._id && u._id.toString() !== user?._id?.toString());

          const matchedDmUser = storedDmUserId
            ? workspaceTeammates.find((t) => t._id?.toString() === storedDmUserId.toString())
            : null;

          const matchedChannel = storedChannelId
            ? loadedChannels.find((c) => c._id?.toString() === storedChannelId.toString())
            : null;

          if (matchedDmUser) {
            setActiveDmUser(matchedDmUser);
            setActiveChannel(null);
          } else if (matchedChannel) {
            setActiveChannel(matchedChannel);
            setActiveDmUser(null);
          } else {
            const generalCh = loadedChannels.find((c) => c.name === 'general');
            const selectedCh = generalCh || loadedChannels[0] || null;
            setActiveChannel(selectedCh);
            setActiveDmUser(null);
          }

          if (storedView === 'calls') {
            setActiveView('calls');
          }
        }
      } catch (err) {
        console.error('Failed to fetch channels:', err);
      }
    };

    fetchChannels();
  }, [activeWorkspace, user]);

  // Subscribe to ALL workspace channel rooms so real-time socket events for inactive channels are received
  useEffect(() => {
    if (!socket || !connected || !Array.isArray(channels)) return;
    channels.forEach((ch) => {
      if (ch?._id) {
        joinRoom(`channel_${ch._id}`);
      }
    });
  }, [socket, connected, channels, joinRoom]);

  // Subscribe to workspace room for workspace-wide broadcasts
  useEffect(() => {
    if (!socket || !connected || !activeWorkspace?._id) return;
    const wsId = activeWorkspace._id.toString();
    joinRoom(wsId);
    joinRoom(`workspace_${wsId}`);
    return () => {
      leaveRoom(wsId);
      leaveRoom(`workspace_${wsId}`);
    };
  }, [socket, connected, activeWorkspace?._id, joinRoom, leaveRoom]);

  // 3. Coordinate Room Join/Leave & Message Fetch on Room Switch
  useEffect(() => {
    if (!currentRoomId) return;

    // Leave previous room
    if (prevRoomRef.current && prevRoomRef.current !== currentRoomId) {
      leaveRoom(prevRoomRef.current);
    }

    // Join new room
    joinRoom(currentRoomId);
    prevRoomRef.current = currentRoomId;
    setTypingUsers(new Map());

    // Fetch messages for active room
    const fetchHistory = async () => {
      setLoadingMessages(true);
      try {
        let res;
        if (activeChannel?._id) {
          res = await api.get(`/messages/channel/${activeChannel._id}`);
        } else if (activeDmUser?._id && user?._id) {
          const sortedDmId = [user._id.toString(), activeDmUser._id.toString()].sort().join('_');
          res = await api.get(`/messages/dm/${sortedDmId}`);
        }

        if (res?.data?.success) {
          setMessages(res.data.messages || []);

          // Mark message status if recipient (EXCLUDE voice notes from auto-read)
          if (res.data.messages && res.data.messages.length > 0) {
            const lastMsg = res.data.messages[res.data.messages.length - 1];
            const isOwn = lastMsg.sender?._id?.toString() === user?._id?.toString();
            const isAudio = Boolean(lastMsg?.fileType === 'audio' || (typeof lastMsg?.fileUrl === 'string' && /\.(webm|mp3|wav|ogg|m4a)$/i.test(lastMsg.fileUrl)));
            if (!isOwn) {
              const isWindowActive =
                typeof document !== 'undefined' &&
                !document.hidden &&
                (typeof document.hasFocus === 'function' ? document.hasFocus() : true);

              if (isWindowActive && !isAudio) {
                markAsRead(lastMsg._id, currentRoomId);
              } else {
                markDelivered(lastMsg._id, currentRoomId);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch message history:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchHistory();
  }, [currentRoomId, activeChannel?._id, activeDmUser?._id, joinRoom, leaveRoom, markDelivered, markAsRead, user]);

  // Ensure active room is rejoined whenever socket connects or active DM/Channel is selected
  useEffect(() => {
    if (socket && connected && currentRoomId) {
      joinRoom(currentRoomId);
    }
  }, [socket, connected, currentRoomId, joinRoom]);

  // When window gains focus, mark any unread messages from teammates in current conversation as read (EXCLUDE voice notes)
  useEffect(() => {
    const handleWindowFocus = () => {
      if (!currentRoomId || !user || messages.length === 0) return;
      messages.forEach((msg) => {
        const isOwn = msg.sender?._id?.toString() === user._id?.toString();
        const isAudio = Boolean(msg?.fileType === 'audio' || (typeof msg?.fileUrl === 'string' && /\.(webm|mp3|wav|ogg|m4a)$/i.test(msg.fileUrl)));
        const isRead =
          Array.isArray(msg.readBy) &&
          msg.readBy.some((r) => (r._id || r)?.toString() === user._id?.toString());
        if (!isOwn && !isRead && !isAudio) {
          markAsRead(msg._id, currentRoomId);
        }
      });
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [currentRoomId, user, messages, markAsRead]);

  // 4. Listen for Real-Time Socket Events
  useEffect(() => {
    if (!socket) return;

    // A. New Incoming Message
    const handleNewMessage = (newMsg) => {
      if (!newMsg?._id) return;
      const msgIdStr = newMsg._id.toString();
      if (processedMessageIdsRef.current.has(msgIdStr)) return;
      processedMessageIdsRef.current.add(msgIdStr);
      const isChannelMsg =
        activeChannel &&
        newMsg.channelId &&
        newMsg.channelId.toString() === activeChannel._id.toString();

      const activeDmClean = activeConversationId?.replace(/^dm_/, '');
      const newMsgDmClean = newMsg.conversationId?.replace(/^dm_/, '');

      const isDmMsg =
        activeDmClean &&
        newMsgDmClean &&
        activeDmClean === newMsgDmClean;

      const isForMe =
        newMsg.sender?._id?.toString() !== user?._id?.toString();

      // Track unread counts for inactive channels & DMs
      if (isForMe) {
        if (soundEnabled) playReceivedSound();

        if (newMsg.channelId) {
          const chIdStr = newMsg.channelId.toString();
          if (!activeChannel || activeChannel._id?.toString() !== chIdStr) {
            setUnreadCounts((prev) => ({
              ...prev,
              [chIdStr]: (prev?.[chIdStr] || 0) + 1,
            }));
          }
        } else if (newMsg.conversationId) {
          const senderId = newMsg.sender?._id?.toString();
          if (senderId && senderId !== user?._id?.toString() && (!activeDmUser || activeDmUser._id?.toString() !== senderId)) {
            setUnreadCounts((prev) => ({
              ...prev,
              [senderId]: (prev?.[senderId] || 0) + 1,
            }));
          }
        }
      }

      // If this DM is for me (recipient), trigger delivery handshake immediately
      if (isForMe && newMsg.conversationId) {
        const targetRoom = `dm_${newMsg.conversationId.replace(/^dm_/, '')}`;
        markDelivered(newMsg._id, targetRoom);
      }

      if (isChannelMsg || isDmMsg) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m._id?.toString() === newMsg._id?.toString())) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // Strict WhatsApp-Style 3-State Delivery / Read Logic (EXCLUDE voice notes from auto-read):
        if (isForMe) {
          // 1. Mark as Delivered (Double gray tick)
          markDelivered(newMsg._id, currentRoomId);

          // 2. Only mark as Read (Double blue tick) if window/tab is focused, active & NOT a voice note
          const isAudio = Boolean(newMsg?.fileType === 'audio' || (typeof newMsg?.fileUrl === 'string' && /\.(webm|mp3|wav|ogg|m4a)$/i.test(newMsg.fileUrl)));
          const isWindowActive =
            typeof document !== 'undefined' &&
            !document.hidden &&
            (typeof document.hasFocus === 'function' ? document.hasFocus() : true);

          if (isWindowActive && !isAudio) {
            markAsRead(newMsg._id, currentRoomId);
          }
        }
      }
    };

    // B. Typing Indicators
    const handleUserTyping = ({ roomId, userId, name, isTyping }) => {
      const cleanEventRoom = roomId?.replace(/^dm_/, '').replace(/^channel_/, '');
      const cleanCurrentRoom = currentRoomId?.replace(/^dm_/, '').replace(/^channel_/, '');

      if (cleanEventRoom === cleanCurrentRoom && userId !== user?._id?.toString()) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          if (isTyping) {
            next.set(userId, name);
          } else {
            next.delete(userId);
          }
          return next;
        });
      }
    };

    // C1. Delivery Receipt Updates (Double Gray Tick)
    const handleDeliveredUpdate = ({ messageId, userId, deliveredTo }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id?.toString() === messageId?.toString()) {
            return { ...msg, deliveredTo };
          }
          return msg;
        })
      );
    };

    // C2. Read Receipt Updates (Double Blue Tick)
    const handleReadUpdate = ({ messageId, userId, readBy }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id?.toString() === messageId?.toString()) {
            return { ...msg, readBy };
          }
          return msg;
        })
      );
    };

    // Real-time Presence Synchronization (Sidebar members & active DM user)
    const handleUserStatusChange = (data) => {
      if (!data || !data.userId) return;
      const targetUserId = data.userId.toString();
      const isOnline = Boolean(data.isOnline);

      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(targetUserId);
        } else {
          next.delete(targetUserId);
        }
        return next;
      });

      setActiveWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: (prev.members || []).map((m) => {
            const mUserId = (typeof m.user === 'object' ? m.user?._id : m.user)?.toString();
            if (mUserId === targetUserId) {
              const updatedUser = typeof m.user === 'object' ? { ...m.user, isOnline } : m.user;
              return { ...m, user: updatedUser };
            }
            return m;
          }),
        };
      });

      setActiveDmUser((prev) => {
        if (prev && prev._id?.toString() === targetUserId) {
          return { ...prev, isOnline };
        }
        return prev;
      });
    };

    const handleInitialOnlineUsers = (data) => {
      const userIds = Array.isArray(data) ? data : (data?.onlineUserIds || []);
      if (!Array.isArray(userIds)) return;
      const idSet = new Set(userIds.map((id) => id?.toString()));
      setOnlineUserIds(idSet);

      setActiveWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: (prev.members || []).map((m) => {
            const mUserId = (typeof m.user === 'object' ? m.user?._id : m.user)?.toString();
            if (mUserId && idSet.has(mUserId)) {
              const updatedUser = typeof m.user === 'object' ? { ...m.user, isOnline: true } : m.user;
              return { ...m, user: updatedUser };
            }
            return m;
          }),
        };
      });

      setActiveDmUser((prev) => {
        if (prev && idSet.has(prev._id?.toString())) {
          return { ...prev, isOnline: true };
        }
        return prev;
      });
    };

    // D. Reaction Updates (Real-time emoji reactions)
    const handleReactionUpdate = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id?.toString() === messageId?.toString()) {
            return { ...msg, reactions };
          }
          return msg;
        })
      );
    };

    // E. User Profile Updates
    const handleUserProfileUpdated = ({ userId, user: updatedUser }) => {
      setActiveWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: (prev.members || []).map((m) => {
            const mId = (typeof m.user === 'object' ? m.user?._id : m.user)?.toString();
            if (mId === userId?.toString()) {
              const uObj = typeof m.user === 'object' ? m.user : { _id: m.user };
              return { ...m, user: { ...uObj, ...updatedUser } };
            }
            return m;
          }),
        };
      });

      setActiveDmUser((prev) => {
        if (prev && prev._id?.toString() === userId?.toString()) {
          return { ...prev, ...updatedUser };
        }
        return prev;
      });
    };

    // F. Channel Updates
    const handleChannelUpdated = ({ channel: updatedChannel }) => {
      if (!updatedChannel?._id) return;
      setChannels((prev) =>
        prev.map((ch) => (ch._id?.toString() === updatedChannel._id?.toString() ? updatedChannel : ch))
      );
      setActiveChannel((prev) => {
        if (prev && prev._id?.toString() === updatedChannel._id?.toString()) {
          return updatedChannel;
        }
        return prev;
      });
    };

    // G. WebRTC Incoming Call Handler (DM & Channel Calls)
    const handleChannelCallActive = ({ channelId, active, caller }) => {
      if (!channelId) return;
      const cleanId = channelId.toString().replace(/^channel_/, '');
      setActiveChannelCalls((prev) => {
        const next = new Map(prev);
        if (active) {
          next.set(cleanId, { active: true, caller });
        } else {
          next.delete(cleanId);
        }
        return next;
      });
    };

    const handleIncomingCall = (data) => {
      if (!data) return;
      const callerId = (data.caller?._id || data.fromUserId || data.caller)?.toString();
      if (callerId && user?._id && callerId === user._id.toString()) return;
      if (soundEnabled) playRingtoneSound();
      setIncomingCall(data);
    };

    const handleIncomingChannelCall = (data) => {
      if (!data) return;
      const callerId = (data.caller?._id || data.fromUserId || data.caller)?.toString();
      const cleanChId = data.channelId ? data.channelId.toString().replace(/^channel_/, '') : null;

      if (cleanChId) {
        setActiveChannelCalls((prev) => {
          const next = new Map(prev);
          next.set(cleanChId, {
            active: true,
            caller: data.caller || { _id: callerId, name: data.callerName || data.fromUserName },
          });
          return next;
        });
      }

      if (callerId && user?._id && callerId === user._id.toString()) return;

      if (soundEnabled) playRingtoneSound();

      setIncomingCall({
        ...data,
        fromUserId: callerId,
        fromUserName: data.callerName || data.caller?.name || data.fromUserName || 'Teammate',
        fromUserAvatar: data.callerAvatar || data.caller?.avatar || data.fromUserAvatar || '',
        targetRoomId: data.targetRoomId || (data.channelId ? `channel_${data.channelId}` : null),
        isAudioOnly: data.isAudioOnly !== undefined ? data.isAudioOnly : data.callType === 'audio',
        isChannelCall: true,
        channelName: data.channelName,
      });
    };

    const handleIncomingMeetingInvite = (data) => {
      if (soundEnabled) playRingtoneSound();
      setIncomingMeetingInvite(data);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_delivered_update', handleDeliveredUpdate);
    socket.on('message_read_update', handleReadUpdate);
    socket.on('message_reaction_updated', handleReactionUpdate);
    socket.on('initial_online_users', handleInitialOnlineUsers);
    socket.on('online_users_list', handleInitialOnlineUsers);
    socket.on('user_status_change', handleUserStatusChange);
    socket.on('user_status_changed', handleUserStatusChange);
    socket.on('user_presence_changed', handleUserStatusChange);
    socket.on('user_online', (d) => handleUserStatusChange({ ...d, isOnline: true }));
    // H. Pinned Message Updates
    const handlePinnedUpdate = (updatedMsg) => {
      if (!updatedMsg?._id) return;
      setMessages((prev) =>
        prev.map((m) => (m._id?.toString() === updatedMsg._id?.toString() ? updatedMsg : m))
      );
    };

    socket.on('user_offline', (d) => handleUserStatusChange({ ...d, isOnline: false }));
    socket.on('user_profile_updated', handleUserProfileUpdated);
    socket.on('channel_updated', handleChannelUpdated);
    socket.on('incoming_call', handleIncomingCall);
    socket.on('incoming_channel_call', handleIncomingChannelCall);
    socket.on('channel_call_active', handleChannelCallActive);
    socket.on('incoming_meeting_invite', handleIncomingMeetingInvite);
    socket.on('message_pinned_updated', handlePinnedUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_delivered_update', handleDeliveredUpdate);
      socket.off('message_read_update', handleReadUpdate);
      socket.off('message_reaction_updated', handleReactionUpdate);
      socket.off('initial_online_users', handleInitialOnlineUsers);
      socket.off('online_users_list', handleInitialOnlineUsers);
      socket.off('user_status_change', handleUserStatusChange);
      socket.off('user_status_changed', handleUserStatusChange);
      socket.off('user_presence_changed', handleUserStatusChange);
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('user_profile_updated', handleUserProfileUpdated);
      socket.off('channel_updated', handleChannelUpdated);
      socket.off('incoming_call', handleIncomingCall);
      socket.off('incoming_channel_call', handleIncomingChannelCall);
      socket.off('channel_call_active', handleChannelCallActive);
      socket.off('incoming_meeting_invite', handleIncomingMeetingInvite);
      socket.off('message_pinned_updated', handlePinnedUpdate);
    };
  }, [socket, currentRoomId, activeChannel, activeConversationId, user, markDelivered, markAsRead, soundEnabled]);

  // Request online users snapshot whenever socket connects
  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit('get_online_users', (res) => {
      if (res?.success && Array.isArray(res.onlineUserIds)) {
        const idSet = new Set(res.onlineUserIds.map((id) => id?.toString()));
        setOnlineUserIds(idSet);
      }
    });
  }, [socket, connected]);

  const handleTogglePin = async (msg) => {
    try {
      if (socket) {
        socket.emit('toggle_pin_message', { messageId: msg._id, roomId: currentRoomId });
      } else {
        const res = await api.put(`/messages/${msg._id}/pin`);
        if (res.data?.success) {
          setMessages((prev) =>
            prev.map((m) => (m._id === msg._id ? res.data.message : m))
          );
        }
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // 5. Message & Typing Handlers
  const handleSendMessage = (messageData, attachmentArg) => {
    let content = '';
    let fileUrl = null;
    let fileType = null;
    let fileName = null;
    let fileSize = null;
    let replyTo = null;

    if (typeof messageData === 'string') {
      content = messageData.trim();
      if (attachmentArg && typeof attachmentArg === 'object') {
        fileUrl = attachmentArg.fileUrl || null;
        fileType = attachmentArg.fileType || null;
        fileName = attachmentArg.fileName || null;
        fileSize = attachmentArg.fileSize || null;
        replyTo = attachmentArg.replyTo || null;
      }
    } else if (typeof messageData === 'object' && messageData !== null) {
      content = (messageData.content || '').trim();
      fileUrl = messageData.fileUrl || null;
      fileType = messageData.fileType || null;
      fileName = messageData.fileName || null;
      fileSize = messageData.fileSize || null;
      replyTo = messageData.replyTo || null;
    }

    if (!content && !fileUrl) return;

    if (soundEnabled) playSentSound();

    const payload = {
      channelId: activeChannel ? activeChannel._id : null,
      conversationId: activeConversationId || null,
      content: content || '',
      fileUrl,
      fileType,
      fileName,
      fileSize,
      replyTo,
    };

    sendMessage(payload, (res) => {
      if (res?.success && res.message) {
        // Optimistically append / verify message in local state
        setMessages((prev) => {
          if (prev.some((m) => m._id?.toString() === res.message._id?.toString())) {
            return prev;
          }
          return [...prev, res.message];
        });
      } else if (!res?.success) {
        console.error('Failed to dispatch message:', res?.message);
      }
    });

    setReplyingToMsg(null);
  };

  const handlePlayVoiceNote = async (messageId) => {
    if (!messageId || !user?._id) return;

    const myIdStr = user._id.toString();

    // 1. Optimistically update local messages state immediately
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg._id?.toString() === messageId.toString()) {
          const currentReadBy = Array.isArray(msg.readBy) ? msg.readBy : [];
          const alreadyRead = currentReadBy.some((r) => (r._id || r)?.toString() === myIdStr);
          if (!alreadyRead) {
            return {
              ...msg,
              readBy: [...currentReadBy, user],
            };
          }
        }
        return msg;
      })
    );

    // 2. Emit mark_as_read over socket
    markAsRead(messageId, currentRoomId);

    // 3. Make background REST API call PUT /api/messages/:id/read as a fallback
    try {
      await api.put(`/messages/${messageId}/read`);
    } catch (err) {
      console.error('Failed to persist voice note read status via REST:', err);
    }
  };

  // Call Log Formatting & Dispatcher
  const formatCallDurationText = (seconds, isVideo, status) => {
    const callLabel = isVideo ? 'Video Call' : 'Audio Call';
    if (status === 'missed' || status === 'declined' || seconds === 0) {
      return `Missed ${callLabel}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    return `${callLabel} • ${durStr}`;
  };

  const dispatchCallLogMessage = (callInfo, durationSecs, status) => {
    if (!callInfo) return;

    const { isAudioOnly, type, targetUserId } = callInfo;
    const isVideo = Boolean(!isAudioOnly || type === 'video');
    const realCallType = isVideo ? 'video' : 'audio';

    // Log call event to server API
    api
      .post('/calls/log', {
        workspaceId: activeWorkspace?._id,
        caller: user?._id,
        recipients: targetUserId ? [targetUserId] : [],
        channel: activeChannel && !targetUserId ? activeChannel._id : null,
        channelId: activeChannel && !targetUserId ? activeChannel._id : null,
        type: realCallType,
        status: status || 'completed',
        duration: durationSecs || 0,
      })
      .catch((err) => console.error('Failed to log call stats:', err));

    if (!socket) return;

    const logText = formatCallDurationText(durationSecs, isVideo, status);

    const payload = {
      channelId: activeChannel ? activeChannel._id : null,
      conversationId: activeConversationId || null,
      content: logText,
      fileType: 'call_log',
      callType: isVideo ? 'video' : 'audio',
      callDuration: durationSecs,
      callStatus: status,
    };

    sendMessage(payload, (res) => {
      if (res?.success && res.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id?.toString() === res.message._id?.toString())) {
            return prev;
          }
          return [...prev, res.message];
        });
      }
    });
  };

  // WebRTC Call Action Handlers
  const startCall = (isAudioOnly = false) => {
    let targetUserId = null;
    let targetRoomId = null;
    let peerName = 'Teammate';
    let peerAvatar = '';

    if (activeDmUser) {
      targetUserId = activeDmUser._id;
      peerName = activeDmUser.name;
      peerAvatar = activeDmUser.avatar;
    } else if (activeChannel) {
      targetRoomId = `channel_${activeChannel._id}`;
      peerName = `#${activeChannel.name}`;
    } else {
      return;
    }

    setActiveCall({
      isAudioOnly,
      isInitiator: true,
      peerName,
      peerAvatar,
      targetUserId,
      targetRoomId,
    });
  };

  const handleStartCall = (targetUserOrType, callType = 'audio') => {
    let isAudioOnly = false;
    let targetUserId = null;
    let targetRoomId = null;
    let peerName = 'Teammate';
    let peerAvatar = '';

    if (typeof targetUserOrType === 'boolean') {
      startCall(targetUserOrType);
      return;
    }
    if (typeof targetUserOrType === 'string') {
      isAudioOnly = targetUserOrType === 'audio';
      startCall(isAudioOnly);
      return;
    }

    if (targetUserOrType && typeof targetUserOrType === 'object') {
      isAudioOnly = callType === 'audio';
      targetUserId = targetUserOrType._id;
      peerName = targetUserOrType.name || 'Teammate';
      peerAvatar = targetUserOrType.avatar || '';
    } else if (activeDmUser) {
      isAudioOnly = callType === 'audio';
      targetUserId = activeDmUser._id;
      peerName = activeDmUser.name;
      peerAvatar = activeDmUser.avatar;
    } else if (activeChannel) {
      isAudioOnly = callType === 'audio';
      targetRoomId = `channel_${activeChannel._id}`;
      peerName = `#${activeChannel.name}`;
    } else {
      return;
    }

    setActiveCall({
      isAudioOnly,
      isInitiator: true,
      peerName,
      peerAvatar,
      targetUserId,
      targetRoomId,
    });
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;

    setActiveCall({
      isAudioOnly: incomingCall.isAudioOnly,
      isInitiator: false,
      peerName: incomingCall.fromUserName || 'Teammate',
      peerAvatar: incomingCall.fromUserAvatar || '',
      targetUserId: incomingCall.fromUserId,
      targetRoomId: incomingCall.targetRoomId,
      incomingSignalData: incomingCall.signalData,
    });

    setIncomingCall(null);
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCall && socket) {
      socket.emit('call_ended', {
        targetUserId: incomingCall.fromUserId,
        targetRoomId: incomingCall.targetRoomId,
      });

      dispatchCallLogMessage(
        {
          isAudioOnly: incomingCall.isAudioOnly,
          targetUserId: incomingCall.fromUserId,
          targetRoomId: incomingCall.targetRoomId,
        },
        0,
        'declined'
      );
    }
    setIncomingCall(null);
  };

  const handleTyping = (isTyping) => {
    if (currentRoomId) {
      sendTyping(currentRoomId, isTyping);
    }
  };

  // 6. Channel & DM Selection Handlers
  const handleJoinChannelCall = (channel) => {
    if (!channel?._id) return;
    handleSelectChannel(channel);
    const cleanId = channel._id.toString();
    const callInfo = activeChannelCalls.get(cleanId) || activeChannelCalls.get(`channel_${cleanId}`);

    setActiveCall({
      isAudioOnly: false,
      isInitiator: !callInfo,
      peerName: `#${channel.name}`,
      peerAvatar: channel.avatar || '',
      targetRoomId: `channel_${cleanId}`,
      channelId: cleanId,
      channelName: channel.name,
    });
  };

  const handleSelectChannel = (channel) => {
    setActiveChannel(channel);
    setActiveDmUser(null);
    if (activeCall) setIsMeetingMinimized(true);
    handleSwitchView('chat');
    setMobileSidebarOpen(false);
    if (channel?._id) {
      const chIdStr = channel._id.toString();
      try {
        localStorage.setItem('syncspace_active_channel_id', chIdStr);
        localStorage.removeItem('syncspace_active_dm_user_id');
        localStorage.setItem('syncspace_active_view', 'chat');
      } catch (e) {
        console.error('Failed to save channel selection to localStorage:', e);
      }
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[chIdStr];
        delete next[`channel_${chIdStr}`];
        return next;
      });
    }
  };

  const handleSelectDm = (member) => {
    setActiveDmUser(member);
    setActiveChannel(null);
    if (activeCall) setIsMeetingMinimized(true);
    handleSwitchView('chat');
    setMobileSidebarOpen(false);
    if (member?._id) {
      const memberIdStr = member._id.toString();
      try {
        localStorage.setItem('syncspace_active_dm_user_id', memberIdStr);
        localStorage.removeItem('syncspace_active_channel_id');
        localStorage.setItem('syncspace_active_view', 'chat');
      } catch (e) {
        console.error('Failed to save DM user selection to localStorage:', e);
      }
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[memberIdStr];
        delete next[`dm_${memberIdStr}`];
        return next;
      });
    }
  };

  const handleSelectUser = (targetUser) => {
    handleSelectDm(targetUser);
  };

  const handleMemberAdded = (updatedWorkspace, newMember) => {
    setActiveWorkspace(updatedWorkspace);
    setWorkspaces((prev) =>
      prev.map((ws) => (ws._id === updatedWorkspace._id ? updatedWorkspace : ws))
    );
    if (newMember) {
      handleSelectDm(newMember);
    }
  };

  const executeForward = (destination) => {
    if (!forwardingMsg) return;

    const formattedContent = forwardingMsg.content
      ? `↪ Forwarded:\n${forwardingMsg.content}`
      : '↪ Forwarded attachment';

    const payload = {
      channelId: destination.channelId || null,
      conversationId: destination.conversationId || null,
      content: formattedContent,
      fileUrl: forwardingMsg.fileUrl || null,
      fileType: forwardingMsg.fileType || null,
      fileName: forwardingMsg.fileName || null,
      fileSize: forwardingMsg.fileSize || null,
      audioDuration: forwardingMsg.audioDuration || null,
    };

    sendMessage(payload, (res) => {
      if (res?.success) {
        setForwardingMsg(null);
        const notification = document.createElement('div');
        notification.className =
          'fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200';
        notification.innerHTML = `✓ Forwarded to ${destination.name}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2500);
      }
    });
  };

  // Workspace members excluding self
  const workspaceTeammates = useMemo(() => {
    if (!activeWorkspace?.members) return [];
    return activeWorkspace.members
      .map((m) => (typeof m.user === 'object' ? m.user : { _id: m.user, name: 'Member' }))
      .filter((u) => u && u._id?.toString() !== user?._id?.toString());
  }, [activeWorkspace, user]);

  const isOpponentOnline = activeDmUser?._id
    ? onlineUserIds.has(activeDmUser._id.toString())
    : false;

  // Compute active conversation title & subtitle for Header bar
  const chatTitle = activeChannel
    ? `# ${activeChannel.name}`
    : activeDmUser
    ? activeDmUser.name
    : 'SyncSpace Workspace';

  const chatSubtitle = activeChannel
    ? activeChannel.description ||
      (activeChannel.type === 'private'
        ? 'Private team channel'
        : 'Public workspace channel')
    : activeDmUser
    ? isOpponentOnline
      ? 'Active now'
      : 'Offline'
    : '';

  // Format typing notice
  const typingNames = Array.from(typingUsers.values());
  const typingText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length > 1
      ? `${typingNames.slice(0, 2).join(', ')} are typing...`
      : '';

  return (
    <div className="h-screen w-screen flex bg-slate-100 dark:bg-[#0d0f12] text-slate-900 dark:text-zinc-100 overflow-hidden font-sans relative">
      {/* Background Ambient Glowing Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="fixed -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="fixed top-1/4 right-0 w-[450px] h-[450px] bg-violet-600/15 rounded-full blur-[130px] pointer-events-none z-0" />
        <div className="fixed -bottom-20 left-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[110px] pointer-events-none z-0" />
      </div>

      {/* ========================================================================= */}
      {/* COLUMN 1: Workspace Rail (Leftmost)                                       */}
      {/* ========================================================================= */}
      <aside className="w-[72px] shrink-0 bg-[#13161c]/90 backdrop-blur-2xl border-r border-white/[0.07] shadow-[4px_0_24px_rgba(0,0,0,0.1)] flex flex-col items-center py-4 gap-3 z-30 select-none">
        {/* SyncSpace Brand Icon */}
        <button
          type="button"
          onClick={() => setIsLogoModalOpen(true)}
          className="mb-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
          title="SyncSpace About & Logo"
        >
          <Logo size="md" />
        </button>

        <div className="w-8 h-[1px] bg-white/10 my-1" />

        {/* Workspaces List */}
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-3 no-scrollbar">
          {workspaces.map((ws) => {
            const isActive = activeWorkspace?._id?.toString() === ws._id?.toString();
            const initials = ws.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div key={ws._id} className="relative group">
                {isActive && (
                  <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_12px_#6366f1]" />
                )}
                <button
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setMobileSidebarOpen(false);
                  }}
                  title={ws.name}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-white/20 scale-105'
                      : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 rounded-3xl hover:rounded-2xl border border-white/5'
                  }`}
                >
                  {initials || 'WS'}
                </button>
              </div>
            );
          })}

          {/* Add Workspace Button */}
          <button
            onClick={() => setIsWorkspaceModalOpen(true)}
            title="Create Workspace"
            className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-slate-900/40 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer group shadow-sm backdrop-blur-md"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>

          {/* Dedicated Calls Switcher Button */}
          <button
            onClick={() => {
              handleSwitchView('calls');
              setMobileSidebarOpen(false);
            }}
            title="Call History"
            className={`w-12 h-12 rounded-3xl hover:rounded-2xl flex items-center justify-center transition-all cursor-pointer group shadow-sm ${
              activeView === 'calls'
                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-white/20 scale-105'
                : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 border border-white/5'
            }`}
          >
            <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Global Connection Health Indicator */}
        <div className="pt-2 flex flex-col items-center">
          <div
            className={`w-3 h-3 rounded-full border-2 border-slate-950 transition-colors ${
              connected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 animate-pulse'
            }`}
            title={connected ? 'Real-time WebSocket Connected' : 'Reconnecting...'}
          />
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* COLUMN 2: Channels & DMs Sidebar                                          */}
      {/* ========================================================================= */}
      <nav
        className={`w-64 sm:w-72 shrink-0 bg-[#11141a]/85 backdrop-blur-2xl border-r border-white/[0.07] shadow-[4px_0_30px_rgba(0,0,0,0.15)] flex flex-col z-20 transition-all duration-300 absolute sm:relative h-full ${
          mobileSidebarOpen ? 'left-[72px]' : '-left-full sm:left-0'
        }`}
      >
        {/* Workspace Title Header */}
        <div className="h-16 px-4 border-b border-white/[0.07] flex items-center justify-between bg-[#13161c]/85 backdrop-blur-2xl shadow-sm">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate tracking-tight">
              {activeWorkspace?.name || 'SyncSpace Workspace'}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              /{activeWorkspace?.slug || 'workspace'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              title="Invite Teammate"
              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsChannelModalOpen(true)}
              title="New Channel"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tab Switcher (Chats / Calls) */}
        <div className="px-3 pt-3 pb-1 border-b border-white/5">
          <div className="grid grid-cols-2 gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => handleSwitchView('chat')}
              className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'chat'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)] border border-white/15'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chats</span>
            </button>
            <button
              onClick={() => {
                handleSwitchView('calls');
                setMobileSidebarOpen(false);
              }}
              className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'calls'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)] border border-white/15'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Calls</span>
            </button>
          </div>
        </div>

        {/* Channels & Team Members Scroller */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Channels Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 select-none">
              <span>Channels</span>
              <button
                onClick={() => setIsChannelModalOpen(true)}
                className="hover:text-slate-200 transition-colors cursor-pointer"
                title="Create Channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              {Array.isArray(channels) && channels.map((ch) => {
                if (!ch?._id) return null;
                const isActive = activeChannel?._id?.toString() === ch._id?.toString();
                const unread = unreadCounts?.[ch._id?.toString()] || unreadCounts?.[`channel_${ch._id}`] || 0;
                const activeCallInfo = activeChannelCalls.get(ch._id?.toString()) || activeChannelCalls.get(`channel_${ch._id}`);
                const isCallActive = Boolean(activeCallInfo?.active);
                return (
                  <div key={ch._id} className="relative flex items-center">
                    <button
                      onClick={() => handleSelectChannel(ch)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-sm font-medium transition-all text-left cursor-pointer group ${
                        isActive
                          ? 'bg-indigo-500/15 border border-indigo-500/40 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] font-semibold rounded-xl'
                          : unread > 0
                          ? 'text-white bg-slate-800/90 font-bold border border-emerald-500/30 shadow-sm'
                          : isCallActive
                          ? 'text-emerald-300 bg-emerald-950/30 font-semibold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isActive && <span className="w-1 h-4 rounded-full bg-indigo-500 shrink-0 -ml-1 shadow-[0_0_10px_#6366f1]" />}
                        {ch.avatar ? (
                          <img src={ch.avatar} alt={ch.name} className="w-4 h-4 rounded-md object-cover shrink-0" />
                        ) : ch.type === 'private' ? (
                          <Lock className="w-4 h-4 text-slate-400 group-hover:text-slate-300 shrink-0" />
                        ) : (
                          <Hash className="w-4 h-4 text-slate-400 group-hover:text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{ch.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCallActive && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJoinChannelCall(ch);
                            }}
                            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/40 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all shadow-sm shadow-emerald-500/20 animate-pulse cursor-pointer"
                            title="Click to join live channel call"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <Phone className="w-3 h-3" />
                            <span>Join</span>
                          </span>
                        )}
                        {unread > 0 && !isCallActive && (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 animate-pulse">
                            {unread}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}

              {channels.length === 0 && (
                <p className="px-2.5 py-1 text-xs text-slate-500 italic">No channels yet</p>
              )}
            </div>
          </div>

          {/* Direct Messages / Team Members Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 select-none">
              <span>Direct Messages</span>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] normal-case font-medium text-indigo-400"
                title="Invite Teammate"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite</span>
              </button>
            </div>

            <div className="space-y-0.5">
              {Array.isArray(workspaceTeammates) && workspaceTeammates.map((member) => {
                if (!member?._id) return null;
                const isOnline = onlineUserIds.has(member._id.toString());
                const isActive = activeDmUser?._id?.toString() === member._id?.toString();
                const unread = unreadCounts?.[member._id?.toString()] || unreadCounts?.[`dm_${member._id}`] || 0;

                return (
                  <button
                    key={member._id}
                    onClick={() => handleSelectDm(member)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-sm font-medium transition-all text-left cursor-pointer group ${
                      isActive
                        ? 'bg-indigo-500/15 border border-indigo-500/40 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] font-semibold rounded-xl'
                        : unread > 0
                        ? 'text-white bg-slate-800/90 font-bold border border-emerald-500/30 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isActive && <span className="w-1 h-4 rounded-full bg-indigo-500 shrink-0 -ml-1 shadow-[0_0_10px_#6366f1]" />}
                      <div className="relative shrink-0 flex items-center justify-center">
                        <Avatar
                          src={member.avatar}
                          name={member.name}
                          className="w-6 h-6 rounded-md"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center">
                          {isOnline && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          )}
                          <span
                            className={`relative inline-flex rounded-full h-2 w-2 border border-slate-900 ${
                              isOnline ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate leading-tight font-medium">{member.name}</span>
                        <span className={`text-[10px] truncate leading-tight font-normal ${
                          isOnline ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {isOnline ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 animate-pulse">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}

              {workspaceTeammates.length === 0 && (
                <div className="px-3 py-3 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 mt-1">
                  <p className="text-xs text-slate-400">No teammates yet</p>
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="mt-2 text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Invite Teammate</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom User Profile Drawer */}
        <div className="h-16 px-3.5 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar
                src={user?.avatar}
                name={user?.name}
                className="w-8 h-8 rounded-xl"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] border-2 border-slate-950 absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">{user?.name}</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium truncate" title={user?.statusText || 'Active'}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#10b981]" />
                <span className="truncate">{user?.statusText || 'Active'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              title="Edit Profile"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* COLUMN 3: Main Chat View                                                  */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col bg-transparent relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="ambient-glow" />

        {/* WhatsApp-style Chat Wallpaper & Doodle Overlay */}
        <div className="absolute inset-0 bg-[#0c0e14] dark:bg-[#0c0e14] light:bg-[#efeae2] transition-colors duration-200 pointer-events-none z-0">
          <div className="absolute inset-0 chat-doodle-bg opacity-[0.06] dark:opacity-[0.06] light:opacity-[0.08]" />
        </div>

        {activeView === 'calls' ? (
          <CallHistoryErrorBoundary>
            <CallHistoryView
              activeWorkspace={activeWorkspace}
              currentWorkspace={activeWorkspace}
              workspace={activeWorkspace}
              currentUser={user}
              user={user}
              socket={socket}
              onlineUserIds={onlineUserIds}
              onStartCall={(callConfig) => {
                const isAudioOnly = Boolean(callConfig.isAudioOnly);
                if (callConfig.targetUserId) {
                  const teammate = workspaceTeammates.find(
                    (m) => m._id?.toString() === callConfig.targetUserId?.toString()
                  );
                  if (teammate) {
                    handleSelectDm(teammate);
                  }
                } else if (callConfig.targetRoomId) {
                  const rawChId = callConfig.targetRoomId.replace(/^channel_/, '');
                  const ch = channels.find((c) => c._id?.toString() === rawChId);
                  if (ch) {
                    handleSelectChannel(ch);
                  }
                }
                setActiveCall({
                  isAudioOnly,
                  targetUserId: callConfig.targetUserId || null,
                  targetRoomId:
                    callConfig.targetRoomId || (activeChannel ? `channel_${activeChannel._id}` : null),
                  peerName: callConfig.peerName || 'Teammate',
                  peerAvatar: callConfig.peerAvatar || '',
                  incomingSignalData: null,
                });
              }}
            />
          </CallHistoryErrorBoundary>
        ) : (
          <>
            {/* Chat Header */}
        <header className="h-16 border-b border-white/[0.07] bg-[#13161c]/85 backdrop-blur-2xl px-4 sm:px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Sidebar Toggle Button */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="sm:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Header Avatar Badge */}
            {activeDmUser ? (
              <div className="relative shrink-0 flex items-center justify-center">
                <Avatar
                  src={activeDmUser.avatar}
                  name={activeDmUser.name}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl"
                />
                <div className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                  {isOpponentOnline && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-slate-900 ${
                      isOpponentOnline
                        ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]'
                        : 'bg-slate-600'
                    }`}
                  />
                </div>
              </div>
            ) : activeChannel ? (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-indigo-400 font-bold shrink-0 overflow-hidden shadow-inner">
                {activeChannel.avatar ? (
                  <img src={activeChannel.avatar} alt={activeChannel.name} className="w-full h-full object-cover rounded-xl" />
                ) : activeChannel.type === 'private' ? (
                  <Lock className="w-4 h-4 text-slate-300" />
                ) : (
                  <Hash className="w-5 h-5 text-indigo-400" />
                )}
              </div>
            ) : null}

            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 truncate tracking-tight">{chatTitle}</h1>
                {activeChannel?.type === 'private' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800/80 text-slate-400 border border-white/5">
                    Private
                  </span>
                )}
                {activeChannel && (
                  <button
                    onClick={() => setIsChannelSettingsOpen(true)}
                    title="Channel Settings"
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
              {activeDmUser ? (
                <p className={`text-xs truncate font-normal ${isOpponentOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isOpponentOnline ? 'Active now' : 'Offline'}
                </p>
              ) : (
                <p className="text-xs text-slate-400 truncate">{chatSubtitle}</p>
              )}
            </div>
          </div>

          {/* Top Right Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQuickSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-white/10 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-slate-100 transition-all cursor-pointer shadow-md"
              title="Search Workspace (Ctrl + K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-slate-800 border border-white/10 rounded text-slate-300 font-mono">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={() => setIsPinnedDrawerOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                pinnedMessages.length > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-slate-900/70 backdrop-blur-md text-slate-400 border-white/10 hover:text-white'
              }`}
              title="Pinned Messages"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>{pinnedMessages.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2 rounded-xl bg-slate-900/70 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/10"
              title={soundEnabled ? 'Mute Sound Effects' : 'Unmute Sound Effects'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-slate-700 dark:text-slate-300 cursor-pointer shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => startCall(true)}
              className="p-2 rounded-xl bg-gradient-to-r from-indigo-500/80 to-violet-600/80 hover:from-indigo-500 hover:to-violet-600 text-white transition-all cursor-pointer border border-white/15 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
              title="Start Audio Call"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => startCall(false)}
              className="p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white transition-all cursor-pointer border border-white/15 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_25px_rgba(99,102,241,0.55)]"
              title="Start Video Call"
            >
              <Video className="w-4 h-4 text-white" />
            </button>
          </div>
        </header>

        {/* Collapsible Pinned Messages Drawer */}
        {isPinnedDrawerOpen && (
          <div className="bg-slate-900/95 border-b border-slate-800 p-3 px-6 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2 text-xs font-bold text-amber-400">
              <div className="flex items-center gap-1.5">
                <Pin className="w-4 h-4" />
                <span>Pinned Messages ({pinnedMessages.length})</span>
              </div>
              <button onClick={() => setIsPinnedDrawerOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {pinnedMessages.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No pinned messages in this conversation</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                {pinnedMessages.map((msg) => (
                  <div key={msg._id} className="flex items-start justify-between bg-slate-950/80 border border-slate-800 rounded-xl p-2 px-3 text-xs">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-slate-200">{msg.sender?.name}</span>
                      <span className="text-slate-400 truncate">{msg.content || msg.fileName || 'Attachment'}</span>
                    </div>
                    <button
                      onClick={() => handleTogglePin(msg)}
                      className="p-1 px-2 rounded-lg text-rose-400 hover:bg-rose-500/20 text-[11px] font-semibold cursor-pointer shrink-0"
                    >
                      Unpin
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Message Feed */}
        <MessageFeed
          messages={messages}
          loading={loadingMessages}
          currentUserId={user?._id}
          activeChannel={activeChannel}
          activeDmUser={activeDmUser}
          chatName={chatTitle}
          onReact={(messageId, emoji) => reactToMessage(messageId, emoji, currentRoomId)}
          onPlayVoiceNote={handlePlayVoiceNote}
          onForwardMessage={(msg) => setForwardingMsg(msg)}
          onReply={(msg) => setReplyingToMsg(msg)}
          onTogglePin={handleTogglePin}
          onStartCall={handleStartCall}
        />

        {/* Typing Indicator Bar */}
        <div className="h-6 px-6 text-xs text-slate-400 font-medium flex items-center gap-2 select-none">
          {typingText && (
            <div className="flex items-center gap-2 text-brand-400 animate-in fade-in duration-150">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{typingText}</span>
            </div>
          )}
        </div>

        {/* Message Input Box */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          placeholder={`Message ${chatTitle}...`}
          disabled={!currentRoomId}
          replyingTo={replyingToMsg}
          onCancelReply={() => setReplyingToMsg(null)}
        />
          </>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onWorkspaceCreated={(newWs) => {
          setWorkspaces((prev) => [...prev, newWs]);
          setActiveWorkspace(newWs);
        }}
      />

      {activeWorkspace && (
        <CreateChannelModal
          isOpen={isChannelModalOpen}
          workspaceId={activeWorkspace._id}
          onClose={() => setIsChannelModalOpen(false)}
          onChannelCreated={(newCh) => {
            setChannels((prev) => [...prev, newCh]);
            setActiveChannel(newCh);
            setActiveDmUser(null);
          }}
        />
      )}

      {activeWorkspace && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          workspace={activeWorkspace}
          onClose={() => setIsInviteModalOpen(false)}
          onMemberAdded={handleMemberAdded}
        />
      )}

      {/* Forward Message Modal */}
      {forwardingMsg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-brand-400" />
                <h3 className="font-bold text-base text-slate-100">Forward Message</h3>
              </div>
              <button
                onClick={() => setForwardingMsg(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex flex-col gap-1">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                Original Message
              </span>
              <p className="truncate italic">
                {forwardingMsg.content || forwardingMsg.fileName || 'Attachment'}
              </p>
            </div>

            {/* Destination List */}
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
              {/* Channels */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Channels
                </p>
                <div className="space-y-1">
                  {channels.map((ch) => (
                    <button
                      key={ch._id}
                      onClick={() => executeForward({ channelId: ch._id, name: `#${ch.name}` })}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <span className="truncate">#{ch.name}</span>
                      <span className="text-[10px] text-brand-400 font-semibold">Forward</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Teammates */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Teammates
                </p>
                <div className="space-y-1">
                  {workspaceTeammates.map((member) => (
                    <button
                      key={member._id}
                      onClick={() =>
                        executeForward({
                          conversationId: `dm_${[user._id.toString(), member._id.toString()].sort().join('_')}`,
                          name: member.name,
                        })
                      }
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Avatar
                          src={member.avatar}
                          name={member.name}
                          className="w-5 h-5 rounded-md"
                        />
                        <span className="truncate">{member.name}</span>
                      </div>
                      <span className="text-[10px] text-brand-400 font-semibold">Forward</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Channel Settings Modal */}
      {activeChannel && (
        <ChannelSettingsModal
          isOpen={isChannelSettingsOpen}
          channel={activeChannel}
          workspaceMembers={activeWorkspace?.members || []}
          onClose={() => setIsChannelSettingsOpen(false)}
          onChannelUpdated={(updatedCh) => {
            setActiveChannel(updatedCh);
            setChannels((prev) =>
              prev.map((c) => (c._id === updatedCh._id ? updatedCh : c))
            );
          }}
        />
      )}
      {/* WebRTC Calling Modals */}
      <IncomingCallModal
        callData={incomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      {incomingMeetingInvite && (
        <div className="fixed top-5 right-5 z-[100] bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <Avatar
              src={incomingMeetingInvite.callerAvatar}
              name={incomingMeetingInvite.callerName}
              className="w-10 h-10 rounded-xl shrink-0"
            />
            <div>
              <p className="text-xs font-bold text-slate-100">{incomingMeetingInvite.callerName}</p>
              <p className="text-[11px] text-slate-300">Invited you to join a live meeting</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIncomingMeetingInvite(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveCall({
                  isAudioOnly: incomingMeetingInvite.isAudioOnly || false,
                  isInitiator: false,
                  peerName: incomingMeetingInvite.callerName || 'Meeting Host',
                  peerAvatar: incomingMeetingInvite.callerAvatar || '',
                  targetUserId: incomingMeetingInvite.callerId,
                  targetRoomId: incomingMeetingInvite.meetingRoomId,
                });
                setIncomingMeetingInvite(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Join Meeting</span>
            </button>
          </div>
        </div>
      )}

      {activeCall && (
        <VideoMeetingModal
          isOpen={!!activeCall}
          isMinimized={isMeetingMinimized}
          onToggleMinimize={() => setIsMeetingMinimized((prev) => !prev)}
          isAudioOnly={activeCall.isAudioOnly}
          isInitiator={activeCall.isInitiator}
          callerName={user?.name || 'You'}
          callerAvatar={user?.avatar || ''}
          peerName={activeCall.peerName}
          peerAvatar={activeCall.peerAvatar}
          socket={socket}
          targetUserId={activeCall.targetUserId}
          targetRoomId={activeCall.targetRoomId}
          workspaceId={activeWorkspace?._id}
          channelId={activeCall.channelId || (activeCall.targetRoomId?.startsWith('channel_') ? activeCall.targetRoomId.replace(/^channel_/, '') : activeChannel?._id)}
          channelName={activeCall.channelName || activeChannel?.name}
          incomingSignalData={activeCall.incomingSignalData}
          onlineUserIds={onlineUserIds}
          teammates={workspaceTeammates}
          isChannel={Boolean((activeChannel || activeCall.channelId || activeCall.targetRoomId?.startsWith('channel_')) && !activeCall.targetUserId)}
          onEndCall={({ duration, status, isAudioOnly: endAudioOnly, type: endType }) => {
            const finalIsAudioOnly = endAudioOnly !== undefined ? endAudioOnly : activeCall.isAudioOnly;
            const updatedCall = {
              ...activeCall,
              isAudioOnly: finalIsAudioOnly,
              type: endType || (finalIsAudioOnly ? 'audio' : 'video'),
            };
            dispatchCallLogMessage(updatedCall, duration, status);
            setIsMeetingMinimized(false);
            setActiveCall(null);
          }}
        />
      )}

      {/* Enlarged Logo Lightbox Modal */}
      {isLogoModalOpen && (
        <div
          onClick={() => setIsLogoModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900/90 border border-slate-700/60 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5 relative max-w-sm sm:max-w-md w-full text-center animate-in zoom-in-95 duration-200 select-none"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsLogoModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scaled Up Glowing Logo */}
            <div className="my-2 transition-transform hover:scale-105 duration-300">
              <Logo size="xl" showText={true} className="scale-110 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]" />
            </div>

            <div className="flex flex-col gap-1.5 items-center">
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase px-3 py-1 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/30">
                SyncEngine v2.0 Active
              </span>
              <p className="text-xs text-slate-400 font-medium max-w-xs mt-1">
                SyncSpace • High-Performance Enterprise Collaboration
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QuickSearch Spotlight Modal */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        channels={channels}
        workspaceMembers={activeWorkspace?.members || []}
        messages={messages}
        onSelectChannel={(ch) => handleSelectChannel(ch)}
        onSelectUser={(u) => handleSelectUser(u)}
        onSelectMessage={(msg) => {
          const el = document.getElementById(`msg-${msg._id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />
    </div>
  );
};

export default Dashboard;
