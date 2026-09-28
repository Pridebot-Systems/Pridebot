const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const commandLogging = require("../../utils/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("comingout")
    .setDescription("Provides resources and advice for coming out.")
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(0xff00ae)
      .setTitle("Coming Out Resources")
      .setDescription(
        "Coming out is a unique and personal experience. Here are some resources you might find helpful:"
      )
      .addFields(
        {
          name: "Human Rights Campaign",
          value:
            "[Guide to Coming Out](https://www.hrc.org/resources/coming-out)",
          inline: true,
        },
        {
          name: "GLAAD",
          value: "[Tips for Coming Out](https://www.glaad.org/comingout)",
          inline: true,
        },
        {
          name: "PFLAG",
          value: "[Support for Coming Out](https://pflag.org/needsupport)",
          inline: true,
        },
        {
          name: "Coming out tips for teens",
          value:
            "**LGBTQ+ Student Center** - [Coming Out Tips](https://lgbtqplus.usc.edu/resources/comingout/tips/)\n **SafeTeens** - [SafeTeens LGBTQ+ Coming Out](https://safeteens.org/lgbtq/coming-out/)\n **Planned Parenthood** - [Coming Out for Teens](https://www.plannedparenthood.org/learn/teens/lgbtq/coming-out)",
          inline: true,
        },
        {
          name: "Coming out tips for everyone",
          value:
            "**Stonewall** - [Coming Out as an Adult](https://www.stonewall.org.uk/help-advice/coming-out/coming-out-as-an-adult)\n **Stonybrook Medicine** - [Tips for Coming Out](https://www.stonybrookmedicine.edu/LGBTQ/tips-for-coming-out)\n **The Trevor Project** - [The Coming Out Handbook](https://www.thetrevorproject.org/resources/guide/the-coming-out-handbook/)",
          inline: true,
        },
        {
          name: "YouTube Videos on coming out",
          value:
            "**Advice for LGBTQ+ Teens** - [Watch Video](https://www.youtube.com/watch?v=RxK_gMk1qTk) \n**8 Coming Out Tips** - [Watch Video](https://www.youtube.com/watch?v=DbiXhMUwlJA) \n**Teen Coming Out Stories** - [Watch Video](https://www.youtube.com/watch?v=lhkuYGZyp_o)",
          inline: false,
        }
      )
      .setFooter({
        text: "Remember, your journey is yours and you are not alone.",
      });

    const isPublic = interaction.options.getBoolean("public", false);

    await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
    await commandLogging(client, interaction);
  },
};
