require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Support Pridebot by voting for us here"),

  async execute(interaction, client) {
   const voteembed = new EmbedBuilder()
      .setTitle("Thank you for voting!")
      .setColor(0xff00ae)
      .addFields(
        {
          name: "<:Ic_Pridebot_topgg:1486222503931150357> Top.gg",
          value: `https://top.gg/bot/1101256478632972369/vote`,
          inline: false,
        },
        {
          name: "<:Ic_Pridebot_DS:1486223002658930798> Discords.com",
          value: `https://discords.com/bots/bot/1101256478632972369/vote`,
          inline: false,
        },
        {
          name: "<:Ic_Pridebot_BL:1486222799960936569> Botlist.me ",
          value: "https://botlist.me/bots/1101256478632972369",
        },
        {
          name: "<:Ic_Pridebot_DL:1486467161215209703> Discordlist.gg",
          value: "https://discordlist.gg/bot/1101256478632972369/vote",
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [voteembed] });
    await commandLogging(client, interaction);
  },
};
