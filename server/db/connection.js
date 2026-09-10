// PriceWise - MongoDB connection module (Phase 4)
// Single shared Mongoose connection for the whole server process.
// The connection string comes ONLY from process.env.MONGODB_URI (backend only).

const mongoose = require('mongoose');

let connectPromise = null;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  return typeof uri === 'string' ? uri.trim() : '';
}

/**
 * Connect to MongoDB Atlas exactly once per server process.
 * Throws a clear error when MONGODB_URI is missing or the connection fails.
 * Never logs the connection string or credentials.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const uri = getMongoUri();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env and set a valid MongoDB Atlas connection string.'
    );
  }

  connectPromise = mongoose
    .connect(uri)
    .then(() => {
      console.log('PriceWise: MongoDB connected.');
      return mongoose.connection;
    })
    .catch((error) => {
      // Allow a later retry instead of caching a rejected connection.
      connectPromise = null;
      const message = error && error.message ? error.message : 'unknown error';
      // Log only the message — never the URI or credentials.
      // querySrv ECONNREFUSED means the network refused the SRV DNS lookup
      // (common when an IPv6/ISP resolver answers REFUSED); a direct
      // mongodb:// URI with explicit shard hosts bypasses SRV entirely.
      const hint = message.includes('querySrv')
        ? ' (SRV DNS lookup was refused — use the direct mongodb:// format from .env.example instead of mongodb+srv://)'
        : '';
      throw new Error(`PriceWise: MongoDB connection failed: ${message}${hint}`);
    });

  return connectPromise;
}

/**
 * Report the current Mongoose connection state without exposing secrets.
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting.
 * @returns {{state: number, connected: boolean}}
 */
function getConnectionState() {
  const state = mongoose.connection.readyState;
  return { state, connected: state === 1 };
}

module.exports = { connectDB, getConnectionState };
