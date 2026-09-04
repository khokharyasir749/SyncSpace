import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { token, user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  const activeRoomsRef = useRef(new Set());

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
        setOnlineUsers(new Map());
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log(`[Socket] Connected to server: ${newSocket.id}`);
      setConnected(true);

      // Re-join active rooms on reconnection
      activeRoomsRef.current.forEach((roomId) => {
        newSocket.emit('join_room', { roomId });
      });

      // Request immediate online presence snapshot
      newSocket.emit('get_online_users', (res) => {
        if (res?.success && Array.isArray(res.onlineUserIds)) {
          setOnlineUsers((prev) => {
            const next = new Map(prev);
            res.onlineUserIds.forEach((id) => {
              if (id) next.set(id.toString(), { isOnline: true, lastSeen: new Date() });
            });
            return next;
          });
        }
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.warn(`[Socket] Disconnected from server: ${reason}`);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error(`[Socket] Connection error:`, err.message);
    });

    // Handle initial online users list snapshot from server
    const handleInitialUsers = (data) => {
      const userIds = Array.isArray(data) ? data : (data?.onlineUserIds || []);
      if (Array.isArray(userIds)) {
        setOnlineUsers((prev) => {
          const next = new Map(prev);
          userIds.forEach((id) => {
            if (id) next.set(id.toString(), { isOnline: true, lastSeen: new Date() });
          });
          return next;
        });
      }
    };

    newSocket.on('initial_online_users', handleInitialUsers);
    newSocket.on('online_users_list', handleInitialUsers);

    // Global Presence Listeners (supporting user_status_change, user_presence_changed, user_status_changed, user_online, user_offline)
    const handlePresenceChange = (data) => {
      if (!data || !data.userId) return;
      const { userId, isOnline, lastSeen } = data;
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(userId.toString(), { isOnline: Boolean(isOnline), lastSeen: lastSeen || new Date() });
        return next;
      });
    };

    newSocket.on('user_status_change', handlePresenceChange);
    newSocket.on('user_presence_changed', handlePresenceChange);
    newSocket.on('user_status_changed', handlePresenceChange);
    newSocket.on('user_online', (data) => handlePresenceChange({ ...data, isOnline: true }));
    newSocket.on('user_offline', (data) => handlePresenceChange({ ...data, isOnline: false }));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, isAuthenticated]);

  /**
   * Join dynamic room
   */
  const joinRoom = useCallback(
    (roomId, callback) => {
      if (!roomId) return;
      activeRoomsRef.current.add(roomId);
      if (socket) {
        socket.emit('join_room', { roomId }, (res) => {
          if (typeof callback === 'function') callback(res);
        });
      }
    },
    [socket]
  );

  /**
   * Leave room
   */
  const leaveRoom = useCallback(
    (roomId, callback) => {
      if (!roomId) return;
      activeRoomsRef.current.delete(roomId);
      if (socket) {
        socket.emit('leave_room', { roomId }, (res) => {
          if (typeof callback === 'function') callback(res);
        });
      }
    },
    [socket]
  );

  /**
   * Dispatch chat message
   */
  const sendMessage = useCallback(
    (payload, callback) => {
      if (!socket) {
        if (typeof callback === 'function') callback({ success: false, message: 'Socket disconnected' });
        return;
      }
      const data = typeof payload === 'object' && payload !== null ? payload : { content: payload };
      socket.emit('send_message', data, (res) => {
        if (typeof callback === 'function') callback(res);
      });
    },
    [socket]
  );

  /**
   * Dispatch typing indicator
   */
  const sendTyping = useCallback(
    (roomId, isTyping) => {
      if (!socket || !roomId) return;
      const eventName = isTyping ? 'typing_start' : 'typing_stop';
      socket.emit(eventName, { roomId });
    },
    [socket]
  );

  /**
   * Mark message as delivered (Double gray check)
   */
  const markDelivered = useCallback(
    (messageId, roomId, callback) => {
      if (!socket || !messageId) return;
      socket.emit('mark_delivered', { messageId, roomId }, (res) => {
        if (typeof callback === 'function') callback(res);
      });
    },
    [socket]
  );

  /**
   * Mark message as read (Double blue check)
   */
  const markAsRead = useCallback(
    (messageId, roomId, callback) => {
      if (!socket || !messageId) return;
      socket.emit('mark_as_read', { messageId, roomId }, (res) => {
        if (typeof callback === 'function') callback(res);
      });
    },
    [socket]
  );

  /**
   * Toggle or add message reaction
   */
  const reactToMessage = useCallback(
    (messageId, emoji, roomId, callback) => {
      if (!socket || !messageId || !emoji) return;
      socket.emit('react_to_message', { messageId, emoji, roomId }, (res) => {
        if (typeof callback === 'function') callback(res);
      });
    },
    [socket]
  );

  /**
   * Helper to check if a user is online
   */
  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      const userPresence = onlineUsers.get(userId.toString());
      return userPresence ? Boolean(userPresence.isOnline) : false;
    },
    [onlineUsers]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        onlineUsers,
        isUserOnline,
        joinRoom,
        leaveRoom,
        sendMessage,
        sendTyping,
        markDelivered,
        markAsRead,
        reactToMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
