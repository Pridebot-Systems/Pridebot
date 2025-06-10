require("dotenv").config();
const { ClusterManager } = require("discord-hybrid-sharding");

const manager = new ClusterManager(`${__dirname}/index.js`, {
  totalShards: "auto",
  shardsPerClusters: 3,
  totalClusters: "auto",
  mode: "process",
  token: process.env.token,
});

manager.on("clusterCreate", (cluster) => {
  console.log(`[CLUSTER] Launched Cluster ${cluster.id}`);

  cluster.on("ready", () => {
    console.log(`[CLUSTER] Cluster ${cluster.id} is ready ✅`);
  });

  cluster.on("death", () => {
    console.error(`[CRASH] Cluster ${cluster.id} has died 💥`);
    manager.respawn(cluster.id);
  });

  cluster.on("exit", (code, signal) => {
    console.warn(
      `[EXIT] Cluster ${cluster.id} exited with code ${code} and signal ${signal}`
    );
    if (code !== 0) {
      console.log(`[EXIT] Respawning Cluster ${cluster.id}...`);
      manager.respawn(cluster.id);
    }
  });

  cluster.on("disconnect", () => {
    console.warn(
      `[DISCONNECT] Cluster ${cluster.id} disconnected from manager`
    );
  });
});

manager.on("debug", (msg) => {
  console.log(`[DHS DEBUG] ${msg}`);
});

setInterval(() => {
  console.log(
    `[HEARTBEAT] ClusterManager alive at ${new Date().toLocaleTimeString()}`
  );
}, 60_000);

manager.spawn({
  amount: "auto",
  delay: 5000,
  timeout: -1,
});
