const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
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
    const name = interaction.options.getString("name");
    const public = interaction.options.getBoolean("public");
    const username = interaction.user.username;
    const scoreupdate = await scanText(name);

    if (name) {
      const result = await containsDisallowedContent(name, username);
      if (result) {
        await sendFlagNotification(interaction, name, "Name");
        return interaction.reply({
          content: "The preferred name contains disallowed content.",
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
          content:
            "One of your test have been flagged for high toxicity or insult.",
          ephemeral: true,
        });
      }
    } else {
      return interaction.reply({
        content: "There was an error analyzing your message. Please try again.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("Name Tester")
      .setDescription(`Explore new names!`)
      .setFields(
        {
          name: "Subject of the sentence",
          value: `**${name}** is walking down the street on a nice sunny day.`,
        },
        {
          name: "Object of the sentence",
          value: `The dog is chasing **${name}** down the street.`,
        },
        {
          name: "Possessive Determiner",
          value: `The ball belongs to **${name}**.`,
        },
        {
          name: "Possessive Pronoun",
          value: `The ball is **${name}'s**.`,
        },
        {
          name: "Being talked too",
          value: `Hey **${name}**, how are you doing today?`,
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
