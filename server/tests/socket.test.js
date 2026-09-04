const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'socket_test_secret_key_syncspace_2026';

const { generateToken } = require('../utils/jwt');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const { app, server } = require('../server');

// In-memory mock database store for testing
const mockDb = {
  users: new Map(),
  messages: new Map(),
  channels: new Map(),
  workspaces: new Map(),
};

// Setup Mongoose Mocks
function setupMocks() {
  User.findById = (id) => {
    const idStr = id ? id.toString() : '';
    const user = mockDb.users.get(idStr);
    return {
      select: () => Promise.resolve(user ? { ...user } : null),
    };
  };

  User.findByIdAndUpdate = (id, update) => {
    const idStr = id ? id.toString() : '';
    const user = mockDb.users.get(idStr);
    if (user) {
      if (update.isOnline !== undefined) user.isOnline = update.isOnline;
      if (update.lastSeen) user.lastSeen = update.lastSeen;
    }
    return Promise.resolve(user ? { ...user } : null);
  };

  Message.create = (doc) => {
    const msgId = new mongoose.Types.ObjectId();
    const newMsg = {
      _id: msgId,
      channelId: doc.channelId || null,
      conversationId: doc.conversationId || null,
      sender: doc.sender,
      content: doc.content,
      readBy: doc.readBy || [doc.sender],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.messages.set(msgId.toString(), newMsg);
    return Promise.resolve(newMsg);
  };

  Message.findById = (id) => {
    const idStr = id ? id.toString() : '';
    const msg = mockDb.messages.get(idStr);
    const sender = msg ? mockDb.users.get(msg.sender.toString()) : null;

    const queryObj = {
      populate: () => queryObj,
      then: (resolve, reject) => {
        const result = msg
          ? {
              ...msg,
              sender: sender || { _id: msg.sender, name: 'User', avatar: '' },
              readBy: (msg.readBy || []).map((rId) => mockDb.users.get(rId.toString()) || { _id: rId }),
              deliveredTo: (msg.deliveredTo || []).map((dId) => mockDb.users.get(dId.toString()) || { _id: dId }),
            }
          : null;
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return queryObj;
  };

  Message.findByIdAndUpdate = (id, update) => {
    const idStr = id ? id.toString() : '';
    const msg = mockDb.messages.get(idStr);
    if (msg && update.$addToSet) {
      if (update.$addToSet.readBy) {
        msg.readBy = msg.readBy || [];
        const exists = msg.readBy.some((r) => r.toString() === update.$addToSet.readBy.toString());
        if (!exists) {
          msg.readBy.push(update.$addToSet.readBy);
        }
      }
      if (update.$addToSet.deliveredTo) {
        msg.deliveredTo = msg.deliveredTo || [];
        const existsDelivered = msg.deliveredTo.some((d) => d.toString() === update.$addToSet.deliveredTo.toString());
        if (!existsDelivered) {
          msg.deliveredTo.push(update.$addToSet.deliveredTo);
        }
      }
    }
    return Promise.resolve(msg ? { ...msg } : null);
  };

  Message.find = (query) => {
    let result = Array.from(mockDb.messages.values());
    if (query.channelId) {
      result = result.filter(
        (m) => m.channelId && m.channelId.toString() === query.channelId.toString()
      );
    }
    if (query.conversationId) {
      result = result.filter((m) => m.conversationId === query.conversationId);
    }
    if (query.createdAt && query.createdAt.$lt) {
      result = result.filter((m) => m.createdAt < query.createdAt.$lt);
    }

    return {
      sort: () => ({
        limit: (limitNum) => {
          const populateQuery = {
            populate: () => populateQuery,
            then: (resolve, reject) => {
              const populated = result.slice(0, limitNum).map((m) => {
                const sender = mockDb.users.get(m.sender.toString());
                return {
                  ...m,
                  sender: sender || { _id: m.sender, name: 'User', avatar: '' },
                  readBy: (m.readBy || []).map((rId) => mockDb.users.get(rId.toString()) || { _id: rId }),
                  deliveredTo: (m.deliveredTo || []).map((dId) => mockDb.users.get(dId.toString()) || { _id: dId }),
                };
              });
              return Promise.resolve(populated).then(resolve, reject);
            },
          };
          return populateQuery;
        },
      }),
    };
  };

  Channel.findById = (id) => {
    const idStr = id ? id.toString() : '';
    const channel = mockDb.channels.get(idStr);
    return Promise.resolve(channel ? { ...channel } : null);
  };

  Workspace.findById = (id) => {
    const idStr = id ? id.toString() : '';
    const workspace = mockDb.workspaces.get(idStr);
    return Promise.resolve(workspace ? { ...workspace } : null);
  };
}

let passedTests = 0;
let totalTests = 0;

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(err);
    throw err;
  }
}

async function runSocketTests() {
  console.log('\n======================================================');
  console.log('   SyncSpace Step 3: Socket.io Real-Time Engine Tests  ');
  console.log('======================================================\n');

  setupMocks();

  // Create Users in mock DB
  const userA = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Alice Architect',
    email: 'alice@syncspace.io',
    avatar: 'https://avatar.iran.liara.run/public/1',
    isOnline: false,
    lastSeen: new Date(),
  };

  const userB = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Bob Builder',
    email: 'bob@syncspace.io',
    avatar: 'https://avatar.iran.liara.run/public/2',
    isOnline: false,
    lastSeen: new Date(),
  };

  const userC = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Charlie Critic',
    email: 'charlie@syncspace.io',
    avatar: 'https://avatar.iran.liara.run/public/3',
    isOnline: false,
    lastSeen: new Date(),
  };

  mockDb.users.set(userA._id.toString(), userA);
  mockDb.users.set(userB._id.toString(), userB);
  mockDb.users.set(userC._id.toString(), userC);

  const tokenA = generateToken(userA._id);
  const tokenB = generateToken(userB._id);
  const tokenC = generateToken(userC._id);

  // Setup Workspace & Channel
  const workspaceId = new mongoose.Types.ObjectId();
  const channelId = new mongoose.Types.ObjectId();
  const otherChannelId = new mongoose.Types.ObjectId();

  mockDb.workspaces.set(workspaceId.toString(), {
    _id: workspaceId,
    name: 'Engineering Workspace',
    members: [
      { user: userA._id, role: 'admin' },
      { user: userB._id, role: 'member' },
      { user: userC._id, role: 'member' },
    ],
  });

  mockDb.channels.set(channelId.toString(), {
    _id: channelId,
    workspaceId,
    name: 'general',
    type: 'public',
    members: [userA._id, userB._id],
  });

  mockDb.channels.set(otherChannelId.toString(), {
    _id: otherChannelId,
    workspaceId,
    name: 'random',
    type: 'public',
    members: [userC._id],
  });

  // Start HTTP Server on ephemeral port
  let serverPort;
  let serverUrl;

  await new Promise((resolve) => {
    server.listen(0, () => {
      serverPort = server.address().port;
      serverUrl = `http://localhost:${serverPort}`;
      resolve();
    });
  });

  console.log(`[Test Server] Running on ${serverUrl}\n`);

  try {
    // ----------------------------------------------------
    // Test 1: Authentication Middleware Rejection
    // ----------------------------------------------------
    console.log('1. Testing Socket.io Authentication Middleware:');

    await itAsync('rejects connection when no token is provided', async () => {
      let rejected = false;
      let errorMsg = '';

      await new Promise((resolve) => {
        const client = ioClient(serverUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        client.on('connect_error', (err) => {
          rejected = true;
          errorMsg = err.message;
          client.close();
          resolve();
        });

        client.on('connect', () => {
          client.close();
          resolve();
        });
      });

      assert.strictEqual(rejected, true);
      assert(errorMsg.includes('No token provided'));
    });

    await itAsync('rejects connection with invalid/malformed token', async () => {
      let rejected = false;
      let errorMsg = '';

      await new Promise((resolve) => {
        const client = ioClient(serverUrl, {
          auth: { token: 'invalid.jwt.token' },
          transports: ['websocket'],
          reconnection: false,
        });

        client.on('connect_error', (err) => {
          rejected = true;
          errorMsg = err.message;
          client.close();
          resolve();
        });

        client.on('connect', () => {
          client.close();
          resolve();
        });
      });

      assert.strictEqual(rejected, true);
      assert(errorMsg.includes('Invalid or expired token'));
    });

    // ----------------------------------------------------
    // Test 2: Connection, Presence & Room Management
    // ----------------------------------------------------
    console.log('\n2. Testing Connection, Presence & Room Management:');

    let clientA;
    let clientB;
    let clientC;

    await itAsync('connects user A and receives presence broadcast on user B', async () => {
      // Connect User B first
      clientB = ioClient(serverUrl, {
        auth: { token: tokenB },
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => clientB.on('connect', resolve));

      // Listen for presence change when User A connects
      let userStatusChangeFired = false;
      clientB.on('user_status_change', (data) => {
        if (data.userId === userA._id.toString() && data.isOnline === true) {
          userStatusChangeFired = true;
        }
      });

      const presencePromise = new Promise((resolve) => {
        clientB.on('user_presence_changed', (data) => {
          if (data.userId === userA._id.toString() && data.isOnline === true) {
            resolve(data);
          }
        });
      });

      // Connect User A and capture initial_online_users
      let initialUsersList = [];
      clientA = ioClient(serverUrl, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false,
      });

      clientA.on('initial_online_users', (list) => {
        initialUsersList = list;
      });

      await new Promise((resolve) => clientA.on('connect', resolve));
      const presenceData = await presencePromise;

      assert.strictEqual(presenceData.userId, userA._id.toString());
      assert.strictEqual(presenceData.isOnline, true);
      assert.strictEqual(userStatusChangeFired, true);
      assert(Array.isArray(initialUsersList));
      assert(initialUsersList.includes(userB._id.toString()));
      assert(initialUsersList.includes(userA._id.toString()));
    });

    await itAsync('joins clients to room with ack callback', async () => {
      const room = `channel_${channelId.toString()}`;

      const joinResA = await new Promise((resolve) => {
        clientA.emit('join_room', { channelId: channelId.toString() }, resolve);
      });
      assert.strictEqual(joinResA.success, true);
      assert.strictEqual(joinResA.roomId, room);

      const joinResB = await new Promise((resolve) => {
        clientB.emit('join_room', { channelId: channelId.toString() }, resolve);
      });
      assert.strictEqual(joinResB.success, true);
    });

    // ----------------------------------------------------
    // Test 3: Real-Time Messaging & Room Isolation
    // ----------------------------------------------------
    console.log('\n3. Testing Real-Time Messaging & Room Isolation:');

    await itAsync('dispatches message to room members and excludes other rooms', async () => {
      // Connect client C and join a different room
      clientC = ioClient(serverUrl, {
        auth: { token: tokenC },
        transports: ['websocket'],
        reconnection: false,
      });
      await new Promise((resolve) => clientC.on('connect', resolve));
      await new Promise((resolve) => {
        clientC.emit('join_room', { channelId: otherChannelId.toString() }, resolve);
      });

      let clientCReceived = false;
      clientC.on('new_message', () => {
        clientCReceived = true;
      });

      const messagePromiseB = new Promise((resolve) => {
        clientB.on('new_message', resolve);
      });

      // Client A sends message in channelId
      const sendRes = await new Promise((resolve) => {
        clientA.emit(
          'send_message',
          {
            channelId: channelId.toString(),
            content: 'Hello channel team!',
          },
          resolve
        );
      });

      assert.strictEqual(sendRes.success, true);
      assert.strictEqual(sendRes.message.content, 'Hello channel team!');

      const receivedMsgB = await messagePromiseB;
      assert.strictEqual(receivedMsgB.content, 'Hello channel team!');
      assert.strictEqual(receivedMsgB.sender.name, userA.name);

      // Give event loop time to verify Client C does NOT receive message
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.strictEqual(clientCReceived, false, 'Client C in another room should NOT receive message');
    });

    // ----------------------------------------------------
    // Test 4: Typing Indicators
    // ----------------------------------------------------
    console.log('\n4. Testing Typing Indicators:');

    await itAsync('broadcasts typing_start and typing_stop to other room participants', async () => {
      const room = `channel_${channelId.toString()}`;

      const typingStartPromise = new Promise((resolve) => {
        clientB.on('user_typing', (data) => {
          if (data.isTyping === true) resolve(data);
        });
      });

      clientA.emit('typing_start', { roomId: room });
      const typingStartData = await typingStartPromise;
      assert.strictEqual(typingStartData.userId, userA._id.toString());
      assert.strictEqual(typingStartData.isTyping, true);

      const typingStopPromise = new Promise((resolve) => {
        clientB.on('user_typing', (data) => {
          if (data.isTyping === false) resolve(data);
        });
      });

      clientA.emit('typing_stop', { roomId: room });
      const typingStopData = await typingStopPromise;
      assert.strictEqual(typingStopData.userId, userA._id.toString());
      assert.strictEqual(typingStopData.isTyping, false);
    });

    // ----------------------------------------------------
    // Test 5: Read Receipts
    // ----------------------------------------------------
    console.log('\n5. Testing Read Receipts:');

    await itAsync('marks message as read and broadcasts update', async () => {
      const room = `channel_${channelId.toString()}`;
      const firstMessage = Array.from(mockDb.messages.values())[0];
      assert(firstMessage, 'First message should exist');

      const readUpdatePromise = new Promise((resolve) => {
        clientA.on('message_read_update', resolve);
      });

      const markRes = await new Promise((resolve) => {
        clientB.emit('mark_as_read', { messageId: firstMessage._id.toString(), roomId: room }, resolve);
      });

      assert.strictEqual(markRes.success, true);
      const readUpdateData = await readUpdatePromise;
      assert.strictEqual(readUpdateData.messageId.toString(), firstMessage._id.toString());
      assert.strictEqual(readUpdateData.userId, userB._id.toString());
    });

    // ----------------------------------------------------
    // Test 6: Disconnection & Presence Update
    // ----------------------------------------------------
    console.log('\n6. Testing Presence on Disconnect:');

    await itAsync('broadcasts user_status_change with isOnline: false when user A disconnects', async () => {
      let statusChangeReceived = false;
      clientB.on('user_status_change', (data) => {
        if (data.userId === userA._id.toString() && data.isOnline === false) {
          statusChangeReceived = true;
        }
      });

      const presencePromise = new Promise((resolve) => {
        clientB.on('user_presence_changed', (data) => {
          if (data.userId === userA._id.toString() && data.isOnline === false) {
            resolve(data);
          }
        });
      });

      clientA.close();
      const offlineData = await presencePromise;
      assert.strictEqual(offlineData.userId, userA._id.toString());
      assert.strictEqual(offlineData.isOnline, false);
      assert.strictEqual(statusChangeReceived, true);
      assert(offlineData.lastSeen);
    });

    await itAsync('handles multiple sockets per user correctly on disconnect', async () => {
      // Connect Tab 1 for User A
      const tab1 = ioClient(serverUrl, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false,
      });
      await new Promise((resolve) => tab1.on('connect', resolve));

      // Connect Tab 2 for User A
      const tab2 = ioClient(serverUrl, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false,
      });
      await new Promise((resolve) => tab2.on('connect', resolve));

      let disconnectBroadcastReceived = false;
      const offlineHandler = (data) => {
        if (data.userId === userA._id.toString() && data.isOnline === false) {
          disconnectBroadcastReceived = true;
        }
      };
      clientB.on('user_status_change', offlineHandler);

      // Close Tab 1 - User A still has Tab 2 active
      tab1.close();
      await new Promise((r) => setTimeout(r, 100));

      // Should NOT have broadcast offline
      assert.strictEqual(disconnectBroadcastReceived, false);

      // Close Tab 2 - No remaining active sockets
      const lastTabOfflinePromise = new Promise((resolve) => {
        clientB.on('user_status_change', (data) => {
          if (data.userId === userA._id.toString() && data.isOnline === false) {
            resolve(data);
          }
        });
      });

      tab2.close();
      const finalOfflineData = await lastTabOfflinePromise;
      assert.strictEqual(finalOfflineData.userId, userA._id.toString());
      assert.strictEqual(finalOfflineData.isOnline, false);
      clientB.off('user_status_change', offlineHandler);
    });

    // Clean up remaining clients
    clientB.close();
    clientC.close();

    // ----------------------------------------------------
    // Test 7: REST Message History Endpoints
    // ----------------------------------------------------
    console.log('\n7. Testing Message REST History Endpoints:');

    await itAsync('fetches channel message history with cursor pagination (/api/messages/channel/:channelId)', async () => {
      const res = await fetch(`${serverUrl}/api/messages/channel/${channelId.toString()}`, {
        headers: {
          Authorization: `Bearer ${tokenB}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert(Array.isArray(data.messages));
      assert.strictEqual(data.count >= 1, true);
      assert.strictEqual(data.messages[0].content, 'Hello channel team!');
      assert.strictEqual(data.messages[0].sender.name, userA.name);
    });

    await itAsync('fetches direct message history (/api/messages/dm/:conversationId)', async () => {
      // Add a DM message to mockDb
      const dmMsg = {
        _id: new mongoose.Types.ObjectId(),
        conversationId: 'test_dm_123_456',
        sender: userA._id,
        content: 'Hey Bob, private DM!',
        readBy: [userA._id],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.messages.set(dmMsg._id.toString(), dmMsg);
      if (mongoose.connection.readyState === 1) {
        await Message.create(dmMsg);
      }

      const res = await fetch(`${serverUrl}/api/messages/dm/dm_test_dm_123_456`, {
        headers: {
          Authorization: `Bearer ${tokenB}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.count >= 1);
      assert.ok(data.messages.some((m) => m.content === 'Hey Bob, private DM!'));
    });

    console.log('\n======================================================');
    console.log(` ALL ${passedTests}/${totalTests} SOCKET TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runSocketTests().catch((err) => {
  console.error('\nSocket Test Suite Failed:\n', err);
  process.exit(1);
});
