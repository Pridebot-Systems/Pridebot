const fs = require("fs/promises");
const path = require("path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const {
  Profile,
  IDLists,
  UserCommandUsage,
  Voting,
  DarList,
  AvatarGeneration,
  Blacklist,
  Feedback,
  PanVsPot,
  ProfileFeedback,
} = require("../../../DB");
const { GUILDS, COLORS } = require("../../../Shared");
const { PFPS_DIR, PROFILE_PFPS_DIR } = require("../../../Shared/paths");

/**
 * /datarequest — dev-only, registered in the logging guild only (see `guildIds`
 * below and handleCommands.js). Look up everything Pridebot stores for a user ID,
 * toggle the categories to remove, confirm, delete.
 *
 * Not covered: messages already posted to Discord log channels (command logs,
 * dar logs, profile logs) and transient Redis avatar-queue jobs.
 */

const SESSION_IDLE_MS = 10 * 60 * 1000;
// Keeps a full 10-category embed under Discord's 6000-char limit.
const SUMMARY_MAX = 350;
const PROFILE_SUMMARY_MAX = 900;

// Lists that hold staff membership rather than user data; never touched here.
const PROTECTED_ID_LISTS = new Set(["devs"]);

const DAR_LISTS = Object.keys(DarList.schema.paths).filter((p) => !p.startsWith("_"));
const BADGE_LISTS = Object.keys(IDLists.schema.paths).filter(
  (p) => !p.startsWith("_") && !PROTECTED_ID_LISTS.has(p)
);

// Never preselected by an "All Data" request: removing it unbans the user.
const MANUAL_ONLY = new Set(["blacklist"]);

// What /feedback's data_delete options map to here.
const REQUEST_TYPE_MAP = {
  profile: ["profile"],
  avatars: ["avatars"],
  command_logs: ["commandUsage"],
};

const ts = (date, style = "d") => (date ? `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>` : "unknown");
const clip = (str, max) => (str.length > max ? `${str.slice(0, max - 1)}…` : str);
const fmtBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

