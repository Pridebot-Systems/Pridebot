const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queer")
    .setNameLocalizations({
      de: "queer",
      "en-GB": "queer",
      fi: "queer",
      ru: "квир"
    })
    .setDescription("OMG! QUEER!")
    .setDescriptionLocalizations({
      de: "OMG! QUEER!",
      "en-GB": "OMG! QUEER!",
      fi: "OMG! QUEER!",
      ru: "OMG! КВИР!"
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "queer";
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
      .setTitle(`<:_:1177459443231895563> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_queer.name,
          value: translations.what_is_queer.value,
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
          name: translations.important_dates.name,
          value: translations.important_dates.value,
        }
      );

    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
