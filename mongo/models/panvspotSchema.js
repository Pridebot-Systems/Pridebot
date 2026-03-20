const mongoose = require("mongoose");

const pvpPollSchema = new mongoose.Schema({
  pots: { type: Number, default: 0 },
  pans: { type: Number, default: 0 },
  voters: [
    {
      userId: { type: String, required: true },
      choice: { type: String, enum: ["pots", "pans"], required: true },
    },
  ],
});

module.exports = mongoose.model("potvspans", pvpPollSchema);
