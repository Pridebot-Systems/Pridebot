const {
  GiveawayAdvert,
} = require("../../../mongo/models/giveawayAdvertSchema");

async function shouldShowGiveawayAd(userId) {
  let record = await GiveawayAdvert.findOne({ userId });
  if (!record) {
    await GiveawayAdvert.create({ userId, lastSeen: new Date() });
    return true;
  }

  if (Math.random() < 0.1) {
    record.lastSeen = new Date();
    await record.save();
    return true;
  }

  return false;
}

module.exports = { shouldShowGiveawayAd };
