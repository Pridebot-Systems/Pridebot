const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const NodeCache = require("node-cache");
const Queue = require("bull");

// Cache configurations
const flagCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour cache, check every 10 minutes
const avatarCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 minute cache, check every 2 minutes
const processedAvatarCache = new NodeCache({ stdTTL: 1800, checkperiod: 300 }); // 30 minute cache for final results

// Background processing queue (with fallback if Redis is not available)
let avatarQueue;
try {
  avatarQueue = new Queue("avatar processing", {
    redis: { port: 6379, host: "127.0.0.1" },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });
} catch (error) {
  console.warn(
    "Redis not available for queue, background processing disabled:",
    error.message
  );
  avatarQueue = null;
}

// Valid flags list
const validFlags = [
  "abrosexual",
  "aceflux",
  "agender",
  "ally",
  "androgyne",
  "aroace",
  "aroace2",
  "aroflux",
  "aromantic",
  "asexual",
  "aurorian",
  "bigender",
  "bisexual",
  "boyflux",
  "butch",
  "butchlesbian",
  "butchlesbian2",
  "butchlesbian3",
  "catgender",
  "cupioromantic",
  "demibisexual",
  "demiboy",
  "demigirl",
  "deminonbinary",
  "demiromantic",
  "demisexual",
  "gay",
  "genderfae",
  "genderfaun",
  "genderfluid",
  "genderflux",
  "genderqueer",
  "girlflux",
  "graygender",
  "grayromantic",
  "graysexual",
  "lesbian",
  "lesboy",
  "lgbt",
  "lunarian",
  "neptunic",
  "nonbinary",
  "omnisexual",
  "pangender",
  "pansexual",
  "polyamorous",
  "polysexual",
  "queer",
  "queerplatonic",
  "queerplatonic2",
  "sapphic",
  "selenosexual",
  "singularian",
  "solarian",
  "spacialian",
  "stellarian",
  "transfeminine",
  "transgender",
  "transmasculine",
];

class AvatarProcessor {
  constructor() {
    this.initialized = false;
    this.processing = new Map();
  }

