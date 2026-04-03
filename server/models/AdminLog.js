const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  ts: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminLog', adminLogSchema);
