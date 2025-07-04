// ecommerce-backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const {sendOtpEmail} = require("../utils/sendemail");
const asyncHandler = require("express-async-handler");

const jwtSecret = process.env.JWT_SECRET;

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, jwtSecret, {
    expiresIn: "168h",
  });

  res.cookie("token", token, {
    maxAge: 604800000, // 7 days
    path: "/", // Ensure cookie is available for all routes
  });

};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};



router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    let userExists = await User.findOne({ email });

    if (userExists) {
      if (userExists.emailVerified) {
        res.status(400);
        throw new Error("This email is already registered and verified. Please log in.");
      } else {
        userExists.name = name;
        userExists.phone = phone;
        userExists.password = password;

        const otp = generateOtp();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        userExists.otp = otp;
        userExists.otpExpires = otpExpires;
        userExists.emailVerified = false;

        await userExists.save();

        await sendOtpEmail(userExists.email, userExists.name, otp, "Re-verify Your Email - OTP");

        return res.status(200).json({
          success: true,
          message: "Your account exists but is not verified. A new OTP has been sent.",
          userId: userExists._id,
          email: userExists.email,
        });
      }
    }

    let userExistsByPhone = await User.findOne({ phone });
    if (userExistsByPhone) {
      res.status(400);
      throw new Error("This phone number is already registered.");
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    const user = new User({
      name,
      email,
      password,
      phone,
      emailVerified: false,
      otp,
      otpExpires,
    });

    await user.save();

    await sendOtpEmail(user.email, user.name, otp, "Verify Your Email - OTP");

    res.status(201).json({
      success: true,
      message: "Registration successful! An OTP has been sent to your email.",
      userId: user._id,
      email: user.email,
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    console.log(`Login attempt for ${email}`);

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      console.error(`Login failed for ${email}: Invalid credentials`);
      res.status(400);
      throw new Error("Invalid email or password.");
    }

    if (!user.emailVerified) {
      console.log(`Login for ${email} requires OTP verification`);
      res.status(401).json({
        success: false,
        message: "Your email is not verified. Please verify using OTP.",
        requiresOtpVerification: true,
        userId: user._id,
        email: user.email,
      });
      return;
    }

    const token = generateToken(res, user._id);

    res.json({
      success: true,
      message: "Login successful!",
      token, // Debug: Remove in production
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  })
);

router.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      console.error(`OTP verification failed: User not found for ID ${userId}`);
      res.status(404);
      throw new Error("User not found.");
    }

    if (user.emailVerified) {
      const token = generateToken(res, user._id);
      return res.status(200).json({
        success: true,
        message: "Your email is already verified, and you are logged in.",
        token, // Debug
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
      });
    }

    if (!user.otp || user.otp !== otp) {
      console.error(`OTP verification failed for user ${userId}: Invalid OTP`);
      res.status(400);
      throw new Error("Invalid OTP.");
    }

    if (user.otpExpires < Date.now()) {
      console.error(`OTP verification failed for user ${userId}: OTP expired`);
      res.status(400);
      throw new Error("OTP has expired. Please request a new OTP.");
    }

    user.emailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(res, user._id);

    res.json({
      success: true,
      message: "Email successfully verified, and you are logged in!",
      token, // Debug
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  })
);

router.post(
  "/resend-otp",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      console.error(`Resend OTP failed: User not found for email ${email}`);
      res.status(404);
      throw new Error("User not found.");
    }

    if (user.emailVerified) {
      return res.status(200).json({ success: true, message: "Email is already verified. Please log in." });
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await sendOtpEmail(user.email, user.name, otp, "Email Verification - New OTP");

    res.status(200).json({ success: true, message: `A new OTP has been sent to ${user.email}.` });
  })
);

router.post(
  "/logout",
  (req, res) => {
    res.cookie("token", "", {
      expires: new Date(0),
    });
    console.log("User logged out, token cleared");
    res.status(200).json({ message: "Successfully logged out." });
  }
);

module.exports = router;