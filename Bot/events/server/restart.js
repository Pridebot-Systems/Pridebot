const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { CHANNELS, COLORS } = require("../../../Shared");
const { SHUTDOWN_FILE } = require("../../../Shared/paths");
const { sendLog } = require("../../utils/logging/sendlogs");

module.exports = async (client) => {
  // Called once, from cluster 0. sendLog routes to whichever cluster holds the
  // channel; V1 ran this on every cluster and all but one logged "not found".
  const channelId = CHANNELS.CLEANUP;
  let shutdownTime;

  const shutdownFilePath = SHUTDOWN_FILE;

  if (fs.existsSync(shutdownFilePath)) {
    try {
      const shutdownTimeString = fs.readFileSync(shutdownFilePath, "utf8");
      shutdownTime = parseInt(shutdownTimeString, 10);
    } catch (error) {
      console.error("Error reading shutdown time:", error);
      shutdownTime = Date.now();
    }
  } else {
    shutdownTime = Date.now();
  }

  const downtimeMs = Date.now() - shutdownTime;

  const formatDuration = (ms) => {
    const seconds = (ms / 1000) % 60;
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    let formatted = `${seconds.toFixed(1)}s`;
    if (minutes > 0) formatted = `${minutes}m ${formatted}`;
    if (hours > 0) formatted = `${hours}h ${formatted}`;
    if (days > 0) formatted = `${days}d ${formatted}`;
    return formatted;
  };

  const downtimeString = formatDuration(downtimeMs);
  const timestamp = `<t:${Math.floor(Date.now() / 1000)}:F>`;
  const timestamp1 = `<t:${Math.floor(Date.now() / 1000)}:R>`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle("🔄 Bot Restarted")
    .addFields({
      name: "<:_:1112602480128299079> Downtime Info",
      value: `**Restarted:** ${timestamp} (${timestamp1})\n**Downtime:** **${downtimeString}** (\`${downtimeMs}ms\`)`,
      inline: true,
    })
    .setTimestamp();

  await sendLog(client, embed, channelId);
};
