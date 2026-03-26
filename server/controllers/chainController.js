/* ── Chain Controller ── */

const store = require("../storage/store");
const { logActivity } = require("./adminController");

const CHAIN_FILE = "chain.json";

/**
 * GET /api/chain
 * Returns the full blockchain.
 */
function getChain(req, res) {
  const chain = store.read(CHAIN_FILE, []);
  res.json({ chain });
}

/**
 * POST /api/chain
 * Append a new block. Body: block object.
 */
function addBlock(req, res) {
  const block = {
    index: req.body.index,
    ts: req.body.ts || new Date().toISOString(),
    prevHash: req.body.prevHash,
    txCount: req.body.txCount,
    txHashes: req.body.txHashes,
    nonce: req.body.nonce,
    hash: req.body.hash,
  };

  const chain = store.append(CHAIN_FILE, block);

  // Admin log — block mined
  logActivity("block", `Block #${block.index} mined & anchored (nonce: ${block.nonce})`, {
    blockIndex: block.index,
    hash: block.hash?.slice(0, 24) + "…",
    prevHash: block.prevHash?.slice(0, 24) + "…",
    txCount: block.txCount,
    nonce: block.nonce,
  });

  res.status(201).json({ success: true, height: chain.length - 1 });
}

/**
 * PUT /api/chain
 * Replace the entire chain (for sync/import).
 */
function replaceChain(req, res) {
  const { chain } = req.body;
  if (!Array.isArray(chain)) {
    return res.status(400).json({ error: true, message: "Chain must be an array." });
  }
  store.write(CHAIN_FILE, chain);
  res.json({ success: true, height: chain.length - 1 });
}

module.exports = { getChain, addBlock, replaceChain };
