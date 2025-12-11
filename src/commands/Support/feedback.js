const {
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const Feedback = require("../../../mongo/models/feedbackSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Send feedback about PrideBot to help us improve!")
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const isPublic = interaction.options.getBoolean("public", false);

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId("feedback_category")
      .setPlaceholder("Select feedback category...")
      .addOptions([
        {
          label: "General Feedback",
          description: "General thoughts and suggestions",
          value: "general",
          emoji: "💬",
        },
        {
          label: "Data Delete Request",
          description: "Request deletion of your data from our database",
          value: "data_delete",
          emoji: "🗑️",
        },
        {
          label: "Bug Report",
          description: "Report a bug or issue you encountered",
          value: "bug",
          emoji: "🐛",
        },
        {
          label: "Feature Request",
          description: "Suggest a new feature or command",
          value: "feature",
          emoji: "✨",
        },
        {
          label: "Improvement",
          description: "Suggest improvements to existing features",
          value: "improvement",
          emoji: "🔧",
        },
        {
          label: "Other",
          description: "Something else you'd like to share",
          value: "other",
          emoji: "📝",
        },
      ]);

    const row = new ActionRowBuilder().addComponents(categorySelect);

    const embed = new EmbedBuilder()
      .setTitle("Send Feedback")
      .setDescription(
        "Your feedback helps us make PrideBot better for everyone!\n\n" +
          "**What can you share with us?**\n" +
          "• General thoughts about the bot\n" +
          "• Bug reports and issues\n" +
          "• New feature suggestions\n" +
          "• Improvements to existing commands\n" +
          "• Anything else on your mind!\n\n" +
          "If you have a data deletion request, please select the 'Data Delete Request' option.\n\n" +
          "**Please select a category below to get started:**"
      )
      .setColor(0xff00ae);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: !isPublic,
    });

    let collector;
    const filter = (i) =>
      i.customId === "feedback_category" && i.user.id === interaction.user.id;
    try {
      if (interaction.channel) {
        collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 300000,
        });
      } else {
        const message = await interaction.fetchReply();
        collector = message.createMessageComponentCollector({
          filter,
          time: 300000,
        });
      }
    } catch (err) {
      console.error("Failed to create component collector:", err);
      return;
    }

    collector.on("collect", async (selectInteraction) => {
      const category = selectInteraction.values[0];

      if (category === "data_delete") {
        const dataTypeSelect = new StringSelectMenuBuilder()
          .setCustomId("data_delete_type")
          .setPlaceholder("Select what data you want deleted...")
          .setMinValues(1)
          .setMaxValues(4)
          .addOptions([
            {
              label: "Profile Data",
              description: "Delete your profile information",
              value: "profile",
              emoji: "👤",
            },
            {
              label: "Avatar Data",
              description: "Delete your generated avatars",
              value: "avatars",
              emoji: "🖼️",
            },
            {
              label: "Command Logs",
              description: "Delete your command usage logs",
              value: "command_logs",
              emoji: "📊",
            },
            {
              label: "All Data",
              description: "Delete all of your data from our database",
              value: "all_data",
              emoji: "🗑️",
            },
          ]);

        const dataRow = new ActionRowBuilder().addComponents(dataTypeSelect);

        const dataDeleteEmbed = new EmbedBuilder()
          .setTitle("🗑️ Data Deletion Request")
          .setDescription(
            "**Select what data you want to delete:**\n\n" +
              "• **Profile Data** - Your profile information and settings\n" +
              "• **Avatar Data** - Your generated pride avatars\n" +
              "• **Command Logs** - Your command usage history\n" +
              "• **All Data** - Everything we have stored about you\n\n" +
              "⚠️ **Important:** Data deletion is permanent and cannot be undone.\n" +
              "After selecting, you'll be asked to provide additional details about your request."
          )
          .setColor(0xff6b6b);

        await selectInteraction.update({
          embeds: [dataDeleteEmbed],
          components: [dataRow],
        });

        const dataFilter = (i) =>
          i.customId === "data_delete_type" &&
          i.user.id === interaction.user.id;

        let dataCollector;
        try {
          if (interaction.channel) {
            dataCollector = interaction.channel.createMessageComponentCollector(
              {
                filter: dataFilter,
                time: 300000,
              }
            );
          } else {
            const message = await interaction.fetchReply();
            dataCollector = message.createMessageComponentCollector({
              filter: dataFilter,
              time: 300000,
            });
          }
        } catch (err) {
          console.error("Failed to create data type collector:", err);
          return;
        }

        dataCollector.on("collect", async (dataSelectInteraction) => {
          const dataTypes = dataSelectInteraction.values;

          const modal = new ModalBuilder()
            .setCustomId(`feedback_modal_data_delete_${dataTypes.join(",")}`)
            .setTitle("🗑️ Data Deletion Request");

          const reasonInput = new TextInputBuilder()
            .setCustomId("deletion_reason")
            .setLabel("Reason for deletion (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
              "Let us know why you're requesting data deletion (optional)..."
            )
            .setRequired(false)
            .setMaxLength(500);

          const confirmInput = new TextInputBuilder()
            .setCustomId("deletion_confirm")
            .setLabel("Type 'CONFIRM' to proceed")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("CONFIRM")
            .setRequired(true)
            .setMaxLength(7);

          const firstRow = new ActionRowBuilder().addComponents(reasonInput);
          const secondRow = new ActionRowBuilder().addComponents(confirmInput);
          modal.addComponents(firstRow, secondRow);

          await dataSelectInteraction.showModal(modal);
        });

        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`feedback_modal_${category}`)
        .setTitle(`${getCategoryEmoji(category)} ${getCategoryName(category)}`);

      const feedbackInput = new TextInputBuilder()
        .setCustomId("feedback_text")
        .setLabel("Your Feedback")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Share your thoughts, suggestions, or report issues here..."
        )
        .setRequired(true)
        .setMaxLength(1000);

      const firstActionRow = new ActionRowBuilder().addComponents(
        feedbackInput
      );
      modal.addComponents(firstActionRow);

      await selectInteraction.showModal(modal);
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        interaction
          .editReply({
            embeds: [embed],
            components: [],
          })
          .catch(() => {});
      }
    });

    await commandLogging(client, interaction);
  },
};

