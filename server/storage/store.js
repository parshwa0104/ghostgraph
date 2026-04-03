/* ── MongoDB Storage Engine Bridge ── */

const Packet = require("../models/Packet");
const File = require("../models/File");
const ChainBlock = require("../models/ChainBlock");
const Reward = require("../models/Reward");
const AdminLog = require("../models/AdminLog");

const modelMap = {
  "packets.json": Packet,
  "files.json": File,
  "chain.json": ChainBlock,
  "rewards.json": Reward,
  "admin-log.json": AdminLog,
};

async function read(filename, defaultValue = []) {
  const Model = modelMap[filename];
  if (!Model) return defaultValue;
  try {
    if (filename === "chain.json") {
      const docs = await Model.find().sort({ index: 1 });
      return docs.map(d => { const obj = d.toObject(); delete obj._id; delete obj.__v; return obj; });
    } else if (filename === "rewards.json") {
      const rewards = await Model.find();
      const obj = {};
      rewards.forEach((r) => { obj[r.user] = r.tokens; });
      return obj; // Return object format to match legacy
    } else {
      const docs = await Model.find().sort({ createdAt: 1 });
      return docs.map(d => { const obj = d.toObject(); delete obj._id; delete obj.__v; return obj; });
    }
  } catch (err) {
    console.error("Store read error:", err);
    return defaultValue;
  }
}

async function write(filename, data) {
  const Model = modelMap[filename];
  if (!Model) return;
  try {
    if (filename === "rewards.json") {
      for (const [user, tokens] of Object.entries(data)) {
        await Model.findOneAndUpdate({ user }, { tokens }, { upsert: true });
      }
    } else {
      await Model.deleteMany({});
      if (Array.isArray(data) && data.length > 0) {
        await Model.insertMany(data);
      }
    }
  } catch (err) {
    console.error("Store write error:", err);
  }
}

async function append(filename, item) {
  const Model = modelMap[filename];
  if (!Model) return [];
  try {
    await Model.create(item);
    return await read(filename);
  } catch (err) {
    console.error("Store append error:", err);
    return [];
  }
}

/* ── Shard Storage (Embedded in File docs) ── */

async function writeShard(packetId, nodeName, base64Data) {
  try {
    const file = await File.findOne({ id: packetId });
    if (!file) return;
    
    const existingIndex = file.shardsData.findIndex(s => s.node === nodeName);
    if (existingIndex >= 0) {
      file.shardsData[existingIndex].data = base64Data;
    } else {
      file.shardsData.push({ node: nodeName, data: base64Data });
    }
    await file.save();
  } catch (err) {
    console.error("Store writeShard error:", err);
  }
}

async function readShard(packetId, nodeName) {
  try {
    const file = await File.findOne({ id: packetId });
    if (!file) return null;
    const shard = file.shardsData.find(s => s.node === nodeName);
    return shard ? shard.data : null;
  } catch (err) {
    console.error("Store readShard error:", err);
    return null;
  }
}

async function readAllShards(packetId) {
  try {
    const file = await File.findOne({ id: packetId });
    if (!file) return [];
    return file.shardsData.map(s => ({ node: s.node, data: s.data }));
  } catch (err) {
    console.error("Store readAllShards error:", err);
    return [];
  }
}

async function clearAllData() {
  try {
    await Packet.deleteMany({});
    await File.deleteMany({});
    await ChainBlock.deleteMany({});
    await Reward.deleteMany({});
    await AdminLog.deleteMany({});
  } catch (err) {
    console.error("Store clearAllData error:", err);
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
