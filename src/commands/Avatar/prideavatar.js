const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const commandLogging = require("../../config/logging/commandlog");

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prideavatar")
    .setDescription("Add a pride flag to your avatar")
    .addStringOption((option) =>
      option
        .setName("flag")
        .setDescription(
          "The pride flag to overlay (For a full list of flags, do /avatar-list)"
        )
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("flag2")
        .setDescription(
          "Add a second flag (For a full list of flags, do /avatar-list)"
        )
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Change another user's avatar")
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const substring = focusedOption.value.toLowerCase();
    let choices = validFlags.filter((flag) =>
      flag.toLowerCase().includes(substring)
    );

    choices = choices.slice(0, 25);

    await interaction.respond(
      choices.map((choice) => ({
        name: choice,
        value: choice,
      }))
    );
  },

  async execute(interaction, client) {
    try {
      await interaction.deferReply();

      const pfpuser = interaction.options.getUser("user") || interaction.user;
      const username = pfpuser.username;
      const avatarURL = pfpuser.displayAvatarURL({ format: "webp", size: 512 });
      const flagName = interaction.options.getString("flag").toLowerCase();
      const flagName2 = interaction.options.getString("flag2")?.toLowerCase();

      if (
        !validFlags.includes(flagName) ||
        (flagName2 && !validFlags.includes(flagName2))
      ) {
        await interaction.editReply(
          `Invalid flag name. Please choose from: ${validFlags.join(", ")}`
        );
        return;
      }

      let avatarBuffer;
      try {
        const response = await axios.get(avatarURL, {
          responseType: "arraybuffer",
        });
        avatarBuffer = await sharp(response.data)
          .resize(412, 412)
          .composite([
            {
              input: Buffer.from(
                `<svg><circle cx="206" cy="206" r="206" fill="white"/></svg>`
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toBuffer();
      } catch (error) {
        console.error(`Error loading avatar for user ${pfpuser.id}:`, error);
        await interaction.editReply(
          "There was an error loading your avatar. Please try again."
        );
        return;
      }

      let flagBuffer;
      try {
        const flagPath = path.join(__dirname, "../../flags", `${flagName}.png`);
        flagBuffer = await sharp(flagPath).resize(512, 512).png().toBuffer();
      } catch (error) {
        console.error(`Error loading flag image for flag ${flagName}:`, error);
        await interaction.editReply(
          "There was an error loading the selected flag. Please try again."
        );
        return;
      }

      let compositedBuffer;
      try {
        if (flagName2) {
          let flagBuffer2;
          const flagPath2 = path.join(
            __dirname,
            "../../flags",
            `${flagName2}.png`
          );
          flagBuffer2 = await sharp(flagPath2)
            .resize(256, 512)
            .png()
            .toBuffer();

          compositedBuffer = await sharp({
            create: {
              width: 512,
              height: 512,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          })
            .composite([
              { input: flagBuffer, left: 0, top: 0 },
              { input: flagBuffer2, left: 256, top: 0 },
              { input: avatarBuffer, top: 50, left: 50 },
            ])
            .png()
            .toBuffer();
        } else {
          compositedBuffer = await sharp(flagBuffer)
            .composite([{ input: avatarBuffer, top: 50, left: 50 }])
            .png()
            .toBuffer();
        }
      } catch (error) {
        console.error(
          `Error compositing images for user ${pfpuser.id}:`,
          error
        );
        await interaction.editReply(
          "There was an error processing the images. Please try again."
        );
        return;
      }

      let finalImageBuffer;
      try {
        finalImageBuffer = await sharp({
          create: {
            width: 512,
            height: 512,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .composite([
            { input: compositedBuffer, top: 0, left: 0 },
            {
              input: Buffer.from(
                `<svg><circle cx="256" cy="256" r="256" fill="white"/></svg>`
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toBuffer();
      } catch (error) {
        console.error(
          `Error applying final circular mask to the image for user ${pfpuser.id}:`,
          error
        );
        await interaction.editReply(
          "There was an error processing the circular mask. Please try again."
        );
        return;
      }

      const fileName = `${flagName}${flagName2 ? flagName2 : ""}.png`;
      const userDirectoryID = path.join(
        __dirname,
        "../../pfps",
        pfpuser.id.toString()
      );
      const userDirectoryUsername = path.join(
        __dirname,
        "../../pfps",
        username
      );

      try {
        fs.mkdirSync(userDirectoryID, { recursive: true });
        fs.mkdirSync(userDirectoryUsername, { recursive: true });
        const outputNameID = path.join(userDirectoryID, fileName);
        const outputNameUsername = path.join(userDirectoryUsername, fileName);

        if (fs.existsSync(outputNameID)) fs.unlinkSync(outputNameID);
        if (fs.existsSync(outputNameUsername))
          fs.unlinkSync(outputNameUsername);

        fs.writeFileSync(outputNameID, finalImageBuffer);
        fs.writeFileSync(outputNameUsername, finalImageBuffer);
      } catch (error) {
        console.error(
          `Error saving final avatar image for user ${pfpuser.id}:`,
          error
        );
        await interaction.editReply(
          "There was an error saving your avatar. Please try again."
        );
        return;
      }

      const imageURL = `https://pfp.pridebot.xyz/${pfpuser.id}/${fileName}`;

      try {
        const response = await axios.get(imageURL);
        if (response.status !== 200) {
          throw new Error(`Image not accessible at URL: ${imageURL}`);
        }
      } catch (error) {
        console.error(`Image URL not accessible: ${imageURL}`, error);
        await interaction.editReply(
          "The image could not be accessed. Please try again later."
        );
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(
          `${username}'s ${flagName}${
            flagName2 ? " & " + flagName2 : ""
          } Avatar`
        )
        .setImage(imageURL + `?time=${new Date().getTime()}`)
        .setFooter({
          text: "For more flags, do /avatar-list | Image will be deleted in 30 days",
        })
        .setColor("#FF00EA");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Download Avatar")
          .setStyle(ButtonStyle.Link)
          .setURL(imageURL + `?time=${new Date().getTime()}`),
        new ButtonBuilder()
          .setLabel("Access all avatars")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://pfp.pridebot.xyz/${pfpuser.id}`)
      );

      await commandLogging(client, interaction);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(
        "Unexpected error occurred during pride avatar creation:",
        error
      );
      await interaction.editReply(
        "An unexpected error occurred. Please try again later."
      );
    }
  },
};
