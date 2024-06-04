require("dotenv").config();
const { token, databaseToken, topggToken, botlisttoken, botlistauth } =
  process.env;
const { connect } = require("mongoose");
const {
  Client,
  Collection,
  ChannelType,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const { AutoPoster } = require("topgg-autoposter");
const BotlistMeClient = require("botlist.me.js");
const CommandUsage = require("../mongo/models/usageSchema.js");
const ProfileData = require("../mongo/models/profileSchema.js");

const client = new Client({
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
client.commands = new Collection();
client.commandArray = [];
client.botStartTime = Math.floor(Date.now() / 1000);

const functionFolders = fs.readdirSync(`./src/functions`);
for (const folder of functionFolders) {
  const functionFolders = fs
    .readdirSync(`./src/functions/${folder}`)
    .filter((file) => file.endsWith(".js"));
  for (const file of functionFolders)
    require(`./functions/${folder}/${file}`)(client);
}

const eventHandlers = {
  updateChannelName: require("./events/client/statsTracker.js"),
  handleGuildCreate: require("./events/client/guildCreate.js"),
  handleGuildDelete: require("./events/client/guildDelete.js"),
  handleReportFeedback: require("./events/client/modals.js"),
};

const userprofile = require("./commands/Profile/userprofile.js");
const usergaydar = require("./commands/Fun/usergaydar.js");
const usertransdar = require("./commands/Fun/usertransdar.js");

client.on(Events.GuildCreate, (guild) =>
  eventHandlers.handleGuildCreate(client, guild)
);
client.on(Events.GuildDelete, (guild) =>
  eventHandlers.handleGuildDelete(client, guild)
);
client.on("interactionCreate", (interaction) => {
  eventHandlers.handleReportFeedback(client, interaction);
});

setInterval(() => eventHandlers.updateChannelName(client), 5 * 60 * 1000);
client.once("ready", () => {
  eventHandlers.updateChannelName(client);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isUserContextMenuCommand()) {
    if (interaction.commandName === "User Profile") {
      await userprofile.execute(interaction);
    }
    if (interaction.commandName === "User Gaydar") {
      await usergaydar.execute(interaction);
    }
    if (interaction.commandName === "User Transdar") {
      await usertransdar.execute(interaction);
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (message.content.startsWith(mention)) {

    const args = message.content.slice(mention.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    if (commandName === "id") {
      const IDLists = require("../mongo/models/idSchema.js");

      async function executeIDCommand(message, args) {
        if (message.author.bot) return;

        let idLists;
        try {
          idLists = await IDLists.findOne();
        } catch (err) {
          console.error(err);
          const botMessage = await message.channel.send(
            "Error fetching ID lists."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        if (!idLists.devs.includes(message.author.id)) {
          const botMessage = await message.channel.send(
            "You do not have permission to edit the lists."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        const subCommand = args[0];
        const category = args[1];
        const id = args[2];

        if (
          ![
            "vips",
            "devs",
            "bot",
            "donor",
            "oneyear",
            "partner",
            "support",
          ].includes(category)
        ) {
          const botMessage = await message.channel.send(
            "Invalid category. Please choose from vips, devs, bot, donor, oneyear, partner, or support."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        if (subCommand === "add") {
          if (id) {
            try {
              if (!idLists[category].includes(id)) {
                idLists[category].push(id);
                await idLists.save();
                const botMessage = await message.channel.send(
                  `ID ${id} added to ${category}.`
                );
                await addTrashCanReaction(botMessage);
              } else {
                const botMessage = await message.channel.send(
                  `ID ${id} is already in ${category}.`
                );
                await addTrashCanReaction(botMessage);
              }
            } catch (err) {
              console.error(err);
              const botMessage = await message.channel.send("Error adding ID.");
              await addTrashCanReaction(botMessage);
            }
          } else {
            const botMessage = await message.channel.send(
              "Please provide an ID to add."
            );
            await addTrashCanReaction(botMessage);
          }
        }

        if (subCommand === "remove") {
          if (id) {
            try {
              if (idLists[category].includes(id)) {
                idLists[category] = idLists[category].filter(
                  (storedId) => storedId !== id
                );
                await idLists.save();
                const botMessage = await message.channel.send(
                  `ID ${id} removed from ${category}.`
                );
                await addTrashCanReaction(botMessage);
              } else {
                const botMessage = await message.channel.send(
                  `ID ${id} is not in ${category}.`
                );
                await addTrashCanReaction(botMessage);
              }
            } catch (err) {
              console.error(err);
              const botMessage = await message.channel.send(
                "Error removing ID."
              );
              await addTrashCanReaction(botMessage);
            }
          } else {
            const botMessage = await message.channel.send(
              "Please provide an ID to remove."
            );
            await addTrashCanReaction(botMessage);
          }
        }

        setTimeout(() => {
          message
            .delete()
            .catch((err) => console.error("Failed to delete message:", err));
        }, 3000);
      }

      try {
        await executeIDCommand(message, args);
      } catch (error) {
        console.error(error);
        const botMessage = await message.reply(
          "There was an error trying to execute that command!"
        );
        await addTrashCanReaction(botMessage);
        setTimeout(() => {
          message
            .delete()
            .catch((err) => console.error("Failed to delete message:", err));
        }, 3000);
      }
    }
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (reaction.emoji.name === "🗑️") {
    try {
      const IDLists = require("../mongo/models/idSchema.js");
      const idLists = await IDLists.findOne();

      if (idLists.devs.includes(user.id)) {
        if (reaction.message.author.id === client.user.id) {
          await reaction.message.delete();
        }
      }
    } catch (error) {
      console.error("Error handling reaction:", error);
    }
  }
});

async function addTrashCanReaction(message) {
  try {
    await message.react("🗑️");
  } catch (error) {
    console.error("Failed to add reaction:", error);
  }
}

const ap = AutoPoster(topggToken, client);
ap.on("posted", () => {
  console.log("Posted stats to Top.gg!");
});

const botlistme = new BotlistMeClient(botlisttoken, client);
botlistme.on("posted", () => {
  console.log("Server count posted!");
});

const commandsPath = "./src/commands";
const clientId = "1101256478632972369";
client.handleCommands(commandsPath, clientId);
client.handleEvents();
client.login(token);

connect(databaseToken)
  .then(() => console.log("Connected to MongoDB"))
  .catch(console.error);

const express = require("express");
const cors = require("cors");
const app = express();

const port = 2610;

app.listen(port, () => {
  console.log(`API is running on port ${port}`);
});

async function getRegisteredCommandsCount(client) {
  if (!client.application) {
    console.error("Client application is not ready.");
    return 0;
  }
  const commands = await client.application.commands.fetch();
  return commands.size;
}
/*
const apiKeyAuth = (req, res, next) => {
  const userApiKey = req.header('x-api-key');
  const validApiKey = 'testing';

  if (userApiKey && userApiKey === validApiKey) {
    next(); // Allow the request to proceed
  } else {
    res.status(401).json({ message: 'Unauthorized: Incorrect API Key' });
  }
};
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/api/stats", cors(), async (req, res) => {
  const currentGuildCount = client.guilds.cache.size;

  let totalUserCount = 0;
  client.guilds.cache.forEach((guild) => {
    totalUserCount += guild.memberCount;
  });

  try {
    const usages = await CommandUsage.find({}).sort({ count: -1 });
    const totalUsage = usages.reduce((acc, cmd) => acc + cmd.count, 0);

    const commandsCount = (await getRegisteredCommandsCount(client)) + 2;

    const botuptime = client.botStartTime;

    res.json({
      totalUserCount,
      currentGuildCount,
      totalUsage,
      commandsCount,
      botuptime,
    });
  } catch (error) {
    console.error("Failed to get API stats:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/profiles/:userId", cors(), async (req, res) => {
  try {
    const profile = await ProfileData.findOne({ userId: req.params.userId });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json(profile);
  } catch (error) {
    console.error("Failed to retrieve profile:", error);
    return res.status(500).send("Internal Server Error");
  }
});

app.post("/wumpus-votes", async (req, res) => {
  let wumpususer = req.body.userId;
  let wumpusbot = req.body.botId;
  const voteCooldownHours = 12;
  const voteCooldownSeconds = voteCooldownHours * 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const voteAvailableTimestamp = currentTimestamp + voteCooldownSeconds;

  client.users
    .fetch(wumpususer)
    .then(async (user) => {
      const userAvatarURL = user.displayAvatarURL();

      const embed = new EmbedBuilder()
        .setDescription(
          `**Thank you <@${wumpususer}> for voting for <@${wumpusbot}> on [Wumpus.Store](https://wumpus.store/bot/${wumpusbot}/vote) <:_:1198663251580440697>** \nYou can vote again <t:${voteAvailableTimestamp}:R>.`
        )
        .setColor("#FF00EA")
        .setThumbnail(userAvatarURL)
        .setTimestamp();

      try {
        const channel = await client.channels.fetch("1224815141921624186");
        if (!channel || channel.type !== ChannelType.GuildText) {
          return res
            .status(400)
            .send("Channel not found or is not a text channel");
        }

        await channel.send({ embeds: [embed] });
        res.status(200).send("Success!");
      } catch (error) {
        console.error("Error sending message to Discord:", error);
        res.status(500).send("Internal Server Error");
      }
    })
    .catch((error) => {
      console.error("Error fetching user from Discord:", error);
      res.status(500).send("Internal Server Error");
    });
});

app.post("/topgg-votes", async (req, res) => {
  let topgguserid = req.body.user;
  let topggbotid = req.body.bot;
  const voteCooldownHours = 12;
  const voteCooldownSeconds = voteCooldownHours * 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const voteAvailableTimestamp = currentTimestamp + voteCooldownSeconds;

  client.users
    .fetch(topgguserid)
    .then(async (user) => {
      const userAvatarURL = user.displayAvatarURL();

      const embed = new EmbedBuilder()
        .setDescription(
          `**Thank you <@${topgguserid}> for voting for <@${topggbotid}> on [Top.gg](https://top.gg/bot/${topggbotid}/vote) <:_:1195866944482590731>** \nYou can vote again in <t:${voteAvailableTimestamp}:R>`
        )
        .setColor("#FF00EA")
        .setThumbnail(userAvatarURL)
        .setTimestamp();

      try {
        const channel = await client.channels.fetch("1224815141921624186");
        if (!channel || channel.type !== ChannelType.GuildText) {
          return res
            .status(400)
            .send("Channel not found or is not a text channel");
        }

        await channel.send({ embeds: [embed] });
        res.status(200).send("Success!");
      } catch (error) {
        console.error("Error sending message to Discord:", error);
        res.status(500).send("Internal Server Error");
      }
    })
    .catch((error) => {
      console.error("Error fetching user from Discord:", error);
      res.status(500).send("Internal Server Error");
    });
});

app.post("/botlist-votes", async (req, res) => {
  if (req.header("Authorization") != botlistauth) {
    return res.status("401").end();
  }

  let botlistuser = req.body.user;
  let botlistbot = req.body.bot;
  const voteCooldownHours = 12;
  const voteCooldownSeconds = voteCooldownHours * 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const voteAvailableTimestamp = currentTimestamp + voteCooldownSeconds;

  client.users
    .fetch(botlistuser)
    .then(async (user) => {
      const userAvatarURL = user.displayAvatarURL();

      const embed = new EmbedBuilder()
        .setDescription(
          `**Thank you <@${botlistuser}> for voting for <@${botlistbot}> on [Botlist.me](https://botlist.me/bots/${botlistbot}/vote) <:_:1227425669642719282>** \nYou can vote again <t:${voteAvailableTimestamp}:R>.`
        )
        .setColor("#FF00EA")
        .setThumbnail(userAvatarURL)
        .setTimestamp();

      try {
        const channel = await client.channels.fetch("1224815141921624186");
        if (!channel || channel.type !== ChannelType.GuildText) {
          return res
            .status(400)
            .send("Channel not found or is not a text channel");
        }

        await channel.send({ embeds: [embed] });
        res.status(200).send("Success!");
      } catch (error) {
        console.error("Error sending message to Discord:", error);
        res.status(500).send("Internal Server Error");
      }
    })
    .catch((error) => {
      console.error("Error fetching user from Discord:", error);
      res.status(500).send("Internal Server Error");
    });
});

app.post(
  "/github",
  express.json({ type: "application/json" }),
  async (request, response) => {
    const githubEvent = request.headers["x-github-event"];
    const data = request.body;
    let embed = new EmbedBuilder();

    if (githubEvent === "push") {
      const commitCount = data.commits.length;
      const commitMessages = data.commits
        .map(
          (commit) =>
            `[\`${commit.id.slice(0, 7)}\`](${commit.url}) - **${
              commit.message
            }**`
        )
        .join("\n");
      const title = `${commitCount} New ${data.repository.name} ${
        commitCount > 1 ? "Commits" : "Commit"
      }`;
      const fieldname = `${commitCount > 1 ? "Commits" : "Commit"}`;

      embed
        .setColor("#FF00EA")
        .setAuthor({
          name: `${data.pusher.name}`,
          iconURL: `https://cdn.discordapp.com/emojis/1226912165982638174.png`,
          url: `https://github.com/${data.pusher.name}`,
        })
        .setTitle(title)
        .setTimestamp()
        .addFields({ name: fieldname, value: commitMessages });
    } else if (githubEvent === "star" && data.action === "created") {
      embed
        .setColor("#FF00EA")
        .setDescription(
          `## :star: New Star \n**Thank you [${data.sender.login}](https://github.com/${data.sender.name}) for starring [${data.repository.name}](https://github.com/${data.repository.full_name})**`
        )
        .setTimestamp();
    } else if (githubEvent === "star" && data.action === "deleted") {
      console.log(`${data.sender.login} removed their star ;-;`);
    } else {
      console.log(`Unhandled event: ${githubEvent}`);
      return;
    }

    try {
      const channel = await client.channels.fetch("1101742377372237906");
      if (!channel) {
        console.log("Could not find channel");
        return;
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error sending message to Discord:");
    }
  }
);
