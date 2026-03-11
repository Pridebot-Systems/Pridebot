const { EmbedBuilder } = require("discord.js");
const { sendLog } = require("./sendlogs");
const id = require("../../../mongo/models/idSchema");

const darlogging = async (client, meterType, userName, meter, userId) => {
  const channelId = "1286437229920780371";

  let specialMessage = "";
  let embedColor = 0xff00ae;

  if (meter > 500 || meter < -500) {
    specialMessage = `<@691506668781174824> WE HAVE A WIN!`;
    embedColor = 0xffd700;
    const idLists = await id.findOne();
    if (idLists) {
      if (!idLists.easteregg.includes(userId)) {
        idLists.easteregg.push(userId);
        await idLists.save();
      }
    } else {
      const newIdLists = new id({
        easteregg: [userId],
      });
      await newIdLists.save();
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`${meterType} Meter Result`)
    .setDescription(
      `**User:** <@${userId}> (${userName})\n**Meter:** ${meter}%`,
    )
    .setColor(embedColor)
    .setTimestamp();

  if (specialMessage) {
    embed.addFields({
      name: "Special Message",
      value: specialMessage,
    });
  }
  await sendLog(client, embed, channelId);
};

module.exports = darlogging;
