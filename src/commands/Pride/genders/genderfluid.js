const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("genderfluid")
    .setNameLocalizations({
      de: "genderfluid",
      "en-GB": "genderfluid",
      "es-ES": "genderfluid",
      fi: "genderfluid",
      ru: "гендерфлюиде"
    })
    .setDescription("Who stole my fluid!!!")
    .setDescriptionLocalizations({
      de: "Wer hat meine Flüssigkeit gestohlen?",
      "en-GB": "Who stole my fluid?",
      "es-ES": "¿Quién robó mi fluido?",
      fi: "Kuka varasti nesteeni!!!",
      ru: "Кто украл мою жидкость!!!"
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "genderfluid";
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
      .setTitle(`<:_:1112196520477999226> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_genderfluid.name,
          value: translations.what_is_genderfluid.value,
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
