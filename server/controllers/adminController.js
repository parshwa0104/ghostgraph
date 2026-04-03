/* ── Admin Activity Log Controller ── */

const store = require("../storage/store");

const LOG_FILE = "admin-log.json";

/**
 * Append a log entry to the admin activity log.
 * Called internally by other controllers.
 */
async function logActivity(type, summary, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    type,
    summary,
    details,
  };

  await store.append(LOG_FILE, entry);
  return entry;
}

/**
 * GET /api/admin/log
 * Returns the full activity log, newest first.
 */
async function getLog(req, res) {
  const log = await store.read(LOG_FILE, []);
  const sorted = log.slice().reverse();
  res.json({ log: sorted, total: sorted.length });
}

/**
 * POST /api/admin/log/clear
 * Clears the activity log.
 */
async function clearLog(req, res) {
  await store.write(LOG_FILE, []);
  res.json({ success: true, message: "Admin log cleared." });
}

module.exports = { logActivity, getLog, clearLog };
