const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Order = require('../models/order');
const {protect} = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

// Get all reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    const skip = (page - 1) * limit;
    
    let sortOption = {};
    switch (sort) {
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'highest':
        sortOption = { rating: -1 };
        break;
      case 'lowest':
        sortOption = { rating: 1 };
        break;
      case 'helpful':
        sortOption = { helpful: -1 };
        break;
      default: // newest
        sortOption = { createdAt: -1 };
    }

    const reviews = await Review.find({ 
      productId, 
      isActive: true 
    })
    .sort(sortOption)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'name avatar');

    const total = await Review.countDocuments({ productId, isActive: true });

    // Calculate average rating and stats
    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), isActive: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingCounts: {
            $push: '$rating'
          }
        }
      }
    ]);

    const ratingStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0) {
      stats[0].ratingCounts.forEach(rating => {
        ratingStats[rating]++;
      });
    }

    res.json({
      reviews: reviews.map(review => ({
        id: review._id,
        productId: review.productId,
        userId: review.userId._id,
        userName: review.userName,
        userAvatar: review.userAvatar || review.userId.avatar,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verified: review.verified,
        size: review.size,
        color: review.color,
        helpful: review.helpful,
        date: review.createdAt,
        updatedAt: review.updatedAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasMore: skip + reviews.length < total
      },
      stats: {
        averageRating: stats.length > 0 ? stats[0].averageRating : 0,
        totalReviews: stats.length > 0 ? stats[0].totalReviews : 0,
        ratingStats
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Check if user can review a product (has purchased it)
router.get('/can-review/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return res.json({
        canReview: false,
        reason: 'already_reviewed',
        existingReview: {
          id: existingReview._id,
          rating: existingReview.rating,
          title: existingReview.title,
          comment: existingReview.comment,
          size: existingReview.size,
          color: existingReview.color
        }
      });
    }

    // Check if user has purchased this product
    const order = await Order.findOne({
      user: userId,
      'items.id': productId,
      status: { $regex: /^(pending|confirmed|delivered|completed)$/i }
    });

    if (!order) {
      return res.json({
        canReview: false,
        reason: 'not_purchased'
      });
    }

    res.json({
      canReview: true,
      reason: 'eligible'
    });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({ message: 'Failed to check review eligibility' });
  }
});

// Create a new review
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, rating, title, comment, size } = req.body;

    // Validate required fields
    if (!productId || !rating || !comment) {
      return res.status(400).json({ message: 'Product ID, rating, and comment are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    // Check if user has purchased this product
    const order = await Order.findOne({
      user: userId,
      'items.id': productId,
      status: { $regex: /^(pending|confirmed|delivered|completed)$/i }
    });

    if (!order) {
      return res.status(403).json({ message: 'You can only review products you have purchased' });
    }

    const review = new Review({
      productId,
      userId,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      rating,
      title: title || '',
      comment,
      verified: true, // Since they purchased the product
      size: size || ''
    });

    await review.save();

    res.status(201).json({
      message: 'Review submitted successfully',
      review: {
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        userName: review.userName,
        userAvatar: review.userAvatar,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verified: review.verified,
        size: review.size,
        helpful: review.helpful,
        date: review.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

// Update a review
router.put('/:reviewId', protect, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const { rating, title, comment, size } = req.body;

    const review = await Review.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.size = size || review.size;

    await review.save();

    res.json({
      message: 'Review updated successfully',
      review: {
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        userName: review.userName,
        userAvatar: review.userAvatar,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verified: review.verified,
        size: review.size,
        helpful: review.helpful,
        date: review.createdAt,
        updatedAt: review.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Failed to update review' });
  }
});

// Delete a review
router.delete('/:reviewId', protect, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Soft delete
    review.isActive = false;
    await review.save();

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
});

// Mark review as helpful
router.post('/:reviewId/helpful', protect, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const hasMarkedHelpful = review.helpfulUsers.includes(userId);
    
    if (hasMarkedHelpful) {
      // Remove helpful mark
      review.helpfulUsers = review.helpfulUsers.filter(id => id.toString() !== userId.toString());
      review.helpful = Math.max(0, review.helpful - 1);
    } else {
      // Add helpful mark
      review.helpfulUsers.push(userId);
      review.helpful += 1;
    }

    await review.save();

    res.json({
      message: hasMarkedHelpful ? 'Removed helpful mark' : 'Marked as helpful',
      helpful: review.helpful
    });
  } catch (error) {
    console.error('Error marking review helpful:', error);
    res.status(500).json({ message: 'Failed to mark review helpful' });
  }
});

module.exports = router;