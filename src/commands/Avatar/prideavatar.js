const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { avatarProcessor, validFlags } = require("./avatarProcessor");
const { logAvatarGeneration } = require("./avatarAnalytics");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prideavatar")
    .setDescription("Add a pride flag to your avatar")
    .addStringOption((option) =>
      option
        .setName("flag")
        .setDescription(
          "The pride flag to overlay (For a full list of flags, do /avatar-list)"
        )
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("flag2")
        .setDescription(
          "Add a second flag (For a full list of flags, do /avatar-list)"
        )
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Change another user's avatar")
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const substring = focusedOption.value.toLowerCase();
    let choices = validFlags.filter((flag) =>
      flag.toLowerCase().includes(substring)
    );

    choices = choices.slice(0, 25);

    await interaction.respond(
      choices.map((choice) => ({
        name: choice,
        value: choice,
      }))
    );
  },

  async execute(interaction, client) {
    const startTime = Date.now();
    try {
      await interaction.deferReply();

      const pfpuser = interaction.options.getUser("user") || interaction.user;
      const username = pfpuser.username;
      const avatarURL = pfpuser.displayAvatarURL({ format: "png", size: 512 });
      const flagName = interaction.options.getString("flag").toLowerCase();
      const flagName2 = interaction.options.getString("flag2")?.toLowerCase();

      const validation = avatarProcessor.validateFlags(flagName, flagName2);
      if (!validation.valid) {
        await interaction.editReply({
          content: `❌ ${validation.error}. Use \`/avatar-list\` to see available flags.`,
          ephemeral: true
        });
        return;
      }

      if (!avatarProcessor.initialized) {
        await interaction.editReply("Initializing avatar system... This may take a moment.");
        await avatarProcessor.initialize();
      }

      await interaction.editReply("Creating your pride avatar...");

      // Generate avatar using optimized processor
      let avatarData;
      try {
        avatarData = await avatarProcessor.generateAvatar(
          avatarURL, 
          flagName, 
          flagName2, 
          pfpuser.id,
          pfpuser.username
        );
      } catch (error) {
        console.error(`Avatar generation failed for user ${pfpuser.id}:`, error);
        
        if (error.message.includes('Failed to download user avatar')) {
          await interaction.editReply({
            content: "❌ Unable to download your avatar. Please ensure your Discord avatar is set and try again.",
            ephemeral: true
          });
        } else if (error.message.includes('Flag buffer not found')) {
          await interaction.editReply({
            content: "❌ Flag image not found. Please try a different flag or contact support.",
            ephemeral: true
          });
        } else {
          await interaction.editReply({
            content: "❌ An error occurred while processing your avatar. Please try again.",
            ephemeral: true
          });
        }
        return;
      }

      // Save avatar files
      const fileName = `${flagName}${flagName2 ? flagName2 : ""}.png`;
      let savedPaths;
      try {
        savedPaths = await avatarProcessor.saveAvatar(avatarData, pfpuser.id, fileName, pfpuser.username);
      } catch (error) {
        console.error(`Error saving avatar for user ${pfpuser.id}:`, error);
        await interaction.editReply({
          content: "❌ Error saving your avatar. Please try again.",
          ephemeral: true
        });
        return;
      }

      const timestamp = Date.now();
      const imageURL = `https://pfp.pridebot.xyz/${pfpuser.id}/${fileName}`;
      const imageURLWithTime = `${imageURL}?time=${timestamp}`;

      const embed = new EmbedBuilder()
        .setTitle(`${username}'s ${flagName}${flagName2 ? " & " + flagName2 : ""} Avatar`)
        .setImage(imageURLWithTime)
        .setFooter({
          text: "For more flags use /avatar-list | Images deleted after 30 days",
        })
        .setColor("#FF00EA")
        .setTimestamp();



      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Download PNG")
          .setStyle(ButtonStyle.Link)
          .setURL(imageURLWithTime),
        new ButtonBuilder()
          .setLabel("Download WebP")
          .setStyle(ButtonStyle.Link)
          .setURL(imageURL.replace('.png', '.webp') + `?time=${timestamp}`),
        new ButtonBuilder()
          .setLabel("View All Avatars")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://pfp.pridebot.xyz/${pfpuser.id}`)
      );

      await commandLogging(client, interaction);
      
      const totalTime = Date.now() - startTime;
      if (totalTime > 2000) {
        console.log(`Slow avatar command: ${totalTime}ms for ${pfpuser.id}`);
      }
      
      logAvatarGeneration({
        userID: pfpuser.id,
        username: username,
        flagName: flagName,
        flagName2: flagName2,
        processingTime: avatarData.processingTime,
        fileSize: avatarData.fileSize,
        cacheHit: avatarData.processingTime < 100,
        totalCommandTime: totalTime
      }).catch(error => {
        console.error('Failed to log avatar generation analytics:', error);
      });
      
      await interaction.editReply({
        content: `Your pride avatar is ready!`,
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error("Unexpected error in pride avatar command:", error);
      
      const errorMessage = error.code === 'ENOENT' 
        ? "❌ Avatar system files are missing. Please contact support."
        : "❌ An unexpected error occurred. Please try again later.";
        
      try {
        await interaction.editReply({
          content: errorMessage,
          ephemeral: true
        });
      } catch (editError) {
        console.error("Failed to edit reply with error message:", editError);
      }
    }
  },
};
