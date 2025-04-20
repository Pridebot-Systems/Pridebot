const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bisexual")
    .setNameLocalizations({
      de: "bisexualität",
      el: "aμφιφυλόφιλη",
      "en-GB": "bisexual",
      "es-ES": "bisexual",
      fi: "biseksuaali",
      nl: "biseksueel",
      ru: "бисексуал",
    })
    .setDescription("Why am I bi myself again ;-;")
    .setDescriptionLocalizations({
      de: "Warum bin ich wieder bi alleine ;-;",
      el: "Γιατί είμαι πάλι bi μόνος μου ;-;",
      "en-GB": "Why am I bi myself again ;-;",
      "es-ES": "Por qué soy bi yo mismo otra vez ;-;",
      fi: "Miksi olen taas bi yksin ;-;",
      nl: "Waarom ben ik weer bi mezelf ;-;",
      ru: "Почему я снова би сам по себе ;-;",
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "bisexual";
    let translations;
    try {
      translations = loadTranslations(interactionLocale, category, commandName);
    } catch (error) {
      console.error(`Error loading translations:`, error);
      translations = loadTranslations("en-US", category, commandName);
      await interaction.reply(
        `Your language (${interactionLocale}) is not set up. Defaulting to English.`
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(`<:_:1108823482856382474> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_bisexuality.name,
          value: translations.what_is_bisexuality.value,
        },
        {
          name: translations.history.name,
          value: translations.history.value,
        },
        {
          name: translations.flag.name,
          value: translations.flag.value,
        },
        {
          name: translations.days.name,
          value: translations.days.value,
        }
      );

    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
