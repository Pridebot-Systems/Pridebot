const path = require("path");
const { ClusterManager } = require("discord-hybrid-sharding");
const config = require("../environment");
const { startStatusService } = require("../Status");
const CLUSTER_HEAP_MB = 1536;

const manager = new ClusterManager(path.join(__dirname, "index.js"), {
  totalShards: "auto",
  shardsPerClusters: 5,
  mode: "process",
  token: config.token,
  respawn: true,
  restarts: { max: 5, interval: 60 * 60 * 1000 },
  execArgv: [`--max-old-space-size=${CLUSTER_HEAP_MB}`],
});

let status = null;
try {
  status = startStatusService(manager, { port: config.ports.status });
} catch (err) {
  console.error("[STATUS] Failed to start the status service:", err);
}

manager.on("clusterCreate", (cluster) => {
  console.log(`[CLUSTER] Launched cluster ${cluster.id}`);

  cluster.on("spawn", () => status?.monitor.recordClusterEvent(cluster.id, "spawn"));
  cluster.on("ready", () => {
    console.log(`[CLUSTER] Cluster ${cluster.id} is ready ✅`);
    status?.monitor.recordClusterEvent(cluster.id, "ready");
  });
  cluster.on("death", () => {
    if (stopping) return;
    status?.monitor.recordClusterEvent(cluster.id, "death");
    const { current, max } = cluster.restarts;
    if (current < max) {
      console.error(`[CLUSTER] Cluster ${cluster.id} died — respawning (${current + 1}/${max}) 💥`);
      return;
    }
    console.error(
      `[CLUSTER] Cluster ${cluster.id} died with all ${max} restarts used — ` +
        "exiting so Docker restarts the whole bot"
    );
    status?.monitor.recordClusterEvent(cluster.id, "exhausted");
    shutdown("RESTART LIMIT", { exitCode: 1, clean: false });
  });
  cluster.on("error", (err) =>
    console.error(`[CLUSTER] Cluster ${cluster.id} error:`, err?.message || err)
  );
});

manager.on("debug", (msg) => console.log(`[DHS] ${msg}`));

const SHUTDOWN_TIMEOUT_MS = 20_000;
let stopping = false;

async function shutdown(signal, { exitCode = 0, clean = true } = {}) {
  if (stopping) return;
  stopping = true;
  console.log(`[CLUSTER] ${signal} — stopping ${manager.clusters.size} cluster(s)`);
  manager.respawn = false;
  status?.stop({ clean });

  const exits = [...manager.clusters.values()].map((cluster) => {
    const child = cluster.thread?.process;
    if (!child || child.exitCode !== null) return Promise.resolve();
    const exited = new Promise((resolve) => child.once("exit", resolve));
    if (process.platform !== "win32") child.kill("SIGTERM");
    return exited;
  });

  const timedOut = await Promise.race([
    Promise.all(exits).then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), SHUTDOWN_TIMEOUT_MS)),
  ]);
  if (timedOut) console.warn("[CLUSTER] Clusters did not exit in time — forcing shutdown");
  process.exit(exitCode);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// 7s+ between cluster logins avoids global rate limits on /gateway/bot.
manager.spawn({ amount: "auto", delay: 7000, timeout: -1 }).catch((err) => {
  console.error("[CLUSTER] Spawn failed:", err);
  process.exit(1);
});
