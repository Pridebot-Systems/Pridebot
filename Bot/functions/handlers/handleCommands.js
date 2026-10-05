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
  const skipped = [];

  for (const file of listJsFiles(dir)) {
    const mod = require(file);
    const rel = path.relative(dir, file).split(path.sep).join("/");

    if (mod.data instanceof SlashCommandBuilder) {
      const json = mod.data.toJSON();
      json.integration_types = [0, 1]; // guild + user install
      json.contexts = [0, 1, 2]; // guild, bot DM, private channel
      commands.set(mod.data.name, mod);
      payload.push(json);
    } else if (mod.data instanceof ContextMenuCommandBuilder) {
      commands.set(mod.data.name, mod);
      payload.push(mod.data.toJSON());
    } else {
      skipped.push(rel);
    }
  }

  const names = payload.map((c) => c.name);
  const duplicates = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];

  return { commands, payload, skipped, duplicates };
}

/** Overwrites the application's global command list. Run from ONE cluster only. */
async function registerCommands(payload, duplicates) {
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
    return true;
  } catch (err) {
    console.error(chalk.red.bold("[COMMANDS] Registration failed:"), err);
    return false;
  }
}

module.exports = { loadCommands, registerCommands };
