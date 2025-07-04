const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const axios = require('axios');

// Get Shiprocket token
const getShiprocketToken = async () => {
  try {
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    });
    return response.data.token;
  } catch (error) {
    console.error('Error getting Shiprocket token:', error);
    throw new Error('Failed to get Shiprocket token');
  }
};

// Create Shiprocket order for replacement
const createReplacementShiprocketOrder = async (originalOrder, replacementReason) => {
  try {
    const token = await getShiprocketToken();
    const address = originalOrder.shipping;
    const nameParts = address.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ".";
    
    const replacementOrderId = `REP_${originalOrder.orderId}_${Date.now()}`;
    
    console.log("Creating Shiprocket replacement order for:", { 
      originalOrderId: originalOrder.orderId, 
      replacementOrderId,
      address, 
      items: originalOrder.items 
    });
    
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      {
        order_id: replacementOrderId,
        order_date: new Date().toISOString().split("T")[0],
        billing_customer_name: firstName,
        billing_last_name: lastName,
        billing_address: address.addressLine1,
        billing_address_2: address.addressLine2 || "",
        billing_city: address.city,
        billing_pincode: address.postalCode,
        billing_state: address.state,
        billing_country: address.country,
        billing_email: originalOrder.user.email,
        billing_phone: address.phone,
        shipping_is_billing: true,
        order_items: originalOrder.items.map((item) => ({
          name: `REPLACEMENT - ${item.name}`,
          sku: item.sku || item.id,
          units: item.quantity || 1,
          selling_price: 0, // Free replacement
          weight: 0.5,
          length: 20,
          breadth: 15,
          height: 10,
        })),
        payment_method: "Prepaid",
        sub_total: 0, // Free replacement
        length: 20,
        breadth: 15,
        height: 10,
        weight: 0.5,
        pickup_location: "Primary",
        comment: `Replacement for order ${originalOrder.orderId}. Reason: ${replacementReason}`,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    console.log("Shiprocket replacement order response:", JSON.stringify(response.data, null, 2));
    return { 
      shipment_id: response.data.shipment_id, 
      order_id: response.data.order_id,
      replacement_order_id: replacementOrderId
    };
  } catch (error) {
    console.error("Shiprocket replacement order creation error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to create Shiprocket replacement order");
  }
};

// Check if order is eligible for replacement
router.get('/check-eligibility/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order is delivered
    if (order.status !== 'delivered' && order.status !== 'confirmed') {
      return res.json({
        eligible: false,
        reason: 'order_not_delivered',
        message: 'Order must be delivered before requesting replacement'
      });
    }

    // Check if replacement is already requested
    if (order.replacementRequested) {
      return res.json({
        eligible: false,
        reason: 'replacement_already_requested',
        message: 'Replacement already requested for this order',
        replacementStatus: order.replacementStatus
      });
    }

    // Get product replacement policy
    const product = await Product.findById(order.items[0].id);
    if (!product || !product.replacementPolicy) {
      return res.json({
        eligible: false,
        reason: 'no_replacement_policy',
        message: 'This product does not have a replacement policy'
      });
    }

    // Calculate delivery date (use order creation date as fallback)
    const deliveryDate = order.shipping?.expectedDeliveryDate || order.createdAt;
    const replacementDeadline = new Date(deliveryDate);
    replacementDeadline.setDate(replacementDeadline.getDate() + product.replacementPolicy.days);

    const now = new Date();
    const isWithinReplacementPeriod = now <= replacementDeadline;

    if (!isWithinReplacementPeriod) {
      return res.json({
        eligible: false,
        reason: 'replacement_period_expired',
        message: `Replacement period expired. Replacement policy allows replacements within ${product.replacementPolicy.days} days of delivery.`,
        replacementDeadline: replacementDeadline,
        daysRemaining: 0
      });
    }

    // Calculate remaining days
    const daysRemaining = Math.ceil((replacementDeadline - now) / (1000 * 60 * 60 * 24));

    res.json({
      eligible: true,
      replacementPolicy: product.replacementPolicy,
      deliveryDate: deliveryDate,
      replacementDeadline: replacementDeadline,
      daysRemaining: daysRemaining
    });

  } catch (error) {
    console.error('Error checking replacement eligibility:', error);
    res.status(500).json({ message: 'Failed to check replacement eligibility' });
  }
});

