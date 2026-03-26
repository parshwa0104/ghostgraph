/* ── File Routes ── */

const express = require("express");
const router = express.Router();
const { requireFields } = require("../middleware/validate");
const { getFiles, createFile, storeShards, getShards } = require("../controllers/fileController");

router.get("/", getFiles);
router.post("/", requireFields("id", "from", "to", "fileName", "iv"), createFile);
router.get("/:id/shards", getShards);
router.post("/:id/shards", storeShards);

module.exports = router;
