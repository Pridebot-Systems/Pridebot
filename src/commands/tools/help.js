const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows command list and helpful links"),

  async execute(interaction, client) {
    const channel = interaction.channel;

    if (!channel) {
      await interaction.reply(
        "The type of command you are trying to send can't be sent in User Install format. Please use this command again in a server where Pridebot is added. \nInvite link: https://pridebot.xyz/invite"
      );
      return;
    }

    const helpOptions = [
      {
        name: "Avatar",
        description: "Click to learn about avatar commands",
        value: "avatar",
        emoji: "1113295174701940776",
        info: {
          title: "Avatar Commands",
          description: `</avatar-list:1273988656561913906> - Get list of available flags to add\n</avatar-view:1301025323009441886> - View full list of your pride avatars\n</prideavatar:1273988656561913907> - Add a pride flag to your avatar\n\n**Quick Access:** Visit **https://pfp.pridebot.xyz/your_user_id** to view all your avatars\n*Replace "your_user_id" with your actual Discord user ID*`,
        },
      },
      {
        name: "Fun",
        description: "Click to learn about fun commands",
        value: "fun",
        emoji: "1196254858689380474",
        info: {
          title: "Fun Commands",
          description: `</gaydar:1273988656561913909> - How gay are you or your friend?\n</lgbtq:1273988656561913910> - Fun little command to show off the LGBTQ+ community\n</match:1273988656561913911> - Determine the compatibility between two users\n</nametester:1273988656561913912> - Try out new names for yourself\n</pronountester:1273988656561913913> - Try out new pronouns for yourself\n</queerdar:1273988656561913914> - How queer are you or your friend?\n</transdar:1273988656561913915> - How trans are you or your friend?\n</rizzdar:0> - How much rizz do you or your friend have?\n</bidar:0> - How bi are you or your friend?\n\n*These radar commands are for entertainment only and not based on any real diagnosis or readings of users.*`,
        },
      },
      {
        name: "Pride",
        description: "Click to learn about Pride commands",
        value: "pride",
        emoji: "1108822823721521242",
        info: {
          title: "Pride Commands",
          description: `</asexual:1273988656696135805> - Learn about the term "asexual" and its history\n</bisexual:1273988656696135806> - Learn about the term "bisexual" and its history\n</gay:1273988656696135807> - Learn about the term "gay" and its history\n</genderfluid:1273988656696135808> - Learn about the term "genderfluid" and its history\n</lesbian:1273988656696135809> - Learn about the term "lesbian" and its history\n</nonbinary:1273988656696135810> - Learn about the term "non-binary" and its history\n</pansexual:1273988656696135811> - Learn about the term "pansexual" and its history\n</pridemonth:1273988656839004280> - Learn about pride month and its history\n</queer:1273988656839004281> - Learn about the term "queer" and its history\n</transgender:1273988656839004282> - Learn about the term "transgender" and its history`,
        },
      },
      {
        name: "Profile",
        description: "Click to learn about Profile commands",
        value: "profile",
        emoji: "1197388214843998299",
        info: {
          title: "Profile Commands",
          description: `</profile edit:1273988656839004283> - Edit your profile appearance\n</profile setup:1273988656839004283> - Set up your profile\n</profile view:1273988656839004283> - View your or another user's profile\n</profile update:1273988656839004283> - Update the information in your profile`,
        },
      },
      {
        name: "Support",
        description: "Click to learn about Support commands",
        value: "support",
        emoji: "1197399653109473301",
        info: {
          title: "Support Commands",
          description: `</comingout:1273988656839004285> - Access tips and guides on how to come out safely\n</mentalhealth:1273988656839004287> - Access helplines and mental health resources\n</transresources:1273988656839004288> - Resources and advice for users of transgender identities`,
        },
      },
      {
        name: "Terms",
        description: "Click to learn about Term commands",
        value: "term",
        emoji: "1112602480128299079",
        info: {
          title: "Term Commands",
          description: `</gender:1273988656839004289> - Learn about different types of genders\n</other:1273988656956309647> - Learn about other terms commonly found in LGBTQIA+ spaces\n</pronouns:1273988656956309648> - Learn about different types of pronouns\n</sexuality:1273988656956309649> - Learn about different types of sexualities`,
        },
      },
      {
        name: "Tool",
        description: "Click to learn about Tool commands",
        value: "tool",
        emoji: "1112234548999245834",
        info: {
          title: "Tool Commands",
          description: `</donate:1317291535985016882> - Donate to help support Pridebot's development\n</help:1273988656956309650> - Shows command list and helpful links\n</partner:1273988656956309651> - Check out Pridebot's amazing partners\n</stats:1273988656956309652> - Get the bot's and Discord statistics\n</vote:1273988656956309653> - Support Pridebot by voting for us`,
        },
      },
    ];

    const selectOptions = helpOptions.map((option) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(option.name)
        .setDescription(option.description)
        .setValue(option.value)
        .setEmoji(option.emoji)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("helpSelect")
      .setPlaceholder("What commands you want to learn about?")
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Count total commands
    const totalCommands = helpOptions.reduce((count, category) => {
      // Rough count based on command mentions in descriptions
      const commandMatches = (category.info.description.match(/<\/\w+/g) || []).length;
      return count + commandMatches;
    }, 0);

    const embed = new EmbedBuilder()
      .setTitle(`🌈 Pridebot Help`)
      .setDescription(
        `Pridebot, developed by <@691506668781174824>, is a unique LGBTQIA+ themed bot designed to provide credible and accurate information on LGBTQIA+ identities and terms, while also helping users discover themselves through resources and interactive commands.\n\nPridebot offers a range of topics including different sexual orientations, gender identities, pronouns, and the intricate aspects of the LGBTQ+ community. Including the educational aspect, Pridebot also offers fun and engaging commands like radar games and profiles to help others learn about you.\n\n**${totalCommands}+ commands available** • Thank you for using Pridebot! ❤️`
      )
      .setColor(0xff00ae)
      .setThumbnail(client.user?.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: `Select a category below to explore commands • Developed with 💖`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp()
      .addFields(
        {
          name: "Help Categories",
          value:
            "**<:_:1113295174701940776> - Avatar \n<:_:1196254858689380474> - Fun \n<:_:1108822823721521242> - Pride \n<:_:1197388214843998299> - Profile \n<:_:1197399653109473301> - Support \n<:_:1112602480128299079> - Terms \n<:_:1112234548999245834> - Tool**",
          inline: true,
        },
        {
          name: "Useful links",
          value:
            "<:Ic_Pridebot_logo:1108228682184654908> [**Website**](https://pridebot.xyz/) \n<:Ic_Pridebot_discord:1108417509624926228> [**Support Server**](https://pridebot.xyz/support) \n<:_:1176002361580331029> [**TOS**](https://pridebot.xyz/tos) \n<:_:1255012892206567476> [**Privacy Policy**](https://pridebot.xyz/privacy) \n:link: [**Bot Invite**](https://pridebot.xyz/invite) \n<:Ic_Pridebot_git:1110925802041774151> [**Github Repo**](https://github.com/Sdriver1/Pridebot) \n<:Ic_Pridebot_donor:1235074804726628465> [**Patreon**](https://pridebot.xyz/premium)",
          inline: true,
        }
      );

    await interaction.reply({ embeds: [embed], components: [row] });
    await commandLogging(client, interaction);

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000, // 5 minutes timeout
      filter: (i) => i.user.id === interaction.user.id, // Only allow original user
    });

    collector.on("collect", async (selectInteraction) => {
      if (selectInteraction.customId === "helpSelect") {
        const selectedValue = selectInteraction.values[0];
        const helpInfo = helpOptions.find((h) => h.value === selectedValue);

        if (!helpInfo) {
          console.error(`No help information found for value: ${selectedValue}`);
          await selectInteraction.reply({
            content: "❌ Sorry, an error occurred while fetching help information.",
            ephemeral: true,
          });
          return;
        }

        const selectedEmbed = new EmbedBuilder()
          .setColor(0xff00ae)
          .setTitle(helpInfo.info.title)
          .setDescription(helpInfo.info.description)
          .setFooter({
            text: `Use /help to see all categories • ${helpInfo.name} Commands`,
          })
          .setTimestamp();

        await selectInteraction.reply({
          embeds: [selectedEmbed],
          ephemeral: true,
        });
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        // Disable the select menu after timeout
        const disabledRow = new ActionRowBuilder().addComponents(
          selectMenu.setDisabled(true)
        );
        interaction.editReply({ 
          embeds: [embed], 
          components: [disabledRow] 
        }).catch(() => {}); // Ignore errors if message was deleted
      }
    });
  },
};
