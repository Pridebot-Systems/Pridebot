const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const loadTranslations = require("../../../config/commandfunctions/translation");
const PanVSPot = require("../../../../mongo/models/panvspotSchema");

function buildPollEmbed(pollData) {
  return new EmbedBuilder()
    .setTitle("Pots vs Pans Poll")
    .setDescription("Which do you prefer?")
    .setColor(0xff00ae)
    .addFields(
      { name: "Pots", value: `${pollData.pots || 0} votes`, inline: true },
      { name: "Pans", value: `${pollData.pans || 0} votes`, inline: true }
    );
}

function buildPollButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pan_poll_pots")
      .setLabel("Pots")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("pan_poll_pans")
      .setLabel("Pans")
      .setStyle(ButtonStyle.Success)
  );
}

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



    let pollData = await PanVSPot.findOne();
    if (!pollData) {
      pollData = await PanVSPot.create({});
    }

    const pollEmbed = buildPollEmbed(pollData);
    const pollButtons = buildPollButtons();

    await interaction.reply({
      embeds: [embed, pollEmbed],
      components: [pollButtons],
    });
    await commandLogging(client, interaction);
  },
};