  // Initialize the processor by pre-loading all flags into cache
  async initialize() {
    if (this.initialized) return;

    console.log("Initializing Avatar Processor - Pre-loading flags...");
    const startTime = Date.now();

    try {
      // Load all flags in parallel
      const flagPromises = validFlags.map(async (flagName) => {
        try {
          const flagPath = path.join(
            __dirname,
            "../../flags",
            `${flagName}.png`
          );
          const flagBuffer = await sharp(flagPath)
            .resize(512, 512)
            .png()
            .toBuffer();
          flagCache.set(flagName, flagBuffer);
          return flagName;
        } catch (error) {
          console.error(`Error loading flag ${flagName}:`, error);
          return null;
        }
      });

      const loadedFlags = await Promise.all(flagPromises);
      const successCount = loadedFlags.filter((flag) => flag !== null).length;
      const failedFlags = loadedFlags
        .map((flag, index) => (flag === null ? validFlags[index] : null))
        .filter((flag) => flag !== null);

      console.log(
        `Avatar Processor initialized in ${
          Date.now() - startTime
        }ms - ${successCount}/${validFlags.length} flags loaded`
      );

      if (failedFlags.length > 0) {
        console.warn(`Failed to load flags: ${failedFlags.join(", ")}`);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize Avatar Processor:", error);
      throw error;
    }
  }

  // Check if a flag combination is valid
  validateFlags(flagName, flagName2) {
    if (!validFlags.includes(flagName)) {
      return { valid: false, error: `Invalid flag: ${flagName}` };
    }
    if (flagName2 && !validFlags.includes(flagName2)) {
      return { valid: false, error: `Invalid flag: ${flagName2}` };
    }
    return { valid: true };
  }

  // Get cached flag buffer, load if not in cache
  async getFlagBuffer(flagName) {
    let flagBuffer = flagCache.get(flagName);

    if (!flagBuffer) {
      // Flag not in cache, try to load it
      try {
        const flagPath = path.join(__dirname, "../../flags", `${flagName}.png`);
        flagBuffer = await sharp(flagPath).resize(512, 512).png().toBuffer();
        flagCache.set(flagName, flagBuffer);
        console.log(`Reloaded flag into cache: ${flagName}`);
      } catch (error) {
        console.error(`Error loading flag ${flagName}:`, error);
        return null;
      }
    }

    return flagBuffer;
  }

  // Download and cache user avatar
  async getUserAvatar(avatarURL, userID) {
    const cacheKey = `avatar-${userID}`;
    let avatarBuffer = avatarCache.get(cacheKey);

    if (!avatarBuffer) {
      try {
        const response = await axios.get(avatarURL, {
          responseType: "arraybuffer",
          timeout: 10000,
          headers: {
            "User-Agent": "Pridebot/1.0 (Discord Bot)",
          },
        });

        // Process avatar into circular format immediately
        avatarBuffer = await sharp(response.data)
          .resize(412, 412)
          .composite([
            {
              input: Buffer.from(
                `<svg><circle cx="206" cy="206" r="206" fill="white"/></svg>`
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toBuffer();

        avatarCache.set(cacheKey, avatarBuffer);
      } catch (error) {
        console.error(`Error downloading avatar for user ${userID}:`, error);
        throw new Error("Failed to download user avatar");
      }
    }

    return avatarBuffer;
  }

  // Optimized single-pass avatar generation
  async generateAvatar(
    avatarURL,
    flagName,
    flagName2,
    userID,
    username = null
  ) {
    // Ensure processor is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const cacheKey = `${userID}-${flagName}${flagName2 ? "-" + flagName2 : ""}`;

    // Check cache first
    const cached = processedAvatarCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Prevent duplicate processing
    if (this.processing.has(cacheKey)) {
      return await this.processing.get(cacheKey);
    }

    const processingPromise = this._processAvatar(
      avatarURL,
      flagName,
      flagName2,
      userID,
      cacheKey
    );
    this.processing.set(cacheKey, processingPromise);

    try {
      const result = await processingPromise;
      processedAvatarCache.set(cacheKey, result);
      return result;
    } finally {
      this.processing.delete(cacheKey);
    }
  }

  async _processAvatar(avatarURL, flagName, flagName2, userID, cacheKey) {
    const startTime = Date.now();

    try {
      // Get all required resources in parallel
      const [avatarBuffer, flagBuffer, flagBuffer2] = await Promise.all([
        this.getUserAvatar(avatarURL, userID),
        this.getFlagBuffer(flagName),
        flagName2 ? this.getFlagBuffer(flagName2) : null,
      ]);

      if (!flagBuffer) {
        throw new Error(
          `Flag buffer could not be loaded: ${flagName}. Check if the flag file exists and is readable.`
        );
      }
      if (flagName2 && !flagBuffer2) {
        throw new Error(
          `Flag buffer could not be loaded: ${flagName2}. Check if the flag file exists and is readable.`
        );
      }

      // Build composite array
      const composite = [];

      if (flagName2) {
        // Split flags side by side for dual flags
        const halfFlag1 = await sharp(flagBuffer)
          .extract({ left: 0, top: 0, width: 256, height: 512 })
          .toBuffer();

        const halfFlag2 = await sharp(flagBuffer2)
          .extract({ left: 256, top: 0, width: 256, height: 512 })
          .toBuffer();

        composite.push(
          { input: halfFlag1, left: 0, top: 0 },
          { input: halfFlag2, left: 256, top: 0 }
        );
      } else {
        composite.push({ input: flagBuffer, left: 0, top: 0 });
      }

      // Add the circular avatar on top
      composite.push({ input: avatarBuffer, top: 50, left: 50 });

      // Single Sharp operation for final composition
      const finalBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          ...composite,
          {
            input: Buffer.from(
              `<svg><circle cx="256" cy="256" r="256" fill="white"/></svg>`
            ),
            blend: "dest-in",
          },
        ])
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();

      const processingTime = Date.now() - startTime;

      // Only log slow operations in production
      if (processingTime > 1000) {
        console.log(
          `Slow avatar generation: ${processingTime}ms for ${userID} (${flagName}${
            flagName2 ? "+" + flagName2 : ""
          })`
        );
      }

      return {
        buffer: finalBuffer,
        processingTime,
        fileSize: finalBuffer.length,
        cacheKey,
      };
    } catch (error) {
      console.error(`Error processing avatar for user ${userID}:`, error);
      throw error;
    }
  }

  // Save avatar with async operations and multiple formats
  async saveAvatar(avatarData, userID, fileName, username = null) {
    const userIDDir = path.join(__dirname, "../../pfps", userID.toLowerCase());

    try {
      // Always save to user ID directory
      await fs.mkdir(userIDDir, { recursive: true });

      const basePath = path.join(userIDDir, fileName.replace(".png", ""));
      const pngPath = `${basePath}.png`;
      const webpPath = `${basePath}.webp`;

      // Generate WebP version for better compression
      const [pngBuffer, webpBuffer] = await Promise.all([
        avatarData.buffer,
        sharp(avatarData.buffer).webp({ quality: 90 }).toBuffer(),
      ]);

      // Save to user ID directory
      await Promise.all([
        fs.unlink(pngPath).catch(() => {}), // Ignore error if file doesn't exist
        fs.unlink(webpPath).catch(() => {}),
        fs.writeFile(pngPath, pngBuffer),
        fs.writeFile(webpPath, webpBuffer),
      ]);

      // Also save to username directory if username is provided
      if (username) {
        const usernameDir = path.join(
          __dirname,
          "../../pfps",
          username.toLowerCase()
        );
        await fs.mkdir(usernameDir, { recursive: true });

        const usernameBasePath = path.join(
          usernameDir,
          fileName.replace(".png", "")
        );
        const usernamePngPath = `${usernameBasePath}.png`;
        const usernameWebpPath = `${usernameBasePath}.webp`;

        await Promise.all([
          fs.unlink(usernamePngPath).catch(() => {}),
          fs.unlink(usernameWebpPath).catch(() => {}),
          fs.writeFile(usernamePngPath, pngBuffer),
          fs.writeFile(usernameWebpPath, webpBuffer),
        ]);
      }

      return { pngPath, webpPath };
    } catch (error) {
      console.error(`Error saving avatar for user ${userID}:`, error);
      throw error;
    }
  }

  // Queue avatar generation for background processing
  async queueAvatarGeneration(avatarURL, flagName, flagName2, userID) {
    if (!avatarQueue) {
      // Fallback to direct processing if queue is not available
      return await this.generateAvatar(avatarURL, flagName, flagName2, userID);
    }

    const job = await avatarQueue.add("generate", {
      avatarURL,
      flagName,
      flagName2,
      userID,
      timestamp: Date.now(),
    });

    return job.finished();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      flags: {
        keys: flagCache.keys().length,
        stats: flagCache.getStats(),
      },
      avatars: {
        keys: avatarCache.keys().length,
        stats: avatarCache.getStats(),
      },
      processed: {
        keys: processedAvatarCache.keys().length,
        stats: processedAvatarCache.getStats(),
      },
    };
  }

  // Clear specific caches
  clearCache(type = "all") {
    switch (type) {
      case "flags":
        flagCache.flushAll();
        break;
      case "avatars":
        avatarCache.flushAll();
        break;
      case "processed":
        processedAvatarCache.flushAll();
        break;
      case "all":
      default:
        flagCache.flushAll();
        avatarCache.flushAll();
        processedAvatarCache.flushAll();
        break;
    }
  }
}

// Process avatar generation jobs (only if queue is available)
if (avatarQueue) {
  avatarQueue.process("generate", async (job) => {
    const { avatarURL, flagName, flagName2, userID } = job.data;
    const processor = new AvatarProcessor();
    return await processor.generateAvatar(
      avatarURL,
      flagName,
      flagName2,
      userID
    );
  });
}

// Create singleton instance
const avatarProcessor = new AvatarProcessor();

module.exports = {
  avatarProcessor,
  validFlags,
  AvatarProcessor,
};
