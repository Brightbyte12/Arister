const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
// Middleware for admin access can be added here if needed
// const { admin, protect } = require('../middleware/authMiddleware');

// --- Admin Routes ---

// Get all promotions
router.get('/', async (req, res) => {
  try {
    const promotions = await Promotion.find({});
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Create a promotion
router.post('/', async (req, res) => {
  try {
    const promotion = new Promotion(req.body);
    const newPromotion = await promotion.save();
    res.status(201).json(newPromotion);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Promotion code already exists.' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Update a promotion
router.put('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promotion) return res.status(404).json({ message: 'Promotion not found.' });
    res.json(promotion);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a promotion
router.delete('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndDelete(req.params.id);
    if (!promotion) return res.status(404).json({ message: 'Promotion not found.' });
    res.json({ message: 'Promotion deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});


// --- Public Route for Checkout ---

// Apply a promotion code
router.post('/apply', async (req, res) => {
  const { code, cartTotal } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'Promotion code is required.' });
  }

  try {
    const promotion = await Promotion.findOne({ code: code.toUpperCase() });

    if (!promotion) {
      return res.status(404).json({ message: 'Invalid promotion code.' });
    }
    if (!promotion.isActive) {
      return res.status(400).json({ message: 'This promotion is not active.' });
    }
    if (promotion.startDate && promotion.startDate > Date.now()) {
      return res.status(400).json({ message: 'This promotion has not started yet.' });
    }
    if (promotion.endDate && promotion.endDate < Date.now()) {
      return res.status(400).json({ message: 'This promotion has expired.' });
    }
    if (promotion.usageLimit && promotion.timesUsed >= promotion.usageLimit) {
      return res.status(400).json({ message: 'This promotion has reached its usage limit.' });
    }
    if (promotion.minPurchase && cartTotal < promotion.minPurchase) {
      return res.status(400).json({ message: `A minimum purchase of ₹${promotion.minPurchase} is required.` });
    }

    let discount = 0;
    if (promotion.discountType === 'percentage') {
      discount = (cartTotal * promotion.discountValue) / 100;
    } else if (promotion.discountType === 'fixed') {
      discount = promotion.discountValue;
    }

    res.json({
      message: 'Promotion applied successfully!',
      discount,
      code: promotion.code,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router; 