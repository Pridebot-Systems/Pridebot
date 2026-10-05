const { containsDisallowedContent } = require("./containDisallow");
const { scanText } = require("./perspective");
const TOXICITY_LIMIT = 0.65;

async function checkProfileText(fields, username) {
  const entries = fields.filter(([, text]) => typeof text === "string" && text.trim());

  for (const [label, text] of entries) {
    if (await containsDisallowedContent(text, username)) {
      return { ok: false, reason: "blocked", label, text };
    }
  }

  const scans = await Promise.all(entries.map(([, text]) => scanText(text)));
  for (const [i, scan] of scans.entries()) {
    if (!scan) return { ok: false, reason: "unavailable" };
    if (scan.toxicity > TOXICITY_LIMIT || scan.insult > TOXICITY_LIMIT) {
      const [label, text] = entries[i];
      return { ok: false, reason: "toxic", label, text, ...scan };
    }
  }

  return { ok: true };
}

module.exports = { checkProfileText, TOXICITY_LIMIT };
