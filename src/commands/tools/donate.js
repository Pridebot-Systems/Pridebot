require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("donate")
    .setDescription("Donate to help support Pridebot"),

  async execute(interaction, client) {

    const embed = new EmbedBuilder()
      .setTitle("Thank you for supporting Pridebot!")
      .setColor(0xff00ae)
      .setDescription("Donations help keep Pridebot running and allow us to continue to provide new features and updates. Premium features will be coming soon!! \n\n[**Donate Here**](https://pridebot.xyz/premium)")
      .setTimestamp();

    await interaction.reply({ embeds: [ embed ] });
    await commandLogging(client, interaction);
  },
};
