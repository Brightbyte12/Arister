const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Category = require("../models/Category");
const { upload, cloudinary } = require("../utils/cloudinary"); // Import cloudinary for deletion
const { protect, admin } = require("../middleware/authMiddleware"); // Ensure these are correctly implemented
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const multer = require("multer");

// Middleware to log raw request body (for debugging)
const logRawBody = (req, res, next) => {
  console.log("Raw request body:", req.body);
  console.log("Files:", req.files ? req.files.map((f) => f.originalname) : []);
  next();
};
// Middleware to handle multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err.message);
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  } else if (err) {
    console.error("Upload error:", err.message);
    return res.status(400).json({ message: err.message });
  }
  next();
};

// GET all products
router.get("/", asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().lean(); // .lean() for plain JS objects
    console.log("Fetched products:", products);
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
}));

// GET products with 'New Arrival' badge
router.get("/new-arrival-badge", asyncHandler(async (req, res) => {
  try {
    // Find products where badges array contains 'New Arrival' (case-insensitive)
    const products = await Product.find({
      badges: { $elemMatch: { $regex: /^new arrival$/i } }
    }).lean();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
}));

router.patch('/:id', async (req, res) => {
  try {
    const { isFeatured, stock, variantIndex, color, size } = req.body;
    let product;
    
    if (typeof variantIndex === 'number') {
      // Update stock for a specific variant by index
      product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (!product.variants || !product.variants[variantIndex]) {
        return res.status(400).json({ message: 'Variant not found' });
      }
      product.variants[variantIndex].stock = Number(stock) || 0;
      await product.save();
      
      const updatedVariant = product.variants[variantIndex];
      res.json({
        message: 'Variant stock updated successfully',
        variant: updatedVariant,
        product: product
      });
    } else if (color && size !== undefined) {
      // Update stock for a specific color-size combination
      product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const variantIndex = product.variants.findIndex(v => 
        v.color === color && v.size === size
      );
      
      if (variantIndex === -1) {
        return res.status(404).json({ 
          message: `Variant not found for color: ${color}, size: ${size}` 
        });
      }
      
      product.variants[variantIndex].stock = Number(stock) || 0;
      await product.save();
      
      const updatedVariant = product.variants[variantIndex];
      res.json({
        message: 'Variant stock updated successfully',
        variant: updatedVariant,
        product: product
      });
    } else if (color && size === undefined) {
      // Update stock for all variants of a specific color
      product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const colorVariants = product.variants.filter(v => v.color === color);
      if (colorVariants.length === 0) {
        return res.status(404).json({ 
          message: `No variants found for color: ${color}` 
        });
      }
      
      // Update all variants of this color
      product.variants.forEach(variant => {
        if (variant.color === color) {
          variant.stock = Number(stock) || 0;
        }
      });
      
      await product.save();
      
      res.json({
        message: `Updated stock for all variants of color: ${color}`,
        updatedVariants: colorVariants,
        product: product
      });
    } else {
      // Update product-level fields (isFeatured, etc.)
      const updateFields = {};
      if (typeof isFeatured !== 'undefined') updateFields.isFeatured = isFeatured;
      if (typeof stock !== 'undefined' && !product.variants) {
        // Only update product-level stock if no variants exist
        updateFields.stock = Number(stock) || 0;
      }
      
      product = await Product.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true }
      );
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json({
        message: 'Product updated successfully',
        product: product
      });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// GET product by ID
// router.get("/:id",  asyncHandler(async (req, res) => {
//   try {
//     const { id } = req.params;
//     console.log("Fetching product with ID:", id);
//     if (!id || !mongoose.Types.ObjectId.isValid(id)) { // Added !id check
//       return res.status(400).json({ message: "Invalid product ID" });
//     }
//     const product = await Product.findById(id);
//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }
//     res.json(product);
//   } catch (err) {
//     console.error("Error fetching product:", err);
//     res.status(500).json({ message: "Server error: " + err.message });
//   }
// }));
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({
        ...product.toObject(),
        colorImages: product.colorImages || [], // Ensure colorImages is included
      });
    } catch (err) {
      res.status(500).json({ message: "Server error: " + err.message });
    }
  })
);

