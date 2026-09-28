const { AutoPoster } = require("topgg-autoposter");
const { CLIENT_ID } = require("../../../Shared");
const config = require("../../../environment");

/**
 * Server-count posting to bot lists. Production only, cluster 0 only.
 *
 * V1 split this across index.js (three inline posters + Top.gg) and
 * discordsguild.js, with three problems fixed here:
 *   - Top.gg's AutoPoster was created on EVERY cluster, so each one posted the
 *     same cross-cluster total — N identical requests per interval.
 *   - DELLY read config.DELLYToken, which never existed, so it sent
 *     `Authorization: undefined` every 15 minutes. Lists with no token are now
 *     skipped and reported once at startup.
 *   - discords.com never checked response.ok, so rejections were silent.
 *
 * Lists are keyed by CLIENT_ID (the production listing), not config.clientId.
 */

const INTERVAL_MS = 15 * 60 * 1000;

async function totalGuilds(client) {
  const counts = await client.cluster.fetchClientValues("guilds.cache.size");
  return counts.reduce((a, b) => a + b, 0);
}

async function post(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
}

const LISTS = [
  {
    name: "discords.com",
    token: () => config.botLists.discordsToken,
    send: (token, guilds) =>
      post(`https://discords.com/bots/api/bot/${CLIENT_ID}/setservers`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ server_count: guilds }),
      }),
  },
  {
    name: "botlist.me",
    token: () => config.botLists.botlistToken,
    send: (token, guilds, shards) =>
      post(`https://api.botlist.me/api/v1/bots/${CLIENT_ID}/stats`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ server_count: guilds, shard_count: shards }),
      }),
  },
  {
    name: "discordlist.gg",
    token: () => config.botLists.discordlistggToken,
    send: (token, guilds) =>
      post(`https://api.discordlist.gg/v0/bots/${CLIENT_ID}/guilds?count=${guilds}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  {
    name: "DELLY",
    token: () => config.botLists.dellyToken,
    send: (token, guilds, shards) =>
      post(`https://api.discordextremelist.xyz/v2/bot/${CLIENT_ID}/stats`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ guildCount: guilds, shardCount: shards }),
      }),
  },
];

async function postAll(client, lists) {
  const guilds = await totalGuilds(client);
  const shards = client.cluster.info.TOTAL_SHARDS;
  for (const list of lists) {
    try {
      await list.send(list.token(), guilds, shards);
      console.log(`[BOTLISTS] ${list.name}: posted ${guilds} guilds`);
    } catch (err) {
      console.error(`[BOTLISTS] ${list.name} failed:`, err.message);
    }
  }
}

function startTopgg(client) {
  if (!config.botLists.topggToken) return false;
  const poster = AutoPoster(config.botLists.topggToken, client);
  poster.getStats = async () => ({
    serverCount: await totalGuilds(client),
    shardCount: client.cluster.info.TOTAL_SHARDS,
  });
  poster.on("error", (err) => console.error("[BOTLISTS] Top.gg error:", err.message));
  return true;
}

/** Call once, on cluster 0, in production. */
function startBotListPosting(client) {
  const active = LISTS.filter((l) => l.token());
  const skipped = LISTS.filter((l) => !l.token()).map((l) => l.name);
  const topgg = startTopgg(client);
  if (!topgg) skipped.push("Top.gg");

  if (skipped.length) {
    console.warn(`[BOTLISTS] no token configured, skipping: ${skipped.join(", ")}`);
  }
  if (!active.length) return;

  setInterval(() => postAll(client, active), INTERVAL_MS);
  console.log(
    `[BOTLISTS] posting every 15m to: ${[...(topgg ? ["Top.gg"] : []), ...active.map((l) => l.name)].join(", ")}`
  );
}

module.exports = { startBotListPosting };
