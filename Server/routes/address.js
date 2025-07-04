const express = require("express");
const router = express.Router();
const User = require("../models/User");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const { protect } = require("../middleware/authMiddleware");

// Rate limiter
const addressRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many address requests. Please try again later.",
  keyGenerator: (req) => req.user._id.toString(),
});

// Ensure single default address
const ensureSingleDefaultAddress = (addresses) => {
  const defaultCount = addresses.filter(addr => addr.isDefault).length;
  if (defaultCount > 1) {
    let firstDefaultFound = false;
    addresses.forEach(addr => {
      if (addr.isDefault && !firstDefaultFound) {
        firstDefaultFound = true;
      } else {
        addr.isDefault = false;
      }
    });
  } else if (defaultCount === 0 && addresses.length > 0) {
    addresses[0].isDefault = true;
  }
};

// Validate pincode
const validatePincode = async (pincode, city, state) => {
  try {
    if (!city || typeof city !== "string") throw new Error("City must be a valid string.");
    if (!state || typeof state !== "string") throw new Error("State must be a valid string.");
    const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
    console.log("Pincode validation response:", JSON.stringify(response.data, null, 2));
    if (response.data[0].Status !== "Success" || !response.data[0].PostOffice) {
      throw new Error("Invalid pincode");
    }
    const postOffice = response.data[0].PostOffice[0];
    if (!postOffice.City && !postOffice.District && !postOffice.State) {
      throw new Error("Invalid pincode data: Missing City, District, or State");
    }
    if (
      postOffice.City?.toLowerCase() !== city.toLowerCase() &&
      postOffice.District?.toLowerCase() !== city.toLowerCase()
    ) {
      throw new Error(`City does not match pincode: expected ${postOffice.City || postOffice.District}, got ${city}`);
    }
    if (postOffice.State?.toLowerCase() !== state.toLowerCase()) {
      throw new Error(`State does not match pincode: expected ${postOffice.State}, got ${state}`);
    }
    return true;
  } catch (error) {
    throw new Error(error.message || "Pincode validation failed");
  }
};

// Pincode route (protected)
router.get("/pincode/:pincode", protect, asyncHandler(async (req, res) => {
  const { pincode } = req.params;
  console.log("Fetching pincode:", pincode);
  if (!/^\d{6}$/.test(pincode)) {
    res.status(400);
    throw new Error("Invalid pincode format");
  }
  try {
    const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
    console.log("Pincode API response:", JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    console.error("Pincode API error:", error.message);
    res.status(500).json({ error: "Failed to fetch pincode data" });
  }
}));

// Get all addresses
router.get("/address", protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  ensureSingleDefaultAddress(user.addresses);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
}));

// Add address
router.post("/address", protect, addressRateLimiter, asyncHandler(async (req, res) => {
  const { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = req.body;
  await validatePincode(postalCode, city, state);
  const user = await User.findById(req.user._id);
  const newAddress = { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault };
  if (isDefault) user.addresses.forEach((addr) => (addr.isDefault = false));
  user.addresses.push(newAddress);
  ensureSingleDefaultAddress(user.addresses);
  await user.save();
  res.status(201).json({ success: true, address: user.addresses[user.addresses.length - 1] });
}));

// Update address
router.put("/address/:addressId", protect, addressRateLimiter, asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = req.body;
  await validatePincode(postalCode, city, state);
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(addressId);
  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }
  address.set({ name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault });
  if (isDefault) user.addresses.forEach((addr) => { if (addr._id.toString() !== addressId) addr.isDefault = false; });
  ensureSingleDefaultAddress(user.addresses);
  await user.save();
  res.json({ success: true, address });
}));

// Delete address
router.delete("/address/:addressId", protect, asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(addressId);
  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }
  user.addresses.pull(addressId);
  ensureSingleDefaultAddress(user.addresses);
  await user.save();
  res.json({ success: true, message: "Address deleted" });
}));

module.exports = router;