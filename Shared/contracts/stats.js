const STATS_FIELDS = [
  "totalUserCount",
  "currentGuildCount",
  "totalGuildCount",
  "UserInstallCount",
  "totalUserContextCount",
  "profileAmount",
  "totalUsage",
  "commandsCount",
  "version",
  "botuptime",
  "ping",
  "vote",
];

const VOTE_FIELDS = [
  "votingtotal",
  "topggtoal", // NOTE: misspelling is load-bearing — the website and Sheets read this key.
  "wumpustotal",
  "botlisttotal",
  "discordlistggtotal",
];

/** Throws if a stats payload is missing a field a consumer depends on. */
function assertStatsShape(payload) {
  const missing = STATS_FIELDS.filter((f) => !(f in payload));
  if (missing.length) {
    throw new Error(`[stats] payload missing contracted fields: ${missing.join(", ")}`);
  }
  const missingVote = VOTE_FIELDS.filter((f) => !(f in (payload.vote || {})));
  if (missingVote.length) {
    throw new Error(`[stats] vote payload missing fields: ${missingVote.join(", ")}`);
  }
  return payload;
}

module.exports = { STATS_FIELDS, VOTE_FIELDS, assertStatsShape };
