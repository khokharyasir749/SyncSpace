const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const channelRoutes = require('./routes/channelRoutes');
const messageRoutes = require('./routes/messageRoutes');
const callRoutes = require('./routes/callRoutes');
const path = require('path');
const fs = require('fs');
const errorHandler = require('./middleware/errorHandler');
const initSocket = require('./socket/socketHandler');
const uploadRoutes = require('./routes/uploadRoutes');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach Socket.io Handlers & Middleware
initSocket(io);

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = dbStates[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    status: 'ok',
    database: dbState,
    timestamp: new Date().toISOString(),
    service: 'SyncSpace Server',
  });
});

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const Channel = require('./models/Channel');

const migrateLegacyChannels = async () => {
  try {
    const legacyChannels = await Channel.find({
      $or: [
        { creator: { $exists: false } },
        { creator: null },
        { admins: { $exists: false } },
        { admins: { $size: 0 } },
      ],
    });

    if (legacyChannels.length > 0) {
      console.log(`[Migration] Found ${legacyChannels.length} channels missing creator or admins. Backfilling...`);
      for (const channel of legacyChannels) {
        let ownerId = channel.creator;
        if (!ownerId && Array.isArray(channel.members) && channel.members.length > 0) {
          ownerId = channel.members[0];
        }

        if (ownerId) {
          channel.creator = ownerId;
          const adminSet = new Set((channel.admins || []).map((a) => a.toString()));
          adminSet.add(ownerId.toString());
          channel.admins = Array.from(adminSet);
          await channel.save();
        }
      }
      console.log(`[Migration] Successfully backfilled ${legacyChannels.length} legacy channels.`);
    }
  } catch (err) {
    console.error('[Migration Error] Failed to migrate legacy channels:', err.message);
  }
};

// Connect to Database and start server
const startServer = async () => {
  await connectDB();
  await migrateLegacyChannels();

  server.listen(PORT, () => {
    console.log(`[Server] SyncSpace backend running on http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

// Export server instances for testing and programmatic execution
module.exports = { app, server, io };
