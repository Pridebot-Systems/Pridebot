const fs = require("fs");
const path = require("path");

const avatarsDir = path.join(__dirname, "../../pfps");

async function deleteOldFiles(client, channelId) {
  const now = Date.now();
  const oneMonthInMs = 30 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  let encounteredError = false;

  fs.readdir(avatarsDir, (err, users) => {
    if (err) {
      console.error("Error reading avatars directory:", err);
      encounteredError = true;
      return sendLog(`❌ Error reading avatars directory: ${err.message}`);
    }

    let totalFiles = 0;
    let processedFiles = 0;

    users.forEach((userId) => {
      const userDir = path.join(avatarsDir, userId);

      fs.readdir(userDir, (err, files) => {
        if (err) {
          console.error(`Error reading user directory (${userId}):`, err);
          encounteredError = true;
          return sendLog(
            `❌ Error reading user directory (${userId}): ${err.message}`
          );
        }

        totalFiles += files.length;

        files.forEach((file) => {
          const filePath = path.join(userDir, file);

          fs.stat(filePath, (err, stats) => {
            if (err) {
              if (err.code === "ENOENT") {
                processedFiles++;
                if (processedFiles === totalFiles) sendSummary();
                return;
              }

              console.error(`Error getting stats for file (${file}):`, err);
              encounteredError = true;
              return sendLog(
                `❌ Error getting stats for file (${file}): ${err.message}`
              );
            }

            if (now - stats.mtimeMs > oneMonthInMs) {
              fs.unlink(filePath, (err) => {
                if (err) {
                  if (err.code !== "ENOENT") {
                    console.error(`Error deleting file (${file}):`, err);
                    encounteredError = true;
                    sendLog(`❌ Error deleting file (${file}): ${err.message}`);
                  }
                } else {
                  deletedCount++;
                }

                processedFiles++;
                if (processedFiles === totalFiles) sendSummary();
              });
            } else {
              processedFiles++;
              if (processedFiles === totalFiles) sendSummary();
            }
          });
        });
      });
    });

    function sendSummary() {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        channel.send(
          `🧹 Cleanup complete! Deleted **${deletedCount}** old avatar file(s).`
        );
      } else {
        console.error("Channel not found for cleanup log.");
      }
    }

    function sendLog(message) {
      const channel = client.channels.cache.get(channelId);
      if (channel) channel.send(message).catch(console.error);
    }
  });
}

module.exports = { deleteOldFiles };
