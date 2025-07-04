const mongoose = require("mongoose");

const contentPageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["privacy-policy", "terms-of-service", "faq", "size-guide", "custom"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  content: {
    type: String, // HTML or Markdown
    required: true,
  },
  status: {
    type: String,
    enum: ["published", "draft"],
    default: "published",
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model("ContentPage", contentPageSchema); 