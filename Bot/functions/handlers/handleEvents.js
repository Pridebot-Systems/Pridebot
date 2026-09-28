const path = require("path");
const { EVENTS_DIR } = require("../../../Shared/paths");
const { errorlogging } = require("../../utils/logging/errorlogs");
const { listJsFiles } = require("./listFiles");

/**
 * Registers every module under Bot/events that exports { name, execute }.
 *
 * Changes from V1:
 *   - Synchronous. V1's handleEvents was async and never awaited, so a missing
 *     require (localeTracker.js) became an unhandled rejection and NO events
 *     registered — the bot connected and silently ignored every interaction.
 *     A load failure now throws at boot.
 *   - Every handler is wrapped: rejections are logged instead of escaping as
 *     unhandled rejections (V1's manual guild handlers were called without
 *     await inside try/catch, which caught nothing).
 *   - Modules that aren't events (server/restart.js) are skipped, not registered
 *     under an empty event name as V1 did.
 */
function loadEvents(client, dir = EVENTS_DIR) {
  const registered = [];
  const skipped = [];

  for (const file of listJsFiles(dir)) {
    const mod = require(file);
    const rel = path.relative(dir, file).split(path.sep).join("/");

    if (typeof mod?.name !== "string" || typeof mod.execute !== "function") {
      skipped.push(rel);
      continue;
    }

    const run = async (...args) => {
      try {
        await mod.execute(...args, client);
      } catch (err) {
        console.error(`[EVENTS] ${mod.name} handler failed:`, err);
        await errorlogging(client, err, { event: mod.name }).catch(() => {});
      }
    };

    if (mod.once) client.once(mod.name, run);
    else client.on(mod.name, run);
    registered.push(`${mod.name} (${rel})`);
  }

  return { registered, skipped };
}

module.exports = { loadEvents };
