const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require("discord.js");
const { getInfo } = require("discord-hybrid-sharding");
const commandLogging = require("../../utils/logging/commandlog");
const { getStats } = require("../../functions/bot/stats");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Get the bot's and discord stats"),

  async execute(interaction, client) {
    const startTimestamp = Date.now();
    await interaction.deferReply();

    const botLatency = Date.now() - startTimestamp;
    const botping = Math.round(client.ws.ping);

    function formatUptime(seconds) {
      const timeUnits = {
        day: 3600 * 24,
        hour: 3600,
        minute: 60,
        second: 1,
      };
      let result = [];
      for (const [unit, amountInSeconds] of Object.entries(timeUnits)) {
        const quantity = Math.floor(seconds / amountInSeconds);
        seconds %= amountInSeconds;
        if (quantity > 0) {
          result.push(`${quantity} ${unit}${quantity > 1 ? "s" : ""}`);
        }
      }
      return result.join(", ");
    }

    async function getProcessStats() {
      const perCluster = await client.cluster.broadcastEval(async () => {
        const sampleMs = 200;
        const before = process.cpuUsage();
        await new Promise((r) => setTimeout(r, sampleMs));
        const { user, system } = process.cpuUsage(before);
        return {
          rss: process.memoryUsage().rss,
          cpu: ((user + system) / 1000 / sampleMs) * 100,
        };
      });
      return {
        memory: (perCluster.reduce((a, c) => a + c.rss, 0) / 1024 / 1024).toFixed(2),
        cpu: perCluster.reduce((a, c) => a + c.cpu, 0).toFixed(2),
      };
    }

    try {
      const stats = await getStats(client);

      const approximateUserInstallCount = stats.UserInstallCount;
      const CommandsCount = stats.commandsCount ?? 0;
      const profileAmount = stats.profileAmount ?? 0;
      const totalUsage = stats.totalUsage ?? 0;
      const currentGuildCount = stats.currentGuildCount ?? 0;
      const totalUserCount = stats.totalUserCount ?? 0;

      const startTimeTimestamp = `<t:${client.botStartTime}:f>`;

      const processStats = await getProcessStats();
      const memoryUsage = `${processStats.memory} MB`;
      const cpuUsage = `${processStats.cpu}%`;

      const ping = `**Ping**: \`${botping}ms\` \n**Bot Latency**: \`${botLatency}ms\``;
      const up = `\n**Uptime:** \`${formatUptime(
        process.uptime()
      )}\` \n**Start Time:** ${startTimeTimestamp}`;
      const botstats = `**Servers:** \`${currentGuildCount.toLocaleString()}\` \n**Users:** \`${totalUserCount.toLocaleString()}\`\n**User Installs:** \`${approximateUserInstallCount.toLocaleString()}\``;
      const commandstats = `**Commands:** \`${CommandsCount}\` \n**Total Usage:** \`${totalUsage.toLocaleString()}\` \n**Profiles:** \`${profileAmount.toLocaleString()}\``;
      const botversion = `**Dev:** \`v${stats.version}\` \n **Node.js:** \`${process.version}\` \n **Discord.js:** \`v${discordJsVersion}\``;
      const clientstats = `**CPU:** \`${cpuUsage}\` \n**Memory:** \`${memoryUsage}\``;
      const shardstats = `**Shards:** \`${
        getInfo().TOTAL_SHARDS
      }\` \n**Clusters:** \`${getInfo().CLUSTER_COUNT}\``;

      const embed = new EmbedBuilder()
        .setDescription(
          "# <:Lg_Pridebot_pride:1486524439423225946> Pridebot Stats \n Here are some stats about Pridebot!"
        )
        .setColor(0xff00ae)
        .addFields(
          {
            name: "<:Ic_Pridebot_users:1486467081405988996> __Servers/Users__",
            value: botstats,
            inline: true,
          },
          {
            name: "<:Ic_Pridebot_ping:1486467071335465000> __Ping/Latency__",
            value: ping,
            inline: true,
          },
          {
            name: "<:Ic_Pridebot_prideutility:1486467000187355308> __Usage__",
            value: clientstats,
            inline: true,
          },
          {
            name: "<:Ic_Pridebot_prideslash:1486466997398143086> __Command/Profile__",
            value: commandstats,
            inline: true,
          },
          {
            name: "<:Ic_Pridebot_info:1486466990586724397> __Versions__",
            value: botversion,
            inline: true,
          },
          {
            name: "<:Ic_Pridebot_discord:1486466874186399894> __Uptime__",
            value: up,
            inline: true,
          },
          {
            name: "<:Ic_Pridebot_globe:1486467164486635520> __Shard/Cluster__",
            value: shardstats,
            inline: true,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await commandLogging(client, interaction);
    } catch (error) {
      console.error("Error executing /stats command:", error);
      await interaction.editReply(
        "There was an error while executing the /stats command."
      );
    }
  },
};
