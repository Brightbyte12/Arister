const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const { protect, admin } = require("../middleware/authMiddleware");
const asyncHandler = require("express-async-handler");

// GET all categories
router.get("/",  asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().lean();
    console.log("Fetched categories:", categories);
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
}));

// POST new category
router.post("/", protect, admin, asyncHandler(async (req, res) => {
  try {
    const { name } = req.body;
    console.log("POST /api/categories received:", { name });

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check if category already exists
    let category = await Category.findOne({ name });
    if (category) {
      return res.status(400).json({ message: `Category "${name}" already exists` });
    }

    category = new Category({ name });
    const newCategory = await category.save();
    res.status(201).json(newCategory);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
}));

// PUT update category
router.put("/:id", protect, admin, asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      console.log("PUT /api/categories/:id received:", { id, name });
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
  
      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }
  
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
  
      const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
      if (existingCategory) {
        return res.status(400).json({ message: `Category "${name}" already exists` });
      }
  
      category.name = name;
      category.updatedAt = Date.now();
      const updatedCategory = await category.save();
      res.json(updatedCategory);
    } catch (err) {
      console.error("Error updating category:", err);
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }));
  
  // DELETE category
  router.delete("/:id", protect, admin, asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      console.log("DELETE /api/categories/:id received:", { id });
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
  
      const category = await Category.findByIdAndDelete(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
  
      res.json({ message: "Category deleted successfully" });
    } catch (err) {
      console.error("Error deleting category:", err);
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }));
module.exports = router;