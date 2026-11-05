const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'codetrack_secret_jwt_fallback_key',
  jwtExpiresIn: '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@codetrack.dev',
  adminPassword: process.env.ADMIN_PASSWORD,
  nodeEnv: process.env.NODE_ENV || 'development',
  syncCooldownSeconds: parseInt(process.env.SYNC_COOLDOWN_SECONDS, 10) || 45,
  syncDailyCap: parseInt(process.env.SYNC_DAILY_CAP, 10) || 50,
  snapshotCron: process.env.SNAPSHOT_CRON || '0 2 * * *',
  // HTTP Client Timeouts (connect 5s, read 10s)
  httpConnectTimeoutMs: 5000,
  httpReadTimeoutMs: 10000,
  // User agent browser-like header
  browserUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};
