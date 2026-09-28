/**
 * The badge registry — single source of truth.
 *
 * In V1 this was defined three times and all three had drifted:
 *   - Bot:  src/commands/Profile/profilefunctions/profile.json  (10 keys, emoji)
 *   - Web:  web/assets/js/profiles.js  (9 keys, CDN URLs — missing `donorplus`,
 *           and its emoji IDs were a stale generation ahead of the bot's)
 *   - API:  src/apis/profileapi.js /badges  (8 keys — missing `donorplus` AND
 *           `easteregg`, so the API never reported two badges the bot rendered)
 *
 * The authoritative key set is the IDLists schema (DB/models/idSchema.js): a
 * badge exists iff there is an ID array for it. Adding a badge is now one entry
 * here plus one array there.
 */

const BADGES = {
  // `order` matches the bot's V1 profile.json, which is what users see today.
  bot:       { name: "Pridebot",            emojiId: "1486524439423225946", order: 0 },
  discord:   { name: "Discord Staff",       emojiId: "1486466874186399894", order: 1 },
  devs:      { name: "Developer",           emojiId: "1486467084836798474", order: 2 },
  oneyear:   { name: "1 Year Anniversary",  emojiId: "1486467148200017972", order: 3 },
  support:   { name: "Support Team",        emojiId: "1486467104877318225", order: 4 },
  vips:      { name: "Verified",            emojiId: "1486467095414837380", order: 5 },
  partner:   { name: "Partner",             emojiId: "1486467101609693184", order: 6 },
  donor:     { name: "Donor",               emojiId: "1486467151794540685", order: 7 },
  donorplus: { name: "Donor+",              emojiId: "1486467091321065734", order: 8 },
  easteregg: { name: "Easter Egg Hunter",   emojiId: "1486467172627648532", order: 9 },
};

/** Every badge key, in display order. This is the list `/badges` must filter over. */
const BADGE_KEYS = Object.keys(BADGES).sort((a, b) => BADGES[a].order - BADGES[b].order);

/** Discord message/embed form, e.g. `<:_:1486524439423225946>` — bot-side rendering. */
function badgeEmoji(key) {
  const badge = BADGES[key];
  return badge ? `<:_:${badge.emojiId}>` : "";
}

/** Image form — web-side rendering. Derived from the same ID, so it cannot drift. */
function badgeImageURL(key) {
  const badge = BADGES[key];
  return badge ? `https://cdn.discordapp.com/emojis/${badge.emojiId}.png` : null;
}

/**
 * Resolve a user's badges from an IDLists document.
 * Shared by the bot embed, the `/badges` endpoint, and the profile page.
 */
function resolveBadges(idLists, userId) {
  if (!idLists) return [];
  return BADGE_KEYS.filter(
    (key) => Array.isArray(idLists[key]) && idLists[key].includes(userId)
  );
}

module.exports = {
  BADGES,
  BADGE_KEYS,
  badgeEmoji,
  badgeImageURL,
  resolveBadges,
};
