require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("partner")
    .setDescription("Check out Pridebot partners"),

  async execute(interaction, client) {
    let pridecordtotal = "Unknown";
    let pridecordIcon = null;

    if (client.cluster && client.cluster.ready) {
        const results = await client.cluster.broadcastEval((c) => {
          const guild = c.guilds.cache.get("1077258761443483708");
          if (guild) {
            return {
              memberCount: guild.memberCount,
              icon: guild.iconURL({ dynamic: true, size: 512 }),
            };
          }
          return null;
        });

        const found = results.find((r) => r !== null);
        if (found) {
          pridecordtotal = found.memberCount;
          pridecordIcon = found.icon;
        } else {
          console.error(
            "Guild with ID 1077258761443483708 not found on any cluster.",
          );
        }
      } else {
        const guild = client.guilds.cache.get("1077258761443483708");
        if (guild) {
          pridecordtotal = guild.memberCount;
          pridecordIcon = guild.iconURL({ dynamic: true, size: 512 });
        }
      }

    const pridecordembed = new EmbedBuilder()
      .setTitle("Pridebot Partner: Pridecord")
      .setColor(0xff00ae)
      .setThumbnail(pridecordIcon)
      .addFields({
        name: "Info",
        value: `**Server Owner**: <@288897433805651968> \n**Member Count**: ${pridecordtotal} \n**Server Invite**: https://discord.gg/lgbtqia \n**Server Description**: We're a vibrant and inclusive Discord server that centers on LGBTQ+ pride. The server provides a safe and welcoming space for individuals of all genders, sexual orientations, and identities to connect, share experiences, and celebrate their diversity. Members of Pridecord can join various channels dedicated to different topics, such as coming out, mental health, and many more. You can also participate in community events, including game nights, and discussions on LGBTQ+ issues. With a supportive community, resources, and a plethora of opportunities to connect with others, Pridecord is an excellent space for anyone looking to celebrate and embrace their LGBTQ+ identity`,
        inline: false,
      })
      .setFooter({ text: "Pridecord", iconURL: pridecordIcon })
      .setTimestamp();

    await interaction.reply({ embeds: [pridecordembed] });
    await commandLogging(client, interaction);
  },
};
