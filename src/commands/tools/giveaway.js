const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Giveaway } = require("../../../mongo/models/giveawaySchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage or enter the ongoing giveaway.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("enter")
        .setDescription("Enter the giveaway for a chance to win 5× $10 Nitro!")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rules")
        .setDescription("View the rules and details of the giveaway.")
        .addBooleanOption((option) =>
          option
            .setName("public")
            .setDescription("Show rules publicly")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const REQUIRED_ROLE = "1250607513821511720";
    const PRIDECORD_GUILD_ID = "1077258761443483708";
    const HARDCODED_END = new Date("2025-06-30T11:59:59Z");

    let giveaway = await Giveaway.findOne();

    if (subcommand === "rules") {
      const endTime = giveaway ? giveaway.endTime : HARDCODED_END;
      const entrantsCount = giveaway ? giveaway.entrants.length : 0;
      const isPublic = interaction.options.getBoolean("public");
      const isEphemeral = !isPublic;

      const embed = new EmbedBuilder()
        .setTitle(
          "Pridebot X Pridecord 5× $10 Nitro Pridemonth Giveaway — Rules"
        )
        .addFields(
          {
            name: "Entries",
            value: `${entrantsCount}`,
            inline: true,
          },
          {
            name: "How to Enter",
            value:
              "To enter, simply use </giveaway enter:1378536586701963395> in the Pridecord server. You must be at least level 5 or higher to enter.",
          },
          {
            name: "Rules",
            value:
              "**1.** Must be a member of the [Pridecord Discord server](https://discord.gg/UPCqG6weXt) and must be level 5 or higher\n" +
              "**2.** You must meet **one** of the following:\n" +
              "   • Have interacted with Pridebot at least 25 times (e.g., command usage, profile creation/editing), **or**\n" +
              "   • Invite Pridebot to a server that you own/administer with **at least 25 members**, and that server must have been active for **at least 3 weeks** at the start of the giveaway.\n",
          },
          {
            name: "Legal",
            value:
              "**1.** Pridebot will store all entrant IDs only for the duration of the giveaway and prize fulfillment, after which all IDs will be permanently deleted.\n" +
              "**2.** Prizes: Five (5) winners will each receive a one-month [Discord Nitro](https://discord.com/nitro) subscription (including two server boosts).\n" +
              "**3.** Winners will be selected on <t:1751342400:f>. To claim your prize, you must open a ticket in Pridecord by <t:1751947200:f>. Any prizes not claimed by that deadline will be forfeited.\n",
          }
        )
        .setColor(0xff00ae)
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: isEphemeral,
      });
    }

    if (subcommand === "enter") {
      if (!interaction.guild || interaction.guild.id !== PRIDECORD_GUILD_ID) {
        return interaction.reply({
          content:
            "❌ You must run </giveaway enter:1378536586701963395> inside the Pridecord server (https://discord.gg/UPCqG6weXt) once you’re level 5.",
          ephemeral: true,
        });
      }

      const prideMember = interaction.member;
      if (!prideMember.roles.cache.has(REQUIRED_ROLE)) {
        return interaction.reply({
          content:
            "❌ You need to be level 5 or higher in Pridecord to enter this giveaway.",
          ephemeral: true,
        });
      }

      if (!giveaway) {
        giveaway = await Giveaway.create({
          entrants: [interaction.user.id],
          endTime: HARDCODED_END,
        });

        return interaction.reply({
          content: "🎉 You have been registered for the giveaway!",
          ephemeral: true,
        });
      }

      const alreadyEntered = giveaway.entrants.includes(interaction.user.id);
      if (alreadyEntered) {
        return interaction.reply({
          content: "⚠️ You already entered into the giveaway.",
          ephemeral: true,
        });
      }

      giveaway.entrants.push(interaction.user.id);
      await giveaway.save();

      const embed = new EmbedBuilder()
        .setTitle("Pridebot X Pridecord 5× $10 Nitro Pridemonth Giveaway")
        .addFields(
          {
            name: "Entries",
            value: `${giveaway.entrants.length}`,
            inline: true,
          },
          {
            name: "Rules",
            value:
              "**1.** Must be a member of the [Pridecord Discord server](https://discord.gg/UPCqG6weXt) and be level 5+\n" +
              "**2.** To qualify, you must meet **one** of the following:\n" +
              "   • Have interacted with Pridebot at least 25 times (e.g., command usage, profile creation/editing), **or**\n" +
              "   • Invite Pridebot to a server that you own/administer with **at least 25 members**, and that server must have been active for **at least 3 weeks** at the start of the giveaway.\n",
          },
          {
            name: "Legal",
            value:
              "**1.** Pridebot will store all entrant IDs only for the duration of the giveaway and prize fulfillment, after which all IDs will be permanently deleted.\n" +
              "**2.** Prizes: Five (5) winners will each receive a one-month [Discord Nitro](https://discord.com/nitro) subscription (including two server boosts).\n" +
              "**3.** Winners will be selected on <t:1751342400:f>. To claim your prize, you must open a ticket in Pridecord by <t:1751947200:f>. Any prizes not claimed by that deadline will be forfeited.\n",
          }
        )
        .setColor(0xff00ae)
        .setTimestamp();

      return interaction.reply({
        content: "✅ You are now entered into the giveaway!",
        embeds: [embed],
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: "❌ Unknown subcommand.",
      ephemeral: true,
    });
  },
};