async function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      files += 1;
      bytes += (await fs.stat(path.join(dir, entry.name))).size;
    }
    return { files, bytes };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function profilePfpFiles(userId) {
  try {
    const files = await fs.readdir(PROFILE_PFPS_DIR);
    return files.filter((f) => path.parse(f).name === userId).map((f) => path.join(PROFILE_PFPS_DIR, f));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

/**
 * avatarProcessor.saveAvatar also writes a copy under data/pfps/<username>.
 * Digits-only names are skipped: those folders are other users' ID folders.
 */
function usernameDirs(usernames, userId) {
  const dirs = [];
  for (const raw of usernames) {
    const name = String(raw || "").toLowerCase();
    if (!name || name === userId || /^\d+$/.test(name)) continue;
    if (name.includes("/") || name.includes("\\") || name === "." || name === "..") continue;
    dirs.push(path.join(PFPS_DIR, name));
  }
  return [...new Set(dirs)];
}

const CATEGORIES = [
  {
    key: "profile",
    label: "Profile",
    emoji: "👤",
    async collect({ userId }) {
      const doc = await Profile.findOne({ userId }).lean();
      const files = await profilePfpFiles(userId);
      if (!doc && !files.length) return null;
      const lines = [];
      if (doc) {
        const fields = {
          Username: doc.username,
          "Preferred name": doc.preferredName,
          Age: doc.age,
          Sexuality: doc.otherSexuality || doc.sexuality,
          Romantic: doc.romanticOrientation,
          Gender: doc.otherGender || doc.gender,
          Pronouns: doc.otherPronouns || doc.pronouns,
          "Pronoun page": doc.pronounpage,
          Color: doc.color,
          Bio: doc.bio && clip(doc.bio.replace(/\s+/g, " "), 80),
        };
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined && v !== null && v !== "") lines.push(`**${k}:** ${v}`);
        }
        if (doc.premiumTier) lines.push(`**Premium:** ${doc.premiumTier} since ${ts(doc.premiumSince)}`);
        const extras = [
          doc.customWebsites?.length && `${doc.customWebsites.length} website(s)`,
          doc.customAvatars?.length && `${doc.customAvatars.length} custom avatar(s)`,
          doc.darHistory?.length && `${doc.darHistory.length} dar history entr(ies)`,
          doc.darFixedValues && Object.keys(doc.darFixedValues).length && "fixed dar values",
        ].filter(Boolean);
        if (extras.length) lines.push(`**Also:** ${extras.join(", ")}`);
        lines.push(`**Created:** ${ts(doc.createdAt)} · **Updated:** ${ts(doc.updatedAt)}`);
      }
      if (files.length) lines.push(`**Uploaded pfp file(s):** ${files.map((f) => path.basename(f)).join(", ")}`);
      if (doc?.premiumMember) lines.push("⚠️ Active premium — deleting the profile removes their premium settings.");
      return { summary: lines.join("\n"), files };
    },
    async remove({ userId }, data) {
      const { deletedCount } = await Profile.deleteOne({ userId });
      for (const file of data.files) await fs.rm(file, { force: true });
      return `profile doc ${deletedCount ? "deleted" : "not found"}, ${data.files.length} pfp file(s) removed`;
    },
  },
  {
    key: "avatars",
    label: "Avatars",
    emoji: "🖼️",
    async collect({ userId, usernames }) {
      const genCount = await AvatarGeneration.countDocuments({ userID: userId });
      const genNames = await AvatarGeneration.distinct("username", { userID: userId });
      const candidates = [path.join(PFPS_DIR, userId), ...usernameDirs([...usernames, ...genNames], userId)];
      const dirs = [];
      for (const dir of candidates) {
        const stats = await dirStats(dir);
        if (stats) dirs.push({ dir, ...stats });
      }
      if (!dirs.length && !genCount) return null;
      const lines = dirs.map(
        (d) => `\`pfps/${path.basename(d.dir)}\` — ${d.files} file(s), ${fmtBytes(d.bytes)}`
      );
      if (genCount) lines.push(`**Generation logs:** ${genCount} (auto-expire after 30 days)`);
      return { summary: lines.join("\n"), dirs: dirs.map((d) => d.dir) };
    },
    async remove({ userId }, data) {
      for (const dir of data.dirs) await fs.rm(dir, { recursive: true, force: true });
      const { deletedCount } = await AvatarGeneration.deleteMany({ userID: userId });
      return `${data.dirs.length} folder(s) removed, ${deletedCount} generation log(s) deleted`;
    },
  },
  {
    key: "commandUsage",
    label: "Command usage",
    emoji: "📊",
    async collect({ userId }) {
      const docs = await UserCommandUsage.find({ userId }).lean();
      if (!docs.length) return null;
      const counts = new Map();
      for (const doc of docs) {
        for (const c of doc.commandsUsed || []) {
          counts.set(c.commandName, (counts.get(c.commandName) || 0) + (c.usageCount || 0));
        }
      }
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, n]) => `\`${name}\` ×${n}`)
        .join(", ");
      const first = docs.map((d) => d.createdAt).filter(Boolean).sort()[0];
      return {
        summary:
          `**${total}** uses across **${counts.size}** commands, first seen ${ts(first)}\n` +
          (top ? `**Top:** ${top}\n` : "") +
          `**Prompts shown:** feedback ${docs.some((d) => d.feedbackPromptShown) ? "yes" : "no"}, ` +
          `premium ${docs.flatMap((d) => d.premiumPromptsShown || []).length}`,
      };
    },
    async remove({ userId }) {
      const { deletedCount } = await UserCommandUsage.deleteMany({ userId });
      return `${deletedCount} usage doc(s) deleted`;
    },
  },
  {
    key: "feedback",
    label: "Feedback",
    emoji: "💬",
    async collect({ userId }) {
      const docs = await Feedback.find({ userId }).sort({ createdAt: -1 }).lean();
      if (!docs.length) return null;
      const lines = [`**${docs.length}** submission(s)`];
      for (const doc of docs.slice(0, 4)) {
        const text = clip(doc.feedback.replace(/\s+/g, " "), 70);
        lines.push(`${ts(doc.createdAt)} \`${doc.category}\` (${doc.status}) — ${text}`);
      }
      if (docs.length > 4) lines.push(`…and ${docs.length - 4} more`);
      return { summary: lines.join("\n") };
    },
    async remove({ userId }) {
      const { deletedCount } = await Feedback.deleteMany({ userId });
      return `${deletedCount} feedback doc(s) deleted (includes their deletion request records)`;
    },
  },
  {
    key: "survey",
    label: "Profile survey",
    emoji: "📝",
    async collect({ userId }) {
      const doc = await ProfileFeedback.findOne({ userId }).lean();
      if (!doc) return null;
      const answers = Object.entries(doc.answers || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `**${k}:** ${clip(String(v).replace(/\s+/g, " "), 80)}`);
      return {
        summary:
          `Shown ${doc.surveyShown ? ts(doc.surveyShownAt) : "no"} · accepted ${doc.acceptedSurvey ?? "n/a"} · ` +
          `completed ${doc.surveyCompleted ? "yes" : "no"}` +
          (answers.length ? `\n${answers.join("\n")}` : ""),
      };
    },
    async remove({ userId }) {
      const { deletedCount } = await ProfileFeedback.deleteMany({ userId });
      return `${deletedCount} survey doc(s) deleted`;
    },
  },
  {
    key: "votes",
    label: "Votes",
    emoji: "🗳️",
    async collect({ userId }) {
      const doc = await Voting.findOne({ "votingUsers.userId": userId }, { "votingUsers.$": 1 }).lean();
      const entry = doc?.votingUsers?.[0];
      if (!entry) return null;
      return {
        summary:
          `**${entry.overallUserVotes}** total — Top.gg ${entry.votingTopGG}, Wumpus ${entry.votingWumpus}, ` +
          `BotList ${entry.votingBotList}, Discords ${entry.votingDiscords}, DiscordListGG ${entry.votingDiscordListGG}\n` +
          "Site totals are aggregate and stay unchanged.",
      };
    },
    async remove({ userId }) {
      const { modifiedCount } = await Voting.updateMany({}, { $pull: { votingUsers: { userId } } });
      return `voter entry removed from ${modifiedCount} doc(s)`;
    },
  },
  {
    key: "poll",
    label: "Pots vs pans",
    emoji: "🍳",
    async collect({ userId }) {
      const docs = await PanVsPot.find({ "voters.userId": userId }, { "voters.$": 1 }).lean();
      if (!docs.length) return null;
      return {
        summary: `Voted **${docs[0].voters[0].choice}**`,
        votes: docs.map((d) => ({ _id: d._id, choice: d.voters[0].choice })),
      };
    },
    async remove({ userId }, data) {
      // Take the vote back out of the tally too, so the poll stays consistent.
      for (const { _id, choice } of data.votes) {
        await PanVsPot.updateOne(
          { _id, "voters.userId": userId },
          { $pull: { voters: { userId } }, $inc: { [choice]: -1 } }
        );
      }
      return `vote removed and tally adjusted`;
    },
  },
  {
    key: "dar",
    label: "Fixed dar values",
    emoji: "📡",
    async collect({ userId }) {
      const docs = await DarList.find().lean();
      const hits = [];
      for (const doc of docs) {
        for (const list of DAR_LISTS) {
          const entry = (doc[list] || []).find((e) => e.userid === userId);
          if (entry) hits.push(`${list}: ${entry.meter}`);
        }
      }
      if (!hits.length) return null;
      return { summary: hits.join(" · ") };
    },
    async remove({ userId }) {
      const pull = Object.fromEntries(DAR_LISTS.map((list) => [list, { userid: userId }]));
      await DarList.updateMany({}, { $pull: pull });
      return "removed from all dar lists";
    },
  },
  {
    key: "badges",
    label: "Badge lists",
    emoji: "🏅",
    async collect({ userId }) {
      const docs = await IDLists.find().lean();
      const lists = [...new Set(docs.flatMap((doc) => BADGE_LISTS.filter((l) => doc[l]?.includes(userId))))];
      if (!lists.length) return null;
      return {
        summary:
          `Member of: ${lists.map((l) => `\`${l}\``).join(", ")}` +
          (lists.some((l) => l === "donor" || l === "donorplus")
            ? "\n⚠️ donor lists are re-synced by Patreon if they're still a patron."
            : ""),
      };
    },
    async remove({ userId }) {
      const pull = Object.fromEntries(BADGE_LISTS.map((list) => [list, userId]));
      await IDLists.updateMany({}, { $pull: pull });
      return "removed from badge lists";
    },
  },
  {
    key: "blacklist",
    label: "Blacklist",
    emoji: "⛔",
    async collect({ userId }) {
      const doc = await Blacklist.findOne({ blacklistUserIDs: userId }).lean();
      if (!doc) return null;
      return {
        summary:
          "User ID is on the blacklist.\n⚠️ Removing it unbans them. Keeping it is usually justified for abuse prevention.",
      };
    },
    async remove({ userId }) {
      await Blacklist.updateMany({}, { $pull: { blacklistUserIDs: userId } });
      return "removed from blacklist";
    },
  },
];

async function collectSnapshot(userId, client) {
  const user = await client.users.fetch(userId).catch(() => null);
  const profile = await Profile.findOne({ userId }, { username: 1 }).lean();
  const usernames = [user?.username, profile?.username].filter(Boolean);
  const ctx = { userId, usernames };

  const found = new Map();
  for (const cat of CATEGORIES) {
    const data = await cat.collect(ctx);
    if (data) found.set(cat.key, data);
  }

  const [request] = await Feedback.find({ userId, category: "data_delete", status: "pending" })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();
  const idLists = await IDLists.findOne({ devs: userId }, { _id: 1 }).lean();

  return { ctx, user, found, request, isDev: Boolean(idLists) };
}

function requestedKeys(snapshot) {
  const types = snapshot.request?.metadata?.dataTypes || [];
  const keys = types.includes("all_data")
    ? [...snapshot.found.keys()].filter((k) => !MANUAL_ONLY.has(k))
    : types.flatMap((t) => REQUEST_TYPE_MAP[t] || []);
  return keys.filter((k) => snapshot.found.has(k));
}

function renderBrowse(state) {
  const { snapshot, selected, lastResults } = state;
  const { ctx, user, found, request, isDev } = snapshot;
  const name = user ? `${user.username}` : "unknown user";

  const desc = [`**User:** <@${ctx.userId}> · \`${ctx.userId}\``];
  if (isDev) desc.push("🛠️ This user is a Pridebot dev (dev list is never modified here).");
  if (request) {
    const types = request.metadata?.dataTypes?.join(", ") || "unspecified";
    const reason = clip(request.metadata?.deletionReason || "No reason provided", 150);
    desc.push(`📨 **Pending deletion request** ${ts(request.createdAt, "R")} — **${types}**\n> ${reason}`);
  }
  if (!found.size) desc.push("\n✅ **No stored data found for this user.**");

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🗂️ Data request — ${name}`)
    .setDescription(desc.join("\n"));

  if (lastResults) {
    embed.addFields({ name: "Last deletion", value: clip(lastResults.join("\n"), 500) });
  }

  for (const cat of CATEGORIES) {
    const data = found.get(cat.key);
    if (!data) continue;
    const mark = selected.has(cat.key) ? " — 🗑️ selected" : "";
    const max = cat.key === "profile" ? PROFILE_SUMMARY_MAX : SUMMARY_MAX;
    embed.addFields({ name: `${cat.emoji} ${cat.label}${mark}`, value: clip(data.summary, max) });
  }

  const empty = CATEGORIES.filter((c) => !found.has(c.key)).map((c) => c.label);
  if (empty.length && found.size) embed.addFields({ name: "No data in", value: empty.join(", ") });
  embed.setFooter({ text: "Toggle categories, then Delete selected. Log-channel messages are not covered." });

  const toggles = CATEGORIES.filter((c) => found.has(c.key)).map((c) =>
    new ButtonBuilder()
      .setCustomId(`datareq:toggle:${c.key}`)
      .setLabel(c.label)
      .setEmoji(c.emoji)
      .setStyle(selected.has(c.key) ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );
  const rows = [];
  for (let i = 0; i < toggles.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(toggles.slice(i, i + 5)));
  }

  const actions = [];
  if (found.size) {
    const allSelected = selected.size === found.size;
    actions.push(
      new ButtonBuilder()
        .setCustomId("datareq:delete")
        .setLabel(`Delete selected (${selected.size})`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(selected.size === 0),
      new ButtonBuilder()
        .setCustomId(allSelected ? "datareq:none" : "datareq:all")
        .setLabel(allSelected ? "Clear selection" : "Select all")
        .setStyle(ButtonStyle.Secondary)
    );
  } else if (request) {
    actions.push(
      new ButtonBuilder()
        .setCustomId("datareq:resolve")
        .setLabel("Mark request handled")
        .setStyle(ButtonStyle.Success)
    );
  }
  actions.push(
    new ButtonBuilder().setCustomId("datareq:refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("datareq:close").setLabel("Close").setStyle(ButtonStyle.Secondary)
  );
  rows.push(new ActionRowBuilder().addComponents(actions));

  return { embeds: [embed], components: rows };
}

function renderConfirm(state) {
  const { snapshot, selected } = state;
  const list = CATEGORIES.filter((c) => selected.has(c.key)).map((c) => `${c.emoji} **${c.label}**`);
  const embed = new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle("⚠️ Confirm permanent deletion")
    .setDescription(
      `Delete the following for <@${snapshot.ctx.userId}> (\`${snapshot.ctx.userId}\`)?\n\n` +
        `${list.join("\n")}\n\n**This cannot be undone.**`
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("datareq:confirm").setLabel("Confirm delete").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("datareq:back").setLabel("Back").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

async function markRequestsHandled(userId, dev, note) {
  await Feedback.updateMany(
    { userId, category: "data_delete", status: "pending" },
    { $set: { status: "implemented", adminNotes: `${note} — by ${dev.username} (${dev.id}) on ${new Date().toISOString()}` } }
  );
}

async function runDeletion(state, dev) {
  const { snapshot, selected } = state;
  const results = [];
  const done = [];
  for (const cat of CATEGORIES) {
    if (!selected.has(cat.key)) continue;
    try {
      const msg = await cat.remove(snapshot.ctx, snapshot.found.get(cat.key));
      results.push(`✅ ${cat.label}: ${msg}`);
      done.push(cat.key);
    } catch (err) {
      console.error(`[DATAREQUEST] ${cat.key} deletion failed for ${snapshot.ctx.userId}:`, err);
      results.push(`❌ ${cat.label}: ${err.message}`);
    }
  }
  console.log(
    `[DATAREQUEST] ${dev.username} (${dev.id}) deleted [${done.join(", ")}] for user ${snapshot.ctx.userId}`
  );
  if (done.length) {
    // No-op when Feedback itself was deleted.
    await markRequestsHandled(snapshot.ctx.userId, dev, `Deleted: ${done.join(", ")}`);
  }
  return results;
}

module.exports = {
  // Registered as a guild command in the logging/dev server only.
  guildIds: [GUILDS.LOGGING],
  data: new SlashCommandBuilder()
    .setName("datarequest")
    .setDescription("Dev: view and delete everything Pridebot stores about a user")
    .addStringOption((option) =>
      option.setName("user_id").setDescription("Discord user ID (or mention)").setRequired(true)
    ),

  async execute(interaction, client) {
    const idLists = await IDLists.findOne();
    if (interaction.guildId !== GUILDS.LOGGING || !idLists?.devs.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.options.getString("user_id").replace(/[<@!>\s]/g, "");
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: "That isn't a valid user ID.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const state = { snapshot: await collectSnapshot(userId, client), selected: new Set(), lastResults: null };
    for (const key of requestedKeys(state.snapshot)) state.selected.add(key);

    const message = await interaction.editReply(renderBrowse(state));
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith("datareq:"),
      idle: SESSION_IDLE_MS,
    });

    // Component tokens last 15 minutes, so the most recent one can still edit
    // the message when the idle timer fires — the slash command's may not.
    let last = interaction;

    collector.on("collect", async (i) => {
      last = i;
      const [, action, key] = i.customId.split(":");
      try {
        switch (action) {
          case "toggle":
            if (state.selected.has(key)) state.selected.delete(key);
            else if (state.snapshot.found.has(key)) state.selected.add(key);
            return await i.update(renderBrowse(state));
          case "all":
            state.selected = new Set(state.snapshot.found.keys());
            return await i.update(renderBrowse(state));
          case "none":
            state.selected.clear();
            return await i.update(renderBrowse(state));
          case "delete":
            if (!state.selected.size) return await i.update(renderBrowse(state));
            return await i.update(renderConfirm(state));
          case "back":
            return await i.update(renderBrowse(state));
          case "confirm": {
            await i.update({
              embeds: [new EmbedBuilder().setColor(COLORS.WARNING).setTitle("🗑️ Deleting…")],
              components: [],
            });
            state.lastResults = await runDeletion(state, interaction.user);
            state.snapshot = await collectSnapshot(userId, client);
            state.selected.clear();
            return await i.editReply(renderBrowse(state));
          }
          case "resolve":
            await markRequestsHandled(userId, interaction.user, "No stored data found");
            state.snapshot = await collectSnapshot(userId, client);
            return await i.update(renderBrowse(state));
          case "refresh":
            await i.deferUpdate();
            state.snapshot = await collectSnapshot(userId, client);
            for (const k of [...state.selected]) if (!state.snapshot.found.has(k)) state.selected.delete(k);
            return await i.editReply(renderBrowse(state));
          case "close":
            collector.stop("closed");
            return await i.update({ components: [] });
        }
      } catch (err) {
        console.error("[DATAREQUEST] Interaction failed:", err);
        const content = `❌ ${err.message}`;
        if (i.deferred || i.replied) await i.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        else await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });

    collector.on("end", (_collected, reason) => {
      if (reason === "closed") return;
      last.editReply({ components: [] }).catch(() => {});
    });
  },
};
