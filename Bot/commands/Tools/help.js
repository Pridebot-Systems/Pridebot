const path = require("path");
const {
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { OWNER_ID, LINKS } = require("../../../Shared");
const { COMMANDS_DIR } = require("../../../Shared/paths");
const { listJsFiles } = require("../../functions/handlers/listFiles");
const { version } = require("../../../package.json");
const commandLogging = require("../../utils/logging/commandlog");
const safeCollect = require("../../utils/safeCollect");

const ACCENT = 0xff00ae;
const MENU_LIFETIME = 10 * 60 * 1000;
const ID_CACHE_TTL = 60 * 60 * 1000;
const ID_RETRY_TTL = 5 * 60 * 1000;

const HIDDEN_FOLDERS = new Set(["Dev"]);
const APPS = "apps";

const CATEGORIES = [
  {
    key: "Avatar",
    emoji: "1113295174701940776",
    blurb: "Add pride flags to your avatar",
    note: `**Quick access:** all your avatars live at **https://pfp.pridebot.xyz/your_user_id**\n-# Replace "your_user_id" with your Discord user ID`,
  },
  {
    key: "Fun",
    emoji: "1196254858689380474",
    blurb: "Radars, name and pronoun testers, and matchmaking",
    note: "-# Radar commands are just for fun and aren't based on any real reading of users.",
  },
  {
    key: "Pride",
    emoji: "1108822823721521242",
    blurb: "Identities, events, and their history",
  },
  {
    key: "Profile",
    emoji: "1197388214843998299",
    blurb: "Set up and share your Pridebot profile",
  },
  {
    key: "Support",
    emoji: "1197399653109473301",
    blurb: "Coming out, mental health, and trans resources",
  },
  {
    key: "Terms",
    emoji: "1112602480128299079",
    blurb: "Genders, sexualities, pronouns, and more",
  },
  {
    key: "Tools",
    emoji: "1112234548999245834",
    blurb: "Stats, voting, premium, and partners",
  },
  {
    key: APPS,
    label: "User Apps",
    emoji: "🖱️",
    blurb: "Right-click a user and open Apps",
    note: "-# On mobile, tap a user's profile and look under **Apps**.",
  },
];

const DESCRIPTION_OVERRIDES = {
  asexual: 'Learn about the term "asexual" and its history',
  bisexual: 'Learn about the term "bisexual" and its history',
  gay: 'Learn about the term "gay" and its history',
  genderfluid: 'Learn about the term "genderfluid" and its history',
  lesbian: 'Learn about the term "lesbian" and its history',
  nonbinary: 'Learn about the term "non-binary" and its history',
  pansexual: 'Learn about the term "pansexual" and its history',
  queer: 'Learn about the term "queer" and its history',
  transgender: 'Learn about the term "transgender" and its history',
  pridemonth: "Learn about Pride Month and its history",
  lgbtqia: "Show off the LGBTQIA+ community",
  match: "Determine the compatibility between two users",
  nametester: "Try out new names for yourself",
  pronountester: "Try out new pronouns for yourself",
  other: "Learn about other terms found in LGBTQIA+ spaces",
  stats: "Get Pridebot's and Discord's statistics",
  vote: "Support Pridebot by voting for us",
  "User Avatar-view": "View a user's pride avatars",
  "User Gaydar": "How gay is this user?",
  "User Queerdar": "How queer is this user?",
  "User Transdar": "How trans is this user?",
  "User Profile": "View a user's profile",
};

let catalog = null;

function getCatalog() {
  if (catalog) return catalog;

  const groups = new Map();
  for (const file of listJsFiles(COMMANDS_DIR)) {
    const [folder, ...rest] = path.relative(COMMANDS_DIR, file).split(path.sep);
    if (HIDDEN_FOLDERS.has(folder)) continue;

    const mod = require(file);
    if (!mod.data || mod.guildIds?.length) continue;

    const isApp = mod.data instanceof ContextMenuCommandBuilder;
    if (!isApp && !(mod.data instanceof SlashCommandBuilder)) continue;

    const json = mod.data.toJSON();
    const key = isApp ? APPS : folder;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      name: json.name,
      isApp,
      group: !isApp && rest.length > 1 ? rest[0] : null,
      description: DESCRIPTION_OVERRIDES[json.name] ?? json.description,
      subcommands: (json.options ?? [])
        .filter((o) => o.type === 1)
        .map((o) => ({ name: o.name, description: o.description })),
    });
  }

  const known = CATEGORIES.filter((c) => groups.has(c.key));
  const extra = [...groups.keys()]
    .filter((key) => !CATEGORIES.some((c) => c.key === key))
    .map((key) => ({ key, emoji: "📁", blurb: `${key} commands` }));

  catalog = [...known, ...extra].map((c) => ({
    ...c,
    label: c.label ?? c.key,
    commands: groups.get(c.key),
  }));
  return catalog;
}

let idCache = { at: 0, ttl: 0, ids: new Map() };

async function getCommandIds(client) {
  if (Date.now() - idCache.at < idCache.ttl) return idCache.ids;
  try {
    const fetched = await client.application.commands.fetch();
    const ids = new Map(fetched.map((c) => [c.name, c.id]));
    const complete = getCatalog().every((cat) =>
      cat.commands.every((cmd) => ids.has(cmd.name))
    );
    idCache = { at: Date.now(), ttl: complete ? ID_CACHE_TTL : ID_RETRY_TTL, ids };
  } catch (err) {
    console.warn("[HELP] Couldn't fetch command IDs:", err.message);
    idCache = { ...idCache, at: Date.now(), ttl: ID_RETRY_TTL };
  }
  return idCache.ids;
}

