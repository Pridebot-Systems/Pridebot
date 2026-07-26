require("dotenv").config();
const { token } = process.env;

async function getApplicationStats() {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/applications/1101256478632972369`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching application stats:", error);
    return null;
  }
}

async function getApproximateUserInstallCount() {
  const appStats = await getApplicationStats();
  return appStats?.approximate_user_install_count || "N/A";
}

module.exports = { getApproximateUserInstallCount };
