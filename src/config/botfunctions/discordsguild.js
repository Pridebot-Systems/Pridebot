const axios = require("axios");
require("dotenv").config();
const { discordstoken } = process.env;

async function updateDiscordsCount(client) {
  if (client.cluster.id !== 0) return;

  try {
    const results = await client.cluster.broadcastEval(
      (c) => c.guilds.cache.size
    );
    const totalGuilds = results.reduce((a, b) => a + b, 0);

    await axios.post(
      `https://discords.com/bots/api/bot/1101256478632972369/setservers`,
      { server_count: totalGuilds },
      {
        headers: {
          Authorization: discordstoken,
          "Content-Type": "application/json",
        },
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
