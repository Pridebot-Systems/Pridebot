// sendlogs.js
const LOGGING_GUILD_ID = "1101740375342845952";

function ipcOpen(client) {
  // process.connected is false once the channel is closed
  return Boolean(
    process?.connected &&
      client?.cluster &&
      typeof client.cluster.broadcastEval === "function"
  );
}

async function sendLog(client, message, channelId) {
  // If IPC is already closed, never try to talk to other clusters
  if (!ipcOpen(client)) {
    try {
      const printable =
        typeof message === "string"
          ? message
          : JSON.stringify(message.toJSON?.() ?? message);
      console.error("[sendLog] IPC closed; console fallback:", printable);
    } catch (e) {
      console.error(
        "[sendLog] IPC closed; fallback stringify failed:",
        e?.message || e
      );
    }
    return;
  }

  // 1) Try local direct send first (safe if this cluster has the guild)
  try {
    const guild = client.guilds.cache.get(LOGGING_GUILD_ID);
    if (guild) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const { EmbedBuilder } = require("discord.js");
        const content =
          typeof message === "string"
            ? { content: message }
            : { embeds: [EmbedBuilder.from(message)] };
        await channel.send(content);
        console.log(
          `[sendLog] Direct message sent by cluster ${
            client.cluster?.id ?? "unknown"
          }`
        );
        return;
      }
    }
  } catch (err) {
    console.error(
      `[sendLog] Direct send failed on cluster ${
        client.cluster?.id ?? "unknown"
      }:`,
      err
    );
  }

  // 2) Fallback to broadcastEval, but fully wrapped
  try {
    const results = await client.cluster.broadcastEval(
      async (c, { message, channelId, guildId }) => {
        if (!c.guilds.cache.has(guildId)) return null;
        const { EmbedBuilder } = require("discord.js");
        const channel = await c.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return null;
        const content =
          typeof message === "string"
            ? { content: message }
            : { embeds: [EmbedBuilder.from(message)] };
        try {
          await channel.send(content);
          return c.cluster?.id ?? true;
        } catch {
          return null;
        }
      },
      {
        context: {
          message:
            typeof message === "string"
              ? message
              : message.toJSON?.() ?? message,
          channelId,
          guildId: LOGGING_GUILD_ID,
        },
      }
    );

    const successCluster = results.find((r) => r !== null);
    if (successCluster === undefined) {
      console.error("[sendLog] No cluster was able to send the message.");
    } else {
      console.log(
        "[sendLog] Message sent by cluster (fallback):",
        successCluster
      );
    }
  } catch (err) {
    console.error(
      "[sendLog] broadcastEval failed (IPC likely closed):",
      err?.code || err?.message || err
    );
  }
}

module.exports = { sendLog };
