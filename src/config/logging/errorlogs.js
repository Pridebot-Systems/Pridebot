const { EmbedBuilder, DiscordAPIError } = require("discord.js");
const {sendLog} = require("./sendlogs");

const errorlogging = async (client, error, context = {}) => {
  const channel = client.channels.cache.get("1303936573586411540");
  if (!channel) return;
  const estDate = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });

  let embed = new EmbedBuilder()
    .setTitle("Pridebot Error Log")
    .setColor(0xff00ea)
    .addFields(
      {
        name: "Error Name",
        value: error.name || "Unknown Error",
        inline: true,
      },
      { name: "Time", value: `${estDate}`, inline: true }
    )
    .setTimestamp();

  if (Object.keys(context).length > 0) {
    embed.addFields({
      name: "Context",
      value: Object.entries(context)
        .map(
          ([k, v]) =>
            `**${k}:** ${typeof v === "object" ? JSON.stringify(v) : v}`
        )
        .join("\n")
        .slice(0, 1024),
    });
  }

  if (error instanceof DiscordAPIError) {
    embed.addFields(
      { name: "Error Code", value: `Code ${error.code}`, inline: true },
      { name: "Status", value: `${error.status || "N/A"}`, inline: true },
      { name: "Method", value: error.method || "Unknown", inline: true },
      { name: "URL", value: error.url || "N/A" },
      { name: "Error Message", value: error.message || "No message provided" }
    );
  } else {
    if (error.code)
      embed.addFields({
        name: "Error Code",
        value: `${error.code}`,
        inline: true,
      });
    if (error.status)
      embed.addFields({
        name: "Status",
        value: `${error.status}`,
        inline: true,
      });
    if (error.method)
      embed.addFields({ name: "Method", value: error.method, inline: true });
    if (error.url) embed.addFields({ name: "URL", value: error.url });
    if (error.path) embed.addFields({ name: "Path", value: error.path });
    if (error.requestData)
      embed.addFields({
        name: "Request Data",
        value:
          "```json\n" +
          JSON.stringify(error.requestData, null, 2).slice(0, 1010) +
          "\n```",
      });

    embed.addFields(
      { name: "Error Message", value: error.message || "No message provided" },
      {
        name: "Stack Trace",
        value: `\`\`\`${
          error.stack?.slice(0, 1010) || "No stack trace available"
        }\`\`\``,
      }
    );
  }

  if (!error.name && !error.message && typeof error === "object") {
    embed.addFields({
      name: "Raw Error Object",
      value:
        "```json\n" + JSON.stringify(error, null, 2).slice(0, 1010) + "\n```",
    });
  }

  await sendLog(client, embed, "1303936573586411540");
};

module.exports = { errorlogging };
