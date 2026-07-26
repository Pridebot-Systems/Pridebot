const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const { hasFeature, getFixedValueLimit } = require("../../utils/premiumUtils");
const ProfileData = require("../../../mongo/models/profileSchema");

const TIER_DISPLAY = {
  supporter: "Pridebot Supporter",
  lgbtqpp: "Pridebot LGBTQ++",
};

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Manage your Pridebot premium features")
    .addSubcommand((sub) =>
      sub.setName("manage").setDescription("View and manage your premium settings")
    )
    .addSubcommand((sub) =>
      sub.setName("history").setDescription("View your recent dar command history")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "manage": {
        await handleManage(interaction);

        break;
      }

      case "history": {
        await handleHistory(interaction);

        break;
      }
    }
  },
};

async function handleManage(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const profile = await ProfileData.findOne({ userId });
    const tier = profile?.premiumTier || null;
    const historyEnabled = await hasFeature(userId, "darHistory");
    const animatedEnabled = await hasFeature(userId, "animatedAvatar");
    const hasFixedValue = await hasFeature(userId, "darFixedValue");
    const hasDarRange = await hasFeature(userId, "darRange");

    const currentMode = profile?.darMode || "rng";
    const fixedValuesMap = profile?.darFixedValues || new Map();
    const fixedEntries = [...fixedValuesMap.entries()].filter(([, v]) => v !== null && v !== undefined);
    const fixedCount = fixedEntries.length;
    const fixedLimit = getFixedValueLimit(tier);

    const darModeDisplay = {
      rng: "🎲 Random (0–100)",
      range: `📊 Custom range (${profile?.darRangeMin ?? 0}–${profile?.darRangeMax ?? 100})`,
      fixed: fixedCount > 0 ? `🔒 Fixed (${fixedCount}/${fixedLimit} set)` : "🔒 Fixed value (none set)",
    };

    const fields = [
      { name: "Tier", value: tier ? TIER_DISPLAY[tier] : "Free", inline: true },
      { name: "Premium since", value: formatDate(profile?.premiumSince), inline: true },
      { name: "Active dar mode", value: darModeDisplay[currentMode] },
    ];

    if (hasDarRange) {
      fields.push({ name: "Dar range", value: `${profile?.darRangeMin ?? 0} to ${profile?.darRangeMax ?? 100}` });
    }
    if (hasFixedValue) {
      const fixedDisplay = fixedCount === 0
        ? "None set"
        : fixedEntries.map(([cmd, v]) => `**${cmd}**: ${v}%`).join("\n");
      fields.push({ name: `Dar fixed values (${fixedCount}/${fixedLimit})`, value: fixedDisplay });
    }

    fields.push(
      { name: "Dar history", value: historyEnabled ? "Enabled (last 90 results)" : "Not available on your tier" },
      { name: "Animated avatars", value: animatedEnabled ? "Enabled" : "Not available on your tier" },
    );

    const embed = new EmbedBuilder()
      .setTitle("Your Pridebot Premium")
      .setColor(0xff66cc)
      .addFields(...fields);

    const rangeButton = new ButtonBuilder()
      .setCustomId("premium_set_range")
      .setStyle(ButtonStyle.Primary);

    if (hasDarRange) {
      rangeButton.setLabel("Set dar range");
    } else {
      rangeButton.setLabel("Set dar range (LGBTQ++ only)").setDisabled(true);
    }

    const row = new ActionRowBuilder().addComponents(rangeButton);

    if (hasFixedValue) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("premium_set_value")
          .setLabel("Set dar value")
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (historyEnabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("premium_view_history")
          .setLabel("View history")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const modeOptions = [
      new StringSelectMenuOptionBuilder()
        .setLabel("🎲 Random")
        .setDescription("Standard 0–100 random result")
        .setValue("rng")
        .setDefault(currentMode === "rng"),
      new StringSelectMenuOptionBuilder()
        .setLabel("📊 Custom range")
        .setDescription(hasDarRange ? `Rolls between ${profile?.darRangeMin ?? 0} and ${profile?.darRangeMax ?? 100}` : "LGBTQ++ tier required")
        .setValue("range")
        .setDefault(currentMode === "range"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🔒 Fixed value")
        .setDescription(hasFixedValue ? (fixedCount > 0 ? `${fixedCount}/${fixedLimit} commands set` : "Set a fixed value first") : "Supporter+ tier required")
        .setValue("fixed")
        .setDefault(currentMode === "fixed"),
    ];

    const modeRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("premium_mode_select")
        .setPlaceholder("Switch dar mode")
        .addOptions(modeOptions)
    );

    await interaction.editReply({ embeds: [embed], components: [row, modeRow] });
  } catch (err) {
    console.error("[PREMIUM] manage error:", err);
    await interaction.editReply({ content: "Something went wrong. Please try again." });
  }
}

async function handleHistory(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const eligible = await hasFeature(userId, "darHistory");

    if (!eligible) {
      const embed = new EmbedBuilder()
        .setTitle("Premium feature")
        .setColor(0xff66cc)
        .setDescription("Dar history is available from the **Pridebot Supporter** tier and above.\n\n[**View premium plans**](https://pridebot.xyz/premium)");
      return await interaction.editReply({ embeds: [embed] });
    }

    const profile = await ProfileData.findOne({ userId });
    const history = (profile?.darHistory || []).slice(-10).reverse();

    if (history.length === 0) {
      return await interaction.editReply({
        content: "No dar history recorded yet. Use any dar command to start tracking.",
      });
    }

    const lines = history.map((entry) => `**${entry.command}** — ${entry.result}% — ${timeAgo(entry.timestamp)}`);

    const embed = new EmbedBuilder()
      .setTitle("Your Dar History")
      .setColor(0xff66cc)
      .setDescription(lines.join("\n"));

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[PREMIUM] history error:", err);
    await interaction.editReply({ content: "Something went wrong. Please try again." });
  }
}
