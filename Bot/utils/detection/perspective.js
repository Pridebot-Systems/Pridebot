require("dotenv").config();
const { perspectiveAPIKEY } = require("../../../environment");

async function scanText(text) {
  const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${perspectiveAPIKEY}`;
  const body = JSON.stringify({
    comment: { text },
    requestedAttributes: { TOXICITY: {}, INSULT: {} },
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const json = await response.json();
    if (!response.ok) {
      const unsupported = json.error?.details?.some(
        (detail) => detail.errorType === "LANGUAGE_NOT_SUPPORTED_BY_ATTRIBUTE"
      );
      if (unsupported) return { toxicity: 0, insult: 0 };
      console.error(`Perspective API returned ${response.status}: ${json.error?.message}`);
      return null;
    }
    return {
      toxicity: json.attributeScores?.TOXICITY?.summaryScore?.value || 0,
      insult: json.attributeScores?.INSULT?.summaryScore?.value || 0,
    };
  } catch (error) {
    console.error("Error fetching Perspective API:", error);
    return null;
  }
}

module.exports = { scanText };
