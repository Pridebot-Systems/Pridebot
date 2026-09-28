const fs = require("fs");
const path = require("path");
const { PFPS_DIR } = require("../../../Shared/paths");
const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");
const { EmbedBuilder } = require("discord.js");

async function pfpCleanupCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (!message.content.startsWith(mention)) return;

  const args = message.content.slice(mention.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (commandName !== "pfpcleanup") return;

  const IDLists = require("../../../DB/models/idSchema.js");

  async function executePfpCleanupCommand(message, args) {
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
        "You do not have permission to use this command."
      );
      await addTrashCanReaction(botMessage);
      return;
    }

    const action = args[0]?.toLowerCase();
    const daysOld = parseInt(args[1]) || 30; // Default to 30 days

    if (!action || !["scan", "preview", "delete"].includes(action)) {
      const embed = new EmbedBuilder()
        .setColor("#FF6B6B")
        .setTitle("🧹 PFP Cleanup Command")
        .setDescription("Clean up empty folders in the PFP directory")
        .addFields(
          {
            name: "📋 Available Actions",
            value: `\`@bot pfpcleanup scan [days]\` - Scan for empty folders older than X days\n\`@bot pfpcleanup preview [days]\` - Preview what would be deleted\n\`@bot pfpcleanup delete [days]\` - Actually delete empty folders`,
            inline: false,
          },
          {
            name: "⚠️ Important Notes",
            value: "• Default: 30 days old\n• Only deletes EMPTY folders\n• Scans for folders with 0 files\n• Cannot be undone!",
            inline: false,
          },
          {
            name: "💡 Examples",
            value: `\`@bot pfpcleanup scan 7\` - Find empty folders older than 7 days\n\`@bot pfpcleanup delete 90\` - Delete empty folders older than 90 days`,
            inline: false,
          }
        )
        .setFooter({ text: "Use with caution - deletions cannot be undone!" });

      const botMessage = await message.channel.send({ embeds: [embed] });
      await addTrashCanReaction(botMessage);
      return;
    }

    try {
      const results = await scanEmptyFolders(daysOld);
      
      if (action === "scan" || action === "preview") {
        const embed = new EmbedBuilder()
          .setColor(action === "scan" ? "#3498DB" : "#F39C12")
          .setTitle(`🔍 ${action === "scan" ? "Scan Results" : "Cleanup Preview"}`)
          .setDescription(`Found ${results.emptyFolders.length} empty folders older than ${daysOld} days`)
          .addFields(
            {
              name: "📊 Summary",
              value: `**Total Empty Folders:** ${results.emptyFolders.length}\n**Oldest Empty Folder:** ${results.oldestAge} days old\n**Newest Empty Folder:** ${results.newestAge} days old`,
              inline: true,
            },
            {
              name: "💾 Disk Impact",
              value: `**Folders to Remove:** ${results.emptyFolders.length}\n**Estimated Space Saved:** ~${results.emptyFolders.length * 4} KB\n**Inodes Freed:** ${results.emptyFolders.length}`,
              inline: true,
            }
          );

        if (results.emptyFolders.length > 0) {
          const sampleFolders = results.emptyFolders.slice(0, 10).map(f => 
            `\`${f.name}\` (${f.ageInDays} days old)`
          ).join('\n');
          
          embed.addFields({
            name: "📁 Sample Folders (First 10)",
            value: sampleFolders + (results.emptyFolders.length > 10 ? `\n... and ${results.emptyFolders.length - 10} more` : ''),
            inline: false,
          });

          if (action === "preview") {
            embed.addFields({
              name: "⚠️ Next Steps",
              value: `Run \`@bot pfpcleanup delete ${daysOld}\` to actually delete these folders.\n**This action cannot be undone!**`,
              inline: false,
            });
          }
        }

        const botMessage = await message.channel.send({ embeds: [embed] });
        await addTrashCanReaction(botMessage);

      } else if (action === "delete") {
        if (results.emptyFolders.length === 0) {
          const botMessage = await message.channel.send(`✅ No empty folders found older than ${daysOld} days. Nothing to clean up!`);
          await addTrashCanReaction(botMessage);
          return;
        }

        const confirmMessage = await message.channel.send(
          `⚠️ **CONFIRMATION REQUIRED**\n\nYou are about to delete **${results.emptyFolders.length}** empty folders older than ${daysOld} days.\n\n**This action cannot be undone!**\n\nReact with ✅ to confirm or ❌ to cancel. (30 second timeout)`
        );

        await confirmMessage.react('✅');
        await confirmMessage.react('❌');

        const filter = (reaction, user) => {
          return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;
        };

        try {
          const collected = await confirmMessage.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
          const reaction = collected.first();

          if (reaction.emoji.name === '✅') {
            const deletingMessage = await message.channel.send("🧹 Deleting empty folders... Please wait.");
            
            const deleteResults = await deleteEmptyFolders(results.emptyFolders);
            
            await deletingMessage.delete().catch(() => {});
            await confirmMessage.delete().catch(() => {});

            const embed = new EmbedBuilder()
              .setColor("#27AE60")
              .setTitle("✅ Cleanup Complete")
              .setDescription("Empty folder cleanup has been completed")
              .addFields(
                {
                  name: "📊 Results",
                  value: `**Folders Deleted:** ${deleteResults.deleted}\n**Folders Failed:** ${deleteResults.failed}\n**Space Freed:** ~${deleteResults.deleted * 4} KB`,
                  inline: true,
                },
                {
                  name: "⏱️ Performance",
                  value: `**Time Taken:** ${deleteResults.timeTaken}ms\n**Success Rate:** ${((deleteResults.deleted / results.emptyFolders.length) * 100).toFixed(1)}%`,
                  inline: true,
                }
              )
              .setTimestamp();

            if (deleteResults.errors.length > 0) {
              embed.addFields({
                name: "❌ Errors",
                value: deleteResults.errors.slice(0, 5).join('\n') + (deleteResults.errors.length > 5 ? `\n... and ${deleteResults.errors.length - 5} more` : ''),
                inline: false,
              });
            }

            const botMessage = await message.channel.send({ embeds: [embed] });
            await addTrashCanReaction(botMessage);

          } else {
            await confirmMessage.delete().catch(() => {});
            const botMessage = await message.channel.send("❌ Cleanup cancelled by user.");
            await addTrashCanReaction(botMessage);
          }
        } catch (error) {
          await confirmMessage.delete().catch(() => {});
          const botMessage = await message.channel.send("⏰ Confirmation timed out. Cleanup cancelled for safety.");
          await addTrashCanReaction(botMessage);
        }
      }

    } catch (error) {
      console.error("Error in pfpcleanup command:", error);
      const botMessage = await message.channel.send("❌ An error occurred during cleanup operation.");
      await addTrashCanReaction(botMessage);
    }

    // Clean up user message
    setTimeout(() => {
      message
        .delete()
        .catch((err) => console.error("Failed to delete message:", err));
    }, 3000);
  }

  try {
    await executePfpCleanupCommand(message, args);
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

async function scanEmptyFolders(daysOld = 30) {
  const pfpsDir = PFPS_DIR;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  if (!fs.existsSync(pfpsDir)) {
    return { emptyFolders: [], oldestAge: 0, newestAge: 0 };
  }

  const emptyFolders = [];
  const folders = fs.readdirSync(pfpsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  for (const folder of folders) {
    const folderPath = path.join(pfpsDir, folder.name);
    const folderStat = fs.statSync(folderPath);

    // Only check folders older than cutoff date
    if (folderStat.birthtime > cutoffDate) continue;

    const files = fs.readdirSync(folderPath)
      .filter(file => fs.statSync(path.join(folderPath, file)).isFile());

    if (files.length === 0) {
      const ageInDays = Math.floor((Date.now() - folderStat.birthtime.getTime()) / (1000 * 60 * 60 * 24));
      emptyFolders.push({
        name: folder.name,
        path: folderPath,
        createdDate: folderStat.birthtime,
        ageInDays: ageInDays,
      });
    }
  }

  const ages = emptyFolders.map(f => f.ageInDays);
  return {
    emptyFolders,
    oldestAge: ages.length > 0 ? Math.max(...ages) : 0,
    newestAge: ages.length > 0 ? Math.min(...ages) : 0,
  };
}

async function deleteEmptyFolders(emptyFolders) {
  const startTime = Date.now();
  let deleted = 0;
  let failed = 0;
  const errors = [];

  for (const folder of emptyFolders) {
    try {
      fs.rmSync(folder.path, { recursive: true, force: true });
      deleted++;
    } catch (error) {
      failed++;
      errors.push(`Failed to delete ${folder.name}: ${error.message}`);
      console.error(`Failed to delete folder ${folder.name}:`, error);
    }
  }

  return {
    deleted,
    failed,
    errors,
    timeTaken: Date.now() - startTime,
  };
}

module.exports = { pfpCleanupCommand };
