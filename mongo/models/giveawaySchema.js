const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const GiveawaySchema = new Schema({
  entrants: { type: [String], default: [] },
  endTime: { type: Date, required: true },
});

module.exports = { Giveaway: model("Giveaway", GiveawaySchema) };
