const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const ProfileData = require("../../mongo/models/profileSchema.js");
const IDLists = require("../../mongo/models/idSchema.js");
require("dotenv").config();
const { getInfo } = require("discord-hybrid-sharding");

module.exports = (client) => {
  console.log(
    `Premium API initialization started by Cluster ${getInfo().CLUSTER}.`
  );

  const app = express();
  const port = 2613;
  const PREMIUM_CHANNEL_ID = "1450239691075883222";
  const AnnouncementChannelID = "1101742377372237906";

  app.use(
    "/webhook/patreon",
    express.raw({ type: "application/json" }),
    cors()
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  const tierNames = {
    22606797: "Pridebot Supporter",
    24609755: "Pridebot LGBTQ++",
  };

  function verifyPatreonSignature(payload, signature) {
    if (!process.env.PateronWebhookSecret) {
      console.warn("PATREON_WEBHOOK_SECRET not set, skipping verification");
      return true;
    }

    const hmac = crypto.createHmac("md5", process.env.PateronWebhookSecret);
    const digest = hmac.update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  app.post("/webhook/patreon", async (req, res) => {
    try {
      const signature = req.headers["x-patreon-signature"];
      const event = req.headers["x-patreon-event"];

      if (signature && !verifyPatreonSignature(req.body, signature)) {
        console.error("Invalid Patreon webhook signature");
        return res.status(401).send("Invalid signature");
      }
      const payload = JSON.parse(req.body.toString());
      console.log(`Received Patreon event: ${event}`);

      switch (event) {
        case "members:pledge:create":
          await handlePledgeCreate(client, payload);
          break;
        case "members:pledge:update":
          await handlePledgeUpdate(client, payload);
          break;
        case "members:pledge:delete":
          await handlePledgeDelete(client, payload);
          break;
        default:
          console.log(`Unhandled Patreon event: ${event}`);
      }

      res.status(200).send("Webhook received");
    } catch (error) {
      console.error("Error processing Patreon webhook:", error);
      res.status(500).send("Internal server error");
    }
  });

  async function handlePledgeCreate(client, payload) {
    try {
      const data = payload.data;
      console.log("Pledge Create Data:", data);
      const included = payload.included || [];
      const patronId = data.relationships?.patron?.data?.id;
      const tierId =
        data.relationships?.currently_entitled_tiers?.data?.[0]?.id;

      const patron = included.find(
        (item) => item.type === "user" && item.id === patronId
      );

      const patronName =
        data?.attributes?.full_name ||
        patron?.attributes?.full_name ||
        patron?.attributes?.first_name ||
        patron?.attributes?.vanity ||
        "Unknown Patron";

      const discordId =
        patron?.attributes?.social_connections?.discord?.user_id || null;

      const tier = included.find(
        (item) => item.type === "tier" && item.id === tierId
      );
      const tierTitle =
        tier?.attributes?.title || tierNames[tierId] || "Unknown Tier";

      let profileStatus = "No Discord ID linked";
      if (discordId) {
        try {
          let profile = await ProfileData.findOne({ userId: discordId });
          if (profile) {
            profile.premiumMember = true;
            if (!profile.premiumSince) {
              profile.premiumSince = new Date();
            }
            await profile.save();
            console.log(`Premium activated for user ${discordId}`);
            profileStatus = "✅ Premium activated";
          } else {
            profile = new ProfileData({
              userId: discordId,
              username: patronName,
              premiumMember: true,
              premiumSince: new Date(),
            });
            await profile.save();
            console.log(
              `Created new profile and activated premium for user ${discordId}`
            );
            profileStatus = "✅ Profile created & premium activated";
          }

          const idList = await IDLists.findOne();
          if (idList) {
            if (!idList.donor.includes(discordId)) {
              idList.donor.push(discordId);
              await idList.save();
              console.log(`Added ${discordId} to donor list`);
            }
          }
        } catch (dbError) {
          console.error("Error updating profile:", dbError);
          profileStatus = "❌ Database error";
        }
      }

      // Send to log channel
      try {
        const logEmbed = new EmbedBuilder()
          .setTitle("New Patreon Supporter!")
          .setDescription(
            discordId
              ? `${patronName} (<@${discordId}>) has joined as **${tierTitle}**! \nIf you like to donate as well, you may at https://pridebot.xyz/premium`
              : `${patronName} has joined as **${tierTitle}**! \nIf you like to donate as well, you may at https://pridebot.xyz/premium`
          )
          .setColor(0xff66cc)
          .setTimestamp();

        await client.cluster.broadcastEval(
          async (c, { channelId, embedJSON }) => {
            const { EmbedBuilder } = require("discord.js");
            const channel = await c.channels.fetch(channelId).catch(() => null);
            if (channel) {
              const embed = new EmbedBuilder(embedJSON);
              await channel.send({ embeds: [embed] });
              return true;
            }
            return false;
          },
          {
            context: {
              channelId: "1101742377372237906",
              embedJSON: logEmbed.toJSON(),
            },
          }
        );
        console.log(`Sent log notification for ${patronName}`);
      } catch (error) {
        console.error(`Error sending to log channel:`, error);
      }

      try {
        const privateEmbed = new EmbedBuilder()
          .setTitle("New Patreon Supporter!")
          .setDescription(
            discordId
              ? `${patronName} (<@${discordId}>) has joined as **${tierTitle}**!`
              : `${patronName} has joined as **${tierTitle}**!`
          )
          .addFields({ name: "Profile Status", value: profileStatus })
          .setColor(0xff66cc)
          .setTimestamp();

        await client.cluster.broadcastEval(
          async (c, { channelId, embedJSON }) => {
            const { EmbedBuilder } = require("discord.js");
            const channel = await c.channels.fetch(channelId).catch(() => null);
            if (channel) {
              const embed = new EmbedBuilder(embedJSON);
              await channel.send({ embeds: [embed] });
              return true;
            }
            return false;
          },
          {
            context: {
              channelId: PREMIUM_CHANNEL_ID,
              embedJSON: privateEmbed.toJSON(),
            },
          }
        );
        console.log(`Sent private notification for ${patronName}`);
      } catch (error) {
        console.error(`Error sending to private channel:`, error);
      }
    } catch (error) {
      console.error("Error handling pledge create:", error);
    }
  }

  async function handlePledgeUpdate(client, payload) {
    try {
      const data = payload.data;
      const included = payload.included || [];

      const patronId = data.relationships?.patron?.data?.id;
      const tierId =
        data.relationships?.currently_entitled_tiers?.data?.[0]?.id;
      const pledgeCents = data.attributes?.currently_entitled_amount_cents || 0;
      const pledgeAmount = (pledgeCents / 100).toFixed(2);

      const patron = included.find(
        (item) => item.type === "user" && item.id === patronId
      );
      const patronName = patron?.attributes?.full_name || "Unknown Patron";
      const discordId =
        patron?.attributes?.social_connections?.discord?.user_id;

      const tier = included.find(
        (item) => item.type === "tier" && item.id === tierId
      );
      const tierTitle =
        tier?.attributes?.title || tierNames[tierId] || "Unknown Tier";

      if (discordId) {
        try {
          const profile = await ProfileData.findOne({ userId: discordId });
          if (profile) {
            const isActive = pledgeCents > 0;
            profile.premiumMember = isActive;
            if (isActive && !profile.premiumSince) {
              profile.premiumSince = new Date();
            }
            await profile.save();
            console.log(
              `Pledge updated: Premium ${
                isActive ? "maintained" : "removed"
              } for user ${discordId} (${patronName})`
            );

            const idList = await IDLists.findOne();
            if (idList) {
              if (isActive && !idList.donor.includes(discordId)) {
                idList.donor.push(discordId);
                await idList.save();
                console.log(`Added ${discordId} to donor list`);
              } else if (!isActive && idList.donor.includes(discordId)) {
                idList.donor = idList.donor.filter((id) => id !== discordId);
                await idList.save();
                console.log(`Removed ${discordId} from donor list`);
              }
            }
          } else {
            console.log(
              `Pledge updated: No profile found for Discord user ${discordId} (${patronName})`
            );
          }
        } catch (dbError) {
          console.error("Error updating profile on pledge update:", dbError);
        }
      } else {
        console.log(
          `Pledge updated for ${patronName} but no Discord ID linked`
        );
      }

      try {
        const message = discordId
          ? `${patronName} (<@${discordId}>) updated to **${tierTitle}**`
          : `${patronName} updated to **${tierTitle}**`;

        await client.cluster.broadcastEval(
          async (c, { channelId, msg }) => {
            const channel = await c.channels.fetch(channelId).catch(() => null);
            if (channel) {
              await channel.send(msg);
              return true;
            }
            return false;
          },
          { context: { channelId: PREMIUM_CHANNEL_ID, msg: message } }
        );
        console.log(`Sent pledge update notification for ${patronName}`);
      } catch (error) {
        console.error(`Error sending to premium channel:`, error);
      }
    } catch (error) {
      console.error("Error handling pledge update:", error);
    }
  }

  async function handlePledgeDelete(client, payload) {
    try {
      const data = payload.data;
      const included = payload.included || [];

      const patronId = data.relationships?.patron?.data?.id;
      const patron = included.find(
        (item) => item.type === "user" && item.id === patronId
      );
      const patronName = patron?.attributes?.full_name || "Unknown Patron";
      const discordId =
        patron?.attributes?.social_connections?.discord?.user_id;

      if (discordId) {
        try {
          const profile = await ProfileData.findOne({ userId: discordId });
          if (profile) {
            profile.premiumMember = false;
            await profile.save();
            console.log(
              `Pledge cancelled: Premium removed for user ${discordId} (${patronName})`
            );
          } else {
            console.log(
              `Pledge cancelled: No profile found for Discord user ${discordId} (${patronName})`
            );
          }

          const idList = await IDLists.findOne();
          if (idList && idList.donor.includes(discordId)) {
            idList.donor = idList.donor.filter((id) => id !== discordId);
            await idList.save();
            console.log(`Removed ${discordId} from donor list`);
          }
        } catch (dbError) {
          console.error(
            "Error updating profile on pledge cancellation:",
            dbError
          );
        }
      } else {
        console.log(
          `Pledge cancelled for ${patronName} but no Discord ID linked`
        );
      }

      try {
        const message = discordId
          ? `${patronName} (<@${discordId}>) cancelled their pledge`
          : `${patronName} cancelled their pledge`;

        await client.cluster.broadcastEval(
          async (c, { channelId, msg }) => {
            const channel = await c.channels.fetch(channelId).catch(() => null);
            if (channel) {
              await channel.send(msg);
              return true;
            }
            return false;
          },
          { context: { channelId: PREMIUM_CHANNEL_ID, msg: message } }
        );
        console.log(`Sent pledge cancellation notification for ${patronName}`);
      } catch (error) {
        console.error(`Error sending to premium channel:`, error);
      }
    } catch (error) {
      console.error("Error handling pledge delete:", error);
    }
  }

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "Premium API",
      cluster: getInfo().CLUSTER,
    });
  });

  app.listen(port, () => {
    console.log(`Premium API is running on port ${port}`);
  });
};
