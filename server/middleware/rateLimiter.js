/* ── Rate Limiter ── */

const rateLimit = require("express-rate-limit");

const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: "Too many requests. Please slow down.",
  },
});

module.exports = { rateLimiter };
