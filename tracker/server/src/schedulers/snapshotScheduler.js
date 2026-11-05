const cron = require('node-cron');
const snapshotService = require('../services/snapshotService');
const config = require('../config/config');

function initSnapshotScheduler() {
  const cronExpr = config.snapshotCron;
  if (!cronExpr) {
    console.log('[Scheduler] SNAPSHOT_CRON not set. Scheduler disabled.');
    return;
  }

  // Validate cron expression
  if (!cron.validate(cronExpr)) {
    console.error(`[Scheduler] Invalid cron expression: "${cronExpr}". Scheduler disabled.`);
    return;
  }

  console.log(`[Scheduler] Snapshot job scheduled with pattern: "${cronExpr}"`);

  cron.schedule(cronExpr, async () => {
    console.log('[Scheduler] Running scheduled snapshot job...');
    try {
      await snapshotService.snapshotAllVerifiedUsers();
    } catch (err) {
      console.error('[Scheduler] Scheduled snapshot job failed:', err.message);
    }
  });
}

module.exports = { initSnapshotScheduler };
