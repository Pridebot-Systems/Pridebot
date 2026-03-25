const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const chalk = require("chalk");

const {
  containsDisallowedContent,
} = require("../../config/detection/containDisallow");
const { scanText } = require("../../config/detection/perspective");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pronountester")
    .setDescription("Tests out pronouns in a sentence.")
    .addStringOption((option) =>
      option
        .setName("subject")
        .setDescription("Subject pronoun (e.g., he, she, they)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("object")
        .setDescription("Object pronoun (e.g., him, her, them)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("possessive")
        .setDescription("Possessive pronoun (e.g., his, her, their)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("possessive_adjective")
        .setDescription("Possessive adjective (e.g., his, hers, theirs)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reflexive")
        .setDescription(
          "Reflexive pronoun (e.g., himself, herself, themselves)"
        )
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const subject = interaction.options.getString("subject");
    const object = interaction.options.getString("object");
    const possessiveDeterminer = interaction.options.getString("possessive");
    const possessivePronoun = interaction.options.getString(
      "possessive_adjective"
    );
    const reflexive = interaction.options.getString("reflexive");

    const username = interaction.user.username;
    const scoreupdate = await scanText(
      subject ||
        object ||
        possessiveDeterminer ||
        possessivePronoun ||
        reflexive
    );

    if (subject) {
      const result = await containsDisallowedContent(subject, username);
      if (result) {
        await sendFlagNotification(interaction, subject, "Subject Pronoun");
        return interaction.reply({
          content: "The preferred name contains disallowed content.",
          ephemeral: true,
        });
      }
    }
    if (object) {
      const result = await containsDisallowedContent(object, username);
      if (result) {
        await sendFlagNotification(interaction, object, "Object Pronoun");
        return interaction.reply({
          content: "The preferred name contains disallowed content.",
          ephemeral: true,
        });
      }
    }
    if (possessiveDeterminer) {
      const result = await containsDisallowedContent(
        possessiveDeterminer,
        username
      );
      if (result) {
        await sendFlagNotification(
          interaction,
          possessiveDeterminer,
          "Possessive Determiner"
        );
        return interaction.reply({
          content: "The preferred name contains disallowed content.",
          ephemeral: true,
        });
      }
    }
    if (possessivePronoun) {
      const result = await containsDisallowedContent(
        possessivePronoun,
        username
      );
      if (result) {
        await sendFlagNotification(
          interaction,
          possessivePronoun,
          "Possessive Pronoun"
        );
        return interaction.reply({
          content: "The preferred name contains disallowed content.",
          ephemeral: true,
        });
      }
    }
    if (reflexive) {
      const result = await containsDisallowedContent(reflexive, username);
      if (result) {
        await sendFlagNotification(interaction, reflexive, "Reflexive Pronoun");
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
            )}% \nContent: "${
              subject ||
              object ||
              possessiveDeterminer ||
              possessivePronoun ||
              reflexive
            }"`
          )
        );
        await sendToxicNotification(
          interaction,
          toxicity,
          insult,
          subject,
          object,
          possessiveDeterminer,
          possessivePronoun,
          reflexive
        );
        return interaction.reply({
          content:
            "One or more of your test have been flagged for high toxicity or insult.",
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
      .setColor(0xff00ae)
      .setTitle(
        `Testing Pronouns: ${
          subject.charAt(0).toUpperCase() + subject.slice(1)
        }/${object.charAt(0).toUpperCase() + object.slice(1)}/${
          possessiveDeterminer.charAt(0).toUpperCase() +
          possessiveDeterminer.slice(1)
        }`
      )
      .setDescription(
        "Explore new pronouns! If you want to learn more about specific pronouns, use </pronouns:1273988656956309648>."
      )
      .addFields(
        {
          name: "__Examples__:",
          value: `**${
            subject.charAt(0).toUpperCase() + subject.slice(1)
          }** is going to the store.\nI saw **${object}** at the party.\n**${
            possessiveDeterminer.charAt(0).toUpperCase() +
            possessiveDeterminer.slice(1)
          }** car is parked outside.\nThe book is **${possessivePronoun}**.\n${
            subject.charAt(0).toUpperCase() + subject.slice(1)
          } prepared the meal **${reflexive}**.`,
          inline: true,
        },
        {
          name: "__Full Pronoun Set__:",
          value: `**Subject Pronoun** - ${subject}\n**Object Pronoun** - ${object}\n**Possessive Determiner** - ${possessiveDeterminer}\n**Possessive Pronoun** - ${possessivePronoun}\n**Reflexive Pronoun** - ${reflexive}`,
          inline: true,
        }
      )
      .setTimestamp();

    const isPublic = interaction.options.getBoolean("public", false);

    await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
    await commandLogging(client, interaction);
  },
};

async function sendFlagNotification(interaction, flaggedContent, contentType) {
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle("<:Ic_Pridebot_trigger:1486223209559883786> Flagged Content Detected")
    .addFields(
      { name: "Username", value: interaction.user.tag, inline: true },
      { name: "User ID", value: interaction.user.id, inline: true },
      { name: "Command", value: "Pronoun Tester", inline: true },
      { name: "Content Type", value: contentType, inline: true },
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

async function sendToxicNotification(
  interaction,
  toxicity,
  insult,
  subject,
  object,
  possessiveDeterminer,
  possessivePronoun,
  reflexive
) {
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle("<:Ic_Pridebot_trigger:1486223209559883786> Toxic/Insult Content Detected")
    .addFields(
      { name: "Username", value: interaction.user.tag, inline: true },
      { name: "User ID", value: interaction.user.id, inline: true },
      { name: "_ _", value: `_ _`, inline: true },
      { name: "Command", value: "NameTester", inline: true },
      {
        name: "Flagged Content",
        value: `||${
          subject ||
          object ||
          possessiveDeterminer ||
          possessivePronoun ||
          reflexive
        }||`,
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
