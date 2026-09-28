const profile = require("./profile.json");
const { badges } = require("../../../Shared");

// Same shape V1 read from profile.json ({ key: "<:_:id> " }), now derived from the
// shared registry so the bot, the /badges API, and the profile page agree.
const badgeMap = Object.fromEntries(
  badges.BADGE_KEYS.map((key) => [key, `${badges.badgeEmoji(key)} `])
);

const stringOptionWithChoices =
  (name, description, choices, required = false) =>
  (option) =>
    option
      .setName(name)
      .setDescription(description)
      .setRequired(required)
      .addChoices(...choices);

module.exports = {
  stringOptionWithChoices,
  sexualityChoices: profile.sexuality,
  romanticChoices: profile.romantic,
  genderChoices: profile.gender,
  pronounChoices: profile.pronouns,
  badgeMap,
};
