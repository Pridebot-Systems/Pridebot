const { CommandUsage, Profile, Voting } = require("../../../DB");
const { stats: contract } = require("../../../Shared");
const { getApproximateUserInstallCount } = require("./user_install");
const { getRegisteredCommandsCount } = require("../commands/registercommand");

/**
 * The numbers behind GET /stats, the /stats command, and the nightly Sheets export.
 *
 * V1 computed these only inside botapi. The /stats command and the Sheets cron then
 * fetched them back over the network from https://api.pridebot.xyz/stats — always
 * PRODUCTION, even from beta, and dead whenever the public API was. All three now
 * call getStats() in-process. Each cluster keeps its own short-lived cache; the
 * computation works from any cluster because the counts come from broadcastEval.
 */

const TTL_MS = 2 * 60 * 1000;
let cached = null;
let cachedAt = 0;
let inflight = null;

async function computeStats(client) {
  const perCluster = await client.cluster.broadcastEval((c) => ({
    guildCount: c.guilds.cache.size,
    userCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
  }));
  const usages = await CommandUsage.find({}, { count: 1, guildCount: 1, userContextCount: 1 }).lean();
  const sum = (key) => usages.reduce((acc, u) => acc + (u[key] || 0), 0);
  const voting = await Voting.findOne({}, { votingAmount: 1 }).lean();
  const totals = voting?.votingAmount || {};

  const stats = {
    totalUserCount: perCluster.reduce((acc, r) => acc + r.userCount, 0),
    currentGuildCount: perCluster.reduce((acc, r) => acc + r.guildCount, 0),
    UserInstallCount: await getApproximateUserInstallCount(),
    profileAmount: await Profile.countDocuments(),
    totalUsage: sum("count"),
    // V1 added 2 to the registered count; kept so the published number doesn't drop.
    commandsCount: (await getRegisteredCommandsCount(client)) + 2,
    totalGuildCount: sum("guildCount"),
    totalUserContextCount: sum("userContextCount"),
    botuptime: client.botStartTime,
    ping: client.ws.ping,
    vote: {
      votingtotal: totals.OverallTotal || 0,
      topggtoal: totals.TopGGTotal || 0,
      wumpustotal: totals.WumpusTotal || 0,
      botlisttotal: totals.BotListTotal || 0,
      discordlistggtotal: totals.DiscordListGGTotal || 0,
    },
  };

  // Three consumers read these field names; fail loudly rather than serve a
  // payload that silently breaks one of them.
  return contract.assertStatsShape(stats);
}

/** Cached stats; recomputes when older than maxAgeMs. Concurrent callers share one run. */
async function getStats(client, { maxAgeMs = TTL_MS } = {}) {
  if (cached && Date.now() - cachedAt < maxAgeMs) return cached;
  if (!inflight) {
    inflight = computeStats(client)
      .then((stats) => {
        cached = stats;
        cachedAt = Date.now();
        return stats;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** The last computed stats without triggering work, or null. */
function peekStats() {
  return cached ? { stats: cached, ageMs: Date.now() - cachedAt } : null;
}

module.exports = { getStats, peekStats, computeStats };
