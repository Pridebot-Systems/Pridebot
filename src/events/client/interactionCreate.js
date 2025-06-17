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
const { errorlogging } = require("../../config/logging/errorlogs.js");

async function isBlacklisted(userId, guildId) {
  try {
    const idLists = await IDLists.findOne();
    if (idLists && idLists.devs.includes(userId)) return { blacklisted: false };

    const blacklist = await Blacklist.findOne();
    if (!blacklist) return { blacklisted: false };

    if (blacklist.blacklistUserIDs.includes(userId))
      return { blacklisted: true, type: "user" };
    if (blacklist.blacklistGuildIDs.includes(guildId))
      return { blacklisted: true, type: "guild" };

    return { blacklisted: false };
  } catch (err) {
    console.error("[BLACKLIST] Failed to check blacklist:", err);
    return { blacklisted: false };
  }
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const { commands } = client;
        const { commandName } = interaction;
        const command = commands.get(commandName);
        if (!command) return;

        if (
          command.owner === true &&
          interaction.user.id !== "691506668781174824"
        ) {
          await interaction.reply({
            content: "This command is only for the bot owner!",
            ephemeral: true,
          });
          return;
        }

        const userId = interaction.user.id;
        const guildId = interaction.guild?.id || null;
        const { blacklisted, type } = await isBlacklisted(userId, guildId);

        if (blacklisted) {
          const msg =
            type === "user"
              ? "You are blacklisted from using the bot. Contact the owner for help."
              : "This guild is blacklisted from using the bot. Contact the owner for help.";
          await interaction.reply({ content: msg, ephemeral: true });
          return;
        }

        if (commandName !== "usage") {
          const usageData = await CommandUsage.findOneAndUpdate(
            { commandName },
            { $inc: { count: 1 } },
            { upsert: true, new: true }
          );
          if (interaction.guild) usageData.guildCount += 1;
          else usageData.userContextCount += 1;
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
              "Join [Pridecord](https://discord.gg/UPCqG6weXt) to win one of 5× $10 Nitro!\nUse </giveaway rules:1378536586701963395> for details."
            )
            .setColor("#FF00AE")
            .setTimestamp();

          await interaction.followUp({ embeds: [adEmbed], ephemeral: true });
        }
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId === "customWebsiteModal"
      ) {
        console.log(
          `[MODAL SUBMIT] ${interaction.user.tag} - ${interaction.customId}`
        );
        await handleModalSubmit(interaction, client);
      } else if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "removeWebsiteSelect"
      ) {
        console.log(
          `[SELECT MENU] ${interaction.user.tag} - ${interaction.customId}`
        );
        await handleRemoveWebsite(interaction, client);
      }
    } catch (error) {
      const guild = interaction.guild;
      const channel = interaction.channel;
      const cmd = interaction.commandName || interaction.customId || "unknown";

      console.error(`[ERROR] In interaction handler for ${cmd}:`, error);

      await errorlogging(client, error, {
        command: cmd,
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

      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content:
              "Error executing command. Join [support](https://pridebot.xyz/support) for help!",
            ephemeral: true,
          })
          .catch((err) => console.error("💥 Failed to send error reply:", err));
      }
    }
  },
};
