const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const Log = require('../models/Log');

// @desc    Get all logs
// @route   GET /api/logs
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const logs = await Log.find({}).sort({ timestamp: -1 }).limit(100); // Get latest 100 logs
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router; 