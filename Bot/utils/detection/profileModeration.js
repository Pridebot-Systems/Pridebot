const { containsDisallowedContent } = require("./containDisallow");
const { scanText } = require("./perspective");

/** Perspective scores above this refuse the text, as /profile always has. */
const TOXICITY_LIMIT = 0.65;

/**
 * Check public profile text before it is saved — shared by /profile and the
 * web profile editor so both refuse the same things.
 *
 * `fields` is a list of [label, text] pairs; the label ("Bio") is what users and
 * moderators are shown. Empty values are skipped. Resolves to:
 *   { ok: true }
 *   { ok: false, reason: "blocked", label, text }     a blocked term
 *   { ok: false, reason: "toxic", label, text, toxicity, insult }
 *   { ok: false, reason: "unavailable" }               the scan failed; refuse
 *
 * Every field is scanned on its own. V1 scanned `preferredName || bio`, so a bio
 * set in the same command as a name was never checked for toxicity.
 */
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
