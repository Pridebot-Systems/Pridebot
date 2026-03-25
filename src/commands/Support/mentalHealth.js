const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mentalhealth")
    .setDescription("Provides mental health resources")
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Set to true to make the response visible to everyone")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle("Crisis Help Channel Resources & Hotlines")
      .setColor(0xff00ae)
      .addFields(
        {
          name: "Crisis Hotlines (U.S.-Based)",
          value:
            "**<:I_Pridebot_988:1486467022979334405> Suicide & Crisis Lifeline**\n- Call OR Text **988**\n- https://988lifeline.org/\n\n" +
            "**<:I_Pridebot_trevorproject:1486467041815957735> Trevor Project Lifeline**\n- +1 (866) 488-7386\n- https://www.thetrevorproject.org/resources/guide/preventing-suicide/\n\n" +
            "**<:I_Pridebot_translifeline:1486467038766694492> Trans Lifeline**\n- +1 (877) 565-8860\n- https://translifeline.org/\n\n" +
            "**<:I_Pridebot_samhsa:1486467049139077241> Substance Abuse and Mental Health Services Hotline (SAMHSA)**\n- +1 (800) 622-4357\n- https://samhsa.gov/\n\n" +
            "**<:I_Pridebot_ndvh:1486467032605266032> National Domestic Violence Hotline**\n- +1 (800) 799-7233\n- TTY: +1 (800) 787-3224\n- https://thehotline.org/\n\n" +
            "**<:I_Pridebot_rainn:1486467045473386777> National Sexual Assault Hotline**\n- +1 (800) 656-4673\n- https://hotline.rainn.org/online\n\n" +
            "**<:I_Pridebot_ncah:1486467029434237110> Child Help National Child Abuse Hotline**\n- +1 (800) 422-4453\n- https://childhelphotline.org/\n\n" +
            "**<:I_Pridebot_neda:1486467035612451039> National Eating Disorder Association (NEDA) Helpline**\n- +1 (800) 931-2237\n- https://nationaleatingdisorders.org/",
        },
        {
          name: "Crisis Textlines (U.S.-Based)",
          value:
            "**<:I_Pridebot_trevorproject:1486467041815957735> The Trevor Project**\n- Text **START** to **678-678**\n- https://www.thetrevorproject.org/resources/guide/preventing-suicide/\n\n" +
            "**<:I_Pridebot_crisistextline:1486467026355617853> Crisis Text Line**\n- Text **DISCORD** to **741-741**\n- https://crisistextline.org/",
        },
        {
          name: "All Other Non-U.S. Crisis & Suicide Help Channel Resources",
          value:
            "**SwitchBoard (Europe)** \n- Available from **<t:1672567200:t>** to **<t:1672610400:t>** everyday\n- SwitchBoard LgbtLine - **0800 0119 100** \n- SwitchBoard Email - **hello@switchboard.lgbt**\n- [SwitchBoard](https://switchboard.lgbt/)\n- [How we can help](https://switchboard.lgbt/how-we-can-help/)\n\n" +
            "**<:I_Pridebot_crisistextline:1486467026355617853> International Crisis Lines** \n- https://en.wikipedia.org/wiki/List_of_suicide_crisis_lines\n- http://worldhelplines.org/",
        }
      )
      .setFooter({
        text: "Remember, you are not alone and loved ❤️",
      });

    const isPublic = interaction.options.getBoolean("public", false);

    await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
    await commandLogging(client, interaction);
  },
};
