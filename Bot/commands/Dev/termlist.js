const BlockedTerm = require("../../../DB/models/blockedtermSchema.js");
const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");

async function termCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (message.content.startsWith(mention)) {
    const args = message.content.slice(mention.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    if (commandName === "terms" || commandName === "term") {
      const subCommand = args[0];
      const term = args.slice(1).join(" ");

      if (!["add", "remove"].includes(subCommand)) {
        const botMessage = await message.channel.send(
          "Invalid sub-command. Please use 'add' or 'remove'."
        );
        await addTrashCanReaction(botMessage);
        return;
      }

      if (subCommand === "add") {
        if (term) {
          try {
            const blockedTerms =
              (await BlockedTerm.findOne()) || new BlockedTerm();
            if (!blockedTerms.terms.includes(term)) {
              blockedTerms.terms.push(term);
              await blockedTerms.save();
              const botMessage = await message.channel.send(
                `Term ||"${term}"|| has been added to the blocked terms list.`
              );
              await addTrashCanReaction(botMessage);
            } else {
              const botMessage = await message.channel.send(
                `The term ||"${term}"|| is already in the blocked terms list.`
              );
              await addTrashCanReaction(botMessage);
            }
          } catch (err) {
            console.error(err);
            const botMessage = await message.channel.send("Error adding term.");
            await addTrashCanReaction(botMessage);
          }
        } else {
          const botMessage = await message.channel.send(
            "Please provide a term to add."
          );
          await addTrashCanReaction(botMessage);
        }
      }

      if (subCommand === "remove") {
        if (term) {
          try {
            const blockedTerms = await BlockedTerm.findOne();
            if (blockedTerms && blockedTerms.terms.includes(term)) {
              blockedTerms.terms = blockedTerms.terms.filter((t) => t !== term);
              await blockedTerms.save();
              const botMessage = await message.channel.send(
                `Term ||"${term}"|| has been removed from the blocked terms list.`
              );
              await addTrashCanReaction(botMessage);
            } else {
              const botMessage = await message.channel.send(
                `The term ||"${term}"|| was not found in the blocked terms list.`
              );
              await addTrashCanReaction(botMessage);
            }
          } catch (err) {
            console.error(err);
            const botMessage = await message.channel.send(
              "Error removing term."
            );
            await addTrashCanReaction(botMessage);
          }
        } else {
          const botMessage = await message.channel.send(
            "Please provide a term to remove."
          );
          await addTrashCanReaction(botMessage);
        }
      }

      setTimeout(() => {
        message
          .delete()
          .catch((err) => console.error("Failed to delete message:", err));
      }, 3000);
    }
  }
}

module.exports = { termCommand };
