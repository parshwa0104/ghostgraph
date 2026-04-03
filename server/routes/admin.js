/* ── Admin Routes ── */

const express = require("express");
const router = express.Router();
const { getLog, clearLog } = require("../controllers/adminController");

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const b64auth = (authHeader || '').split(' ')[1] || '';
  const [user, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (user === 'test' && password === 'test@123') {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

router.get("/log", adminAuth, getLog);
router.post("/log/clear", adminAuth, clearLog);

module.exports = router;
