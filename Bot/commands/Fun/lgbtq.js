const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../utils/logging/commandlog");
const { loadTranslations } = require("../../../Shared/locales");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lgbtqia")
    .setDescription(
      "Are you a member of lettuce, guac, bacon, tomato, queso people?"
    ),

  async execute(interaction, client) {
    const t = loadTranslations(interaction.locale, "Fun", "lgbtq");
    const embed = new EmbedBuilder()
      .setTitle(t.title)
      .setDescription(t.description)
      .setColor(0xff00ae);
    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
