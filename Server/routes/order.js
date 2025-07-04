const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const axios = require("axios");
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/authMiddleware");
const Order = require("../models/order");
const Promotion = require("../models/Promotion");
const Settings = require("../models/Settings");
const { sendEmail, sendTrackingUpdateEmail } = require("../utils/email");
const { getShiprocketToken } = require("../utils/shiprocketToken");
const codCalculator = require("../utils/codCalculator");
const Product = require("../models/Product");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
router.post(
  "/create-razorpay-order",
  protect,
  asyncHandler(async (req, res) => {
    // Fetch settings and check if online payment is enabled
    const settings = await Settings.findOne();
    if (!settings?.onlinePayment?.enabled) {
      res.status(403);
      throw new Error("Online payment is currently disabled by admin.");
    }
    const { amount, currency = "INR" } = req.body;
    if (!amount || amount <= 0) {
      res.status(400);
      throw new Error("Invalid amount");
    }
    const options = {
      amount: amount * 100,
      currency,
      receipt: `order_${Date.now()}`,
    };
    try {
      const order = await razorpay.orders.create(options);
      console.log("Razorpay order created:", order);
      res.json({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error("Razorpay order creation error:", error.message);
      res.status(500);
      throw new Error("Failed to create Razorpay order");
    }
  })
);

// Validate Shiprocket serviceability
const validateShiprocketServiceability = async (postalCode) => {
  try {
    const token = await getShiprocketToken();
    console.log("Checking Shiprocket serviceability:", {
      pickup_postcode: process.env.SHIPROCKET_WAREHOUSE_PINCODE,
      delivery_postcode: postalCode,
      token: token.slice(0, 5) + "...",
    });
    const response = await axios.get("https://apiv2.shiprocket.in/v1/external/courier/serviceability", {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        pickup_postcode: process.env.SHIPROCKET_WAREHOUSE_PINCODE,
        delivery_postcode: postalCode,
        weight: 0.5,
        cod: 0,
      },
    });
    console.log("Shiprocket serviceability response:", JSON.stringify(response.data, null, 2));
    if (!response.data.data?.available_courier_companies?.length) {
      throw new Error("Pincode not serviceable by Shiprocket");
    }
    return response.data.data.available_courier_companies[0];
  } catch (error) {
    console.error("Shiprocket serviceability error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message || "Shiprocket serviceability check failed");
  }
};

// Create Shiprocket order
const createShiprocketOrder = async (order, address, cartItems) => {
  try {
    const token = await getShiprocketToken();
    const nameParts = address.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ".";
    console.log(
      "Creating Shiprocket order for:",
      JSON.stringify(
        {
          orderId: order.orderId,
          subTotal: order.subTotal,
          discount: order.discount,
          total: order.total,
          payment_method: order.payment.method,
          address,
          cartItems,
        },
        null,
        2
      )
    );
    const order_items = cartItems.map((item) => ({
      name: item.name,
      sku: item.sku || item.id,
      units: item.quantity || 1,
      selling_price: item.price,
      weight: 0.5,
      length: 20,
      breadth: 15,
      height: 10,
    }));
    // Calculate the total for Shiprocket (do not add codCharge to product price)
    const shiprocketTotal = order_items.reduce((sum, item) => sum + (item.selling_price * item.units), 0);

    // Debug logs
    console.log('COD Charge:', order.codCharge);
    console.log('Order Items:', JSON.stringify(order_items, null, 2));
    console.log('Shiprocket Total:', shiprocketTotal);
    const shiprocketPayload = {
      order_id: order.orderId,
      order_date: new Date().toISOString().split("T")[0],
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: address.addressLine1,
      billing_address_2: address.addressLine2 || "",
      billing_city: address.city,
      billing_pincode: address.postalCode,
      billing_state: address.state,
      billing_country: address.country,
      billing_email: order.user.email,
      billing_phone: address.phone,
      shipping_is_billing: true,
      order_items,
      payment_method: order.payment.method === 'cod' ? "COD" : "Prepaid",
      sub_total: order.subTotal,
      total_discount: order.discount,
      total: shiprocketTotal + (order.payment.method === 'cod' ? (order.codCharge || 0) : 0),
      length: 20,
      breadth: 15,
      height: 10,
      weight: 0.5,
      ...(order.payment.method === 'cod' && order.codCharge ? { cod_charges: order.codCharge } : {}),
    };
    console.log('Shiprocket Payload:', JSON.stringify(shiprocketPayload, null, 2));
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      shiprocketPayload,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log("Shiprocket order response:", JSON.stringify(response.data, null, 2));
    return { shipment_id: response.data.shipment_id, order_id: response.data.order_id };
  } catch (error) {
    console.error("Shiprocket order creation error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to create Shiprocket order");
  }
};

// Assign AWB
const assignShiprocketAWB = async (shipmentId) => {
  try {
    const token = await getShiprocketToken();
    console.log("Assigning AWB for shipment:", shipmentId);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
      { shipment_id: shipmentId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("AWB assignment response:", JSON.stringify(response.data, null, 2));
    return { awb_code: response.data.data.awb_code, courier_name: response.data.data.courier_name };
  } catch (error) {
    console.error("Shiprocket AWB assignment error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to assign AWB");
  }
};

// Generate Pickup
const generateShiprocketPickup = async (shipmentId) => {
  try {
    const token = await getShiprocketToken();
    console.log("Generating pickup for shipment:", shipmentId);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup",
      { shipment_id: [shipmentId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Pickup generation response:", JSON.stringify(response.data, null, 2));
    return response.data.data;
  } catch (error) {
    console.error("Shiprocket pickup generation error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to generate pickup");
  }
};

// Generate Manifest
const generateShiprocketManifest = async (shipmentId) => {
  try {
    const token = await getShiprocketToken();
    console.log("Generating manifest for shipment:", shipmentId);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/manifests/generate",
      { shipment_id: [shipmentId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Manifest generation response:", JSON.stringify(response.data, null, 2));
    return response.data.data.manifest_url;
  } catch (error) {
    console.error("Shiprocket manifest generation error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to generate manifest");
  }
};

// Print Manifest
const printShiprocketManifest = async (orderId) => {
  try {
    const token = await getShiprocketToken();
    console.log("Printing manifest for order:", orderId);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/manifests/print",
      { order_ids: [orderId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Manifest print response:", JSON.stringify(response.data, null, 2));
    return response.data.data.manifest_url;
  } catch (error) {
    console.error("Shiprocket manifest print error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to print manifest");
  }
};

// Generate Label
const generateShiprocketLabel = async (shipmentId) => {
  try {
    const token = await getShiprocketToken();
    console.log("Generating label for shipment:", shipmentId);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/courier/generate/label",
      { shipment_id: [shipmentId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Label generation response:", JSON.stringify(response.data, null, 2));
    return response.data.data.label_url;
  } catch (error) {
    console.error("Shiprocket label generation error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to generate label");
  }
};

// Print Invoice
const printShiprocketInvoice = async (orderId) => {
  try {
    const token = await getShiprocketToken();
    console.log("Printing invoice for order:", orderId);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/orders/print/invoice",
      { ids: [orderId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Invoice print response:", JSON.stringify(response.data, null, 2));
    return response.data.data.invoice_url;
  } catch (error) {
    console.error("Shiprocket invoice print error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to print invoice");
  }
};

// Track Shipment
const trackShiprocketShipment = async (awbCode) => {
  try {
    const token = await getShiprocketToken();
    console.log("Tracking shipment with AWB:", awbCode);
    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Tracking response:", JSON.stringify(response.data, null, 2));
    return response.data.data;
  } catch (error) {
    console.error("Shiprocket tracking error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to track shipment");
  }
};

// Check COD availability and calculate charges
router.post(
  "/check-cod",
  protect,
  asyncHandler(async (req, res) => {
    const { cartItems, address } = req.body;

    if (!cartItems || cartItems.length === 0) {
      res.status(400);
      throw new Error("No items in cart");
    }

    const subTotal = cartItems.reduce((acc, item) => acc + item.quantity * item.price, 0);

    // Check COD availability
    const codAvailability = await codCalculator.isCodAvailable({
      orderValue: subTotal,
      pincode: address.postalCode,
      state: address.state,
      city: address.city,
      items: cartItems,
      orderTime: new Date()
    });

    if (!codAvailability.available) {
      return res.json({
        available: false,
        reason: codAvailability.reason
      });
    }

    // Calculate COD charge
    const codCharge = await codCalculator.calculateCodCharge({
      orderValue: subTotal,
      pincode: address.postalCode,
      state: address.state,
      city: address.city,
      courierCode: null
    });

    res.json({
      available: true,
      codCharge,
      totalAmount: subTotal + codCharge,
      breakdown: {
        subTotal,
        codCharge,
        total: subTotal + codCharge
      }
    });
  })
);

// Create a new order
router.post(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const {
      cartItems,
      address,
      paymentMethod,
      paymentResult,
      promoCode,
    } = req.body;

    if (!cartItems || cartItems.length === 0) {
      res.status(400);
      throw new Error("No items in cart");
    }

    let subTotal = cartItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
    let discount = 0;
    let codCharge = 0;
    let discountCode = null;

    // Apply promotion
    if (promoCode) {
      const promotion = await Promotion.findOne({ code: promoCode.toUpperCase() });
      if (promotion && promotion.isActive) {
        // Add more validation as needed (dates, usage, etc.)
        if (promotion.discountType === 'percentage') {
          discount = (subTotal * promotion.discountValue) / 100;
        } else {
          discount = promotion.discountValue;
        }
        discountCode = promoCode.toUpperCase();
        // Increment usage count
        promotion.timesUsed += 1;
        await promotion.save();
      }
    }

    // Apply COD charge using advanced calculator
    if (paymentMethod === 'cod') {
      // Check if COD is available
      const codAvailability = await codCalculator.isCodAvailable({
        orderValue: subTotal,
        pincode: address.postalCode,
        state: address.state,
        city: address.city,
        items: cartItems,
        orderTime: new Date()
      });

      if (!codAvailability.available) {
        res.status(400);
        throw new Error(codAvailability.reason);
      }

      // Calculate COD charge
      codCharge = await codCalculator.calculateCodCharge({
        orderValue: subTotal,
        pincode: address.postalCode,
        state: address.state,
        city: address.city,
        courierCode: null // Will be set when courier is selected
      });
    }

    const total = subTotal - discount + codCharge;

    // Ensure each cart item has a valid image URL
    const updatedCartItems = await Promise.all(cartItems.map(async (item) => {
      if (!item.image || !item.image.startsWith('http')) {
        // Fetch product and get its main image
        const product = await Product.findById(item.id);
        if (product && product.images && product.images.length > 0) {
          return { ...item, image: product.images[0].url };
        }
      }
      return item;
    }));

    const order = new Order({
      orderId: `${Date.now()}`,
      user: req.user._id,
      items: updatedCartItems,
      address,
      total,
      subTotal,
      discount,
      codCharge,
      payment: {
        method: paymentMethod,
        paymentId: paymentResult ? paymentResult.id : null,
        status: paymentResult ? paymentResult.status : 'pending',
      },
      discountCode,
    });

    const createdOrder = await order.save();

    // Decrement stock for each product in the order
    for (const item of cartItems) {
      if (item.id && item.quantity) {
        // Decrement the correct variant's stock (by color and size)
        await Product.findOneAndUpdate(
          {
            _id: item.id,
            "variants.color": item.color,
            "variants.size": item.size
          },
          {
            $inc: { "variants.$.stock": -item.quantity }
          },
          { new: true }
        );
      }
    }

    // Populate user details for email
    await createdOrder.populate('user', 'name email');

    // Send order confirmation email
    try {
      const emailHtml = `
        <h1>Thank you for your order!</h1>
        <p>Hi ${createdOrder.user.name},</p>
        <p>We've received your order and will process it shortly.</p>
        <h2>Order Details</h2>
        <p><strong>Order ID:</strong> ${createdOrder.orderId}</p>
        <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Product</th>
              <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Image</th>
              <th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Quantity</th>
              <th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${createdOrder.items.map(item => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.name} (Size: ${item.size}, Color: ${item.color})</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                  ${item.image ? `<img src="${item.image}" alt="${item.name}" style="max-width: 60px; max-height: 60px; border-radius: 6px;" />` : ''}
                </td>
                <td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
                <td style="text-align: right; padding: 8px; border: 1px solid #ddd;">₹${item.price.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 10px;">
          <p><strong>Subtotal:</strong> ₹${createdOrder.subTotal.toFixed(2)}</p>
          ${createdOrder.discount > 0 ? `<p><strong>Discount:</strong> -₹${createdOrder.discount.toFixed(2)}</p>` : ''}
          ${createdOrder.codCharge > 0 ? `<p><strong>COD Charge:</strong> ₹${createdOrder.codCharge.toFixed(2)}</p>` : ''}
          <p><strong>Total:</strong> <strong>₹${createdOrder.total.toFixed(2)}</strong></p>
        </div>
        <h3>Shipping Address:</h3>
        <p>
          ${createdOrder.address.name}<br>
          ${createdOrder.address.addressLine1}<br>
          ${createdOrder.address.addressLine2 ? createdOrder.address.addressLine2 + '<br>' : ''}
          ${createdOrder.address.city}, ${createdOrder.address.state} ${createdOrder.address.postalCode}<br>
          ${createdOrder.address.country}<br>
          Phone: ${createdOrder.address.phone}
        </p>
        <p>Thanks for shopping with us!</p>
      `;

      await sendEmail({
        to: createdOrder.user.email,
        subject: `Your Order ${createdOrder.orderId} is confirmed!`,
        html: emailHtml,
      });
      console.log(`Order confirmation email sent to ${createdOrder.user.email}`);
    } catch (emailError) {
      console.error("Error sending order confirmation email:", emailError);
      // We don't want to fail the request if the email sending fails
    }

    // If COD, we can create the Shiprocket order right away
    /*
    if (paymentMethod === 'cod') {
      try {
        await validateShiprocketServiceability(createdOrder.address.postalCode);
        const shiprocketOrder = await createShiprocketOrder(createdOrder, createdOrder.address, createdOrder.items);
        createdOrder.shipping.shipmentId = shiprocketOrder.shipment_id;
        createdOrder.shipping.shiprocketOrderId = shiprocketOrder.order_id;
        createdOrder.shipping.status = "Processing";
        createdOrder.status = "Confirmed"; 
        await createdOrder.save();
        console.log(`Shiprocket order created for COD order: ${createdOrder.orderId}`);
      } catch (shiprocketError) {
        console.error(`Failed to create Shiprocket order for COD order ${createdOrder.orderId}:`, shiprocketError);
        createdOrder.shipping.status = "Failed";
        await createdOrder.save();
      }
    }
    */

    res.status(201).json(createdOrder);
  })
);

// Endpoint to get order information
router.get(
  "/info/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderId: req.params.orderId, user: req.user._id }).populate('user', 'name email');
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }
    const Product = require("../models/Product");
    const itemsWithImages = await Promise.all(order.items.map(async (item) => {
      let product = null;
      if (item.id) {
        try {
          product = await Product.findById(String(item.id));
        } catch (e) {
          product = null;
        }
      }
      // Fallback: try to find by name and color if id is missing or invalid
      if (!product) {
        const query = { name: item.name };
        if (item.color) query["colors"] = item.color;
        product = await Product.findOne(query);
      }
      let image = "";
      if (product) {
        if (item.color && product.colorImages && product.colorImages.length > 0) {
          const colorObj = product.colorImages.find(ci => ci.color === item.color);
          if (colorObj && colorObj.images && colorObj.images.length > 0) {
            image = colorObj.images[0].url;
          }
        }
        if (!image && product.images && product.images.length > 0) {
          image = product.images[0].url;
        }
      }
      return { ...(item.toObject ? item.toObject() : item), image };
    }));
    res.json({ success: true, order: { ...order.toObject(), items: itemsWithImages } });
  })
);

// Endpoint to track order
router.get(
  "/track/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderId: req.params.orderId, user: req.user._id });
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }
    if (!order.shipping.awbCode) {
      res.status(400);
      throw new Error("AWB not assigned");
    }
    const tracking = await trackShiprocketShipment(order.shipping.awbCode);
    res.json({ success: true, tracking });
  })
);

// Shiprocket webhook endpoint for courier assignment
router.post("/webhook/shiprocket", asyncHandler(async (req, res) => {
  console.log("Shiprocket webhook received:", JSON.stringify(req.body, null, 2));
  
  const { 
    order_id, 
    awb_code, 
    courier_name, 
    courier_id,
    expected_delivery_date,
    pickup_scheduled_date,
    status 
  } = req.body;

  if (!order_id || !awb_code) {
    console.log("Missing required fields in webhook");
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Try to find order by orderId first, then by _id if not found
    let order = await Order.findOne({ "shipping.shiprocketOrderId": order_id });
    
    if (!order) {
      // If not found by orderId, try by _id (MongoDB ObjectId)
      order = await Order.findById(order_id);
    }
    
    if (!order) {
      console.log(`Order not found for Shiprocket order ID: ${order_id}`);
      return res.status(404).json({ error: "Order not found" });
    }

    // Update order with courier and AWB information
    const updateData = {
      "shipping.awbCode": awb_code,
      "shipping.courier": courier_name,
      "shipping.courierId": courier_id,
      "shipping.status": "shipped",
      status: "shipped"
    };

    if (expected_delivery_date) {
      updateData["shipping.expectedDeliveryDate"] = new Date(expected_delivery_date);
    }

    if (pickup_scheduled_date) {
      updateData["shipping.pickupScheduledDate"] = new Date(pickup_scheduled_date);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      updateData,
      { new: true }
    );

    console.log(`Order ${order.orderId} updated with AWB: ${awb_code}`);

    // Send shipping confirmation email to user
    try {
      const emailData = {
        to: order.user.email,
        orderId: order.orderId,
        awbCode: awb_code,
        courierName: courier_name,
        expectedDeliveryDate: expected_delivery_date ? new Date(expected_delivery_date).toLocaleDateString() : "3-5 business days",
        trackingUrl: `https://track.shiprocket.in/track/${awb_code}`,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: order.total,
        address: order.address
      };

      await sendTrackingUpdateEmail(emailData);
      console.log(`Shipping confirmation email sent to ${order.user.email}`);
    } catch (emailError) {
      console.error("Error sending shipping confirmation email:", emailError);
    }

    res.json({ 
      success: true, 
      message: "Order updated successfully",
      orderId: order.orderId 
    });

  } catch (error) {
    console.error("Error processing Shiprocket webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}));

// Test endpoint to simulate Shiprocket webhook
router.post("/test-webhook/:orderId", asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  // Find order by orderId
  const order = await Order.findOne({ orderId });
  
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Simulate webhook payload
  const webhookPayload = {
    order_id: order.shipping?.shiprocketOrderId || "test_order_id",
    awb_code: "TEST" + Math.random().toString(36).substr(2, 8).toUpperCase(),
    courier_name: "Test Courier",
    courier_id: "test_courier_123",
    expected_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    pickup_scheduled_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    status: "shipped"
  };

  console.log("Simulating webhook with payload:", webhookPayload);

  // Process the webhook
  try {
    // Try to find order by orderId first, then by _id if not found
    let order = await Order.findOne({ "shipping.shiprocketOrderId": webhookPayload.order_id });
    
    if (!order) {
      // If not found by orderId, try by _id (MongoDB ObjectId)
      order = await Order.findById(webhookPayload.order_id);
    }
    
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Update order with courier and AWB information
    const updateData = {
      "shipping.awbCode": webhookPayload.awb_code,
      "shipping.courier": webhookPayload.courier_name,
      "shipping.courierId": webhookPayload.courier_id,
      "shipping.status": "shipped",
      status: "shipped"
    };

    if (webhookPayload.expected_delivery_date) {
      updateData["shipping.expectedDeliveryDate"] = new Date(webhookPayload.expected_delivery_date);
    }

    if (webhookPayload.pickup_scheduled_date) {
      updateData["shipping.pickupScheduledDate"] = new Date(webhookPayload.pickup_scheduled_date);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      updateData,
      { new: true }
    );

    console.log(`Order ${order.orderId} updated with AWB: ${webhookPayload.awb_code}`);

    // Send email to user with tracking information
    try {
      const emailData = {
        to: order.user.email,
        orderId: order.orderId,
        awbCode: webhookPayload.awb_code,
        courierName: webhookPayload.courier_name,
        expectedDeliveryDate: webhookPayload.expected_delivery_date ? new Date(webhookPayload.expected_delivery_date).toLocaleDateString() : "3-5 business days",
        trackingUrl: `https://track.shiprocket.in/track/${webhookPayload.awb_code}`,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: order.total,
        address: order.address
      };

      await sendTrackingUpdateEmail(emailData);
      console.log(`Tracking email sent to ${order.user.email}`);
    } catch (emailError) {
      console.error("Error sending tracking email:", emailError);
    }

    res.json({ 
      success: true, 
      message: "Test webhook processed successfully",
      orderId: order.orderId,
      awbCode: webhookPayload.awb_code,
      courierName: webhookPayload.courier_name,
      expectedDeliveryDate: webhookPayload.expected_delivery_date
    });

  } catch (error) {
    console.error("Error processing test webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}));

// Admin endpoint to get all orders
router.get(
  "/admin/all",
  protect,
  asyncHandler(async (req, res) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }

    const orders = await Order.find({})
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders: orders
    });
  })
);

// Endpoint to request order cancellation
router.post(
  "/request-cancellation/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const { orderId } = req.params;

    if (!reason || !reason.trim()) {
      res.status(400);
      throw new Error("Cancellation reason is required");
    }

    // Try to find order by orderId first, then by _id if not found
    let order = await Order.findOne({ orderId }).populate('user', 'name email');
    if (!order) {
      // If not found by orderId, try by _id (MongoDB ObjectId)
      order = await Order.findById(orderId).populate('user', 'name email');
    }
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Check if order can be cancelled
    const shippedStatuses = ["shipped", "in_transit", "out_for_delivery", "delivered"];
    
    if (order.status && shippedStatuses.includes(order.status.toLowerCase())) {
      res.status(400);
      throw new Error("Cannot cancel shipped orders");
    }

    if (order.shipping?.status && shippedStatuses.includes(order.shipping.status.toLowerCase())) {
      res.status(400);
      throw new Error("Cannot cancel shipped orders");
    }

    if (order.shipping?.awbCode) {
      res.status(400);
      throw new Error("Cannot cancel orders with AWB assigned");
    }

    if (order.cancellationRequested) {
      res.status(400);
      throw new Error("Cancellation already requested for this order");
    }

    // Update order with cancellation request
    order.cancellationRequested = true;
    order.cancellationRequestedAt = new Date();
    order.cancellationReason = reason.trim();
    await order.save();

    // Send email to admin about cancellation request
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fff3cd; color: #856404; padding: 20px; border-radius: 8px; border: 1px solid #ffeaa7;">
            <h2 style="margin: 0; color: #856404;">🔄 Order Cancellation Request</h2>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #333; margin-top: 0;">Order Details</h3>
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Customer:</strong> ${order.user.name} (${order.user.email})</p>
            <p><strong>Total Amount:</strong> ₹${order.total}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
            
            <h3 style="color: #333;">Cancellation Reason</h3>
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
              <p style="margin: 0; font-style: italic;">"${reason.trim()}"</p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 5px;">
              <p style="margin: 0; color: #0c5460;">
                <strong>Action Required:</strong> Please review this cancellation request in the admin panel.
              </p>
            </div>
          </div>
        </div>
      `;

      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@example.com',
        subject: `Cancellation Request - Order #${order.orderId}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Error sending cancellation request email:", emailError);
    }

    res.json({
      success: true,
      message: "Cancellation request submitted successfully. Admin will review your request."
    });
  })
);

// Admin endpoint to approve/reject cancellation request
router.post(
  "/admin/cancellation/:orderId/:action",
  protect,
  asyncHandler(async (req, res) => {
    const { orderId, action } = req.params;
    const { adminReason } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }

    if (!["approve", "reject"].includes(action)) {
      res.status(400);
      throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }

    // Try to find order by orderId first, then by _id if not found
    let order = await Order.findOne({ orderId }).populate('user', 'name email');
    if (!order) {
      // If not found by orderId, try by _id (MongoDB ObjectId)
      order = await Order.findById(orderId).populate('user', 'name email');
    }
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (!order.cancellationRequested) {
      res.status(400);
      throw new Error("No cancellation request found for this order");
    }

    if (action === "approve") {
      // Cancel the order
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.adminCancellationReason = adminReason || "Cancelled by admin";
      
      // If order has Shiprocket order, cancel it there too
      if (order.shipping?.shiprocketOrderId) {
        try {
          const token = await getShiprocketToken();
          await axios.post(
            `https://apiv2.shiprocket.in/v1/external/orders/cancel`,
            {
              ids: [order.shipping.shiprocketOrderId]
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          console.log(`Shiprocket order ${order.shipping.shiprocketOrderId} cancelled`);
        } catch (error) {
          console.error("Error cancelling Shiprocket order:", error);
          // Continue with local cancellation even if Shiprocket fails
        }
      }

      // Send cancellation email to user
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background: #f6f8fa;">
            <div style="background: #f44336; color: #fff; padding: 28px 0 18px 0; border-radius: 12px 12px 0 0; text-align: center;">
              <img src='https://cdn-icons-png.flaticon.com/512/753/753345.png' alt='Cancelled' style='width: 48px; height: 48px; margin-bottom: 8px;' />
              <h1 style="margin: 0; font-size: 2rem; letter-spacing: 1px;">Order Cancelled</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px #0001; padding: 32px 24px 24px 24px;">
              <p style="font-size: 1.1rem; color: #333; margin-top: 0;">Hi <strong>${order.user?.name || "Customer"}</strong>,<br>Your order has been cancelled. If you have already paid, your refund will be processed soon.</p>
              <h2 style="margin: 24px 0 12px 0; color: #f44336; font-size: 1.2rem;">Order Summary</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
                <thead>
                  <tr style="background: #f6f8fa;">
                    <th style="padding: 8px; border: 1px solid #eee; text-align: left;">Product</th>
                    <th style="padding: 8px; border: 1px solid #eee; text-align: center;">Image</th>
                    <th style="padding: 8px; border: 1px solid #eee; text-align: right;">Qty</th>
                    <th style="padding: 8px; border: 1px solid #eee; text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.items?.map(item => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #eee;">${item.name} ${item.size ? `(Size: ${item.size})` : ''} ${item.color ? `(Color: ${item.color})` : ''}</td>
                      <td style="padding: 8px; border: 1px solid #eee; text-align: center;">
                        ${item.image ? `<img src="${item.image}" alt="${item.name}" style="max-width: 48px; max-height: 48px; border-radius: 6px;" />` : ''}
                      </td>
                      <td style="padding: 8px; border: 1px solid #eee; text-align: right;">${item.quantity}</td>
                      <td style="padding: 8px; border: 1px solid #eee; text-align: right;">₹${item.price.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div style="text-align: right; margin-bottom: 18px;">
                <p style="margin: 0 0 4px 0;"><strong>Order ID:</strong> ${order.orderId}</p>
                <p style="margin: 0 0 4px 0;"><strong>Total Amount:</strong> ₹${order.total}</p>
                <p style="margin: 0 0 4px 0;"><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              <h3 style="color: #f44336; margin-bottom: 8px;">Cancellation Details</h3>
              <p style="margin: 0 0 4px 0;"><strong>Your Reason:</strong> ${order.cancellationReason}</p>
              <p style="margin: 0 0 4px 0;"><strong>Admin Response:</strong> ${adminReason || "Cancellation approved"}</p>
              <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 5px;">
                <p style="margin: 0; color: #388e3c;">
                  <strong>Refund Information:</strong> Your payment will be refunded within 5-7 business days.
                </p>
              </div>
              <div style="margin-top: 24px; text-align: center; color: #888; font-size: 0.98rem;">
                <p style="margin: 0;">Need help? <a href="mailto:support@example.com" style="color: #f44336; text-decoration: underline;">Contact our support team</a></p>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: order.user.email,
          subject: `Order Cancelled - #${order.orderId}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Error sending cancellation email:", emailError);
      }

    } else {
      // Reject the cancellation request
      order.cancellationRequested = false;
      order.cancellationRequestedAt = null;
      order.cancellationReason = null;
      order.adminCancellationReason = adminReason || "Cancellation request rejected";

      // Send rejection email to user
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #fff3cd; color: #856404; padding: 20px; border-radius: 8px; border: 1px solid #ffeaa7;">
              <h2 style="margin: 0; color: #856404;">⚠️ Cancellation Request Rejected</h2>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
              <h3 style="color: #333; margin-top: 0;">Order Details</h3>
              <p><strong>Order ID:</strong> ${order.orderId}</p>
              <p><strong>Total Amount:</strong> ₹${order.total}</p>
              
              <h3 style="color: #333;">Cancellation Request</h3>
              <p><strong>Your Reason:</strong> ${order.cancellationReason}</p>
              <p><strong>Admin Response:</strong> ${adminReason || "Cancellation request rejected"}</p>
              
              <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 5px;">
                <p style="margin: 0; color: #0c5460;">
                  <strong>Next Steps:</strong> Your order will continue to be processed as normal.
                </p>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: order.user.email,
          subject: `Cancellation Request Rejected - #${order.orderId}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Error sending rejection email:", emailError);
      }
    }

    await order.save();

    res.json({
      success: true,
      message: `Cancellation request ${action}ed successfully`,
      order: order
    });
  })
);

// Admin endpoint to directly cancel order
router.post(
  "/admin/cancel/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }

    if (!reason || !reason.trim()) {
      res.status(400);
      throw new Error("Cancellation reason is required");
    }

    // Try to find order by orderId first, then by _id if not found
    let order = await Order.findOne({ orderId }).populate('user', 'name email');
    if (!order) {
      // If not found by orderId, try by _id (MongoDB ObjectId)
      order = await Order.findById(orderId).populate('user', 'name email');
    }
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Cancel the order
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.adminCancellationReason = reason.trim();
    
    // If order has Shiprocket order, cancel it there too
    if (order.shipping?.shiprocketOrderId) {
      try {
        const token = await getShiprocketToken();
        await axios.post(
          `https://apiv2.shiprocket.in/v1/external/orders/cancel`,
          {
            ids: [order.shipping.shiprocketOrderId]
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log(`Shiprocket order ${order.shipping.shiprocketOrderId} cancelled`);
      } catch (error) {
        console.error("Error cancelling Shiprocket order:", error);
        // Continue with local cancellation even if Shiprocket fails
      }
    }

    await order.save();

    // Send cancellation email to user
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f8fa;">
          <h1 style="color: #14532d; font-size: 2rem; margin-bottom: 0.5em;">Your Order is Cancelled</h1>
          <p style="font-size: 1.1rem; color: #333; margin-top: 0;">Hi <strong>${order.user?.name || "Customer"}</strong>,<br>Your order has been cancelled by our team. If you have already paid, your refund will be processed soon.</p>
          <h2 style="color: #14532d; font-size: 1.1rem; margin-top: 2em;">Order Details</h2>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          <p><strong>Total Amount:</strong> ₹${order.total}</p>
          <p><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
          <h3 style="color: #14532d; margin-bottom: 0.5em;">Cancellation Reason</h3>
          <p style="background: #e6f4ea; padding: 10px 14px; border-radius: 5px; color: #14532d; font-style: italic;">${reason.trim()}</p>
          <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 5px; color: #14532d;">
            <p style="margin: 0;">
              <strong>Refund Information:</strong> Your payment will be refunded within 5-7 business days.
            </p>
          </div>
          <div style="margin-top: 24px; text-align: center; color: #888; font-size: 0.98rem;">
            <p style="margin: 0;">Need help? <a href="mailto:support@example.com" style="color: #14532d; text-decoration: underline;">Contact our support team</a></p>
          </div>
        </div>
      `;

      await sendEmail({
        to: order.user.email,
        subject: `Order Cancelled by Admin - #${order.orderId}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Error sending cancellation email:", emailError);
    }

    res.json({
      success: true,
      message: "Order cancelled successfully and removed from Shiprocket",
      order: order
    });
  })
);

// Admin endpoint to create Shiprocket order for any order
router.post(
  "/admin/create-shiprocket-any/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }

    const order = await Order.findOne({ orderId }).populate('user', 'name email phone');
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Check if Shiprocket order already exists
    if (order.shipping?.shiprocketOrderId) {
      res.status(400);
      throw new Error("Shiprocket order already exists for this order");
    }

    try {
      // Validate Shiprocket serviceability
      const courier = await validateShiprocketServiceability(order.address.postalCode);
      console.log("Shiprocket courier:", courier);

      // Add this log to inspect the order object
      console.log("Order object being passed to createShiprocketOrder:", JSON.stringify(order, null, 2));

      // Create Shiprocket order
      const { shipment_id, order_id } = await createShiprocketOrder(order, order.address, order.items);
      
      // Update order with Shiprocket details
      order.shipping.shipmentId = shipment_id;
      order.shipping.shiprocketOrderId = order_id;
      order.shipping.courier = courier.courier_name;
      order.status = "confirmed";
      order.shipping.status = "Processing";
      await order.save();

      console.log("Shiprocket order created:", { shipment_id, order_id });

      // Send email to user about order confirmation
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">✅ Order Confirmed!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Order #${order.orderId}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">📦 Order Processing Started</h2>
                <p style="color: #666; margin: 10px 0;">
                  Your order has been confirmed and is now being processed for shipment. 
                  You will receive tracking information once the courier is assigned.
                </p>
              </div>
              
              <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h3 style="color: #333; margin-top: 0;">📋 Order Details</h3>
                <div style="margin: 15px 0;">
                  ${order.items.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                      <div>
                        <strong>${item.name}</strong><br>
                        <small style="color: #666;">Qty: ${item.quantity}</small>
                      </div>
                      <div style="text-align: right;">
                        <strong>₹${item.price}</strong>
                      </div>
                    </div>
                  `).join('')}
                  <div style="display: flex; justify-content: space-between; padding: 15px 0; border-top: 2px solid #667eea; font-weight: bold; font-size: 18px;">
                    <span>Total:</span>
                    <span>₹${order.total}</span>
                  </div>
                </div>
              </div>
              
              <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h3 style="color: #333; margin-top: 0;">📍 Delivery Address</h3>
                <p style="margin: 10px 0; line-height: 1.6;">
                  ${order.address.name}<br>
                  ${order.address.addressLine1}${order.address.addressLine2 ? `, ${order.address.addressLine2}` : ''}<br>
                  ${order.address.city}, ${order.address.state} - ${order.address.postalCode}<br>
                  ${order.address.country}
                </p>
              </div>
              
              <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; text-align: center;">
                <h3 style="color: #0c5460; margin-top: 0;">⏰ Next Steps</h3>
                <p style="color: #0c5460; margin: 10px 0;">
                  Your order is being prepared for shipment. You will receive tracking information 
                  with AWB code and expected delivery date once the courier is assigned.
                </p>
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/track/${order.orderId}" 
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; margin-top: 15px;">
                  Track Your Order
                </a>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: order.user.email,
          subject: `Order Confirmed & Processing - #${order.orderId}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
      }

      res.json({
        success: true,
        message: "Shiprocket order created successfully. Order is now being processed for shipment.",
        shiprocketOrderId: order_id,
        shipmentId: shipment_id
      });

    } catch (error) {
      console.error("Error creating Shiprocket order:", error);
      res.status(500);
      throw new Error("Failed to create Shiprocket order: " + error.message);
    }
  })
);

// Admin endpoint to get courier service options
router.get(
  "/admin/courier-options/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }

    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    try {
      const token = await getShiprocketToken();
      
      // Get courier service options from Shiprocket
      const response = await axios.get(
        "https://apiv2.shiprocket.in/v1/external/courier/serviceability",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            pickup_postcode: process.env.SHIPROCKET_WAREHOUSE_PINCODE,
            delivery_postcode: order.address.postalCode,
            weight: 0.5,
            cod: 0,
          },
        }
      );

      console.log("Shiprocket courier options response:", JSON.stringify(response.data, null, 2));
      
      if (!response.data.data?.available_courier_companies?.length) {
        throw new Error("No courier services available for this route");
      }

      res.json({
        success: true,
        message: "Courier service options retrieved successfully",
        orderId: order.orderId,
        pickupPincode: process.env.SHIPROCKET_WAREHOUSE_PINCODE,
        deliveryPincode: order.address.postalCode,
        courierOptions: response.data.data.available_courier_companies
      });
    } catch (error) {
      console.error("Error getting Shiprocket courier options:", error);
      res.status(500);
      throw new Error("Failed to get courier service options: " + error.message);
    }
  })
);

