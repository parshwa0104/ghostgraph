/* ── File Controller ── */

const store = require("../storage/store");
const { logActivity } = require("./adminController");

const FILES_FILE = "files.json";

/**
 * GET /api/files?from=X&to=Y
 * Returns file metadata between two users.
 */
function getFiles(req, res) {
  const { from, to } = req.query;
  const all = store.read(FILES_FILE, []);

  if (from && to) {
    const filtered = all.filter(
      (f) => (f.from === from && f.to === to) || (f.from === to && f.to === from)
    );
    return res.json({ files: filtered });
  }

  res.json({ files: all });
}

/**
 * POST /api/files
 * Store file metadata.
 */
function createFile(req, res) {
  const fileMeta = {
    id: req.body.id,
    type: "file",
    from: req.body.from,
    to: req.body.to,
    ts: req.body.ts || new Date().toISOString(),
    fileName: req.body.fileName,
    fileSize: req.body.fileSize,
    fileHash: req.body.fileHash,
    iv: req.body.iv,
    shardCount: req.body.shardCount,
    relayNodes: req.body.relayNodes,
  };

  store.append(FILES_FILE, fileMeta);

  // Admin log — file encrypted
  logActivity("file", `File "${fileMeta.fileName}" encrypted by ${fileMeta.from} → ${fileMeta.to}`, {
    fileId: fileMeta.id,
    fileName: fileMeta.fileName,
    fileSize: fileMeta.fileSize,
    fileHash: fileMeta.fileHash?.slice(0, 24) + "…",
    from: fileMeta.from,
    to: fileMeta.to,
  });

  res.status(201).json({ success: true, file: fileMeta });
}

/**
 * POST /api/files/:id/shards
 * Store shards for a file. Body: { shards: [{ node, data }] }
 */
function storeShards(req, res) {
  const { id } = req.params;
  const { shards } = req.body;

  if (!Array.isArray(shards) || !shards.length) {
    return res.status(400).json({ error: true, message: "Shards array required." });
  }

  for (const shard of shards) {
    if (!shard.node || !shard.data) {
      return res.status(400).json({ error: true, message: "Each shard needs node and data." });
    }
    store.writeShard(id, shard.node, shard.data);
  }

  // Admin log — shards distributed
  logActivity("shard", `${shards.length} file shards distributed across relay nodes`, {
    fileId: id,
    nodes: shards.map((s) => s.node),
    shardSizes: shards.map((s) => ({ node: s.node, bytes: s.data.length })),
  });

  res.status(201).json({ success: true, stored: shards.length });
}

/**
 * GET /api/files/:id/shards
 * Collect all shards for a file.
 */
function getShards(req, res) {
  const { id } = req.params;
  const shards = store.readAllShards(id);

  if (!shards.length) {
    return res.status(404).json({ error: true, message: "No shards found for this file." });
  }

  // Admin log — shards collected for download
  logActivity("download", `File shards collected for download (${shards.length} shards)`, {
    fileId: id,
    shardCount: shards.length,
    nodes: shards.map((s) => s.node),
  });

  res.json({ shards });
}

module.exports = { getFiles, createFile, storeShards, getShards };
