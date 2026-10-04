const store = require("./store");
const uptime = require("./uptime");
const { clusterSnapshot, checkHttp, checkDiscord } = require("./probes");

/**
 * Watches every cluster, shard and HTTP service from the cluster manager process,
 * so it keeps reporting when any single cluster is dead — including cluster 0,
 * which hosts the APIs.
 *
 * Built after the 2026-10-03 V1 outage: cluster 2's login failed with a gateway
 * 522, its process stayed alive with no Discord connection, and shards 8–11 were
 * offline for ~22h. Bot presence still showed "online" (15 of 19 shards were up),
 * so nothing noticed. Here each cluster is asked for its own shard states over IPC,
 * and a cluster that doesn't answer counts as down.
 *
 * Incidents open automatically once a component has been unhealthy for
 * `incidentGraceMs` (normal gateway resumes take seconds and never open one) and
 * resolve on the first healthy check.
 */

// discord.js Status enum, by value.
const SHARD_STATES = [
  "Ready",
  "Connecting",
  "Reconnecting",
  "Idle",
  "Nearly",
  "Disconnected",
  "WaitingForGuilds",
  "Identifying",
  "Resuming",
];
/** On their way to Ready; anything else not Ready is down. */
const TRANSIENT_STATES = new Set([1, 2, 4, 6, 7, 8]);

const DEFAULTS = {
  intervalMs: 15_000,
  evalTimeoutMs: 5_000,
  httpTimeoutMs: 5_000,
  /** A service slower than this is degraded. */
  slowMs: 2_000,
  /** How long a component must stay unhealthy before an incident opens. */
  incidentGraceMs: 60_000,
  /** After boot, clusters and services that have not come up yet are "starting". */
  startupGraceMs: 5 * 60_000,
  discordEveryMs: 5 * 60_000,
  incidentRetentionMs: uptime.HISTORY_DAYS * uptime.DAY_MS,
  maxEvents: 200,
};

const SEVERITY = {
  operational: 0,
  starting: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};
const DESCRIPTIONS = {
  operational: "All systems operational",
  starting: "Starting up",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
};
const MANUAL_LABELS = new Set([
  "investigating",
  "identified",
  "monitoring",
  "update",
  "resolved",
]);

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** [8, 9, 10, 11] → "8–11"; non-contiguous lists are comma-separated. */
function formatShards(ids) {
  if (!ids.length) return "none";
  const contiguous = ids.every((id, i) => i === 0 || id === ids[i - 1] + 1);
  if (contiguous && ids.length > 2) return `${ids[0]}–${ids[ids.length - 1]}`;
  return ids.join(", ");
}

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

class StatusMonitor {
  /**
   * @param manager  discord-hybrid-sharding ClusterManager
   * @param options.file      JSON state file (incidents, uptime history)
   * @param options.services  [{ key, name, healthUrl, publicUrl }]
   * @param options.now       clock, injectable for tests
   */
  constructor(manager, { file, services = [], now = Date.now, ...options } = {}) {
    this.manager = manager;
    this.file = file;
    this.services = services;
    this.now = now;
    this.options = { ...DEFAULTS, ...options };

    this.state = store.load(file);
    this.startedAt = now();
    this.clusterInfo = new Map();
    this.serviceEverUp = new Set();
    this.badSince = new Map();
    this.lastCheckAt = null;
    this.allReadySince = null;
    this.discord = null;
    this.discordCheckedAt = 0;
    this.snapshot = null;
    this.timer = null;
    this.running = false;
  }

  start() {
    this._accountForDowntime();
    this.state.cleanShutdown = false;
    this._save();

    this.running = true;
    const loop = async () => {
      try {
        await this.check();
      } catch (err) {
        console.error("[STATUS] Check failed:", err);
      }
      if (this.running) this.timer = setTimeout(loop, this.options.intervalMs);
    };
    this.timer = setTimeout(loop, 0);
  }

  /** Synchronous so it can run inside a signal handler right before exit. */
  stop({ clean = true } = {}) {
    this.running = false;
    clearTimeout(this.timer);
    this.state.cleanShutdown = clean;
    // The clusters were serving until this moment, not just until the last check.
    if (this.lastCheckAt) this.state.lastSeen = this.now();
    this._save();
  }

