/**
 * The checks the monitor runs each cycle.
 */

/**
 * Runs INSIDE a cluster process via cluster.eval, with `client` = the discord.js
 * Client. It is serialised to a string, so it must not reference anything outside
 * its own body.
 */
function clusterSnapshot(client) {
  const guildsPerShard = {};
  let members = 0;
  for (const guild of client.guilds.cache.values()) {
    guildsPerShard[guild.shardId] = (guildsPerShard[guild.shardId] || 0) + 1;
    members += guild.memberCount || 0;
  }
  const memory = process.memoryUsage();
  return {
    ready: client.isReady(),
    uptime: process.uptime(),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    guilds: client.guilds.cache.size,
    members,
    shards: [...client.ws.shards.values()].map((shard) => ({
      id: shard.id,
      status: shard.status,
      ping: shard.ping,
      lastPingAt: shard.lastPingTimestamp,
      guilds: guildsPerShard[shard.id] || 0,
    })),
  };
}

/** GET `url`; never throws. */
async function checkHttp(url, timeoutMs) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer().catch(() => null);
    return { ok: res.ok, httpStatus: res.status, latency: Date.now() - started };
  } catch (err) {
    const error =
      err.name === "TimeoutError" ? `no response in ${timeoutMs / 1000}s` : err.message;
    return { ok: false, httpStatus: null, latency: null, error };
  }
}

/** Discord's own status (discordstatus.com), so a Discord outage is visible as such. */
async function checkDiscord(timeoutMs) {
  try {
    const res = await fetch("https://discordstatus.com/api/v2/summary.json", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      indicator: data.status?.indicator ?? "unknown",
      description: data.status?.description ?? "Unknown",
      incidents: (data.incidents || []).slice(0, 3).map((incident) => ({
        name: incident.name,
        status: incident.status,
        url: incident.shortlink,
      })),
    };
  } catch {
    return null;
  }
}

module.exports = { clusterSnapshot, checkHttp, checkDiscord };