// GET product variants for inventory management
router.get("/:id/variants", asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Group variants by color for better organization
    const variantsByColor = {};
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(variant => {
        if (!variantsByColor[variant.color]) {
          variantsByColor[variant.color] = [];
        }
        variantsByColor[variant.color].push({
          size: variant.size || 'No Size',
          stock: variant.stock || 0,
          sku: `SKU-${product._id.toString().padStart(4, "0")}-${variant.color}-${variant.size || 'NOSIZE'}`
        });
      });
    }

    res.json({
      productId: product._id,
      productName: product.name,
      variants: product.variants || [],
      variantsByColor,
      totalVariants: product.variants ? product.variants.length : 0,
      totalStock: product.variants ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0) : 0
    });
  } catch (err) {
    console.error("Error fetching product variants:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
}));

// Helper to ensure array parsing
const parseArrayField = (value) => {
  if (Array.isArray(value)) {
    return value.filter(item => item !== null && item !== undefined && (typeof item === 'string' ? item.trim() !== '' : true));
  }
  if (typeof value === 'string' && value.trim() !== '') {
    // If it's a single string and not empty, treat as a single-item array
    return [value.trim()];
  }
  return []; // Default to empty array
};


// POST new product
// router.post(
//   "/",
//   protect, // Uncomment these if you have authMiddleware fully set up
//   admin,
//   logRawBody, // For debugging requests
//   upload.array("images", 5), // 'images' is the field name for multiple files
//   handleMulterError,
//   asyncHandler(async (req, res) => {
//     try {
//       console.log("POST /api/products processed body:", req.body);

//       const {
//         name,
//         description,
//         price,
//         salePrice,
//         discountPercentage,
//         stock,
//         category,
//         material,
//         weight,
//         dimensions,
//         care,
//         origin,
//         gender,
//         status,
//         badges,
//         replacementPolicy,
//       } = req.body;

//       // Correctly parse array fields from FormData
//       const careInstructionsList = parseArrayField(req.body.careInstructionsList);
//       const sizes = parseArrayField(req.body.sizes);
//       const colors = parseArrayField(req.body.colors);
//       const badgesArray = parseArrayField(req.body.badges);

//       // Parse replacement policy
//       const replacementPolicyData = replacementPolicy ? {
//         days: Number(replacementPolicy.days) || 7,
//         policy: replacementPolicy.policy || "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
//       } : {
//         days: 7,
//         policy: "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
//       };

//       // Handle replacementPolicy from FormData (when sent as replacementPolicy[days] and replacementPolicy[policy])
//       let finalReplacementPolicy = replacementPolicyData;
//       if (req.body['replacementPolicy[days]'] || req.body['replacementPolicy[policy]']) {
//         finalReplacementPolicy = {
//           days: Number(req.body['replacementPolicy[days]']) || 7,
//           policy: req.body['replacementPolicy[policy]'] || "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
//         };
//       }

//       // New images uploaded via Multer
//       const newImages = req.files && req.files.length > 0
//         ? req.files.map((file) => ({
//             url: file.path,
//             publicId: file.filename, // Multer-Cloudinary uses 'filename' for publicId
//           }))
//         : [];

//       if (newImages.length === 0) { // For new products, at least one image is required
//         return res.status(400).json({ message: "At least one image is required for new products" });
//       }

//       // Check if category exists or create it
//       let categoryDoc = await Category.findOne({ name: category });
//       if (!categoryDoc) {
//         categoryDoc = new Category({ name: category });
//         await categoryDoc.save();
//         console.log(`Created new category: ${category}`);
//       }

