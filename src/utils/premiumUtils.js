const ProfileData = require("../../mongo/models/profileSchema");
const DarList = require("../../mongo/models/idDarSchema");

const DAR_COMMANDS = ["gaydar", "transdar", "queerdar", "rizzdar", "lesdar", "bidar"];

// The DarList is a single small document of dev-set overrides, read on every dar
// command — cache it rather than round-tripping. `darID` invalidates on write.
const DAR_PIN_TTL = 60 * 1000;
let darPinCache = null;
let darPinCachedAt = 0;

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

function getFixedValueLimit(tier) {
  switch (tier) {
    case "lgbtqpp": return 3;
    case "supporter": return 1;
    default: return 0;
  }
}

async function loadDarPins() {
  const now = Date.now();
  if (darPinCache && now - darPinCachedAt < DAR_PIN_TTL) return darPinCache;

  const doc = await DarList.findOne().lean();
  const pins = new Map();
  for (const command of DAR_COMMANDS) {
    for (const entry of doc?.[command] || []) {
      pins.set(`${command}:${entry.userid}`, entry.meter);
    }
  }

  darPinCache = pins;
  darPinCachedAt = now;
  return pins;
}

async function getDarPin(userId, commandName) {
  try {
    const pins = await loadDarPins();
    return pins.get(`${commandName}:${userId}`) ?? null;
  } catch (err) {
    console.error("[PREMIUM] getDarPin error:", err);
    return null;
  }
}

function invalidateDarPins() {
  darPinCache = null;
}

async function getDarResult(userId, commandName) {
  const pin = await getDarPin(userId, commandName);
  if (pin !== null) return { min: 0, max: 100, fixed: true, pin };

  try {
    const profile = await ProfileData.findOne({ userId });
    const tier = profile?.premiumTier;
    const tierFeatures = TIER_FEATURES[tier] || [];
    const mode = profile?.darMode || "rng";

    switch (mode) {
      case "fixed": {
        if (tierFeatures.includes("darFixedValue")) {
          const fixedValue = profile?.darFixedValues?.get(commandName) ?? null;
          if (fixedValue !== null && fixedValue !== undefined) {
            return { min: fixedValue, max: fixedValue, fixed: true, pin: null };
          }
        }

        break;
      }

      case "range": {
        if (tier === "lgbtqpp") {
          return { min: profile.darRangeMin, max: profile.darRangeMax, fixed: false, pin: null };
        }

        break;
      }
    }

    return { min: 0, max: 100, fixed: false, pin: null };
  } catch (err) {
    console.error("[PREMIUM] getDarResult error:", err);
    return { min: 0, max: 100, fixed: false, pin: null };
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

module.exports = {
  getTier,
  hasFeature,
  getDarResult,
  applyDarRange,
  addDarHistory,
  getFixedValueLimit,
  getDarPin,
  invalidateDarPins,
  DAR_COMMANDS,
};
