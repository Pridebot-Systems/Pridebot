const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transgender")
    .setNameLocalizations({
      de: "transgender",
      "en-GB": "transgender",
      fi: "transsukupuolinen",
      ru: "трансгендеры",
    })
    .setDescription("Trans-formers roll out!!")
    .setDescriptionLocalizations({
      de: "Trans-formers, rollt aus!!",
      "en-GB": "Trans-formers roll out!!",
      fi: "Trans-formersit, rullatkaa ulos!!",
      ru: "Тран-сформеры, выходите!!",
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "transgender";
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
      .setTitle(`<:_:1112201010509795348> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_transgender.name,
          value: translations.what_is_transgender.value,
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
          name: translations.transgender_days.name,
          value: translations.transgender_days.value,
        }
      );

    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
