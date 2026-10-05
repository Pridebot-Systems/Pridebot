const PUBLIC_PROFILE_FIELDS = [
  "userId",
  "username",
  "preferredName",
  "bio",
  "sexuality",
  "otherSexuality",
  "romanticOrientation",
  "gender",
  "otherGender",
  "pronouns",
  "otherPronouns",
  "color",
  "pfp",
  "pronounpage",
  "customWebsites",
  "customAvatars",
  "badgesVisible",
];

const SOCIAL_LINKS = {
  MAX: 3,
  LABEL_MAX: 80,
  URL_MAX: 512,
};

function parseSocialLink(link) {
  const label = typeof link?.label === "string" ? link.label.trim() : "";
  const url = typeof link?.url === "string" ? link.url.trim() : "";
  if (!label || label.length > SOCIAL_LINKS.LABEL_MAX) return null;
  if (!url || url.length > SOCIAL_LINKS.URL_MAX) return null;
  try {
    const { protocol } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { label, url };
}

function toPublicProfile(profile) {
  if (!profile) return null;
  const source = typeof profile.toObject === "function" ? profile.toObject() : profile;
  const out = {};
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  if (source.ageVisible !== false && source.age) out.age = source.age;
  if (source.premiumVisible !== false) {
    out.premiumMember = source.premiumMember || false;
    out.premiumTier = source.premiumTier || null;
    if (source.premiumSince) out.premiumSince = source.premiumSince;
  }
  return out;
}

module.exports = {
  PUBLIC_PROFILE_FIELDS,
  SOCIAL_LINKS,
  parseSocialLink,
  toPublicProfile,
};