//       const product = new Product({
//         name,
//         description,
//         price: Number(price) || 0,
//         salePrice: salePrice ? Number(salePrice) : undefined,
//         discountPercentage: discountPercentage ? Number(discountPercentage) : undefined,
//         stock: Number(stock) || 0,
//         images: newImages, // Only new images for creation
//         category,
//         material: material || undefined,
//         weight: weight || undefined,
//         dimensions: dimensions || undefined,
//         care: care || undefined,
//         origin: origin || undefined,
//         careInstructionsList: careInstructionsList,
//         gender: gender || undefined,
//         sizes: sizes,
//         colors: colors,
//         status: status || "Active",
//         badges: badgesArray,
//         replacementPolicy: finalReplacementPolicy,
//         // createdBy: req.user._id, // Uncomment if using authMiddleware
//       });

//       const newProduct = await product.save();
//       console.log("Saved new product:", newProduct.toObject());
//       res.status(201).json({ message: "Product created successfully", product: newProduct });
//     } catch (err) {
//       console.error("Error creating product:", err);
//       // Clean up uploaded images if product creation fails
//       if (req.files && req.files.length > 0) {
//         const deletePromises = req.files.map(async (file) => {
//           try {
//             await cloudinary.uploader.destroy(file.filename);
//             console.log(`Cleaned up uploaded file: ${file.filename}`);
//           } catch (cleanupErr) {
//             console.error(`Error cleaning up Cloudinary image ${file.filename}:`, cleanupErr);
//           }
//         });
//         await Promise.all(deletePromises);
//       }
//       res.status(500).json({ message: "Server error: " + err.message });
//     }
//   })
// );
router.post(
  "/",
  protect,
  admin,
  logRawBody,
  upload.array("colorImages", 20), // Increase limit to allow multiple images per color (e.g., 5 per color, up to 4 colors)
  handleMulterError,
  asyncHandler(async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        salePrice,
        discountPercentage,
        stock,
        category,
        material,
        weight,
        dimensions,
        care,
        origin,
        gender,
        status,
        badges,
        replacementPolicy,
        colors,
        careInstructionsList,
        sizes,
      } = req.body;

      // Parse array fields
      const parsedCareInstructionsList = parseArrayField(careInstructionsList);
      const parsedSizes = parseArrayField(sizes);
      const parsedColors = parseArrayField(colors);
      const parsedBadges = parseArrayField(badges);

      // Parse replacement policy
      let finalReplacementPolicy = {
        days: 7,
        policy: "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging.",
      };
      if (req.body['replacementPolicy[days]'] || req.body['replacementPolicy[policy]']) {
        finalReplacementPolicy = {
          days: Number(req.body['replacementPolicy[days]']) || 7,
          policy: req.body['replacementPolicy[policy]'] || finalReplacementPolicy.policy,
        };
      } else if (replacementPolicy) {
        finalReplacementPolicy = {
          days: Number(replacementPolicy.days) || 7,
          policy: replacementPolicy.policy || finalReplacementPolicy.policy,
        };
      }

      // Process colorImages from FormData
      let colorImages = [];
      if (req.files && req.files.length > 0) {
        const colorImageData = JSON.parse(req.body.colorImages || '[]');
        const fileMap = req.files.reduce((acc, file) => {
          acc[file.originalname] = { url: file.path, publicId: file.filename };
          return acc;
        }, {});

        // Only use fileMap and request body for POST (do NOT reference product.colorImages)
        colorImages = colorImageData.map(({ color, images }) => ({
          color,
          images: images.map((img) => {
            if (typeof img === 'object' && img.url && img.publicId) {
              return { url: img.url, publicId: img.publicId };
            } else if (typeof img === 'string') {
              return fileMap[img] || { url: img, publicId: img.split('/').pop().split('.')[0] };
            }
            return null;
          }).filter(Boolean),
        }));
      }

      if (colorImages.length === 0 || colorImages.some((ci) => ci.images.length === 0)) {
        return res.status(400).json({ message: "At least one image per color is required" });
      }

      // Check if category exists or create it
      let categoryDoc = await Category.findOne({ name: category });
      if (!categoryDoc) {
        categoryDoc = new Category({ name: category });
        await categoryDoc.save();
      }

      // Parse variants from body (handle both JSON string and array)
      console.log('DEBUG: req.body.variants received:', req.body.variants);
      let parsedVariants = [];
      if (req.body.variants) {
        if (typeof req.body.variants === 'string') {
          try {
            parsedVariants = JSON.parse(req.body.variants);
          } catch (e) {
            console.error('Error parsing variants JSON:', e);
            parsedVariants = [];
          }
        } else if (Array.isArray(req.body.variants)) {
          parsedVariants = req.body.variants;
        }
      }

      // Validate variants structure
      if (parsedVariants.length > 0) {
        const validationErrors = [];
        parsedVariants.forEach((variant, index) => {
          if (!variant.color || typeof variant.color !== 'string') {
            validationErrors.push(`Variant ${index}: color is required and must be a string`);
          }
          if (variant.size !== undefined && typeof variant.size !== 'string') {
            validationErrors.push(`Variant ${index}: size must be a string if provided`);
          }
          if (typeof variant.stock !== 'number' || variant.stock < 0) {
            validationErrors.push(`Variant ${index}: stock must be a non-negative number`);
          }
        });

        if (validationErrors.length > 0) {
          return res.status(400).json({ 
            message: 'Invalid variant data', 
            errors: validationErrors 
          });
        }

        // Check for duplicate color-size combinations
        const colorSizeCombos = parsedVariants.map(v => `${v.color}-${v.size || 'NOSIZE'}`);
        const duplicates = colorSizeCombos.filter((combo, index) => colorSizeCombos.indexOf(combo) !== index);
        if (duplicates.length > 0) {
          return res.status(400).json({ 
            message: 'Duplicate color-size combinations found', 
            duplicates: [...new Set(duplicates)]
          });
        }
      }

      const product = new Product({
        name,
        description,
        price: Number(price) || 0,
        salePrice: salePrice ? Number(salePrice) : undefined,
        discountPercentage: discountPercentage ? Number(discountPercentage) : undefined,
        images: [], // No main images, only color-specific images
        colorImages,
        category,
        material: material || undefined,
        weight: weight || undefined,
        dimensions: dimensions || undefined,
        care: care || undefined,
        origin: origin || undefined,
        careInstructionsList: parsedCareInstructionsList,
        gender: gender || undefined,
        sizes: parsedSizes,
        colors: parsedColors,
        status: status || "Active",
        badges: parsedBadges,
        replacementPolicy: finalReplacementPolicy,
        barcode: req.body.barcode || undefined, // allow manual barcode, else generate below
        variants: parsedVariants, // <-- Only variants for stock
      });

      // Save product to get _id, then set barcode if not provided
      let newProduct = await product.save();
      if (!newProduct.barcode) {
        newProduct.barcode = newProduct._id.toString();
        await newProduct.save();
      }
      res.status(201).json({ message: "Product created successfully", product: newProduct });
    } catch (err) {
      // Clean up uploaded images if product creation fails
      if (req.files && req.files.length > 0) {
        await Promise.all(
          req.files.map(async (file) => {
            try {
              await cloudinary.uploader.destroy(file.filename);
            } catch (cleanupErr) {
              console.error(`Error cleaning up Cloudinary image ${file.filename}:`, cleanupErr);
            }
          })
        );
      }
      res.status(500).json({ message: "Server error: " + err.message });
    }
  })
);
// PUT update product
// router.put(
//   "/:id",
//   protect, // Uncomment these if you have authMiddleware fully set up
//   admin,
//   logRawBody, // For debugging requests
//   upload.array("images", 5), // 'images' is the field name for multiple files
//   handleMulterError,
//   asyncHandler(async (req, res) => {
//     try {
//       const { id } = req.params;
//       console.log("PUT /api/products/:id received:", { id, body: req.body });

