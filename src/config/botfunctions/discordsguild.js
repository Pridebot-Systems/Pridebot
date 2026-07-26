require("dotenv").config();
const { discordstoken } = process.env;

async function updateDiscordsCount(client) {
  if (client.cluster.id !== 0) return;

  try {
    const results = await client.cluster.broadcastEval(
      (c) => c.guilds.cache.size
    );
    const totalGuilds = results.reduce((a, b) => a + b, 0);

    await fetch(
      `https://discords.com/bots/api/bot/1101256478632972369/setservers`,
      {
        method: "POST",
        headers: {
          Authorization: discordstoken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ server_count: totalGuilds })
      }
    );
  } catch (error) {
    console.error(
      "Error updating server count:",
      error.response?.data || error.message
    );
  }
}

module.exports = { updateDiscordsCount };
