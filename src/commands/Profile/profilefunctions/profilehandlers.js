const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const commandLogging = require("../../../config/logging/commandlog");
const profileLogging = require("../../../config/logging/profilelogging");
const path = require("path");
const fs = require("fs");
const config = require("../../../environment");

const Profile = require("../../../../mongo/models/profileSchema");
const IDLists = require("../../../../mongo/models/idSchema");
const UserCommandUsage = require("../../../../mongo/models/userCommandUsageSchema");

const { badgeMap } = require("./profilehelper");
const { checkAndShowProfileFeedbackSurvey } = require("./profileSurveyHandler");
const {
  containsDisallowedContent,
} = require("../../../config/detection/containDisallow");
const { scanText } = require("../../../config/detection/perspective");

async function handleDisplay(interaction, client) {
  const userId = interaction.user.id;
  const colorInput = interaction.options.getString("color");
  const badgeToggle = interaction.options.getBoolean("badgetoggle");
  const ageToggle = interaction.options.getBoolean("agetoggle");

  const originalProfile = await Profile.findOne({ userId });
  if (!originalProfile) {
    return interaction.reply({
      content: "You don’t have a profile yet. Use `/profile setup` to create one.",
      ephemeral: true,
    });
  }

  const updates = {};

  if (colorInput) {
    const color = colorInput.startsWith("#") ? colorInput : `#${colorInput}`;
    if (!/^#([\dA-F]{3,6})$/i.test(color)) {
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
  if (ageToggle !== null) {
    updates.ageVisible = ageToggle;
  }

  if (Object.keys(updates).length === 0) {
    return interaction.reply({
      content: "No changes provided.",
      ephemeral: true,
    });
  }

  const updatedProfile = await Profile.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true }
  );

  await commandLogging(client, interaction);
  await profileLogging(client, interaction, "edited", originalProfile, updatedProfile);

  const confirmations = [];
  if (colorInput) confirmations.push("Profile color updated.");
  if (badgeToggle !== null) confirmations.push(badgeToggle ? "Badges are now visible." : "Badges are now hidden.");
  if (ageToggle !== null) confirmations.push(ageToggle ? "Age is now visible." : "Age is now hidden.");

  return interaction.reply({ content: confirmations.join(" ") || "Display settings updated!", ephemeral: true });
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

  if (profile.username !== targetUser.username) {
    profile.username = targetUser.username;
    await profile.save();
  }

  const embedColor = profile.color || "#FF00EA";
  const idLists = await IDLists.findOne();

  const userUsage = await UserCommandUsage.findOne({ userId });
  let totalCommands = 0;
  if (userUsage && userUsage.commandsUsed) {
    totalCommands = userUsage.commandsUsed.reduce((sum, cmd) => sum + cmd.usageCount, 0);
  }

  let badgeStr = "";

  if (profile.badgesVisible && idLists) {
    badgeStr = Object.entries(badgeMap).reduce((acc, [key, emoji]) => acc + (Array.isArray(idLists[key]) && idLists[key].includes(userId) ? emoji : ""), "");
  }

  const fields = [];
  fields.push({
    name: "Preferred Name",
    value: profile.preferredName || "Not set",
    inline: true,
  });
  if (profile.ageVisible !== false && profile.age && profile.age !== 0) {
    fields.push({ name: "Age", value: String(profile.age), inline: true });
  }
  fields.push({
    name: "Commands Run",
    value: totalCommands.toString(),
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
      value: profile.bio.replaceAll("\\n", "\n"),
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
    .setThumbnail(getProfileThumbnail(profile, targetUser))
    .setFooter({ text: "Profile Information" })
    .setTimestamp();

  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setLabel("Web Profile")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://profile.pridebot.xyz/${userId}`)
  );

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

  // Trigger profile feedback survey
  await checkAndShowProfileFeedbackSurvey(interaction, interaction.user.id);

  if (row.components.length > 0) {
    return interaction.reply({
      embeds: [embed],
      components: [row],
    });
  } else {
    return interaction.reply({
      embeds: [embed],
    });
  }
}

async function handlePremium(interaction) {
  const userId = interaction.user.id;
  const action = interaction.options.getString("website");
  const premiumToggle = interaction.options.getBoolean("premiumtoggle");
  const attachment = interaction.options.getAttachment("premiumpicture");

  let profile = (await Profile.findOne({ userId })) || new Profile({ userId });
  if (!profile.premiumMember) profile.premiumMember = true;
  if (!profile.premiumSince) profile.premiumSince = new Date();
  await profile.save();

  const updates = {};
  const messages = [];

  if (premiumToggle !== null) {
    updates.premiumVisible = premiumToggle;
    messages.push(premiumToggle ? "Premium days are now visible on your profile." : "Premium days are now hidden from your profile.");
  }

  if (attachment) {
    try {
      const response = await fetch(attachment.url);
      const ext = path.extname(attachment.name || ".png").split("?")[0] || ".png";
      const filename = `${userId}${ext}`;
      const pfpDir = path.join(__dirname, "..", "..", "..", "profilepfps");
      if (!fs.existsSync(pfpDir)) fs.mkdirSync(pfpDir, { recursive: true });
      fs.writeFileSync(path.join(pfpDir, filename), await response.arrayBuffer());
      updates.pfp = `${config.links.profile}/pfps/${filename}?t=${Date.now()}`;
      messages.push("Profile picture updated.");
    } catch (err) {
      console.error("Failed to save premium pfp:", err);
      return interaction.reply({
        content: "Failed to save your profile picture. Please try again.",
        ephemeral: true,
      });
    }
  }

  if (Object.keys(updates).length > 0) {
    await Profile.findOneAndUpdate({ userId }, { $set: updates });
  }

  switch (action) {
    case "add": {
      const lastSite = profile.customWebsites.slice(-1)[0] || {};
      const labelPh = lastSite.label || "e.g. My Blog";
      const urlPh = lastSite.url || "https://example.com";
      const modal = new ModalBuilder()
        .setCustomId("customWebsiteModal")
        .setTitle("Add Custom Website");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("websiteLabel")
            .setLabel("Button Label")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(labelPh)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("websiteUrl")
            .setLabel("Website URL")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(urlPh)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    case "remove": {
      const sites = profile.customWebsites || [];
      if (sites.length === 0) {
        return interaction.reply({ content: "No websites to remove.", ephemeral: true });
      }
      const options = sites.map((ws) => ({ label: ws.label, value: ws.url }));
      const menu = new StringSelectMenuBuilder()
        .setCustomId("removeWebsiteSelect")
        .setPlaceholder("Select a website to remove")
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(menu);
      return interaction.reply({ content: "Choose a website to remove:", components: [row], ephemeral: true });
    }
  }

  if (messages.length > 0) {
    return interaction.reply({ content: messages.join(" "), ephemeral: true });
  }

  return interaction.reply({ content: "No changes provided.", ephemeral: true });
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

  const pronounpage = interaction.options.getString("pronounpage");
  if (pronounpage && !isValidPronounPageLink(pronounpage)) {
    return interaction.reply({
      content: "Invalid pronoun page link.",
      ephemeral: true,
    });
  }

  const updates = collectUpdateFields(interaction);
  updates.username = interaction.user.username;
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

  await checkAndShowProfileFeedbackSurvey(interaction, interaction.user.id);

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
  if (newProfile.age && newProfile.age !== 0) {
    fields.push({ name: "Age", value: String(newProfile.age), inline: true });
  }
  if (newProfile.bio)
    fields.push({
      name: "Bio",
      value: newProfile.bio.replaceAll("\\n", "\n"),
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
  await checkAndShowProfileFeedbackSurvey(interaction, interaction.user.id);

  return interaction.reply({
    content: "Profile created successfully!",
    embeds: [embed],
    ephemeral: true,
  });
}

// -- Utilities --
function getProfileThumbnail(profile, targetUser) {
  if (profile.pfp) {
    try {
      const url = new URL(profile.pfp);
      // If it's a Discord CDN URL with expiry params, check if expired
      if (url.hostname.includes("discord") && url.searchParams.has("ex")) {
        const expiryHex = url.searchParams.get("ex");
        const expiryTime = parseInt(expiryHex, 16) * 1000;
        if (Date.now() > expiryTime) {
          return targetUser.displayAvatarURL();
        }
      }
      return profile.pfp;
    } catch {
      return targetUser.displayAvatarURL();
    }
  }
  return targetUser.displayAvatarURL();
}

function isValidPronounPageLink(link) {
  return /^https:\/\/(en\.)?pronouns\.page\/@[\w-]+$/.test(link);
}

async function ageCheck(interaction, age, cmd) {
  if (age !== null && age !== 0 && (age < 13 || age > 99)) {
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
  if (interaction.options.getString("pronounpage") !== null) {
    data.pronounpage = interaction.options.getString("pronounpage");
  }
  return data;
}

function collectSetupFields(interaction) {
  return {
    userId: interaction.user.id,
    username: interaction.user.username,
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

async function handleModalSubmit(interaction, client) {
  if (interaction.customId !== "customWebsiteModal") return;
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const label = interaction.fields.getTextInputValue("websiteLabel");
  const url = interaction.fields.getTextInputValue("websiteUrl");
  const profile =
    (await Profile.findOne({ userId })) || new Profile({ userId });
  profile.premiumMember = true;
  if (!profile.premiumSince) profile.premiumSince = new Date();
  profile.customWebsites = profile.customWebsites || [];
  profile.customWebsites.push({ label, url });
  await profile.save();
  await commandLogging(client, interaction);
  await profileLogging(client, interaction, "edited", null, profile);
  return interaction.editReply({
    content: "Website added!",
    ephemeral: true,
  });
}

async function handleRemoveWebsite(interaction, client) {
  if (interaction.customId !== "removeWebsiteSelect") return;
  await interaction.deferUpdate();
  const url = interaction.values[0];
  const userId = interaction.user.id;
  const profile = await Profile.findOne({ userId });
  const original = profile.toObject();
  profile.customWebsites = (profile.customWebsites || []).filter(
    (ws) => ws.url !== url
  );
  await profile.save();
  await commandLogging(client, interaction);
  await profileLogging(client, interaction, "edited", original, profile);
  return interaction.editReply({
    content: `Removed website: ${url}`,
    components: [],
  });
}

module.exports = {
  handleDisplay,
  handleView,
  handleUpdate,
  handleSetup,
  handlePremium,
  handleModalSubmit,
  handleRemoveWebsite,
};
