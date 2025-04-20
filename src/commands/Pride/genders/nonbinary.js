const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nonbinary")
    .setNameLocalizations({
      de: "nichtbinär",
      "en-GB": "nonbinary",
      fi: "nonbinary",
      ru: "небинарность",
    })
    .setDescription(
      "01001110 01101111 01101110 00101101 01000010 01101001 01101110 01100001 01110010 01111001"
    )
    .setDescriptionLocalizations({
      de: "01101110 01101001 01100011 01101000 01110100 01100010 01101001 01101110 11000011 10100100 01110010",
      "en-GB": "01001110 01101111 01101110 00101101 01000010 01101001 01101110 01100001 01110010 01111001",
      fi: "01001110 01101111 01101110 00101101 01000010 01101001 01101110 01100001 01110010 01111001",
      ru: "01001110 01101111 01101110 00101101 01000010 01101001 01101110 01100001 01110010 01111001",
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "nonbinary";
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
      .setTitle(`<:_:1112196445064413194> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_nonbinary.name,
          value: translations.what_is_nonbinary.value,
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
          name: translations.nonbinary_days.name,
          value: translations.nonbinary_days.value,
        }
      );

    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
