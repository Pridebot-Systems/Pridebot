const {
  EmbedBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Profile = require("../../../DB/models/profileSchema");
const IDLists = require("../../../DB/models/idSchema");

const { badgeMap, combineIdentity } = require("../../functions/profile/profilehelper");
const { normalizeHexColor } = require("../../../Shared/constants/profile");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("User Profile")
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    try {
      const targetUserId = interaction.targetId;
      const targetUser = await interaction.client.users.fetch(targetUserId);

      const profile = await Profile.findOne({ userId: targetUserId });

      if (!profile) {
        return interaction.reply({
          content: "This user doesn't have a profile set up yet.",
          ephemeral: true,
        });
      }

      const embedColor = normalizeHexColor(profile.color) || "#FF00EA";
      const idLists = await IDLists.findOne();
      let badgeStr = "";
      if (profile && profile.badgesVisible && idLists) {
        badgeStr = Object.entries(badgeMap).reduce((acc, [key, value]) => acc + (idLists[key] && idLists[key].includes(targetUser.id) ? value : ""), "");
      }

      const combinedPronouns = combineIdentity(profile.pronouns, profile.otherPronouns);
      const combinedSexuality = combineIdentity(profile.sexuality, profile.otherSexuality);
      const combinedGender = combineIdentity(profile.gender, profile.otherGender);

      const profileFields = [
        {
          name: "Preferred Name",
          value: profile.preferredName || "Not set",
          inline: true,
        },
      ];
      if (profile.ageVisible !== false && profile.age && profile.age !== 0) {
        profileFields.push({ name: "Age", value: profile.age.toString(), inline: true });
      }
      if (profile.bio) {
        profileFields.push({
          name: "Bio",
          value: profile.bio ? profile.bio.replaceAll("\\n", "\n") : "Not set",
          inline: false,
        });
      }
      profileFields.push(
        {
          name: "Sexual Orientation",
          value: combinedSexuality,
          inline: true,
        },
        {
          name: "Romantic Orientation",
          value: profile.romanticOrientation || "Not set",
          inline: true,
        },
        { name: "Gender", value: combinedGender, inline: true },
        { name: "Pronouns", value: combinedPronouns, inline: true }
      );

      const profileEmbed = new EmbedBuilder()
        .setColor(`${embedColor}`)
        .setTitle(`${targetUser.username}'s Profile ${badgeStr}`)
        .addFields(profileFields)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: "Profile Information" })
        .setTimestamp();

      if (profile.pronounpage) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Pronoun Page")
            .setStyle(ButtonStyle.Link)
            .setURL(profile.pronounpage)
        );

        return interaction.reply({ embeds: [profileEmbed], components: [row] });
      } else {
        return interaction.reply({ embeds: [profileEmbed] });
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply(
        "An error occurred while fetching the profile."
      );
    }
  },
};
