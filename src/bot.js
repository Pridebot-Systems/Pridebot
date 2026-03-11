const fs = require("fs");
const path = require("path");
const { Events } = require("discord.js");
const { getInfo } = require("discord-hybrid-sharding");
const config = require("./environment");

const initializeApi = require("./apis/botapi");
const initializeAvatarApi = require("./apis/avatarapi");
const initializeGoogleApi = require("./apis/googleapi");
const initializeProfileApi = require("./apis/profileapi");
const initializePremiumApi = require("./apis/premiumapi");

const cron = require("node-cron");
const { deleteOldFiles } = require("./config/botfunctions/cleanup");
const { updatePfpStatsCache } = require("./commands/Dev/pfpstats.js");

const { idCommand } = require("./commands/Dev/id.js");
const { blacklistCommand } = require("./commands/Dev/blacklist.js");
const { termCommand } = require("./commands/Dev/termlist.js");
const { darCommand } = require("./commands/Dev/darID.js");
const { topServerCommand } = require("./commands/Dev/topserver.js");
const { handleErrorModeCommand } = require("./commands/Dev/errormode.js");
const { pfpStatsCommand } = require("./commands/Dev/pfpstats.js");

const { react } = require("./config/commandfunctions/trashreact.js");
const { errorlogging } = require("./config/logging/errorlogs");

const eventHandlers = {
  handleGuildCreate: require("./events/client/guildCreate.js"),
  handleGuildDelete: require("./events/client/guildDelete.js"),
  sendRestartMessage: require("./events/server/restart.js"),
};

const userprofile = require("./commands/Profile/userprofile.js");
const usergaydar = require("./commands/Fun/usergaydar.js");
const usertransdar = require("./commands/Fun/usertransdar.js");
const userqueerdar = require("./commands/Fun/userqueerdar.js");
const userlesdar = require("./commands/Fun/userlesdar.js");
const useravatar = require("./commands/Avatar/useravatar-view.js");

