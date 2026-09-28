const Voting = require("../../../DB/models/votingSchema");

/**
 * Vote counting on the single Voting document.
 *
 * V1 loaded the whole document (every voter ever), mutated it in memory, and
 * saved it back. Two votes arriving together each saved their own copy, and the
 * later save erased the earlier vote. Every write here is an atomic $inc/$push,
 * and reads project only the one voter they need.
 */

const PLATFORMS = {
  TopGG: { userField: "votingTopGG", totalField: "TopGGTotal" },
  Wumpus: { userField: "votingWumpus", totalField: "WumpusTotal" },
  BotList: { userField: "votingBotList", totalField: "BotListTotal" },
  Discords: { userField: "votingDiscords", totalField: "DiscordsTotal" },
  DiscordListGG: { userField: "votingDiscordListGG", totalField: "DiscordListGGTotal" },
};

async function votingDocId() {
  const doc = await Voting.findOneAndUpdate(
    {},
    { $setOnInsert: { votingUsers: [] } },
    { upsert: true, new: true, projection: { _id: 1 } }
  ).lean();
  return doc._id;
}

/**
 * Record one vote. Resolves to { userVotes, platformTotal } for the thank-you
 * embed: this user's count on the platform and the platform's running total.
 */
async function updateVotingStats(userId, platform, attempt = 0) {
  const spec = PLATFORMS[platform];
  if (!spec) throw new Error(`Unknown voting platform: ${platform}`);
  const { userField, totalField } = spec;
  const _id = await votingDocId();
  const totals = { "votingAmount.OverallTotal": 1, [`votingAmount.${totalField}`]: 1 };

  const bumped = await Voting.updateOne(
    { _id, "votingUsers.userId": userId },
    {
      $inc: {
        ...totals,
        "votingUsers.$.overallUserVotes": 1,
        [`votingUsers.$.${userField}`]: 1,
      },
    }
  );

  if (!bumped.matchedCount) {
    const added = await Voting.updateOne(
      { _id, "votingUsers.userId": { $ne: userId } },
      { $inc: totals, $push: { votingUsers: { userId, overallUserVotes: 1, [userField]: 1 } } }
    );
    // Lost a race with this user's own concurrent first vote: they exist now.
    if (!added.matchedCount) {
      if (attempt >= 2) throw new Error(`Could not record vote for ${userId}`);
      return updateVotingStats(userId, platform, attempt + 1);
    }
  }

  const doc = await Voting.findById(_id, {
    votingAmount: 1,
    votingUsers: { $elemMatch: { userId } },
  }).lean();
  return {
    userVotes: doc?.votingUsers?.[0]?.[userField] ?? 1,
    platformTotal: doc?.votingAmount?.[totalField] ?? 0,
  };
}

/** One voter's record, or null. */
async function getUserVotes(userId) {
  const doc = await Voting.findOne(
    { "votingUsers.userId": userId },
    { votingUsers: { $elemMatch: { userId } } }
  ).lean();
  return doc?.votingUsers?.[0] ?? null;
}

module.exports = { updateVotingStats, getUserVotes, PLATFORMS };
