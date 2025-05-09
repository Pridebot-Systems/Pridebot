const { SlashCommandBuilder } = require("discord.js");

const idLists = require("../../../mongo/models/idSchema");

const {
  sexualityChoices,
  romanticChoices,
  genderChoices,
  pronounChoices,
  stringOptionWithChoices,
} = require("./profilefunctions/profilehelper");
const {
  handleEdit,
  handleView,
  handleUpdate,
  handleSetup,
  handlePremium,
} = require("./profilefunctions/profilehandlers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Displays, updates, or sets up your profile")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View your or someone else's profile")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user whose profile you want to view")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update your profile")
        .addStringOption((option) =>
          option
            .setName("preferredname")
            .setDescription("Your preferred name")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("bio")
            .setDescription("Your bio | Add a new line with \\n")
            .setMaxLength(1024)
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName("age")
            .setDescription(
              "Your age (Ages: 13-99 | 0 for N/A | any other numbers will not be allowed)"
            )
            .setRequired(false)
        )
        .addStringOption(
          stringOptionWithChoices(
            "sexuality",
            "Your sexual orientation",
            sexualityChoices
          )
        )
        .addStringOption(
          stringOptionWithChoices(
            "romantic",
            "Your romantic orientation",
            romanticChoices
          )
        )
        .addStringOption(
          stringOptionWithChoices("gender", "Your gender", genderChoices)
        )
        .addStringOption(
          stringOptionWithChoices("pronouns", "Your pronouns", pronounChoices)
        )
        .addStringOption(
          stringOptionWithChoices(
            "other_sexuality",
            "Another sexual orientation",
            [...sexualityChoices, { name: "Clear", value: "clear" }]
          )
        )
        .addStringOption(
          stringOptionWithChoices("other_gender", "Another gender", [
            ...genderChoices,
            { name: "Clear", value: "clear" },
          ])
        )
        .addStringOption(
          stringOptionWithChoices(
            "other_pronouns",
            "add another set of pronouns",
            [...pronounChoices, { name: "Clear", value: "clear" }]
          )
        )
        .addStringOption((option) =>
          option
            .setName("pronounpage")
            .setDescription("A link to your pronoun page")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Set up your profile")
        .addStringOption((option) =>
          option
            .setName("preferredname")
            .setDescription("Your preferred name")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("bio")
            .setDescription("Your bio | Add a new line with \\n")
            .setMaxLength(1024)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("age")
            .setDescription(
              "Your age (Ages: 13-99 | 0 for N/A | any other numbers will not be allowed)"
            )
            .setRequired(true)
        )
        .addStringOption(
          stringOptionWithChoices(
            "sexuality",
            "Your sexual orientation",
            sexualityChoices,
            true
          )
        )
        .addStringOption(
          stringOptionWithChoices(
            "romantic",
            "Your romantic orientation",
            romanticChoices,
            true
          )
        )
        .addStringOption(
          stringOptionWithChoices("gender", "Your gender", genderChoices, true)
        )
        .addStringOption(
          stringOptionWithChoices(
            "pronouns",
            "Your pronouns",
            pronounChoices,
            true
          )
        )
        .addStringOption((option) =>
          option
            .setName("pronounpage")
            .setDescription("A link to your pronoun page")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit part of your profile")
        .addStringOption((option) =>
          option
            .setName("color")
            .setDescription(
              "Enter in valid hex code for custom color for your profile (#{your code}"
            )
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("badgetoggle")
            .setDescription("Toggle badge visibility on your profile")
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("premiumtoggle")
            .setDescription("*PREMIUM ONLY* Toggle premium days on your profile")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("premium")
        .setDescription("Manage premium feature for your profile")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.user.username;
    const idListsData = await idLists.findOne();
    const isPremiumUser = idListsData.donor.includes(interaction.user.id);

    switch (subcommand) {
      case "edit":
        return handleEdit(interaction, client);
      case "view":
        return handleView(interaction, client);
      case "update":
        return handleUpdate(interaction, client, username);
      case "setup":
        return handleSetup(interaction, client, username);
      case "premium":
        if (!isPremiumUser) {
          return interaction.reply({
            content:
              "You need to be a premium user to use this command. \nYou can get premium by donating to the bot at https://pridebot.xyz/premium",
            ephemeral: true,
          });
        } else {
          return handlePremium(interaction, client);
        }
      default:
        return interaction.reply({
          content: "Unknown subcommand used.",
          ephemeral: true,
        });
    }
  },
};
