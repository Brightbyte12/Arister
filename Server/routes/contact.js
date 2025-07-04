const express = require('express');
const router = express.Router();
const { ContactInfo, ContactMessage } = require('../models/Contact');
const { admin, protect } = require('../middleware/authMiddleware');

// Public routes
// Submit a contact message
router.post('/message', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const newMessage = await ContactMessage.create({
      name,
      email,
      subject,
      message
    });
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public contact information
router.get('/info', async (req, res) => {
  try {
    const contactInfo = await ContactInfo.findOne().sort({ updatedAt: -1 });
    res.json(contactInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes
// Get all messages
router.get('/admin/messages', protect, admin, async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update message status
router.patch('/admin/message/:id', protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact information
router.put('/admin/info', protect, admin, async (req, res) => {
  try {
    const { address, email, phone, workingHours, additionalInfo } = req.body;
    const contactInfo = await ContactInfo.findOneAndUpdate(
      {},
      {
        address,
        email,
        phone,
        workingHours,
        additionalInfo,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );
    res.json(contactInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a message
router.delete('/admin/message/:id', protect, admin, async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 