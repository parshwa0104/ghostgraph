const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    default: "file"
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  ts: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileHash: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  shardCount: {
    type: Number,
    required: true
  },
  relayNodes: {
    type: [String],
    default: []
  },
  // We embed the actual encrypted shards in the document to replace local file storage
  shardsData: {
    type: [{
      node: String,
      data: String
    }],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
