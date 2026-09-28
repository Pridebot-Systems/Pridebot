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

module.exports = { PUBLIC_PROFILE_FIELDS, toPublicProfile };
