const mongoose = require("mongoose");

const pendingPatronSchema = new mongoose.Schema(
  {
    patreonMemberId: { type: String, required: true, unique: true },
    patronName: { type: String, default: "Unknown Patron" },
    tierId: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingPatron", pendingPatronSchema);