  /** Called from clustermanager.js for the library's cluster events. */
  recordClusterEvent(id, type) {
    const info = this._info(id);
    const now = this.now();
    const shards = formatShards(this._shardList(id));
    if (type === "spawn") {
      info.lastSpawnAt = now;
    } else if (type === "ready") {
      info.lastReadyAt = now;
      info.everReady = true;
    } else if (type === "death") {
      info.deaths += 1;
      info.lastDeathAt = now;
      info.diedAt ??= now;
      this._event("death", `Cluster ${id} (shards ${shards}) process exited; respawning`);
    }
  }

  async check() {
    const now = this.now();
    const { options } = this;
    const layout = this._layout();

    const [clusters, services] = await Promise.all([
      Promise.all(layout.map((shardList, id) => this._checkCluster(id, shardList, now))),
      Promise.all(this.services.map((service) => this._checkService(service, now))),
    ]);

    if (now - this.discordCheckedAt >= options.discordEveryMs) {
      this.discordCheckedAt = now;
      const discord = await checkDiscord(options.httpTimeoutMs);
      this.discord = discord ? { ...discord, checkedAt: iso(now) } : null;
    }

    const shards = clusters.flatMap((cluster) => cluster.shardDetails);
    const totalShards =
      typeof this.manager.totalShards === "number"
        ? this.manager.totalShards
        : shards.length;
    const shardsReady = shards.filter((shard) => shard.status === "operational").length;
    const botStatus = this._botStatus(clusters, shardsReady, totalShards);

    if (botStatus === "operational") this.allReadySince ??= now;
    else this.allReadySince = null;

    if (layout.length) this._updateIncidents(clusters, services, now);
    this._recordUptime(clusters, services, shardsReady, totalShards, now);

    this.lastCheckAt = now;
    this.state.lastSeen = now;
    this._save();

    this.snapshot = this._buildSnapshot({
      clusters,
      services,
      shards,
      shardsReady,
      totalShards,
      botStatus,
      now,
    });
    return this.snapshot;
  }

  /** For external monitors: 200 only when every shard is ready and checks are current. */
  healthCheck() {
    const now = this.now();
    const snapshot = this.snapshot;
    if (!snapshot) return { code: 503, body: { status: "starting" } };

    const stale = now - this.lastCheckAt > this.options.intervalMs * 3;
    const { bot } = snapshot;
    const body = {
      status: stale ? "stale" : bot.status,
      shardsReady: bot.shardsReady,
      totalShards: bot.totalShards,
      shardsDown: snapshot.shards
        .filter((s) => s.status !== "operational")
        .map((s) => s.id),
      clusters: Object.fromEntries(
        snapshot.clusters
          .filter((c) => c.status !== "operational")
          .map((c) => [c.id, c.error || c.status])
      ),
      checkedAt: snapshot.generatedAt,
    };
    return { code: !stale && bot.status === "operational" ? 200 : 503, body };
  }

  createIncident({ title, message, impact = "minor", label = "investigating" }) {
    if (!title || !message)
      throw Object.assign(new Error("title and message are required"), { status: 400 });
    const now = this.now();
    const incident = this._addIncident({
      kind: "manual",
      component: null,
      title: String(title).slice(0, 200),
      impact: impact === "major" ? "major" : "minor",
      startedAt: now,
      resolvedAt: label === "resolved" ? now : null,
      updates: [
        {
          at: now,
          label: MANUAL_LABELS.has(label) ? label : "investigating",
          message: String(message).slice(0, 2000),
        },
      ],
    });
    this._save();
    return this._publicIncident(incident, now);
  }

  updateIncident(id, { message, label = "update" }) {
    const incident = this.state.incidents.find((i) => i.id === Number(id));
    if (!incident) throw Object.assign(new Error("No such incident"), { status: 404 });
    if (!message) throw Object.assign(new Error("message is required"), { status: 400 });
    const now = this.now();
    const safeLabel = MANUAL_LABELS.has(label) ? label : "update";
    incident.updates.push({
      at: now,
      label: safeLabel,
      message: String(message).slice(0, 2000),
    });
    if (safeLabel === "resolved") incident.resolvedAt ??= now;
    this._save();
    return this._publicIncident(incident, now);
  }

  listIncidents({ days = 90 } = {}) {
    const now = this.now();
    const since = now - days * uptime.DAY_MS;
    return this.state.incidents
      .filter((i) => !i.resolvedAt || i.resolvedAt >= since)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((i) => this._publicIncident(i, now));
  }

  // ── internals ──────────────────────────────────────────────────────────────

  _layout() {
    const list = this.manager.shardClusterList;
    return Array.isArray(list) ? list : [];
  }

  _shardList(id) {
    return this._layout()[id] || this.manager.clusters?.get(id)?.shardList || [];
  }

