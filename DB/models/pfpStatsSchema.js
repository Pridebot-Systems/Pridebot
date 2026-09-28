const mongoose = require("mongoose");

const pfpStatsSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: "pfpstats",
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  stats: {
    totalFolders: {
      type: Number,
      default: 0,
    },
    totalFiles: {
      type: Number,
      default: 0,
    },
    emptyFolders: {
      type: Number,
      default: 0,
    },
    foldersWithFiles: {
      type: Number,
      default: 0,
    },
    totalSizeBytes: {
      type: Number,
      default: 0,
    },
    totalSizeMB: {
      type: Number,
      default: 0,
    },
    totalSizeGB: {
      type: Number,
      default: 0,
    },
    averageFilesPerFolder: {
      type: Number,
      default: 0,
    },
    averageFilesPerActiveFolder: {
      type: Number,
      default: 0,
    },
    averageFileSizeMB: {
      type: Number,
      default: 0,
    },
    largestFolder: {
      name: String,
      fileCount: Number,
      sizeMB: Number,
    },
    oldestFolder: {
      name: String,
      createdDate: Date,
    },
    newestFolder: {
      name: String,
      createdDate: Date,
    },
    oldestEmptyFolders: [{
      name: String,
      createdDate: Date,
    }],
  },
});

module.exports = mongoose.model("PfpStats", pfpStatsSchema);
