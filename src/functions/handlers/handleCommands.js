const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");
const chalk = require("chalk");
const {
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
} = require("discord.js");
const path = require("path");

module.exports = (client) => {
  client.handleCommands = async (commandsPath, clientId) => {
    const loadCommands = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          loadCommands(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          const command = require(path.join(__dirname, "../../../", fullPath));
          if (!command.data) {
            console.log(
              chalk.red.bold(
                `Command: ${entry.name} does not export a 'data' property`
              )
            );
            continue;
          }

          if (command.data instanceof SlashCommandBuilder) {
            command.data.setDMPermission(true);
            const commandJSON = command.data.toJSON();
            commandJSON.integration_types = [0, 1];
            commandJSON.contexts = [0, 1, 2];

            client.commands.set(command.data.name, command);
            client.commandArray.push(commandJSON);

            console.log(
              chalk.green.bold.underline(
                `Command: ${command.data.name} is ready to deploy ✅`
              )
            );
          } else if (command.data instanceof ContextMenuCommandBuilder) {
            client.commands.set(command.data.name, command);
            client.commandArray.push(command.data.toJSON());
            console.log(
              chalk.green.bold.underline(
                `Command: ${command.data.name} is ready to deploy ✅`
              )
            );
          } else {
            console.log(
              chalk.red.bold(
                `Command: ${entry.name} does not have a valid 'data' type`
              )
            );
          }
        }
      }
    };

    fs.readdirSync(commandsPath).forEach((folder) => {
      loadCommands(`${commandsPath}/${folder}`);
    });

    const rest = new REST({ version: "10" }).setToken(process.env.token);
    try {
      console.log(
        chalk.yellow.underline("Started refreshing application commands.")
      );
      await rest.put(Routes.applicationCommands(clientId), {
        body: client.commandArray,
      });
      console.log(
        chalk.green.underline("Successfully reloaded application commands.")
      );
    } catch (error) {
      console.error(error);
    }
  };
};
