require("dotenv").config();
const pm2 = require("pm2");
const os = require("os");
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");
const Profile = require("../../../mongo/models/profileSchema");
const { getTotalCommits } = require("../../config/commandfunctions/commit");
const {
  getRegisteredCommandsCount,
} = require("../../config/commandfunctions/registercommand");
const commandLogging = require("../../config/logging/commandlog");
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
    const botping = Math.round(interaction.client.ws.ping);

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
          if (err) {
            reject(err);
            return;
          }
          pm2.list((err, processList) => {
            if (err) {
              reject(err);
              return;
            }
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
      const approximateUserInstallCount = await getApproximateUserInstallCount(
        client
      );

      const pm2Stats = await getPm2Stats();
      const memoryUsage = `${pm2Stats.memory} MB / 16 GB`;
      const cpuUsage = `${pm2Stats.cpu}%`;

      let totalCommits = await getTotalCommits(
        "Sdriver1",
        "Pridebot",
        process.env.githubToken
      );

      let commitHundreds = totalCommits.toString().slice(-3, -2) || "0";
      let commitTens = totalCommits.toString().slice(-2, -1) || "0";
      let commitOnes = totalCommits.toString().slice(-1);

      const currentGuildCount = client.guilds.cache.size;
      let totalUserCount = 0;
      client.guilds.cache.forEach((guild) => {
        totalUserCount += guild.memberCount;
      });

      const CommandsCount = (await getRegisteredCommandsCount(client)) + 2;
      const profileAmount = await Profile.countDocuments();
      const usages = await CommandUsage.find({}).sort({ count: -1 });
      const totalUsage = usages.reduce((acc, cmd) => acc + cmd.count, 0);
      const startTimeTimestamp = `<t:${client.botStartTime}:f>`;

      const ping = `**Ping**: \`${botping}ms\` \n**Bot Latency**: \`${botLatency}ms\``;
      const up = `\n**Uptime:** \`${formatUptime(
        process.uptime()
      )}\` \n**Start Time:** ${startTimeTimestamp}`;
      const botstats = `**Servers:** \`${currentGuildCount}\` \n**Users:** \`${totalUserCount.toLocaleString()}\`\n**User Installs:** \`${approximateUserInstallCount}\``;
      const commandstats = `**Commands:** \`${CommandsCount}\` \n**Total Usage:** \`${totalUsage}\` \n**Profiles:** \`${profileAmount}\``;
      const botversion = `**Dev:** \`${commitHundreds}.${commitTens}.${commitOnes}\` \n **Node.js:** \`${process.version}\` \n **Discord.js:** \`v14.16.1\``;
      const clientstats = `**CPU:** \`${cpuUsage}\` \n**Memory:** \`${memoryUsage}\``;

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
