const path = require("path");
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../environment");
const { DATA_DIR } = require("../Shared/paths");
const { StatusMonitor } = require("./monitor");

/**
 * status.pridebot.xyz — the status page, its JSON API, and /health/shards for
 * Uptime Kuma.
 *
 * Runs in the cluster manager process, NOT in cluster 0 like the other web
 * services, so it stays up while any cluster is down. It is deliberately
 * independent of API/: no shared middleware, no DB connection.
 *
 *   GET  /                          status page
 *   GET  /health                    the status service itself is up
 *   GET  /health/shards             200 when every shard is ready, else 503 + details
 *   GET  /api/status                full snapshot (refreshed every 15s)
 *   GET  /api/incidents?days=90     incident history
 *   GET  /api/memory?hours=24       per-cluster memory samples, every 5 min (max 336h)
 *   POST /api/admin/incidents                {title, message, impact?, label?}
 *   POST /api/admin/incidents/:id/updates    {message, label?}  label "resolved" closes it
 * Admin routes need `Authorization: Bearer $STATUS_ADMIN_TOKEN` and are disabled
 * (404) while it is unset.
 */

const PUBLIC_DIR = path.join(__dirname, "public");
const STATE_FILE = path.join(DATA_DIR, "status", "state.json");

function services() {
  const health = (port) => `http://127.0.0.1:${port}/health`;
  const link = (url) => (url && /^https?:\/\//.test(url) ? url : null);
  return [
    {
      key: "api",
      name: "Public API",
      healthUrl: health(config.ports.api),
      publicUrl: link(config.links.api),
    },
    {
      key: "avatar",
      name: "Avatar generator",
      healthUrl: health(config.ports.avatar),
      publicUrl: link(config.links.avatar),
    },
    {
      key: "profile",
      name: "Profiles & login",
      healthUrl: health(config.ports.profile),
      publicUrl: link(config.links.profile),
    },
    {
      key: "premium",
      name: "Premium (Patreon)",
      healthUrl: health(config.ports.premium),
      publicUrl: link(config.links.premium),
    },
  ];
}

const json429 = (_req, res) => res.status(429).json({ error: "Too many requests" });

const publicReads = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: json429,
});

const adminWrites = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: json429,
});

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();

function requireAdmin(req, res, next) {
  const token = config.secrets.statusAdmin;
  if (!token) return res.status(404).json({ error: "Not Found" });
  const given = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!given || !crypto.timingSafeEqual(digest(given), digest(token))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/** Forward an async or throwing handler's error to the error handler. */
const route = (fn) => (req, res, next) =>
  Promise.resolve()
    .then(() => fn(req, res))
    .catch(next);

/** `file` is overridable so a local preview never shares the real state file. */
function startStatusService(manager, { port, file = STATE_FILE }) {
  const monitor = new StatusMonitor(manager, { file, services: services() });
  monitor.start();

  const app = express();
  app.disable("x-powered-by");
  // Same single-proxy setup as the other services: Cloudflare tunnel → this port.
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
        // Inter and Alfa Slab One, as on pridebot.xyz.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
        "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    });
    next();
  });

  // Health endpoints are polled by monitors; they are cheap and not rate limited.
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", uptime: Math.round(process.uptime()) })
  );
  app.get("/health/shards", (_req, res) => {
    const { code, body } = monitor.healthCheck();
    res.status(code).set("Cache-Control", "no-store").json(body);
  });

  app.use(publicReads);
  app.get("/api/status", (_req, res) => {
    if (!monitor.snapshot) return res.status(503).json({ status: "starting" });
    res.set("Cache-Control", "public, max-age=10").json(monitor.snapshot);
  });
  app.get("/api/incidents", (req, res) => {
    const days = Math.min(90, Math.max(1, Number.parseInt(req.query.days, 10) || 90));
    res.set("Cache-Control", "public, max-age=30").json(monitor.listIncidents({ days }));
  });

  app.get("/api/memory", (req, res) => {
    const hours = Math.min(336, Math.max(1, Number.parseInt(req.query.hours, 10) || 24));
    res.set("Cache-Control", "public, max-age=60").json(monitor.memory.list({ hours }));
  });

  const admin = express.Router();
  admin.use(adminWrites, requireAdmin, express.json({ limit: "16kb" }));
  admin.post(
    "/incidents",
    route((req, res) => res.status(201).json(monitor.createIncident(req.body || {})))
  );
  admin.post(
    "/incidents/:id/updates",
    route((req, res) => res.json(monitor.updateIncident(req.params.id, req.body || {})))
  );
  app.use("/api/admin", admin);

  app.use(express.static(PUBLIC_DIR, { maxAge: "5m" }));

  app.use((_req, res) => res.status(404).json({ error: "Not Found" }));
  // Four parameters: Express recognises error handlers by arity.
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(`[STATUS] ${req.method} ${req.path}:`, err);
    if (res.headersSent) return;
    res
      .status(status)
      .json({ error: status < 500 ? err.message : "Internal Server Error" });
  });

  // A failed bind must not take the manager (and every cluster) down with it.
  const server = app.listen(port, () => console.log(`[STATUS] Status page on :${port}`));
  server.on("error", (err) =>
    console.error(`[STATUS] Could not serve on :${port}:`, err.message)
  );

  return {
    monitor,
    stop({ clean = true } = {}) {
      monitor.stop({ clean });
      server.close();
    },
  };
}

module.exports = { startStatusService };
