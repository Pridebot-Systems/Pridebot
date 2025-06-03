const { EmbedBuilder } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");
const Blacklist = require("../../../mongo/models/blacklistSchema.js");
const IDLists = require("../../../mongo/models/idSchema.js");
const {
  handleModalSubmit,
  handleRemoveWebsite,
} = require("../../commands/Profile/profilefunctions/profilehandlers.js");
const {
  shouldShowGiveawayAd,
} = require("../../config/commandfunctions/giveawayAdvert.js");

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

        const showAd = await shouldShowGiveawayAd(interaction.user.id);
        if (showAd) {
          const adEmbed = new EmbedBuilder()
            .setTitle(
              "🎉 Pridebot X Pridecord 5× $10 Nitro Pridemonth Giveaway 🎉"
            )
            .setDescription(
              "Join [Pridecord server](https://discord.gg/lgbtqia) now for a chance to win one of 5× $10 Nitro!\n" +
                "Use </giveaway rules:1378536586701963395> for more info."
            )
            .setColor("#FF00AE")
            .setTimestamp();
          await interaction.followUp({
            embeds: [adEmbed],
          });
        }
      } catch (error) {
        const guild = interaction.guild;
        const channel = interaction.channel;

        console.error("❌ Error in command:", {
          command: interaction.commandName,
          guild: guild ? `${guild.name} (${guild.id})` : "DM or Unknown",
          channel: channel
            ? {
                id: channel.id,
                name: "name" in channel ? channel.name : "Unnamed/DM",
                type: channel.type,
              }
            : "DM or Unknown",
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });

        if (error.code === 50013) {
          console.warn(
            `🚫 Missing permissions in /${interaction.commandName} — Guild: ${
              guild?.name || "DM"
            } (${guild?.id || "N/A"}), Channel: ${channel?.id || "N/A"}`
          );
        }

        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({
              content: `Error executing command. Join [support](https://pridebot.xyz/support) for help!`,
              ephemeral: true,
            });
          } catch (e) {
            console.error("💥 Failed to send fallback error message:", e);
          }
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
