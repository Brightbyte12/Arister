const express = require('express');
const router = express.Router();
const ContentPage = require('../models/ContentPage');
const {protect,admin} = require('../middleware/authMiddleware');

// Get all content pages (admin)
router.get('/', protect,admin, async (req, res) => {
  try {
    const pages = await ContentPage.find().sort({ lastModified: -1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content pages.' });
  }
});

// Get a content page by slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    const page = await ContentPage.findOne({ slug: req.params.slug, status: 'published' });
    if (!page) return res.status(404).json({ error: 'Page not found.' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content page.' });
  }
});

// Create a new content page (admin)
router.post('/',  protect,admin, async (req, res) => {
  try {
    const { type, title, slug, content, status } = req.body;
    const page = new ContentPage({
      type,
      title,
      slug,
      content,
      status,
      updatedBy: req.user._id,
    });
    await page.save();
    res.status(201).json(page);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create content page.' });
  }
});

// Update a content page (admin)
router.put('/:id',  protect,admin, async (req, res) => {
  try {
    const { type, title, slug, content, status } = req.body;
    const page = await ContentPage.findByIdAndUpdate(
      req.params.id,
      {
        type,
        title,
        slug,
        content,
        status,
        lastModified: Date.now(),
        updatedBy: req.user._id,
      },
      { new: true }
    );
    if (!page) return res.status(404).json({ error: 'Page not found.' });
    res.json(page);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update content page.' });
  }
});

// Delete a content page (admin)
router.delete('/:id', protect,admin, async (req, res) => {
  try {
    const page = await ContentPage.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found.' });
    res.json({ message: 'Content page deleted.' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete content page.' });
  }
});

module.exports = router; 