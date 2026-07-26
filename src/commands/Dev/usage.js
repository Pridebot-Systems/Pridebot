const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");
const IDLists = require("../../../mongo/models/idSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("usage")
    .setDescription("See how many times commands are used")
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone")
        .setRequired(false)
    ),

  categorizeCommand(commandName) {
    const categories = {
      Avatar: ["avatar-list", "avatar-view", "prideavatar", "useravatar-view"],
      Fun: [
        "gaydar",
        "lgbtq",
        "match",
        "rizzdar",
        "bidar",
        "queerdar",
        "transdar",
        "usergaydar",
        "userqueerdar",
        "usertransdar",
      ],
      Pride: [
        "pridemonth",
        "genderfluid",
        "nonbinary",
        "transgender",
        "asexual",
        "bisexual",
        "gay",
        "lesbian",
        "pansexual",
        "queer",
      ],
      Profile: ["profile", "userprofile"],
      Support: ["comingout", "mentalhealth", "transresources", "feedback"],
      Terms: ["gender", "other", "pronouns", "sexuality"],
      Tools: [
        "help",
        "nametester",
        "partner",
        "premium",
        "pronountester",
        "stats",
        "vote",
      ],
      Dev: [
        "blacklist",
        "darid",
        "errormode",
        "id",
        "pfpcleanup",
        "pfpstats",
        "termlist",
        "topserver",
        "usage",
      ],
    };

    for (const [category, commands] of Object.entries(categories)) {
      if (commands.includes(commandName.toLowerCase())) {
        return category;
      }
    }
    return "Other";
  },

  async execute(interaction) {
    const idLists = await IDLists.findOne();
    const devUsers = idLists ? idLists.devs : [];

    if (!devUsers.includes(interaction.user.id)) {
      await interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
      return;
    }

    const allUsages = await CommandUsage.find({}).sort({ count: -1 });
    const totalUsage = allUsages.reduce((acc, cmd) => acc + cmd.count, 0);

    const categorizedUsages = {};
    const categories = [
      "Avatar",
      "Fun",
      "Pride",
      "Profile",
      "Support",
      "Terms",
      "Tools",
      "Dev",
      "Other",
    ];

    categories.forEach((category) => {
      categorizedUsages[category] = [];
    });

    allUsages.forEach((cmd) => {
      const category = this.categorizeCommand(cmd.commandName);
      categorizedUsages[category].push(cmd);
    });

    const usageEmbed = new EmbedBuilder()
      .setColor("#FF00EA")
      .setTitle("Command Usage by Category")
      .setDescription(
        `Total Commands Used: **${totalUsage}** \nShowing **all** commands \nTracking since <t:1711310418:f> (<t:1711310418:R>) `
      )
      .setTimestamp();

    categories.forEach((category) => {
      const categoryCommands = categorizedUsages[category];
      if (categoryCommands.length === 0) return;

      const categoryTotal = categoryCommands.reduce(
        (acc, cmd) => acc + cmd.count,
        0
      );
      const categoryPercentage = ((categoryTotal / totalUsage) * 100).toFixed(
        2
      );

      let commandList = categoryCommands
        .map((cmd) => {
          const percentage = ((cmd.count / totalUsage) * 100).toFixed(2);
          return `**${cmd.commandName}**: ${cmd.count} (${percentage}%)`;
        })
        .join("\n");

      usageEmbed.addFields({
        name: `${category} (${categoryTotal} uses - ${categoryPercentage}%)`,
        value: commandList || "No commands found",
        inline: true,
      });
    });

    const isPublic = interaction.options.getBoolean("public") || false;
    await interaction.reply({ embeds: [usageEmbed], ephemeral: !isPublic });
  },
};
