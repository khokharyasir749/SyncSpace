# SyncSpace — Enterprise Real-Time Collaboration & Communication Hub

SyncSpace aik modern, high-performance team collaboration platform hai jo Slack-level workflows deliver karta hai. Is platform ko React 18, Node.js, Express, MongoDB, Socket.io, aur native WebRTC mesh infrastructure par design kiya gaya hai.

---

## 🌟 Key Features

* **Real-Time Messaging & Direct Communication**:
  * Persistent channels (Public/Private) aur 1-on-1 Direct Messages.
  * Low-latency bidirectional updates powered by Socket.io.
  * Instant typing indicators, online/offline presence detection, aur message status updates.

* **Interactive Audio Waveform Voice Notes**:
  * Custom dynamic audio waveform player (WhatsApp/Telegram style).
  * 24 interactive progress bars with seek-on-click capability.
  * Multi-speed playback support (`1x`, `1.5x`, `2x`) aur status indicators.

* **WebRTC Peer-to-Peer Calling**:
  * Low-latency audio aur video calling without third-party paid SDKs.
  * Incoming/outgoing calling modals with ringtone signaling.
  * Call history logs with duration metrics aur quick redial support.
  * Floating Huddle bar for minimized active call controls.

* **Modern Design Engine**:
  * Custom **Charcoal (`#0d0f12`)** dark mode aesthetic.
  * Frosted glassmorphism panels with refined borders (`backdrop-blur`).
  * Instant Light/Dark mode switcher with persistent user preference storage.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React |
| **Real-Time & Audio/Video** | Socket.io Client, WebRTC (`RTCPeerConnection`, `MediaStream`) |
| **Backend** | Node.js, Express.js, Socket.io Server |
| **Database & ODM** | MongoDB Atlas, Mongoose |
| **Testing & Tooling** | Vitest / Jest, Supertest, Postman |

---

## 📂 Project Architecture

```
Sync-Space/
├── client/                      # React frontend application (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── calling/        # WebRTC call modals, floating huddle bar, call logs
│   │   │   ├── chat/           # MessageFeed, waveform player, MessageInput
│   │   │   └── sidebar/        # Channels, Direct Messages, Workspace dock
│   │   ├── context/            # AuthContext, SocketContext, ThemeContext
│   │   ├── pages/              # Dashboard view & Auth pages
│   │   └── index.css           # Global tokens & theme styles
│   └── tailwind.config.js
│
└── server/                      # Node.js backend application
    ├── controllers/            # REST API business logic
    ├── models/                 # Database schemas (User, Workspace, Message, Call)
    ├── routes/                 # Express API routes
    ├── sockets/                # Real-time chat & WebRTC signaling handlers
    └── server.js               # Entry point
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18.0.0+)
* npm ya yarn
* MongoDB Atlas cluster ya local MongoDB URI

### 1. Backend Setup

```bash
cd server
npm install
```

`server/` directory ke andar `.env` file banayein:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_uri
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
```

Backend start karein:

```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd ../client
npm install
```

`client/` directory ke andar `.env` file banayein:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Frontend run karein:

```bash
npm run dev
```

---

## 🧪 Testing & Verification

Dono client aur server test suite run karein:

```bash
# Server API & Socket tests
cd server
npm test

# Client production build
cd ../client
npm run build
```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for details.
