const mongoose = require('mongoose');

const categoryImageSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['hero', 'new-arrivals', 'men', 'women'],
  },
  contentType: {
    type: String,
    required: true,
    enum: ['images', 'video'],
  },
  imageUrls: [{
    url: { type: String },
    publicId: { type: String },
  }],
  videoUrl: { type: String, default: '' },
  videoPublicId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('CategoryImage', categoryImageSchema);