  _info(id) {
    if (!this.clusterInfo.has(id)) {
      this.clusterInfo.set(id, {
        deaths: 0,
        lastDeathAt: null,
        lastReadyAt: null,
        lastSpawnAt: null,
        everReady: false,
        /** Set on death, cleared (with a "back online" event) once all shards are ready. */
        diedAt: null,
      });
    }
    return this.clusterInfo.get(id);
  }

  _inStartup(now) {
    return now - this.startedAt < this.options.startupGraceMs;
  }

  async _checkCluster(id, shardList, now) {
    const cluster = this.manager.clusters?.get(id);
    const info = this._info(id);

    let probe = null;
    let error = null;
    if (!cluster) error = "not spawned yet";
    else if (!cluster.thread) error = "process not running";
    else {
      try {
        probe = await cluster.eval(
          clusterSnapshot,
          undefined,
          this.options.evalTimeoutMs
        );
      } catch (err) {
        error = /timed out/i.test(err.message)
          ? `no reply in ${this.options.evalTimeoutMs / 1000}s`
          : err.message;
      }
    }

    const reported = new Map((probe?.shards || []).map((shard) => [shard.id, shard]));
    const shardDetails = shardList.map((shardId) => {
      const shard = reported.get(shardId);
      const code = shard ? shard.status : null;
      let status = "down";
      if (code === 0) status = "operational";
      else if (TRANSIENT_STATES.has(code)) status = "degraded";
      return {
        id: shardId,
        cluster: id,
        status,
        state: code === null ? "Unknown" : SHARD_STATES[code] || `Status ${code}`,
        ping: shard && shard.ping >= 0 ? Math.round(shard.ping) : null,
        guilds: shard ? shard.guilds : null,
        lastHeartbeatAt: iso(shard?.lastPingAt),
      };
    });

    const shardsReady = shardDetails.filter(
      (shard) => shard.status === "operational"
    ).length;
    let status;
    if (error || shardsReady === 0) status = "down";
    else if (shardsReady < shardDetails.length) status = "degraded";
    else status = "operational";

    if (status === "operational") {
      info.everReady = true;
      if (info.diedAt) {
        this._event(
          "recovered",
          `Cluster ${id} (shards ${formatShards(shardList)}) back online ${formatDuration(now - info.diedAt)} after it exited`
        );
        info.diedAt = null;
      }
    } else if (!info.everReady && this._inStartup(now)) {
      status = "starting";
      for (const shard of shardDetails)
        if (shard.status !== "operational") shard.status = "starting";
    }

    return {
      id,
      status,
      shards: shardList,
      shardRange: formatShards(shardList),
      shardsReady,
      error,
      alive: Boolean(cluster?.thread),
      uptime: probe ? Math.round(probe.uptime) : null,
      memoryMB: probe ? Math.round(probe.rss / 1048576) : null,
      heapMB: probe ? Math.round(probe.heapUsed / 1048576) : null,
      guilds: probe ? probe.guilds : null,
      members: probe ? probe.members : null,
      restarts: cluster?.restarts?.current ?? 0,
      maxRestarts: cluster?.restarts?.max ?? null,
      deaths: info.deaths,
      lastDeathAt: iso(info.lastDeathAt),
      lastReadyAt: iso(info.lastReadyAt),
      shardDetails,
    };
  }

  async _checkService(service, now) {
    const result = await checkHttp(service.healthUrl, this.options.httpTimeoutMs);
    let status = "operational";
    if (!result.ok) status = "down";
    else if (result.latency > this.options.slowMs) status = "degraded";

    if (result.ok) this.serviceEverUp.add(service.key);
    else if (!this.serviceEverUp.has(service.key) && this._inStartup(now))
      status = "starting";

    return {
      key: service.key,
      name: service.name,
      url: service.publicUrl,
      status,
      latency: result.latency,
      httpStatus: result.httpStatus,
      error: result.ok ? null : result.error || `HTTP ${result.httpStatus}`,
    };
  }

  _botStatus(clusters, shardsReady, totalShards) {
    if (!clusters.length) return "starting";
    if (shardsReady === totalShards) return "operational";
    if (clusters.every((c) => c.status === "starting" || c.status === "operational"))
      return "starting";
    if (shardsReady === 0) return "major_outage";
    if (clusters.some((c) => c.status === "down")) return "partial_outage";
    return "degraded";
  }

  _overallStatus(botStatus, services) {
    let worst = botStatus;
    for (const service of services) {
      const level =
        service.status === "down"
          ? "partial_outage"
          : service.status === "degraded"
            ? "degraded"
            : null;
      if (level && SEVERITY[level] > SEVERITY[worst]) worst = level;
    }
    return worst;
  }

