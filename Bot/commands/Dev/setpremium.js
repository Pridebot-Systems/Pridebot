const { addTrashCanReaction } = require("../../functions/commands/trashreact.js");

const VALID_TIERS = ["free", "supporter", "lgbtqpp"];

const TIER_DISPLAY = {
  supporter: "Pridebot Supporter",
  lgbtqpp: "Pridebot LGBTQ++",
  free: "Free",
};

async function setPremiumCommand(message, client) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (!message.content.startsWith(mention)) return;

  const args = message.content.slice(mention.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (commandName !== "setpremium") return;

  const IDLists = require("../../../DB/models/idSchema.js");
  const ProfileData = require("../../../DB/models/profileSchema.js");

  const idLists = await IDLists.findOne();
  if (!idLists || !idLists.devs.includes(message.author.id)) {
    const reply = await message.channel.send("You do not have permission to use this command.");
    await addTrashCanReaction(reply);
    return;
  }

  const userId = args[0];
  const tier = args[1]?.toLowerCase();

  if (!userId || !tier) {
    const reply = await message.channel.send(
      `Usage: \`@${client.user.username} setpremium <userId> <${VALID_TIERS.join("|")}>\``
    );
    await addTrashCanReaction(reply);
    return;
  }

  if (!VALID_TIERS.includes(tier)) {
    const reply = await message.channel.send(
      `Invalid tier. Valid options: \`${VALID_TIERS.join(", ")}\``
    );
    await addTrashCanReaction(reply);
    return;
  }

  try {
    let profile = await ProfileData.findOne({ userId });
    if (!profile) {
      profile = new ProfileData({ userId, username: userId });
    }

    if (tier === "free") {
      if (profile.premiumTier === "lgbtqpp") {
        profile.darRangeMin = 0;
        profile.darRangeMax = 100;
      }
      profile.premiumMember = false;
      profile.premiumTier = null;
      profile.premiumSince = null;
    } else {
      if (profile.premiumTier === "lgbtqpp" && tier !== "lgbtqpp") {
        profile.darRangeMin = 0;
        profile.darRangeMax = 100;
      }
      profile.premiumMember = true;
      profile.premiumTier = tier;
      if (!profile.premiumSince) {
        profile.premiumSince = new Date();
      }
    }

    await profile.save();

    // Sync donor / donorplus ID lists
    if (tier === "free") {
      idLists.donor = idLists.donor.filter((id) => id !== userId);
      idLists.donorplus = idLists.donorplus.filter((id) => id !== userId);
    } else {
      if (!idLists.donor.includes(userId)) idLists.donor.push(userId);
      if (tier === "lgbtqpp" && !idLists.donorplus.includes(userId)) {
        idLists.donorplus.push(userId);
      } else if (tier !== "lgbtqpp") {
        idLists.donorplus = idLists.donorplus.filter((id) => id !== userId);
      }
    }
    await idLists.save();

    const reply = await message.channel.send(
      `✅ <@${userId}> set to **${TIER_DISPLAY[tier]}**.`
    );
    await addTrashCanReaction(reply);
  } catch (err) {
    console.error("[SETPREMIUM] Error:", err);
    const reply = await message.channel.send("❌ Database error. Check the logs.");
    await addTrashCanReaction(reply);
  }

  setTimeout(() => {
    message.delete().catch((err) => console.error("[SETPREMIUM] Failed to delete message:", err));
  }, 3000);
}

module.exports = { setPremiumCommand };
