const counts = new Map();

function trackLocale(locale) {
  if (!locale) return;
  counts.set(locale, (counts.get(locale) || 0) + 1);
}

function getLocaleStats() {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([locale, count]) => ({ locale, count }));
}

module.exports = { trackLocale, getLocaleStats };