const handleFeedbackModal = async (interaction) => {
  const customIdParts = interaction.customId.split("_");
  const category = customIdParts[2];

  if (category === "data" && customIdParts[3] === "delete") {
    const dataTypes = customIdParts.slice(4).join("_").split(",");
    const deletionReason =
      interaction.fields.getTextInputValue("deletion_reason") ||
      "No reason provided";
    const confirmText =
      interaction.fields.getTextInputValue("deletion_confirm");

    if (confirmText.toUpperCase() !== "CONFIRM") {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Confirmation Failed")
        .setDescription(
          "You must type 'CONFIRM' exactly to proceed with data deletion.\n\n" +
            "Please use the `/feedback` command again if you wish to submit a deletion request."
        )
        .setColor(0xff0000);

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
      return;
    }

    try {
      const feedback = new Feedback({
        userId: interaction.user.id,
        username: interaction.user.username,
        guildId: interaction.guild?.id || null,
        guildName: interaction.guild?.name || null,
        feedback: `Data Deletion Request\n\nData Types: ${dataTypes.join(
          ", "
        )}\n\nReason: ${deletionReason}`,
        category: "data_delete",
        metadata: {
          dataTypes: dataTypes,
          deletionReason: deletionReason,
          confirmed: true,
        },
      });

      await feedback.save();

      const dataTypeNames = dataTypes.map((type) => {
        const typeMap = {
          profile: "Profile Data",
          avatars: "Avatar Data",
          command_logs: "Command Logs",
          all_data: "All Data",
        };
        return typeMap[type] || type;
      });

      const confirmEmbed = new EmbedBuilder()
        .setTitle("🗑️ Data Deletion Request Submitted")
        .setDescription(
          "**Your data deletion request has been received and our developers have been alerted.**\n\n" +
            "**What happens next?**\n" +
            "• Our development team will review your request\n" +
            "• We will process the deletion within 30 days as required by data protection regulations\n" +
            "• You may be contacted if we need to verify your identity\n" +
            "• Once completed, you'll receive confirmation (if possible)\n\n" +
            "⚠️ **Important:** This action is permanent and cannot be undone.\n\n" +
            "If you have any questions, please join our support server."
        )
        .setColor(0xff6b6b)
        .addFields([
          {
            name: "Requested Data Types",
            value: dataTypeNames.join("\n"),
            inline: false,
          },
          {
            name: "Request ID",
            value: `\`${feedback._id}\``,
            inline: false,
          },
        ])
        .setFooter({
          text: "Thank you for using PrideBot",
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [confirmEmbed],
        ephemeral: true,
      });
      await sendDataDeletionNotification(
        interaction.client,
        feedback,
        interaction.user,
        dataTypes
      );
    } catch (error) {
      console.error("Error saving data deletion request:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(
          "Sorry, there was an error submitting your deletion request. Please try again later or contact support."
        )
        .setColor(0xff0000);

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
    return;
  }

  const feedbackText = interaction.fields.getTextInputValue("feedback_text");

  try {
    const feedback = new Feedback({
      userId: interaction.user.id,
      username: interaction.user.username,
      guildId: interaction.guild?.id || null,
      guildName: interaction.guild?.name || null,
      feedback: feedbackText,
      category: category,
    });

    await feedback.save();

    const UserCommandUsage = require("../../../mongo/models/userCommandUsageSchema");
    await UserCommandUsage.updateOne(
      { userId: interaction.user.id },
      {
        $set: { hasSentFeedback: true },
        $setOnInsert: { userId: interaction.user.id },
      },
      { upsert: true }
    );

    const confirmEmbed = new EmbedBuilder()
      .setTitle("Feedback Received!")
      .setDescription(
        "Thank you for your feedback! Your input is valuable to us and helps make PrideBot better for everyone.\n\n" +
          "**What happens next?**\n" +
          "• Our team will review your feedback\n" +
          "• We may reach out if we need clarification\n" +
          "• Valuable feedback contributors may receive Discord Nitro as a thank you!\n\n" +
          "Keep an eye on our support server for updates and announcements!"
      )
      .setColor(0x00ff00)
      .addFields([
        {
          name: "Your Feedback",
          value: `**Category:** ${getCategoryName(
            category
          )}\n**Feedback:** ${feedbackText.substring(0, 200)}${
            feedbackText.length > 200 ? "..." : ""
          }`,
          inline: false,
        },
      ])
      .setFooter({
        text: "Thank you for helping us improve PrideBot!",
      });

    await interaction.reply({
      embeds: [confirmEmbed],
      ephemeral: true,
    });

    await sendFeedbackNotification(
      interaction.client,
      feedback,
      interaction.user
    );
  } catch (error) {
    console.error("Error saving feedback:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error")
      .setDescription(
        "Sorry, there was an error saving your feedback. Please try again later."
      )
      .setColor(0xff0000);

    await interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true,
    });
  }
};

