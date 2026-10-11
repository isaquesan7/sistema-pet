#!/usr/bin/env node
/**
 * PointVet 17.1 — Restricted restore drill into an already provisioned EMPTY test DB.
 * No automatic database creation or source modifications.
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
const source = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
const target = process.env.RESTORE_DATABASE_URL;
const confirm = process.env.RESTORE_TEST_CONFIRM;
const file = process.argv[2];
function dbIdentity(raw) {
  const u = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(u.protocol)) throw new Error("Unsupported protocol");
  return [u.hostname.toLowerCase(), u.port || "5432", decodeURIComponent(u.pathname.replace(/^\//, ""))].join("|");
}
if (!source || !target || !file || !existsSync(file)) {
  console.error("Provide BACKUP_DATABASE_URL, RESTORE_DATABASE_URL and existing .dump file.");
  process.exit(2);
}
let targetName;
try {
  const src = new URL(source), dst = new URL(target);
  targetName = decodeURIComponent(dst.pathname.replace(/^\//, ""));
  if (!targetName || dbIdentity(source) === dbIdentity(target)) throw new Error("Same database");
  if (!/^pointvet_restore_[a-z0-9_]+$/i.test(targetName)) throw new Error("Dedicated restore database name required");
} catch {
  console.error("Restore refused: source and target must be different and test DB must be named pointvet_restore_*.");
  process.exit(2);
}
if (confirm !== targetName) {
  console.error("Restore refused: set RESTORE_TEST_CONFIRM equal to the target database name.");
  process.exit(2);
}
if (!file.endsWith(".dump") || statSync(file).size === 0) {
  console.error("Restore refused: backup must be nonempty .dump file.");
  process.exit(2);
}
const list = spawnSync("pg_restore", ["--list", file], { stdio: ["ignore", "ignore", "pipe"] });
if (list.error || list.status !== 0) { console.error("Invalid archive or pg_restore unavailable."); process.exit(1); }
const run = spawnSync("pg_restore", ["--exit-on-error", "--single-transaction", "--no-owner", "--no-acl", "--dbname", target, file], { stdio: ["ignore", "ignore", "pipe"] });
if (run.error || run.status !== 0) {
  console.error("Restore drill failed. The destination may not be empty or permissions may be insufficient; check locally without exposing secrets.");
  process.exit(1);
}
console.log("Restore completed in dedicated test DB. Verify table counts and application integrity before deleting test resources.");
