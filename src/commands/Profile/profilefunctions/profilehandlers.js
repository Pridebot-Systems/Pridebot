const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const profileLogging = require("../../../config/logging/profilelogging");
const chalk = require("chalk");

const Profile = require("../../../../mongo/models/profileSchema");
const IDLists = require("../../../../mongo/models/idSchema");

const { badgeMap } = require("./profilehelper");
const {
  containsDisallowedContent,
} = require("../../../config/detection/containDisallow");
const { scanText } = require("../../../config/detection/perspective");

async function handleEdit(interaction, client) {
  const userId = interaction.user.id;
  const colorInput = interaction.options.getString("color");
  const badgeToggle = interaction.options.getBoolean("badgetoggle");
  const premiumToggle = interaction.options.getBoolean("premiumtoggle");

  const originalProfile = await Profile.findOne({ userId });
  const updates = {};

  if (colorInput) {
    const color = colorInput.startsWith("#") ? colorInput : `#${colorInput}`;
    if (!/^#([0-9A-F]{3,6})$/i.test(color)) {
      return interaction.reply({
        content: "Please enter a valid hex code for the color.",
        ephemeral: true,
      });
    }
    updates.color = color;
  }
  if (badgeToggle !== null) {
    updates.badgesVisible = badgeToggle;
  }

  if (originalProfile.premiumMember == true) {
    if (premiumToggle !== null) {
      updates.premiumVisible = premiumToggle;
    }
  } else {
    return interaction.reply({
      content:
        "You need to be a premium user to use this command. \nYou can get premium by donating to the bot at https://pridebot.xyz/premium",
      ephemeral: true,
    });
  }

  const updatedProfile = await Profile.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true }
  );

  await commandLogging(client, interaction);
  await profileLogging(
    client,
    interaction,
    "edited",
    originalProfile,
    updatedProfile
  );

  let responseMessage = "Your profile has been updated successfully!";
  if (colorInput && badgeToggle !== null) {
    responseMessage += " Color and badge visibility have been updated.";
  } else if (colorInput) {
    responseMessage += " Color has been updated.";
  } else if (badgeToggle !== null) {
    responseMessage = badgeToggle
      ? "Badges are now visible on your profile."
      : "Badges are now hidden from your profile.";
  }

  return interaction.reply({ content: responseMessage, ephemeral: true });
}

async function handleView(interaction, client) {
  const targetUser = interaction.options.getUser("user") || interaction.user;
  const userId = targetUser.id;

  const profile = await Profile.findOne({ userId });
  if (!profile) {
    const msg =
      userId === interaction.user.id
        ? "You have not set up a profile yet. Use `/profile setup` to create one."
        : "This user doesn't have a profile set up yet.";
    return interaction.reply({ content: msg, ephemeral: true });
  }

  const embedColor = profile.color || "#FF00EA";
  const idLists = await IDLists.findOne();

  let badgeStr = "";
  if (profile.badgesVisible && idLists) {
    for (const [key, emoji] of Object.entries(badgeMap)) {
      if (Array.isArray(idLists[key]) && idLists[key].includes(userId)) {
        badgeStr += emoji;
      }
    }
  }

  const fields = [];
  fields.push({
    name: "Preferred Name",
    value: profile.preferredName || "Not set",
    inline: true,
  });
  fields.push({
    name: "Age",
    value: profile.age === 0 ? "N/A" : String(profile.age || "Not set"),
    inline: true,
  });
  if (profile.premiumMember && profile.premiumVisible) {
    const since = profile.premiumSince ? new Date(profile.premiumSince) : null;
    const days = since ? Math.floor((Date.now() - since) / 86400000) : 0;
    fields.push({ name: "Premium", value: `${days} days`, inline: true });
  }
  if (profile.bio)
    fields.push({
      name: "Bio",
      value: profile.bio.replace(/\\n/g, "\n"),
      inline: false,
    });

  fields.push(
    {
      name: "Sexual Orientation",
      value: profile.sexuality || "Not set",
      inline: true,
    },
    {
      name: "Romantic Orientation",
      value: profile.romanticOrientation || "Not set",
      inline: true,
    },
    { name: "Gender", value: profile.gender || "Not set", inline: true },
    { name: "Pronouns", value: profile.pronouns || "Not set", inline: true }
  );

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${targetUser.username}'s Profile ${badgeStr}`)
    .addFields(fields)
    .setThumbnail(profile.pfp || targetUser.displayAvatarURL())
    .setFooter({ text: "Profile Information" })
    .setTimestamp();

  const row = new ActionRowBuilder();
  if (profile.pronounpage) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("Pronoun Page")
        .setStyle(ButtonStyle.Link)
        .setURL(profile.pronounpage)
    );
  }

  for (const site of profile.customWebsites || []) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(site.label)
        .setStyle(ButtonStyle.Link)
        .setURL(site.url)
    );
  }

  await commandLogging(client, interaction);
  return interaction.reply({ embeds: [embed], components: [row] });
}

