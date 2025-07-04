const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  brandName: {
    type: String,
    default: "ARISTER"
  },
  brandLogo: {
    type: String, // URL to the logo
    default: ""
  },
  logoWidth: {
    type: Number,
    default: 80,
  },
  brandFont: {
    type: String,
    default: 'inherit'
  },
  theme: {
    type: String,
    enum: ["light", "dark"],
    default: "light",
  },
  background: {
    hex: { type: String, default: "#FDF6E3" },
    hsl: { type: String, default: "60 40% 91%" },
  },
  foreground: {
    hex: { type: String, default: "#355E3B" },
    hsl: { type: String, default: "150 20% 21%" },
  },
  primary: {
    hex: { type: String, default: "#355E3B" },
    hsl: { type: String, default: "150 20% 21%" },
  },
  primaryForeground: {
    hex: { type: String, default: "#FDF6E3" },
    hsl: { type: String, default: "60 40% 91%" },
  },
  secondary: {
    hex: { type: String, default: "#EAD9B3" },
    hsl: { type: String, default: "36 30% 82%" },
  },
  secondaryForeground: {
    hex: { type: String, default: "#355E3B" },
    hsl: { type: String, default: "150 20% 21%" },
  },
  accent: {
    hex: { type: String, default: "#8B5A2B" },
    hsl: { type: String, default: "25 40% 51%" },
  },
  accentForeground: {
    hex: { type: String, default: "#355E3B" },
    hsl: { type: String, default: "150 20% 21%" },
  },
  border: {
    hex: { type: String, default: "#4A2C0E" },
    hsl: { type: String, default: "25 76% 31%" },
  },
  input: {
    hex: { type: String, default: "#EAD9B3" },
    hsl: { type: String, default: "36 30% 82%" },
  },
  ring: {
    hex: { type: String, default: "#355E3B" },
    hsl: { type: String, default: "150 20% 21%" },
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Enhanced COD Management System
  cod: {
    enabled: { type: Boolean, default: true },
    charge: { type: Number, default: 50 }, // Legacy field for backward compatibility
    
    // Dynamic pricing system
    pricing: {
      type: {
        type: String,
        enum: ['fixed', 'percentage', 'tiered', 'dynamic'],
        default: 'fixed'
      },
      fixedAmount: { type: Number, default: 50 },
      percentage: { type: Number, default: 2.5 }, // Percentage of order value
      minCharge: { type: Number, default: 30 },
      maxCharge: { type: Number, default: 200 },
      
      // Tiered pricing based on order value
      tiers: [{
        minAmount: { type: Number, required: true },
        maxAmount: { type: Number },
        charge: { type: Number, required: true }
      }],
      
      // Location-based pricing
      locationBased: {
        enabled: { type: Boolean, default: false },
        zones: [{
          name: { type: String, required: true },
          pincodes: [String], // Array of pincodes
          states: [String], // Array of states
          cities: [String], // Array of cities
          charge: { type: Number, required: true },
          minCharge: { type: Number, default: 30 },
          maxCharge: { type: Number, default: 200 }
        }]
      }
    },
    
    // Courier-specific charges
    courierCharges: {
      enabled: { type: Boolean, default: false },
      couriers: [{
        name: { type: String, required: true },
        code: { type: String, required: true }, // courier code
        percentage: { type: Number, default: 2.5 },
        minCharge: { type: Number, default: 30 },
        maxCharge: { type: Number, default: 200 },
        enabled: { type: Boolean, default: true }
      }]
    },
    
    // Business rules
    rules: {
      minOrderValue: { type: Number, default: 0 }, // Minimum order value for COD
      maxOrderValue: { type: Number, default: 10000 }, // Maximum order value for COD
      excludedCategories: [{ type: String }], // Product categories where COD is not allowed
      excludedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], // Specific products
      excludedPincodes: [String], // Pincodes where COD is not available
      excludedStates: [String], // States where COD is not available
      
      // Time-based restrictions
      timeRestrictions: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "09:00" }, // 24-hour format
        endTime: { type: String, default: "18:00" },
        daysOfWeek: [{ type: Number }] // 0=Sunday, 1=Monday, etc.
      }
    },
    
    // Analytics and tracking
    analytics: {
      totalCodOrders: { type: Number, default: 0 },
      totalCodRevenue: { type: Number, default: 0 },
      averageCodCharge: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    }
  },
  // Add other payment gateway settings here
  onlinePayment: {
    enabled: { type: Boolean, default: true },
    timeRestrictions: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: "00:00" },
      endTime: { type: String, default: "23:59" },
      daysOfWeek: [{ type: Number }], // 0=Sunday, 1=Monday, etc.
    },
    analytics: {
      totalOnlineOrders: { type: Number, default: 0 },
      totalOnlineRevenue: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    }
  },
  trendingSearches: {
    type: [String],
    default: ["wedding sarees", "cotton kurtas", "formal shirts", "festive wear", "summer collection"]
  },
  heroBrandName: {
    type: String,
    default: "Arister"
  },
  heroButton: {
    text: { type: String, default: "Shop Now" },
    url: { type: String, default: "/collections" },
    enabled: { type: Boolean, default: true }
  },
  heroSubtitle: {
    type: String,
    default: "Discover our latest collection of handcrafted and contemporary fashion."
  },
  heroBrandNameStyle: {
    fontFamily: { type: String, default: 'Georgia, "Times New Roman", serif' },
    color: { type: String, default: '#FFFDEB' },
    fontSize: { type: String, default: '5xl' }, // tailwind size or px/rem
    visible: { type: Boolean, default: true }
  },
  heroSubtitleStyle: {
    fontFamily: { type: String, default: 'inherit' },
    color: { type: String, default: '#FFFDEB' },
    fontSize: { type: String, default: 'lg' }, // tailwind size or px/rem
    visible: { type: Boolean, default: true }
  },
  mensCollectionHeading: {
    type: String,
    default: "Explore Men's Collections"
  },
  womensCollectionHeading: {
    text: { type: String, default: "Explore Women's Collections" },
    fontColor: { type: String, default: "#FFFDEB" },
    bgColor: { type: String, default: "#A27B5C" }
  },
  allCollectionsHeading: {
    text: { type: String, default: "Explore All Collections" },
    fontColor: { type: String, default: "#FFFDEB" },
    bgColor: { type: String, default: "#A27B5C" }
  },
  newArrivalsHeading: {
    text: { type: String, default: "Explore New Arrivals" },
    fontColor: { type: String, default: "#FFFDEB" },
    bgColor: { type: String, default: "#A27B5C" },
    badgeColor: {
      type: String,
      default: '#A27B5C'
    },
    badgeFontColor: {
      type: String,
      default: '#FFFDEB'
    }
  },
  badges: [
    {
      name: { type: String, required: true },
      color: { type: String, default: '#A27B5C' },
      fontColor: { type: String, default: '#FFFDEB' }
    }
  ]
});

module.exports = mongoose.model("Settings", settingsSchema);