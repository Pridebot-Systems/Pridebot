const path = require("path");
const { EVENTS_DIR } = require("../../../Shared/paths");
const { errorlogging } = require("../../utils/logging/errorlogs");
const { listJsFiles } = require("./listFiles");

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
