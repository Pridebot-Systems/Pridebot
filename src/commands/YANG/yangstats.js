const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Chain, User } = require("../../../mongo/models/yangSchema");
const IDLists = require("../../../mongo/models/idSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gaystats")
    .setDescription("Show personal and bot stats on gay chains"),

  async execute(interaction) {
    const userId = interaction.user.id;

    const ids = await IDLists.findOne();
    const isDonor = ids?.donor.includes(userId);
    const slotLimit = isDonor ? 4 : 2;

    const you = await User.findOne({ userId });
    if (!you) {
      return interaction.reply({
        content: "You haven't been gayed yet!",
        ephemeral: true,
      });
    }
    const childrenCount = you.children.length;
    const level = you.level;
    const rank = await User.countDocuments({ _id: { $lte: you._id } });

    const totalChains = await Chain.countDocuments();
    const totalUsers = await User.countDocuments();
    const depthAgg = await User.aggregate([
      { $group: { _id: "$chain", maxLevel: { $max: "$level" } } },
      { $sort: { maxLevel: -1 } },
      { $limit: 1 },
    ]);
    const maxDepth = depthAgg.length ? depthAgg[0].maxLevel : 0;

    const personal = `**Your Rank**: #${rank}\n**Your Level**: ${level}\n**Slots Used**: ${childrenCount}/${slotLimit}`;
    const botStats = `**Total Chains**: ${totalChains}\n**Total Users Gayed**: ${totalUsers}\n**Deepest Chain Level**: ${maxDepth}`;

    const botEmbed = new EmbedBuilder()
      .setTitle("Bot Gay Chain Stats")
      .addFields(
        { name: "Personal Stats", value: `${personal}`, inline: true },
        { name: "Bot Stats", value: `${botStats}`, inline: true }
      )
      .setColor(0xff00ae);

    // Send both embeds
    await interaction.reply({
      embeds: [botEmbed],
    });
  },
};
