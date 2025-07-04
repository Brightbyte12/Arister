// ecommerce-backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const jwtSecret = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  let token = req.cookies.token;

  if (!token) {
    console.error(`No token provided in request: ${req.method} ${req.originalUrl}`, {
      cookies: req.cookies,
      headers: req.headers,
      body: req.body,
    });
    return res.status(401).json({ success: false, message: "Not authorized, no token provided." });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      console.error(`User not found for token ID ${decoded.id}`);
      return res.status(401).json({ success: false, message: "User not found. Invalid token." });
    }

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid token, not authorized." });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    console.error(`Admin access denied for user ${req.user?._id}`);
    res.status(403).json({ success: false, message: "You are not authorized as an admin." });
  }
};

const requireEmailVerification = (req, res, next) => {
  if (req.user && req.user.emailVerified) {
    next();
  } else {
    console.error(`Email verification required for user ${req.user?._id}`);
    res.status(403).json({ success: false, message: "Please verify your email to use this feature." });
  }
};

module.exports = { protect, admin, requireEmailVerification };