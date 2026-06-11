const fs = require("fs");
const path = require("path");

const supportedLanguages = [
  "id", // Indonesian
  "da", // Danish
  "de", // German
  "en-US", // English (US)
  "es-ES", // Spanish (Spain)
  "es-419", // Spanish (Latin America)
  "fr", // French
  "hr", // Croatian 
  "it", // Italian 
  "lt", // Lithuanian
  "hu", // Hungarian 
  "nl", // Dutch
  "no", // Norwegian
  "pl", // Polish
  "pt-BR", // Portuguese (Brazil)
  "ro", // Romanian
  "fi", // Finnish
  "sv-SE", // Swedish
  "vi", // Vietnamese
  "tr", // Turkish
  "cs", // Czech
  "el", // Greek
  "bg", // Bulgarian
  "ru", // Russian
  "uk", // Ukrainian
  "hi", // Hindi
  "th", // Thai
  "zh-CN", // Chinese (Simplified)
  "ja", // Japanese
  "zh-TW", // Chinese (Traditional)
  "ko", // Korean
];

function getCategoryFolder(category) {
  switch (category) {
    case "Pride": return "PrideTranslations";
    case "Terms": return "TermsTranslations";
    case "Fun": return "FunTranslations";
    case "Support": return "SupportTranslations";
    default: return category;
  }
}

function loadTranslations(language, category, commandName) {
  const folder = getCategoryFolder(category);
  const normalized = language === "en-GB" ? "en-US" : language;
  const lang = supportedLanguages.includes(normalized) ? normalized : "en-US";
  const base = path.join(__dirname, "..", "..", "translations", folder, commandName);
  const filePath = path.join(base, `${lang}.json`);
  const defaultPath = path.join(base, "en-US.json");

  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    console.warn(`Translation file for '${language}' not found for '${commandName}'. Falling back to en-US.`);
    return JSON.parse(fs.readFileSync(defaultPath, "utf8"));
  } catch (error) {
    console.error(`Error loading translations for '${commandName}' (${language}):`, error);
    return JSON.parse(fs.readFileSync(defaultPath, "utf8"));
  }
}

module.exports = loadTranslations;
