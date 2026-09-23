const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const darlogging = require("../../config/logging/darlog");
const loadTranslations = require("../../config/commandfunctions/translation");
const {
  getDarResult,
  applyDarRange,
  addDarHistory,
  buildDarDescription,
  formatDarMeter,
} = require("../../utils/premiumUtils");

const utility_functions = {
  chance: function (probability) {
    return Math.random() <= probability;
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lesdar")
    .setDescription("How lesbian are you?")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("See how lesbian a user is")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const t = loadTranslations(interaction.locale, "Fun", "lesdar");
    const targetUser =
      interaction.options.getUser("target") || interaction.user;
    const userName = targetUser.username;
    const userid = targetUser.id;

    const { min, max, fixed, pin } = await getDarResult(userid, "lesdar");

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

    await addDarHistory(interaction.user.id, "lesdar", meter);

    const meterDisplay = userid === "1201827969585393676"
      ? "1000000000000000000000000"
      : formatDarMeter(meter);

    const embed = new EmbedBuilder()
      .setTitle(t.title.replace("{{username}}", userName))
      // Custom value for description is a special case as request from dev friend, will allow it for this command only - Sdriver1
      .setDescription(
        buildDarDescription(t.description, `<@${userid}>`, meter, meterDisplay)
      )
      .setColor(0xff00ae)
      .setFooter({ text: t.footer });

    try {
      await interaction.editReply({ embeds: [embed] }); // Edit the deferred reply
    } catch (error) {
      console.error("Error sending response:", error);
    }

    await commandLogging(client, interaction);
    await darlogging(client, "Lesdar", userName, meter, userid);
  },
};
