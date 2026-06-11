const ProfileData = require("../../mongo/models/profileSchema");

const TIER_FEATURES = {
  supporter: ["darHistory", "darFixedValue", "premiumBadge"],
  lgbtqpp: ["darHistory", "darFixedValue", "darRange", "animatedAvatar", "socialLinks", "premiumBadge", "lgbtqppBadge"],
};

async function getTier(userId) {
  try {
    const profile = await ProfileData.findOne({ userId });
    return profile?.premiumTier || null;
  } catch (err) {
    console.error("[PREMIUM] getTier error:", err);
    return null;
  }
}

async function hasFeature(userId, feature) {
  try {
    const tier = await getTier(userId);
    if (!tier) return false;
    return TIER_FEATURES[tier]?.includes(feature) ?? false;
  } catch (err) {
    console.error("[PREMIUM] hasFeature error:", err);
    return false;
  }
}

async function getDarResult(userId) {
  try {
    const profile = await ProfileData.findOne({ userId });
    const tier = profile?.premiumTier;
    const tierFeatures = TIER_FEATURES[tier] || [];
    const mode = profile?.darMode || "rng";

    if (mode === "fixed" && tierFeatures.includes("darFixedValue") && profile.darFixedValue !== null && profile.darFixedValue !== undefined) {
      return { min: profile.darFixedValue, max: profile.darFixedValue, fixed: true, useDarList: false };
    }
    if (mode === "range" && tier === "lgbtqpp") {
      return { min: profile.darRangeMin, max: profile.darRangeMax, fixed: false, useDarList: false };
    }
    // Premium users in rng mode get a fresh roll every time; free users keep DarList consistency
    return { min: 0, max: 100, fixed: false, useDarList: !tier };
  } catch (err) {
    console.error("[PREMIUM] getDarResult error:", err);
    return { min: 0, max: 100, fixed: false, useDarList: true };
  }
}

function applyDarRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function addDarHistory(userId, command, result) {
  try {
    const eligible = await hasFeature(userId, "darHistory");
    if (!eligible) return;

    const profile = await ProfileData.findOne({ userId });
    if (!profile) return;

    profile.darHistory.push({ command, result, timestamp: new Date() });
    if (profile.darHistory.length > 90) {
      profile.darHistory = profile.darHistory.slice(-90);
    }
    await profile.save();
  } catch (err) {
    console.error("[PREMIUM] addDarHistory error:", err);
  }
}

module.exports = { getTier, hasFeature, getDarResult, applyDarRange, addDarHistory };
