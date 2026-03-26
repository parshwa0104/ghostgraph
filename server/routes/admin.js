/* ── Admin Routes ── */

const express = require("express");
const router = express.Router();
const { getLog, clearLog } = require("../controllers/adminController");

router.get("/log", getLog);
router.post("/log/clear", clearLog);

module.exports = router;
