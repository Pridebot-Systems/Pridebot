const { SlashCommandBuilder } = require("discord.js");
const { Chain, User } = require("../../../mongo/models/yangSchema");
const IDLists = require("../../../mongo/models/idSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("youarenowgay")
    .setDescription("Gay a user into the chain!")
    .addUserOption((o) =>
      o.setName("target").setDescription("Who to gay").setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetId = interaction.options.getUser("target").id;

    if (targetId === userId) {
      return interaction.reply({
        content: `You can’t gay yourself!`,
        ephemeral: true,
      });
    }

    const ids = await IDLists.findOne();
    const isDev = ids?.devs.includes(userId);
    const isDonor = ids?.donor.includes(userId);

    if (await User.findOne({ userId: targetId })) {
      return interaction.reply({
        content: `They’ve already been gayed.`,
        ephemeral: true,
      });
    }
    let you = await User.findOne({ userId });
    let chain;

    if (!you) {
      if (!isDev && !isDonor) {
        return interaction.reply({
          content: `Only devs or donors can start a chain. If you like to start a chain and support the bot, consider donating at https://pridebot.xyz/premium!`,
          ephemeral: true,
        });
      }
      chain = await Chain.create({ initiator: userId });
      you = await User.create({ userId, chain: chain._id, level: 0 });
    } else {
      chain = you.chain;
    }

    const slotLimit = isDonor ? 4 : 2;
    if (you.children.length >= slotLimit) {
      if (isDonor) {
        return interaction.reply({
          content: `You’ve used up your ${slotLimit} gay slots.`,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `You’ve used up your ${slotLimit} gay slots.
You can donate at https://pridebot.xyz/premium to double your slots!`,
          ephemeral: true,
        });
      }
    }

    you.children.push(targetId);
    await you.save();

    const child = await User.create({
      userId: targetId,
      chain,
      parent: userId,
      level: you.level + 1,
    });

    interaction.client.users
      .resolve(targetId)
      ?.send(
        `You’ve been gayed by <@${userId}>! You’re now level ${child.level}.`
      )
      .catch(() => {});

    return interaction.reply({
      content: `✅ <@${targetId}> has been gayed! You’ve used ${you.children.length}/${slotLimit} slots.`,
      ephemeral: false,
    });
  },
};
