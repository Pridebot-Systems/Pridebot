const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gay")
    .setNameLocalizations({
      de: "schwul",
      "en-GB": "gay",
      "es-ES": "gay",
      fi: "homo",
      ru: "гей",
    })
    .setDescription("Imagine being gay, couldn't be me")
    .setDescriptionLocalizations({
      de: "Stell dir vor, du bist schwul, könnte ich nicht sein.",
      "en-GB": "Imagine being gay, couldn't be me",
      "es-ES": "Imagina ser gay, no podría ser yo",
      fi: "Kuvittele olevasi homo, en voisi olla minä.",
      ru: "Представь себе, что ты гей, это не про меня",
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "gay";
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
      .setTitle(`<:_:1109676932251000923> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_gay.name,
          value: translations.what_is_gay.value,
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
