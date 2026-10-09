const fs = require("fs");
const { Client, GatewayIntentBits, Options, Partials } = require("discord.js");
const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const config = require("../environment");
const DB = require("../DB");
const { DATA_DIR, SHUTDOWN_FILE } = require("../Shared/paths");
const { errorlogging } = require("./utils/logging/errorlogs");
const initializeBot = require("./bot");

let shuttingDown = false;
const BOOT_RETRY_DELAY_MS = 30_000;
const READY_DEADLINE_MS = 10 * 60_000;

async function exitForRespawn(reason, err) {
  console.error(
    `[BOOT] ${reason} — exiting for respawn in ${BOOT_RETRY_DELAY_MS / 1000}s:`,
    err?.message || err
  );
  await new Promise((resolve) => setTimeout(resolve, BOOT_RETRY_DELAY_MS));
  process.exit(1);
}

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

const makeCache = Options.cacheWithLimits({
  ...Options.DefaultMakeCacheSettings,
  MessageManager: 0,
  GuildMemberManager: {
    maxSize: 0,
    keepOverLimit: (member) => member.id === member.client.user.id,
  },
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
  partials: [Partials.Message, Partials.Reaction, Partials.User],
  makeCache,
  sweepers: {
    ...Options.DefaultSweeperSettings,
    users: {
      interval: 60 * 60,
      filter: () => (user) => user.id !== user.client.user.id,
    },
  },
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
    return exitForRespawn("MongoDB connection failed", err);
  }

  initializeBot(client);

  setTimeout(() => {
    if (client.isReady() || shuttingDown) return;
    console.error(`[BOOT] Not ready ${READY_DEADLINE_MS / 60_000} min after login — exiting for respawn`);
    process.exit(1);
  }, READY_DEADLINE_MS).unref();

  await client.login(config.token);
}
main().catch((err) => exitForRespawn("Startup failed", err));
