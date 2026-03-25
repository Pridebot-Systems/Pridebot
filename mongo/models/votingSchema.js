const mongoose = require("mongoose");

const userVotingSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  overallUserVotes: { type: Number, default: 0 },
  votingTopGG: { type: Number, default: 0 },
  votingWumpus: { type: Number, default: 0 },
  votingBotList: { type: Number, default: 0 },
  votingDiscords: { type: Number, default: 0 },
  votingDiscordListGG: { type: Number, default: 0 },
});

const votingSchema = new mongoose.Schema({
  votingUsers: [userVotingSchema],
  votingAmount: {
    OverallTotal: { type: Number, default: 0 },
    TopGGTotal: { type: Number, default: 0 },
    WumpusTotal: { type: Number, default: 0 },
    BotListTotal: { type: Number, default: 0 },
    DiscordsTotal: { type: Number, default: 0 },
    DiscordListGGTotal: { type: Number, default: 0 },
  },
});

module.exports = mongoose.model("Voting", votingSchema);
