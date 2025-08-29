const { EmbedBuilder } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");
const { sendLog } = require("./sendlogs");
const { v4: uuidv4 } = require("uuid");

const commandLogging = async (client, interaction) => {
  console.log(
    "commandLogging called for",
    interaction.commandName,
    interaction.id
  );

  const estDate = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });

  const usageData = await CommandUsage.findOne({
    commandName: interaction.commandName,
  });

  const allUsages = await CommandUsage.find({});
  const totalUsage = allUsages.reduce((acc, cmd) => acc + cmd.count, 0);

  let location;
  if (interaction.guild) {
    location = `${interaction.guild.name} (${interaction.guild.id})`;
  } else {
    location = "User Install Context (External Server)";
  }

  const uuid = uuidv4();

  const logEmbed = new EmbedBuilder()
    .setTitle("Command Used")
    .setDescription(
      `**Command:** /${interaction.commandName}\n**Command Count:** ${
        usageData ? usageData.count : 0
      }
        \n**Total Usage:** ${totalUsage}\n\n**Location:** ${location}\n**User:** <@${
        interaction.user.id
      }> (${interaction.user.id})\n**Time:** ${estDate} (EST)`
    )
    .setColor(0xff00ea)
    .addFields({ name: "Debug UUID", value: uuid })
    .setFooter({ text: `User: ${interaction.user.id} | UUID: ${uuid}` })
    .setTimestamp();

  console.log(`[COMMANDLOG] Logging embed with UUID: ${uuid}`);
  await sendLog(client, logEmbed, "1256810888694861914");
};

module.exports = commandLogging;