//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid product ID" });
//       }

//       const product = await Product.findById(id);
//       if (!product) {
//         return res.status(404).json({ message: "Product not found" });
//       }

//       const {
//         name,
//         description,
//         price,
//         salePrice,
//         discountPercentage,
//         stock,
//         category,
//         material,
//         weight,
//         dimensions,
//         care,
//         origin,
//         gender,
//         status,
//         badges,
//         replacementPolicy,
//       } = req.body;

//       // Correctly parse array fields from FormData
//       const careInstructionsList = parseArrayField(req.body.careInstructionsList);
//       const sizes = parseArrayField(req.body.sizes);
//       const colors = parseArrayField(req.body.colors);
//       const badgesArray = parseArrayField(req.body.badges);

//       // Parse replacement policy
//       const replacementPolicyData = replacementPolicy ? {
//         days: Number(replacementPolicy.days) || 7,
//         policy: replacementPolicy.policy || "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
//       } : {
//         days: 7,
//         policy: "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
//       };

//       // Handle replacementPolicy from FormData (when sent as replacementPolicy[days] and replacementPolicy[policy])
//       let finalReplacementPolicy = replacementPolicyData;
//       if (req.body['replacementPolicy[days]'] || req.body['replacementPolicy[policy]']) {
//         finalReplacementPolicy = {
//           days: Number(req.body['replacementPolicy[days]']) || 7,
//           policy: req.body['replacementPolicy[policy]'] || "Replace within 7 days for manufacturing defects. Product must be unused and in original packaging."
//         };
//       }

