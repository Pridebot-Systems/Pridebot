const LOGGING_GUILD_ID = "1101740375342845952"; // The guild/server that owns your log channel

async function sendLog(client, message, channelId) {
  await client.cluster
    .broadcastEval(
      async (c, { message, channelId, guildId }) => {
        if (!c.guilds.cache.has(guildId)) return false;
        const { EmbedBuilder } = require("discord.js");
        let channel = await c.channels.fetch(channelId).catch(() => null);
        if (!channel) return false;

        const content =
          typeof message === "string"
            ? { content: message }
            : { embeds: [EmbedBuilder.from(message)] };
        await channel.send(content);
        return c.cluster?.id;
      },
      {
        context: {
          message: typeof message === "string" ? message : message.toJSON(),
          channelId,
          guildId: LOGGING_GUILD_ID,
        },
      }
    )
    .then((results) => {
      console.log("Cluster that sent log:", results.filter(Boolean));
    });
}

module.exports = { sendLog };
