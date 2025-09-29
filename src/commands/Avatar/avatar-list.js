const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { validFlags } = require("./avatarProcessor");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar-list")
    .setDescription("List all available flags for the avatar command"),

  async execute(interaction, client) {
    const flagsPerColumn = 20;
    const columns = [];

    // Split flags into columns for better readability
    for (let i = 0; i < validFlags.length; i += flagsPerColumn) {
      columns.push(validFlags.slice(i, i + flagsPerColumn));
    }

    const embed = new EmbedBuilder()
      .setTitle(`Available Pride Flags (${validFlags.length} total)`)
      .setColor("#FF00EA")
      .setTimestamp()
      .setFooter({
        text: "Use /prideavatar to create your avatar with any of these flags",
      });

    // Add each column as a field
    columns.forEach((column, index) => {
      embed.addFields({
        name: `Flags ${index * flagsPerColumn + 1}-${Math.min(
          (index + 1) * flagsPerColumn,
          validFlags.length
        )}`,
        value: column.join(", "),
        inline: true,
      });
    });

    // Add usage examples
    embed.addFields({
      name: "💡 Usage Examples",
      value: [
        "`/prideavatar flag:lesbian` - Single flag",
        "`/prideavatar flag:transgender flag2:lesbian` - Dual flags",
        "`/prideavatar flag:gay user:@friend` - For another user",
      ].join("\n"),
      inline: false,
    });

    await commandLogging(client, interaction);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
