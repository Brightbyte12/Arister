const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info' },
  active: { type: Boolean, default: true },
  created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Announcement', announcementSchema);