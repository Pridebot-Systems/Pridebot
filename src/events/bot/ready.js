const { ActivityType } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");

const specialDays = [
  {
    month: 2,
    day: 31,
    message: "Happy International Trans Day of Visibility from Pridebot",
    activityType: ActivityType.Playing,
  },

  {
    month: 3,
    day: 1,
    message: "Happy April Fools from Pridebot",
    activityType: ActivityType.Playing,
  },
  /*
  For help in setting up future ones.
  If you like to contribute a special day, please open a issue/PR with the following format:
  {
    month: 0-11, // January is 0, December is 11
    day: 1-31,
    message: "",
    activityType: ActivityType.Playing,
  },
  */
];

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    let presenceIndex = 0;
    function getTodaySpecialDay() {
      const now = new Date();
      const month = now.getMonth();
      const day = now.getDate();

      return specialDays.find((sd) => sd.month === month && sd.day === day);
    }

    client.presenceIndex = 0;
    client.updatePresence = async () => {
      const specialDay = getTodaySpecialDay();
      if (specialDay) {
        await client.user.setPresence({
          status: "online",
          activities: [
            {
              type: specialDay.activityType,
              name: specialDay.message,
            },
          ],
        });
        return;
      }

      const guildsCount = client.guilds.cache.size;
      let totalUserCount = 0;
      client.guilds.cache.forEach((guild) => {
        totalUserCount += guild.memberCount;
      });

      const usages = await CommandUsage.find({}).sort({ count: -1 });
      const totalUsage = usages.reduce((acc, cmd) => acc + cmd.count, 0);

      const presences = [
        {
          type: ActivityType.Watching,
          name: `over ${totalUserCount} LGBTQIA+ members`,
        },
        {
          type: ActivityType.Listening,
          name: `${guildsCount} servers`,
        },
        {
          type: ActivityType.Playing,
          name: `with ${totalUsage} commands`,
        },
        {
          type: ActivityType.Playing,
          name: `Happy Pride Month! 🌈`,
        },
      ];

      await client.user.setPresence({
        status: "online",
        activities: [presences[client.presenceIndex]],
      });

      client.presenceIndex = (client.presenceIndex + 1) % presences.length;
    };

    await client.updatePresence();
    client.presenceInterval = setInterval(client.updatePresence, 15_000);
  },
};
