const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Sanitize folder names to remove invalid characters and ensure lowercase
const sanitizeFolderName = (name) => {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .trim('-'); // Remove leading/trailing hyphens
};

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const gender = sanitizeFolderName(req.body.gender);
    const category = sanitizeFolderName(req.body.category);
    const public_id_base = file.originalname.split('.')[0];
    console.log(`Uploading to Cloudinary folder: ecommerce_products/${gender}/${category}`);
    return {
      folder: `ecommerce_products/${gender}/${category}`,
      format: file.mimetype.split('/')[1], // Preserve original format
      public_id: `product-${public_id_base}-${Date.now()}`,
    };
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    console.log(`File upload attempt: name=${file.originalname}, mimetype=${file.mimetype}`);
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and GIF are allowed.`);
      console.error(`File rejected: name=${file.originalname}, mimetype=${file.mimetype}`);
      cb(error, false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

module.exports = {
  cloudinary,
  upload,
};