  _updateIncidents(clusters, services, now) {
    const components = [
      ...clusters.map((c) => ({
        key: `cluster:${c.id}`,
        label: `Cluster ${c.id}`,
        status: c.status,
        title:
          c.status === "down"
            ? `Cluster ${c.id} offline (shards ${c.shardRange})`
            : `Cluster ${c.id} degraded`,
        detail: this._clusterDetail(c),
      })),
      ...services.map((s) => ({
        key: `service:${s.key}`,
        label: s.name,
        status: s.status,
        title:
          s.status === "down" ? `${s.name} unavailable` : `${s.name} responding slowly`,
        detail:
          s.status === "down"
            ? `${s.name} health check failed: ${s.error}.`
            : `${s.name} is taking ${s.latency} ms to respond.`,
      })),
    ];

    const present = new Set(components.map((c) => c.key));
    for (const component of components) {
      const open = this.state.incidents.find(
        (i) => !i.resolvedAt && i.component === component.key
      );
      const bad = component.status === "down" || component.status === "degraded";

      if (!bad) {
        this.badSince.delete(component.key);
        if (open && component.status === "operational") {
          this._resolve(
            open,
            now,
            `${component.label} recovered after ${formatDuration(now - open.startedAt)}.`
          );
        }
        continue;
      }

      if (!this.badSince.has(component.key)) this.badSince.set(component.key, now);
      const impact = component.status === "down" ? "major" : "minor";

      if (!open) {
        const since = this.badSince.get(component.key);
        if (now - since < this.options.incidentGraceMs) continue;
        const incident = this._addIncident({
          kind: "auto",
          component: component.key,
          title: component.title,
          impact,
          startedAt: since,
          resolvedAt: null,
          updates: [{ at: now, label: "investigating", message: component.detail }],
        });
        incident.lastDetail = component.detail;
        console.warn(`[STATUS] Incident #${incident.id} opened: ${component.title}`);
      } else if (open.lastDetail !== component.detail) {
        open.updates.push({ at: now, label: "update", message: component.detail });
        open.lastDetail = component.detail;
        if (impact === "major" && open.impact !== "major") {
          open.impact = "major";
          open.title = component.title;
        }
      }
    }

    // A component that no longer exists (cluster layout changed) can't recover.
    for (const incident of this.state.incidents) {
      if (
        incident.kind === "auto" &&
        !incident.resolvedAt &&
        incident.component &&
        !present.has(incident.component)
      ) {
        this._resolve(
          incident,
          now,
          "Component no longer exists after a restart with a new shard layout."
        );
      }
    }
  }

  _clusterDetail(cluster) {
    const prefix = `Cluster ${cluster.id} (shards ${cluster.shardRange})`;
    if (cluster.error) return `${prefix} is not responding: ${cluster.error}.`;
    const notReady = cluster.shardDetails.filter((s) => s.status !== "operational");
    const states = notReady.map((s) => `shard ${s.id} ${s.state}`).join(", ");
    return `${prefix}: ${cluster.shardsReady}/${cluster.shards.length} shards online; ${states}.`;
  }

  _recordUptime(clusters, services, shardsReady, totalShards, now) {
    const { uptime: history } = this.state;
    const elapsed = this.lastCheckAt
      ? Math.min(now - this.lastCheckAt, this.options.intervalMs * 2)
      : 0;
    if (elapsed > 0 && clusters.length) {
      const from = now - elapsed;
      uptime.addSpan(
        history,
        "bot",
        from,
        now,
        totalShards ? shardsReady / totalShards : 0
      );
      for (const c of clusters) {
        uptime.addSpan(
          history,
          `cluster:${c.id}`,
          from,
          now,
          c.shards.length ? c.shardsReady / c.shards.length : 0
        );
      }
      for (const s of services) {
        uptime.addSpan(
          history,
          `service:${s.key}`,
          from,
          now,
          s.status === "down" || s.status === "starting" ? 0 : 1
        );
      }
    }
    uptime.prune(history, now);

    const cutoff = now - this.options.incidentRetentionMs;
    this.state.incidents = this.state.incidents.filter(
      (i) => !i.resolvedAt || i.resolvedAt >= cutoff
    );
  }

