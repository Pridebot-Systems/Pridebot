/**
 * What a profile exposes publicly.
 *
 * V1's GET /profile/:id and /profile/:username returned the raw Mongoose document
 * — including darHistory, darFixedValues, darMode, and darRange, none of which the
 * website reads. This lists the display fields the public profile page uses so the
 * API can project to exactly them and stop leaking dar internals.
 *
 * `ageVisible` and `premiumVisible` gate their fields; `badgesVisible` is applied
 * by the badge rendering, not here.
 */

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

/**
 * Custom website buttons (`customWebsites`, the LGBTQ++ "social links" perk).
 *
 * V1 validated none of this. `/profile view` puts every link in one Discord button
 * row after "Web Profile" and "Pronoun Page", and a row holds 5 — so a 4th link,
 * a label over Discord's 80 characters, or a URL without http(s) made the whole
 * command throw for that user.
 */
const SOCIAL_LINKS = {
  MAX: 3,
  LABEL_MAX: 80,
  URL_MAX: 512,
};

/** A cleaned { label, url }, or null when either part is invalid. */
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

/** Project a profile document to its public shape, honouring visibility flags. */
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
