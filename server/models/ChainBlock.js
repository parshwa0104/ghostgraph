const mongoose = require('mongoose');

const chainBlockSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
    unique: true
  },
  ts: {
    type: String,
    required: true
  },
  prevHash: {
    type: String,
    required: true
  },
  txCount: {
    type: Number,
    required: true
  },
  txHashes: {
    type: [String],
    default: []
  },
  nonce: {
    type: Number,
    required: true
  },
  hash: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ChainBlock', chainBlockSchema);
