/* ── Chain Routes ── */

const express = require("express");
const router = express.Router();
const { requireFields } = require("../middleware/validate");
const { getChain, addBlock, replaceChain } = require("../controllers/chainController");

router.get("/", getChain);
router.post("/", requireFields("index", "prevHash", "hash"), addBlock);
router.put("/", replaceChain);

module.exports = router;
