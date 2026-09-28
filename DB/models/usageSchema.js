const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema({
  commandName: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
    default: 0,
  },
  guildCount: {
    type: Number,
    required: true,
    default: 0,
  },
  userContextCount: {
    type: Number,
    required: true,
    default: 0,
  },
});

module.exports = mongoose.model("CommandUsage", usageSchema);
