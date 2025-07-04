const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
const { protect, admin } = require('../middleware/authMiddleware');
const CategoryImage = require('../models/CategoryImage');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    console.log(`File upload attempt: name=${file.originalname}, mimetype=${file.mimetype}`);
    if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, MP4, WebM, or OGG allowed.'), false);
    }
  },
}).array('file', 4);

router.get('/', async (req, res) => {
  try {
    const images = await CategoryImage.find();
    console.log('Returning category images:', images);
    res.status(200).json(images);
  } catch (error) {
    console.error('Error fetching category images:', error);
    res.status(500).json({ message: 'Server error fetching images', error: error.message });
  }
});

router.post('/', protect, admin, upload, async (req, res) => {
  try {
    const { category, contentType } = req.body;
    console.log('Received POST request:', { category, contentType, files: req.files?.length });

    if (!category || !contentType) {
      console.error('Missing category or contentType');
      return res.status(400).json({ message: 'Category and contentType are required' });
    }

    if (!req.files || req.files.length === 0) {
      console.error('No files uploaded');
      return res.status(400).json({ message: 'No files uploaded' });
    }

    let response = { category, contentType, imageUrls: [], videoUrl: '', videoPublicId: '' };

    if (contentType === 'video') {
      if (req.files.length > 1) {
        console.error('Multiple videos uploaded');
        return res.status(400).json({ message: 'Only one video allowed' });
      }
      const file = req.files[0];
      if (!['video/mp4', 'video/webm', 'video/ogg'].includes(file.mimetype)) {
        console.error('Invalid video format:', file.mimetype);
        return res.status(400).json({ message: 'Invalid video format' });
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: `category/${category}` },
        async (error, result) => {
          if (error) {
            console.error('Cloudinary video upload error:', error);
            return res.status(500).json({ message: 'Video upload failed', error: error.message });
          }
          response.videoUrl = result.secure_url;
          response.videoPublicId = result.public_id;
          console.log('Video uploaded to Cloudinary:', response);

          try {
            const updatedImage = await CategoryImage.findOneAndUpdate(
              { category },
              { ...response, imageUrls: [] },
              { upsert: true, new: true }
            );
            console.log('Video saved to database for category:', category, updatedImage);
            res.status(200).json(updatedImage);
          } catch (dbError) {
            console.error('Database error saving video:', dbError);
            res.status(500).json({ message: 'Database error saving video', error: dbError.message });
          }
        }
      );
      Readable.from(file.buffer).pipe(uploadStream);
    } else {
      // Fetch existing images for the category
      const existing = await CategoryImage.findOne({ category });
      let existingImages = existing && Array.isArray(existing.imageUrls) ? existing.imageUrls : [];

      const uploadPromises = req.files.map(file =>
        new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: `category/${category}` },
            (error, result) => {
              if (error) {
                console.error('Cloudinary image upload error:', error);
                return reject(error);
              }
              resolve({ url: result.secure_url, publicId: result.public_id });
            }
          );
          Readable.from(file.buffer).pipe(uploadStream);
        })
      );
      const uploadedImages = await Promise.all(uploadPromises);
      // Combine old and new images, but keep only the latest 4
      const allImages = [...existingImages, ...uploadedImages].slice(0, 4);
      response.imageUrls = allImages;
      console.log('Images uploaded to Cloudinary:', response);

      try {
        const updatedImage = await CategoryImage.findOneAndUpdate(
          { category },
          { ...response, videoUrl: '', videoPublicId: '' },
          { upsert: true, new: true }
        );
        console.log('Images saved to database for category:', category, updatedImage);
        res.status(200).json(updatedImage);
      } catch (dbError) {
        console.error('Database error saving images:', dbError);
        res.status(500).json({ message: 'Database error saving images', error: dbError.message });
      }
    }
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ message: 'Server error uploading files', error: error.message });
  }
});

// Remove a specific image from a category
router.delete('/:category/image', protect, admin, async (req, res) => {
  try {
    const { category } = req.params;
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ message: 'publicId is required' });
    }

    // Remove from Cloudinary
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });

    // Remove from DB
    const updated = await CategoryImage.findOneAndUpdate(
      { category },
      { $pull: { imageUrls: { publicId } } },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove image', error: error.message });
  }
});

module.exports = router;