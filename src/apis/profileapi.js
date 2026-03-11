const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const ProfileData = require("../../mongo/models/profileSchema.js");
const IDLists = require("../../mongo/models/idSchema.js");
const UserCommandUsage = require("../../mongo/models/userCommandUsageSchema.js");
const {
  configureDiscordAuth,
  verifyUserToken,
  generateToken,
  passport,
} = require("../../web/assets/js/auth.js");
require("dotenv").config();
const { getInfo } = require("discord-hybrid-sharding");

module.exports = (client) => {
  console.log(
    `Profile API initialization started by Cluster ${getInfo().CLUSTER}.`
  );
  const app = express();
  const config = require("../environment.js");
  const port = config.ports.profile;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "pridebot-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  configureDiscordAuth();

  app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "..", "web", "assets"))
  );

  app.use(
    "/pfps",
    express.static(path.join(__dirname, "..", "profilepfps"))
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

  app.get("/login", (req, res) => {
    res.redirect("/auth/discord");
  });

  app.get("/edit", (req, res) => {
    res.sendFile(
      path.join(__dirname, "..", "..", "web", "profiles", "edit.html")
    );
  });

  app.get("/auth/discord", passport.authenticate("discord"));

  app.get(
    "/auth/callback",
    passport.authenticate("discord", { failureRedirect: "/login" }),
    (req, res) => {
      const token = generateToken(req.user.id, req.user.username);
      res.redirect(`/edit?token=${token}`);
    }
  );

  app.get("/logout", (req, res) => {
    req.logout((err) => {
      if (err) console.error("Logout error:", err);
      res.redirect("/");
    });
  });

  app.get("/api/profile/me", verifyUserToken, async (req, res) => {
    try {
      const profile = await ProfileData.findOne({ userId: req.userId });

      if (!profile) {
        return res.status(404).json({
          error: "Profile not found",
          message: "You don't have a profile yet. Create one!",
        });
      }

      res.json(profile);
    } catch (error) {
      console.error(`Error fetching profile for ${req.userId}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/profile/me", verifyUserToken, async (req, res) => {
    try {
      const updates = req.body;

      const allowedFields = [
        "preferredName",
        "bio",
        "age",
        "sexuality",
        "otherSexuality",
        "romanticOrientation",
        "gender",
        "otherGender",
        "pronouns",
        "otherPronouns",
        "color",
        "pronounpage",
      ];

      const filteredUpdates = {};
      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      });

      if (
        filteredUpdates.age &&
        (filteredUpdates.age < 13 || filteredUpdates.age > 120)
      ) {
        return res
          .status(400)
          .json({ error: "Age must be between 13 and 120" });
      }

      if (filteredUpdates.bio && filteredUpdates.bio.length > 1024) {
        return res
          .status(400)
          .json({ error: "Bio must be 1024 characters or less" });
      }

      let profile = await ProfileData.findOne({ userId: req.userId });

      if (!profile) {
        try {
          const user = await client.users.fetch(req.userId);
          profile = await ProfileData.create({
            userId: req.userId,
            username: user.username,
            ...filteredUpdates,
          });
        } catch (error) {
          console.error(`Failed to fetch user ${req.userId}:`, error);
          profile = await ProfileData.create({
            userId: req.userId,
            username: req.username,
            ...filteredUpdates,
          });
        }
      } else {
        Object.assign(profile, filteredUpdates);
        await profile.save();
      }

      res.json({ success: true, profile });
    } catch (error) {
      console.error(`Error updating profile for ${req.userId}:`, error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/profile/me", verifyUserToken, async (req, res) => {
    try {
      const result = await ProfileData.deleteOne({ userId: req.userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }

      res.json({ success: true, message: "Profile deleted successfully" });
    } catch (error) {
      console.error(`Error deleting profile for ${req.userId}:`, error);
      res.status(500).json({ error: "Failed to delete profile" });
    }
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

  app.get("/commandusage/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
      const userUsage = await UserCommandUsage.findOne({ userId });

      if (!userUsage || !userUsage.commandsUsed) {
        return res.json({ totalCommands: 0, commands: [] });
      }

      const totalCommands = userUsage.commandsUsed.reduce(
        (sum, cmd) => sum + cmd.usageCount,
        0
      );

      return res.json({
        totalCommands,
        commands: userUsage.commandsUsed.map((cmd) => ({
          name: cmd.commandName,
          count: cmd.usageCount,
          firstUsed: cmd.firstUsedAt,
        })),
      });
    } catch (error) {
      console.error(`Error fetching command usage for ${userId}:`, error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/profile/:userIdOrUsername", async (req, res) => {
    try {
      const { userIdOrUsername } = req.params;
      let profile;

      if (/^\d+$/.test(userIdOrUsername)) {
        profile = await ProfileData.findOne({ userId: userIdOrUsername });
      } else {
        profile = await ProfileData.findOne({ username: userIdOrUsername });
      }

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

  app.get("/:searched", async (req, res) => {
    const { searched } = req.params;

    if (
      searched === "profile" ||
      searched === "health" ||
      searched === "getUser" ||
      searched === "badges"
    ) {
      return res.status(404).json({ message: "Not found" });
    }

    async function serveProfilePage(resolvedUserId, username, userAvatar) {
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

        const profile = await ProfileData.findOne({ userId: resolvedUserId });
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

    if (/^\d+$/.test(searched)) {
      try {
        const user = await client.users.fetch(searched);
        return serveProfilePage(
          searched,
          user.username,
          user.displayAvatarURL({ dynamic: true, size: 512 })
        );
      } catch (error) {
        console.error(
          `Failed to fetch Discord user ${searched}:`,
          error.message
        );
        return serveProfilePage(searched, null, null);
      }
    }

    try {
      const profile = await ProfileData.findOne({ username: searched });
      if (!profile) {
        return res
          .status(404)
          .sendFile(path.join(__dirname, "..", "..", "web", "404.html"));
      }
      try {
        const user = await client.users.fetch(profile.userId);
        return serveProfilePage(
          profile.userId,
          user.username,
          user.displayAvatarURL({ dynamic: true, size: 512 })
        );
      } catch (error) {
        console.error(
          `Failed to fetch Discord user ${profile.userId}:`,
          error.message
        );
        return serveProfilePage(profile.userId, profile.username, null);
      }
    } catch (error) {
      console.error(`Error looking up username ${searched}:`, error);
      return res
        .status(404)
        .sendFile(path.join(__dirname, "..", "..", "web", "404.html"));
    }
  });
};
