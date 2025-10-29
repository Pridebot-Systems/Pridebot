const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pm2 = require("pm2");
const fetch = require("node-fetch"); // Make sure node-fetch is installed!
const { getInfo } = require("discord-hybrid-sharding");
const commandLogging = require("../../config/logging/commandlog");
const { getTotalCommits } = require("../../config/commandfunctions/commit");
const {
  getApproximateUserInstallCount,
} = require("../../config/botfunctions/user_install");

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

    async function getPm2Stats() {
      return new Promise((resolve, reject) => {
        pm2.connect((err) => {
          if (err) return reject(err);
          pm2.list((err, processList) => {
            if (err) return reject(err);
            pm2.disconnect();
            const botProcess = processList.find(
              (proc) => proc.name === "Pridebot"
            );
            if (botProcess) {
              resolve({
                memory: (botProcess.monit.memory / 1024 / 1024).toFixed(2),
                cpu: botProcess.monit.cpu.toFixed(2),
              });
            } else {
              resolve({ memory: "N/A", cpu: "N/A" });
            }
          });
        });
      });
    }

    try {
      // === USE CACHED API FOR FAST STATS ===
      const statsRes = await fetch("https://api.pridebot.xyz/stats");
      if (!statsRes.ok) throw new Error("Failed to fetch API stats.");
      const stats = await statsRes.json();

      const approximateUserInstallCount =
        stats.UserInstallCount ??
        (await getApproximateUserInstallCount(client));
      const CommandsCount = stats.commandsCount ?? 0;
      const profileAmount = stats.profileAmount ?? 0;
      const totalUsage = stats.totalUsage ?? 0;
      const currentGuildCount = stats.currentGuildCount ?? 0;
      const totalUserCount = stats.totalUserCount ?? 0;

      const startTimeTimestamp = `<t:${client.botStartTime}:f>`;

      const pm2Stats = await getPm2Stats();
      const memoryUsage = `${pm2Stats.memory} MB`;
      const cpuUsage = `${pm2Stats.cpu}%`;

      let totalCommits = await getTotalCommits(
        "Pridebot-Systems",
        "Pridebot",
        process.env.githubToken
      );

      let commitHundreds = totalCommits.toString().slice(-3, -2) || "0";
      let commitTens = totalCommits.toString().slice(-2, -1) || "0";
      let commitOnes = totalCommits.toString().slice(-1);

      const ping = `**Ping**: \`${botping}ms\` \n**Bot Latency**: \`${botLatency}ms\``;
      const up = `\n**Uptime:** \`${formatUptime(
        process.uptime()
      )}\` \n**Start Time:** ${startTimeTimestamp}`;
      const botstats = `**Servers:** \`${currentGuildCount.toLocaleString()}\` \n**Users:** \`${totalUserCount.toLocaleString()}\`\n**User Installs:** \`${approximateUserInstallCount.toLocaleString()}\``;
      const commandstats = `**Commands:** \`${CommandsCount}\` \n**Total Usage:** \`${totalUsage.toLocaleString()}\` \n**Profiles:** \`${profileAmount.toLocaleString()}\``;
      const botversion = `**Dev:** \`${commitHundreds}.${commitTens}.${commitOnes}\` \n **Node.js:** \`${process.version}\` \n **Discord.js:** \`v14.19.2\``;
      const clientstats = `**CPU:** \`${cpuUsage}\` \n**Memory:** \`${memoryUsage}\``;
      const shardstats = `**Shards:** \`${
        getInfo().TOTAL_SHARDS
      }\` \n**Clusters:** \`${getInfo().CLUSTER_COUNT}\``;

      const embed = new EmbedBuilder()
        .setDescription(
          "# <:_:1108228682184654908> Pridebot Stats \n Here are some stats about Pridebot!"
        )
        .setColor(0xff00ae)
        .addFields(
          {
            name: "<:_:1195874659338555462> __Servers/Users__",
            value: botstats,
            inline: true,
          },
          {
            name: "<:_:1191202343505645690> __Ping/Latency__",
            value: ping,
            inline: true,
          },
          {
            name: "<:_:1115832874143322122> __Usage__",
            value: clientstats,
            inline: true,
          },
          {
            name: "<:_:1115831076993110067> __Command/Profile__",
            value: commandstats,
            inline: true,
          },
          {
            name: "<:_:1112602480128299079> __Versions__",
            value: botversion,
            inline: true,
          },
          {
            name: "<:_:1108417509624926228> __Uptime__",
            value: up,
            inline: true,
          },
          {
            name: "<:_:1255012892206567476> __Shard/Cluster__",
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