function mention(ids, name, sub) {
  const full = sub ? `${name} ${sub}` : name;
  const id = ids.get(name);
  return id ? `</${full}:${id}>` : `\`/${full}\``;
}

function emojiMarkdown(emoji) {
  return /^\d+$/.test(emoji) ? `<:_:${emoji}>` : emoji;
}

function entryCount(cmd) {
  return cmd.subcommands.length || 1;
}

function countCommands() {
  let slash = 0;
  let apps = 0;
  for (const cat of getCatalog())
    for (const cmd of cat.commands)
      if (cmd.isApp) apps++;
      else slash += entryCount(cmd);
  return { slash, apps };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function divider(spacing = SeparatorSpacingSize.Small) {
  return new SeparatorBuilder().setDivider(true).setSpacing(spacing);
}

function categorySelect(current, disabled) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("help:category")
      .setPlaceholder("Browse a category…")
      .setDisabled(disabled)
      .addOptions(
        getCatalog().map((cat) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setDescription(cat.blurb)
            .setValue(cat.key)
            .setEmoji(cat.emoji)
            .setDefault(cat.key === current)
        )
      )
  );
}

function linkButtons() {
  const link = (label, url, emoji) =>
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url).setEmoji(emoji);
  return new ActionRowBuilder().addComponents(
    link("Website", LINKS.site, "1108228682184654908"),
    link("Support", LINKS.support, "1108417509624926228"),
    link("Premium", LINKS.premium, "1235074804726628465"),
    link("GitHub", LINKS.github, "1110925802041774151")
  );
}

function footer() {
  return new TextDisplayBuilder().setContent(
    `-# Made with 💖 by [Sdriver1](https://discord.com/users/${OWNER_ID}) · v${version} · [Terms](${LINKS.tos}) · [Privacy](${LINKS.privacy})`
  );
}

function buildOverview(client, { interactive = true, disabled = false } = {}) {
  const { slash, apps } = countCommands();
  const categories = getCatalog()
    .map(
      (cat) =>
        `${emojiMarkdown(cat.emoji)} **${cat.label}** · ${cat.commands.reduce((n, cmd) => n + entryCount(cmd), 0)}\n-# ${cat.blurb}`
    )
    .join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "# Pridebot Help\n" +
            "Pridebot, developed by Sdriver1, is a multifunction LGBTQ+ Discord bot designed to improve understanding of LGBTQIA+ identities through a wide range of informative commands covering sexualities, genders, pronouns, and related topics, while also helping users explore and better understand their own identities."
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ extension: "png", size: 256 }))
        )
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### Categories\n-# **${slash}** slash commands · **${apps}** user apps\n${categories}`
      )
    );

  if (interactive) container.addActionRowComponents(categorySelect(null, disabled));

  return container
    .addSeparatorComponents(divider(SeparatorSpacingSize.Large))
    .addActionRowComponents(linkButtons())
    .addTextDisplayComponents(footer());
}

function commandLines(ids, cmd) {
  if (cmd.isApp) return [`**${cmd.name}**\n-# ${cmd.description}`];
  if (cmd.subcommands.length)
    return cmd.subcommands.map(
      (sub) => `${mention(ids, cmd.name, sub.name)}\n-# ${sub.description}`
    );
  return [`${mention(ids, cmd.name)}\n-# ${cmd.description}`];
}

function buildCategory(key, ids, { interactive = true, disabled = false } = {}) {
  const cat = getCatalog().find((c) => c.key === key);

  const sections = [];
  let lastGroup;
  for (const cmd of cat.commands) {
    if (cmd.group && cmd.group !== lastGroup) sections.push(`### ${capitalize(cmd.group)}`);
    lastGroup = cmd.group;
    sections.push(...commandLines(ids, cmd));
  }

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emojiMarkdown(cat.emoji)} ${cat.label}\n-# ${cat.blurb}`
      )
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(sections.join("\n")));

  if (cat.note)
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(cat.note));

  if (interactive) {
    container
      .addSeparatorComponents(divider(SeparatorSpacingSize.Large))
      .addActionRowComponents(categorySelect(key, disabled))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("help:home")
            .setLabel("Back to overview")
            .setEmoji("🏠")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
        )
      );
  }

  return container.addTextDisplayComponents(footer());
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows command list and helpful links"),

  async execute(interaction, client) {
    const ids = await getCommandIds(client);
    let view = null;
    const render = (opts) =>
      view ? buildCategory(view, ids, opts) : buildOverview(client, opts);

    const response = await interaction.reply({
      components: [render()],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
      withResponse: true,
    });
    await commandLogging(client, interaction);

    const collector = response.resource.message.createMessageComponentCollector({
      time: MENU_LIFETIME,
    });

    collector.on(
      "collect",
      safeCollect("help", async (i) => {
        const target = i.customId === "help:category" ? i.values[0] : null;
        if (target && !getCatalog().some((c) => c.key === target)) return;
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            components: [
              target
                ? buildCategory(target, ids, { interactive: false })
                : buildOverview(client, { interactive: false }),
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
          });
          return;
        }

        view = target;
        await i.update({ components: [render()], allowedMentions: { parse: [] } });
      })
    );

    collector.on("end", () =>
      interaction
        .editReply({ components: [render({ disabled: true })], allowedMentions: { parse: [] } })
        .catch(() => { })
    );
  },
};
