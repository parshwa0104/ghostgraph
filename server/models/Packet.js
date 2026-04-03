const mongoose = require('mongoose');

const packetSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
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
  payload: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  shards: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Packet', packetSchema);
