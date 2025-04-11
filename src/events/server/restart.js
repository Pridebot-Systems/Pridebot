const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = async (client) => {
  const channelId = "1360270874933989386";
  const channel = client.channels.cache.get(channelId);
  let shutdownTime;

  const shutdownFilePath = path.join(
    __dirname,
    "..",
    "..",
    "shutdown-time.txt"
  );

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
    .setColor("FF00EA")
    .setTitle("🔄 Bot Restarted")
    .addFields({
      name: "<:_:1112602480128299079> Downtime Info",
      value: `**Restarted:** ${timestamp} (${timestamp1})\n**Downtime:** **${downtimeString}** (\`${downtimeMs}ms\`)`,
      inline: true,
    })
    .setTimestamp();

  if (channel) {
    await channel.send({ embeds: [embed] });
  } else {
    console.error(`Channel with ID ${channelId} not found.`);
  }
};
