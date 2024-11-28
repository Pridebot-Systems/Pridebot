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
const initializeApi = require("./apis/botapi");
const initializeAvatarApi = require("./apis/avatarapi");
const initializeGoogleApi = require("./apis/googleapi");

const errorlogging = require("./config/logging/errorlogs");

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

const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().SHARD_LIST.length,
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

initializeBot(client);
initializeApi(client);
initializeAvatarApi(client);
initializeGoogleApi();

process.on("unhandledRejection", async (reason) => {
  const error = reason instanceof Error ? reason : new Error(reason);
  await errorlogging(client, error);
});

process.on("uncaughtException", async (error) => {
  await errorlogging(client, error);
});

console.log(getInfo());
client.cluster = new ClusterClient(client);
client.login(token);

connect(databaseToken)
  .then(() => console.log("Connected to MongoDB"))
  .catch(console.error);

const ap = AutoPoster(topggToken, client);
ap.on("posted", () => {});

const botlistme = new BotlistMeClient(botlisttoken, client);
botlistme.on("posted", () => {});
