const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const Settings = require("../models/Settings");
const { cloudinary } = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Multer storage for brand logo
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'brand',
    format: 'png',
    public_id: (req, file) => 'logo',
  },
});

const uploadLogo = multer({ storage: logoStorage });

router.get("/", protect, admin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    // Return all settings, including brand info
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch settings." });
  }
});

router.post("/brand", protect, admin, uploadLogo.single('brandLogo'), async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (req.body.brandName) {
      settings.brandName = req.body.brandName;
    }

    if (req.body.logoWidth) {
      settings.logoWidth = Number(req.body.logoWidth);
    }

    if (req.body.brandFont) {
      settings.brandFont = req.body.brandFont;
    }

    if (req.file) {
      settings.brandLogo = req.file.path; // URL from Cloudinary
    } else if (req.body.brandLogo === '') {
      settings.brandLogo = ''; // Handle logo removal
    }

    settings.updatedBy = req.user._id;
    settings.updatedAt = Date.now();
    
    await settings.save();

    res.json({
      success: true,
      message: "Brand identity updated successfully.",
      brandName: settings.brandName,
      brandLogo: settings.brandLogo,
      logoWidth: settings.logoWidth,
      brandFont: settings.brandFont
    });
  } catch (error) {
    console.error("Error updating brand identity:", error);
    res.status(500).json({ success: false, message: "Failed to update brand identity." });
  }
});

// This route is now more focused on theme
router.post("/", protect, admin, async (req, res) => {
  try {
    console.log("Saving settings by user:", req.user.email, "Data:", req.body);
    let settings = await Settings.findOne();
    const { theme, background, foreground, primary, primaryForeground, secondary, secondaryForeground, accent, accentForeground, border, input, ring, hsl } = req.body;
    if (settings) {
      settings.theme = theme || settings.theme;
      settings.background = { hex: background, hsl: hsl.background };
      settings.foreground = { hex: foreground, hsl: hsl.foreground };
      settings.primary = { hex: primary, hsl: hsl.primary };
      settings.primaryForeground = { hex: primaryForeground, hsl: hsl.primaryForeground };
      settings.secondary = { hex: secondary, hsl: hsl.secondary };
      settings.secondaryForeground = { hex: secondaryForeground, hsl: hsl.secondaryForeground };
      settings.accent = { hex: accent, hsl: hsl.accent };
      settings.accentForeground = { hex: accentForeground, hsl: hsl.accentForeground };
      settings.border = { hex: border, hsl: hsl.border };
      settings.input = { hex: input, hsl: hsl.input };
      settings.ring = { hex: ring, hsl: hsl.ring };
      settings.updatedBy = req.user._id;
      settings.updatedAt = Date.now();
      await settings.save();
    } else {
      settings = await Settings.create({
        theme: theme || "light",
        background: { hex: background || "#FDF6E3", hsl: hsl.background || "60 40% 91%" },
        foreground: { hex: foreground || "#355E3B", hsl: hsl.foreground || "150 20% 21%" },
        primary: { hex: primary || "#355E3B", hsl: hsl.primary || "150 20% 21%" },
        primaryForeground: { hex: primaryForeground || "#FDF6E3", hsl: hsl.primaryForeground || "60 40% 91%" },
        secondary: { hex: secondary || "#EAD9B3", hsl: hsl.secondary || "36 30% 82%" },
        secondaryForeground: { hex: secondaryForeground || "#355E3B", hsl: hsl.secondaryForeground || "150 20% 21%" },
        accent: { hex: accent || "#8B5A2B", hsl: hsl.accent || "25 40% 51%" },
        accentForeground: { hex: accentForeground || "#355E3B", hsl: hsl.accentForeground || "150 20% 21%" },
        border: { hex: border || "#4A2C0E", hsl: hsl.border || "25 76% 31%" },
        input: { hex: input || "#EAD9B3", hsl: hsl.input || "36 30% 82%" },
        ring: { hex: ring || "#355E3B", hsl: hsl.ring || "150 20% 21%" },
        updatedBy: req.user._id,
      });
    }
    // Return flattened settings
    res.json({
      theme: settings.theme,
      background: settings.background.hex,
      foreground: settings.foreground.hex,
      primary: settings.primary.hex,
      primaryForeground: settings.primaryForeground.hex,
      secondary: settings.secondary.hex,
      secondaryForeground: settings.secondaryForeground.hex,
      accent: settings.accent.hex,
      accentForeground: settings.accentForeground.hex,
      border: settings.border.hex,
      input: settings.input.hex,
      ring: settings.ring.hex,
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ success: false, message: "Failed to save settings." });
  }
});

// @desc    Get public settings
// @route   GET /api/settings/public
// @access  Public
router.get("/public", async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = await Settings.create({});
    }
    res.json({
      brandName: settings.brandName,
      brandLogo: settings.brandLogo,
      logoWidth: settings.logoWidth,
      brandFont: settings.brandFont,
      cod: settings.cod,
      onlinePayment: settings.onlinePayment,
      trendingSearches: settings.trendingSearches,
      heroBrandName: settings.heroBrandName,
      heroButton: settings.heroButton,
      heroSubtitle: settings.heroSubtitle,
      heroBrandNameStyle: settings.heroBrandNameStyle,
      heroSubtitleStyle: settings.heroSubtitleStyle,
      mensCollectionHeading: settings.mensCollectionHeading,
      womensCollectionHeading: settings.womensCollectionHeading,
      allCollectionsHeading: settings.allCollectionsHeading,
      newArrivalsHeading: settings.newArrivalsHeading,
      badgeColor: settings.badgeColor,
      badgeFontColor: settings.badgeFontColor,
      badges: settings.badges,
      // Add other public settings here in the future
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch settings." });
  }
});

