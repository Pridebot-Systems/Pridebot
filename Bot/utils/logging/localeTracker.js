/**
 * Counts which Discord locales invoke commands, to show where translations
 * would reach the most users.
 *
 * V1's interactionCreate.js required this file from commit 84df598 onward, but it
 * was never committed. Because handleEvents() wasn't awaited, the MODULE_NOT_FOUND
 * surfaced as an unhandled rejection and no interaction handlers registered — the
 * bot connected and answered nothing.
 *
 * Counts are in-memory and per cluster; they reset on restart. Collect across
 * clusters with:
 *   client.cluster.broadcastEval(() => require(<this file>).getLocaleStats())
 */

const counts = new Map();

function trackLocale(locale) {
  if (!locale) return;
  counts.set(locale, (counts.get(locale) || 0) + 1);
}

/** Locales by usage, highest first. */
function getLocaleStats() {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([locale, count]) => ({ locale, count }));
}

module.exports = { trackLocale, getLocaleStats };
