const mongoose = require('mongoose');

const contactInfoSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  workingHours: {
    type: String,
    required: true
  },
  additionalInfo: {
    type: String
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'read', 'replied'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ContactInfo = mongoose.model('ContactInfo', contactInfoSchema);
const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = { ContactInfo, ContactMessage }; 