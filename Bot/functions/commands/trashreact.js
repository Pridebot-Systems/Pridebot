async function react(reaction, user, client) {
  if (reaction.emoji.id === "1248480641301872650") {
    try {
      const IDLists = require("../../../DB/models/idSchema.js");
      const idLists = await IDLists.findOne();

      if (idLists.devs.includes(user.id)) {
        const message = reaction.message.partial
          ? await reaction.message.fetch()
          : reaction.message;
        if (message.author.id === client.user.id) {
          await message.delete();
        }
      }
    } catch (error) {
      if (error.code === 50001) {
        console.log("Missing access to delete the message.");
      } else if (error.code === 50013) {
        console.log("Missing permissions to delete the message.");
      } else {
        console.error("Error handling reaction:", error);
      }
    }
  }
}

async function addTrashCanReaction(message) {
  try {
    await message.react("1248480641301872650");
  } catch (error) {
    if (error.code === 50001) {
      console.log("Missing access to add reaction.");
    } else if (error.code === 50013) {
      console.log("Missing permissions to add reaction.");
    } else {
      console.error("Failed to add reaction:", error);
    }
  }
}

module.exports = {
  react,
  addTrashCanReaction,
};
