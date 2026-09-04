const User = require('../models/User');
const Message = require('../models/Message');
const { verifyToken } = require('../utils/jwt');

// In-memory active sockets registry: Map<userIdString, Set<socketId>>
const onlineUsers = new Map();
const userSockets = onlineUsers; // alias for backwards compatibility

/**
 * Determine standardized room identifier
 * @param {object} payload
 * @returns {string|null}
 */
const resolveRoomId = (data) => {
  if (!data) return null;
  if (typeof data === 'string') {
    return data;
  }
  const { roomId, channelId, conversationId } = data;
  if (roomId) {
    return roomId.toString();
  }
  if (channelId) {
    const cleanChannelId = channelId.toString().replace(/^channel_/, '');
    return `channel_${cleanChannelId}`;
  }
  if (conversationId) {
    const cleanConvId = conversationId.toString().replace(/^dm_/, '');
    return `dm_${cleanConvId}`;
  }
  return null;
};

/**
 * Initialize Socket.io real-time engine
 * @param {import('socket.io').Server} io
 */
const initSocket = (io) => {
  // 1. Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.headers?.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach authenticated user to socket instance
      socket.user = user;
      next();
    } catch (err) {
      console.error('[Socket] Auth middleware error:', err);
      next(new Error('Authentication error: Internal server error'));
    }
  });

  // 2. Connection Lifecycle
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`[Socket] User connected: ${socket.user.name} (${userId}) on socket ${socket.id}`);

    // Update in-memory user-socket mapping
    let isFirstConnection = false;
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      isFirstConnection = true;
    }
    onlineUsers.get(userId).add(socket.id);

    // Update presence in DB & broadcast presence across all relevant events if first connection
    if (isFirstConnection) {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      } catch (err) {
        console.error('[Socket] Error updating user presence on connect:', err);
      }

      const onlinePayload = {
        userId,
        isOnline: true,
        lastSeen: new Date(),
      };
      io.emit('user_status_change', onlinePayload);
      io.emit('user_status_changed', onlinePayload);
      io.emit('user_presence_changed', onlinePayload);
      io.emit('user_online', { userId, isOnline: true });
    }

    // Send immediate snapshot of all currently online users to the connecting client
    const currentOnlineUserIds = Array.from(onlineUsers.keys());
    socket.emit('initial_online_users', currentOnlineUserIds);
    socket.emit('online_users_list', { onlineUserIds: currentOnlineUserIds });

    // Join user to their personal user room for targeted notifications
    socket.join(`user_${userId}`);

    // Client request for immediate online users list
    socket.on('get_online_users', (callback) => {
      const activeIds = Array.from(onlineUsers.keys());
      if (typeof callback === 'function') {
        callback({ success: true, onlineUserIds: activeIds });
      } else {
        socket.emit('initial_online_users', activeIds);
        socket.emit('online_users_list', { onlineUserIds: activeIds });
      }
    });

    // 3. Room Management Events
    socket.on('join_room', (data, callback) => {
      const roomId = resolveRoomId(data || {});
      if (!roomId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Invalid room identifier' });
        return;
      }

      socket.join(roomId);
      console.log(`[Socket] User ${socket.user.name} joined room ${roomId}`);
      if (typeof callback === 'function') callback({ success: true, roomId });
    });

    socket.on('leave_room', (data, callback) => {
      const roomId = resolveRoomId(data || {});
      if (!roomId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Invalid room identifier' });
        return;
      }

      socket.leave(roomId);
      console.log(`[Socket] User ${socket.user.name} left room ${roomId}`);
      if (typeof callback === 'function') callback({ success: true, roomId });
    });

    // 4. Real-Time Messaging Event
    socket.on('send_message', async (data, callback) => {
      try {
        const { content, channelId, conversationId, fileUrl, fileType, fileName, fileSize, audioDuration, replyTo } = data || {};

        if ((!content || !content.trim()) && !fileUrl) {
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'Message content or attachment is required' });
          }
          return;
        }

        if (!channelId && !conversationId) {
          if (typeof callback === 'function') {
            return callback({
              success: false,
              message: 'Message must specify either channelId or conversationId',
            });
          }
          return;
        }

        // Standardize conversationId
        const cleanConversationId = conversationId
          ? conversationId.toString().replace(/^dm_/, '')
          : null;

        // Persist message to database
        const message = await Message.create({
          channelId: channelId || null,
          conversationId: cleanConversationId,
          sender: socket.user._id,
          content: (content || '').trim(),
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          audioDuration: audioDuration || null,
          replyTo: replyTo || null,
          readBy: [socket.user._id],
          deliveredTo: [socket.user._id],
        });

        // Populate sender info for immediate frontend display
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email avatar isOnline')
          .populate('readBy', 'name avatar')
          .populate('deliveredTo', 'name avatar')
          .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name email avatar' } });

        const roomId = resolveRoomId({ channelId, conversationId: cleanConversationId });
        console.log(`[Socket] Dispatched new_message to room ${roomId} (sender: ${socket.user.name})`);

        // Broadcast to main room
        if (roomId) {
          io.to(roomId).emit('new_message', populatedMessage);
        }

        // Direct delivery to personal user rooms for DM participants
        if (cleanConversationId) {
          const participantIds = cleanConversationId.split('_');
          participantIds.forEach((pId) => {
            if (pId) {
              io.to(`user_${pId}`).emit('new_message', populatedMessage);
            }
          });
        }

        if (typeof callback === 'function') {
          callback({ success: true, message: populatedMessage });
        }
      } catch (err) {
        console.error('[Socket] Error in send_message:', err);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Failed to send message: ' + err.message });
        }
      }
    });

    // Toggle Pin Message Socket Event
    socket.on('toggle_pin_message', async (data, callback) => {
      try {
        const { messageId, roomId } = data || {};
        if (!messageId) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        message.isPinned = !message.isPinned;
        await message.save();

        const populatedMsg = await Message.findById(message._id)
          .populate('sender', 'name email avatar isOnline')
          .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name email avatar' } });

        if (roomId) {
          io.to(roomId).emit('message_pinned_updated', populatedMsg);
        }

        if (typeof callback === 'function') callback({ success: true, message: populatedMsg });
      } catch (err) {
        console.error('[Socket] Error in toggle_pin_message:', err);
      }
    });

    // 5. Typing Indicators (In-Memory Broadcast, no DB write)
    socket.on('typing_start', (data) => {
      const roomId = resolveRoomId(data || {});
      if (roomId) {
        socket.to(roomId).emit('user_typing', {
          roomId,
          userId: socket.user._id,
          name: socket.user.name,
          isTyping: true,
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const roomId = resolveRoomId(data || {});
      if (roomId) {
        socket.to(roomId).emit('user_typing', {
          roomId,
          userId: socket.user._id,
          name: socket.user.name,
          isTyping: false,
        });
      }
    });

    // Profile & Channel Real-Time Broadcasts
    socket.on('update_profile', (data) => {
      if (data?.user) {
        socket.user = { ...socket.user, ...data.user };
        io.emit('user_profile_updated', {
          userId: socket.user._id,
          user: data.user,
        });
      }
    });

    socket.on('update_channel', (data) => {
      if (data?.channel) {
        io.emit('channel_updated', {
          channel: data.channel,
        });
      }
    });

    // 6A. Message Delivery Receipts (Delivered = Double Gray Tick)
    const handleMarkDelivered = async (data, callback) => {
      try {
        const { messageId, roomId } = data || {};
        if (!messageId) {
          if (typeof callback === 'function') callback({ success: false, message: 'messageId is required' });
          return;
        }

        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { deliveredTo: socket.user._id } },
          { new: true }
        );

        if (!updatedMessage) {
          if (typeof callback === 'function') callback({ success: false, message: 'Message not found' });
          return;
        }

        const targetRoom =
          roomId ||
          resolveRoomId({
            channelId: updatedMessage.channelId,
            conversationId: updatedMessage.conversationId,
          });

        if (targetRoom) {
          io.to(targetRoom).emit('message_delivered_update', {
            messageId: updatedMessage._id,
            userId: socket.user._id,
            deliveredTo: updatedMessage.deliveredTo,
          });
        }

        if (typeof callback === 'function') {
          callback({ success: true, message: updatedMessage });
        }
      } catch (err) {
        console.error('[Socket] Error in mark_delivered:', err);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Failed to mark as delivered' });
        }
      }
    };

    socket.on('mark_delivered', handleMarkDelivered);
    socket.on('message_delivered', handleMarkDelivered);

    // 6B. Message Read Receipts (Read / Seen = Double Blue Tick)
    const handleMarkRead = async (data, callback) => {
      try {
        const { messageId, roomId } = data || {};
        if (!messageId) {
          if (typeof callback === 'function') callback({ success: false, message: 'messageId is required' });
          return;
        }

        // Marking as read also implies delivered
        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          {
            $addToSet: {
              readBy: socket.user._id,
              deliveredTo: socket.user._id,
            },
          },
          { new: true }
        );

        if (!updatedMessage) {
          if (typeof callback === 'function') callback({ success: false, message: 'Message not found' });
          return;
        }

        // Determine destination room from parameter or message document
        const targetRoom =
          roomId ||
          resolveRoomId({
            channelId: updatedMessage.channelId,
            conversationId: updatedMessage.conversationId,
          });

        if (targetRoom) {
          io.to(targetRoom).emit('message_read_update', {
            messageId: updatedMessage._id,
            userId: socket.user._id,
            readBy: updatedMessage.readBy,
          });
        }

        if (typeof callback === 'function') {
          callback({ success: true, message: updatedMessage });
        }
      } catch (err) {
        console.error('[Socket] Error in mark_as_read:', err);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Failed to mark as read' });
        }
      }
    };

    socket.on('mark_as_read', handleMarkRead);
    socket.on('mark_read', handleMarkRead);
    socket.on('voice_note_played', handleMarkRead);

    // 7. Message Reaction Event
    socket.on('react_to_message', async (data, callback) => {
      try {
        const { messageId, emoji, roomId } = data || {};
        if (!messageId || !emoji) {
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'Message ID and emoji are required' });
          }
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'Message not found' });
          }
          return;
        }

        const userIdStr = socket.user._id.toString();
        const existingIdx = (message.reactions || []).findIndex(
          (r) => (r.user._id || r.user).toString() === userIdStr
        );

        if (existingIdx > -1) {
          const currentEmoji = message.reactions[existingIdx].emoji;
          if (currentEmoji === emoji) {
            // Remove reaction if same emoji is clicked again
            message.reactions.splice(existingIdx, 1);
          } else {
            // Update to new emoji if different
            message.reactions[existingIdx].emoji = emoji;
          }
        } else {
          // Add new reaction
          if (!message.reactions) message.reactions = [];
          message.reactions.push({
            emoji,
            user: socket.user._id,
          });
        }

        await message.save();

        const updatedMessage = await Message.findById(message._id)
          .populate('reactions.user', 'name avatar');

        const targetRoom = roomId || resolveRoomId({ channelId: message.channelId, conversationId: message.conversationId });

        if (targetRoom) {
          io.to(targetRoom).emit('message_reaction_updated', {
            messageId: message._id,
            reactions: updatedMessage.reactions,
          });
        }

        if (typeof callback === 'function') {
          callback({
            success: true,
            messageId: message._id,
            reactions: updatedMessage.reactions,
          });
        }
      } catch (err) {
        console.error('[Socket] Error in react_to_message:', err);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Failed to update reaction' });
        }
      }
    });

    // 9. WebRTC Calling Signaling Handlers
    const handleCallUser = (data) => {
      const { targetUserId, targetRoomId, signalData, isAudioOnly, channelId, channelName, meetingId, callType, workspaceId } = data || {};
      const roomId = targetRoomId || (channelId ? `channel_${channelId}` : null);
      const cleanChannelId = channelId
        ? channelId.toString().replace(/^channel_/, '')
        : roomId && roomId.startsWith('channel_')
        ? roomId.replace(/^channel_/, '')
        : null;

      if (roomId) {
        socket.join(roomId);
      }

      const payload = {
        signalData,
        fromUserId: socket.user._id,
        fromUserName: socket.user.name,
        fromUserAvatar: socket.user.avatar,
        caller: {
          _id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
        callerName: socket.user.name,
        callerAvatar: socket.user.avatar,
        isAudioOnly: !!isAudioOnly,
        callType: callType || (isAudioOnly ? 'audio' : 'video'),
        targetRoomId: roomId,
        targetUserId: targetUserId || null,
        channelId: cleanChannelId,
        channelName: channelName || null,
        workspaceId: workspaceId || null,
        meetingId: meetingId || roomId || (cleanChannelId ? `channel_${cleanChannelId}` : null),
      };

      if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('incoming_call', payload);
      } else if (roomId || cleanChannelId) {
        socket.to(roomId).emit('incoming_call', payload);
        socket.to(roomId).emit('incoming_channel_call', payload);

        if (workspaceId) {
          socket.to(workspaceId.toString()).emit('incoming_channel_call', payload);
          socket.to(`workspace_${workspaceId}`).emit('incoming_channel_call', payload);
          io.to(workspaceId.toString()).emit('channel_call_active', {
            channelId: cleanChannelId,
            active: true,
            caller: payload.caller,
            workspaceId,
          });
          io.to(`workspace_${workspaceId}`).emit('channel_call_active', {
            channelId: cleanChannelId,
            active: true,
            caller: payload.caller,
            workspaceId,
          });
        }

        // Global fallback broadcasts so all online teammates get the call signaling & live status
        io.emit('channel_call_active', {
          channelId: cleanChannelId,
          active: true,
          caller: payload.caller,
          workspaceId: workspaceId || null,
        });
        io.emit('incoming_channel_call', payload);
      }
    };

    socket.on('call_user', handleCallUser);
    socket.on('start_channel_call', handleCallUser);
    socket.on('initiate_call', handleCallUser);

    socket.on('call_accepted', (data) => {
      const { toUserId, targetRoomId, signalData } = data || {};
      const payload = {
        signalData,
        fromUserId: socket.user._id,
        fromUserName: socket.user.name,
      };

      if (toUserId) {
        io.to(`user_${toUserId}`).emit('call_accepted', payload);
      } else if (targetRoomId) {
        socket.to(targetRoomId).emit('call_accepted', payload);
      }
    });

    socket.on('ice_candidate', (data) => {
      const { targetUserId, targetRoomId, candidate } = data || {};
      const payload = {
        candidate,
        fromUserId: socket.user._id,
      };

      if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('ice_candidate', payload);
      } else if (targetRoomId) {
        socket.to(targetRoomId).emit('ice_candidate', payload);
      }
    });

    const handleCallEnded = (data) => {
      const { targetUserId, targetRoomId, channelId, workspaceId } = data || {};
      const cleanChannelId = channelId
        ? channelId.toString().replace(/^channel_/, '')
        : targetRoomId && typeof targetRoomId === 'string' && targetRoomId.startsWith('channel_')
        ? targetRoomId.replace(/^channel_/, '')
        : null;

      const payload = {
        fromUserId: socket.user._id,
      };

      if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('call_ended', payload);
      } else if (targetRoomId) {
        socket.to(targetRoomId).emit('call_ended', payload);
      }

      if (cleanChannelId) {
        const activeStatus = {
          channelId: cleanChannelId,
          active: false,
          caller: { _id: socket.user._id },
          workspaceId: workspaceId || null,
        };

        if (workspaceId) {
          io.to(workspaceId.toString()).emit('channel_call_active', activeStatus);
          io.to(`workspace_${workspaceId}`).emit('channel_call_active', activeStatus);
        }
        io.emit('channel_call_active', activeStatus);
      }
    };

    socket.on('call_ended', handleCallEnded);
    socket.on('end_channel_call', handleCallEnded);
    socket.on('leave_channel_call', handleCallEnded);

    const handleMeetingInvite = (data) => {
      const { meetingRoomId, targetUserId, isAudioOnly } = data || {};
      const payload = {
        meetingRoomId: meetingRoomId || null,
        callerId: socket.user._id,
        callerName: socket.user.name,
        callerAvatar: socket.user.avatar,
        isAudioOnly: !!isAudioOnly,
        timestamp: new Date(),
      };

      if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('incoming_meeting_invite', payload);
      }
    };

    socket.on('meeting_invite_sent', handleMeetingInvite);
    socket.on('send_meeting_invite', handleMeetingInvite);

    // 8. Disconnection Handling
    socket.on('disconnect', async () => {
      console.log(`[Socket] User disconnected: ${socket.user.name} on socket ${socket.id}`);

      const userSocketSet = onlineUsers.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);

        // If no more active sockets remain for this user, mark offline in DB & broadcast presence
        if (userSocketSet.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date();

          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen,
            });

            const offlinePayload = {
              userId,
              isOnline: false,
              lastSeen,
            };
            io.emit('user_status_change', offlinePayload);
            io.emit('user_status_changed', offlinePayload);
            io.emit('user_presence_changed', offlinePayload);
            io.emit('user_offline', { userId, isOnline: false, lastSeen });
          } catch (err) {
            console.error('[Socket] Error updating presence on disconnect:', err);
          }
        }
      }
    });
  });

  return { io, onlineUsers, userSockets };
};

module.exports = initSocket;
module.exports.onlineUsers = onlineUsers;
module.exports.userSockets = userSockets;
