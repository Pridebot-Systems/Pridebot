const { EmbedBuilder } = require("discord.js");
const { sendLog } = require("../../config/logging/sendlogs");

module.exports = async (client, guild) => {
  if (!guild.available) return;

  const name = guild.name || "undefined";
  const serverID = guild.id || "undefined";
  const memberCount = guild.memberCount || "undefined";
  const ownerID = guild.ownerId || "undefined";
  const results = await client.cluster.broadcastEval((c) => {
    return {
      guildCount: c.guilds.cache.size,
      userCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    };
  });

  const currentGuildCount = results.reduce((acc, r) => acc + r.guildCount, 0);
  const totalUserCount = results.reduce((acc, r) => acc + r.userCount, 0);

  const embed = new EmbedBuilder()
    .setColor("FF00EA")
    .setTitle(`❌ Left Server`)
    .addFields(
      {
        name: "<:_:1112602480128299079> Server Info",
        value: `**Server Name:** **${name}** (\`${serverID}\`)\n**Server Owner:** <@${ownerID}> (\`${ownerID}\`) \n**Member Count:** \`${memberCount}\` \n**Server Creation:** <t:${parseInt(
          guild.createdTimestamp / 1000
        )}:R> \n**Joined:** <t:${parseInt(
          guild.joinedTimestamp / 1000
        )}:F> (<t:${parseInt(guild.joinedTimestamp / 1000)}:R>)`,
      },
      {
        name: "<:_:1112602480128299079> Bot Info",
        value: `**Total # of guild:** \`${currentGuildCount}\` \n**Total user count**: \`${totalUserCount}\``,
      }
    )
    .setTimestamp()
    .setFooter({ text: `${serverID}` });

  await sendLog(client, embed, "1112590962867310602");
};
