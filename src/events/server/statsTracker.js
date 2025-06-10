const { ChannelType } = require("discord.js");
const CommandUsage = require("../../../mongo/models/usageSchema");
const Profiles = require("../../../mongo/models/profileSchema");
const Voting = require("../../../mongo/models/votingSchema");
const {
  getRegisteredCommandsCount,
} = require("../../config/commandfunctions/registercommand");
const { getInfo } = require("discord-hybrid-sharding");

const updateChannelName = async (client) => {
  try {
    const { CLUSTER } = getInfo();
    if (CLUSTER !== 0) return; // Only run on Cluster 0

    console.log("[STATS] Starting statsTracker update");

    // Get total guild and user count from all clusters
    const results = await client.cluster.broadcastEval((c) => {
      return {
        guildCount: c.guilds.cache.size,
        userCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      };
    });

    const guildsCount = results.reduce((acc, r) => acc + r.guildCount, 0);
    const usersCount = results.reduce((acc, r) => acc + r.userCount, 0);

    let totalUsage = 0;
    try {
      const usages = await CommandUsage.find({});
      totalUsage = usages.reduce((acc, cmd) => acc + cmd.count, 0);
    } catch (err) {
      console.error("[STATS] Failed to fetch command usage:", err);
    }

    let profileAmount = 0;
    try {
      profileAmount = await Profiles.countDocuments();
    } catch (err) {
      console.error("[STATS] Failed to count profiles:", err);
    }

    let votingTotal = 0;
    try {
      const voting = await Voting.findOne();
      if (voting?.votingAmount?.OverallTotal != null) {
        votingTotal = voting.votingAmount.OverallTotal;
      }
    } catch (err) {
      console.error("[STATS] Failed to fetch voting data:", err);
    }

    let registeredCommands = 0;
    try {
      registeredCommands = await getRegisteredCommandsCount(client);
    } catch (err) {
      console.error("[STATS] Failed to fetch command count:", err);
    }

    const channels = [
      { id: "1152452882663227423", name: `Guilds: ${guildsCount}` },
      { id: "1152452919719903313", name: `Users: ${usersCount}` },
      {
        id: "1152452950132805722",
        name: `# of Commands: ${registeredCommands}`,
      },
      { id: "1221546215976603729", name: `Commands used: ${totalUsage}` },
      { id: "1246264055388438700", name: `Profiles: ${profileAmount}` },
      { id: "1261162314267230248", name: `Bot Votes: ${votingTotal}` },
    ];

    for (const entry of channels) {
      const channel = client.channels.cache.get(entry.id);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        console.warn(`[STATS] Channel ${entry.id} missing or invalid type`);
        continue;
      }

      try {
        await channel.setName(entry.name);
        console.log(`[STATS] Updated ${entry.name}`);
      } catch (err) {
        console.error(`[STATS] Failed to update ${entry.name}:`, err);
      }
    }
  } catch (err) {
    console.error("[STATS] statsTracker failed completely:", err);
  }
};

module.exports = updateChannelName;
