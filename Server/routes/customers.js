const express = require('express');
const router = express.Router();
const {admin,protect} = require('../middleware/authMiddleware');
const Customer = require('../models/User');

// Get all customers
router.get('/', protect,admin, async (req, res) => {
    try {
      const users = await User.find().select('-password -otp -otpExpires');
      console.log("Users fetched:", users); // Add this
      res.json(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ message: err.message });
    }
  });

  router.get('/:id', protect,admin, async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('-password -otp -otpExpires');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
module.exports = router;