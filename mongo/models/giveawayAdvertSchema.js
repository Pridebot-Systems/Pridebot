const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const GiveawayAdvertSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  lastSeen: { type: Date, default: Date.now },
});

module.exports = {
  GiveawayAdvert: model("GiveawayAdvert", GiveawayAdvertSchema),
};
