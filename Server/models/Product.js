const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    salePrice: {
      type: Number,
      min: [0, "Sale price cannot be negative"],
    },
    discountPercentage: {
      type: Number,
      min: [0, "Discount percentage cannot be negative"],
      max: [100, "Discount percentage cannot exceed 100"],
    },
    // IMPORTANT: images stored as array of objects with url and publicId
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true }, // Store Cloudinary publicId
      },
    ],
    // New: per-color/size variant inventory
    variants: [
      {
        color: { type: String, trim: true, required: true },
        size: { type: String, trim: true }, // Optional, for per-size inventory
        stock: { type: Number, min: 0, required: true }
      }
    ],
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    material: { type: String, trim: true },
    weight: { type: String, trim: true },
    dimensions: { type: String, trim: true },
    care: { type: String, trim: true },
    origin: { type: String, trim: true },
    careInstructionsList: [{ type: String, trim: true }], // Array of strings
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Men", "Women", "Unisex", "Other"],
    },
    sizes: [{ type: String, trim: true }], // Array of strings
    colors: [{ type: String, trim: true }], // Array of strings
    isFeatured: { type: Boolean, default: false },
    badges: [{ type: String, trim: true }], // Array of strings for product badges
    barcode: {
      type: String,
      unique: true,
      sparse: true, // allow multiple nulls
      trim: true,
      default: null
    },
    // Add colorImages for color-specific product images
    colorImages: [
      {
        color: { type: String, required: true },
        images: [
          {
            url: { type: String, required: true },
            publicId: { type: String, required: true }
          }
        ]
      }
    ],
    replacementPolicy: {
      days: {
        type: Number,
        min: [0, "Replacement days cannot be negative"],
        max: [365, "Replacement days cannot exceed 365"],
        default: 7
      },
      policy: {
        type: String,
        trim: true,
        maxlength: [1000, "Replacement policy cannot exceed 1000 characters"],
        default: "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
      }
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Make this optional for testing if authMiddleware is not fully set up
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
