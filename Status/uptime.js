/**
 * Time-weighted uptime, bucketed by UTC day.
 *
 * Each check adds the time since the previous check, weighted by how healthy the
 * component was (the bot's weight is the fraction of shards ready, so one dead
 * cluster of five costs 20%, not 100%). Downtime while the manager itself was
 * stopped is added on boot as a zero-weight span, so a full outage still counts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;

const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Credit [start, end) to `component`, `upFraction` (0–1) of it as up. */
function addSpan(uptime, component, start, end, upFraction) {
  if (!(end > start)) return;
  const days = (uptime[component] ??= {});
  let t = start;
  while (t < end) {
    const segmentEnd = Math.min(end, (Math.floor(t / DAY_MS) + 1) * DAY_MS);
    const seconds = (segmentEnd - t) / 1000;
    const bucket = (days[dayKey(t)] ??= { up: 0, total: 0 });
    bucket.total += seconds;
    bucket.up += seconds * upFraction;
    t = segmentEnd;
  }
}

function prune(uptime, now) {
  const oldest = dayKey(now - (HISTORY_DAYS - 1) * DAY_MS);
  for (const days of Object.values(uptime)) {
    for (const key of Object.keys(days)) if (key < oldest) delete days[key];
  }
}

const percent = (up, total) =>
  total > 0 ? Math.round((up / total) * 100000) / 1000 : null;

/**
 * Per-day percentages for the last `HISTORY_DAYS` days (oldest first, null where
 * there is no data) and rolled-up figures for 1, 7, 30 and 90 days.
 */
function summarize(uptime, component, now) {
  const days = uptime[component] || {};
  const series = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = dayKey(now - i * DAY_MS);
    const bucket = days[date];
    series.push({ date, uptime: bucket ? percent(bucket.up, bucket.total) : null });
  }

  const rollup = (n) => {
    let up = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const bucket = days[dayKey(now - i * DAY_MS)];
      if (bucket) {
        up += bucket.up;
        total += bucket.total;
      }
    }
    return percent(up, total);
  };

  return { days: series, d1: rollup(1), d7: rollup(7), d30: rollup(30), d90: rollup(90) };
}

module.exports = { addSpan, prune, summarize, dayKey, DAY_MS, HISTORY_DAYS };
