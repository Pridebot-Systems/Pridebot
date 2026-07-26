const {
  EmbedBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("User Avatar-view")
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    const pfpuser = interaction.options.getUser("user") || interaction.user;
    const username = pfpuser.username;
    const userDirectory = path.join(__dirname, "../../pfps", pfpuser.id);

    if (!fs.existsSync(userDirectory)) {
      return interaction.reply({
        content: `${username} does not have any pride avatars saved.`,
        ephemeral: true,
      });
    }

    const files = fs
      .readdirSync(userDirectory)
      .filter((file) => file.endsWith(".png"));

    if (files.length === 0) {
      return interaction.reply({
        content: `${username} does not have any pride avatars saved.`,
        ephemeral: true,
      });
    }

    const avatarsPerPage = 9;
    let currentPage = 0;

    const generateEmbed = (page) => {
      const start = page * avatarsPerPage;
      const end = start + avatarsPerPage;
      const pageFiles = files.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(`${username}'s Pride Avatars`)
        .setDescription(
          `To view all the avatars, go to here: https://pfp.pridebot.xyz/${pfpuser.id}`
        )
        .setColor("#FF00EA");

      for (const file of pageFiles) {
        const flagName = file.replace(".png", "");
        const imageURL = `https://pfp.pridebot.xyz/${pfpuser.id}/${file}`;
        embed.addFields({
          name: `Flag: ${flagName}`,
          value: `[Link to avatar](${imageURL})`,
          inline: true,
        });
      }

      embed.setFooter({
        text: `Page ${page + 1} of ${Math.ceil(files.length / avatarsPerPage)}`,
      });
      return embed;
    };

    const generateButtons = (page) => {
      const totalPages = Math.ceil(files.length / avatarsPerPage);
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );
    };

    const message = await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: [generateButtons(currentPage)],
      ephemeral: true,
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === interaction.user.id &&
      ["prev_page", "next_page"].includes(i.customId);

    const collector = message.createMessageComponentCollector({
      filter,
      time: 60000, 
    });

    collector.on("collect", async (i) => {
      if (i.customId === "prev_page") currentPage--;
      if (i.customId === "next_page") currentPage++;

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)],
      });
    });

    collector.on("end", async () => {
      await interaction.editReply({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("prev_page")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("next_page")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          ),
        ],
      });
    });
  },
};
