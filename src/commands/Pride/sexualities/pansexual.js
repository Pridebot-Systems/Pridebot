const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pansexual")
    .setNameLocalizations({
      de: "pansexuell",
      "en-GB": "pansexual",
      fi: "panseksuaali",
      ru: "пансексуал"
    })
    .setDescription("You like pots or pans more?")
    .setDescriptionLocalizations({
      de: "Magst du Töpfe oder Pfannen mehr?",
      "en-GB": "You like pots or pans more?",
      fi: "Pidätkö enemmän kattiloista vai pannuista?",
      ru: "Ты больше любишь горшки или сковородки?"
    }),

  async execute(interaction, client) {
    const interactionLocale = interaction.locale || "en-US";
    const category = "Pride";
    const commandName = "pansexual";
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
      .setTitle(`<:_:1108823338949812355> ${translations.title}`)
      .setDescription(translations.description)
      .setColor(0xff00ae)
      .setFields(
        {
          name: translations.what_is_pansexual.name,
          value: translations.what_is_pansexual.value,
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
          name: translations.pansexual_days.name,
          value: translations.pansexual_days.value,
        }
      );

    await interaction.reply({ embeds: [embed] });
    await commandLogging(client, interaction);
  },
};
