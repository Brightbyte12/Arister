// ecommerce-backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const User = require("../models/User");
const Order = require("../models/order");
const asyncHandler = require("express-async-handler");
const Product = require('../models/Product');

router.get(
  "/profile",
  protect,
  async (req, res) => {
    try {
      res.json({
        success: true,
        user: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
          role: req.user.role,
          emailVerified: req.user.emailVerified,
          createdAt: req.user.createdAt,
        },
      });
    } catch (error) {
      console.error(`Error fetching profile for user ${req.user._id}:`, error);
      res.status(500).json({ success: false, message: "Failed to retrieve profile." });
    }
  }
);



router.put(
  "/profile",
  protect,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.phone = req.body.phone || user.phone;

        if (req.body.password) {
          user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
          success: true,
          user: {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            role: updatedUser.role,
            emailVerified: updatedUser.emailVerified,
            createdAt: updatedUser.createdAt,
          },
          message: "Profile successfully updated.",
        });
      } else {
        console.error(`Profile update failed: User not found for ID ${req.user._id}`);
        res.status(404).json({ success: false, message: "User not found." });
      }
    } catch (error) {
      console.error(`Error updating profile for user ${req.user._id}:`, error);
      res.status(500).json({ success: false, message: "Failed to update profile." });
    }
  }
);

router.get('/orders', protect, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  const ordersWithImages = await Promise.all(orders.map(async (order) => {
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
    return { ...order.toObject(), items: itemsWithImages };
  }));
  res.json({ success: true, orders: ordersWithImages });
}));

router.get( "/",protect,admin,
  async (req, res) => {
    try {
      const users = await User.find({}).select("-password");
      res.json({ success: true, users });
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ success: false, message: "Failed to retrieve users." });
    }
  }
);



module.exports = router;