// Test email endpoint
router.post("/test-email", protect, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("Access denied. Admin only.");
  }

  const { to, subject, message } = req.body;

  try {
    const testEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🧪 Email Test</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Test Email Configuration</h2>
            <p style="color: #666; margin: 10px 0;">
              This is a test email to verify that your email configuration is working correctly.
            </p>
            ${message ? `<p style="color: #333; margin: 10px 0;"><strong>Custom Message:</strong> ${message}</p>` : ''}
          </div>
          
          <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="color: #0c5460; margin-top: 0;">✅ Email System Working</h3>
            <p style="color: #0c5460; margin: 10px 0;">
              If you received this email, your email configuration is working properly!
            </p>
            <p style="color: #0c5460; margin: 10px 0; font-size: 12px;">
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await sendEmail({
      to: to || req.user.email,
      subject: subject || "Email Configuration Test",
      html: testEmailHtml,
    });

    res.json({
      success: true,
      message: "Test email sent successfully",
      to: to || req.user.email
    });

  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send test email: " + error.message,
      details: {
        emailUser: process.env.EMAIL_USER ? 'Set' : 'Not Set',
        emailPass: process.env.EMAIL_PASS ? 'Set' : 'Not Set',
        emailHost: process.env.EMAIL_HOST || 'Not Set',
        emailPort: process.env.EMAIL_PORT || 'Not Set'
      }
    });
  }
}));

