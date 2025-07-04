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
    const gender = sanitizeFolderName(req.body.category === 'men' ? 'men' : req.body.category === 'women' ? 'women' : 'unisex');
    const category = sanitizeFolderName(req.body.category || 'general');
    const public_id_base = file.originalname.split('.')[0];
    console.log(`Uploading to Cloudinary folder: ecommerce_products/${gender}/${category}`);
    return {
      folder: `ecommerce_products/${gender}/${category}`,
      format: file.mimetype.split('/')[1], // Preserve original format
      public_id: `category-${public_id_base}-${Date.now()}`,
      resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    };
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    console.log(`File upload attempt: name=${file.originalname}, mimetype=${file.mimetype}`);
    if (allowedImageTypes.includes(file.mimetype) || (req.body.contentType === 'video' && allowedVideoTypes.includes(file.mimetype))) {
      cb(null, true);
    } else {
      const error = new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, GIF, MP4, WebM, or OGG are allowed.`);
      console.error(`File rejected: name=${file.originalname}, mimetype=${file.mimetype}`);
      cb(error, false);
    }
  },
  limits: {
    fileSize: req => req.body.contentType === 'video' ? 10 * 1024 * 1024 : 5 * 1024 * 1024, // 10MB for videos, 5MB for images
  },
});

module.exports = {
  cloudinary,
  upload,
};