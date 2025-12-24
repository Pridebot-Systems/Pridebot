const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ChannelType } = require("discord.js");
const CommandUsage = require("../../mongo/models/usageSchema.js");
const ProfileData = require("../../mongo/models/profileSchema.js");
const Voting = require("../../mongo/models/votingSchema");
const { botlistauth, discordsauth } = process.env;
require("dotenv").config();
const { getInfo } = require("discord-hybrid-sharding");

const VOTE_CHANNEL_ID = "1224815141921624186";
const GITHUB_CHANNEL_ID = "1101742377372237906";
const GITHUB_GUILD_ID = "1101740375342845952";
const VOTE_COOLDOWN_HOURS = 12;
const STATS_CACHE_TTL = 2 * 60 * 1000;
const MAX_EMBED_FIELD_LENGTH = 1024;
const API_PORT = 2610;

const { getTotalCommits } = require("../config/commandfunctions/commit.js");
const {
  getRegisteredCommandsCount,
} = require("../config/commandfunctions/registercommand.js");
const { updateVotingStats } = require("../config/botfunctions/voting.js");
const {
  getApproximateUserInstallCount,
} = require("../config/botfunctions/user_install.js");

const statsCache = {
  lastUpdated: null,
  data: null,
};

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const limit = rateLimitMap.get(ip);

  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Too many requests",
      retryAfter: Math.ceil((limit.resetTime - now) / 1000),
    });
  }

  limit.count++;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

function validateWebhookAuth(authHeader, platform) {
  if (platform === "botlist" && authHeader !== botlistauth) {
    return false;
  }
  if (platform === "discords" && authHeader !== discordsauth) {
    return false;
  }
  return true;
}

async function sendEmbedToChannel(client, embed, channelId, context = "Vote") {
  if (!client.cluster || !client.cluster.ready) {
    console.warn(
      `[${context}] Cluster client not ready, attempting direct send...`
    );
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (
      channel &&
      (channel.type === ChannelType.GuildText || channel.isTextBased())
    ) {
      await channel.send({ embeds: [embed] });
      console.log(`[${context}] Embed sent directly (no clustering)`);
      return true;
    }
    console.error(`[${context}] Failed to send embed: channel not accessible`);
    return false;
  }

  const results = await client.cluster.broadcastEval(
    async (c, { channelId, embedJSON }) => {
      const { EmbedBuilder, ChannelType } = require("discord.js");
      const channel = await c.channels.fetch(channelId).catch(() => null);
      if (
        !channel ||
        (channel.type !== ChannelType.GuildText && !channel.isTextBased())
      )
        return null;
      const embed = new EmbedBuilder(embedJSON);
      await channel.send({ embeds: [embed] });
      return c.cluster?.id ?? true;
    },
    { context: { channelId, embedJSON: embed.toJSON() } }
  );

  const success = results.find((r) => r !== null);
  if (!success) {
    console.error(`[${context}] Embed send failed: no cluster had access.`);
    return false;
  }
  console.log(`[${context}] Embed sent successfully by cluster:`, success);
  return true;
}

