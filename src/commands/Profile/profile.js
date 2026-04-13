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
  handleDisplay,
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
        .addStringOption(
          stringOptionWithChoices(
            "pronouns",
            "Your pronouns | If you go by multiple pronouns, there are more options in /profile update",
            pronounChoices,
            true
          )
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
            "Your sexual orientation | If you have multiple, there are more options in /profile update",
            sexualityChoices,
            false
          )
        )
        .addStringOption(
          stringOptionWithChoices(
            "romantic",
            "Your romantic orientation",
            romanticChoices,
            false
          )
        )
        .addStringOption(
          stringOptionWithChoices(
            "gender",
            "Your gender | If you identify with multiple genders, there are more options in /profile update",
            genderChoices,
            false
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
        .setName("display")
        .setDescription("Edit your profile's display settings")
        .addStringOption((option) =>
          option
            .setName("color")
            .setDescription(
              "Enter a valid hex code for your profile color (e.g. #FF00EA)"
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
            .setName("agetoggle")
            .setDescription("Toggle age visibility on your profile")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("premium")
        .setDescription("Manage premium features for your profile")
        .addStringOption((option) =>
          option
            .setName("website")
            .setDescription("Add/remove a custom website button from your profile")
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" }
            )
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("premiumtoggle")
            .setDescription("Toggle premium days display on your profile")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("premiumpicture")
            .setDescription("Upload a custom profile picture")
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.user.username;
    const idListsData = await idLists.findOne();
    const isPremiumUser = idListsData.donor.includes(interaction.user.id);

    switch (subcommand) {
      case "display":
        return handleDisplay(interaction, client);
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
