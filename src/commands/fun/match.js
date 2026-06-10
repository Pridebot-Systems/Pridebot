const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const loadTranslations = require("../../config/commandfunctions/translation");
const utility_functions = {
  chance: function (probability) {
    return Math.random() < probability;
  },
  number_format_commas: function (number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("match")
    .setDescription("Determine the compatibility between two users.")
    .addUserOption((option) =>
      option
        .setName("user1")
        .setDescription("The first user to match")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user2")
        .setDescription("The second user to match")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const t = loadTranslations(interaction.locale, "Fun", "match");
    const user1 = interaction.options.getUser("user1");
    let user2 = interaction.options.getUser("user2");

    if (!user2) {
      user2 = interaction.user;
    }

    const user1name = user1.username;
    const user2name = user2.username;

    let description;
    if (utility_functions.chance(0.01)) {
      description = t.description_perfect
        .replace("{{mention1}}", `<@${user1.id}>`)
        .replace("{{mention2}}", `<@${user2.id}>`);
    } else if (utility_functions.chance(0.01)) {
      description = t.description_none
        .replace("{{mention1}}", `<@${user1.id}>`)
        .replace("{{mention2}}", `<@${user2.id}>`);
    } else {
      description = t.description_percent
        .replace("{{mention1}}", `<@${user1.id}>`)
        .replace("{{mention2}}", `<@${user2.id}>`)
        .replace("{{percent}}", Math.floor(Math.random() * 101));
    }

    const embed = new EmbedBuilder()
      .setTitle(
        t.title
          .replace("{{user1}}", user1name)
          .replace("{{user2}}", user2name)
      )
      .setDescription(description)
      .setColor(0xff00ae)
      .setFooter({ text: t.footer });

      try {
        await interaction.editReply({ embeds: [embed] }); // Edit the deferred reply
      } catch (error) {
        console.error("Error sending response:", error);
      }
    await commandLogging(client, interaction);
  },
};
