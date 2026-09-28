const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");
const Profile = require("../../../DB/models/profileSchema");

async function idCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (!message.content.startsWith(mention)) return;

  const args = message.content.slice(mention.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (commandName !== "id") return;

  const IDLists = require("../../../DB/models/idSchema.js");

  async function executeIDCommand(message, args) {
    if (message.author.bot) return;

    let idLists;
    try {
      idLists = await IDLists.findOne();
    } catch (err) {
      console.error(err);
      const botMessage = await message.channel.send("Error fetching ID lists.");
      await addTrashCanReaction(botMessage);
      return;
    }

    if (!idLists || !idLists.devs) {
      const botMessage = await message.channel.send(
        "ID lists are not properly defined."
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    if (!idLists.devs.includes(message.author.id)) {
      const botMessage = await message.channel.send(
        "You do not have permission to edit the lists."
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    const subCommand = args[0];
    const category = args[1];
    const id = args[2];
    const validCats = [
      "vips",
      "devs",
      "bot",
      "donor",
      "oneyear",
      "partner",
      "support",
      "discord",
      "easteregg",
    ];

    if (!validCats.includes(category)) {
      const botMessage = await message.channel.send(
        `Invalid category. Choose: ${validCats.join(", ")}`
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    // ADD SUBCOMMAND
    if (subCommand === "add") {
      if (!id) {
        const botMessage = await message.channel.send(
          "Please provide an ID to add."
        );
        await addTrashCanReaction(botMessage);
        return;
      }
      try {
        if (!idLists[category].includes(id)) {
          idLists[category].push(id);
          await idLists.save();
          const botMessage = await message.channel.send(
            `ID ${id} added to ${category}.`
          );
          await addTrashCanReaction(botMessage);

          // If donor, grant premium
          if (category === "donor") {
            let profile = await Profile.findOne({ userId: id });
            if (!profile) profile = new Profile({ userId: id });
            profile.premiumMember = true;
            if (!profile.premiumSince) profile.premiumSince = new Date();
            await profile.save();
          }
        } else {
          const botMessage = await message.channel.send(
            `ID ${id} is already in ${category}.`
          );
          await addTrashCanReaction(botMessage);
          if (category === "donor") {
            let profile = await Profile.findOne({ userId: id });
            if (!profile) profile = new Profile({ userId: id });
            profile.premiumMember = true;
            if (!profile.premiumSince) profile.premiumSince = new Date();
            await profile.save();
          }
        }
      } catch (err) {
        console.error(err);
        const botMessage = await message.channel.send("Error adding ID.");
        await addTrashCanReaction(botMessage);
      }
    }

    // REMOVE SUBCOMMAND
    if (subCommand === "remove") {
      if (!id) {
        const botMessage = await message.channel.send(
          "Please provide an ID to remove."
        );
        await addTrashCanReaction(botMessage);
        return;
      }
      try {
        if (idLists[category].includes(id)) {
          idLists[category] = idLists[category].filter(
            (storedId) => storedId !== id
          );
          await idLists.save();
          const botMessage = await message.channel.send(
            `ID ${id} removed from ${category}.`
          );
          await addTrashCanReaction(botMessage);

          // If donor, revoke premium
          if (category === "donor") {
            const profile = await Profile.findOne({ userId: id });
            if (profile) {
              profile.premiumMember = false;
              profile.premiumSince = null;
              await profile.save();
            }
          }
        } else {
          const botMessage = await message.channel.send(
            `ID ${id} is not in ${category}.`
          );
          await addTrashCanReaction(botMessage);
        }
      } catch (err) {
        console.error(err);
        const botMessage = await message.channel.send("Error removing ID.");
        await addTrashCanReaction(botMessage);
      }
    }

    // clean up user message
    setTimeout(() => {
      message
        .delete()
        .catch((err) => console.error("Failed to delete message:", err));
    }, 3000);
  }

  try {
    await executeIDCommand(message, args);
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

module.exports = { idCommand };
