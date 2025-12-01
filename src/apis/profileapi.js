const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const ProfileData = require("../../mongo/models/profileSchema.js");
const IDLists = require("../../mongo/models/idSchema.js");
require("dotenv").config();
const { getInfo } = require("discord-hybrid-sharding");

module.exports = (client) => {
  console.log(
    `Profile API initialization started by Cluster ${getInfo().CLUSTER}.`
  );
  const app = express();
  const port = 2612;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "..", "web", "assets"))
  );

  app.listen(port, () => {
    console.log(`Profile API is running on port ${port}`);
  });

  const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token || token !== `Bearer ${process.env.PROFILE_API_TOKEN}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      cluster: getInfo().CLUSTER,
      uptime: process.uptime(),
    });
  });

  app.get("/", (req, res) => {
    res.sendFile(
      path.join(__dirname, "..", "..", "web", "profiles", "index.html")
    );
  });

  app.get("/getUser/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
      if (/^\d+$/.test(userId)) {
        const user = await client.users.fetch(userId);
        return res.json({
          id: user.id,
          username: user.username,
          discriminator: user.discriminator || "0000",
          tag: user.tag || `${user.username}#0000`,
          avatar: user.avatar,
          displayAvatarURL: user.displayAvatarURL({ dynamic: true, size: 512 }),
        });
      } else {
        return res.status(400).json({ message: "Invalid user ID format" });
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return res.status(404).json({ message: "User not found" });
    }
  });

  app.get("/badges/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
      const idLists = await IDLists.findOne();
      if (!idLists) {
        return res.json({ badges: [] });
      }

      const badges = [];
      const badgeKeys = [
        "bot",
        "discord",
        "devs",
        "oneyear",
        "support",
        "vips",
        "partner",
        "donor",
      ];

      for (const key of badgeKeys) {
        if (Array.isArray(idLists[key]) && idLists[key].includes(userId)) {
          badges.push(key);
        }
      }

      return res.json({ badges });
    } catch (error) {
      console.error(`Error fetching badges for ${userId}:`, error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/profile/:userId", async (req, res) => {
    try {
      const profile = await ProfileData.findOne({ userId: req.params.userId });

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      return res.json(profile);
    } catch (error) {
      console.error("Failed to retrieve profile:", error);
      return res.status(500).send("Internal Server Error");
    }
  });

  app.patch("/profile/update/:userId", authMiddleware, async (req, res) => {
    try {
      const { userId } = req.params;
      const updateData = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No data provided to update" });
      }

      const profile = await ProfileData.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true }
      );

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      return res.json({ message: "Profile updated successfully", profile });
    } catch (error) {
      console.error("Failed to update profile:", error);
      return res.status(500).send("Internal Server Error");
    }
  });

  app.delete("/profile/delete/:userId", authMiddleware, async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const profile = await ProfileData.findOneAndDelete({ userId });

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      return res.json({ message: "Profile deleted successfully" });
    } catch (error) {
      console.error("Failed to delete profile:", error);
      return res.status(500).send("Internal Server Error");
    }
  });

  app.get("/:userId", async (req, res) => {
    const { userId } = req.params;

    if (
      userId === "profile" ||
      userId === "health" ||
      userId === "getUser" ||
      userId === "badges"
    ) {
      return res.status(404).json({ message: "Not found" });
    }
    async function serveProfilePage(username, userAvatar) {
      const htmlFilePath = path.join(
        __dirname,
        "..",
        "..",
        "web",
        "profiles",
        "profile.html"
      );

      try {
        let htmlContent = fs.readFileSync(htmlFilePath, "utf8");

        const profile = await ProfileData.findOne({ userId });
        const preferredName = profile?.preferredName || username || "User";
        const bio =
          profile?.bio || `View ${preferredName}'s profile on Pridebot`;
        const color = profile?.color || "#FF00EA";
        const avatar =
          profile?.pfp ||
          userAvatar ||
          "https://cdn.discordapp.com/emojis/1108228682184654908.png";

        htmlContent = htmlContent.replace(
          /<meta name="og:title" content=".*" \/>/,
          `<meta name="og:title" content="${preferredName}'s Profile | Pridebot" />`
        );
        htmlContent = htmlContent.replace(
          /<meta name="og:description" content=".*" \/>/,
          `<meta name="og:description" content="${bio
            .substring(0, 150)
            .replace(/\\n/g, " ")}" />`
        );
        htmlContent = htmlContent.replace(
          /<meta name="description" content=".*" \/>/,
          `<meta name="description" content="${bio
            .substring(0, 150)
            .replace(/\\n/g, " ")}" />`
        );
        htmlContent = htmlContent.replace(
          /<meta name="og:image"[\s\S]*?content=".*" \/>/,
          `<meta name="og:image" content="${avatar}" />`
        );
        htmlContent = htmlContent.replace(
          /<meta name="theme-color" content=".*" \/>/,
          `<meta name="theme-color" content="${color}" />`
        );
        htmlContent = htmlContent.replace(
          /<title>.*<\/title>/,
          `<title>${preferredName}'s Profile | Pridebot</title>`
        );

        return res.send(htmlContent);
      } catch (error) {
        console.error("Error serving profile page:", error);
        return res.sendFile(htmlFilePath);
      }
    }

    if (/^\d+$/.test(userId)) {
      try {
        const user = await client.users.fetch(userId);
        return serveProfilePage(
          user.username,
          user.displayAvatarURL({ dynamic: true, size: 512 })
        );
      } catch (error) {
        console.error(`Failed to fetch Discord user ${userId}:`, error.message);
        return serveProfilePage(null, null);
      }
    }

    return res
      .status(400)
      .sendFile(path.join(__dirname, "..", "..", "web", "404.html"));
  });
};
