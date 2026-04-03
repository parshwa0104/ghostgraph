/* ── Reward Controller ── */

const store = require("../storage/store");

const REWARDS_FILE = "rewards.json";

/**
 * GET /api/rewards
 * Returns all token balances.
 */
async function getRewards(req, res) {
  const rewards = await store.read(REWARDS_FILE, {});
  res.json({ rewards });
}

/**
 * PUT /api/rewards
 * Update token balances. Body: { rewards: { alice: 5, bob: 3 } }
 */
async function updateRewards(req, res) {
  const { rewards } = req.body;
  if (!rewards || typeof rewards !== "object") {
    return res.status(400).json({ error: true, message: "Rewards object required." });
  }
  await store.write(REWARDS_FILE, rewards);
  res.json({ success: true, rewards });
}

module.exports = { getRewards, updateRewards };
