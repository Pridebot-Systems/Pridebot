const path = require("path");
const chalk = require("chalk");
const {
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
} = require("discord.js");
const config = require("../../../environment");
const { COMMANDS_DIR } = require("../../../Shared/paths");
const { listJsFiles } = require("./listFiles");

function loadCommands(dir = COMMANDS_DIR) {
  const commands = new Map();
  const payload = [];
  const guildPayloads = new Map(); // guildId -> command JSON[]
  const guildNames = [];
  const skipped = [];

  for (const file of listJsFiles(dir)) {
    const mod = require(file);
    const rel = path.relative(dir, file).split(path.sep).join("/");

    if (mod.data instanceof SlashCommandBuilder) {
      const json = mod.data.toJSON();
      if (Array.isArray(mod.guildIds) && mod.guildIds.length) {
        // Guild-scoped (dev tooling): registered only in the listed guilds.
        json.integration_types = [0]; // guild install only
        json.contexts = [0]; // guild only
        for (const guildId of mod.guildIds) {
          if (!guildPayloads.has(guildId)) guildPayloads.set(guildId, []);
          guildPayloads.get(guildId).push(json);
        }
        guildNames.push(json.name);
      } else {
        json.integration_types = [0, 1]; // guild + user install
        json.contexts = [0, 1, 2]; // guild, bot DM, private channel
        payload.push(json);
      }
      commands.set(mod.data.name, mod);
    } else if (mod.data instanceof ContextMenuCommandBuilder) {
      commands.set(mod.data.name, mod);
      payload.push(mod.data.toJSON());
    } else {
      skipped.push(rel);
    }
  }

  const names = [...payload.map((c) => c.name), ...guildNames];
  const duplicates = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];

  return { commands, payload, guildPayloads, skipped, duplicates };
}

/**
 * Overwrites the application's global command list, then each guild's command
 * list for guild-scoped commands. Run from ONE cluster only.
 */
async function registerCommands(payload, duplicates, guildPayloads = new Map()) {
  if (duplicates.length) {
    console.error(
      chalk.red.bold(`[COMMANDS] Not registering — duplicate names: ${duplicates.join(", ")}`)
    );
    return false;
  }

  const rest = new REST({ version: "10" }).setToken(config.token);
  console.log(chalk.yellow(`[COMMANDS] Registering ${payload.length} global commands...`));
  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: payload });
    console.log(chalk.green(`[COMMANDS] Registered ${payload.length} commands ✅`));
  } catch (err) {
    console.error(chalk.red.bold("[COMMANDS] Registration failed:"), err);
    return false;
  }

  for (const [guildId, body] of guildPayloads) {
    try {
      await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body });
      console.log(
        chalk.green(`[COMMANDS] Registered ${body.length} guild command(s) in ${guildId} ✅`)
      );
    } catch (err) {
      // e.g. 50001 when this bot (beta) isn't in that guild — global commands are unaffected.
      console.error(chalk.red.bold(`[COMMANDS] Guild ${guildId} registration failed:`), err.message);
    }
  }
  return true;
}

module.exports = { loadCommands, registerCommands };
