const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const commandLogging = require("../../config/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar-list")
    .setDescription("List all available flags for the avatar command"),
    
  async execute(interaction, client) {
    const validFlags = [
      "abrosexual",
      "aceflux",
      "agender",
      "ally",
      "androgyne",
      "aroace",
      "aroace2",
      "aroflux",
      "aromantic",
      "asexual",
      "aurorian",
      "bigender",
      "bisexual",
      "boyflux",
      "butch",
      "butchlesbian",
      "butchlesbian2",
      "butchlesbian3",
      "catgender",
      "cupioromantic",
      "demibisexual",
      "demiboy",
      "demigirl",
      "deminonbinary",
      "demiromantic",
      "demisexual",
      "gay",
      "genderfae",
      "genderfaun",
      "genderfluid",
      "genderflux",
      "genderqueer",
      "girlflux",
      "graygender",
      "grayromantic",
      "graysexual",
      "lesbian",
      "lesboy",
      "lgbt",
      "lunarian",
      "neptunic",
      "nonbinary",
      "omnisexual",
      "pangender",
      "pansexual",
      "polyamorous",
      "polysexual",
      "queer",
      "queerplatonic",
      "queerplatonic2",
      "sapphic",
      "selenosexual",
      "singularian",
      "solarian",
      "spacilian",
      "stellarian",
      "transfeminine",
      "transgender",
      "transmasculine",
    ];

    const embed = new EmbedBuilder()
      .setTitle("Available Flags")
      .setDescription(validFlags.join(", "))
      .setColor("#FF00EA")
      .setTimestamp();

    await commandLogging(client, interaction);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
