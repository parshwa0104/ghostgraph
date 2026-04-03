/* ── Packet Controller ── */

const store = require("../storage/store");
const { logActivity } = require("./adminController");

const PACKETS_FILE = "packets.json";

/**
 * GET /api/packets?from=X&to=Y
 * Returns packets between two users (bidirectional).
 */
async function getPackets(req, res) {
  const { from, to } = req.query;
  const all = await store.read(PACKETS_FILE, []);

  if (from && to) {
    const filtered = all.filter(
      (p) => (p.from === from && p.to === to) || (p.from === to && p.to === from)
    );
    return res.json({ packets: filtered });
  }

  res.json({ packets: all });
}

/**
 * POST /api/packets
 * Store a new encrypted packet.
 */
async function createPacket(req, res) {
  const packet = {
    id: req.body.id,
    from: req.body.from,
    to: req.body.to,
    ts: req.body.ts || new Date().toISOString(),
    payload: req.body.payload,
    iv: req.body.iv,
    shards: req.body.shards || [],
  };

  await store.append(PACKETS_FILE, packet);

  // Admin log — message encrypted & sharded
  await logActivity("encryption", `Message encrypted from ${packet.from} → ${packet.to}`, {
    packetId: packet.id,
    from: packet.from,
    to: packet.to,
    payloadPreview: packet.payload.slice(0, 40) + "…",
    shardCount: packet.shards.length,
  });

  if (packet.shards.length > 0) {
    await logActivity("shard", `Message split into ${packet.shards.length} shards`, {
      packetId: packet.id,
      shardPreviews: packet.shards.map((s, i) => ({
        index: i + 1,
        preview: s.slice(0, 24) + "…",
      })),
    });
  }

  res.status(201).json({ success: true, packet });
}

module.exports = { getPackets, createPacket };
