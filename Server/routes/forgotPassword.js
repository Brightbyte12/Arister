const express = require("express");
const router = express.Router();
const User = require("../models/User");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");

// Configure your transporter (update with your SMTP/email service)
const transporter = require("../config/emailTransporter");

// Request password reset
router.post("/forgot", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  // Generate token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.resetPasswordToken = resetTokenHash;
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();

  // Send email
  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/forgotpassword/reset/${resetToken}`;
  await transporter.sendMail({
    to: user.email,
    subject: "Password Reset Request",
    html: `<p>You requested a password reset. <a href="${resetUrl}">Click here to reset your password</a>. This link is valid for 1 hour.</p>`
  });

  res.json({ message: "Password reset link sent to your email." });
});

// Reset password
router.post("/reset/:token", async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) return res.status(400).json({ message: "All fields are required" });
  if (newPassword !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
  if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

  const resetTokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: resetTokenHash,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) return res.status(400).json({ message: "Invalid or expired token" });

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successful. You can now log in." });
});

module.exports = router;
