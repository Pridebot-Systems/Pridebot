const ProfileData = require("../../DB/models/profileSchema");
const DarList = require("../../DB/models/idDarSchema");

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
          // Enforce the CURRENT tier at read time. A user who drops from LGBTQ++
          // (3 slots, -500..500) to Supporter (1 slot, 0..100) keeps their stored
          // values for a re-upgrade, but only the first slot counts, clamped to
          // the Supporter range. V1 kept honouring all 3 at their old values.
          const active = [...(profile?.darFixedValues?.entries() ?? [])]
            .filter(([, value]) => value !== null && value !== undefined)
            .slice(0, getFixedValueLimit(tier));
          const entry = active.find(([cmd]) => cmd === commandName);
          if (entry) {
            const [lo, hi] = tier === "lgbtqpp" ? [-500, 500] : [0, 100];
            const value = Math.min(hi, Math.max(lo, entry[1]));
            return { min: value, max: value, fixed: true, pin: null };
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

// Dev-set pins can be text ("morbius", "absolutely no") rather than a number.
// Every locale string reads "{{meter}}% <label>!", so a text pin would trail a
// stray percent sign - drop it for those and leave numeric results untouched.
const DAR_METER_TOKEN = "{{meter}}";

function isNumericMeter(meter) {
  if (typeof meter === "number") return Number.isFinite(meter);
  if (typeof meter !== "string") return false;
  return meter.trim() !== "" && Number.isFinite(Number(meter));
}

function formatDarMeter(meter) {
  return String(meter).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function buildDarDescription(template, mention, meter, display) {
  const text = display ?? formatDarMeter(meter);
  const numeric = isNumericMeter(String(text).replace(/,/g, ""));
  const resolved = numeric
    ? template
    : template.replace(`${DAR_METER_TOKEN}%`, DAR_METER_TOKEN);

  return resolved
    .replace("{{mention}}", mention)
    .replace(DAR_METER_TOKEN, text);
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
  formatDarMeter,
  buildDarDescription,
  DAR_COMMANDS,
};
