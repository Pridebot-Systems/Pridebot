const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transresources")
    .setDescription(
      "Provides resources and advice for users of transgender identities."
    )
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone.")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(0xff00ae)
      .setTitle("Transgender Resources")
      .setDescription(
        "Here are some supportive resources and contacts for transgender individuals."
      )
      .addFields(
        {
          name: "Trans Lifelines",
          value:
            "- US: [Trans Lifeline](https://translifeline.org/)\n- UK: [TransAcademics Helplines](https://www.trans.ac.uk/ResourcesInformation/Helplines/tabid/7257/Default.aspx)",
          inline: false,
        },
        {
          name: "Info on Transitioning",
          value:
            "- [GLAAD Transgender Resources](https://www.glaad.org/transgender/resources)\n- [Planned Parenthood - Transgender Healthcare](https://www.plannedparenthood.org/learn/gender-identity/transgender)",
          inline: false,
        },
        {
          name: "Binder Programs",
          value:
            "- [Point of Pride Free Chest Binders](https://www.pointofpride.org/free-chest-binders)\n- [ATRH Binder Program](https://www.atrh.org/binder-program)",
          inline: false,
        },
        {
          name: "Understanding Dysphoria & Being Trans",
          value:
            "- [Gender Dysphoria FYI](https://genderdysphoria.fyi/en/)\n- [Trevor Project - Ally Guide](https://www.thetrevorproject.org/resources/guide/a-guide-to-being-an-ally-to-transgender-and-nonbinary-youth/)",
          inline: false,
        },
        {
          name: "Trans-Friendly Clothing",
          value:
            "- [Point 5cc Clothing](https://point5cc.com)\n- [gc2b Transitional Apparel](https://www.gc2b.co/)\n- [The Phluid Project](https://thephluidproject.com)",
          inline: false,
        },
        {
          name: "Trans Discord Servers",
          value:
            "- <:Ic_Pridebot_partnerblurple:1486467167733153944> [Trans Community Center](https://discord.gg/transcc) - 10k+ \n- [Trans Space](https://discord.gg/trans) - 10k+ \n- [The Orchard](https://discord.gg/theorchard) - 12k+",
          inline: false,
        }
      )
      .setFooter({
        text: "These resources are here to support you on your journey. You are not alone.",
      });

    const isPublic = interaction.options.getBoolean("public", false);

    await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
    await commandLogging(client, interaction);
  },
};
