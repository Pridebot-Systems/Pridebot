const { EmbedBuilder } = require("discord.js");
const { Giveaway } = require("../../../mongo/models/giveawaySchema");
const cron = require("node-cron");

module.exports = (client) => {
  cron.schedule(
    "0 0 1 6 *",
    async () => {
      try {
        let giveaway = await Giveaway.findOne();
        const HARDCODED_END = new Date("2025-06-30T11:59:59Z");
        if (!giveaway) {
          giveaway = await Giveaway.create({
            entrants: [],
            endTime: HARDCODED_END,
          });
        }
        const embed = new EmbedBuilder()
          .setTitle("Pridebot X Pridecord 5× $10 Nitro Pridemonth Giveaway")
          .addFields(
            {
              name: "How to Enter",
              value:
                "To enter, simply use </giveaway enter:1378536586701963395> in the Pridecord server. You must be at least level 5 or higher to enter.",
            },
            {
              name: "Rules",
              value:
                "**1.** Must be a member of the [Pridecord Discord server](https://discord.gg/lgbtqia) and must be level 5 or higher\n" +
                "**2.** To qualify, you must meet **one** of the following:\n" +
                "   • Have interacted with Pridebot at least 25 times (e.g., command usage, profile creation/editing), **or**\n" +
                "   • Invite Pridebot to a server that you own/administer with **at least 25 members**, and that server must have been active for **at least 3 weeks** at the start of the giveaway.\n",
            },
            {
              name: "Legal",
              value:
                "**1.** Pridebot will store all entrant IDs only for the duration of the giveaway and prize fulfillment, after which all IDs will be permanently deleted.\n" +
                "**2.** Prizes: Five (5) winners will each receive a one-month [Discord Nitro](https://discord.com/nitro) subscription (including two server boosts).\n" +
                "**3.** Winners will be selected on <t:1751342400:f>. To claim your prize, you must open a ticket in Pridecord by <t:1751947200:f>. Any prizes not claimed by that deadline will be forfeited.\n",
            }
          )
          .setColor(0xff00ae)
          .setTimestamp();

        const channel = await client.channels.fetch("1084318865179287663");
        if (channel?.isTextBased()) {
          await channel.send({
            content: "<@&1115196671555534929>",
            embeds: [embed],
          });
        }
      } catch (err) {
        console.error("Error sending giveaway announcement on June 1:", err);
      }
    },
    { timezone: "America/New_York" }
  );

  cron.schedule(
    "0 0 1 7 *",
    async () => {
      try {
        const giveaway = await Giveaway.findOne();
        if (!giveaway || !giveaway.entrants.length) {
          console.log("No giveaway or no entrants to draw on July 1.");
          return;
        }
        const entrants = [...giveaway.entrants];
        for (let i = entrants.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [entrants[i], entrants[j]] = [entrants[j], entrants[i]];
        }
        const winners = entrants.slice(0, Math.min(5, entrants.length));

        const winnersEmbed = new EmbedBuilder()
          .setTitle("🎉 Pride Month Giveaway Winners 🎉")
          .setDescription(
            winners.map((id, idx) => `**${idx + 1}.** <@${id}>`).join("\n")
          )
          .setColor("GOLD")
          .setTimestamp();

        const channel = await client.channels.fetch("1084318865179287663");
        if (channel?.isTextBased()) {
          await channel.send({
            content:
              winners.length > 0
                ? `<@${winners.join(">, <@")}>`
                : "No winners this time!",
            embeds: [winnersEmbed],
          });
        }
      } catch (err) {
        console.error("Error drawing/sending giveaway winners on July 1:", err);
      }
    },
    { timezone: "America/New_York" }
  );
};
