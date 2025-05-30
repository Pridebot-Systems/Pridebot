const { SlashCommandBuilder } = require("discord.js");
const { Chain, User } = require("../../../mongo/models/yangSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gaystats")
    .setDescription("Show stats on all gay chains"),

  async execute(interaction) {
    const totalChains = await Chain.countDocuments();

    const totalUsers = await User.countDocuments();

    const depthAgg = await User.aggregate([
      { $group: { _id: "$chain", maxLevel: { $max: "$level" } } },
      { $sort: { maxLevel: -1 } },
      { $limit: 1 },
    ]);
    const maxDepth = depthAgg.length ? depthAgg[0].maxLevel : 0;

    return interaction.reply({
      content: [
        `📊 Total chains started: **${totalChains}**`,
        `👥 Total users gayed: **${totalUsers}**`,
        `📏 Deepest chain depth: **${maxDepth}** level${
          maxDepth === 1 ? "" : "s"
        }`,
      ].join("\n"),
      ephemeral: true,
    });
  },
};
