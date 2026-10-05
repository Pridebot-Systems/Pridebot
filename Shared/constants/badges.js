const BADGES = {
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

function badgeImageURL(key) {
  const badge = BADGES[key];
  return badge ? `https://cdn.discordapp.com/emojis/${badge.emojiId}.png` : null;
}

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
