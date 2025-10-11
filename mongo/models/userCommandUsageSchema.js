const mongoose = require("mongoose");

const userCommandUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    commandsUsed: [{
      commandName: {
        type: String,
        required: true,
      },
      firstUsedAt: {
        type: Date,
        default: Date.now,
      },
      usageCount: {
        type: Number,
        default: 1,
      },
    }],
    feedbackPromptShown: {
      type: Boolean,
      default: false,
    },
    feedbackPromptShownAt: {
      type: Date,
      required: false,
    },
    hasSentFeedback: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
userCommandUsageSchema.index({ userId: 1 });
userCommandUsageSchema.index({ "commandsUsed.commandName": 1 });

module.exports = mongoose.model("UserCommandUsage", userCommandUsageSchema);