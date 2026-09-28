const {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const commandLogging = require("../../utils/logging/commandlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gender")
    .setDescription("Learn about any kinds or types of genders"),

  async execute(interaction, client) {
    const channel = interaction.channel;

    if (!channel) {
      await interaction.reply(
        "The type of command you are trying to send can't be sent in User Install format. Please use this command again in a server where Pridebot is added. \nInvite link: https://pridebot.xyz/invite"
      );
      return;
    }

    const gender = [
      {
        name: "Agender",
        description: "Click here to learn about Agender.",
        value: "ag",
        emoji: "1112198522733854811",
        info: {
          title: "What is Agender",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Agender is a term used to describe individuals who do not identify with any particular gender. They may feel that they lack gender entirely or have a gender identity that is neutral or undefined.",
          description2:
            "Individuals who identify as Agender may experience a sense of liberation from societal gender expectations and norms. They may feel more connected to themselves and their authentic identity by embracing a genderless or non-binary identification.",
          description3: "Falls under the Non-Binary umbrella.",
        },
      },
      {
        name: "Androgyne",
        description: "Click here to learn about Androgyne.",
        value: "ad",
        emoji: "1112198460096135198",
        info: {
          title: "What is Androgyne",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Androgyne is a term used to describe individuals who have a gender identity that is a combination of both masculine and feminine elements. They may feel that they embody characteristics and qualities typically associated with both genders.",
          description2:
            "Individuals who identify as Androgyne may experience a fluidity and flexibility in their gender expression. They may feel comfortable expressing themselves in ways that challenge traditional gender roles and expectations.",
          description3: "Falls under the Non-Binary umbrella.",
        },
      },
      {
        name: "Bigender/Trigender",
        description: "Click here to learn about Bigender/Trigender.",
        value: "bgtg",
        emoji: "1112198228906094672",
        info: {
          title: "What are Bigender/Trigender",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Bigender and Trigender are terms used to describe individuals who have two or three gender identities, respectively. These individuals may feel that their gender identity is not fixed and can encompass multiple genders.",
          description2:
            "Individuals who identify as Bigender or Trigender may experience a fluidity and variability in their gender identity and expression. They may switch between different gender identities depending on various factors such as time, situation, or personal feelings.",
          description3: "Falls under the Non-Binary umbrella.",
        },
      },
      {
        name: "Cisgender",
        description: "Click here to learn about Cisgender.",
        value: "cis",
        emoji: "1112197368541102241",
        info: {
          title: "What is Cisgender",
          title2: "What do individuals feel under identification of ",
          title3: "What umbrella does the gender fall under",
          description:
            "Cisgender is a term used to describe individuals whose gender identity aligns with the sex they were assigned at birth. For example, a person who was assigned female at birth and identifies as a woman is considered cisgender.",
          description2:
            "Individuals who identify as cisgender often experience a sense of congruence between their gender identity and the societal expectations associated with their assigned sex. They may not question or struggle with their gender identity in the same way as transgender or non-binary individuals.",
          description3:
            "Falls under the Cisgender umbrella and normally has terms Cis-male to represent an individual who assign male at birth (amab) with male genitals and Cis-female to represent an individual who assign female at birth (afab) with female genitals",
        },
      },
      {
        name: "Demigender",
        description: "Click here to learn about Demigender.",
        value: "dg",
        emoji: "1112196955280519169",
        info: {
          title: "What is Demigender",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Demigender is a term used to describe individuals who partially, but not fully, identify with a particular gender. They may feel a connection to a specific gender identity while also experiencing a sense of fluidity or ambiguity.",
          description2:
            "Individuals who identify as Demigender may experience their gender identity as a combination of one or more genders or as a separate and distinct gender identity that is not easily categorized.",
          description3:
            "Falls under the Non-Binary umbrella and then has it's own terms, Demiboy and Demigirl.",
        },
      },
      {
        name: "Genderfae",
        description: "Click here to learn about Genderfae.",
        value: "gfae",
        emoji: "1216212830899146874",
        info: {
          title: "What is Genderfae",
          title2: "What do individuals feel under identification of Genderfae",
          title3: "What umbrella does the gender fall under",
          description:
            "Genderfae is a form of genderfluidity that does not encompass feeling masculine. Those who identify as Genderfae may experience a range of gender identities, excluding masculine genders, but can include feminine, neutral, or any other non-masculine genders.",
          description2:
            "Individuals identifying as Genderfae may feel their gender identity shift and change over time, including a spectrum of non-masculine genders such as feminine, neutral, or other non-aligned gender experiences.",
          description3: "Falls under the Non-Binary and Genderfluid umbrellas.",
        },
      },
      {
        name: "Genderfaun",
        description: "Click here to learn about Genderfaun.",
        value: "gf",
        emoji: "1177453360476074074",
        info: {
          title: "What is Genderfaun",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Genderfaun is a form of genderfluidity that never encompasses feeling feminine. Those who identify as Genderfaun may experience shifting gender identities, excluding feminine genders.",
          description2:
            "Individuals who identify as Genderfaun may feel their gender identity shift and change over time, including a range of masculine, neutral, or other non-feminine gender experiences.",
          description3: "Falls under the Non-Binary and Genderfluid umbrellas.",
        },
      },
      {
        name: "Genderfluid",
        description: "Click here to learn about Genderfluid.",
        value: "gfd",
        emoji: "1112196520477999226",
        info: {
          title: "What is Genderfluid",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Genderfluid is a term used to describe individuals whose gender identity is not fixed and can vary over time. They may experience shifts between different genders or a fluidity in their gender identity.",
          description2:
            "Individuals who identify as Genderfluid may feel that their gender identity is not limited to one category and can encompass a range of genders or no gender at all. Their experience of gender may change in response to internal or external factors.",
          description3:
            "Falls under the Non-Binary umbrella and is main identify under Genderfluid section.",
        },
      },
      {
        name: "Genderflux",
        description: "Click here to learn about Genderflux.",
        value: "gfx",
        emoji: "1112196687830712380",
        info: {
          title: "What is Genderflux",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Genderflux is a term used to describe individuals whose gender identity fluctuates over time. They may experience shifts in their gender identity, moving between different genders or experiencing a range of gender identities.",
          description2:
            "Individuals who identify as Genderflux may experience changes in their gender identity that can occur gradually or rapidly, and these changes can happen spontaneously or in response to different circumstances.",
          description3:
            "Falls under the Non-Binary umbrella in Genderfluid section.",
        },
      },
      {
        name: "Genderqueer",
        description: "Click here to learn about Genderqueer.",
        value: "gq",
        emoji: "1112198854637539478",
        info: {
          title: "What is Genderqueer",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Genderqueer is a term used to describe individuals who reject or challenge traditional notions of gender identity. They may identify outside of the binary categories of male and female, or they may embrace a non-binary or gender-expansive identity.",
          description2:
            "Individuals who identify as Genderqueer may experience a sense of fluidity, ambiguity, or multiplicity in their gender identity. They may reject societal expectations and norms associated with binary gender roles and express themselves in ways that align with their authentic self.",
          description3:
            "Falls under the Non-Binary umbrella in Genderfluid section.",
        },
      },
      {
        name: "Non-Binary",
        description: "Click here to learn about Non-Binary.",
        value: "nb",
        emoji: "1112196445064413194",
        info: {
          title: "What is Non-Binary",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Non-Binary is a term used to describe individuals whose gender identity does not exclusively align with the binary categories of male or female. They may identify as a combination of genders, as having a gender that is outside the binary, or as having no gender at all.",
          description2:
            "Individuals who identify as Non-Binary may experience a range of gender identities and expressions that transcend traditional gender norms. They may use various pronouns and may present themselves in ways that challenge societal expectations.",
          description3:
            "Known as main umbrella term for many other genders (some listed above)",
        },
      },
      {
        name: "Pangender",
        description: "Click here to learn about Pangender.",
        value: "pg",
        emoji: "1177453248702054480",
        info: {
          title: "What is Pangender",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Pangender is a term used to describe individuals who identify with all genders. The concept of pangender encompasses a wide and diverse range of gender identities existing across different cultures and traditions.",
          description2:
            "Individuals who identify as Pangender often feel that they embody multiple genders simultaneously or that their gender identity encompasses the full spectrum of gender possibilities.",
          description3: "Falls under the Non-Binary umbrella.",
        },
      },
      {
        name: "Transgender",
        description: "Click here to learn about Transgender.",
        value: "trans",
        emoji: "1112201010509795348",
        info: {
          title: "What is Transgender",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Transgender is a term used to describe individuals whose gender identity differs from the sex they were assigned at birth. For example, a person who was assigned male at birth but identifies as a woman is considered transgender.",
          description2:
            "Individuals who identify as transgender often experience a disconnect between their gender identity and the societal expectations associated with their assigned sex. They may undergo a process of self-discovery and may pursue social, medical, or legal transitions to align their external appearance with their internal gender identity.",
          description3:
            "Falls under the Transgender umbrella and normally has terms trans man/male (or trans-masc) to represent an individual who assign female at birth but is transiting to male (Known as FTM) and trans woman/female to represent an individual who assign male at birth (amab) but is transiting to female (Known as MTF)",
        },
      },
      {
        name: "Xenogender",
        description: "Click here to learn about Xenogender.",
        value: "xg",
        emoji: "1177453160558755850",
        info: {
          title: "What is Xenogender",
          title2: "What do individuals feel under identification of",
          title3: "What umbrella does the gender fall under",
          description:
            "Xenogender is a term used to describe non-binary gender identities that cannot be fully understood in terms of traditional male or female gender norms. It encompasses identities that may be derived from animals, plants, elements, or other non-human experiences.",
          description2:
            "Individuals who identify as Xenogender may experience their gender as something that cannot be confined to human gender constructs. They often use this term to express a deep connection to a certain aspect or concept that is central to their identity.",
          description3: "Falls under the broader Non-Binary umbrella.",
        },
      },
    ];

    const selectOptions = gender.map((g) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(g.name)
        .setDescription(g.description)
        .setValue(g.value)
        .setEmoji(g.emoji)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("genderSelect")
      .setPlaceholder("Choose gender here")
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle("What is *gender* and which gender do you want to learn about?")
      .setDescription(
        `Gender according to the [World Health Organization](https://www.who.int/health-topics/gender#tab=tab_1) (WHO) says "Gender refers to the characteristics of women, men, girls, and boys that are socially constructed ... As a social construct, gender varies from society to society and can change over time." They also state: \n> "Gender interacts with but is different from sex, which refers to the different biological and physiological characteristics of females, males, and intersex persons, such as chromosomes, hormones, and reproductive organs. Gender and sex are related to but different from gender identity. Gender identity refers to a person’s deeply felt, internal, and individual experience of gender, which may or may not correspond to the person’s physiology or designated sex at birth."\n\nOnes gender identity is not limited to social norms and can be expressed in any way that an individual feels comfortable doing. One's gender identity doesn't affect the pronouns or sexuality that an individual identifies with. Sexuality pertains to one's preference for romantic/sexual attraction, while pronouns relate to one's self-labels. \n\nChoose one of the genders or identities below that you want to learn about:`
      )
      .addFields({
        name: "Genders",
        value: gender.map((g) => `<:_:${g.emoji}> **${g.name}**`).join("\n"),
        inline: true,
      })
      .setColor("#FF00AE")
      .setTimestamp();

    function createGenderButtons(currentIndex) {
      const components = [];

      if (currentIndex > 0) {
        const prevGender = gender[currentIndex - 1];
        const prevLabel = `${prevGender.name}`;
        const prevEmoji = `${prevGender.emoji}`;

        const prevButton = new ButtonBuilder()
          .setLabel(prevLabel)
          .setEmoji(prevEmoji)
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(`gender-${prevGender.value}`);
        components.push(prevButton);
      }

      if (currentIndex < gender.length - 1) {
        const nextGender = gender[currentIndex + 1];
        const nextLabel = `${nextGender.name}`;
        const nextEmoji = `${nextGender.emoji}`;

        const nextButton = new ButtonBuilder()
          .setLabel(nextLabel)
          .setEmoji(nextEmoji)
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(`gender-${nextGender.value}`);
        components.push(nextButton);
      }

      return components;
    }

    await interaction.reply({ embeds: [embed], components: [row] });
    await commandLogging(client, interaction);

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
    });

    collector.on("collect", (selectInteraction) => {
      if (selectInteraction.customId === "genderSelect") {
        const selectedValue = selectInteraction.values[0];
        const genderInfo = gender.find((g) => g.value === selectedValue);

        if (!genderInfo) {
          console.error(
            `No gender information found for value: ${selectedValue}`
          );
          selectInteraction.reply({
            content:
              "Sorry, an error occurred while fetching gender information.",
            ephemeral: true,
          });
          return;
        }

        const currentIndex = gender.indexOf(genderInfo);

        const selectedEmbed = new EmbedBuilder().setColor(0xff00ae).addFields(
          { name: genderInfo.info.title, value: genderInfo.info.description },
          {
            name: genderInfo.info.title2,
            value: genderInfo.info.description2,
          },
          {
            name: genderInfo.info.title3,
            value: genderInfo.info.description3,
          }
        );

        const buttons = createGenderButtons(currentIndex);
        const updatedRow = new ActionRowBuilder().addComponents(buttons);

        selectInteraction.reply({
          embeds: [selectedEmbed],
          components: [updatedRow],
          ephemeral: true,
        });
      }
    });

    const buttonCollector = interaction.channel.createMessageComponentCollector(
      {
        componentType: ComponentType.BUTTON,
        time: 60000,
      }
    );

    buttonCollector.on("collect", (buttonInteraction) => {
      const [, genderValue] = buttonInteraction.customId.split("-");
      const selectedGenderIndex = gender.findIndex(
        (g) => g.value === genderValue
      );
      const genderInfo = gender[selectedGenderIndex];
      if (!genderInfo) {
        console.error(
          `No gender information found for index: ${selectedGenderIndex}`
        );
        return;
      }

      const updatedEmbed = new EmbedBuilder()
        .setColor(0xff00ae)
        .addFields(
          { name: genderInfo.info.title, value: genderInfo.info.description },
          { name: genderInfo.info.title2, value: genderInfo.info.description2 },
          { name: genderInfo.info.title3, value: genderInfo.info.description3 }
        );

      const updatedButtons = createGenderButtons(selectedGenderIndex);
      const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

      buttonInteraction.update({
        embeds: [updatedEmbed],
        components: [updatedRow],
      });
    });
  },
};
