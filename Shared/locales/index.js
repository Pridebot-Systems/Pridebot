/**
 * Locale loader — moved out of the bot so the website can use the same strings.
 *
 * V1 kept this at src/config/commandfunctions/translation.js with the JSON under
 * src/translations/, i.e. bot-only: the website had no i18n at all and would have
 * started from zero. Living in Shared/ means one string set serves both.
 *
 * Changes from V1:
 *   - results are cached (V1 did a synchronous fs.existsSync + readFileSync on
 *     every single command invocation)
 *   - the "<Category>Translations" folder suffix is gone; the folder is just the
 *     category name, so the loader needs no per-category switch to maintain (V1's
 *     mapped Terms and Support to folders that did not exist)
 *   - a missing en-US fallback returns {} instead of throwing inside the handler
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_LOCALE = "en-US";

/** Discord's locale codes that the bot advertises support for. */
const SUPPORTED_LOCALES = [
  "id", "da", "de", "en-US", "es-ES", "es-419", "fr", "hr", "it", "lt",
  "hu", "nl", "no", "pl", "pt-BR", "ro", "fi", "sv-SE", "vi", "tr",
  "cs", "el", "bg", "ru", "uk", "hi", "th", "zh-CN", "ja", "zh-TW", "ko",
];

/** Discord sends en-GB but we only ship en-US copy. */
const LOCALE_ALIASES = { "en-GB": "en-US" };

const cache = new Map();

function normalizeLocale(locale) {
  const aliased = LOCALE_ALIASES[locale] || locale;
  return SUPPORTED_LOCALES.includes(aliased) ? aliased : DEFAULT_LOCALE;
}

function readLocaleFile(category, commandName, locale) {
  const file = path.join(__dirname, category, commandName, `${locale}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`[locales] ${category}/${commandName}/${locale}.json is not valid JSON:`, err.message);
    return null;
  }
}

/**
 * Load a command's strings, falling back to en-US then to an empty object.
 * @param {string} locale      Discord locale code, e.g. "de"
 * @param {string} category    Command category folder, e.g. "Pride"
 * @param {string} commandName Command folder, e.g. "gay"
 */
function loadTranslations(locale, category, commandName) {
  const resolved = normalizeLocale(locale);
  const key = `${category}/${commandName}/${resolved}`;
  if (cache.has(key)) return cache.get(key);

  let strings = readLocaleFile(category, commandName, resolved);
  if (!strings && resolved !== DEFAULT_LOCALE) {
    strings = readLocaleFile(category, commandName, DEFAULT_LOCALE);
  }
  if (!strings) {
    console.warn(`[locales] no strings for ${category}/${commandName} (${locale})`);
    strings = {};
  }

  cache.set(key, strings);
  return strings;
}

/** Which locales a command actually ships — for coverage reporting. */
function availableLocales(category, commandName) {
  const dir = path.join(__dirname, category, commandName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

function clearCache() {
  cache.clear();
}

module.exports = {
  loadTranslations,
  availableLocales,
  normalizeLocale,
  clearCache,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
};
