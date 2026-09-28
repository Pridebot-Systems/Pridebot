const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");

async function blacklistCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (message.content.startsWith(mention)) {
    const args = message.content.slice(mention.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    if (commandName === "blacklist" || commandName === "bl") {
      const IDLists = require("../../../DB/models/idSchema.js");
      const Blacklist = require("../../../DB/models/blacklistSchema.js");

      async function executeBLCommand(message, args) {
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
            "You do not have permission to edit the blacklist."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        const subCommand = args[0];
        const category = args[1];
        const id = args[2];

        if (!["user", "guild"].includes(category)) {
          const botMessage = await message.channel.send(
            "Invalid category. Please choose from user or guild."
          );
          await addTrashCanReaction(botMessage);
          return;
        }

        const listField =
          category === "user" ? "blacklistUserIDs" : "blacklistGuildIDs";

        if (subCommand === "add") {
          if (id) {
            try {
              const blacklist = await Blacklist.findOne();
              if (!blacklist[listField].includes(id)) {
                blacklist[listField].push(id);
                await blacklist.save();
                const botMessage = await message.channel.send(
                  `ID ${id} added to ${category} blacklist.`
                );
                await addTrashCanReaction(botMessage);
                if (category === "guild") {
                  const guild = client.guilds.cache.get(id);
                  if (guild) {
                    await guild.leave();
                    const leftMessage = await message.channel.send(
                      `Left guild ${guild.id}`
                    );
                    await addTrashCanReaction(leftMessage);
                  } else {
                    const notFoundMessage = await message.channel.send(
                      `Guild with ID ${id} not found.`
                    );
                    await addTrashCanReaction(notFoundMessage);
                  }
                }
              } else {
                const botMessage = await message.channel.send(
                  `ID ${id} is already in the ${category} blacklist.`
                );
                await addTrashCanReaction(botMessage);
              }
            } catch (err) {
              console.error(err);
              const botMessage = await message.channel.send("Error adding ID.");
              await addTrashCanReaction(botMessage);
            }
          } else {
            const botMessage = await message.channel.send(
              "Please provide an ID to add."
            );
            await addTrashCanReaction(botMessage);
          }
        }

        if (subCommand === "remove") {
          if (id) {
            try {
              const blacklist = await Blacklist.findOne();
              if (blacklist[listField].includes(id)) {
                blacklist[listField] = blacklist[listField].filter(
                  (storedId) => storedId !== id
                );
                await blacklist.save();
                const botMessage = await message.channel.send(
                  `ID ${id} removed from ${category} blacklist.`
                );
                await addTrashCanReaction(botMessage);
              } else {
                const botMessage = await message.channel.send(
                  `ID ${id} is not in the ${category} blacklist.`
                );
                await addTrashCanReaction(botMessage);
              }
            } catch (err) {
              console.error(err);
              const botMessage = await message.channel.send(
                "Error removing ID."
              );
              await addTrashCanReaction(botMessage);
            }
          } else {
            const botMessage = await message.channel.send(
              "Please provide an ID to remove."
            );
            await addTrashCanReaction(botMessage);
          }
        }

        if (subCommand === "list") {
          try {
            const blacklist = await Blacklist.findOne();
            const list = blacklist[listField].join(", ");
            const botMessage = await message.channel.send(
              `Blacklisted ${category}s: ${list}`
            );
            await addTrashCanReaction(botMessage);
          } catch (err) {
            console.error(err);
            const botMessage = await message.channel.send("Error listing IDs.");
            await addTrashCanReaction(botMessage);
          }
        }

        setTimeout(() => {
          message
            .delete()
            .catch((err) => console.error("Failed to delete message:", err));
        }, 3000);
      }

      try {
        await executeBLCommand(message, args);
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

module.exports = { blacklistCommand };
