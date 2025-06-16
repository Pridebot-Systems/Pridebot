require("dotenv").config();
const { token, databaseToken, topggToken, botlisttoken } = process.env;
const { connect } = require("mongoose");
const { Client, GatewayIntentBits } = require("discord.js");
const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const { AutoPoster } = require("topgg-autoposter");
const BotlistMeClient = require("botlist.me.js");
const fs = require("fs");
const path = require("path");

const initializeBot = require("./bot");

const { errorlogging } = require("./config/logging/errorlogs");
const { updateDiscordsCount } = require("./config/botfunctions/discordsguild");

function logShutdownTime() {
  const shutdownFilePath = path.join(__dirname, "shutdown-time.txt");
  const shutdownTime = Date.now().toString();
  try {
    fs.writeFileSync(shutdownFilePath, shutdownTime);
    console.log("Shutdown time logged.");
  } catch (error) {
    console.error("Failed to write shutdown time:", error);
  }
}

process.on("SIGINT", () => {
  logShutdownTime();
  process.exit();
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  logShutdownTime();
  process.exit();
});
process.on("exit", (code) => {
  console.log("Process exiting with code:", code);
});
process.on("beforeExit", (code) => {
  console.log("⚠️ beforeExit called with code:", code);
});

const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
  ],
});
client.commands = new Map();
client.commandArray = [];
client.botStartTime = Math.floor(Date.now() / 1000);
client.cluster = new ClusterClient(client);

initializeBot(client);

process.on("unhandledRejection", async (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
  const error = reason instanceof Error ? reason : new Error(reason);
  await errorlogging(client, error, { event: "unhandledRejection" });
});

process.on("uncaughtException", async (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
  await errorlogging(client, error, { event: "uncaughtException" });
});

console.log(getInfo());
console.log("Shard:", getInfo().SHARD_LIST, "Count:", getInfo().TOTAL_SHARDS);
client.cluster = new ClusterClient(client);
client.login(token).catch((err) => {
  console.error("❌ Login failed:", err);
});

client.cluster?.on("message", async (message) => {
  if (message?.type === "log" && client.cluster.id === 0) {
    const { message: logMsg, channelId, isEmbed } = message.payload;
    let channel = client.channels.cache.get(channelId);
    if (!channel) {
      try {
        channel = await client.channels.fetch(channelId);
      } catch (e) {
        console.error("[CLUSTER LOG] Channel fetch failed:", e);
        return;
      }
    }
    if (!channel) return;
    if (isEmbed) {
      await channel.send({ embeds: [EmbedBuilder.from(logMsg)] }).catch(console.error);
    } else {
      await channel.send({ content: logMsg }).catch(console.error);
    }
  }
});

connect(databaseToken)
  .then(() => console.log("Connected to MongoDB"))
  .catch(console.error);

const ap = AutoPoster(topggToken, client);
ap.on("posted", () => {});

const botlistme = new BotlistMeClient(botlisttoken, client);
botlistme.on("posted", () => {});

setInterval(async () => {
  try {
    await updateDiscordsCount(client);
  } catch (err) {
    console.error("updateDiscordsCount failed:", err);
  }
}, 15 * 60 * 1000);

setInterval(() => {
  console.log(
    `[HEARTBEAT] Cluster ${
      getInfo().CLUSTER
    } is alive at ${new Date().toLocaleTimeString()}`
  );
}, 60_000);
