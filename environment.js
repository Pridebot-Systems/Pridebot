require("dotenv").config();

const isBeta = process.env.beta === "true";

const missing = [];

/** Pick a beta/prod pair and record the name if the chosen side is unset. */
function pick(betaVar, prodVar) {
  const name = isBeta ? betaVar : prodVar;
  const value = process.env[name];
  if (value === undefined || value === "") missing.push(name);
  return value;
}

const config = {
  isBeta,
  isProduction: !isBeta,
  environment: isBeta ? "beta" : "production",

  token: pick("betatoken", "token"),
  clientId: pick("betaID", "prodID"),
  clientSecret: pick("betaClientSecret", "prodClientSecret"),
  callbackURL: pick("betaAuthCallback", "prodAuthCallback"),

  ports: {
    api: pick("betaAPIport", "prodAPIport"),
    avatar: pick("betaAvatarAPIport", "prodAvatarAPIport"),
    profile: pick("betaProfileAPIport", "prodProfileAPIport"),
    premium: pick("betaPremiumAPIport", "prodPremiumAPIport"),
  },

  links: {
    api: pick("betaAPIlink", "prodAPIlink"),
    avatar: pick("betaAvatarlink", "prodAvatarlink"),
    // NOTE: the prod names have no "API" infix — V1's environment.js read
    // prodProfileAPIlink/prodPremiumAPIlink, which do not exist in .env, so both
    // of these were silently undefined in production.
    profile: pick("betaProfileAPIlink", "prodProfilelink"),
    premium: pick("betaPremiumAPIlink", "prodPremiumlink"),
  },

  databaseToken: process.env.databaseToken,
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",

  secrets: {
    jwt: process.env.JWT_SECRET,
    session: process.env.SESSION_SECRET,
    profileApiToken: process.env.PROFILE_API_TOKEN,
    premiumRecheck: process.env.PremiumRecheckSecret,
  },

  patreon: {
    webhookSecret: process.env.PateronWebhookSecret,
    campaignId: process.env.PATREON_CAMPAIGN_ID,
    accessToken: process.env.PATREON_ACCESS_TOKEN,
    // Required to resolve a patron's Discord ID; V1 read it straight from
    // process.env inside premiumapi rather than through this config.
    creatorAccessToken: process.env.PATREON_CREATOR_ACCESS_TOKEN,
  },

  botLists: {
    topggToken: process.env.topggToken,
    botlistToken: process.env.botlisttoken,
    botlistAuth: process.env.botlistauth,
    discordsToken: process.env.discordstoken,
    discordsAuth: process.env.discordsauth,
    discordlistggToken: process.env.discordlistggToken,
    discordlistggWebhookSecret: process.env.discordlistggWebhookSecret,
    dellyToken: process.env.DELLYToken,
  },

  // Inbound webhook secrets. Optional at boot, but each webhook REJECTS every
  // request while its secret is unset — V1 accepted Top.gg and GitHub webhooks
  // with no authentication at all.
  webhooks: {
    // Top.gg legacy (v0) webhooks: the Authorization value set on the bot's edit page.
    topggAuth: process.env.TOPGG_WEBHOOK_AUTH,
    // Top.gg v1 webhooks: the whs_ signing secret shown after saving the webhook URL.
    // Top.gg generates one per project, so the support server has its own.
    topggSecret: process.env.TOPGG_WEBHOOK_SECRET,
    topggServerSecret: process.env.TOPGG_SERVER_WEBHOOK_SECRET,
    githubSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },

  githubToken: process.env.githubToken,
  perspectiveAPIKEY: process.env.perspectiveAPIKEY,
  // NOTE: the .env key is misspelled "SpreedSheetID"; corrected on this side only.
  spreadSheetID: process.env.SpreedSheetID,
  // Google service-account key for the Sheets export. Docker mounts it from
  // secrets/; outside Docker it defaults to API/statsapi/google-credentials.json.
  googleCredentialsFile: process.env.GOOGLE_CREDENTIALS_FILE,

  pluralbuddy: {
    clientId: process.env.PluralBotClientID,
    clientSecret: process.env.PluralBotClientSecret,
    // V1 had identical beta/prod branches here, so beta always used the prod URL.
    callbackURL: `${
      isBeta ? process.env.betaProfileAPIlink : process.env.prodProfilelink
    }/auth/pluralbuddy/callback`,
  },
};

/** Secrets with no beta/prod split that nothing can boot without. */
for (const [name, value] of Object.entries({
  databaseToken: config.databaseToken,
  JWT_SECRET: config.secrets.jwt,
  SESSION_SECRET: config.secrets.session,
})) {
  if (!value) missing.push(name);
}

if (missing.length) {
  console.error(
    `[ENV] Missing required variables for ${config.environment}: ${missing.join(", ")}`
  );
  console.error("[ENV] Every variable this reads is listed in environment.js.");
  process.exit(1);
}

module.exports = config;
