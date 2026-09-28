const mongoose = require("mongoose");

const blockedTermSchema = new mongoose.Schema({
  terms: { type: [String], default: [] },
});

module.exports = mongoose.model("BlockedTerm", blockedTermSchema);
