const { CHANNELS, COLORS } = require("../../../Shared");
const { EmbedBuilder, Events } = require("discord.js");
const { sendLog } = require("../../utils/logging/sendlogs");

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    const name = guild.name;
    const serverID = guild.id;
    const memberCount = guild.memberCount;
    const ownerID = guild.ownerId;

    const results = await client.cluster.broadcastEval((c) => {
      return {
        guildCount: c.guilds.cache.size,
        userCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      };
    });

    const currentGuildCount = results.reduce((acc, r) => acc + r.guildCount, 0);
    const totalUserCount = results.reduce((acc, r) => acc + r.userCount, 0);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle("👋 New Server Joined")
      .setFields(
        {
          name: "<:_:1112602480128299079> Server Info",
          value: `**Server Name:** **${name}** (\`${serverID}\`) \n**Server Owner:** <@${ownerID}> (\`${ownerID}\`) \n**Member Count:** \`${memberCount}\`\n**Server Creation:** <t:${Math.floor(
            guild.createdTimestamp / 1000
          )}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
        },
        {
          name: "<:_:1112602480128299079> Bot Info",
          value: `**Total # of guild:** \`${currentGuildCount}\` \n**Total user count**: \`${totalUserCount}\``,
        }
      )
      .setTimestamp()
      .setFooter({ text: `${serverID}` });

    await sendLog(client, embed, CHANNELS.GUILD_LOG);
  },
};