async function handlePremium(interaction) {
  let profile = await Profile.findOne({ userId: interaction.user.id });
  if (!profile.premiumMember) {
    profile.premiumMember = true;
    profile.premiumSince = new Date();
  }
  await profile.save();

  const lastSite = (profile.customWebsites || []).slice(-1)[0];
  const labelPlaceholder = lastSite?.label || "e.g. My Blog";
  const urlPlaceholder = lastSite?.url || "https://example.com";

  const modal = new ModalBuilder()
    .setCustomId("customWebsiteModal")
    .setTitle("Premium Settings");

  const labelInput = new TextInputBuilder()
    .setCustomId("websiteLabel")
    .setLabel("Button Label")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(labelPlaceholder)
    .setRequired(true);

  const urlInput = new TextInputBuilder()
    .setCustomId("websiteUrl")
    .setLabel("Website URL")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(urlPlaceholder)
    .setRequired(true);

  const avatarInput = new TextInputBuilder()
    .setCustomId("avatarUrl")
    .setLabel("New Avatar URL")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://...png/jpg")
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(labelInput),
    new ActionRowBuilder().addComponents(urlInput),
    new ActionRowBuilder().addComponents(avatarInput)
  );

  await interaction.showModal(modal);
}

async function handleUpdate(interaction, client) {
  const subcommand = interaction.options.getSubcommand();
  const username = interaction.user.username;
  const age = interaction.options.getInteger("age");

  if (!(await ageCheck(interaction, age, subcommand))) return;

  const preferredName = interaction.options.getString("preferredname");
  const bio = interaction.options.getString("bio");

  // Content safety
  if (
    preferredName &&
    (await containsDisallowedContent(preferredName, username))
  ) {
    await sendFlagNotification(
      interaction,
      preferredName,
      subcommand,
      "Preferred Name"
    );
    return interaction.reply({
      content: "Disallowed content in preferred name.",
      ephemeral: true,
    });
  }
  if (bio && (await containsDisallowedContent(bio, username))) {
    await sendFlagNotification(interaction, bio, subcommand, "Bio");
    return interaction.reply({
      content: "Disallowed content in bio.",
      ephemeral: true,
    });
  }

  // Toxicity check
  const scan = await scanText(preferredName || bio);
  if (!scan) {
    return interaction.reply({
      content: "Error analyzing content.",
      ephemeral: true,
    });
  }
  if (scan.toxicity > 0.65 || scan.insult > 0.65) {
    await sendToxicNotification(
      interaction,
      scan.toxicity,
      scan.insult,
      preferredName,
      bio,
      subcommand
    );
    return interaction.reply({
      content: "High toxicity or insult detected.",
      ephemeral: true,
    });
  }

  const updates = collectUpdateFields(interaction);
  const originalProfile = await Profile.findOne({
    userId: interaction.user.id,
  });
  const updatedProfile = await Profile.findOneAndUpdate(
    { userId: interaction.user.id },
    { $set: updates },
    { new: true }
  );

  if (!updatedProfile) {
    return interaction.reply({
      content: "No profile found. Run `/profile setup`.",
      ephemeral: true,
    });
  }

  await commandLogging(client, interaction);
  await profileLogging(
    client,
    interaction,
    "edited",
    originalProfile,
    updatedProfile
  );
  return interaction.reply({
    content: "Profile updated successfully!",
    ephemeral: true,
  });
}

