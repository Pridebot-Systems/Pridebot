const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const darlogging = require("../../config/logging/darlog");
const DarList = require("../../../mongo/models/idDarSchema");
const loadTranslations = require("../../config/commandfunctions/translation");

const utility_functions = {
  chance: function (probability) {
    return Math.random() <= probability;
  },
  number_format_commas: function (number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gaydar")
    .setDescription("How gay are you?")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("See how gay a user is")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const t = loadTranslations(interaction.locale, "Fun", "gaydar");
    const targetUser =
      interaction.options.getUser("target") || interaction.user;
    const userName = targetUser.username;
    const userid = targetUser.id;

    let meter;
    try {
      const darList = await DarList.findOne();

      if (darList) {
        const gaydarEntry = darList.gaydar.find(
          (entry) => entry.userid === userid
        );

        if (gaydarEntry) {
          meter = gaydarEntry.meter;
        } else {
          meter = Math.floor(Math.random() * 101);
          if (utility_functions.chance(0.0001)) {
            meter = Math.floor(Math.random() * 2354082) + 500;
            if (utility_functions.chance(0.5)) {
              meter *= -1;
            }
          }
        }
      } else {
        meter = Math.floor(Math.random() * 101);

        if (utility_functions.chance(0.0001)) {
          meter = Math.floor(Math.random() * 2354082) + 500;
          if (utility_functions.chance(0.5)) {
            meter *= -1;
          }
        }
      }
    } catch (err) {
      console.error(err);
      meter = Math.floor(Math.random() * 101);
    }

    const embed = new EmbedBuilder()
      .setTitle(t.title.replace("{{username}}", userName))
      .setDescription(
        t.description
          .replace("{{mention}}", `<@${userid}>`)
          .replace("{{meter}}", utility_functions.number_format_commas(meter))
      )
      .setColor(0xff00ae)
      .setFooter({ text: t.footer });

    try {
      await interaction.editReply({ embeds: [embed] }); // Edit the deferred reply
    } catch (error) {
      console.error("Error sending response:", error);
    }

    await commandLogging(client, interaction);
    await darlogging(client, "Gaydar", userName, meter, userid);
  },
};
