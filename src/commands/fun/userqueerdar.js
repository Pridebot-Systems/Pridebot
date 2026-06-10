const {
  EmbedBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} = require("discord.js");
const DarList = require("../../../mongo/models/idDarSchema");
const darlogging = require("../../config/logging/darlog");
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
  data: new ContextMenuCommandBuilder()
    .setName("User Queerdar")
    .setType(ApplicationCommandType.User),

  async execute(interaction, client) {
    const t = loadTranslations(interaction.locale, "Fun", "queerdar");
    const targetUser = interaction.targetUser;
    const userName = targetUser.username;
    const userid = targetUser.id;

    let meter;
    try {
      const darList = await DarList.findOne();

      if (darList) {
        const queerdarEntry = darList.queerdar.find(
          (entry) => entry.userid === userid
        );

        if (queerdarEntry) {
          meter = queerdarEntry.meter;
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
    await interaction.reply({ embeds: [embed] });
    await darlogging(client, "User Queerdar", userName, meter, userid);
  },
};
