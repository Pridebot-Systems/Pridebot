require("dotenv").config();

const isBeta = process.env.beta === "true";

const missing = [];

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
    status:
      process.env[isBeta ? "betaStatusPort" : "prodStatusPort"] ||
      (isBeta ? "2514" : "2614"),
  },

  links: {
    api: pick("betaAPIlink", "prodAPIlink"),
    avatar: pick("betaAvatarlink", "prodAvatarlink"),
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
    statusAdmin: process.env.STATUS_ADMIN_TOKEN,
  },

  patreon: {
    webhookSecret: process.env.PateronWebhookSecret,
    campaignId: process.env.PATREON_CAMPAIGN_ID,
    accessToken: process.env.PATREON_ACCESS_TOKEN,
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

  webhooks: {
    topggAuth: process.env.TOPGG_WEBHOOK_AUTH,
    topggSecret: process.env.TOPGG_WEBHOOK_SECRET,
    topggServerSecret: process.env.TOPGG_SERVER_WEBHOOK_SECRET,
    githubSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },

  githubToken: process.env.githubToken,
  perspectiveAPIKEY: process.env.perspectiveAPIKEY,
  spreadSheetID: process.env.SpreedSheetID,
  googleCredentialsFile: process.env.GOOGLE_CREDENTIALS_FILE,

  pluralbuddy: {
    clientId: process.env.PluralBotClientID,
    clientSecret: process.env.PluralBotClientSecret,
    callbackURL: `${
      isBeta ? process.env.betaProfileAPIlink : process.env.prodProfilelink
    }/auth/pluralbuddy/callback`,
  },
};

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
