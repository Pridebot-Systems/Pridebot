const express = require("express");
const cors = require("cors");
const path = require("path");
const fsPromises = require("fs").promises;
const fs = require("fs");
const { getInfo } = require("discord-hybrid-sharding");

module.exports = (client) => {
  console.log(
    `Avatar API initialization started by Cluster ${getInfo().CLUSTER}.`
  );
  const app = express();
  const port = 2611;

  try {
    app.listen(port, () => {
      console.log(`Avatar API is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start Avatar API:", error);
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "..", "web", "assets"))
  );

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "web", "index.html"));
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      cluster: getInfo().CLUSTER,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  // Get user information endpoint
  app.get("/getUser/:userId", async (req, res) => {
    const { userId } = req.params;
    
    try {
      // Only try to fetch from Discord if it looks like a user ID (numeric)
      if (/^\d+$/.test(userId)) {
        const user = await client.users.fetch(userId);
        return res.json({
          id: user.id,
          username: user.username,
          discriminator: user.discriminator || "0000",
          tag: user.tag || `${user.username}#0000`,
          avatar: user.displayAvatarURL({ dynamic: true, size: 256 })
        });
      } else {
        // If it's not numeric, treat it as a username
        return res.json({
          id: null,
          username: userId,
          discriminator: "0000",
          tag: userId,
          avatar: null
        });
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      // Return username as fallback
      return res.json({
        id: null,
        username: userId,
        discriminator: "0000", 
        tag: userId,
        avatar: null
      });
    }
  });

  // Cache statistics endpoint (for monitoring)
  app.get("/stats/cache", (req, res) => {
    try {
      const { avatarProcessor } = require("../commands/Avatar/avatarProcessor");
      const stats = avatarProcessor.getCacheStats();
      
      res.json({
        timestamp: new Date().toISOString(),
        cluster: getInfo().CLUSTER,
        cache: stats
      });
    } catch (error) {
      res.status(500).json({ error: "Cache stats unavailable" });
    }
  });

  // Avatar generation analytics endpoint
  app.get("/stats/analytics", async (req, res) => {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const { getAvatarAnalytics } = require("../commands/Avatar/avatarAnalytics");
      const analytics = await getAvatarAnalytics(hours);
      
      res.json({
        cluster: getInfo().CLUSTER,
        ...analytics
      });
    } catch (error) {
      console.error('Analytics endpoint error:', error);
      res.status(500).json({ error: "Analytics unavailable" });
    }
  });

  app.get("/files/:identifier", async (req, res) => {
    const identifier = req.params.identifier.toLowerCase();
    const imagePath = path.join(
      __dirname,
      "..",
      "..",
      "src",
      "pfps",
      identifier
    );

    try {
      const stats = await fsPromises.stat(imagePath);
      if (stats.isDirectory()) {
        const files = await fsPromises.readdir(imagePath);
        const imageFiles = files.filter((file) => 
          file.endsWith(".png") || file.endsWith(".webp")
        );
        
        if (imageFiles.length > 0) {
          // Set cache headers for file listings
          res.set({
            'Cache-Control': 'public, max-age=300', // 5 minute cache
            'Content-Type': 'application/json'
          });
          return res.json({ 
            files: imageFiles,
            total: imageFiles.length,
            formats: {
              png: imageFiles.filter(f => f.endsWith('.png')).length,
              webp: imageFiles.filter(f => f.endsWith('.webp')).length
            }
          });
        }
      }
    } catch (error) {
      // Directory doesn't exist or access denied
    }
    
    return res
      .status(404)
      .sendFile(path.join(__dirname, "..", "..", "web", "404.html"));
  });

  app.get("/:identifier", async (req, res) => {
    const { identifier } = req.params;
    
    // Function to serve HTML with user information
    function serveHtmlWithUserInfo(username) {
      const htmlFilePath = path.join(
        __dirname,
        "..",
        "..",
        "web",
        "webavatar.html"
      );
      let htmlContent = fs.readFileSync(htmlFilePath, "utf8");

      const capitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);

      htmlContent = htmlContent.replace(/{user.tag}/g, capitalizedUsername);
      htmlContent = htmlContent.replace(
        /<meta name="og:title" content=".*" \/>/,
        `<meta name="og:title" content="${capitalizedUsername}'s Pride Avatars" />`
      );
      htmlContent = htmlContent.replace(
        /<meta name="og:description" content=".*" \/>/,
        `<meta name="og:description" content="Pridebot Pride Avatars for ${capitalizedUsername}" />`
      );
      htmlContent = htmlContent.replace(
        /<meta name="description" content=".*" \/>/,
        `<meta name="description" content="Pridebot Pride Avatars for ${capitalizedUsername}" />`
      );
      htmlContent = htmlContent.replace(
        /<title>.*<\/title>/,
        `<title>${capitalizedUsername}'s Pride Avatars | Pridebot</title>`
      );

      return res.send(htmlContent);
    }
    
    // If it looks like a user ID, try to fetch from Discord
    if (/^\d+$/.test(identifier)) {
      try {
        const user = await client.users.fetch(identifier);
        return serveHtmlWithUserInfo(user.username);
      } catch (error) {
        console.error(`Failed to fetch Discord user ${identifier}:`, error.message);
        // Fall through to check for folder existence
      }
    }

    // Check if folder exists for this identifier
    const folderIdentifier = identifier.toLowerCase();
    const imagePath = path.join(
      __dirname,
      "..",
      "..",
      "src",
      "pfps",
      folderIdentifier
    );
    
    if (fs.existsSync(imagePath)) {
      return serveHtmlWithUserInfo(folderIdentifier);
    }
    
    // If we reach here, neither Discord user lookup nor folder exists
    console.log(`No user or folder found for identifier: ${identifier}`);
    console.log(`Checked Discord API: ${/^\d+$/.test(identifier) ? 'Yes (failed)' : 'No (not numeric)'}`);
    console.log(`Checked folder path: ${imagePath} - exists: ${fs.existsSync(imagePath)}`);
    
    // Serve HTML anyway with the identifier as fallback username
    // This prevents infinite loading and shows debug info
    return serveHtmlWithUserInfo(identifier);
  });

  // Enhanced image serving with username/userID support and format negotiation
  app.get("/:identifier/:flag.:ext", async (req, res) => {
    const { identifier, flag, ext } = req.params;
    const requestedFormat = ext.toLowerCase();
    
    // Try both as-is and lowercase versions of the identifier
    const possibleIdentifiers = [
      identifier.toLowerCase(),
      identifier
    ];
    
    let imagePath = null;
    let stats = null;
    
    // Search through possible identifiers (supports both username and userID)
    for (const possibleId of possibleIdentifiers) {
      const testPath = path.join(
        __dirname, "..", "..", "src", "pfps",
        possibleId, `${flag}.${requestedFormat}`
      );
      
      try {
        stats = await fsPromises.stat(testPath);
        imagePath = testPath;
        break; // Found the file, stop searching
      } catch (error) {
        // File doesn't exist with this identifier, try next
        continue;
      }
    }
    
    if (imagePath && stats) {
      try {
        // Generate ETag based on file modification time and size
        const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
        
        // Check if client has cached version
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        
        // Set optimized cache headers
        res.set({
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', // 24h cache, 7d stale
          'ETag': etag,
          'Content-Type': `image/${requestedFormat}`,
          'Content-Length': stats.size,
          'Last-Modified': stats.mtime.toUTCString(),
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN'
        });
        
        // Add compression hint for WebP
        if (requestedFormat === 'webp') {
          res.set('X-Image-Format', 'webp-optimized');
        }
        
        return res.sendFile(imagePath);
        
      } catch (error) {
        console.error(`Error serving file ${imagePath}:`, error);
      }
    }
    
    // File not found, try PNG fallback if WebP was requested
    if (requestedFormat === 'webp') {
      for (const possibleId of possibleIdentifiers) {
        const pngPath = path.join(
          __dirname, "..", "..", "src", "pfps",
          possibleId, `${flag}.png`
        );
        
        if (fs.existsSync(pngPath)) {
          res.set({
            'Cache-Control': 'public, max-age=86400',
            'Content-Type': 'image/png'
          });
          return res.sendFile(pngPath);
        }
      }
    }
    
    console.log(`Image not found for any identifier: ${possibleIdentifiers.join(', ')} - ${flag}.${ext}`);
    return res.status(404).json({ 
      error: "Image not found",
      requested: `${flag}.${ext}`,
      searchedIdentifiers: possibleIdentifiers,
      suggestion: 'Generate an avatar first using /prideavatar'
    });
  });
};
