const { EmbedBuilder } = require("discord.js");

const profileLogging = async (
  client,
  interaction,
  actionType,
  originalProfile,
  updatedProfile
) => {
  const now = new Date();
  const embed = new EmbedBuilder()
    .setColor("#FF00EA")
    .setTitle(`Profile ${actionType === "created" ? "Created" : "Edited"}`)
    .setDescription(`User: <@${interaction.user.id}> (${interaction.user.id})`)
    .setTimestamp(now);

  if (actionType === "created") {
    // Log initial values for all important fields
    embed.addFields(
      {
        name: "Preferred Name",
        value: updatedProfile.preferredName || "Not set",
        inline: true,
      },
      {
        name: "Age",
        value:
          updatedProfile.age != null ? String(updatedProfile.age) : "Not set",
        inline: true,
      },
      { name: "Bio", value: updatedProfile.bio || "Not set", inline: false },
      {
        name: "Sexuality",
        value: updatedProfile.sexuality || "Not set",
        inline: true,
      },
      {
        name: "Other Sexuality",
        value: updatedProfile.otherSexuality || "Not set",
        inline: true,
      },
      {
        name: "Romantic Orientation",
        value: updatedProfile.romanticOrientation || "Not set",
        inline: true,
      },
      {
        name: "Gender",
        value: updatedProfile.gender || "Not set",
        inline: true,
      },
      {
        name: "Other Gender",
        value: updatedProfile.otherGender || "Not set",
        inline: true,
      },
      {
        name: "Pronouns",
        value: updatedProfile.pronouns || "Not set",
        inline: true,
      },
      {
        name: "Other Pronouns",
        value: updatedProfile.otherPronouns || "Not set",
        inline: true,
      },
      { name: "Color", value: updatedProfile.color || "Not set", inline: true },
      {
        name: "Badges Visible",
        value: updatedProfile.badgesVisible ? "Yes" : "No",
        inline: true,
      },
      {
        name: "Pronoun Page",
        value: updatedProfile.pronounpage || "Not set",
        inline: true,
      },
      {
        name: "Premium Member",
        value: updatedProfile.premiumMember ? "Yes" : "No",
        inline: true,
      },
      {
        name: "Premium Since",
        value: updatedProfile.premiumSince
          ? new Date(updatedProfile.premiumSince).toLocaleString()
          : "Not set",
        inline: true,
      },
      {
        name: "Premium Visible",
        value: updatedProfile.premiumVisible ? "Yes" : "No",
        inline: true,
      }
    );
    // List any websites or avatars
    if (updatedProfile.customWebsites?.length) {
      embed.addFields({
        name: "Websites",
        value: updatedProfile.customWebsites
          .map((w) => `• **${w.label}**: ${w.url}`)
          .join("\n"),
        inline: false,
      });
    }
    if (updatedProfile.customAvatars?.length) {
      embed.addFields({
        name: "Avatars",
        value: updatedProfile.customAvatars.map((a) => a.url).join("\n"),
        inline: false,
      });
      embed.setImage(updatedProfile.customAvatars.slice(-1)[0].url);
    }

    client.channels.cache.get("1284916147702988882")?.send({ embeds: [embed] });
    return;
  }

  // Edited branch: compare fields
  const diffs = [];
  const checkField = (key, displayName) => {
    const oldVal = originalProfile[key] ?? null;
    const newVal = updatedProfile[key] ?? null;
    if (String(oldVal) !== String(newVal)) {
      embed.addFields(
        {
          name: `${displayName} (Old)`,
          value: oldVal ? String(oldVal) : "Not set",
          inline: true,
        },
        {
          name: `${displayName} (New)`,
          value: newVal ? String(newVal) : "Not set",
          inline: true,
        }
      );
    }
  };

  // Basic scalar fields
  checkField("preferredName", "Preferred Name");
  checkField("age", "Age");
  checkField("bio", "Bio");
  checkField("sexuality", "Sexuality");
  checkField("otherSexuality", "Other Sexuality");
  checkField("romanticOrientation", "Romantic Orientation");
  checkField("gender", "Gender");
  checkField("otherGender", "Other Gender");
  checkField("pronouns", "Pronouns");
  checkField("otherPronouns", "Other Pronouns");
  checkField("color", "Color");
  checkField("badgesVisible", "Badges Visible");
  checkField("pronounpage", "Pronoun Page");
  checkField("premiumMember", "Premium Member");
  checkField("premiumSince", "Premium Since");
  checkField("premiumVisible", "Premium Visible");

  // Website additions/removals
  const oldSites = originalProfile.customWebsites || [];
  const newSites = updatedProfile.customWebsites || [];
  const addedSites = newSites.filter(
    (ns) => !oldSites.some((os) => os.label === ns.label && os.url === ns.url)
  );
  const removedSites = oldSites.filter(
    (os) => !newSites.some((ns) => ns.label === os.label && ns.url === os.url)
  );
  if (addedSites.length)
    embed.addFields({
      name: "Websites Added",
      value: addedSites.map((w) => `• **${w.label}**: ${w.url}`).join("\n"),
    });
  if (removedSites.length)
    embed.addFields({
      name: "Websites Removed",
      value: removedSites.map((w) => `• **${w.label}**: ${w.url}`).join("\n"),
    });

  // Avatar changes
  const oldAvs = originalProfile.customAvatars || [];
  const newAvs = updatedProfile.customAvatars || [];
  const addedAvs = newAvs.filter((a) => !oldAvs.some((o) => o.url === a.url));
  const removedAvs = oldAvs.filter((o) => !newAvs.some((a) => a.url === o.url));
  if (addedAvs.length) {
    embed.addFields({
      name: "Avatars Added",
      value: addedAvs.map((a) => a.url).join("\n"),
    });
    embed.setImage(addedAvs.slice(-1)[0].url);
  }
  if (removedAvs.length)
    embed.addFields({
      name: "Avatars Removed",
      value: removedAvs.map((a) => a.url).join("\n"),
    });

  client.channels.cache.get("1284916147702988882")?.send({ embeds: [embed] });
};

module.exports = profileLogging;
