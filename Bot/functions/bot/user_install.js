const config = require("../../../environment");

async function getApplicationStats() {
  try {
    const response = await fetch(
      "https://discord.com/api/v10/applications/@me",
      {
        headers: {
          Authorization: `Bot ${config.token}`,
        },
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
