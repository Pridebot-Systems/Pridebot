const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");
const { invalidateDarPins } = require("../../utils/premium.js");

// Numeric pins are stored as numbers; anything else (the joke pins) stays a
// string. Historically every pin was stored as a raw string from the message.
function parseMeter(raw) {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n : raw;
}

async function darCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (message.content.startsWith(mention)) {
    const args = message.content.slice(mention.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const IDLists = require("../../../DB/models/idSchema.js");
    const DarList = require("../../../DB/models/idDarSchema.js");

    if (commandName === "dar") {
      const allowedCategories = ["gaydar", "transdar", "queerdar", "rizzdar", "lesdar", "bidar"];

      async function executeDarCommand(message, args) {
        if (message.author.bot) return;

        let idLists;
        try {
          idLists = await IDLists.findOne();
        } catch (err) {
          console.error(err);
          const botMessage = await message.channel.send(
            "Error fetching ID lists."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        if (!idLists.devs.includes(message.author.id)) {
          const botMessage = await message.channel.send(
            "You do not have permission to edit the dar list."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        let darList;
        try {
          darList = (await DarList.findOne()) || new DarList();
        } catch (err) {
          console.error(err);
          const botMessage = await message.channel.send(
            "Error fetching Dar lists."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        const subCommand = args[0];
        const category = args[1];
        const userId = args[2];
        const meterValue = args[3];

        if (!allowedCategories.includes(category)) {
          const botMessage = await message.channel.send(
            `Invalid category. Please choose from ${allowedCategories.join(
              ", "
            )}.`
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        if (subCommand === "add" || subCommand === "change") {
          if (userId && meterValue) {
            try {
              const meter = parseMeter(meterValue);
              const entryIndex = darList[category].findIndex(
                (entry) => entry.userid === userId
              );
              if (entryIndex > -1) {
                darList[category][entryIndex].meter = meter;
              } else {
                darList[category].push({ userid: userId, meter });
              }

              await darList.save();
              invalidateDarPins();
              const botMessage = await message.channel.send(
                `User <@${userId}> added/updated in ${category} with a meter value of ${meterValue}.`
              );
              await addTrashCanReaction(botMessage);
            } catch (err) {
              console.error(err);
              const botMessage = await message.channel.send(
                "Error adding/updating user."
              );
              await addTrashCanReaction(botMessage);
            }
          } else {
            const botMessage = await message.channel.send(
              "Please provide a user ID and a meter value to add or update."
            );
            await addTrashCanReaction(botMessage);
          }
        } else if (subCommand === "remove") {
          if (userId) {
            try {
              const entryIndex = darList[category].findIndex(
                (entry) => entry.userid === userId
              );
              if (entryIndex > -1) {
                darList[category].splice(entryIndex, 1);
                await darList.save();
                invalidateDarPins();
                const botMessage = await message.channel.send(
                  `User <@${userId}> removed from ${category}.`
                );
                await addTrashCanReaction(botMessage);
              } else {
                const botMessage = await message.channel.send(
                  `User <@${userId}> is not in ${category}.`
                );
                await addTrashCanReaction(botMessage);
              }
            } catch (err) {
              console.error(err);
              const botMessage = await message.channel.send(
                "Error removing user."
              );
              await addTrashCanReaction(botMessage);
            }
          } else {
            const botMessage = await message.channel.send(
              "Please provide a user ID to remove."
            );
            await addTrashCanReaction(botMessage);
          }
        } else {
          const botMessage = await message.channel.send(
            "Invalid subcommand. Use 'add', 'change', or 'remove'."
          );
          await addTrashCanReaction(botMessage);
        }

        setTimeout(() => {
          message
            .delete()
            .catch((err) => console.error("Failed to delete message:", err));
        }, 3000);
      }

      try {
        await executeDarCommand(message, args);
      } catch (error) {
        console.error(error);
        const botMessage = await message.reply(
          "There was an error trying to execute that command!"
        );
        await addTrashCanReaction(botMessage);
        setTimeout(() => {
          message
            .delete()
            .catch((err) => console.error("Failed to delete message:", err));
        }, 3000);
      }
    }
  }
}

module.exports = { darCommand };