module.exports = (client) => {
  try {
    const functionFolders = fs.readdirSync(`./src/functions`);
    for (const folder of functionFolders) {
      const files = fs
        .readdirSync(`./src/functions/${folder}`)
        .filter((file) => file.endsWith(".js"));
      for (const file of files) {
        require(`./functions/${folder}/${file}`)(client);
      }
    }

    cron.schedule("0 0 * * *", () => {
      console.log("🧹 Running daily cleanup...");
      deleteOldFiles(client, "1360270874933989386");
    });

    cron.schedule("0 */3 * * *", async () => {
      console.log("📊 Running scheduled PFP stats update...");
      try {
        await updatePfpStatsCache();
        console.log("✅ PFP stats cache updated successfully");
      } catch (error) {
        console.error("❌ Failed to update PFP stats cache:", error);
      }
    });

    client.on(Events.GuildCreate, (guild) => {
      try {
        eventHandlers.handleGuildCreate(client, guild);
      } catch (err) {
        errorlogging(client, err);
      }
    });

    client.on(Events.GuildDelete, (guild) => {
      try {
        eventHandlers.handleGuildDelete(client, guild);
      } catch (err) {
        errorlogging(client, err);
      }
    });

    client.once("ready", async () => {
      setInterval(() => {
        if (!client.user || client.ws.status !== 0) {
          console.warn("[WATCHDOG] Bot disconnected. Exiting...");
          process.exit(1);
        }
      }, 60_000);
      const clusterId = getInfo().CLUSTER;
      console.log(`✅ Cluster ${clusterId} is ready.`);

      const startupTime = new Date().toISOString();
      const botTag = client.user.tag;
      const botId = client.user.id;
      const guildCount = client.guilds.cache.size;
      const userCount = client.guilds.cache.reduce(
        (acc, g) => acc + g.memberCount,
        0
      );

      console.log(`\n=== 🌈 Pridebot Startup ===`);
      console.log(`[INFO] Time: ${startupTime}`);
      console.log(`[INFO] Bot: ${botTag} (ID: ${botId})`);
      console.log(`[INFO] Guilds: ${guildCount}`);
      console.log(`[INFO] Total users: ${userCount}`);

      client.presenceIndex = 0;

      client.updatePresence = async () => {
        try {
          const specialDays = [
            {
              month: 2,
              day: 31,
              message:
                "Happy International Trans Day of Visibility from Pridebot",
              activityType: 0,
            },
            {
              month: 3,
              day: 1,
              message: "Happy April Fools from Pridebot",
              activityType: 0,
            },
          ];

          const specialDay = specialDays.find((sd) => {
            const now = new Date();
            return now.getMonth() === sd.month && now.getDate() === sd.day;
          });

          if (specialDay) {
            await client.user.setPresence({
              status: "online",
              activities: [
                {
                  type: specialDay.activityType,
                  name: specialDay.message,
                },
              ],
            });
            return;
          }

          const results = await client.cluster.broadcastEval((c) => {
            return {
              guildCount: c.guilds.cache.size,
              userCount: c.guilds.cache.reduce(
                (acc, g) => acc + g.memberCount,
                0
              ),
            };
          });

          const totalGuilds = results.reduce((acc, r) => acc + r.guildCount, 0);
          const totalUsers = results.reduce((acc, r) => acc + r.userCount, 0);

          const CommandUsage = require("../mongo/models/usageSchema.js");
          let totalUsage = 0;
          try {
            const usages = await CommandUsage.find({});
            totalUsage = usages.reduce((acc, u) => acc + u.count, 0);
          } catch (err) {
            console.error("[PRESENCE] Command usage fetch error:", err);
          }

          const presences = [
            {
              type: 3,
              name: `over ${totalUsers.toLocaleString()} LGBTQIA+ members`,
            },
            {
              type: 2,
              name: `${totalGuilds.toLocaleString()} servers`,
            },
            {
              type: 0,
              name: `with ${totalUsage.toLocaleString()} commands`,
            },
          ];

          const presence = presences[client.presenceIndex];
          console.log(`[PRESENCE] Setting: ${presence.name}`);
          if (!client.user) {
            console.error("[PRESENCE] client.user is undefined!");
            return;
          }
          await client.user.setPresence({
            status: "online",
            activities: [presence],
          });

          client.presenceIndex = (client.presenceIndex + 1) % presences.length;
        } catch (err) {
          console.error("[PRESENCE] updatePresence error:", err);
        }
      };

      if (clusterId === 0) {
        try {
          await client.shard?.broadcastEval(() => true);
          await new Promise((res) => setTimeout(res, 5000));

          await client.updatePresence();
          client.presenceInterval = setInterval(async () => {
            try {
              await client.updatePresence();
            } catch (err) {
              console.error("[PRESENCE] Interval crash:", err);
            }
          }, 15_000);
          console.log(`[READY] Presence updates started.`);
        } catch (err) {
          console.error("[READY] Failed to start presence updates:", err);
        }

        try {
          initializeAvatarApi(client);
          initializeApi(client);
          initializeGoogleApi(client);
          initializeProfileApi(client);
          initializePremiumApi(client);
          console.log("✅ API initialization complete.");
        } catch (err) {
          console.error("❌ Error during API initialization:", err);
          errorlogging(client, err);
        }
      }

      try {
        eventHandlers.sendRestartMessage(client);
      } catch (err) {
        errorlogging(client, err);
      }
    });

    client.on("interactionCreate", async (interaction) => {
      try {
        if (interaction.isAutocomplete()) {
          const command = client.commands.get(interaction.commandName);
          if (command?.autocomplete) await command.autocomplete(interaction);
        }

        if (interaction.isUserContextMenuCommand()) {
          const handlers = {
            "User Profile": userprofile,
            "User Gaydar": usergaydar,
            "User Lesdar": userlesdar,
            "User Transdar": usertransdar,
            "User Queerdar": userqueerdar,
            "User Avatar-view": useravatar,
          };

          const handler = handlers[interaction.commandName];
          if (handler) await handler.execute(interaction, client);
        }
      } catch (err) {
        await errorlogging(client, err);
      }
    });

    client.on("messageCreate", async (message) => {
      try {
        idCommand(message, client);
        blacklistCommand(message, client);
        termCommand(message, client);
        darCommand(message, client);
        handleErrorModeCommand(message, client);
        topServerCommand(message, client);
        pfpStatsCommand(message, client);
      } catch (err) {
        await errorlogging(client, err);
      }
    });

    client.on("messageReactionAdd", async (reaction, user) => {
      try {
        await react(reaction, user, client);
      } catch (err) {
        await errorlogging(client, err);
      }
    });

    client.on("shardDisconnect", (event, id) =>
      console.warn(`[SHARD] Disconnected: Shard ${id}`, event)
    );

    client.on("shardError", (error, id) =>
      console.error(`[SHARD] Error on Shard ${id}:`, error)
    );

    client.on("shardReady", (id) => console.log(`[SHARD] Ready: Shard ${id}`));

    client.on("error", async (err) => {
      console.error("❌ Discord client error:", err);
      await errorlogging(client, err);
    });

    const commandsPath = "./src/commands";
    client.handleCommands(commandsPath, config.clientId);
    client.handleEvents();
  } catch (fatal) {
    console.error("❌ Fatal error in bot.js init:", fatal);
  }
};
