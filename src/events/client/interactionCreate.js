const CommandUsage = require("../../../mongo/models/usageSchema");
const UserCommandUsage = require("../../../mongo/models/userCommandUsageSchema");
const Blacklist = require("../../../mongo/models/blacklistSchema.js");
const IDLists = require("../../../mongo/models/idSchema.js");
const PanVSPot = require("../../../mongo/models/panvspotSchema.js");
const ProfileData = require("../../../mongo/models/profileSchema.js");
const { hasFeature, getFixedValueLimit } = require("../../utils/premiumUtils.js");
const {
  handleModalSubmit,
  handleRemoveWebsite,
  handleAlterProfileButton,
  handleBackToProfileButton,
} = require("../../commands/Profile/profilefunctions/profilehandlers.js");
const { handleFeedbackModal } = require("../../commands/Support/feedback.js");
const {
  handleProfileSurveyResponse,
  handleQuestion1Submission,
  handleQuestion2Response,
  handleQuestion3Submission,
} = require("../../commands/Profile/profilefunctions/profileSurveyHandler.js");
const { errorlogging } = require("../../config/logging/errorlogs.js");
const { trackLocale } = require("../../config/logging/localeTracker.js");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

async function getOrCreateProfile(userId, username) {
  let profile = await ProfileData.findOne({ userId });
  if (!profile) {
    profile = new ProfileData({ userId, username });
    await profile.save();
  }
  return profile;
}

function buildPanPollEmbed(pollData) {
  return new EmbedBuilder()
    .setTitle("Pots vs Pans Poll")
    .setDescription("Which do you prefer?")
    .setColor(0xff00ae)
    .addFields(
      { name: "Pots", value: `${pollData.pots || 0} votes`, inline: true },
      { name: "Pans", value: `${pollData.pans || 0} votes`, inline: true },
    );
}

function buildPanPollButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pan_poll_pots")
      .setLabel("Pots")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("pan_poll_pans")
      .setLabel("Pans")
      .setStyle(ButtonStyle.Success),
  );
}

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
        (cmd) => cmd.commandName === commandName,
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
      0,
    );

    if (uniqueCommandsUsed >= 2 || totalUsageCount >= 3) {
      userUsage.feedbackPromptShown = true;
      userUsage.feedbackPromptShownAt = new Date();
      await userUsage.save();

      // Create feedback prompt embed
      const feedbackPromptEmbed = new EmbedBuilder()
        .setTitle("Help Improve PrideBot!")
        .setDescription(
          "Hey there! We noticed you've been using PrideBot quite a bit and we'd love to hear your thoughts!\n\n Use the `/feedback` command to share your suggestions, report bugs, or just let us know what you think.",
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
            error,
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
            { upsert: true, new: true },
          );
          if (interaction.guild) usageData.guildCount += 1;
          else usageData.userContextCount += 1;
          await usageData.save();
        }

        await trackUserCommandUsage(userId, commandName);
        trackLocale(interaction.locale);
        await command.execute(interaction, client, { userId, guildId });
        if (commandName !== "feedback") {
          await checkAndShowFeedbackPrompt(interaction, userId);
        }
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId === "customWebsiteModal"
      ) {
        console.log(
          `[MODAL SUBMIT] ${interaction.user.tag} - ${interaction.customId}`,
        );
        await handleModalSubmit(interaction, client);
      } else if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "premium_mode_select"
      ) {
        const selected = interaction.values[0];
        const userId = interaction.user.id;
        const profile = await getOrCreateProfile(userId, interaction.user.username);

        if (selected === "range") {
          const canRange = await hasFeature(userId, "darRange");
          if (!canRange) {
            const embed = new EmbedBuilder()
              .setTitle("LGBTQ++ feature")
              .setColor(0xff66cc)
              .setDescription("Custom range mode requires the **Pridebot LGBTQ++** tier.\n\n[**View premium plans**](https://pridebot.xyz/premium)");
            return await interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }

        if (selected === "fixed") {
          const canFixed = await hasFeature(userId, "darFixedValue");
          if (!canFixed) {
            const embed = new EmbedBuilder()
              .setTitle("Supporter feature")
              .setColor(0xff66cc)
              .setDescription("Fixed value mode requires the **Pridebot Supporter** tier or above.\n\n[**View premium plans**](https://pridebot.xyz/premium)");
            return await interaction.reply({ embeds: [embed], ephemeral: true });
          }
          const fixedValuesMap = profile.darFixedValues || new Map();
          const setCount = [...fixedValuesMap.values()].filter(v => v !== null && v !== undefined).length;
          if (setCount === 0) {
            const embed = new EmbedBuilder()
              .setColor(0xff66cc)
              .setDescription("Set a fixed value first using the **Set dar value** button, then switch to this mode.");
            return await interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }

        profile.darMode = selected;
        await profile.save();

        const modeNames = { rng: "🎲 Random", range: "📊 Custom range", fixed: "🔒 Fixed value" };
        const embed = new EmbedBuilder()
          .setTitle("Dar mode updated")
          .setColor(0xff66cc)
          .setDescription(`Your dar mode is now **${modeNames[selected]}**.`);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "removeWebsiteSelect"
      ) {
        console.log(
          `[SELECT MENU] ${interaction.user.tag} - ${interaction.customId}`,
        );
        await handleRemoveWebsite(interaction, client);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("feedback_modal_")
      ) {
        console.log(
          `[FEEDBACK MODAL] ${interaction.user.tag} - ${interaction.customId}`,
        );
        await handleFeedbackModal(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_yes_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Accepted survey`,
        );
        await handleProfileSurveyResponse(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_no_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Declined survey`,
        );
        await handleProfileSurveyResponse(interaction);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("profile_survey_q1_")
      ) {
        console.log(`[PROFILE SURVEY] ${interaction.user.tag} - Submitted Q1`);
        await handleQuestion1Submission(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_q2_yes_")
      ) {
        console.log(`[PROFILE SURVEY] ${interaction.user.tag} - Q2: Yes`);
        await handleQuestion2Response(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("profile_survey_q2_no_")
      ) {
        console.log(`[PROFILE SURVEY] ${interaction.user.tag} - Q2: No`);
        await handleQuestion2Response(interaction);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("profile_survey_q3_")
      ) {
        console.log(
          `[PROFILE SURVEY] ${interaction.user.tag} - Submitted Q3 (Complete)`,
        );
        await handleQuestion3Submission(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("alter_profile_")
      ) {
        console.log(
          `[ALTER PROFILE] ${interaction.user.tag} - Opened alter profile`,
        );
        await handleAlterProfileButton(interaction, client);
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("back_to_profile_")
      ) {
        console.log(
          `[ALTER PROFILE] ${interaction.user.tag} - Back to profile`,
        );
        await handleBackToProfileButton(interaction, client);
      } else if (
        interaction.isButton() &&
        interaction.customId === "premium_set_range"
      ) {
        const profile = await getOrCreateProfile(interaction.user.id, interaction.user.username);
        const tier = profile.premiumTier;

        const minPlaceholder = tier === "lgbtqpp" ? "Min -500, default 0" : "Fixed at 0";
        const maxPlaceholder = tier === "lgbtqpp" ? "Max 500, default 100" : "Fixed at 100";

        const modal = new ModalBuilder()
          .setCustomId("premium_range_modal")
          .setTitle("Set your dar range");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("range_min")
              .setLabel("Lowest result")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(minPlaceholder)
              .setValue(String(profile.darRangeMin))
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("range_max")
              .setLabel("Highest result")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(maxPlaceholder)
              .setValue(String(profile.darRangeMax))
          )
        );

        await interaction.showModal(modal);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId === "premium_range_modal"
      ) {
        const minStr = interaction.fields.getTextInputValue("range_min");
        const maxStr = interaction.fields.getTextInputValue("range_max");
        const min = parseInt(minStr, 10);
        const max = parseInt(maxStr, 10);

        if (isNaN(min) || isNaN(max)) {
          const embed = new EmbedBuilder()
            .setColor(0xff66cc)
            .setDescription("Please enter valid whole numbers for both fields.");
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const profile = await getOrCreateProfile(interaction.user.id, interaction.user.username);
        const tier = profile.premiumTier;

        if (tier !== "lgbtqpp") {
          const embed = new EmbedBuilder()
            .setTitle("Range locked")
            .setColor(0xff66cc)
            .setDescription("Custom dar ranges require the **Pridebot LGBTQ++** tier.\n\n[**View premium plans**](https://pridebot.xyz/premium)");
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (min < -500 || max > 500 || min >= max) {
          const embed = new EmbedBuilder()
            .setColor(0xff66cc)
            .setDescription("Invalid range. Min must be ≥ -500, max must be ≤ 500, and min must be less than max.");
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        profile.darRangeMin = min;
        profile.darRangeMax = max;
        await profile.save();

        const embed = new EmbedBuilder()
          .setTitle("Dar range updated")
          .setColor(0xff66cc)
          .setDescription(`Your dar range is now **${min} to ${max}**.`);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (
        interaction.isButton() &&
        interaction.customId === "premium_set_value"
      ) {
        const profile = await getOrCreateProfile(interaction.user.id, interaction.user.username);
        const tier = profile.premiumTier;
        const limit = getFixedValueLimit(tier);
        const fixedValuesMap = profile.darFixedValues || new Map();
        const setCount = [...fixedValuesMap.values()].filter(v => v !== null && v !== undefined).length;

        const DAR_COMMANDS = ["gaydar", "transdar", "lesdar", "bidar", "rizzdar", "queerdar"];
        const options = DAR_COMMANDS.map(cmd => {
          const current = fixedValuesMap.get(cmd);
          const hasVal = current !== null && current !== undefined;
          return new StringSelectMenuOptionBuilder()
            .setLabel(cmd.charAt(0).toUpperCase() + cmd.slice(1))
            .setDescription(hasVal ? `Currently: ${current}% — select to edit or clear` : "Not set")
            .setValue(cmd);
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("premium_value_command_select")
          .setPlaceholder(`Select a dar command (${setCount}/${limit} slots used)`)
          .addOptions(options);

        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xff66cc).setDescription(`**Set a fixed dar value**\nChoose which dar command to configure. Leave the value blank to clear it.\nSlots: **${setCount}/${limit}** used.`)],
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          ephemeral: true,
        });
      } else if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "premium_value_command_select"
      ) {
        const commandName = interaction.values[0];
        const profile = await getOrCreateProfile(interaction.user.id, interaction.user.username);
        const tier = profile.premiumTier;
        const limit = getFixedValueLimit(tier);
        const fixedValuesMap = profile.darFixedValues || new Map();
        const currentVal = fixedValuesMap.get(commandName);
        const hasCurrentVal = currentVal !== null && currentVal !== undefined;
        const setCount = [...fixedValuesMap.values()].filter(v => v !== null && v !== undefined).length;

        if (!hasCurrentVal && setCount >= limit) {
          const embed = new EmbedBuilder()
            .setColor(0xff66cc)
            .setDescription(`You've used all **${limit}** fixed value slot${limit !== 1 ? "s" : ""} for your tier. Clear an existing one first.`);
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const maxVal = tier === "lgbtqpp" ? 500 : 100;
        const minVal = tier === "lgbtqpp" ? -500 : 0;
        const label = commandName.charAt(0).toUpperCase() + commandName.slice(1);

        const modal = new ModalBuilder()
          .setCustomId(`premium_value_modal:${commandName}`)
          .setTitle(`Set fixed value — ${label}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("fixed_value")
              .setLabel(`Fixed result (${minVal} to ${maxVal}), blank to clear`)
              .setStyle(TextInputStyle.Short)
              .setValue(hasCurrentVal ? String(currentVal) : "")
              .setRequired(false)
          )
        );

        await interaction.showModal(modal);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("premium_value_modal:")
      ) {
        const commandName = interaction.customId.split(":")[1];
        const raw = interaction.fields.getTextInputValue("fixed_value").trim();
        const profile = await getOrCreateProfile(interaction.user.id, interaction.user.username);
        const tier = profile.premiumTier;

        const canUse = await hasFeature(interaction.user.id, "darFixedValue");
        if (!canUse) {
          const embed = new EmbedBuilder()
            .setTitle("Premium feature")
            .setColor(0xff66cc)
            .setDescription("Fixed dar values require the **Pridebot Supporter** tier or above.\n\n[**View premium plans**](https://pridebot.xyz/premium)");
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const label = commandName.charAt(0).toUpperCase() + commandName.slice(1);

        if (raw === "") {
          profile.darFixedValues.delete(commandName);
          profile.markModified("darFixedValues");
          await profile.save();
          const embed = new EmbedBuilder()
            .setTitle("Dar value cleared")
            .setColor(0xff66cc)
            .setDescription(`Fixed value for **${label}** has been cleared.`);
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const val = parseInt(raw, 10);
        if (isNaN(val)) {
          const embed = new EmbedBuilder()
            .setColor(0xff66cc)
            .setDescription("Please enter a valid whole number, or leave blank to clear.");
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const maxVal = tier === "lgbtqpp" ? 500 : 100;
        const minVal = tier === "lgbtqpp" ? -500 : 0;
        if (val < minVal || val > maxVal) {
          const embed = new EmbedBuilder()
            .setColor(0xff66cc)
            .setDescription(`Value must be between **${minVal}** and **${maxVal}** for your tier.`);
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        profile.darFixedValues.set(commandName, val);
        profile.markModified("darFixedValues");
        await profile.save();

        const embed = new EmbedBuilder()
          .setTitle("Dar value set")
          .setColor(0xff66cc)
          .setDescription(`**${label}** will now always return **${val}%** when in fixed mode.\nLeave the field blank to clear it.`);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (
        interaction.isButton() &&
        interaction.customId === "premium_view_history"
      ) {
        const profile = await getOrCreateProfile(interaction.user.id, interaction.user.username);
        const history = (profile.darHistory || []).slice(-10).reverse();

        if (history.length === 0) {
          return await interaction.reply({
            content: "No dar history recorded yet. Use any dar command to start tracking.",
            ephemeral: true,
          });
        }

        const lines = history.map(
          (entry) => `**${entry.command}** — ${entry.result}% — ${timeAgo(entry.timestamp)}`
        );

        const embed = new EmbedBuilder()
          .setTitle("Your Dar History")
          .setColor(0xff66cc)
          .setDescription(lines.join("\n"));

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (
        interaction.isButton() &&
        interaction.customId.startsWith("pan_poll_")
      ) {
        const choice =
          interaction.customId === "pan_poll_pots" ? "pots" : "pans";
        const userId = interaction.user.id;

        let pollDoc = await PanVSPot.findOne();
        if (!pollDoc) {
          pollDoc = await PanVSPot.create({});
        }

        const updatedPoll = await PanVSPot.findOneAndUpdate(
          {
            _id: pollDoc._id,
            "voters.userId": { $ne: userId },
          },
          {
            $inc: { [choice]: 1 },
            $push: { voters: { userId, choice } },
          },
          { new: true },
        );

        if (!updatedPoll) {
          await interaction.reply({
            content: "You've already voted in this poll.",
            ephemeral: true,
          });
          return;
        }

        const updatedPollEmbed = buildPanPollEmbed(updatedPoll);
        const embeds = interaction.message.embeds.map((embed) =>
          EmbedBuilder.from(embed),
        );

        if (embeds.length >= 2) {
          embeds[1] = updatedPollEmbed;
        } else {
          embeds.push(updatedPollEmbed);
        }

        await interaction.update({
          embeds,
          components: [buildPanPollButtons()],
        });
      }
    } catch (error) {
      const guild = interaction.guild;
      const channel = interaction.channel;
      const cmd = interaction.commandName || interaction.customId || "unknown";

      // DiscordAPIError[10062]: Unknown Interaction — interaction expired or already handled
      if (error.code === 10062) {
        console.warn(
          `[WARN] Unknown Interaction (10062) for ${cmd} — interaction expired or already responded to.`,
        );
        return;
      }

      // DiscordAPIError[50013]: Missing Permissions
      if (error.code === 50013) {
        console.warn(
          `[WARN] Missing Permissions (50013) for ${cmd} in ${guild ? guild.name : "DM"}.`,
        );
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
