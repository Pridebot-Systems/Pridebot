const mongoose = require("mongoose");

const avatarGenerationSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  flagCombination: {
    type: String,
    required: true,
    index: true
  },
  flags: {
    primary: {
      type: String,
      required: true
    },
    secondary: {
      type: String,
      default: null
    }
  },
  performance: {
    processingTime: {
      type: Number,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    cacheHit: {
      type: Boolean,
      default: false
    },
    totalCommandTime: {
      type: Number,
      default: 0
    }
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // 30 days TTL
  },
  serverInfo: {
    cluster: String,
    nodeVersion: String,
    memoryUsage: Number
  }
});

// Indexes for better query performance
avatarGenerationSchema.index({ generatedAt: -1 });
avatarGenerationSchema.index({ "flags.primary": 1, "flags.secondary": 1 });
avatarGenerationSchema.index({ "performance.processingTime": -1 });

// Static methods for analytics
avatarGenerationSchema.statics.getPopularFlags = async function(limit = 10) {
  return this.aggregate([
    {
      $group: {
        _id: "$flags.primary",
        count: { $sum: 1 },
        avgProcessingTime: { $avg: "$performance.processingTime" },
        avgFileSize: { $avg: "$performance.fileSize" }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

avatarGenerationSchema.statics.getPerformanceStats = async function(hours = 24) {
  const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  return this.aggregate([
    { $match: { generatedAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        totalGenerations: { $sum: 1 },
        avgProcessingTime: { $avg: "$performance.processingTime" },
        maxProcessingTime: { $max: "$performance.processingTime" },
        minProcessingTime: { $min: "$performance.processingTime" },
        avgFileSize: { $avg: "$performance.fileSize" },
        cacheHitRate: { 
          $avg: { $cond: ["$performance.cacheHit", 1, 0] } 
        }
      }
    }
  ]);
};

avatarGenerationSchema.statics.getFlagCombinationStats = async function() {
  return this.aggregate([
    {
      $group: {
        _id: {
          primary: "$flags.primary",
          secondary: "$flags.secondary"
        },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: "$performance.processingTime" }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);
};

module.exports = mongoose.model("AvatarGeneration", avatarGenerationSchema);