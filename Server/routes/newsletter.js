const express = require('express');
const router = express.Router();
const NewsletterSubscription = require('../models/NewsletterSubscription');
const { Parser } = require('json2csv');

// Subscribe to newsletter
router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  try {
    // Check for existing subscription
    const existing = await NewsletterSubscription.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already subscribed' });
    }
    const subscription = new NewsletterSubscription({ email });
    await subscription.save();
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List all newsletter subscriptions (admin use)
router.get('/', async (req, res) => {
  try {
    const subscriptions = await NewsletterSubscription.find().sort({ created: -1 });
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export newsletter subscribers as CSV
router.get('/export', async (req, res) => {
  try {
    const subscriptions = await NewsletterSubscription.find().sort({ created: -1 });
    const fields = ['email', 'created'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(subscriptions.map(s => ({
      email: s.email,
      created: s.created.toISOString(),
    })));
    res.header('Content-Type', 'text/csv');
    res.attachment('newsletter_subscribers.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 