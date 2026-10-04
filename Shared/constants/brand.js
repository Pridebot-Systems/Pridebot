/**
 * Brand identity and hardcoded IDs — single source of truth.
 *
 * V1 spread these across ~40 sites: the brand colour appeared as a literal in 29
 * embeds (plus 3 more without the `#`, and a stray "#FF00AE" in 4 others), and the
 * client ID was pasted into 7 files across the bot and the site.
 */

const BRAND = {
  name: "Pridebot",
  /** Primary embed / accent colour. Use COLORS.PRIMARY, never the literal. */
  colors: {
    PRIMARY: "#FF00EA",
    SUCCESS: "#27AE60",
    ERROR: "#FF0000",
    WARNING: "#FF6B6B",
    ACCENT: "#FF69B4",
  },
};

const CLIENT_ID = "1101256478632972369";

/** Bot owner. Gates owner-only slash commands and the prefix-style Dev commands. */
const OWNER_ID = "691506668781174824";

/** Permission bits used by the public invite link. */
const INVITE_PERMISSIONS = "137976136768";

/** Google Analytics 4 measurement ID (web pages only; disclosed in the privacy policy). */
const GA_MEASUREMENT_ID = "G-LZ8MNVWBY9";

/** Auth cookie shared across *.pridebot.xyz subdomains. */
const COOKIE_DOMAIN = ".pridebot.xyz";
const AUTH_COOKIE_NAME = "pridebot_token";
const AUTH_TOKEN_TTL_DAYS = 7;

/**
 * Discord IDs that V1 hardcoded mid-function. Kept here so they are greppable and
 * overridable per environment rather than buried in bot.js / premiumapi.js.
 */
const CHANNELS = {
  /** Daily pfp cleanup report and the restart/downtime embed. */
  CLEANUP: "1360270874933989386",
  /** Guild join/leave log. */
  GUILD_LOG: "1112590962867310602",
  /** errorlogging() target. */
  ERROR_LOG: "1303936573586411540",
  /** Public: GitHub feed and new-patron announcements. */
  ANNOUNCEMENTS: "1101742377372237906",
  /** Vote thank-you embeds. */
  VOTES: "1224815141921624186",
  /** Staff-only Patreon activity log. */
  PREMIUM: "1450239691075883222",
  /** Staff-only: profile text refused by moderation (bot and web editor). */
  MOD_FLAGS: "1231591223337160715",
};

/** Guilds the APIs read from. */
const GUILDS = {
  /** Staff/logging server that holds the log channels. */
  LOGGING: "1101740375342845952",
  /** Support server; member count and icon feed /serverstats. */
  PRIDECORD: "1077258761443483708",
  /** Partner server reported by /githubapi. */
  PRISMA: "921403338069770280",
};

module.exports = {
  BRAND,
  COLORS: BRAND.colors,
  CLIENT_ID,
  OWNER_ID,
  INVITE_PERMISSIONS,
  GA_MEASUREMENT_ID,
  COOKIE_DOMAIN,
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_TTL_DAYS,
  CHANNELS,
  GUILDS,
};
