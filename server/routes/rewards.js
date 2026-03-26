/* ── Reward Routes ── */

const express = require("express");
const router = express.Router();
const { getRewards, updateRewards } = require("../controllers/rewardController");

router.get("/", getRewards);
router.put("/", updateRewards);

module.exports = router;