//       // Handle existing images passed from frontend (as an array of URLs)
//       const existingImageUrlsFromFrontend = parseArrayField(req.body.existingImageUrls); // This needs to match frontend
//       const existingImages = existingImageUrlsFromFrontend.map(url => ({
//         url: url,
//         // Assuming publicId can be extracted from URL, or you store it directly in formState
//         // For existing images, we typically pass back the publicId from the frontend
//         publicId: url.split('/').pop().split('.')[0] || url // Adjust this if your publicId is more complex
//       }));
//       console.log("Existing images from frontend:", existingImages);

//       // New images uploaded via Multer
//       const newUploadedImages = req.files && req.files.length > 0
//         ? req.files.map((file) => ({
//             url: file.path,
//             publicId: file.filename, // Multer-Cloudinary uses 'filename' for publicId
//           }))
//         : [];
//       console.log("New uploaded images:", newUploadedImages);

//       // Combine existing and newly uploaded images
//       product.images = [...existingImages, ...newUploadedImages];

//       // Delete images from Cloudinary that are no longer in the product.images array
//       const oldProductImagePublicIds = product.images.map(img => img.publicId);
//       const imagesToDelete = oldProductImagePublicIds.filter(publicId =>
//         !product.images.some(img => img.publicId === publicId) // This logic seems flawed. Needs actual old vs new set.
//       );

//       // Correct logic for deleting old images (compare initial product images with final product.images)
//       const initialProductImages = product._doc.images || []; // Access initial state before modification
//       const finalProductImages = product.images;

//       const publicIdsToKeep = new Set(finalProductImages.map(img => img.publicId));
//       const publicIdsForDeletion = initialProductImages
//         .filter(img => !publicIdsToKeep.has(img.publicId))
//         .map(img => img.publicId);

//       if (publicIdsForDeletion.length > 0) {
//         console.log("Images to delete from Cloudinary:", publicIdsForDeletion);
//         const deletionPromises = publicIdsForDeletion.map(publicId => cloudinary.uploader.destroy(publicId));
//         await Promise.all(deletionPromises).catch(err => console.error("Error during Cloudinary cleanup:", err));
//       }


//       // Check if category exists or create it
//       let categoryDoc = await Category.findOne({ name: category });
//       if (!categoryDoc) {
//         categoryDoc = new Category({ name: category });
//         await categoryDoc.save();
//         console.log(`Created new category: ${category}`);
//       }

