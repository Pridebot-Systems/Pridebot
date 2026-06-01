const fs = require("fs");
const path = require("path");

const avatarsDir = path.join(__dirname, "../../pfps");

const PROTECTED_FILES = new Set([
  path.join(avatarsDir, "1101256478632972369", "lgbt.png"),
]);

async function deleteOldFiles(client, channelId) {
  const { getInfo } = require("discord-hybrid-sharding");

  if (getInfo().CLUSTER !== 0) {
    console.log(
      `⏭️ Skipping cleanup on cluster ${
        getInfo().CLUSTER
      } (only runs on cluster 0)`
    );
    return;
  }

  console.log("🧹 Starting daily cleanup process...");
  const startTime = Date.now();

  try {
    const result = await performCleanup();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    try {
      await client.cluster.broadcastEval(
        async (c, { channelId, result, duration }) => {
          const channel = c.channels.cache.get(channelId);
          if (channel) {
            let message = `🧹 **Daily Cleanup Complete!**\n`;
            message += `📄 **Files deleted:** ${result.deletedFiles}\n`;
            message += `📁 **Empty folders deleted:** ${result.deletedFolders}\n`;
            message += `⏱️ **Duration:** ${duration}s\n`;

            if (result.errors.length > 0) {
              message += `⚠️ **Errors encountered:** ${result.errors.length}`;
            }

            await channel.send(message);
            return `✅ Cleanup notification sent to channel ${channelId} from cluster ${
              c.cluster?.id || "unknown"
            }`;
          }
          return null;
        },
        { context: { channelId, result, duration } }
      );

      console.log(`✅ Cleanup notification broadcasted to all clusters`);
    } catch (broadcastError) {
      console.error(
        "❌ Error broadcasting cleanup notification:",
        broadcastError
      );

      // Fallback: try to send from current cluster
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        let message = `🧹 **Daily Cleanup Complete!**\n`;
        message += `📄 **Files deleted:** ${result.deletedFiles}\n`;
        message += `📁 **Empty folders deleted:** ${result.deletedFolders}\n`;
        message += `⏱️ **Duration:** ${duration}s (Fallback notification)`;

        await channel.send(message);
        console.log(
          `✅ Fallback cleanup notification sent from cluster ${
            getInfo().CLUSTER
          }`
        );
      }
    }

    console.log(
      `✅ Cleanup complete - Files: ${result.deletedFiles}, Folders: ${result.deletedFolders}, Duration: ${duration}s`
    );
  } catch (error) {
    console.error("❌ Error during cleanup:", error);

    // Send error notification via broadcast
    try {
      await client.cluster.broadcastEval(
        async (c, { channelId, errorMessage }) => {
          const channel = c.channels.cache.get(channelId);
          if (channel) {
            await channel.send(`❌ **Daily Cleanup Error:** ${errorMessage}`);
            return true;
          }
          return false;
        },
        { context: { channelId, errorMessage: error.message } }
      );
    } catch (broadcastError) {
      console.error("❌ Error broadcasting cleanup error:", broadcastError);
    }
  }
}

async function performCleanup() {
  const now = Date.now();
  const oneMonthInMs = 30 * 24 * 60 * 60 * 1000;
  let deletedFiles = 0;
  let deletedFolders = 0;
  const errors = [];

  if (!fs.existsSync(avatarsDir)) {
    console.log("📁 PFP directory doesn't exist, skipping cleanup");
    return { deletedFiles, deletedFolders, errors };
  }

  const users = fs
    .readdirSync(avatarsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  console.log(`🔍 Found ${users.length} user directories to check`);

  for (const userId of users) {
    const userDir = path.join(avatarsDir, userId);

    try {
      let files = [];
      try {
        files = fs.readdirSync(userDir).filter((file) => {
          try {
            const filePath = path.join(userDir, file);
            return fs.statSync(filePath).isFile();
          } catch (err) {
            errors.push(
              `Error checking file ${file} in ${userId}: ${err.message}`
            );
            return false;
          }
        });
      } catch (err) {
        errors.push(`Error reading directory ${userId}: ${err.message}`);
        continue;
      }

      // Delete old files
      for (const file of files) {
        try {
          const filePath = path.join(userDir, file);
          const fileStat = fs.statSync(filePath);

          if (now - fileStat.mtimeMs > oneMonthInMs) {
            if (PROTECTED_FILES.has(filePath)) {
              console.log(`🔒 Skipping protected file: ${userId}/${file}`);
              continue;
            }
            fs.unlinkSync(filePath);
            deletedFiles++;
            console.log(`🗑️ Deleted old file: ${userId}/${file}`);
          }
        } catch (err) {
          if (err.code !== "ENOENT") {
            errors.push(
              `Error deleting file ${userId}/${file}: ${err.message}`
            );
          }
        }
      }

      // Check if folder is now empty or was already empty
      const remainingFiles = fs.readdirSync(userDir).filter((file) => {
        try {
          const filePath = path.join(userDir, file);
          return fs.statSync(filePath).isFile();
        } catch {
          return false;
        }
      });

      // Delete empty folder regardless of age — empty avatar folders serve no purpose
      if (remainingFiles.length === 0) {
        try {
          fs.rmSync(userDir, { recursive: true, force: true });
          deletedFolders++;
          console.log(`📁 Deleted empty folder: ${userId}`);
        } catch (err) {
          if (err.code !== "ENOENT") {
            errors.push(`Error deleting folder ${userId}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Error processing user ${userId}: ${err.message}`);
    }
  }

  return { deletedFiles, deletedFolders, errors };
}

module.exports = { deleteOldFiles };
