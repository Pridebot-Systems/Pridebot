const { ActivityType } = require("discord.js");
const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");
const IDLists = require("../../../DB/models/idSchema.js");
const CommandUsage = require("../../../DB/models/usageSchema.js");

async function handleErrorModeCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (!message.content.toLowerCase().startsWith(mention)) return;

  const args = message.content.slice(mention.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (!["errormode", "removeerror"].includes(commandName)) return;

  let idLists;
  try {
    idLists = await IDLists.findOne();
  } catch (err) {
    console.error(err);
    const errMsg = await message.reply("Error fetching ID lists.");
    await addTrashCanReaction(errMsg);
    return;
  }

  if (!idLists?.devs.includes(message.author.id)) {
    const noPerm = await message.reply(
      "You do not have permission to use this command."
    );
    await addTrashCanReaction(noPerm);
    return;
  }

  try {
    if (commandName === "errormode") {
      clearInterval(client.presenceInterval);

      await client.user.setPresence({
        status: "dnd",
        activities: [
          {
            type: ActivityType.Playing,
            name: "The bot is currently experiencing high levels of errors, please be patient. The devs are working on it.",
          },
        ],
      });

      const success = await message.reply(
        "Error mode activated. Presence paused."
      );
      await addTrashCanReaction(success);
    } else if (commandName === "removeerror") {
      await client.updatePresence?.();
      client.presenceInterval = setInterval(client.updatePresence, 15_000);

      const success = await message.reply(
        "Error mode deactivated. Presence rotation resumed."
      );
      await addTrashCanReaction(success);
    }
  } catch (err) {
    console.error(err);
    const failMsg = await message.reply("Failed to update presence.");
    await addTrashCanReaction(failMsg);
  }

  setTimeout(() => {
    message
      .delete()
      .catch((err) => console.error("Failed to delete message:", err));
  }, 3000);
}

module.exports = { handleErrorModeCommand };
