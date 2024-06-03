const {ActivityType} = require("discord.js");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        const updatePresence = async () => {
            const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            /*
            await client.user.setPresence({
              status: "online",
              activities: [
                {
                  type: ActivityType.Watching,
                  name: `over ${formattedTotalUserCount} LGBTQIA+ members`,
                },
              ],
            });
            */
            await client.user.setPresence({
                status: "online",
                activities: [
                    {
                        type: ActivityType.Playing,
                        name: `Happy Pride Month to my ${userCount.toLocaleString()} LGBTQIA+ users!`,
                    },
                ],
            });
        };

        await updatePresence();
        setInterval(updatePresence, 300_000);
    },
};
