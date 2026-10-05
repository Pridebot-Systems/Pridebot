const { CLIENT_ID, INVITE_PERMISSIONS } = require("./brand");

const SITE = "https://pridebot.xyz";

const LINKS = {
  site: SITE,
  invite: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${INVITE_PERMISSIONS}&scope=bot`,
  support: `${SITE}/support`,
  premium: `${SITE}/premium`,
  tos: `${SITE}/tos`,
  privacy: `${SITE}/privacy`,
  partners: `${SITE}/partners`,
  github: "https://github.com/Pridebot-Systems/Pridebot",
  githubOrg: "https://github.com/Pridebot-Systems",
  patreon: "https://patreon.com/Pridebotdiscord",
  legalEmail: "legal@pridebot.xyz",
};

const BOT_LISTS = [
  {
    key: "topgg",
    name: "Top.gg",
    page: `https://top.gg/bot/${CLIENT_ID}`,
    vote: `https://top.gg/bot/${CLIENT_ID}/vote`,
    cooldownHours: 12,
  },
  {
    key: "discords",
    name: "Discords.com",
    page: `https://discords.com/bots/bot/${CLIENT_ID}`,
    vote: `https://discords.com/bots/bot/${CLIENT_ID}/vote`,
    cooldownHours: 12,
  },
  {
    key: "botlist",
    name: "Botlist.me",
    page: `https://botlist.me/bots/${CLIENT_ID}`,
    vote: `https://botlist.me/bots/${CLIENT_ID}/vote`,
    cooldownHours: 12,
  },
  {
    key: "discordlistgg",
    name: "Discordlist.gg",
    page: `https://discordlist.gg/bot/${CLIENT_ID}`,
    vote: `https://discordlist.gg/bot/${CLIENT_ID}/vote`,
    cooldownHours: 12,
  },
];

const SOCIALS = {
  tiktok: "https://www.tiktok.com/@pridebotdiscord",
  x: "https://x.com/pridebotdiscord",
};

module.exports = { LINKS, BOT_LISTS, SOCIALS };