async function handleSetup(interaction, client) {
  const subcommand = interaction.options.getSubcommand();
  const username = interaction.user.username;
  const age = interaction.options.getInteger("age");

  if (!(await ageCheck(interaction, age, subcommand))) return;

  if (await Profile.exists({ userId: interaction.user.id })) {
    return interaction.reply({
      content: "Profile exists. Use `/profile view`.",
      ephemeral: true,
    });
  }

  const preferredName = interaction.options.getString("preferredname");
  const bio = interaction.options.getString("bio");

  // Content safety
  if (
    preferredName &&
    (await containsDisallowedContent(preferredName, username))
  ) {
    await sendFlagNotification(
      interaction,
      preferredName,
      subcommand,
      "Preferred Name"
    );
    return interaction.reply({
      content: "Disallowed content in preferred name.",
      ephemeral: true,
    });
  }
  if (bio && (await containsDisallowedContent(bio, username))) {
    await sendFlagNotification(interaction, bio, subcommand, "Bio");
    return interaction.reply({
      content: "Disallowed content in bio.",
      ephemeral: true,
    });
  }
  const scan = await scanText(preferredName || bio);
  if (!scan) {
    return interaction.reply({
      content: "Error analyzing content.",
      ephemeral: true,
    });
  }
  if (scan.toxicity > 0.65 || scan.insult > 0.65) {
    await sendToxicNotification(
      interaction,
      scan.toxicity,
      scan.insult,
      preferredName,
      bio,
      subcommand
    );
    return interaction.reply({
      content: "High toxicity or insult detected.",
      ephemeral: true,
    });
  }

  const pronounpage = interaction.options.getString("pronounpage");
  if (pronounpage && !isValidPronounPageLink(pronounpage)) {
    return interaction.reply({
      content: "Invalid pronoun page link.",
      ephemeral: true,
    });
  }

  const profileData = collectSetupFields(interaction);
  const newProfile = await Profile.create(profileData);

  const fields = [];
  fields.push({
    name: "Preferred Name",
    value: newProfile.preferredName || "Not set",
    inline: true,
  });
  fields.push({
    name: "Age",
    value: newProfile.age === 0 ? "N/A" : String(newProfile.age),
    inline: true,
  });
  if (newProfile.bio)
    fields.push({
      name: "Bio",
      value: newProfile.bio.replace(/\\n/g, "\n"),
      inline: false,
    });
  fields.push(
    {
      name: "Sexual Orientation",
      value: newProfile.sexuality || "Not set",
      inline: true,
    },
    {
      name: "Romantic Orientation",
      value: newProfile.romanticOrientation || "Not set",
      inline: true,
    },
    { name: "Gender", value: newProfile.gender || "Not set", inline: true },
    { name: "Pronouns", value: newProfile.pronouns || "Not set", inline: true }
  );

  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle(`${interaction.user.username} Profile Setup`)
    .addFields(fields)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: "Profile Setup Complete" })
    .setTimestamp();

  await commandLogging(client, interaction);
  await profileLogging(client, interaction, "created", null, newProfile);
  return interaction.reply({
    content: "Profile created successfully!",
    embeds: [embed],
    ephemeral: true,
  });
}

// -- Utilities --
function isValidPronounPageLink(link) {
  return /^https:\/\/(en\.)?pronouns\.page\/@[\w-]+$/.test(link);
}

async function ageCheck(interaction, age, cmd) {
  if (age === 0) return true;
  if (age !== null && (age < 13 || age > 99)) {
    const embed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("🚨 Illegal Age")
      .addFields(
        { name: "User", value: interaction.user.tag, inline: true },
        { name: "Provided", value: String(age), inline: true },
        { name: "Command", value: cmd, inline: true }
      )
      .setTimestamp();
    const ch = await interaction.client.channels.fetch("1231591223337160715");
    if (ch) ch.send({ embeds: [embed] });
    await interaction.reply({ content: "Invalid age.", ephemeral: true });
    return false;
  }
  return true;
}

async function sendFlagNotification(interaction, content, cmd, type) {
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle("Flagged Content Detected")
    .addFields(
      { name: "User", value: interaction.user.tag, inline: true },
      { name: "Command", value: cmd, inline: true },
      { name: "Type", value: type, inline: true },
      { name: "Content", value: `||${content}||`, inline: true }
    )
    .setTimestamp();
  const ch = await interaction.client.channels.fetch("1231591223337160715");
  if (ch) ch.send({ embeds: [embed] });
}

