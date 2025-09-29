const AvatarGeneration = require("../../../mongo/models/avatarGenerationSchema");
const { getInfo } = require("discord-hybrid-sharding");

/**
 * Log avatar generation event for analytics and performance monitoring
 * @param {Object} data - Avatar generation data
 * @param {string} data.userID - User Discord ID
 * @param {string} data.username - User Discord username
 * @param {string} data.flagName - Primary flag name
 * @param {string} data.flagName2 - Secondary flag name (optional)
 * @param {number} data.processingTime - Time taken to process avatar in ms
 * @param {number} data.fileSize - Size of generated file in bytes
 * @param {boolean} data.cacheHit - Whether result was from cache
 * @param {number} data.totalCommandTime - Total command execution time in ms
 */
async function logAvatarGeneration(data) {
  try {
    const flagCombination = data.flagName2 
      ? `${data.flagName}+${data.flagName2}`
      : data.flagName;

    const logEntry = new AvatarGeneration({
      userID: data.userID,
      username: data.username,
      flagCombination,
      flags: {
        primary: data.flagName,
        secondary: data.flagName2 || null
      },
      performance: {
        processingTime: data.processingTime,
        fileSize: data.fileSize,
        cacheHit: data.cacheHit || false,
        totalCommandTime: data.totalCommandTime || 0
      },
      serverInfo: {
        cluster: getInfo().CLUSTER?.toString() || 'unknown',
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage().heapUsed
      }
    });

    await logEntry.save();
    
    // Log performance warning if processing was slow
    if (data.processingTime > 3000) {
      console.warn(`Slow avatar generation: ${data.processingTime}ms for ${data.userID} (${flagCombination})`);
    }
    
  } catch (error) {
    console.error('Failed to log avatar generation:', error);
    // Don't throw error to avoid breaking the main command
  }
}

/**
 * Get avatar generation analytics
 * @param {number} hours - Hours to look back (default: 24)
 * @returns {Promise<Object>} Analytics data
 */
async function getAvatarAnalytics(hours = 24) {
  try {
    const [popularFlags, performanceStats, flagCombinations] = await Promise.all([
      AvatarGeneration.getPopularFlags(10),
      AvatarGeneration.getPerformanceStats(hours),
      AvatarGeneration.getFlagCombinationStats()
    ]);

    return {
      timeRange: `${hours} hours`,
      popularFlags,
      performance: performanceStats[0] || {},
      flagCombinations,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get avatar analytics:', error);
    return {
      error: 'Analytics unavailable',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  logAvatarGeneration,
  getAvatarAnalytics,
};