const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_syncspace_2026';

const { generateToken, verifyToken } = require('../utils/jwt');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');

const { register, login, getMe } = require('../controllers/authController');
const { createWorkspace, getUserWorkspaces } = require('../controllers/workspaceController');
const { createChannel, getWorkspaceChannels } = require('../controllers/channelController');
const { logCall, getCallHistory } = require('../controllers/callController');
const { app } = require('../server');

// Mock response creator
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(err);
    throw err;
  }
}

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

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   SyncSpace Step 2: Auth & Core REST API Test Suite   ');
  console.log('======================================================\n');

  // ==========================================
  // 1. JWT Utilities
  // ==========================================
  console.log('1. Testing JWT Utilities:');
  const testUserId = new mongoose.Types.ObjectId();

  it('generates a valid signed JWT token', () => {
    const token = generateToken(testUserId);
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.split('.').length, 3);
  });

  it('correctly verifies token and decodes user id', () => {
    const token = generateToken(testUserId);
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, testUserId.toString());
  });

  it('throws error when verifying tampered or invalid token', () => {
    assert.throws(() => {
      verifyToken('invalid.token.string');
    });
  });

  // ==========================================
  // 2. Auth Middleware
  // ==========================================
  console.log('\n2. Testing Auth Middleware (protect):');

  await itAsync('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(nextCalled, false);
  });

  await itAsync('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic 12345' } };
    const res = createMockRes();
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(nextCalled, false);
  });

  await itAsync('returns 401 when Bearer token is invalid/tampered', async () => {
    const req = { headers: { authorization: 'Bearer malformed.token.here' } };
    const res = createMockRes();
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(nextCalled, false);
  });

  await itAsync('authenticates valid token and attaches user to req.user', async () => {
    const token = generateToken(testUserId);
    const originalFindById = User.findById;

    // Mock User.findById
    User.findById = (id) => ({
      select: (fields) => {
        assert.strictEqual(id.toString(), testUserId.toString());
        return Promise.resolve({
          _id: testUserId,
          name: 'Alex Tester',
          email: 'alex@syncspace.io',
        });
      },
    });

    try {
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;
      await protect(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.name, 'Alex Tester');
      assert.strictEqual(req.user.email, 'alex@syncspace.io');
    } finally {
      User.findById = originalFindById;
    }
  });

  // ==========================================
  // 3. Auth Controller
  // ==========================================
  console.log('\n3. Testing Auth Controller:');

  await itAsync('register rejects missing required fields with 400', async () => {
    const req = { body: { name: 'Alex' } };
    const res = createMockRes();
    await register(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
  });

  await itAsync('register rejects invalid email format with 400', async () => {
    const req = { body: { name: 'Alex', email: 'invalid-email', password: 'password123' } };
    const res = createMockRes();
    await register(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 400);
  });

  await itAsync('register rejects password shorter than 6 characters with 400', async () => {
    const req = { body: { name: 'Alex', email: 'alex@syncspace.io', password: '123' } };
    const res = createMockRes();
    await register(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 400);
  });

  await itAsync('register detects duplicate email and returns 400', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve({ _id: 'existing_id', email: 'alex@syncspace.io' });

    try {
      const req = { body: { name: 'Alex', email: 'alex@syncspace.io', password: 'password123' } };
      const res = createMockRes();
      await register(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 400);
      assert(res.data.message.includes('already exists'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  await itAsync('register successfully creates user and returns JWT + user data', async () => {
    const originalFindOne = User.findOne;
    const originalCreate = User.create;

    User.findOne = () => Promise.resolve(null);
    User.create = (doc) => Promise.resolve({
      _id: testUserId,
      name: doc.name,
      email: doc.email,
      avatar: doc.avatar,
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(),
    });

    try {
      const req = { body: { name: 'Alex New', email: 'new@syncspace.io', password: 'secretPassword123' } };
      const res = createMockRes();
      await register(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.email, 'new@syncspace.io');
      assert(res.data.token);
    } finally {
      User.findOne = originalFindOne;
      User.create = originalCreate;
    }
  });

  await itAsync('login rejects missing credentials with 400', async () => {
    const req = { body: { email: 'alex@syncspace.io' } };
    const res = createMockRes();
    await login(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 400);
  });

  await itAsync('login returns 401 when user is not found', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => ({ select: () => Promise.resolve(null) });

    try {
      const req = { body: { email: 'notfound@syncspace.io', password: 'password123' } };
      const res = createMockRes();
      await login(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.data.success, false);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  await itAsync('login returns 401 when password mismatch occurs', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve({
        _id: testUserId,
        email: 'alex@syncspace.io',
        comparePassword: () => Promise.resolve(false),
      }),
    });

    try {
      const req = { body: { email: 'alex@syncspace.io', password: 'wrongPassword' } };
      const res = createMockRes();
      await login(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 401);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  await itAsync('login returns 200 with JWT and user on valid credentials', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve({
        _id: testUserId,
        name: 'Alex',
        email: 'alex@syncspace.io',
        avatar: '',
        isOnline: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        comparePassword: () => Promise.resolve(true),
        save: () => Promise.resolve(true),
      }),
    });

    try {
      const req = { body: { email: 'alex@syncspace.io', password: 'correctPassword' } };
      const res = createMockRes();
      await login(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.success, true);
      assert(res.data.token);
      assert.strictEqual(res.data.user.email, 'alex@syncspace.io');
    } finally {
      User.findOne = originalFindOne;
    }
  });

  await itAsync('getMe returns current user profile from req.user', async () => {
    const req = { user: { _id: testUserId, name: 'Alex Profile', email: 'alex@syncspace.io' } };
    const res = createMockRes();
    await getMe(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.name, 'Alex Profile');
  });

  // ==========================================
  // 4. Workspace Controller
  // ==========================================
  console.log('\n4. Testing Workspace Controller:');

  await itAsync('createWorkspace rejects empty workspace name with 400', async () => {
    const req = { body: { name: '' }, user: { _id: testUserId } };
    const res = createMockRes();
    await createWorkspace(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 400);
  });

  await itAsync('createWorkspace rejects duplicate workspace slug with 400', async () => {
    const originalFindOne = Workspace.findOne;
    Workspace.findOne = () => Promise.resolve({ _id: 'ws_1', slug: 'acme-corp' });

    try {
      const req = { body: { name: 'Acme Corp', slug: 'acme-corp' }, user: { _id: testUserId } };
      const res = createMockRes();
      await createWorkspace(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 400);
    } finally {
      Workspace.findOne = originalFindOne;
    }
  });

  await itAsync('createWorkspace assigns creator as admin and creates default channel', async () => {
    const originalFindOne = Workspace.findOne;
    const originalCreateWorkspace = Workspace.create;
    const originalCreateChannel = Channel.create;

    const dummyWsId = new mongoose.Types.ObjectId();
    let createdWorkspaceDoc = null;
    let createdChannelDoc = null;

    Workspace.findOne = () => Promise.resolve(null);
    Workspace.create = (doc) => {
      createdWorkspaceDoc = { _id: dummyWsId, ...doc };
      return Promise.resolve(createdWorkspaceDoc);
    };
    Channel.create = (doc) => {
      createdChannelDoc = { _id: new mongoose.Types.ObjectId(), ...doc };
      return Promise.resolve(createdChannelDoc);
    };

    try {
      const req = { body: { name: 'Engineering Workspace' }, user: { _id: testUserId } };
      const res = createMockRes();
      await createWorkspace(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(createdWorkspaceDoc.slug, 'engineering-workspace');
      assert.strictEqual(createdWorkspaceDoc.owner.toString(), testUserId.toString());
      assert.strictEqual(createdWorkspaceDoc.members[0].role, 'admin');
      assert.strictEqual(createdChannelDoc.name, 'general');
      assert.strictEqual(createdChannelDoc.type, 'public');
    } finally {
      Workspace.findOne = originalFindOne;
      Workspace.create = originalCreateWorkspace;
      Channel.create = originalCreateChannel;
    }
  });

  await itAsync('getUserWorkspaces queries workspaces filtering by member.user', async () => {
    const originalFind = Workspace.find;
    let queryUsed = null;

    Workspace.find = (query) => {
      queryUsed = query;
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([
              { _id: 'ws_1', name: 'Dev Space', members: [{ user: testUserId, role: 'admin' }] },
            ]),
          }),
        }),
      };
    };

    try {
      const req = { user: { _id: testUserId } };
      const res = createMockRes();
      await getUserWorkspaces(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.count, 1);
      assert.strictEqual(queryUsed['members.user'].toString(), testUserId.toString());
    } finally {
      Workspace.find = originalFind;
    }
  });

  // ==========================================
  // 5. Channel Controller
  // ==========================================
  console.log('\n5. Testing Channel Controller:');
  const dummyWorkspaceId = new mongoose.Types.ObjectId();

  await itAsync('createChannel rejects when user is not a member of the workspace (403)', async () => {
    const originalFindWs = Workspace.findById;
    const otherUserId = new mongoose.Types.ObjectId();

    Workspace.findById = () => Promise.resolve({
      _id: dummyWorkspaceId,
      name: 'Engineering',
      members: [{ user: otherUserId, role: 'member' }],
    });

    try {
      const req = {
        body: { workspaceId: dummyWorkspaceId, name: 'announcements' },
        user: { _id: testUserId },
      };
      const res = createMockRes();
      await createChannel(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 403);
      assert(res.data.message.includes('not a member'));
    } finally {
      Workspace.findById = originalFindWs;
    }
  });

  await itAsync('createChannel creates public or private channel under workspaceId', async () => {
    const originalFindWs = Workspace.findById;
    const originalFindChannel = Channel.findOne;
    const originalCreateChannel = Channel.create;

    Workspace.findById = () => Promise.resolve({
      _id: dummyWorkspaceId,
      members: [{ user: testUserId, role: 'member' }],
    });
    Channel.findOne = () => Promise.resolve(null);

    let createdDoc = null;
    Channel.create = (doc) => {
      createdDoc = { _id: new mongoose.Types.ObjectId(), ...doc };
      return Promise.resolve(createdDoc);
    };

    try {
      const req = {
        body: { workspaceId: dummyWorkspaceId, name: 'frontend-team', type: 'private' },
        user: { _id: testUserId },
      };
      const res = createMockRes();
      await createChannel(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(createdDoc.name, 'frontend-team');
      assert.strictEqual(createdDoc.type, 'private');
      assert(createdDoc.members.includes(testUserId.toString()));
    } finally {
      Workspace.findById = originalFindWs;
      Channel.findOne = originalFindChannel;
      Channel.create = originalCreateChannel;
    }
  });

  await itAsync('getWorkspaceChannels returns public channels and accessible private channels', async () => {
    const originalFindWs = Workspace.findById;
    const originalFindChannel = Channel.find;
    let channelQueryUsed = null;

    Workspace.findById = () => Promise.resolve({
      _id: dummyWorkspaceId,
      members: [{ user: testUserId, role: 'member' }],
    });

    Channel.find = (query) => {
      channelQueryUsed = query;
      return {
        populate: () => ({
          sort: () => Promise.resolve([
            { _id: 'ch_1', name: 'general', type: 'public' },
            { _id: 'ch_2', name: 'leads', type: 'private', members: [testUserId] },
          ]),
        }),
      };
    };

    try {
      const req = {
        params: { workspaceId: dummyWorkspaceId },
        user: { _id: testUserId },
      };
      const res = createMockRes();
      await getWorkspaceChannels(req, res, (err) => { throw err; });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.count, 2);
      assert.strictEqual(channelQueryUsed.workspaceId, dummyWorkspaceId);
      // Check $or clause contains public and user's private membership
      assert.deepStrictEqual(channelQueryUsed.$or, [
        { type: 'public' },
        { type: 'private', members: testUserId },
      ]);
    } finally {
      Workspace.findById = originalFindWs;
      Channel.find = originalFindChannel;
    }
  });

  // ==========================================
  // 6. Route Registry & Server Mounting
  // ==========================================
  console.log('\n6. Testing Route Mounting & HTTP Dispatches:');

  const authRoutes = require('../routes/authRoutes');
  const workspaceRoutes = require('../routes/workspaceRoutes');
  const channelRoutes = require('../routes/channelRoutes');

  it('verifies auth router has /register, /login, /me endpoints', () => {
    const authEndpoints = authRoutes.stack.filter(l => l.route).map(l => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
    console.log('    Auth endpoints:', authEndpoints);
    assert(authEndpoints.some(e => e.includes('POST /register')));
    assert(authEndpoints.some(e => e.includes('POST /login')));
    assert(authEndpoints.some(e => e.includes('GET /me')));
  });

  it('verifies workspace router has / endpoints and protect middleware', () => {
    const hasProtect = workspaceRoutes.stack.some(l => l.name === 'protect');
    const wsEndpoints = workspaceRoutes.stack.filter(l => l.route).map(l => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
    console.log('    Workspace endpoints:', wsEndpoints, '| Protected:', hasProtect);
    assert(hasProtect, 'Workspace routes must be protected');
    assert(wsEndpoints.some(e => e.includes('POST') && e.includes('/')));
    assert(wsEndpoints.some(e => e.includes('GET') && e.includes('/')));
  });

  it('verifies channel router has / and /:workspaceId endpoints and protect middleware', () => {
    const hasProtect = channelRoutes.stack.some(l => l.name === 'protect');
    const chEndpoints = channelRoutes.stack.filter(l => l.route).map(l => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
    console.log('    Channel endpoints:', chEndpoints, '| Protected:', hasProtect);
    assert(hasProtect, 'Channel routes must be protected');
    assert(chEndpoints.some(e => e.includes('POST /')));
    assert(chEndpoints.some(e => e.includes('GET /:workspaceId')));
  });

  await itAsync('verifies live HTTP requests to mounted Express endpoints (/health, /api/auth, /api/workspaces, /api/channels)', async () => {
    const http = require('http');
    const testServer = http.createServer(app);

    await new Promise((resolve) => testServer.listen(0, resolve));
    const port = testServer.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // 1. Health endpoint
      const healthRes = await fetch(`${baseUrl}/health`);
      assert.strictEqual(healthRes.status, 200);
      const healthJson = await healthRes.json();
      assert.strictEqual(healthJson.status, 'ok');

      // 2. Auth register endpoint (validation check)
      const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(registerRes.status, 400);

      // 3. Auth login endpoint (validation check)
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(loginRes.status, 400);

      // 4. Protected Workspace endpoint without token
      const wsRes = await fetch(`${baseUrl}/api/workspaces`);
      assert.strictEqual(wsRes.status, 401);

      // 5. Protected Channel endpoint without token
      const chRes = await fetch(`${baseUrl}/api/channels/some-workspace-id`);
      assert.strictEqual(chRes.status, 401);

      // 6. Protected Calls endpoint without token
      const callRes = await fetch(`${baseUrl}/api/calls/history`);
      assert.strictEqual(callRes.status, 401);

      console.log('    All HTTP live route checks completed successfully (200, 400, 401)');
    } finally {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  console.log('\n7. Testing Call Controller:');
  await itAsync('logs call and retrieves call history for user in workspace', async () => {
    const CallLog = require('../models/CallLog');
    const mockUser = { _id: new mongoose.Types.ObjectId(), name: 'Call Test User' };
    const mockRecipient = new mongoose.Types.ObjectId();
    const mockWsId = new mongoose.Types.ObjectId();
    const mockCallId = new mongoose.Types.ObjectId();

    const sampleCall = {
      _id: mockCallId,
      workspace: mockWsId,
      caller: mockUser,
      recipients: [mockRecipient],
      type: 'video',
      status: 'completed',
      duration: 120,
      startedAt: new Date(),
    };

    const origCreate = CallLog.create;
    const origFindById = CallLog.findById;
    const origFind = CallLog.find;
    const origCount = CallLog.countDocuments;

    CallLog.create = async () => sampleCall;
    CallLog.findById = () => ({
      populate: () => ({
        populate: () => ({
          populate: async () => sampleCall,
        }),
      }),
    });
    CallLog.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => ({
                populate: async () => [sampleCall],
              }),
            }),
          }),
        }),
      }),
    });
    CallLog.countDocuments = async () => 1;

    try {
      const logReq = {
        user: mockUser,
        body: {
          workspaceId: mockWsId,
          recipients: [mockRecipient],
          type: 'video',
          status: 'completed',
          duration: 120,
        },
        headers: {},
      };
      const logRes = createMockRes();
      await logCall(logReq, logRes, () => {});
      assert.strictEqual(logRes.statusCode, 201);
      assert.strictEqual(logRes.data.success, true);
      assert.strictEqual(logRes.data.callLog.type, 'video');

      const histReq = {
        user: mockUser,
        query: { workspaceId: mockWsId.toString() },
        headers: {},
      };
      const histRes = createMockRes();
      await getCallHistory(histReq, histRes, () => {});
      assert.strictEqual(histRes.statusCode, 200);
      assert.strictEqual(histRes.data.success, true);
      assert.strictEqual(histRes.data.calls.length, 1);
    } finally {
      CallLog.create = origCreate;
      CallLog.findById = origFindById;
      CallLog.find = origFind;
      CallLog.countDocuments = origCount;
    }
  });

  console.log('\n======================================================');
  console.log(` ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest Suite Failed with error:\n', err);
  process.exit(1);
});
