/**
 * Shared — the only module Bot/, API/, and Web/ may all import from.
 *
 * Rule: nothing in Shared/ may require anything outside Shared/. It holds facts
 * (constants, contracts, locale strings), never behaviour that needs a database
 * handle, a Discord client, or an Express app. Anything that does belongs in the
 * layer that owns it.
 */

module.exports = {
  ...require("./constants/brand"),
  ...require("./constants/links"),
  badges: require("./constants/badges"),
  tiers: require("./constants/tiers"),
  profile: require("./constants/profile"),
  stats: require("./contracts/stats"),
  locales: require("./locales"),
  paths: require("./paths"),
};
