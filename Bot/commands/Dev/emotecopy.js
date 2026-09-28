const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");

async function emotecopyCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (!message.content.startsWith(mention)) return;

  const args = message.content.slice(mention.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (commandName !== "emotecopy") return;

  const IDLists = require("../../../DB/models/idSchema.js");

  async function executeEmotecopyCommand(message) {
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

    if (!idLists || !idLists.devs.includes(message.author.id)) {
      const botMessage = await message.channel.send(
        "You do not have permission to use this command.",
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    if (!message.guild) {
      const botMessage = await message.channel.send(
        "This command must be used in a server.",
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    const emojis = message.guild.emojis.cache;
    if (emojis.size === 0) {
      const botMessage = await message.channel.send(
        "This server has no custom emotes.",
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    const statusMessage = await message.channel.send(
      `Starting to copy **${emojis.size}** emote(s) to application emotes...`,
    );

    let success = 0;
    let failed = 0;
    const errors = [];

    for (const [, emoji] of emojis) {
      try {
        const extension = emoji.animated ? "gif" : "png";
        const url = emoji.imageURL({ extension, size: 128 });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        await client.application.emojis.create({
          name: emoji.name,
          attachment: imageBuffer,
        });

        success++;

        // Small delay to avoid hitting rate limits
        await new Promise((res) => setTimeout(res, 500));
      } catch (err) {
        failed++;
        errors.push(`\`${emoji.name}\`: ${err.message}`);
        console.error(`[EMOTECOPY] Failed to copy emoji ${emoji.name}:`, err);
      }
    }

    const resultLines = [
      `**Emote Copy Complete**`,
      `✅ Successfully copied: **${success}**`,
      `❌ Failed: **${failed}**`,
    ];

    if (errors.length > 0) {
      const errorSample = errors.slice(0, 5).join("\n");
      resultLines.push(`\n**Errors (first 5):**\n${errorSample}`);
      if (errors.length > 5) {
        resultLines.push(`...and ${errors.length - 5} more`);
      }
    }

    await statusMessage.edit(resultLines.join("\n"));
    await addTrashCanReaction(statusMessage);

    setTimeout(() => {
      message
        .delete()
        .catch((err) => console.error("Failed to delete message:", err));
    }, 3000);
  }

  try {
    await executeEmotecopyCommand(message);
  } catch (error) {
    console.error(error);
    const botMessage = await message.reply(
      "There was an error trying to execute that command!",
    );
    await addTrashCanReaction(botMessage);
    setTimeout(() => {
      message
        .delete()
        .catch((err) => console.error("Failed to delete message:", err));
    }, 3000);
  }
}

module.exports = { emotecopyCommand };
