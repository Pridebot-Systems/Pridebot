const mongoose = require("mongoose");

const radarEntrySchema = new mongoose.Schema({
  userid: { type: String, required: true },
  meter: { type: mongoose.Schema.Types.Mixed, required: true },
});

const idDarSchema = new mongoose.Schema({
  gaydar: {
    type: [radarEntrySchema],
    default: [],
  },
  transdar: {
    type: [radarEntrySchema],
    default: [],
  },
  queerdar: {
    type: [radarEntrySchema],
    default: [],
  },
  rizzdar: {
    type: [radarEntrySchema],
    default: [],
  },
  lesdar: {
    type: [radarEntrySchema],
    default: [],
  },
  bidar: {
    type: [radarEntrySchema],
    default: [],
  },
});

module.exports = mongoose.model("DarList", idDarSchema);
