// models/Chain.js
const { Schema, model } = require("mongoose");

const ChainSchema = new Schema({
  initiator: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const GayUserSchema = new Schema({
  userId: { type: String, required: true },
  chain: { type: Schema.Types.ObjectId, ref: "Chain", required: true },
  parent: { type: String, default: null },
  children: { type: [String], default: [] },
  level: { type: Number, required: true },
});

GayUserSchema.index({ userId: 1 }, { unique: true });

module.exports = {
  Chain: model("Chain", ChainSchema),
  User: model("GayUser", GayUserSchema),
};
