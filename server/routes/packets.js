/* ── Packet Routes ── */

const express = require("express");
const router = express.Router();
const { requireFields } = require("../middleware/validate");
const { getPackets, createPacket } = require("../controllers/packetController");

router.get("/", getPackets);
router.post("/", requireFields("id", "from", "to", "payload", "iv"), createPacket);

module.exports = router;
