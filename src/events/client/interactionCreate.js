const CommandUsage = require("../../../mongo/models/usageSchema");
const Blacklist = require("../../../mongo/models/blacklistSchema.js");
const IDLists = require("../../../mongo/models/idSchema.js");
const {
  handleModalSubmit,
  handleRemoveWebsite,
} = require("../../commands/Profile/profilefunctions/profilehandlers.js");

async function isBlacklisted(userId, guildId) {
  try {
    const idLists = await IDLists.findOne();
    if (idLists && idLists.devs.includes(userId)) {
      return { blacklisted: false };
    }

    const blacklist = await Blacklist.findOne();
    if (!blacklist) return { blacklisted: false };

    if (blacklist.blacklistUserIDs.includes(userId)) {
      return { blacklisted: true, type: "user" };
    }
    if (blacklist.blacklistGuildIDs.includes(guildId)) {
      return { blacklisted: true, type: "guild" };
    }
    return { blacklisted: false };
  } catch (err) {
    console.error("Error checking blacklist:", err);
    return { blacklisted: false };
  }
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const { commands } = client;
      const { commandName } = interaction;
      const command = commands.get(commandName);
      if (!command) return;

      // owner-only guard
      if (command.owner === true) {
        if (interaction.user.id !== "691506668781174824") {
          await interaction.reply({
            content: "This command is only for the bot owner!",
            ephemeral: true,
          });
          return;
        }
      }

      const userId = interaction.user.id;
      const guildId = interaction.guild ? interaction.guild.id : null;
      const { blacklisted, type } = await isBlacklisted(userId, guildId);
      if (blacklisted) {
        const msg =
          type === "user"
            ? "You are blacklisted from using the bot. Contact the owner for help."
            : "This guild is blacklisted from using the bot. Contact the owner for help.";
        await interaction.reply({ content: msg, ephemeral: true });
        return;
      }

      try {
        // usage logging
        if (commandName !== "usage") {
          const usageData = await CommandUsage.findOneAndUpdate(
            { commandName: commandName },
            { $inc: { count: 1 } },
            { upsert: true, new: true }
          );

          if (interaction.guild) {
            usageData.guildCount += 1;
          } else {
            usageData.userContextCount += 1;
          }

          await usageData.save();
        }

        await command.execute(interaction, client, { userId, guildId });
      } catch (error) {
        console.error(error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `Error executing command. Join [support](https://pridebot.xyz/support) for help!`,
            ephemeral: true,
          });
        }
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === "customWebsiteModal") {
        try {
          return handleModalSubmit(interaction, client);
        } catch (err) {
          console.error("Error in modal submit:", err);
          return interaction.reply({
            content: "Something went wrong.",
            ephemeral: true,
          });
        }
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "removeWebsiteSelect") {
        try {
          return handleRemoveWebsite(interaction, client);
        } catch (err) {
          console.error("Error handling remove select:", err);
          return interaction.reply({
            content: "Failed to remove website.",
            ephemeral: true,
          });
        }
      }
    }
  },
};