//       // Update product fields
//       product.name = name || product.name;
//       product.description = description !== undefined ? description : product.description;
//       product.price = price ? Number(price) : product.price;
//       product.salePrice = salePrice !== undefined ? (salePrice === '' ? null : Number(salePrice)) : product.salePrice; // Handle empty string for null
//       product.discountPercentage =
//         discountPercentage !== undefined ? (discountPercentage === '' ? null : Number(discountPercentage)) : product.discountPercentage; // Handle empty string for null
//       product.stock = stock !== undefined ? Number(stock) : product.stock;
//       product.category = category || product.category;
//       product.material = material !== undefined ? material : product.material;
//       product.weight = weight !== undefined ? weight : product.weight;
//       product.dimensions = dimensions !== undefined ? dimensions : product.dimensions;
//       product.care = care !== undefined ? care : product.care;
//       product.origin = origin !== undefined ? origin : product.origin;
//       product.careInstructionsList = careInstructionsList; // Directly assign parsed array
//       product.gender = gender !== undefined ? gender : product.gender;
//       product.sizes = sizes; // Directly assign parsed array
//       product.colors = colors; // Directly assign parsed array
//       product.status = status || product.status;
//       product.badges = badgesArray;
//       product.replacementPolicy = finalReplacementPolicy;
//       product.updatedAt = Date.now(); // Manually update or rely on timestamps: true