// Request replacement
router.post('/request/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    if (!reason) {
      return res.status(400).json({ message: 'Replacement reason is required' });
    }

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if replacement is already requested
    if (order.replacementRequested) {
      return res.status(400).json({ message: 'Replacement already requested for this order' });
    }

    // Check eligibility
    const product = await Product.findById(order.items[0].id);
    if (!product || !product.replacementPolicy) {
      return res.status(400).json({ message: 'This product does not have a replacement policy' });
    }

    const deliveryDate = order.shipping?.expectedDeliveryDate || order.createdAt;
    const replacementDeadline = new Date(deliveryDate);
    replacementDeadline.setDate(replacementDeadline.getDate() + product.replacementPolicy.days);

    const now = new Date();
    if (now > replacementDeadline) {
      return res.status(400).json({ 
        message: `Replacement period expired. Replacement policy allows replacements within ${product.replacementPolicy.days} days of delivery.` 
      });
    }

    // Update order with replacement request
    order.replacementRequested = true;
    order.replacementRequestedAt = now;
    order.replacementReason = reason;
    order.replacementStatus = 'pending';

    await order.save();

    res.json({
      message: 'Replacement request submitted successfully',
      replacementRequest: {
        orderId: order.orderId,
        replacementRequestedAt: order.replacementRequestedAt,
        replacementReason: order.replacementReason,
        replacementStatus: order.replacementStatus
      }
    });

  } catch (error) {
    console.error('Error requesting replacement:', error);
    res.status(500).json({ message: 'Failed to request replacement' });
  }
});

// Get user's replacement requests
router.get('/my-replacements', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const replacements = await Order.find({ 
      user: userId, 
      replacementRequested: true 
    }).sort({ replacementRequestedAt: -1 });

    const replacementRequests = replacements.map(order => ({
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      replacementRequestedAt: order.replacementRequestedAt,
      replacementReason: order.replacementReason,
      replacementStatus: order.replacementStatus,
      replacementApprovedAt: order.replacementApprovedAt,
      replacementRejectedAt: order.replacementRejectedAt,
      replacementRejectionReason: order.replacementRejectionReason,
      replacementCompletedAt: order.replacementCompletedAt,
      replacementTrackingNumber: order.replacementTrackingNumber,
      replacementCourier: order.replacementCourier,
      orderDate: order.createdAt
    }));

    res.json({ replacements: replacementRequests });

  } catch (error) {
    console.error('Error fetching replacement requests:', error);
    res.status(500).json({ message: 'Failed to fetch replacement requests' });
  }
});

// Cancel replacement request (if still pending)
router.post('/cancel/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.replacementRequested) {
      return res.status(400).json({ message: 'No replacement request found for this order' });
    }

    if (order.replacementStatus !== 'pending') {
      return res.status(400).json({ message: 'Cannot cancel replacement request that is not pending' });
    }

    // Reset replacement fields
    order.replacementRequested = false;
    order.replacementRequestedAt = null;
    order.replacementReason = null;
    order.replacementStatus = 'pending';
    order.replacementApprovedAt = null;
    order.replacementRejectedAt = null;
    order.replacementRejectionReason = null;

    await order.save();

    res.json({ message: 'Replacement request cancelled successfully' });

  } catch (error) {
    console.error('Error cancelling replacement request:', error);
    res.status(500).json({ message: 'Failed to cancel replacement request' });
  }
});

