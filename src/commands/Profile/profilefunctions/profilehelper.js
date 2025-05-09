const profile = require("./profile.json");

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
  badgeMap: profile.badges[0],
};
