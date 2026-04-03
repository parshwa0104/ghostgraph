const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    unique: true
  },
  tokens: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);