// @desc    Update COD settings
// @route   PUT /api/settings/cod
// @access  Private/Admin
router.put("/cod", protect, admin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    const { cod } = req.body;
    
    if (cod) {
      settings.cod = { ...settings.cod, ...cod };
      settings.updatedBy = req.user._id;
      settings.updatedAt = Date.now();
    }

    await settings.save();

    res.json({
      success: true,
      message: "COD settings updated successfully.",
      cod: settings.cod
    });
  } catch (error) {
    console.error("Error updating COD settings:", error);
    res.status(500).json({ success: false, message: "Failed to update COD settings." });
  }
});

// @desc    Get COD summary for admin dashboard
// @route   GET /api/settings/cod-summary
// @access  Private/Admin
router.get("/cod-summary", protect, admin, async (req, res) => {
  try {
    const codCalculator = require('../utils/codCalculator');
    const summary = await codCalculator.getCodSummary();
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error("Error fetching COD summary:", error);
    res.status(500).json({ success: false, message: "Failed to fetch COD summary." });
  }
});

// @desc    Update trending searches
// @route   PUT /api/settings/trending-searches
// @access  Private/Admin
router.put("/trending-searches", protect, admin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    const { trendingSearches } = req.body;
    if (Array.isArray(trendingSearches)) {
      settings.trendingSearches = trendingSearches;
      settings.updatedBy = req.user._id;
      settings.updatedAt = Date.now();
      await settings.save();
      res.json({ success: true, trendingSearches: settings.trendingSearches });
    } else {
      res.status(400).json({ success: false, message: "Invalid trendingSearches array." });
    }
  } catch (error) {
    console.error("Error updating trending searches:", error);
    res.status(500).json({ success: false, message: "Failed to update trending searches." });
  }
});

// @desc    Update hero section settings
// @route   PUT /api/settings/hero
// @access  Private/Admin
router.put("/hero", protect, admin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    const { heroBrandName, heroButton, heroSubtitle, heroBrandNameStyle, heroSubtitleStyle, mensCollectionHeading, womensCollectionHeading, allCollectionsHeading, newArrivalsHeading, badgeColor, badgeFontColor, badges } = req.body;
    if (typeof heroBrandName === 'string') {
      settings.heroBrandName = heroBrandName;
    }
    if (typeof heroSubtitle === 'string') {
      settings.heroSubtitle = heroSubtitle;
    }
    if (heroButton && typeof heroButton === 'object') {
      settings.heroButton = {
        ...settings.heroButton,
        ...heroButton
      };
    }
    if (heroBrandNameStyle && typeof heroBrandNameStyle === 'object') {
      settings.heroBrandNameStyle = {
        ...settings.heroBrandNameStyle,
        ...heroBrandNameStyle
      };
    }
    if (heroSubtitleStyle && typeof heroSubtitleStyle === 'object') {
      settings.heroSubtitleStyle = {
        ...settings.heroSubtitleStyle,
        ...heroSubtitleStyle
      };
    }
    if (typeof mensCollectionHeading === 'string') {
      settings.mensCollectionHeading = mensCollectionHeading;
    }
    if (typeof womensCollectionHeading === 'object') {
      settings.womensCollectionHeading = womensCollectionHeading;
    }
    if (typeof allCollectionsHeading === 'object') {
      settings.allCollectionsHeading = allCollectionsHeading;
    }
    if (typeof newArrivalsHeading === 'object') {
      settings.newArrivalsHeading = newArrivalsHeading;
    }
    if (typeof badgeColor === 'string') {
      settings.badgeColor = badgeColor;
    }
    if (typeof badgeFontColor === 'string') {
      settings.badgeFontColor = badgeFontColor;
    }
    if (Array.isArray(badges)) {
      settings.badges = badges;
    }
    settings.updatedBy = req.user._id;
    settings.updatedAt = Date.now();
    await settings.save();
    res.json({ success: true, heroBrandName: settings.heroBrandName, heroButton: settings.heroButton, heroSubtitle: settings.heroSubtitle, heroBrandNameStyle: settings.heroBrandNameStyle, heroSubtitleStyle: settings.heroSubtitleStyle, mensCollectionHeading: settings.mensCollectionHeading, womensCollectionHeading: settings.womensCollectionHeading, allCollectionsHeading: settings.allCollectionsHeading, newArrivalsHeading: settings.newArrivalsHeading, badgeColor: settings.badgeColor, badgeFontColor: settings.badgeFontColor, badges: settings.badges });
  } catch (error) {
    console.error("Error updating hero section settings:", error);
    res.status(500).json({ success: false, message: "Failed to update hero section settings." });
  }
});

module.exports = router;