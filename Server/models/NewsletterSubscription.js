const mongoose = require('mongoose');

const newsletterSubscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('NewsletterSubscription', newsletterSubscriptionSchema); 