  /** On boot: count the time the manager was stopped as downtime, and say why. */
  _accountForDowntime() {
    const { lastSeen, cleanShutdown } = this.state;
    if (!lastSeen) return;
    const now = this.now();
    const gap = now - lastSeen;
    if (gap <= 0) return;

    for (const component of Object.keys(this.state.uptime)) {
      uptime.addSpan(this.state.uptime, component, lastSeen, now, 0);
    }

    // Anything still open was interrupted by the restart; checks reopen it if needed.
    for (const incident of this.state.incidents) {
      if (!incident.resolvedAt && incident.kind === "auto") {
        this._resolve(
          incident,
          lastSeen,
          "Status monitoring stopped; see the restart below."
        );
      }
    }

    if (cleanShutdown) {
      this._event(
        "restart",
        `Pridebot restarted (planned); offline for ${formatDuration(gap)}`
      );
    } else {
      this._addIncident({
        kind: "auto",
        component: "bot",
        title: "Pridebot was offline",
        impact: "major",
        startedAt: lastSeen,
        resolvedAt: now,
        updates: [
          {
            at: now,
            label: "resolved",
            message:
              `Pridebot stopped unexpectedly and was offline for about ${formatDuration(gap)} ` +
              `(start time accurate to ${this.options.intervalMs / 1000}s).`,
          },
        ],
      });
    }
  }

  _addIncident(fields) {
    const incident = { id: this.state.nextIncidentId++, ...fields };
    this.state.incidents.push(incident);
    return incident;
  }

  _resolve(incident, at, message) {
    incident.resolvedAt = at;
    incident.updates.push({ at, label: "resolved", message });
    delete incident.lastDetail;
    console.log(`[STATUS] Incident #${incident.id} resolved: ${incident.title}`);
  }

  _event(type, message) {
    this.state.events.push({ at: this.now(), type, message });
    if (this.state.events.length > this.options.maxEvents) {
      this.state.events.splice(0, this.state.events.length - this.options.maxEvents);
    }
  }

  _publicIncident(incident, now) {
    return {
      id: incident.id,
      kind: incident.kind,
      component: incident.component,
      title: incident.title,
      impact: incident.impact,
      startedAt: iso(incident.startedAt),
      resolvedAt: iso(incident.resolvedAt),
      durationMs: (incident.resolvedAt || now) - incident.startedAt,
      updates: [...incident.updates]
        .sort((a, b) => b.at - a.at)
        .map((u) => ({ at: iso(u.at), label: u.label, message: u.message })),
    };
  }

  _buildSnapshot({
    clusters,
    services,
    shards,
    shardsReady,
    totalShards,
    botStatus,
    now,
  }) {
    const pings = shards.map((s) => s.ping).filter((p) => p !== null);
    const sum = (key) =>
      clusters.some((c) => c[key] !== null)
        ? clusters.reduce((acc, c) => acc + (c[key] || 0), 0)
        : null;
    const overall = this._overallStatus(botStatus, services);
    const history = this.state.uptime;

    const incidents = this.listIncidents({ days: 14 });
    return {
      generatedAt: iso(now),
      intervalSeconds: this.options.intervalMs / 1000,
      overall: { status: overall, description: DESCRIPTIONS[overall] },
      bot: {
        status: botStatus,
        description: DESCRIPTIONS[botStatus],
        shardsReady,
        totalShards,
        clustersOperational: clusters.filter((c) => c.status === "operational").length,
        totalClusters: clusters.length,
        guilds: sum("guilds"),
        members: sum("members"),
        averagePing: pings.length
          ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
          : null,
        allShardsReadySince: iso(this.allReadySince),
        managerStartedAt: iso(this.startedAt),
      },
      clusters: clusters.map(({ shardDetails: _omit, ...cluster }) => cluster),
      shards,
      services,
      discord: this.discord,
      incidents: {
        active: incidents.filter((i) => !i.resolvedAt),
        recent: incidents.filter((i) => i.resolvedAt),
      },
      events: this.state.events
        .slice(-30)
        .reverse()
        .map((e) => ({ at: iso(e.at), type: e.type, message: e.message })),
      uptime: {
        bot: uptime.summarize(history, "bot", now),
        clusters: Object.fromEntries(
          clusters.map((c) => [c.id, uptime.summarize(history, `cluster:${c.id}`, now)])
        ),
        services: Object.fromEntries(
          services.map((s) => [s.key, uptime.summarize(history, `service:${s.key}`, now)])
        ),
      },
    };
  }

  _save() {
    try {
      store.save(this.file, this.state);
    } catch (err) {
      console.error("[STATUS] Could not save state:", err.message);
    }
  }
}

module.exports = { StatusMonitor, formatDuration, formatShards };
