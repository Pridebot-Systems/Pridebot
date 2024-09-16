const axios = require("axios");
require("dotenv").config();
const { token } = process.env;

async function getApplicationStats(client) {
  try {
    const response = await axios.get(
      `https://discord.com/api/v10/applications/1101256478632972369`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching application stats:");
    return null;
  }
}

async function getApproximateUserInstallCount(client) {
  const appStats = await getApplicationStats(client);
  return appStats?.approximate_user_install_count || "N/A";
}

module.exports = { getApproximateUserInstallCount };