//       const updatedProduct = await product.save();
//       console.log("Updated product:", updatedProduct.toObject());
//       res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
//     } catch (err) {
//       console.error("Error updating product:", err);
//       // Clean up newly uploaded images if product update fails
//       if (req.files && req.files.length > 0) {
//         const deletePromises = req.files.map(async (file) => {
//           try {
//             await cloudinary.uploader.destroy(file.filename);
//             console.log(`Cleaned up uploaded file (update error): ${file.filename}`);
//           } catch (cleanupErr) {
//             console.error(`Error cleaning up Cloudinary image ${file.filename} after update failure:`, cleanupErr);
//           }
//         });
//         await Promise.all(deletePromises);
//       }
//       res.status(500).json({ message: "Server error: " + err.message });
//     }
//   })
// );
router.put(
  "/:id",
  protect,
  admin,
  logRawBody,
  upload.array("colorImages", 20),
  handleMulterError,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const {
        name,
        description,
        price,
        salePrice,
        discountPercentage,
        stock,
        category,
        material,
        weight,
        dimensions,
        care,
        origin,
        gender,
        status,
        badges,
        replacementPolicy,
        colors,
        careInstructionsList,
        sizes,
      } = req.body;

      // Parse array fields
      const parsedCareInstructionsList = parseArrayField(careInstructionsList);
      const parsedSizes = parseArrayField(sizes);
      const parsedColors = parseArrayField(colors);
      const parsedBadges = parseArrayField(badges);

      // Parse replacement policy
      let finalReplacementPolicy = product.replacementPolicy;
      if (req.body['replacementPolicy[days]'] || req.body['replacementPolicy[policy]']) {
        finalReplacementPolicy = {
          days: Number(req.body['replacementPolicy[days]']) || product.replacementPolicy.days,
          policy: req.body['replacementPolicy[policy]'] || product.replacementPolicy.policy,
        };
      } else if (replacementPolicy) {
        finalReplacementPolicy = {
          days: Number(replacementPolicy.days) || product.replacementPolicy.days,
          policy: replacementPolicy.policy || product.replacementPolicy.policy,
        };
      }

      // Process colorImages - preserve existing images unless explicitly removed
      let colorImages = product.colorImages || [];
      if (req.body.colorImages || req.files) {
        const colorImageData = JSON.parse(req.body.colorImages || '[]');
        const fileMap = req.files.reduce((acc, file) => {
          acc[file.originalname] = { url: file.path, publicId: file.filename };
          return acc;
        }, {});

        // Process each color's images
        colorImages = colorImageData.map(({ color, images }) => {
          const processedImages = images.map((img) => {
            if (typeof img === 'object' && img.url && img.publicId) {
              // Existing image object - keep it
              return { url: img.url, publicId: img.publicId };
            } else if (typeof img === 'string') {
              // New file uploaded
              return fileMap[img] || { url: img, publicId: img.split('/').pop().split('.')[0] };
            }
            return null;
          }).filter(Boolean);

          return { color, images: processedImages };
        });

        // Find images to delete (images that were in original product but not in new data)
        const imagesToDelete = [];
        product.colorImages.forEach((originalColorGroup) => {
          const newColorGroup = colorImages.find(cg => cg.color === originalColorGroup.color);
          if (newColorGroup) {
            // Check which images were removed
            originalColorGroup.images.forEach((originalImg) => {
              const stillExists = newColorGroup.images.some(newImg => newImg.publicId === originalImg.publicId);
              if (!stillExists) {
                imagesToDelete.push(originalImg.publicId);
              }
            });
          } else {
            // Entire color group was removed
            originalColorGroup.images.forEach(img => imagesToDelete.push(img.publicId));
          }
        });

        // Delete removed images from Cloudinary
        if (imagesToDelete.length > 0) {
          console.log("Deleting images from Cloudinary:", imagesToDelete);
          await Promise.all(
            imagesToDelete.map(async (publicId) => {
              try {
                await cloudinary.uploader.destroy(publicId);
                console.log(`Successfully deleted image: ${publicId}`);
              } catch (err) {
                console.error(`Error deleting Cloudinary image ${publicId}:`, err);
              }
            })
          );
        }
      } else {
        // No colorImages sent in request - preserve all existing images
        console.log("No colorImages in request - preserving existing images");
        colorImages = product.colorImages || [];
      }

      // Check if category exists or create it
      let categoryDoc = await Category.findOne({ name: category });
      if (!categoryDoc) {
        categoryDoc = new Category({ name: category });
        await categoryDoc.save();
      }

      // Parse variants from body (handle both JSON string and array)
      let parsedVariants = product.variants;
      if (req.body.variants) {
        if (typeof req.body.variants === 'string') {
          try {
            parsedVariants = JSON.parse(req.body.variants);
          } catch (e) {
            console.error('Error parsing variants:', e);
            parsedVariants = product.variants;
          }
        } else if (Array.isArray(req.body.variants)) {
          parsedVariants = req.body.variants;
        }
      }

      // Validate variants structure
      if (parsedVariants.length > 0) {
        const validationErrors = [];
        parsedVariants.forEach((variant, index) => {
          if (!variant.color || typeof variant.color !== 'string') {
            validationErrors.push(`Variant ${index}: color is required and must be a string`);
          }
          if (variant.size !== undefined && typeof variant.size !== 'string') {
            validationErrors.push(`Variant ${index}: size must be a string if provided`);
          }
          if (typeof variant.stock !== 'number' || variant.stock < 0) {
            validationErrors.push(`Variant ${index}: stock must be a non-negative number`);
          }
        });

        if (validationErrors.length > 0) {
          return res.status(400).json({ 
            message: 'Invalid variant data', 
            errors: validationErrors 
          });
        }

        // Check for duplicate color-size combinations
        const colorSizeCombos = parsedVariants.map(v => `${v.color}-${v.size || 'NOSIZE'}`);
        const duplicates = colorSizeCombos.filter((combo, index) => colorSizeCombos.indexOf(combo) !== index);
        if (duplicates.length > 0) {
          return res.status(400).json({ 
            message: 'Duplicate color-size combinations found', 
            duplicates: [...new Set(duplicates)]
          });
        }
      }

      // Update product fields
      product.name = name || product.name;
      product.description = description !== undefined ? description : product.description;
      product.price = price ? Number(price) : product.price;
      product.salePrice = salePrice !== undefined ? (salePrice === '' ? null : Number(salePrice)) : product.salePrice;
      product.discountPercentage = discountPercentage !== undefined ? (discountPercentage === '' ? null : Number(discountPercentage)) : product.discountPercentage;
      product.category = category || product.category;
      product.material = material !== undefined ? material : product.material;
      product.weight = weight !== undefined ? weight : product.weight;
      product.dimensions = dimensions !== undefined ? dimensions : product.dimensions;
      product.care = care !== undefined ? care : product.care;
      product.origin = origin !== undefined ? origin : product.origin;
      product.careInstructionsList = parsedCareInstructionsList;
      product.gender = gender !== undefined ? gender : product.gender;
      product.sizes = parsedSizes;
      product.colors = parsedColors;
      product.status = status || product.status;
      product.badges = parsedBadges;
      product.replacementPolicy = finalReplacementPolicy;
      product.colorImages = colorImages;
      product.variants = parsedVariants;
      product.updatedAt = Date.now();

      const updatedProduct = await product.save();
      res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
    } catch (err) {
      console.error("Error updating product:", err);
      // Clean up newly uploaded images if update fails
      if (req.files && req.files.length > 0) {
        await Promise.all(
          req.files.map(async (file) => {
            try {
              await cloudinary.uploader.destroy(file.filename);
            } catch (cleanupErr) {
              console.error(`Error cleaning up Cloudinary image ${file.filename}:`, cleanupErr);
            }
          })
        );
      }
      res.status(500).json({ message: "Server error: " + err.message });
    }
  })
);
// DELETE product
router.delete(
  "/:id",
  protect, // Uncomment if using authMiddleware
  admin,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      console.log("DELETE /api/products/:id received:", { id });

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const deletedProduct = await Product.findByIdAndDelete(id);
      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      const deletionErrors = [];
      if (deletedProduct.images && deletedProduct.images.length > 0) {
        const deletePromises = deletedProduct.images.map(async (image) => {
          try {
            console.log(`Attempting to delete Cloudinary image: ${image.publicId}`);
            // Cloudinary destroy expects publicId, not full URL
            const result = await cloudinary.uploader.destroy(image.publicId);
            console.log(`Cloudinary deletion result for ${image.publicId}:`, result);
            return { publicId: image.publicId, status: "fulfilled", result };
          } catch (err) {
            console.error(`Error deleting Cloudinary image ${image.publicId}:`, err);
            return { publicId: image.publicId, status: "rejected", error: err.message };
          }
        });

        const results = await Promise.all(deletePromises);
        results.forEach((result) => {
          if (result.status === "rejected") {
            deletionErrors.push(`Failed to delete image ${result.publicId}: ${result.error}`);
          }
        });
      }

      if (deletionErrors.length > 0) {
        return res.status(200).json({
          message: "Product deleted from database, but some images could not be deleted from Cloudinary",
          errors: deletionErrors,
        });
      }

      res.json({ message: "Product and associated images deleted successfully" });
    } catch (err) {
      console.error("Error deleting product:", err);
      res.status(500).json({ message: "Server error: " + err.message });
    }
  })
);

// Bulk update stock for multiple variants
router.patch('/:id/bulk-stock', async (req, res) => {
  try {
    const { updates } = req.body; // Array of { color, size, stock } objects
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Updates array is required and must not be empty' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      const { color, size, stock } = update;
      
      if (!color || typeof stock !== 'number' || stock < 0) {
        errors.push(`Invalid update: color required, stock must be non-negative number`);
        continue;
      }

      const variantIndex = product.variants.findIndex(v => 
        v.color === color && v.size === size
      );

      if (variantIndex === -1) {
        errors.push(`Variant not found for color: ${color}, size: ${size || 'No Size'}`);
        continue;
      }

      const oldStock = product.variants[variantIndex].stock;
      product.variants[variantIndex].stock = stock;
      
      results.push({
        color,
        size: size || 'No Size',
        oldStock,
        newStock: stock,
        success: true
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        message: 'Some updates failed', 
        errors,
        successfulUpdates: results
      });
    }

    await product.save();

    res.json({
      message: 'Bulk stock update completed successfully',
      updatedVariants: results,
      totalUpdated: results.length
    });

  } catch (error) {
    console.error('Error in bulk stock update:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;