// Add to Shiprocket endpoint
router.post(
  "/admin/add-to-shiprocket/:orderId",
  protect,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }

    // Try to find order by orderId first, then by _id if not found
    let order = await Order.findOne({ orderId }).populate('user', 'name email phone');
    if (!order) {
      // If not found by orderId, try by _id (MongoDB ObjectId)
      order = await Order.findById(orderId).populate('user', 'name email phone');
    }
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.shipping?.shiprocketOrderId) {
      return res.status(400).json({ success: false, message: "Order has already been added to Shiprocket" });
    }

    console.log("Order data being sent to Shiprocket:", JSON.stringify(order, null, 2)); // DEBUG LOG
    const shiprocketOrder = await createShiprocketOrder(order, order.address, order.items);
    
    order.shipping = {
      ...order.shipping,
      shiprocketOrderId: shiprocketOrder.order_id,
      shipmentId: shiprocketOrder.shipment_id,
      status: "Processing",
    };
    
    await order.save();

    res.json({
      success: true,
      message: "Order successfully added to Shiprocket",
      shiprocketOrderId: shiprocketOrder.order_id,
      shipmentId: shiprocketOrder.shipment_id
    });

  })
);

router.put(
  "/online-payment",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Access denied. Admin only.");
    }
    const { onlinePayment } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ onlinePayment });
    } else {
      settings.onlinePayment = onlinePayment;
    }
    await settings.save();
    res.json({ success: true, message: "Online payment settings updated" });
  })
);

// Endpoint to fetch only discount and discountCode for a given order
router.get('/discount/:orderId', asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  res.json({
    success: true,
    orderId: order.orderId,
    discount: order.discount,
    discountCode: order.discountCode || null
  });
}));

// Test endpoint to get online payment status
router.get("/online-payment-status", asyncHandler(async (req, res) => {
  const settings = await Settings.findOne();
  res.json({ enabled: !!settings?.onlinePayment?.enabled });
}));

module.exports = router;