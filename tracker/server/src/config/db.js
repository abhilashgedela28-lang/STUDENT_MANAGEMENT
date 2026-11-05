const mongoose = require('mongoose');
const config = require('./config');

// Disable autoIndex in runtime to prevent Atlas index build locks and timeouts
mongoose.set('autoIndex', false);

const connectDB = async () => {
  const uri = config.mongodbUri;
  if (!uri) {
    console.error('FATAL: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 5000,
      maxPoolSize: 5,
      minPoolSize: 1,
      retryWrites: true,
      w: 'majority',
    });
    console.log(`[Database] MongoDB connected: ${conn.connection.host} (${conn.connection.name})`);

    // Keep connection warm and active to prevent Atlas idle socket drops
    setInterval(() => {
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.db.admin().ping().catch(() => {});
      }
    }, 10000).unref();

    return conn;
  } catch (err) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${err.message}`);
    // Fail fast with clear message
    throw err;
  }
};

module.exports = connectDB;
