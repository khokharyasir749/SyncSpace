const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

/**
 * Resilient MongoDB Connection Handler
 * Implements exponential backoff reconnection and process lifecycle management
 */
const MAX_RETRIES = 5;
let retryCount = 0;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/syncspace';

  const options = {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(mongoURI, options);
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    retryCount = 0; // Reset retry counter upon successful connection
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    retryCount++;
    if (retryCount <= MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`[MongoDB] Retrying connection in ${delay / 1000}s (Attempt ${retryCount}/${MAX_RETRIES})...`);
      setTimeout(connectDB, delay);
    } else {
      console.error('[MongoDB] Max reconnection attempts reached. Could not establish database connection.');
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
};

// Monitor connection events
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Connection state: CONNECTED');
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection state: DISCONNECTED. Attempting reconnection...');
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Connection state: RECONNECTED');
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB] Runtime connection error: ${err.message}`);
});

// Graceful shutdown on process termination
const gracefulShutdown = async (signal) => {
  try {
    await mongoose.connection.close(false);
    console.log(`[MongoDB] Connection closed through app termination (${signal})`);
    process.exit(0);
  } catch (err) {
    console.error(`[MongoDB] Error during graceful disconnect: ${err.message}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;
