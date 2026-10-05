const FEATURES = {
  DAR_HISTORY: "darHistory",
  DAR_FIXED_VALUE: "darFixedValue",
  DAR_RANGE: "darRange",
  ANIMATED_AVATAR: "animatedAvatar",
  SOCIAL_LINKS: "socialLinks",
  PREMIUM_BADGE: "premiumBadge",
  LGBTQPP_BADGE: "lgbtqppBadge",
};

const TIERS = {
  supporter: {
    slug: "supporter",
    name: "Pridebot Supporter",
    patreonTierId: "22606797",
    badgeKey: "donor",
    fixedValueLimit: 1,
    features: [
      FEATURES.DAR_HISTORY,
      FEATURES.DAR_FIXED_VALUE,
      FEATURES.PREMIUM_BADGE,
    ],
    perks: [
      "Dar history — your last 90 results",
      "1 fixed dar value slot",
      "Supporter badge on your profile",
    ],
  },
  lgbtqpp: {
    slug: "lgbtqpp",
    name: "Pridebot LGBTQ++",
    patreonTierId: "24609755",
    badgeKey: "donorplus",
    fixedValueLimit: 3,
    features: [
      FEATURES.DAR_HISTORY,
      FEATURES.DAR_FIXED_VALUE,
      FEATURES.DAR_RANGE,
      FEATURES.ANIMATED_AVATAR,
      FEATURES.SOCIAL_LINKS,
      FEATURES.PREMIUM_BADGE,
      FEATURES.LGBTQPP_BADGE,
    ],
    perks: [
      "Dar history — your last 90 results",
      "3 fixed dar value slots",
      "Custom dar range (-500 to 500)",
      "Animated profile avatar",
      "Social links on your profile",
      "LGBTQ++ badge on your profile",
    ],
  },
};

const TIER_SLUGS = Object.keys(TIERS);
const DAR_COMMANDS = ["gaydar", "transdar", "queerdar", "rizzdar", "lesdar", "bidar"];
const DAR = {
  DEFAULT_MIN: 0,
  DEFAULT_MAX: 100,
  RANGE_MIN: -500,
  RANGE_MAX: 500,
  HISTORY_LIMIT: 90,
  MODES: ["rng", "fixed", "range"],
};

const PATREON_TIER_TO_SLUG = Object.fromEntries(
  TIER_SLUGS.map((slug) => [TIERS[slug].patreonTierId, slug])
);

const PATREON_TIER_TO_NAME = Object.fromEntries(
  TIER_SLUGS.map((slug) => [TIERS[slug].patreonTierId, TIERS[slug].name])
);

function getTierConfig(slug) {
  return TIERS[slug] || null;
}

function tierHasFeature(slug, feature) {
  return TIERS[slug]?.features.includes(feature) ?? false;
}

function getFixedValueLimit(slug) {
  return TIERS[slug]?.fixedValueLimit ?? 0;
}

module.exports = {
  FEATURES,
  TIERS,
  TIER_SLUGS,
  DAR,
  DAR_COMMANDS,
  PATREON_TIER_TO_SLUG,
  PATREON_TIER_TO_NAME,
  getTierConfig,
  tierHasFeature,
  getFixedValueLimit,
};
