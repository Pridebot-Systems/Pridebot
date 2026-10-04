const { Events, Status } = require("discord.js");
const { getInfo } = require("discord-hybrid-sharding");
const cron = require("node-cron");
const config = require("../environment");
const { CHANNELS } = require("../Shared");
const { CommandUsage } = require("../DB");
const API = require("../API");
const { loadCommands, registerCommands } = require("./functions/handlers/handleCommands");
const { loadEvents } = require("./functions/handlers/handleEvents");
const { startBotListPosting } = require("./functions/bot/botlists");
const { deleteOldFiles } = require("./functions/bot/cleanup");
const { react } = require("./functions/commands/trashreact");
const { errorlogging } = require("./utils/logging/errorlogs");
const { avatarProcessor } = require("./utils/avatar/avatarProcessor");
const sendRestartMessage = require("./events/server/restart");

// Prefix-style owner commands. Each takes (message, client) and ignores messages
const { idCommand } = require("./commands/Dev/id");
const { blacklistCommand } = require("./commands/Dev/blacklist");
const { termCommand } = require("./commands/Dev/termlist");
const { darCommand } = require("./commands/Dev/darID");
const { topServerCommand } = require("./commands/Dev/topserver");
const { handleErrorModeCommand } = require("./commands/Dev/errormode");
const { pfpStatsCommand, updatePfpStatsCache } = require("./commands/Dev/pfpstats");
const { emotecopyCommand } = require("./commands/Dev/emotecopy");
const { setPremiumCommand } = require("./commands/Dev/setpremium");

const DEV_MESSAGE_COMMANDS = [
  idCommand,
  blacklistCommand,
  termCommand,
  darCommand,
  handleErrorModeCommand,
  topServerCommand,
  pfpStatsCommand,
  emotecopyCommand,
  setPremiumCommand,
];

const PRESENCE_INTERVAL_MS = 15_000;
const WATCHDOG_INTERVAL_MS = 60_000;
const WATCHDOG_MAX_MISSES = 3;

const SPECIAL_DAYS = [
  { month: 2, day: 31, name: "Happy International Trans Day of Visibility from Pridebot" },
  { month: 3, day: 1, name: "Happy April Fools from Pridebot" },
];

async function setPresenceEverywhere(client, activity) {
  await client.cluster.broadcastEval(
    async (c, { activity }) => {
      if (c.user) await c.user.setPresence({ status: "online", activities: [activity] });
    },
    { context: { activity } }
  );
}

