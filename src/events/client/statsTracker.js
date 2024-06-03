const { ChannelType } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");
const Profile = require("../../../mongo/models/profileSchema");

async function getRegisteredCommandsCount(client) {
  if (!client.application) {
    console.error("Client application is not ready.");
    return 0;
  }
  const commands = await client.application.commands.fetch();
  return commands.size;
}

const updateChannelName = async (client) => {
  const guildsCount = client.guilds.cache.size;
  const usersCount = client.guilds.cache.reduce(
    (acc, guild) => acc + guild.memberCount,
    0
  );
  const registeredCommandsCount =
    (await getRegisteredCommandsCount(client)) + 2;

  const usages = await CommandUsage.aggregate([
    {
      $group: {
        _id: null,
        totalUsage: { $sum: "$count" },
      },
    },
  ]).exec();
  const totalUsage = usages.length > 0 ? usages[0].totalUsage : 0;

  const profileAmount = await Profile.countDocuments();

  const channels = [
    {
      id: "1152452882663227423",
      name: `Guilds: ${guildsCount}`,
    },
    {
      id: "1152452919719903313",
      name: `Users: ${usersCount}`,
    },
    {
      id: "1152452950132805722",
      name: `# of Commands: ${registeredCommandsCount}`,
    },
    {
      id: "1221546215976603729",
      name: `Commands used: ${totalUsage}`,
    },
    {
      id: "1246264055388438700",
      name: `Profiles: ${profileAmount}`,
    },
  ];

  for (const entry of channels) {
    const channel = client.channels.cache.get(entry.id);
    if (channel && channel.type === ChannelType.GuildVoice) {
      await channel.setName(entry.name).catch(console.error);
    }
  }
};

module.exports = updateChannelName;
