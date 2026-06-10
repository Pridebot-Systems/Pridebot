const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");
const loadTranslations = require("../../config/commandfunctions/translation");
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
    const t = loadTranslations(interaction.locale, "Fun", "pronountester");
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
        return interaction.reply({ content: t.error_disallowed, ephemeral: true });
      }
    }
    if (object) {
      const result = await containsDisallowedContent(object, username);
      if (result) {
        await sendFlagNotification(interaction, object, "Object Pronoun");
        return interaction.reply({ content: t.error_disallowed, ephemeral: true });
      }
    }
    if (possessiveDeterminer) {
      const result = await containsDisallowedContent(possessiveDeterminer, username);
      if (result) {
        await sendFlagNotification(interaction, possessiveDeterminer, "Possessive Determiner");
        return interaction.reply({ content: t.error_disallowed, ephemeral: true });
      }
    }
    if (possessivePronoun) {
      const result = await containsDisallowedContent(possessivePronoun, username);
      if (result) {
        await sendFlagNotification(interaction, possessivePronoun, "Possessive Pronoun");
        return interaction.reply({ content: t.error_disallowed, ephemeral: true });
      }
    }
    if (reflexive) {
      const result = await containsDisallowedContent(reflexive, username);
      if (result) {
        await sendFlagNotification(interaction, reflexive, "Reflexive Pronoun");
        return interaction.reply({ content: t.error_disallowed, ephemeral: true });
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
              subject || object || possessiveDeterminer || possessivePronoun || reflexive
            }"`
          )
        );
        await sendToxicNotification(
          interaction, toxicity, insult,
          subject, object, possessiveDeterminer, possessivePronoun, reflexive
        );
        return interaction.reply({ content: t.error_toxic, ephemeral: true });
      }
    } else {
      return interaction.reply({ content: t.error_analyzing, ephemeral: true });
    }

    const subjectCap = subject.charAt(0).toUpperCase() + subject.slice(1);
    const possessiveDetCap = possessiveDeterminer.charAt(0).toUpperCase() + possessiveDeterminer.slice(1);

    const embed = new EmbedBuilder()
      .setColor(0xff00ae)
      .setTitle(
        t.title
          .replace("{{subject}}", subjectCap)
          .replace("{{object}}", object.charAt(0).toUpperCase() + object.slice(1))
          .replace("{{possessive}}", possessiveDetCap)
      )
      .setDescription(t.description)
      .addFields(
        {
          name: t.field_examples_name,
          value: t.field_examples_value
            .replace("{{subject_cap}}", subjectCap)
            .replace("{{object}}", object)
            .replace("{{possessive_det_cap}}", possessiveDetCap)
            .replace("{{possessive_pro}}", possessivePronoun)
            .replace("{{subject_cap}}", subjectCap)
            .replace("{{reflexive}}", reflexive),
          inline: true,
        },
        {
          name: t.field_full_set_name,
          value: t.field_full_set_value
            .replace("{{subject}}", subject)
            .replace("{{object}}", object)
            .replace("{{possessive_det}}", possessiveDeterminer)
            .replace("{{possessive_pro}}", possessivePronoun)
            .replace("{{reflexive}}", reflexive),
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
