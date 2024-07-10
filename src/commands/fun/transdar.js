const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/commandfunctions/commandlog");
const utility_functions = {
  chance: function (probability) {
    if (Math.random() > probability) return false;
    return true;
  },
  number_format_commas: function (number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },
};
const ids = {
  idiot: "197794050823290880",
  thomas: "369518015320162318",
  tree: "950951110829551658",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transdar")
    .setDescription("How trans are you?")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("See how trans a user is")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const targetUser =
      interaction.options.getUser("target") || interaction.user;
    const userName = targetUser.username;
    const userid = targetUser.id;

    let meter;
    if (utility_functions.chance(0.0001)) {
      meter = Math.floor(Math.random() * 2354082) + 500;
      if (utility_functions.chance(0.5)) {
        meter *= -1;
      }
    } else if (userid === ids.idiot) {
      meter = "morbius";
    } else if (userid === ids.thomas) {
      meter = 100;
    } else if (userid === ids.tree) {
      meter = 100;
    } else {
      meter = Math.floor(Math.random() * 101);
    }

    const embed = new EmbedBuilder()
      .setTitle(`How trans is ${userName}?`)
      .setDescription(
        `<@${userid}> is **${utility_functions.number_format_commas(
          meter
        )}% trans!**`
      )
      .setColor(0xff00ae)
      .setFooter({
        text: "The bot has 99.99% accuracy rate on checking users transness",
      });
    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
