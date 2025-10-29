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
          "**Please select a category below to get started:**"
      )
      .setColor(0xff00ae)
      .setFooter({
        text: "Users who provide valuable feedback may be eligible for Discord Nitro rewards!",
      });

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
  const category = interaction.customId.split("_")[2];
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

module.exports.handleFeedbackModal = handleFeedbackModal;
