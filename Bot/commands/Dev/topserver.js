const { EmbedBuilder } = require("discord.js");

async function topServerCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (message.content.startsWith(mention)) {
    const args = message.content.slice(mention.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === "topserver") {
      // Gather all guild data from every shard
      const allGuilds = await client.cluster.broadcastEval((c) => {
        return c.guilds.cache.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        }));
      });

      // Flatten and sort all guilds
      const sorted = allGuilds
        .flat()
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 10);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle("Top 10 Servers by User Count (All Shards)")
        .setColor("Blue")
        .setTimestamp();

      // Fetch owners and fill embed fields
      for (const [i, g] of sorted.entries()) {
        const guild = await client.guilds.fetch(g.id).catch(() => null);
        const owner = guild ? await guild.fetchOwner().catch(() => null) : null;

        embed.addFields({
          name: `#${i + 1}: ${g.name}`,
          value: `**Users:** ${g.memberCount}\n**Server ID:** ${
            g.id
          }\n**Owner:** ${owner?.user?.tag || "Unknown"}`,
          inline: false,
        });
      }

      await message.channel.send({ embeds: [embed] });
      setTimeout(() => {
        message.delete().catch(() => {});
      }, 3000);
    }
  }
}

module.exports = { topServerCommand };
