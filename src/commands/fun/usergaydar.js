const {
  EmbedBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} = require("discord.js");
const {
  getDarResult,
  applyDarRange,
  addDarHistory,
  buildDarDescription,
} = require("../../utils/premiumUtils");
const darlogging = require("../../config/logging/darlog");
const loadTranslations = require("../../config/commandfunctions/translation");

const utility_functions = {
  chance: function (probability) {
    return Math.random() <= probability;
  },
};

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("User Gaydar")
    .setType(ApplicationCommandType.User),

  async execute(interaction, client) {
    const t = loadTranslations(interaction.locale, "Fun", "gaydar");
    const targetUser = interaction.targetUser;
    const userName = targetUser.username;
    const userid = targetUser.id;

    const { min, max, fixed, pin } = await getDarResult(userid, "gaydar");

    let meter;
    if (pin !== null) {
      meter = pin;
    } else {
      meter = applyDarRange(min, max);
      if (!fixed && utility_functions.chance(0.0001)) {
        meter = Math.floor(Math.random() * 2354082) + 500;
        if (utility_functions.chance(0.5)) meter *= -1;
      }
    }

    await addDarHistory(interaction.user.id, "gaydar", meter);

    const embed = new EmbedBuilder()
      .setTitle(t.title.replace("{{username}}", userName))
      .setDescription(buildDarDescription(t.description, `<@${userid}>`, meter))
      .setColor(0xff00ae)
      .setFooter({ text: t.footer });

    await interaction.reply({ embeds: [embed] });
    await darlogging(client, "User Gaydar", userName, meter, userid);
  },
};