async function updatePresence(client) {
  const now = new Date();
  const special = SPECIAL_DAYS.find(
    (d) => now.getMonth() === d.month && now.getDate() === d.day
  );
  if (special) return setPresenceEverywhere(client, { type: 0, name: special.name });

  const results = await client.cluster.broadcastEval((c) => ({
    guildCount: c.guilds.cache.size,
    userCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
  }));
  const totalGuilds = results.reduce((acc, r) => acc + r.guildCount, 0);
  const totalUsers = results.reduce((acc, r) => acc + r.userCount, 0);

  let totalUsage = 0;
  try {
    const [result] = await CommandUsage.aggregate([
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);
    totalUsage = result?.total ?? 0;
  } catch (err) {
    console.error("[PRESENCE] Command usage fetch error:", err.message);
  }

  const presences = [
    { type: 3, name: `over ${totalUsers.toLocaleString()} LGBTQIA+ members` },
    { type: 2, name: `${totalGuilds.toLocaleString()} servers` },
    { type: 0, name: `with ${totalUsage.toLocaleString()} commands` },
  ];
  const presence = presences[client.presenceIndex % presences.length];
  client.presenceIndex += 1;
  await setPresenceEverywhere(client, presence);
}

/** Work that must happen exactly once across the whole bot. */
async function startClusterZeroServices(client, commandPayload, duplicates) {
  await registerCommands(commandPayload, duplicates);

  client.presenceIndex = 0;
  setTimeout(() => {
    const tick = () =>
      updatePresence(client).catch((err) =>
        console.error("[PRESENCE] update failed:", err.message)
      );
    tick();
    setInterval(tick, PRESENCE_INTERVAL_MS);
  }, 5000);

  cron.schedule("0 0 * * *", () => {
    console.log("[CRON] Daily pfp cleanup");
    deleteOldFiles(client, CHANNELS.CLEANUP);
  });
  cron.schedule("0 */3 * * *", () => {
    console.log("[CRON] PFP stats cache refresh");
    updatePfpStatsCache().catch((err) =>
      console.error("[CRON] PFP stats refresh failed:", err.message)
    );
  });

  avatarProcessor
    .initialize()
    .catch((err) => console.error("[AVATAR] Pre-initialize failed:", err.message));

  await API.startAll(client);

  if (config.isProduction) startBotListPosting(client);

  await sendRestartMessage(client).catch((err) => errorlogging(client, err));
}

module.exports = (client) => {
  const { commands, payload, skipped: nonCommands, duplicates } = loadCommands();
  client.commands = commands;
  console.log(
    `[COMMANDS] Loaded ${commands.size} commands (${nonCommands.length} helper/prefix modules skipped)`
  );

  const { registered, skipped: nonEvents } = loadEvents(client);
  console.log(
    `[EVENTS] Registered ${registered.length}: ${registered.join(", ")}` +
      (nonEvents.length ? ` | not events: ${nonEvents.join(", ")}` : "")
  );

  client.once(Events.ClientReady, async () => {
    const clusterId = getInfo().CLUSTER;
    const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    console.log(
      `[READY] Cluster ${clusterId} as ${client.user.tag} (${client.user.id}) — ` +
        `${client.guilds.cache.size} guilds, ${userCount.toLocaleString()} users`
    );

    let missed = 0;
    setInterval(() => {
      const notReady = [...client.ws.shards.values()].filter((s) => s.status !== Status.Ready);
      if (client.user && notReady.length === 0) {
        missed = 0;
        return;
      }
      missed += 1;
      const ids = notReady.map((s) => s.id).join(", ") || "client";
      console.warn(`[WATCHDOG] Not ready: shard(s) ${ids} (${missed}/${WATCHDOG_MAX_MISSES})`);
      if (missed >= WATCHDOG_MAX_MISSES) {
        console.warn("[WATCHDOG] Exiting for respawn");
        process.exit(1);
      }
    }, WATCHDOG_INTERVAL_MS);

    if (clusterId === 0) {
      try {
        await startClusterZeroServices(client, payload, duplicates);
      } catch (err) {
        console.error("[READY] Cluster 0 service startup failed:", err);
        await errorlogging(client, err).catch(() => {});
      }
    }
  });

  // Chat-input commands are dispatched by events/client/interactionCreate.js.
  // Autocomplete and user context menus are dispatched here.
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
      } else if (interaction.isUserContextMenuCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction, client);
      }
    } catch (err) {
      const name = interaction.commandName || "unknown";
      if (err.code === 10062) {
        console.warn(`[WARN] Unknown Interaction (10062) for ${name} — interaction expired.`);
        return;
      }
      if (err.code === 50013) console.warn(`[WARN] Missing Permissions (50013) for ${name}.`);
      await errorlogging(client, err, { command: name }).catch(() => {});
    }
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    for (const handler of DEV_MESSAGE_COMMANDS) {
      Promise.resolve()
        .then(() => handler(message, client))
        .catch((err) => errorlogging(client, err, { command: handler.name }));
    }
  });

  client.on(Events.MessageReactionAdd, (reaction, user) =>
    Promise.resolve()
      .then(() => react(reaction, user, client))
      .catch((err) => errorlogging(client, err))
  );

  client.on(Events.ShardReady, (id) => console.log(`[SHARD] Ready: ${id}`));
  client.on(Events.ShardDisconnect, (event, id) =>
    console.warn(`[SHARD] Disconnected: ${id} (code ${event?.code})`)
  );
  client.on(Events.ShardError, (error, id) => console.error(`[SHARD] Error on ${id}:`, error));
  client.on(Events.Error, (err) => {
    console.error("[CLIENT] Error:", err);
    errorlogging(client, err).catch(() => {});
  });
};
