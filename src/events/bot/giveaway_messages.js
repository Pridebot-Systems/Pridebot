const { EmbedBuilder } = require("discord.js");
const { Giveaway } = require("../../../mongo/models/giveawaySchema");
const cron = require("node-cron");

module.exports = (client) => {
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