// Admin: Approve replacement and create Shiprocket order
router.post('/admin/approve/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { adminNotes } = req.body;

    const order = await Order.findOne({ orderId }).populate('user');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.replacementRequested) {
      return res.status(400).json({ message: 'No replacement request found for this order' });
    }

    if (order.replacementStatus !== 'pending') {
      return res.status(400).json({ message: 'Replacement request is not pending' });
    }

    // Create Shiprocket order for replacement
    try {
      const shiprocketResult = await createReplacementShiprocketOrder(order, order.replacementReason);
      
      // Update order with replacement approval and Shiprocket details
      order.replacementStatus = 'approved';
      order.replacementApprovedAt = new Date();
      order.replacementTrackingNumber = shiprocketResult.shipment_id;
      order.replacementCourier = 'Shiprocket';
      order.replacementShiprocketOrderId = shiprocketResult.replacement_order_id;
      order.replacementAdminNotes = adminNotes;

      await order.save();

      res.json({
        message: 'Replacement approved and Shiprocket order created successfully',
        replacement: {
          orderId: order.orderId,
          replacementStatus: order.replacementStatus,
          replacementApprovedAt: order.replacementApprovedAt,
          replacementTrackingNumber: order.replacementTrackingNumber,
          replacementCourier: order.replacementCourier,
          replacementShiprocketOrderId: order.replacementShiprocketOrderId,
          shiprocketOrder: shiprocketResult
        }
      });

    } catch (shiprocketError) {
      console.error('Shiprocket order creation failed:', shiprocketError);
      
      // Update order with rejection due to Shiprocket failure
      order.replacementStatus = 'rejected';
      order.replacementRejectedAt = new Date();
      order.replacementRejectionReason = 'Failed to create shipping order: ' + shiprocketError.message;
      order.replacementAdminNotes = adminNotes;

      await order.save();

      res.status(500).json({
        message: 'Replacement rejected due to shipping order creation failure',
        error: shiprocketError.message,
        replacement: {
          orderId: order.orderId,
          replacementStatus: order.replacementStatus,
          replacementRejectedAt: order.replacementRejectedAt,
          replacementRejectionReason: order.replacementRejectionReason
        }
      });
    }

  } catch (error) {
    console.error('Error approving replacement:', error);
    res.status(500).json({ message: 'Failed to approve replacement' });
  }
});

// Admin: Reject replacement
router.post('/admin/reject/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.replacementRequested) {
      return res.status(400).json({ message: 'No replacement request found for this order' });
    }

    if (order.replacementStatus !== 'pending') {
      return res.status(400).json({ message: 'Replacement request is not pending' });
    }

    // Update order with rejection
    order.replacementStatus = 'rejected';
    order.replacementRejectedAt = new Date();
    order.replacementRejectionReason = rejectionReason;
    order.replacementAdminNotes = adminNotes;

    await order.save();

    res.json({
      message: 'Replacement request rejected successfully',
      replacement: {
        orderId: order.orderId,
        replacementStatus: order.replacementStatus,
        replacementRejectedAt: order.replacementRejectedAt,
        replacementRejectionReason: order.replacementRejectionReason
      }
    });

  } catch (error) {
    console.error('Error rejecting replacement:', error);
    res.status(500).json({ message: 'Failed to reject replacement' });
  }
});

// Admin: Get all replacement requests
router.get('/admin/all', protect, async (req, res) => {
  try {
    const replacements = await Order.find({ 
      replacementRequested: true 
    }).populate('user').sort({ replacementRequestedAt: -1 });

    const replacementRequests = replacements.map(order => ({
      orderId: order.orderId,
      user: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone
      },
      items: order.items,
      total: order.total,
      replacementRequestedAt: order.replacementRequestedAt,
      replacementReason: order.replacementReason,
      replacementStatus: order.replacementStatus,
      replacementApprovedAt: order.replacementApprovedAt,
      replacementRejectedAt: order.replacementRejectedAt,
      replacementRejectionReason: order.replacementRejectionReason,
      replacementCompletedAt: order.replacementCompletedAt,
      replacementTrackingNumber: order.replacementTrackingNumber,
      replacementCourier: order.replacementCourier,
      replacementShiprocketOrderId: order.replacementShiprocketOrderId,
      replacementAdminNotes: order.replacementAdminNotes,
      orderDate: order.createdAt,
      shipping: order.shipping
    }));

    res.json({ replacements: replacementRequests });

  } catch (error) {
    console.error('Error fetching all replacement requests:', error);
    res.status(500).json({ message: 'Failed to fetch replacement requests' });
  }
});

// Admin: Mark replacement as completed
router.post('/admin/complete/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { adminNotes } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.replacementRequested) {
      return res.status(400).json({ message: 'No replacement request found for this order' });
    }

    if (order.replacementStatus !== 'approved') {
      return res.status(400).json({ message: 'Replacement must be approved before marking as completed' });
    }

    // Update order with completion
    order.replacementStatus = 'completed';
    order.replacementCompletedAt = new Date();
    if (adminNotes) {
      order.replacementAdminNotes = adminNotes;
    }

    await order.save();

    res.json({
      message: 'Replacement marked as completed successfully',
      replacement: {
        orderId: order.orderId,
        replacementStatus: order.replacementStatus,
        replacementCompletedAt: order.replacementCompletedAt
      }
    });

  } catch (error) {
    console.error('Error completing replacement:', error);
    res.status(500).json({ message: 'Failed to complete replacement' });
  }
});

module.exports = router; 