async function sendToxicNotification(
  interaction,
  toxicity,
  insult,
  pref,
  bio,
  cmd
) {
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle("Toxic/Insult Detected")
    .addFields(
      { name: "User", value: interaction.user.tag, inline: true },
      { name: "Command", value: cmd, inline: true },
      { name: "Content", value: `||${pref || bio}||`, inline: true },
      {
        name: "Toxicity",
        value: `${(toxicity * 100).toFixed(2)}%`,
        inline: true,
      },
      { name: "Insult", value: `${(insult * 100).toFixed(2)}%`, inline: true }
    )
    .setTimestamp();
  const ch = await interaction.client.channels.fetch("1231591223337160715");
  if (ch) ch.send({ embeds: [embed] });
}

function collectUpdateFields(interaction) {
  const data = {};
  if (interaction.options.getString("preferredname"))
    data.preferredName = interaction.options.getString("preferredname");
  if (interaction.options.getInteger("age") !== null)
    data.age = interaction.options.getInteger("age");
  if (interaction.options.getString("bio"))
    data.bio = interaction.options.getString("bio");
  if (interaction.options.getString("sexuality"))
    data.sexuality = interaction.options.getString("sexuality");
  if (interaction.options.getString("romantic"))
    data.romanticOrientation = interaction.options.getString("romantic");
  if (interaction.options.getString("gender"))
    data.gender = interaction.options.getString("gender");
  if (interaction.options.getString("pronouns"))
    data.pronouns = interaction.options.getString("pronouns");
  if (interaction.options.getString("other_sexuality") !== null) {
    const val = interaction.options.getString("other_sexuality");
    data.otherSexuality = val === "clear" ? "" : val;
  }
  if (interaction.options.getString("other_gender") !== null) {
    const val = interaction.options.getString("other_gender");
    data.otherGender = val === "clear" ? "" : val;
  }
  if (interaction.options.getString("other_pronouns") !== null) {
    const val = interaction.options.getString("other_pronouns");
    data.otherPronouns = val === "clear" ? "" : val;
  }
  return data;
}

function collectSetupFields(interaction) {
  return {
    userId: interaction.user.id,
    preferredName: interaction.options.getString("preferredname") || "",
    age: interaction.options.getInteger("age"),
    bio: interaction.options.getString("bio") || "",
    sexuality: interaction.options.getString("sexuality") || "",
    romanticOrientation: interaction.options.getString("romantic") || "",
    gender: interaction.options.getString("gender") || "",
    pronouns: interaction.options.getString("pronouns") || "",
    otherSexuality:
      interaction.options.getString("other_sexuality") === "clear"
        ? ""
        : interaction.options.getString("other_sexuality") || "",
    otherGender:
      interaction.options.getString("other_gender") === "clear"
        ? ""
        : interaction.options.getString("other_gender") || "",
    otherPronouns:
      interaction.options.getString("other_pronouns") === "clear"
        ? ""
        : interaction.options.getString("other_pronouns") || "",
    pronounpage: interaction.options.getString("pronounpage") || "",
  };
}

async function handleModalSubmit(interaction) {
  if (interaction.customId !== "customWebsiteModal") return;
  await interaction.deferReply({ ephemeral: true });
  try {
    const userId = interaction.user.id;
    const label = interaction.fields.getTextInputValue("websiteLabel");
    const url = interaction.fields.getTextInputValue("websiteUrl");
    const avatar = interaction.fields.getTextInputValue("avatarUrl");

    let profile = await Profile.findOne({ userId });

    profile.customWebsites = profile.customWebsites || [];
    profile.customWebsites.push({ label, url });

    if (avatar) {
      profile.customAvatars = profile.customAvatars || [];
      profile.customAvatars.push({ label: "Custom Avatar", url: avatar });
    }

    await profile.save();
    await commandLogging(interaction.client, interaction);
    await profileLogging(
      interaction.client,
      interaction,
      "premium_updated",
      null,
      profile
    );

    return interaction.editReply({ content: "Premium settings updated!" });
  } catch (error) {
    console.error("Modal submit error:", error);
    return interaction.editReply({
      content: "Failed to update premium settings.",
      ephemeral: true,
    });
  }
}

module.exports = {
  handleEdit,
  handleView,
  handleUpdate,
  handleSetup,
  handlePremium,
  handleModalSubmit,
};
