const CommandUsage = require("../../../mongo/models/usageSchema");
const UserCommandUsage = require("../../../mongo/models/userCommandUsageSchema");
const Blacklist = require("../../../mongo/models/blacklistSchema.js");
const IDLists = require("../../../mongo/models/idSchema.js");
const {
  handleModalSubmit,
  handleRemoveWebsite,
} = require("../../commands/Profile/profilefunctions/profilehandlers.js");
const { handleFeedbackModal } = require("../../commands/Support/feedback.js");
const {
  handleProfileSurveyResponse,
  handleQuestion1Submission,
  handleQuestion2Response,
  handleQuestion3Submission,
} = require("../../commands/Profile/profilefunctions/profileSurveyHandler.js");
const { errorlogging } = require("../../config/logging/errorlogs.js");
const { EmbedBuilder } = require("discord.js");

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

async function trackUserCommandUsage(userId, commandName) {
  try {
    const userUsage = await UserCommandUsage.findOne({ userId });

    if (!userUsage) {
      const newUserUsage = new UserCommandUsage({
        userId,
        commandsUsed: [
          {
            commandName,
            firstUsedAt: new Date(),
            usageCount: 1,
          },
        ],
      });
      await newUserUsage.save();
    } else {
      const existingCommand = userUsage.commandsUsed.find(
        (cmd) => cmd.commandName === commandName
      );

      if (existingCommand) {
        existingCommand.usageCount += 1;
      } else {
        userUsage.commandsUsed.push({
          commandName,
          firstUsedAt: new Date(),
          usageCount: 1,
        });
      }

      await userUsage.save();
    }
  } catch (error) {
    console.error("[USER TRACKING] Failed to track user command usage:", error);
  }
}

async function checkAndShowFeedbackPrompt(interaction, userId) {
  try {
    const userUsage = await UserCommandUsage.findOne({ userId });

    if (!userUsage) return;
    if (userUsage.hasSentFeedback || userUsage.feedbackPromptShown) return;
    const uniqueCommandsUsed = userUsage.commandsUsed.length;
    const totalUsageCount = userUsage.commandsUsed.reduce(
      (sum, cmd) => sum + cmd.usageCount,
      0
    );

    if (uniqueCommandsUsed >= 2 || totalUsageCount >= 3) {
      userUsage.feedbackPromptShown = true;
      userUsage.feedbackPromptShownAt = new Date();
      await userUsage.save();

      // Create feedback prompt embed
      const feedbackPromptEmbed = new EmbedBuilder()
        .setTitle("Help Improve PrideBot!")
        .setDescription(
          "Hey there! We noticed you've been using PrideBot quite a bit and we'd love to hear your thoughts!\n\n Use the `/feedback` command to share your suggestions, report bugs, or just let us know what you think."
        )
        .setColor(0xff00ae)
        .setFooter({
          text: "This is a one-time message • Use /feedback anytime to share your thoughts!",
        });

      setTimeout(async () => {
        try {
          await interaction.followUp({
            embeds: [feedbackPromptEmbed],
            ephemeral: true,
          });
        } catch (error) {
          console.error(
            "[FEEDBACK PROMPT] Failed to send feedback prompt:",
            error
          );
        }
      }, 2000);
    }
  } catch (error) {
    console.error("[FEEDBACK PROMPT] Failed to check feedback prompt:", error);
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

        await trackUserCommandUsage(userId, commandName);
        await command.execute(interaction, client, { userId, guildId });
        if (commandName !== "feedback") {
          await checkAndShowFeedbackPrompt(interaction, userId);
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
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("feedback_modal_")
      ) {
        console.log(
          `[FEEDBACK MODAL] ${interaction.user.tag} - ${interaction.customId}`
        );
        await handleFeedbackModal(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_yes_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Accepted survey`
        );
        await handleProfileSurveyResponse(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_no_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Declined survey`
        );
        await handleProfileSurveyResponse(interaction);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("profile_survey_q1_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Submitted Q1`
        );
        await handleQuestion1Submission(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_q2_yes_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Q2: Yes`
        );
        await handleQuestion2Response(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_q2_no_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Q2: No`
        );
        await handleQuestion2Response(interaction);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("profile_survey_q3_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Submitted Q3 (Complete)`
        );
        await handleQuestion3Submission(interaction);
      }
    } catch (error) {
      const guild = interaction.guild;
      const channel = interaction.channel;
      const cmd = interaction.commandName || interaction.customId || "unknown";

      // DiscordAPIError[10062]: Unknown Interaction — interaction expired or already handled
      if (error.code === 10062) {
        console.warn(`[WARN] Unknown Interaction (10062) for ${cmd} — interaction expired or already responded to.`);
        return;
      }

      // DiscordAPIError[50013]: Missing Permissions
      if (error.code === 50013) {
        console.warn(`[WARN] Missing Permissions (50013) for ${cmd} in ${guild ? guild.name : "DM"}.`);
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
                "I'm missing permissions to do that in this channel. Please make sure I have the required permissions!",
              ephemeral: true,
            })
            .catch(() => {});
        }
        return;
      }

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
