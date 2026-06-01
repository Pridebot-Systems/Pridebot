const ProfileFeedback = require("../../../../mongo/models/profileFeedbackSchema.js");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

async function checkAndShowProfileFeedbackSurvey(interaction, userId) {
  try {
    const existingFeedback = await ProfileFeedback.findOne({ userId });

    if (existingFeedback && existingFeedback.surveyShown) {
      return;
    }

    if (!existingFeedback) {
      await ProfileFeedback.create({
        userId,
        surveyShown: true,
        surveyShownAt: new Date(),
      });
    } else {
      existingFeedback.surveyShown = true;
      existingFeedback.surveyShownAt = new Date();
      await existingFeedback.save();
    }

    const surveyEmbed = new EmbedBuilder()
      .setTitle("Help Us Improve PrideBot Profiles!")
      .setDescription(
        "Thank you for using PrideBot profiles! We'd love to hear your thoughts.\n\n" +
          "This quick 3-question survey helps us understand what you want from our profile system. " +
          "Would you like to take a moment to share your feedback?"
      )
      .setColor(0xff00ae)
      .setFooter({
        text: "Your feedback helps us make PrideBot better for everyone!",
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_survey_yes_${userId}`)
        .setLabel("Yes, I'll help!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`profile_survey_no_${userId}`)
        .setLabel("No thanks")
        .setStyle(ButtonStyle.Secondary)
    );

    setTimeout(async () => {
      try {
        if (!interaction.replied && !interaction.deferred) return;
        await interaction.followUp({
          embeds: [surveyEmbed],
          components: [row],
          ephemeral: true,
        });
      } catch (error) {
        if (error.code !== 10062) {
          console.error("[PROFILE SURVEY] Failed to send survey prompt:", error);
        }
      }
    }, 2000);
  } catch (error) {
    console.error("[PROFILE SURVEY] Failed to check survey status:", error);
  }
}

async function handleProfileSurveyResponse(interaction) {
  const userId = interaction.user.id;
  const customId = interaction.customId;

  try {
    const response = customId.includes("_yes_");

    await ProfileFeedback.findOneAndUpdate(
      { userId },
      {
        acceptedSurvey: response,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    if (!response) {
      return;
    }

    await showQuestion1Modal(interaction);
  } catch (error) {
    console.error("[PROFILE SURVEY] Failed to handle survey response:", error);
    await interaction.reply({
      content: "An error occurred. Please try again later.",
      ephemeral: true,
    });
  }
}

async function showQuestion1Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`profile_survey_q1_${interaction.user.id}`)
    .setTitle("Profile Survey - Question 1 of 3");

  const question1Input = new TextInputBuilder()
    .setCustomId("q1_response")
    .setLabel("What do you think of PrideBot profiles?")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Share your thoughts here...")
    .setRequired(true)
    .setMaxLength(1000);

  const row = new ActionRowBuilder().addComponents(question1Input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleQuestion1Submission(interaction) {
  const userId = interaction.user.id;
  const answer = interaction.fields.getTextInputValue("q1_response");

  try {
    await ProfileFeedback.findOneAndUpdate(
      { userId },
      {
        "answers.question1": answer,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    const q2Embed = new EmbedBuilder()
      .setTitle("Profile Survey - Question 2 of 3")
      .setDescription(
        "**Would you use our web version of profiles like pronoun.page or pronoun.cc?**\n\n" +
          "Click the button below to see an example of a web profile, then let us know if you'd use it!"
      )
      .setColor(0xff00ae);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("View Web Profile Example")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://profile.pridebot.xyz/${userId}`),
      new ButtonBuilder()
        .setCustomId(`profile_survey_q2_yes_${userId}`)
        .setLabel("Yes, I'd use it!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`profile_survey_q2_no_${userId}`)
        .setLabel("No, not for me")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [q2Embed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error("[PROFILE SURVEY] Failed to handle Q1 submission:", error);
    await interaction.reply({
      content: "An error occurred. Please try again later.",
      ephemeral: true,
    });
  }
}

async function handleQuestion2Response(interaction) {
  const userId = interaction.user.id;
  const customId = interaction.customId;

  try {
    const response = customId.includes("_yes_") ? "yes" : "no";

    await ProfileFeedback.findOneAndUpdate(
      { userId },
      {
        "answers.question2": response,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    await showQuestion3Modal(interaction);
  } catch (error) {
    console.error("[PROFILE SURVEY] Failed to handle Q2 response:", error);
    await interaction.reply({
      content: "An error occurred. Please try again later.",
      ephemeral: true,
    });
  }
}

async function showQuestion3Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`profile_survey_q3_${interaction.user.id}`)
    .setTitle("Profile Survey - Question 3 of 3");

  const question3Input = new TextInputBuilder()
    .setCustomId("q3_response")
    .setLabel("What would make profiles more personal?")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "Share your ideas here... including any paid features you'd want!"
    )
    .setRequired(true)
    .setMaxLength(1000);

  const row = new ActionRowBuilder().addComponents(question3Input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleQuestion3Submission(interaction) {
  const userId = interaction.user.id;
  const answer = interaction.fields.getTextInputValue("q3_response");

  try {
    const updatedFeedback = await ProfileFeedback.findOneAndUpdate(
      { userId },
      {
        "answers.question3": answer,
        surveyCompleted: true,
        surveyCompletedAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const thankYouEmbed = new EmbedBuilder()
      .setTitle("Thank You for Your Feedback!")
      .setDescription(
        "Your responses have been recorded and will help us improve PrideBot profiles!\n\n" +
          "We truly appreciate you taking the time to share your thoughts with us. 💜"
      )
      .setColor(0xff00ae)
      .setFooter({
        text: "Your feedback makes PrideBot better for everyone!",
      });

    await interaction.reply({
      embeds: [thankYouEmbed],
      ephemeral: true,
    });

    await sendSurveyNotification(
      interaction.client,
      updatedFeedback,
      interaction.user
    );
  } catch (error) {
    console.error("[PROFILE SURVEY] Failed to handle Q3 submission:", error);
    await interaction.reply({
      content:
        "An error occurred while saving your response. Please try again later.",
      ephemeral: true,
    });
  }
}

async function sendSurveyNotification(client, feedback, user) {
  try {
    const { sendLog } = require("../../../config/logging/sendlogs.js");

    const notificationEmbed = new EmbedBuilder()
      .setTitle("📋 Profile Survey Completed")
      .setDescription(
        `**User:** ${user.username} (${user.id})\n**Survey ID:** ${feedback._id}`
      )
      .addFields([
        {
          name: "Q1: What do you think of PrideBot profiles?",
          value:
            feedback.answers.question1?.substring(0, 1024) ||
            "No response provided",
          inline: false,
        },
        {
          name: "Q2: Would you use web profiles?",
          value: feedback.answers.question2 === "yes" ? "✅ Yes" : "❌ No",
          inline: false,
        },
        {
          name: "Q3: What would make profiles more personal?",
          value:
            feedback.answers.question3?.substring(0, 1024) ||
            "No response provided",
          inline: false,
        },
        {
          name: "Completed At",
          value: `<t:${Math.floor(
            new Date(feedback.surveyCompletedAt).getTime() / 1000
          )}:F>`,
          inline: true,
        },
      ])
      .setColor(0xff00ae)
      .setFooter({
        text: `Survey ID: ${feedback._id}`,
      });

    await sendLog(client, notificationEmbed, "1426639419083063376");
  } catch (error) {
    console.error("[PROFILE SURVEY] Error sending survey notification:", error);
  }
}

module.exports = {
  checkAndShowProfileFeedbackSurvey,
  handleProfileSurveyResponse,
  handleQuestion1Submission,
  handleQuestion2Response,
  handleQuestion3Submission,
};
