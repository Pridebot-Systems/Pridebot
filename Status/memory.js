const fs = require("fs");
const path = require("path");

/**
 * Per-cluster memory over time, so a leak shows up as a trend instead of a
 * surprise OOM restart. The status snapshot only has the current value.
 *
 * One JSON line per sample in its own file (appended, not rewritten each check
 * like the state file), next to the state file so a preview stays isolated.
 * Old lines are dropped once a day's worth has expired.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  everyMs: 5 * 60_000,
  retentionMs: 14 * DAY_MS,
};

class MemoryHistory {
  constructor(file, { now = Date.now, ...options } = {}) {
    this.file = file;
    this.now = now;
    this.options = { ...DEFAULTS, ...options };
    this.samples = this._load();
    this.lastAt = this.samples.at(-1)?.at ?? 0;
  }

  /** `clusters` as built by StatusMonitor#_checkCluster; down clusters are skipped. */
  record(clusters) {
    const now = this.now();
    if (now - this.lastAt < this.options.everyMs) return;
    const reporting = clusters.filter((c) => c.memoryMB !== null);
    if (!reporting.length) return;

    this.lastAt = now;
    const sample = {
      at: now,
      clusters: reporting.map((c) => ({
        id: c.id,
        rssMB: c.memoryMB,
        heapMB: c.heapMB,
        users: c.cachedUsers,
        members: c.cachedMembers,
        uptime: c.uptime,
      })),
    };
    this.samples.push(sample);

    const cutoff = now - this.options.retentionMs;
    const expired = this.samples.findIndex((s) => s.at >= cutoff);
    if (expired >= DAY_MS / this.options.everyMs) {
      this.samples.splice(0, expired);
      this._rewrite();
    } else {
      this._append(sample);
    }
  }

  list({ hours }) {
    const cutoff = this.now() - hours * 60 * 60 * 1000;
    return this.samples
      .filter((s) => s.at >= cutoff)
      .map((s) => ({ ...s, at: new Date(s.at).toISOString() }));
  }

  _load() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (err) {
      if (err.code !== "ENOENT")
        console.error(`[STATUS] Cannot read ${this.file}:`, err.message);
      return [];
    }
    const cutoff = this.now() - this.options.retentionMs;
    const samples = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const sample = JSON.parse(line);
        if (sample.at >= cutoff) samples.push(sample);
      } catch {
        // A line cut short by a crash mid-append; skip it.
      }
    }
    return samples;
  }

  _append(sample) {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.appendFileSync(this.file, `${JSON.stringify(sample)}\n`);
    } catch (err) {
      console.error(`[STATUS] Cannot write ${this.file}:`, err.message);
    }
  }

  _rewrite() {
    try {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, this.samples.map((s) => `${JSON.stringify(s)}\n`).join(""));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error(`[STATUS] Cannot write ${this.file}:`, err.message);
    }
  }
}

module.exports = { MemoryHistory };
