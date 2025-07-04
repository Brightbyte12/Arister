const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  meta: {
    type: Object,
  },
});

module.exports = mongoose.model('Log', logSchema); 