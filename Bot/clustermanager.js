const path = require("path");
const { ClusterManager } = require("discord-hybrid-sharding");
const config = require("../environment");

/**
 * Entry point (npm start). Spawns Bot/index.js once per cluster.
 *
 * V1 called manager.respawn(cluster.id) from the "death" and "exit" listeners.
 * manager.respawn is the boolean `respawn` OPTION, not a method, so the "death"
 * listener threw a TypeError inside the library's exit handler — before the
 * library's own respawn line ran — and crashed this manager process, taking every
 * cluster down with it. One cluster dying became a full outage that only recovered
 * because pm2 restarted the manager. The "exit" and "disconnect" listeners never
 * fired: Cluster emits only spawn, ready, death, message, and error.
 *
 * Respawning is the library's job (respawn: true, capped by restarts.max).
 */

const manager = new ClusterManager(path.join(__dirname, "index.js"), {
  totalShards: "auto",
  shardsPerClusters: 5,
  mode: "process",
  token: config.token,
  respawn: true,
  restarts: { max: 5, interval: 60 * 60 * 1000 },
});

manager.on("clusterCreate", (cluster) => {
  console.log(`[CLUSTER] Launched cluster ${cluster.id}`);

  cluster.on("ready", () => console.log(`[CLUSTER] Cluster ${cluster.id} is ready ✅`));
  cluster.on("death", () =>
    console.error(`[CLUSTER] Cluster ${cluster.id} died — library will respawn it 💥`)
  );
  cluster.on("error", (err) =>
    console.error(`[CLUSTER] Cluster ${cluster.id} error:`, err?.message || err)
  );
});

manager.on("debug", (msg) => console.log(`[DHS] ${msg}`));

/**
 * Graceful stop. In Docker only PID 1 receives `docker stop`'s SIGTERM; the
 * cluster processes must be told explicitly, or they are SIGKILLed when the grace
 * period ends and never record their shutdown time. Respawning is switched off
 * first — the library would otherwise restart each cluster as it exits.
 */
const SHUTDOWN_TIMEOUT_MS = 20_000;
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[CLUSTER] ${signal} received — stopping ${manager.clusters.size} cluster(s)`);
  manager.respawn = false;

  const exits = [...manager.clusters.values()].map((cluster) => {
    const child = cluster.thread?.process;
    if (!child || child.exitCode !== null) return Promise.resolve();
    const exited = new Promise((resolve) => child.once("exit", resolve));
    // On Windows, kill() is TerminateProcess — no handler runs. A console Ctrl+C
    // already reaches every process there, so just wait for them to exit.
    if (process.platform !== "win32") child.kill("SIGTERM"); // index.js records shutdown time
    return exited;
  });

  const timedOut = await Promise.race([
    Promise.all(exits).then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), SHUTDOWN_TIMEOUT_MS)),
  ]);
  if (timedOut) console.warn("[CLUSTER] Clusters did not exit in time — forcing shutdown");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// 7s+ between cluster logins avoids global rate limits on /gateway/bot.
manager.spawn({ amount: "auto", delay: 7000, timeout: -1 }).catch((err) => {
  console.error("[CLUSTER] Spawn failed:", err);
  process.exit(1);
});
