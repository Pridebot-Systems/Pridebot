const fs = require("fs");
const path = require("path");

/**
 * The status service's only persistent state: incidents, recent events, daily
 * uptime buckets, and the heartbeat that measures downtime across restarts.
 *
 * One JSON file under data/ (a volume, so it survives image rebuilds), written to
 * a temp file and renamed into place so a crash mid-write never truncates it. The
 * cluster manager is the only writer.
 */

const VERSION = 1;

function emptyState() {
  return {
    version: VERSION,
    /** Last time a check completed. A gap since then on boot is downtime. */
    lastSeen: null,
    /** True only when the manager stopped through its signal handler. */
    cleanShutdown: true,
    nextIncidentId: 1,
    incidents: [],
    events: [],
    /** { [component]: { "YYYY-MM-DD": { up, total } } }, seconds. */
    uptime: {},
  };
}

function load(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT")
      console.error(`[STATUS] Cannot read ${file}:`, err.message);
    return emptyState();
  }

  try {
    const data = JSON.parse(raw);
    if (data.version === VERSION) return { ...emptyState(), ...data };
    console.warn(`[STATUS] ${file} has version ${data.version}, expected ${VERSION}`);
  } catch (err) {
    console.error(`[STATUS] ${file} is not valid JSON:`, err.message);
  }

  // Keep the unreadable file for inspection instead of overwriting the history.
  const aside = `${file}.bad-${Date.now()}`;
  try {
    fs.renameSync(file, aside);
    console.warn(`[STATUS] Moved it to ${aside}; starting with empty history`);
  } catch (err) {
    console.error(`[STATUS] Could not move ${file} aside:`, err.message);
  }
  return emptyState();
}

function save(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}

module.exports = { load, save, emptyState };
