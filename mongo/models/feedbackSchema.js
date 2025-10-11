const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    guildId: {
      type: String,
      required: false, // Can be null for DM feedback
    },
    guildName: {
      type: String,
      required: false, // Can be null for DM feedback
    },
    feedback: {
      type: String,
      required: true,
      maxlength: 1000, // Limit feedback length
    },
    category: {
      type: String,
      enum: ["general", "bug", "feature", "improvement", "other"],
      default: "general",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "implemented", "declined"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);