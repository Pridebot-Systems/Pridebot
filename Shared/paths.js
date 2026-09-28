/**
 * Filesystem locations shared by Bot/ and API/.
 *
 * V1 built these from __dirname at each call site ("../../pfps", "../../flags",
 * "..", "..", "..", "profilepfps"), so moving any file silently pointed it at a
 * different directory. Runtime-generated data now lives under data/, which is
 * gitignored and separate from source.
 *
 * DEPLOY NOTE: on the production host, V1's src/pfps/ and src/profilepfps/ hold
 * every generated avatar. Move them to data/pfps/ and data/profilepfps/ before
 * the first V2 boot, or existing avatars will 404.
 */

const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

module.exports = {
  ROOT,
  DATA_DIR,
  PFPS_DIR: path.join(DATA_DIR, "pfps"),
  PROFILE_PFPS_DIR: path.join(DATA_DIR, "profilepfps"),
  SHUTDOWN_FILE: path.join(DATA_DIR, "shutdown-time.txt"),
  FLAGS_DIR: path.join(ROOT, "Web", "assets", "flags"),
  COMMANDS_DIR: path.join(ROOT, "Bot", "commands"),
  EVENTS_DIR: path.join(ROOT, "Bot", "events"),
};
