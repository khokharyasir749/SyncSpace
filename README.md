# SyncSpace - Real-Time Collaborative Workspace

SyncSpace is a production-grade, full-stack real-time collaborative workspace web application inspired by Slack and Discord. It features real-time messaging, multi-tab active presence tracking, channel and direct message routing, typing indicators, read receipts, and a modern dark slate UI.

---

## Architecture Overview

```
sync-space/
├── client/                     # React 18 + Vite Frontend SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/           # MessageFeed & MessageInput
│   │   │   ├── modals/         # CreateWorkspaceModal & CreateChannelModal
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx # JWT persistence & user session hydration
│   │   │   └── SocketContext.jsx # Socket.io connection & room coordination
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # 3-column Slack/Discord workspace UI
│   │   │   ├── Login.jsx       # Dark glassmorphism sign-in screen
│   │   │   └── Register.jsx    # Sign-up screen with avatar generator preview
│   │   └── services/
│   │       └── api.js          # Axios client with auth interceptors
│   └── package.json
│
└── server/                     # Node.js + Express + Socket.io Backend
    ├── config/
    │   └── db.js               # Resilient Mongoose connection with retry logic
    ├── controllers/
    │   ├── authController.js   # Register, Login, GetMe
    │   ├── workspaceController.js # Workspace creation & member filtering
    │   ├── channelController.js   # Public & private channel management
    │   └── messageController.js   # Paginated chat & DM history
    ├── middleware/
    │   ├── auth.js             # JWT Bearer token verification
    │   └── errorHandler.js     # Centralized error handler
    ├── models/
    │   ├── User.js             # User accounts & presence
    │   ├── Workspace.js        # Workspaces, slugs & member roles
    │   ├── Channel.js          # Public/private channels
    │   └── Message.js          # Indexed chat messages
    ├── routes/
    │   ├── authRoutes.js       # /api/auth
    │   ├── workspaceRoutes.js  # /api/workspaces
    │   ├── channelRoutes.js    # /api/channels
    │   └── messageRoutes.js    # /api/messages
    ├── scripts/
    │   └── seed.js             # Database seeder with Alice & Bob demo accounts
    ├── socket/
    │   └── socketHandler.js    # Socket.io auth, presence, rooms & messaging
    ├── tests/
    │   ├── api.test.js         # 28 REST API unit tests
    │   └── socket.test.js      # 10 Socket.io client integration tests
    ├── server.js               # Entry point mounting REST APIs & Socket engine
    └── package.json
```

---

## Quick Start & Local Execution Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (running locally on `mongodb://localhost:27017` or a MongoDB Atlas URI)

---

### Step 1: Database Seeding (Optional but Recommended)
Populate MongoDB with demo user accounts (Alice & Bob), the **Acme Corp** workspace, and `#general` and `#development` channels:

```powershell
# Inside server/
cd server
npm run seed
```

**Demo Credentials**:
- **Alice Architect**: `alice@syncspace.io` / `password123`
- **Bob Builder**: `bob@syncspace.io` / `password123`

---

### Step 2: Start the Backend Server
Start the Express REST API and Socket.io server (runs on `http://localhost:5000`):

```powershell
cd server
npm run dev
```

---

### Step 3: Start the Frontend Client
In a separate terminal, launch the Vite development server (runs on `http://localhost:5173`):

```powershell
cd client
npm run dev
```

Open `http://localhost:5173` in your browser. Log in with either `alice@syncspace.io` or `bob@syncspace.io`, or open an incognito window to test real-time instant messaging, typing indicators, and presence updates between both users simultaneously!

---

## Running the Automated Test Suites

The backend includes a comprehensive automated test suite testing REST endpoints, JWT verification, and live Socket.io client-server interactions without requiring an external database cluster:

```powershell
cd server
npm test
```
- `npm run test:api`: Runs 28 REST API & route integration tests.
- `npm run test:socket`: Runs 10 Socket.io real-time engine tests with `socket.io-client`.

---

## Production Builds

Build the frontend client for production:
```powershell
cd client
npm run build
```
The optimized production bundle will be output to `client/dist/`.
