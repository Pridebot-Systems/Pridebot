const mongoose = require("mongoose");
const config = require("../environment");

/**
 * The single Mongo connection.
 *
 * V1 connected inline in src/index.js and additionally shipped mongo/database.js —
 * a second native-driver client, with the database name hardcoded to "Cluster0",
 * that had zero importers and pointed at an empty database. Only this file
 * connects now.
 *
 * NOTE: V1's databaseToken URI had no database path, so every model wrote to the
 * default "test" database. Put the real name in the URI.
 */

let connecting = null;

async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  mongoose.connection.on("error", (err) =>
    console.error("[DB] connection error:", err.message)
  );
  mongoose.connection.on("disconnected", () => console.warn("[DB] disconnected"));
  mongoose.connection.once("open", () =>
    console.log(`[DB] connected to ${mongoose.connection.name}`)
  );

  connecting = mongoose
    .connect(config.databaseToken, { serverSelectionTimeoutMS: 10000 })
    .then(() => mongoose.connection)
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
