/**
 * The `GET /stats` response contract.
 *
 * Three independent consumers read these exact field names:
 *   - the README shields.io badges
 *   - the website homepage counters (botstats.js)
 *   - the nightly Google Sheets export (statsapi)
 * In V1 the shape existed only as an object literal inside botapi.js, so renaming
 * a field broke the site and the spreadsheet with no warning. Declaring it here
 * makes the contract explicit and lets the API assert against it before serving.
 */

const STATS_FIELDS = [
  "totalUserCount",
  "currentGuildCount",
  "totalGuildCount",
  "UserInstallCount",
  "totalUserContextCount",
  "profileAmount",
  "totalUsage",
  "commandsCount",
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
