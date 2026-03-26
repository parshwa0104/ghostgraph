/* ── Request Validation Helpers ── */

/**
 * Creates middleware that validates required fields exist in req.body.
 */
function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null);
    if (missing.length) {
      return res.status(400).json({
        error: true,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }
    next();
  };
}

/**
 * Validates that a query param exists.
 */
function requireQuery(...params) {
  return (req, res, next) => {
    const missing = params.filter((p) => !req.query[p]);
    if (missing.length) {
      return res.status(400).json({
        error: true,
        message: `Missing required query params: ${missing.join(", ")}`,
      });
    }
    next();
  };
}

module.exports = { requireFields, requireQuery };