async function sendVoteEmbed(client, embed, platform, userId, res) {
  try {
    console.log(`[${platform}] Processing vote embed for user ${userId}`);

    const success = await sendEmbedToChannel(
      client,
      embed,
      VOTE_CHANNEL_ID,
      platform
    );

    if (!success) {
      return res.status(500).json({ error: "Failed to send embed" });
    }

    res
      .status(200)
      .json({ success: true, message: "Vote processed successfully" });
  } catch (error) {
    console.error(`[${platform}] Error processing vote:`, error);

    if (error.code === "ERR_IPC_CHANNEL_CLOSED") {
      console.warn(
        `[${platform}] IPC channel closed, attempting direct send...`
      );
      try {
        const channel = await client.channels
          .fetch(VOTE_CHANNEL_ID)
          .catch(() => null);
        if (
          channel &&
          (channel.type === ChannelType.GuildText || channel.isTextBased())
        ) {
          await channel.send({ embeds: [embed] });
          console.log(`[${platform}] Embed sent directly after IPC failure`);
          return res
            .status(200)
            .json({ success: true, message: "Vote processed (recovery mode)" });
        }
      } catch (directError) {
        console.error(
          `[${platform}] Direct send also failed:`,
          directError.message
        );
      }
    }

    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
}

async function updateStatsCache(client) {
  try {
    console.log("[API] Updating stats cache...");

    if (!client.cluster || !client.cluster.ready) {
      console.warn("[API] Cluster not ready, skipping stats cache update");
      return;
    }

    const results = await client.cluster.broadcastEval((c) => ({
      guildCount: c.guilds.cache.size,
      userCount: c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    }));

    const currentGuildCount = results.reduce((acc, r) => acc + r.guildCount, 0);
    const totalUserCount = results.reduce((acc, r) => acc + r.userCount, 0);

    const ping = client.ws.ping;
    const UserInstallCount = await getApproximateUserInstallCount(client);
    const usages = await CommandUsage.find({}).sort({ count: -1 });
    const totalUsage = usages.reduce((acc, cmd) => acc + cmd.count, 0);
    const totalGuildCount = usages.reduce(
      (acc, cmd) => acc + cmd.guildCount,
      0
    );
    const totalUserContextCount = usages.reduce(
      (acc, cmd) => acc + cmd.userContextCount,
      0
    );
    const profileAmount = await ProfileData.countDocuments();
    const commandsCount = (await getRegisteredCommandsCount(client)) + 2;
    const botuptime = client.botStartTime;
    const voting = await Voting.findOne();
    const votingtotal = voting.votingAmount.OverallTotal;
    const topggtoal = voting.votingAmount.TopGGTotal;
    const wumpustotal = voting.votingAmount.WumpusTotal;
    const botlisttotal = voting.votingAmount.BotListTotal;

    statsCache.data = {
      totalUserCount,
      currentGuildCount,
      UserInstallCount,
      profileAmount,
      totalUsage,
      commandsCount,
      totalGuildCount,
      totalUserContextCount,
      botuptime,
      ping,
      vote: {
        votingtotal,
        topggtoal,
        wumpustotal,
        botlisttotal,
      },
    };
    statsCache.lastUpdated = new Date();
    console.log("[API] Stats cache updated at", statsCache.lastUpdated);
  } catch (error) {
    console.error("[API] Failed to update stats cache:", error);
  }
}

module.exports = (client) => {
  const clusterId = getInfo().CLUSTER;
  console.log(`Bot API initialization started by Cluster ${clusterId}.`);

  if (clusterId !== 0) {
    console.log(
      `Cluster ${clusterId} skipping API initialization - only cluster 0 should run APIs.`
    );
    return;
  }

  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cors());
  app.use(rateLimiter);

  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${req.ip}`);
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      cluster: clusterId,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (req, res) => {
    res.status(200).json({
      name: "Pridebot API",
      version: "1.0.0",
      cluster: clusterId,
      message: "Available API endpoints:",
      endpoints: {
        health: { path: "/health", method: "GET", description: "Health check" },
        stats: { path: "/stats", method: "GET", description: "Bot statistics" },
        serverstats: {
          path: "/serverstats",
          method: "GET",
          description: "Server statistics",
        },
        githubapi: {
          path: "/githubapi",
          method: "GET",
          description: "GitHub stats",
        },
        votes: {
          path: "/votes/:userId",
          method: "GET",
          description: "User voting statistics",
        },
        commands: {
          path: "/commands/:command_type?/:command_name?",
          method: "GET",
          description: "Command information",
        },
        webhooks: {
          topgg: {
            path: "/topgg-votes",
            method: "POST",
            description: "Top.gg vote webhook",
          },
          botlist: {
            path: "/botlist-votes",
            method: "POST",
            description: "BotList.me vote webhook (auth required)",
          },
          discords: {
            path: "/discords-votes",
            method: "POST",
            description: "Discords.com vote webhook (auth required)",
          },
          github: {
            path: "/github",
            method: "POST",
            description: "GitHub webhook",
          },
        },
      },
    });
  });

  app.get("/githubapi", (req, res) => {
    const currentGuildCount = statsCache.data.currentGuildCount || 0;
    const totalUserCount = statsCache.data.totalUserCount || 0;

    const prismaGuild = client.guilds.cache.get("921403338069770280");
    let prismatotal = 0;
    let obbytotal = 0;
    if (prismaGuild) {
      prismatotal = prismaGuild.memberCount;
    } else {
      console.error("Guild with ID 921403338069770280 not found.");
    }

    try {
      res.json({
        totalUserCount,
        currentGuildCount,
        prismatotal,
        obbytotal,
      });
    } catch (error) {
      console.error("Failed to get GitHub stats:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/stats", cors(), async (req, res) => {
    try {
      if (!statsCache.data) {
        return res.status(503).json({
          error: "Stats are not yet available.",
          retryAfter: 10,
        });
      }

      res.json({
        ...statsCache.data,
        cacheAge: statsCache.lastUpdated
          ? Date.now() - statsCache.lastUpdated.getTime()
          : null,
      });
    } catch (error) {
      console.error("[API] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/serverstats", cors(), async (req, res) => {
    const prismaGuild = client.guilds.cache.get("921403338069770280");
    let prismatotal = 0;
    if (prismaGuild) {
      prismatotal = prismaGuild.memberCount;
    } else {
      console.error("Guild with ID 921403338069770280 not found.");
    }

    const pridecordGuild = client.guilds.cache.get("1077258761443483708");
    let pridecordtotal = 0;
    if (pridecordGuild) {
      pridecordtotal = pridecordGuild.memberCount;
    } else {
      console.error("Guild with ID 1077258761443483708 not found.");
    }

    try {
      res.json({
        prismatotal,
        pridecordtotal,
      });
    } catch (error) {
      console.error("Failed to get server stats:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/votes/:userId", cors(), async (req, res) => {
    try {
      const votes = await Voting.findOne(
        { "votingUsers.userId": req.params.userId },
        { "votingUsers.$": 1 }
      );

      if (!votes || votes.votingUsers.length === 0) {
        return res.status(404).json({ message: "User has not voted yet!" });
      }

      return res.json(votes.votingUsers[0]);
    } catch (error) {
      console.error("Failed to retrieve voting stats:", error);
      return res.status(500).send("Internal Server Error");
    }
  });

  const commandsDirectory = path.join(__dirname, "..", "commands");
  app.get(
    "/commands/:command_type?/:command_name?",
    cors(),
    async (req, res) => {
      const { command_type, command_name } = req.params;

      try {
        if (!command_type) {
          const allCommandTypes = fs
            .readdirSync(commandsDirectory)
            .reduce((acc, type) => {
              const commands = fs
                .readdirSync(path.join(commandsDirectory, type))
                .map((file) => file.replace(".js", ""));
              acc[type] = {
                commands,
                count: commands.length,
              };
              return acc;
            }, {});

          return res.json(allCommandTypes);
        }

        const commandTypeDir = path.join(commandsDirectory, command_type);
        if (!command_name) {
          if (!fs.existsSync(commandTypeDir)) {
            return res.status(404).send("Command type not found");
          }

          const commands = fs
            .readdirSync(commandTypeDir)
            .map((file) => file.replace(".js", ""));
          return res.json({
            [command_type]: {
              commands,
            },
          });
        }

        const commandFile = path.join(commandTypeDir, `${command_name}.js`);
        if (!fs.existsSync(commandFile)) {
          return res.status(404).send("Command not found");
        }

        const commandModule = require(commandFile);
        const commandDescription = commandModule.data?.description || "";

        const commandUsage = await CommandUsage.findOne({
          commandName: command_name,
        });

        return res.json({
          command_name: commandUsage ? commandUsage.commandName : command_name,
          command_description: commandDescription,
          command_usage: commandUsage ? commandUsage.count : 0,
        });
      } catch (error) {
        console.error("Failed to retrieve bot commands:", error);
        return res.status(500).send("Internal Server Error");
      }
    }
  );

  app.post("/topgg-votes", async (req, res) => {
    let topgguserid = req.body.user;
    let topggbotid = req.body.bot;
    console.log(
      `[TopGG] Vote received for user ${topgguserid}, bot ${topggbotid}`
    );
    const voteCooldownHours = 12;
    const voteCooldownSeconds = voteCooldownHours * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const voteAvailableTimestamp = currentTimestamp + voteCooldownSeconds;

    client.users
      .fetch(topgguserid)
      .then(async (user) => {
        const userAvatarURL = user.displayAvatarURL();

        await updateVotingStats(topgguserid, "TopGG");

        const voting = await Voting.findOne();
        const userVoting = voting.votingUsers.find(
          (u) => u.userId === topgguserid
        );

        const embed = new EmbedBuilder()
          .setDescription(
            `**Thank you <@${topgguserid}> for voting for <@${topggbotid}> on [Top.gg](https://top.gg/bot/${topggbotid}/vote) <:_:1195866944482590731>** \nYou can vote again <t:${voteAvailableTimestamp}:R> \n\n**<@${topgguserid}> Top.gg Votes: ${userVoting.votingTopGG}** \n**Total Top.gg Votes: ${voting.votingAmount.TopGGTotal}**`
          )
          .setColor("#FF00EA")
          .setThumbnail(userAvatarURL)
          .setTimestamp();

        await sendVoteEmbed(client, embed, "TopGG", topgguserid, res);
      })
      .catch((error) => {
        console.error("Error fetching user from Discord:", error);
        res.status(500).send("Internal Server Error");
      });
  });

  app.post("/botlist-votes", async (req, res) => {
    const auth = req.header("Authorization");

    if (!auth || !validateWebhookAuth(auth, "botlist")) {
      console.warn("[BotList] Unauthorized vote attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.body.user || !req.body.bot) {
      return res
        .status(400)
        .json({ error: "Missing required fields: user, bot" });
    }

    let botlistuser = req.body.user;
    let botlistbot = req.body.bot;
    const voteCooldownHours = 12;
    const voteCooldownSeconds = voteCooldownHours * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const voteAvailableTimestamp = currentTimestamp + voteCooldownSeconds;

    client.users
      .fetch(botlistuser)
      .then(async (user) => {
        const userAvatarURL = user.displayAvatarURL();

        await updateVotingStats(botlistuser, "BotList");

        const voting = await Voting.findOne();
        const userVoting = voting.votingUsers.find(
          (u) => u.userId === botlistuser
        );

        const embed = new EmbedBuilder()
          .setDescription(
            `**Thank you <@${botlistuser}> for voting for <@${botlistbot}> on [Botlist.me](https://botlist.me/bots/${botlistbot}/vote) <:_:1227425669642719282>** \nYou can vote again <t:${voteAvailableTimestamp}:R>. \n\n**<@${botlistuser}> Botlist Votes: ${userVoting.votingBotList}** \n**Total Botlist Votes: ${voting.votingAmount.BotListTotal}**`
          )
          .setColor("#FF00EA")
          .setThumbnail(userAvatarURL)
          .setTimestamp();

        await sendVoteEmbed(client, embed, "BotList", botlistuser, res);
      })
      .catch((error) => {
        console.error("Error fetching user from Discord:", error);
        res.status(500).send("Internal Server Error");
      });
  });

  app.post("/discords-votes", async (req, res) => {
    const auth = req.header("Authorization");

    if (!auth || !validateWebhookAuth(auth, "discords")) {
      console.warn("[Discords] Unauthorized vote attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.body.user || !req.body.bot) {
      return res
        .status(400)
        .json({ error: "Missing required fields: user, bot" });
    }

    let discordsuser = req.body.user;
    let discordsbot = req.body.bot;
    const voteCooldownHours = 12;
    const voteCooldownSeconds = voteCooldownHours * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const voteAvailableTimestamp = currentTimestamp + voteCooldownSeconds;

    client.users
      .fetch(discordsuser)
      .then(async (user) => {
        const userAvatarURL = user.displayAvatarURL();

        await updateVotingStats(discordsuser, "Discords");

        const voting = await Voting.findOne();
        const userVoting = voting.votingUsers.find(
          (u) => u.userId === discordsuser
        );

        const embed = new EmbedBuilder()
          .setDescription(
            `**Thank you <@${discordsuser}> for voting for <@${discordsbot}> on [discords.com](https://discords.com/bots/bot/${discordsbot}/vote) <:_:1317259330961018930>** \nYou can vote again <t:${voteAvailableTimestamp}:R>. \n\n**<@${discordsuser}> Discords.com Votes: ${userVoting.votingDiscords}** \n**Total Discords.com Votes: ${voting.votingAmount.DiscordsTotal}**`
          )
          .setColor("#FF00EA")
          .setThumbnail(userAvatarURL)
          .setTimestamp();

        await sendVoteEmbed(client, embed, "Discords", discordsuser, res);
      })
      .catch((error) => {
        console.error("Error fetching user from Discord:", error);
        res.status(500).send("Internal Server Error");
      });
  });

  app.post(
    "/github",
    express.json({ type: "application/json" }),
    async (request, response) => {
      const githubEvent = request.headers["x-github-event"];
      const data = request.body;
      console.log(
        `[GitHub] Received ${githubEvent} webhook for ${
          data.repository?.name || "unknown repo"
        }`
      );
      let embed = new EmbedBuilder();

      const repoName = data.repository?.name;
      const ownerName = data.repository?.owner?.login;

      let totalCommits = 0;
      if (repoName && ownerName) {
        totalCommits = await getTotalCommits(
          ownerName,
          repoName,
          process.env.githubToken
        );
      }

      let commitHundreds = totalCommits.toString().slice(-3, -2) || "0";
      let commitTens = totalCommits.toString().slice(-2, -1) || "0";
      let commitOnes = totalCommits.toString().slice(-1);

      if (
        githubEvent === "push" &&
        Array.isArray(data.commits) &&
        data.commits.some((c) => c.message === "Update README [skip ci]")
      ) {
        console.log("Skipping README update");
        return;
      } else if (githubEvent === "push") {
        const commitCount = data.commits.length;
        const commitStrings = data.commits.map(
          (commit) =>
            `[\`${commit.id.slice(0, 7)}\`](${commit.url}) - **${
              commit.message
            }**`
        );

        const viewMoreLink = `\n[View more on GitHub](https://github.com/${ownerName}/${repoName}/commits/main/)`;
        let commitMessages = commitStrings.join("\n");

        if (commitMessages.length + viewMoreLink.length > 1024) {
          while (
            commitStrings.length > 0 &&
            commitStrings.join("\n").length + viewMoreLink.length > 1024
          ) {
            commitStrings.pop();
          }
          commitMessages = commitStrings.join("\n") + viewMoreLink;
        }

        const title = `${commitCount} New ${repoName} ${
          commitCount > 1 ? "Commits" : "Commit"
        } (# ${commitHundreds}${commitTens}${commitOnes})`;
        const fieldname = `${commitCount > 1 ? "Commits" : "Commit"}`;

        embed
          .setColor("#FF00EA")
          .setAuthor({
            name: `${data.sender.login}`,
            iconURL: `${data.sender.avatar_url}`,
            url: `${data.sender.html_url}`,
          })
          .setTitle(title)
          .setTimestamp()
          .addFields({ name: fieldname, value: commitMessages });
      } else if (githubEvent === "star" && data.action === "created") {
        embed
          .setColor("#FF00EA")
          .setDescription(
            `## :star: New Star \n**Thank you [${data.sender.login}](https://github.com/${data.sender.login}) for starring [${repoName}](https://github.com/${ownerName}/${repoName})**`
          )
          .setTimestamp();
      } else if (githubEvent === "star" && data.action === "deleted") {
        embed
          .setColor("#FF00EA")
          .setDescription(
            `## :star: Star Removed \n**[${data.sender.login}](https://github.com/${data.sender.login}) removed their star from [${repoName}](https://github.com/${ownerName}/${repoName}) ;-;**`
          )
          .setTimestamp();
      } else if (githubEvent === "pull_request" && data.action === "opened") {
        const pr = data.pull_request;
        embed
          .setColor("#FF00EA")
          .setAuthor({
            name: `${data.sender.login}`,
            iconURL: `${data.sender.avatar_url}`,
            url: `${data.sender.html_url}`,
          })
          .setTitle(`New Pull Request: #${pr.number} - ${pr.title}`)
          .setURL(pr.html_url)
          .setDescription(pr.body || "No description provided")
          .addFields(
            {
              name: "Branch",
              value: `${pr.head.ref} → ${pr.base.ref}`,
              inline: true,
            },
            { name: "Commits", value: `${pr.commits}`, inline: true },
            {
              name: "Changed Files",
              value: `${pr.changed_files}`,
              inline: true,
            }
          )
          .setTimestamp();
      } else if (githubEvent === "pull_request" && data.action === "closed") {
        const pr = data.pull_request;
        const wasMerged = pr.merged;
        embed
          .setColor("#FF00EA")
          .setAuthor({
            name: `${data.sender.login}`,
            iconURL: `${data.sender.avatar_url}`,
            url: `${data.sender.html_url}`,
          })
          .setTitle(
            `Pull Request ${wasMerged ? "Merged" : "Closed"}: #${pr.number} - ${
              pr.title
            }`
          )
          .setURL(pr.html_url)
          .addFields(
            {
              name: "Branch",
              value: `${pr.head.ref} → ${pr.base.ref}`,
              inline: true,
            },
            {
              name: "Status",
              value: wasMerged ? "✅ Merged" : "❌ Closed",
              inline: true,
            }
          )
          .setTimestamp();
      } else if (githubEvent === "issues" && data.action === "opened") {
        const issue = data.issue;
        embed
          .setColor("#FF00EA")
          .setAuthor({
            name: `${data.sender.login}`,
            iconURL: `${data.sender.avatar_url}`,
            url: `${data.sender.html_url}`,
          })
          .setTitle(`New Issue: #${issue.number} - ${issue.title}`)
          .setURL(issue.html_url)
          .setDescription(issue.body || "No description provided")
          .setTimestamp();
      } else if (githubEvent === "issues" && data.action === "closed") {
        const issue = data.issue;
        embed
          .setColor("#FF00EA")
          .setAuthor({
            name: `${data.sender.login}`,
            iconURL: `${data.sender.avatar_url}`,
            url: `${data.sender.html_url}`,
          })
          .setTitle(`Issue Closed: #${issue.number} - ${issue.title}`)
          .setURL(issue.html_url)
          .setTimestamp();
      } else {
        console.log(`[GitHub] Unhandled event type: ${githubEvent}`);
        return;
      }

      try {
        console.log(`[GitHub] Processing ${githubEvent} event for ${repoName}`);

        // Check if cluster client is available
        if (!client.cluster || !client.cluster.ready) {
          console.warn(
            "[GitHub] Cluster client not ready, attempting direct send..."
          );
          const channel = await client.channels
            .fetch("1101742377372237906")
            .catch(() => null);
          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
            console.log("[GitHub] Embed sent directly (no clustering)");
          } else {
            console.error(
              "[GitHub] Failed to send embed: channel not accessible"
            );
          }
          response.sendStatus(200);
          return;
        }

        const success = await sendEmbedToChannel(
          client,
          embed,
          GITHUB_CHANNEL_ID,
          "GitHub"
        );
        if (!success) {
          console.error("[GitHub] Failed to send embed to channel");
        }
      } catch (error) {
        console.error("[GitHub] Error processing webhook:", error);
      }
      response.sendStatus(200);
    }
  );

  // Global error handler (must be last)
  app.use((err, req, res, next) => {
    console.error("[API] Unhandled error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      path: req.path,
      message: "Endpoint does not exist. Visit / for available endpoints.",
    });
  });

  // Start server
  const server = app.listen(API_PORT, () => {
    console.log(
      `✅ Bot API running on port ${API_PORT} (Cluster ${clusterId})`
    );
  });

  server.on("error", (error) => {
    console.error("❌ Failed to start Bot API:", error);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[API] SIGTERM received, closing server...");
    server.close(() => {
      console.log("[API] Server closed");
    });
  });

  // Initialize stats cache
  updateStatsCache(client);
  setInterval(() => updateStatsCache(client), STATS_CACHE_TTL);

  console.log(
    `[API] Stats cache will update every ${STATS_CACHE_TTL / 1000} seconds`
  );
};
