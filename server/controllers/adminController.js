/* ── Admin Activity Log Controller ── */

const store = require("../storage/store");

const LOG_FILE = "admin-log.json";

/**
 * Append a log entry to the admin activity log.
 * Called internally by other controllers.
 */
function logActivity(type, summary, details = {}) {
  const entry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    type,       // encryption | shard | block | file | download
    summary,
    details,
  };

  store.append(LOG_FILE, entry);
  return entry;
}

/**
 * GET /api/admin/log
 * Returns the full activity log, newest first.
 */
function getLog(req, res) {
  const log = store.read(LOG_FILE, []);
  const sorted = log.slice().reverse();
  res.json({ log: sorted, total: sorted.length });
}

/**
 * POST /api/admin/log/clear
 * Clears the activity log.
 */
function clearLog(req, res) {
  store.write(LOG_FILE, []);
  res.json({ success: true, message: "Admin log cleared." });
}

module.exports = { logActivity, getLog, clearLog };
