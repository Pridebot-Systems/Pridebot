const fs = require("fs");
const path = require("path");
const { PFPS_DIR } = require("../../../Shared/paths");
const {
  addTrashCanReaction,
} = require("../../functions/commands/trashreact.js");
const PfpStats = require("../../../DB/models/pfpStatsSchema.js");
const { EmbedBuilder } = require("discord.js");

async function pfpStatsCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (!message.content.startsWith(mention)) return;

  const args = message.content.slice(mention.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (commandName !== "pfpstats") return;

  const IDLists = require("../../../DB/models/idSchema.js");

  async function executePfpStatsCommand(message) {
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

    try {
      // Get cached stats or generate new ones
      let statsDoc = await PfpStats.findOne({ _id: "pfpstats" });
      
      // Check if stats need to be updated (older than 3 hours)
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      
      // Force refresh if missing new fields (for schema migration)
      const needsMigration = !statsDoc || 
        typeof statsDoc.stats.emptyFolders === 'undefined' || 
        typeof statsDoc.stats.foldersWithFiles === 'undefined';
      
      if (!statsDoc || !statsDoc.lastUpdated || statsDoc.lastUpdated < threeHoursAgo || needsMigration) {
        const loadingMessage = await message.channel.send("📊 Calculating PFP statistics... This may take a moment.");
        
        // Generate new stats
        const newStats = await calculatePfpStats();
        console.log("📊 Calculated stats:", newStats); // Debug log
        
        if (!statsDoc) {
          statsDoc = new PfpStats({
            _id: "pfpstats",
            lastUpdated: now,
            stats: newStats,
          });
        } else {
          statsDoc.lastUpdated = now;
          statsDoc.stats = newStats;
        }
        
        await statsDoc.save();
        console.log("💾 Saved stats to database:", statsDoc.stats); // Debug log
        await loadingMessage.delete().catch(() => {});
      }

      // Create embed with stats
      const stats = statsDoc.stats;
      const emptyPercentage = stats.totalFolders > 0 ? (stats.emptyFolders / stats.totalFolders * 100).toFixed(1) : 0;
      
      const embed = new EmbedBuilder()
        .setColor("#FF69B4")
        .setTitle("📊 PFP Directory Statistics")
        .setDescription("Comprehensive statistics for the PFP directory")
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          {
            name: "📁 Directory Overview",
            value: `**Total Folders:** ${stats.totalFolders.toLocaleString()}\n**📄 Folders with Files:** ${stats.foldersWithFiles.toLocaleString()}\n**🗂️ Empty Folders:** ${stats.emptyFolders.toLocaleString()} (${emptyPercentage}%)`,
            inline: true,
          },
          {
            name: "📄 File Information",
            value: `**Total Files:** ${stats.totalFiles.toLocaleString()}\n**Avg Files/Folder:** ${stats.averageFilesPerFolder.toFixed(2)}\n**Avg Files/Active:** ${stats.averageFilesPerActiveFolder.toFixed(2)}`,
            inline: true,
          },
          {
            name: "💾 Storage Information",
            value: `**Total Size:** ${stats.totalSizeGB.toFixed(2)} GB\n**Total Size:** ${stats.totalSizeMB.toFixed(2)} MB\n**Avg File Size:** ${stats.averageFileSizeMB.toFixed(2)} MB`,
            inline: false,
          },
          {
            name: "📈 Performance Metrics",
            value: `**Largest Folder:** ${stats.largestFolder?.name || 'N/A'}\n**Files in Largest:** ${stats.largestFolder?.fileCount || 0}\n**Largest Folder Size:** ${stats.largestFolder?.sizeMB?.toFixed(2) || 0} MB`,
            inline: true,
          },
          {
            name: "🧹 Cleanup Suggestions",
            value: `**Empty Folders:** ${stats.emptyFolders.toLocaleString()} folders are empty\n**Potential Storage Saved:** ~0 MB\n**Recommendation:** ${stats.emptyFolders > 1000 ? '⚠️ Consider cleanup' : '✅ Manageable amount'}`,
            inline: true,
          },
          {
            name: "📅 Timeline Information",
            value: `**Oldest Folder:** ${stats.oldestFolder?.name || 'N/A'}\n**Newest Folder:** ${stats.newestFolder?.name || 'N/A'}\n**Last Updated:** <t:${Math.floor(statsDoc.lastUpdated.getTime() / 1000)}:R>`,
            inline: false,
          }
        )
        .setFooter({
          text: "Stats are cached and updated every 3 hours • Empty folders may indicate unused user directories",
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();

      const botMessage = await message.channel.send({ embeds: [embed] });
      await addTrashCanReaction(botMessage);

    } catch (error) {
      console.error("Error in pfpstats command:", error);
      const botMessage = await message.channel.send("❌ An error occurred while fetching PFP statistics.");
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
    await executePfpStatsCommand(message);
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

async function calculatePfpStats() {
  const pfpsDir = PFPS_DIR;
  
  if (!fs.existsSync(pfpsDir)) {
    return {
      totalFolders: 0,
      totalFiles: 0,
      emptyFolders: 0,
      foldersWithFiles: 0,
      totalSizeBytes: 0,
      totalSizeMB: 0,
      totalSizeGB: 0,
      averageFilesPerFolder: 0,
      averageFilesPerActiveFolder: 0,
      averageFileSizeMB: 0,
      largestFolder: null,
      oldestFolder: null,
      newestFolder: null,
      oldestEmptyFolders: [],
    };
  }

  const stats = {
    totalFolders: 0,
    totalFiles: 0,
    emptyFolders: 0,
    foldersWithFiles: 0,
    totalSizeBytes: 0,
    totalSizeMB: 0,
    totalSizeGB: 0,
    averageFilesPerFolder: 0,
    averageFilesPerActiveFolder: 0,
    averageFileSizeMB: 0,
    largestFolder: { name: "", fileCount: 0, sizeMB: 0 },
    oldestFolder: { name: "", createdDate: new Date() },
    newestFolder: { name: "", createdDate: new Date(0) },
    oldestEmptyFolders: [],
  };

  try {
    const folders = fs.readdirSync(pfpsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory());

    stats.totalFolders = folders.length;

    if (folders.length === 0) {
      return stats;
    }

    let totalFilesInAllFolders = 0;
    const emptyFolders = [];

    for (const folder of folders) {
      const folderPath = path.join(pfpsDir, folder.name);
      
      try {
        const folderStat = fs.statSync(folderPath);
        
        // Check if this is oldest or newest folder
        if (folderStat.birthtime < stats.oldestFolder.createdDate) {
          stats.oldestFolder = {
            name: folder.name,
            createdDate: folderStat.birthtime,
          };
        }
        
        if (folderStat.birthtime > stats.newestFolder.createdDate) {
          stats.newestFolder = {
            name: folder.name,
            createdDate: folderStat.birthtime,
          };
        }

        // Count files and calculate sizes in this folder
        let files = [];
        try {
          const folderContents = fs.readdirSync(folderPath);
          files = folderContents.filter(file => {
            try {
              const filePath = path.join(folderPath, file);
              return fs.statSync(filePath).isFile();
            } catch (err) {
              console.warn(`Error checking file ${file} in folder ${folder.name}:`, err.message);
              return false;
            }
          });
        } catch (err) {
          console.warn(`Error reading folder ${folder.name}:`, err.message);
          files = [];
        }
        
        if (files.length === 0) {
          stats.emptyFolders++;
          emptyFolders.push({
            name: folder.name,
            createdDate: folderStat.birthtime,
          });
        } else {
          stats.foldersWithFiles++;
        }
        
        let folderSizeBytes = 0;
        
        for (const file of files) {
          try {
            const filePath = path.join(folderPath, file);
            const fileStat = fs.statSync(filePath);
            folderSizeBytes += fileStat.size;
            stats.totalFiles++;
          } catch (err) {
            console.warn(`Error getting stats for file ${file}:`, err.message);
          }
        }

        totalFilesInAllFolders += files.length;
        stats.totalSizeBytes += folderSizeBytes;

        // Check if this is the largest folder
        const folderSizeMB = folderSizeBytes / (1024 * 1024);
        if (files.length > stats.largestFolder.fileCount) {
          stats.largestFolder = {
            name: folder.name,
            fileCount: files.length,
            sizeMB: folderSizeMB,
          };
        }
      } catch (err) {
        console.warn(`Error processing folder ${folder.name}:`, err.message);
        // Count as empty folder if we can't read it
        stats.emptyFolders++;
      }
    }

    // Get oldest empty folders (for cleanup suggestions)
    stats.oldestEmptyFolders = emptyFolders
      .sort((a, b) => a.createdDate - b.createdDate)
      .slice(0, 10); // Keep top 10 oldest empty folders

    // Calculate derived stats
    stats.totalSizeMB = stats.totalSizeBytes / (1024 * 1024);
    stats.totalSizeGB = stats.totalSizeMB / 1024;
    stats.averageFilesPerFolder = stats.totalFolders > 0 ? totalFilesInAllFolders / stats.totalFolders : 0;
    stats.averageFilesPerActiveFolder = stats.foldersWithFiles > 0 ? totalFilesInAllFolders / stats.foldersWithFiles : 0;
    stats.averageFileSizeMB = stats.totalFiles > 0 ? stats.totalSizeMB / stats.totalFiles : 0;

  } catch (error) {
    console.error("Error calculating PFP stats:", error);
    throw error;
  }

  return stats;
}

async function updatePfpStatsCache() {
  try {
    console.log("🔄 Updating PFP stats cache...");
    const newStats = await calculatePfpStats();
    
    let statsDoc = await PfpStats.findOne({ _id: "pfpstats" });
    
    if (!statsDoc) {
      statsDoc = new PfpStats({
        _id: "pfpstats",
        lastUpdated: new Date(),
        stats: newStats,
      });
    } else {
      statsDoc.lastUpdated = new Date();
      statsDoc.stats = newStats;
    }
    
    await statsDoc.save();
    console.log("✅ PFP stats cache updated successfully");
    return statsDoc;
  } catch (error) {
    console.error("❌ Failed to update PFP stats cache:", error);
    throw error;
  }
}

module.exports = { pfpStatsCommand, updatePfpStatsCache };
