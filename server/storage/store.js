/* ── JSON File Storage Engine ── */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

// Ensure data directories exist
function ensureDataDirs() {
  const dirs = [DATA_DIR, path.join(DATA_DIR, "shards")];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

ensureDataDirs();

/**
 * Read a JSON data file. Returns default value if file doesn't exist.
 */
function read(filename, defaultValue = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * Write data to a JSON file atomically.
 */
function write(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

/**
 * Append an item to a JSON array file.
 */
function append(filename, item) {
  const arr = read(filename, []);
  arr.push(item);
  write(filename, arr);
  return arr;
}

/* ── Shard Storage ── */

function writeShard(packetId, nodeName, base64Data) {
  const shardDir = path.join(DATA_DIR, "shards", packetId);
  if (!fs.existsSync(shardDir)) {
    fs.mkdirSync(shardDir, { recursive: true });
  }
  fs.writeFileSync(path.join(shardDir, `${nodeName}.shard`), base64Data, "utf-8");
}

function readShard(packetId, nodeName) {
  const shardPath = path.join(DATA_DIR, "shards", packetId, `${nodeName}.shard`);
  if (!fs.existsSync(shardPath)) {
    return null;
  }
  return fs.readFileSync(shardPath, "utf-8");
}

function readAllShards(packetId) {
  const shardDir = path.join(DATA_DIR, "shards", packetId);
  if (!fs.existsSync(shardDir)) {
    return [];
  }
  const files = fs.readdirSync(shardDir).filter((f) => f.endsWith(".shard"));
  return files.map((f) => ({
    node: f.replace(".shard", ""),
    data: fs.readFileSync(path.join(shardDir, f), "utf-8"),
  }));
}

function clearAllData() {
  const files = ["packets.json", "files.json", "chain.json", "rewards.json"];
  for (const f of files) {
    const p = path.join(DATA_DIR, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const shardDir = path.join(DATA_DIR, "shards");
  if (fs.existsSync(shardDir)) {
    fs.rmSync(shardDir, { recursive: true, force: true });
    fs.mkdirSync(shardDir, { recursive: true });
  }
}

module.exports = {
  read,
  write,
  append,
  writeShard,
  readShard,
  readAllShards,
  clearAllData,
};
