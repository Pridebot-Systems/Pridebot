const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const loadTranslations = require("../../config/commandfunctions/translation");
const {
  containsDisallowedContent,
} = require("../../config/detection/containDisallow");
const { scanText } = require("../../config/detection/perspective");
const chalk = require("chalk");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nametester")
    .setDescription("Tests out names in a sentence.")
    .addStringOption((option) =>
      option.setName("name").setDescription("Name to test").setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const t = loadTranslations(interaction.locale, "Fun", "nametester");
    const name = interaction.options.getString("name");
    const public = interaction.options.getBoolean("public");
    const username = interaction.user.username;
    const scoreupdate = await scanText(name);

    if (name) {
      const result = await containsDisallowedContent(name, username);
      if (result) {
        await sendFlagNotification(interaction, name, "Name");
        return interaction.reply({
          content: t.error_disallowed,
          ephemeral: true,
        });
      }
    }

    if (scoreupdate !== null) {
      const { toxicity, insult } = scoreupdate;
      if (toxicity > 0.65 || insult > 0.65) {
        console.log(
          chalk.yellowBright.bold(
            `⚠️  ${username} has been flagged for toxic or insulting content \nToxicity: ${(
              toxicity * 100
            ).toFixed(2)}% \nInsult: ${(insult * 100).toFixed(
              2
            )}% \nContent: "${name}"`
          )
        );
        await sendToxicNotification(interaction, toxicity, insult, name);
        return interaction.reply({
          content: t.error_toxic,
          ephemeral: true,
        });
      }
    } else {
      return interaction.reply({
        content: t.error_analyzing,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(t.title)
      .setDescription(t.description)
      .setFields(
        {
          name: t.field_subject_name,
          value: t.field_subject_value.replace("{{name}}", name),
        },
        {
          name: t.field_object_name,
          value: t.field_object_value.replace("{{name}}", name),
        },
        {
          name: t.field_possessive_det_name,
          value: t.field_possessive_det_value.replace("{{name}}", name),
        },
        {
          name: t.field_possessive_pro_name,
          value: t.field_possessive_pro_value.replace("{{name}}", name),
        },
        {
          name: t.field_talking_name,
          value: t.field_talking_value.replace("{{name}}", name),
        }
      )
      .setColor(0xff00ae)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: !public });
    await commandLogging(client, interaction);
  },
};

async function sendFlagNotification(interaction, flaggedContent) {
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle("<:Ic_Pridebot_trigger:1486223209559883786> Flagged Content Detected")
    .addFields(
      { name: "Username", value: interaction.user.tag, inline: true },
      { name: "User ID", value: interaction.user.id, inline: true },
      { name: "Command", value: "Name Tester", inline: true },
      { name: "Flagged Content", value: `||${flaggedContent}||`, inline: true }
    )
    .setTimestamp();

  const alertChannel = await interaction.client.channels.fetch(
    "1231591223337160715"
  );
  if (alertChannel) {
    alertChannel.send({ embeds: [embed] });
  }
}

async function sendToxicNotification(interaction, toxicity, insult, name) {
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle("<:Ic_Pridebot_toxic:1486223002658930798> Toxic/Insult Content Detected")
    .addFields(
      { name: "Username", value: interaction.user.tag, inline: true },
      { name: "User ID", value: interaction.user.id, inline: true },
      { name: "_ _", value: `_ _`, inline: true },
      { name: "Command", value: "NameTester", inline: true },
      {
        name: "Flagged Content",
        value: `||${name}||`,
        inline: true,
      },
      { name: "_ _", value: `_ _`, inline: true },
      {
        name: "Toxicity Score",
        value: `Toxicity: ${(toxicity * 100).toFixed(2)}%`,
        inline: true,
      },
      {
        name: "Insult Score",
        value: `Insult: ${(insult * 100).toFixed(2)}%`,
        inline: true,
      }
    )
    .setTimestamp();

  const alertChannel = await interaction.client.channels.fetch(
    "1231591223337160715"
  );
  if (alertChannel) {
    alertChannel.send({ embeds: [embed] });
  }
}
