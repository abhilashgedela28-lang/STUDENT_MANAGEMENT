const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config/config');
const authService = require('./services/authService');
const { seedStarterProblems } = require('./seeds/seedProblems');
const { initSnapshotScheduler } = require('./schedulers/snapshotScheduler');

async function startServer() {
  console.log('--------------------------------------------------');
  console.log('   Starting CodeTrack Backend (MERN Stack)');
  console.log('--------------------------------------------------');

  try {
    // 1. Fail-fast Database Connection
    await connectDB();

    // 2. Admin Seeding (if none exists)
    await authService.seedAdminIfNoneExists();

    // 3. Seed 20 Starter Problems (if none exist)
    await seedStarterProblems();

    // 4. Start Snapshot Cron Scheduler
    initSnapshotScheduler();

    // 5. Start HTTP Listener
    const server = app.listen(config.port, () => {
      console.log(`[Server] CodeTrack running on http://localhost:${config.port}`);
      console.log(`[Actuator] Health endpoint at http://localhost:${config.port}/actuator/health`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('==================================================');
    console.error('FATAL: Could not start CodeTrack application!');
    console.error(`Reason: ${err.message}`);
    console.error('==================================================');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
