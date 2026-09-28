/**
 * Model registry. Import models from here rather than by relative path so the
 * file layout can change without touching 17 call sites (V1's idSchema had that
 * many importers, each with its own ../../../ path).
 */

const { connect, disconnect, mongoose } = require("./connect");

module.exports = {
  connect,
  disconnect,
  mongoose,

  Profile: require("./models/profileSchema"),
  IDLists: require("./models/idSchema"),
  CommandUsage: require("./models/usageSchema"),
  UserCommandUsage: require("./models/userCommandUsageSchema"),
  Voting: require("./models/votingSchema"),
  DarList: require("./models/idDarSchema"),
  AvatarGeneration: require("./models/avatarGenerationSchema"),
  Blacklist: require("./models/blacklistSchema"),
  BlockedTerm: require("./models/blockedtermSchema"),
  Feedback: require("./models/feedbackSchema"),
  PanVsPot: require("./models/panvspotSchema"),
  PendingPatron: require("./models/pendingPatronSchema"),
  PfpStats: require("./models/pfpStatsSchema"),
  ProfileFeedback: require("./models/profileFeedbackSchema"),
  // NOTE: V1's reviewSchema.js is intentionally not carried over — zero importers.
};
