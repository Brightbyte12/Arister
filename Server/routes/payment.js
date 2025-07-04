const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();

router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_details } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_details) {
      return res.status(400).json({ error: 'Missing payment or order details' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Create Shiprocket order
      const shiprocketResponse = await axios.post(
        'http://localhost:5000/api/shiprocket/create',
        order_details,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (shiprocketResponse.data.success) {
        return res.status(200).json({
          success: true,
          order_id: razorpay_order_id,
          shiprocket_order: shiprocketResponse.data.shiprocket_order,
        });
      } else {
        throw new Error('Shiprocket order creation failed');
      }
    }

    res.status(400).json({ error: 'Invalid payment signature' });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
