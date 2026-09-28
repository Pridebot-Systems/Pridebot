const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const config = require("../environment");
const DB = require("../DB");
const { DATA_DIR, SHUTDOWN_FILE } = require("../Shared/paths");
const { errorlogging } = require("./utils/logging/errorlogs");
const initializeBot = require("./bot");

/**
 * One cluster process. Spawned by clustermanager.js.
 *
 * Changes from V1:
 *   - The DB connects BEFORE login and a failure exits so the manager respawns
 *     the cluster. V1 connected in parallel and only logged the error; mongoose
 *     does not retry a failed initial connection, so the bot stayed online with
 *     every DB call failing until someone restarted it.
 *   - Bot-list posting moved to functions/bot/botlists.js, started from bot.js.
 *   - The cluster "log" IPC handler is gone — nothing sent those messages;
 *     sendLog routes through broadcastEval instead.
 */

let shuttingDown = false;

function recordShutdown() {
  shuttingDown = true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SHUTDOWN_FILE, Date.now().toString());
  } catch (err) {
    console.error("[SHUTDOWN] Failed to record shutdown time:", err.message);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`[SHUTDOWN] ${signal} received`);
    recordShutdown();
    process.exit(0);
  });
}
process.on("disconnect", () => {
  shuttingDown = true;
});

const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
});
client.botStartTime = Math.floor(Date.now() / 1000);
client.cluster = new ClusterClient(client);

/** IPC errors during shutdown cascade if we try to log them over IPC. */
function isIpcError(err) {
  const text = String(err);
  return (
    err?.code === "ERR_IPC_CHANNEL_CLOSED" ||
    text.includes("ERR_IPC_CHANNEL_CLOSED") ||
    text.includes("Channel closed")
  );
}

async function report(kind, err) {
  if (shuttingDown) return;
  console.error(`[${kind}] ${new Date().toISOString()}`, err);
  if (isIpcError(err)) return;
  try {
    await errorlogging(client, err instanceof Error ? err : new Error(String(err)), {
      event: kind,
    });
  } catch (loggingError) {
    console.error(`[${kind}] Failed to log error:`, loggingError.message);
  }
}

process.on("unhandledRejection", (reason) => report("UNHANDLED REJECTION", reason));
process.on("uncaughtException", (error) => report("UNCAUGHT EXCEPTION", error));

async function main() {
  const info = getInfo();
  console.log(
    `[BOOT] ${config.environment} | cluster ${info.CLUSTER} | shards ${info.SHARD_LIST.join(",")} of ${info.TOTAL_SHARDS}`
  );

  try {
    await DB.connect();
  } catch (err) {
    console.error("[BOOT] MongoDB connection failed — exiting for respawn:", err.message);
    process.exit(1);
  }

  initializeBot(client);
  await client.login(config.token);
}

main().catch((err) => {
  console.error("[BOOT] Fatal:", err);
  process.exit(1);
});