function getCategoryEmoji(category) {
  const emojis = {
    general: "💬",
    data_delete: "🗑️",
    bug: "🐛",
    feature: "✨",
    improvement: "🔧",
    other: "📝",
  };
  return emojis[category] || "📝";
}

function getCategoryName(category) {
  const names = {
    general: "General Feedback",
    data_delete: "Data Delete Request",
    bug: "Bug Report",
    feature: "Feature Request",
    improvement: "Improvement Suggestion",
    other: "Other",
  };
  return names[category] || "Other";
}

async function sendFeedbackNotification(client, feedback, user) {
  try {
    const { sendLog } = require("../../config/logging/sendlogs");

    const notificationEmbed = new EmbedBuilder()
      .setTitle("📝 New Feedback Received")
      .setDescription(
        `**From:** ${user.username} (${
          user.id
        })\n**Category:** ${getCategoryName(feedback.category)}`
      )
      .addFields([
        {
          name: "Feedback",
          value: feedback.feedback.substring(0, 1000),
          inline: false,
        },
        {
          name: "Server Info",
          value: feedback.guildId
            ? `${feedback.guildName} (${feedback.guildId})`
            : "Direct Message",
          inline: true,
        },
        {
          name: "Timestamp",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
      ])
      .setColor(0xff00ae)
      .setFooter({
        text: `Feedback ID: ${feedback._id}`,
      });

    await sendLog(client, notificationEmbed, "1426639419083063376");
  } catch (error) {
    console.error("Error sending feedback notification:", error);
  }
}

async function sendDataDeletionNotification(client, feedback, user, dataTypes) {
  try {
    const { sendLog } = require("../../config/logging/sendlogs");

    const dataTypeNames = dataTypes.map((type) => {
      const typeMap = {
        profile: "Profile Data",
        avatars: "Avatar Data",
        command_logs: "Command Logs",
        all_data: "All Data",
      };
      return typeMap[type] || type;
    });

    const notificationEmbed = new EmbedBuilder()
      .setTitle("🗑️ DATA DELETION REQUEST")
      .setDescription(
        `**⚠️ URGENT: User has requested data deletion**\n\n` +
          `**User:** ${user.username} (${user.tag})\n` +
          `**User ID:** ${user.id}\n` +
          `**Request ID:** ${feedback._id}`
      )
      .addFields([
        {
          name: "Requested Data Types",
          value: dataTypeNames.join("\n"),
          inline: false,
        },
        {
          name: "Reason",
          value: feedback.metadata?.deletionReason || "No reason provided",
          inline: false,
        },
        {
          name: "Server Info",
          value: feedback.guildId
            ? `${feedback.guildName} (${feedback.guildId})`
            : "Direct Message",
          inline: true,
        },
        {
          name: "Timestamp",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
        {
          name: "⏰ Action Required",
          value:
            "This request must be processed within 30 days per data protection regulations.",
          inline: false,
        },
      ])
      .setColor(0xff0000)
      .setFooter({
        text: `Feedback ID: ${feedback._id} | GDPR Compliance Required`,
      });

    await sendLog(client, notificationEmbed, "1426639419083063376");
  } catch (error) {
    console.error("Error sending data deletion notification:", error);
  }
}

module.exports.handleFeedbackModal = handleFeedbackModal;
